import Fastify from 'fastify'
import cors from '@fastify/cors'
import { z } from 'zod'
import { GoogleGenAI } from '@google/genai'
import { pool } from './db.js'
import { computeScores, getSpaces, nowResponse } from './score.js'
import { levelOf, type HistoryResponse } from './types.js'

const app = Fastify({ logger: true })
await app.register(cors, { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',') })

// GET /api/spaces : the list of places we track
app.get('/api/spaces', async () => getSpaces())

// GET /api/now : live scores (the front end polls this every 15 s)
app.get('/api/now', async () => nowResponse(new Date()))

// GET /api/forecast?at=ISO : same shape, for the time scrubber
app.get('/api/forecast', async (req, reply) => {
  const q = z.object({ at: z.string().datetime({ offset: true }) }).safeParse(req.query)
  if (!q.success) return reply.code(400).send({ error: 'Pass ?at= as an ISO date, e.g. 2026-11-07T17:00:00Z' })
  return nowResponse(new Date(q.data.at))
})

// POST /api/checkins : a student taps 1..5
const CheckinBody = z.object({ space_id: z.string().min(1).max(20), level: z.number().int().min(1).max(5) })
app.post('/api/checkins', async (req, reply) => {
  const body = CheckinBody.safeParse(req.body)
  if (!body.success) return reply.code(400).send({ error: 'Send { space_id, level } with level 1 to 5' })
  const exists = (await getSpaces()).some((s) => s.id === body.data.space_id)
  if (!exists) return reply.code(404).send({ error: 'Unknown space_id' })
  await pool.query('INSERT INTO checkins (space_id, level, device) VALUES ($1, $2, $3)',
    [body.data.space_id, body.data.level, req.ip])
  return reply.code(201).send({ ok: true })
})

// GET /api/spaces/:id/history : today vs typical, every 30 min (from the hourly aggregate)
app.get<{ Params: { id: string } }>('/api/spaces/:id/history', async (req): Promise<HistoryResponse> => {
  const { id } = req.params
  const today = await pool.query<{ t: Date; score: number }>(
    `SELECT bucket AS t, round(avg_score)::int AS score FROM busyness_1h
     WHERE space_id = $1 AND bucket >= date_trunc('day', now() AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto'
     ORDER BY bucket`, [id])
  const typical = await pool.query<{ h: number; score: number }>(
    `SELECT extract(hour FROM bucket AT TIME ZONE 'America/Toronto')::int AS h, round(avg(avg_score))::int AS score
     FROM busyness_1h
     WHERE space_id = $1
       AND extract(isodow FROM bucket AT TIME ZONE 'America/Toronto') = extract(isodow FROM now() AT TIME ZONE 'America/Toronto')
       AND bucket < now() - INTERVAL '1 day'
     GROUP BY 1 ORDER BY 1`, [id])
  const day = new Date(); day.setMinutes(0, 0, 0)
  return {
    today: today.rows.map((r) => ({ t: new Date(r.t).toISOString(), score: r.score })),
    typical: typical.rows.filter((r) => r.h >= 7 && r.h <= 23).map((r) => {
      const t = new Date(day); t.setHours(r.h); return { t: t.toISOString(), score: r.score }
    }),
  }
})

// GET /api/suggest?near=bata : a short tip, written by Gemini if a key is set
const ai = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null
const TIP_TTL_MS = 3 * 60_000
const tipCache = new Map<string, { text: string; at: number }>()
app.get('/api/suggest', async (req, reply) => {
  const near = String((req.query as { near?: string }).near ?? '')
  const spaces = await getSpaces()
  const here = spaces.find((s) => s.id === near)
  if (!here) return reply.code(404).send({ error: 'Unknown space' })
  const { scores } = await computeScores(new Date())
  const list = spaces.filter((s) => s.type !== 'lecture')
    .map((s) => `${s.name}: ${levelOf(scores[s.id])} (${scores[s.id]}/100)`).join('\n')
  const fallback = () => {
    const best = spaces.filter((s) => s.id !== near && s.type !== 'lecture' && s.type !== 'gym')
      .sort((a, b) => scores[a.id] - scores[b.id])[0]
    const lv = levelOf(scores[near])
    return lv === 'busy' || lv === 'packed'
      ? `${here.name} is ${lv}. ${best.name} is ${levelOf(scores[best.id])} right now.`
      : `${here.name} is ${lv}. Good time to go.`
  }
  if (!ai) return { text: fallback() }
  // The free Gemini tier allows about 5 requests a minute, so reuse a tip for the same
  // building at the same busyness level for 3 minutes instead of asking again.
  const cacheKey = `${near}:${levelOf(scores[near])}`
  const cached = tipCache.get(cacheKey)
  if (cached && Date.now() - cached.at < TIP_TTL_MS) return { text: cached.text }
  const prompt = `You help Trent University students find a place to study or hang out.
Current busyness on Symons Campus:
${list}
The student is looking at ${here.name}. In one short sentence (max 20 words), say how busy it is and,
if it is busy or packed, suggest the best quieter alternative. Friendly, no emojis.`
  // Try the main model, then a backup model, each capped at 5 seconds, so a busy or slow
  // Gemini never leaves the tip box stuck. If both fail we use the rule-based tip.
  const models = [
    process.env.GEMINI_MODEL ?? 'gemini-3.5-flash',
    process.env.GEMINI_BACKUP_MODEL ?? 'gemini-3.8-flash',
  ]
  for (const model of models) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { abortSignal: AbortSignal.timeout(5000) },
      })
      const text = res.text?.trim()
      if (text) {
        tipCache.set(cacheKey, { text, at: Date.now() })
        return { text }
      }
    } catch (err) {
      req.log.warn({ model, err: (err as Error).message }, 'Gemini failed, trying next option')
    }
  }
  return { text: fallback() }
})

// GET /api/stats : numbers for the pitch (rows, compression, query speed)
app.get('/api/stats', async () => {
  const t0 = performance.now()
  await computeScores(new Date())
  const queryMs = Math.round(performance.now() - t0)
  const rows = await pool.query<{ n: string }>(`SELECT approximate_row_count('samples') AS n`)
  const comp = await pool.query<{ before: string | null; after: string | null }>(
    `SELECT sum(before_compression_total_bytes) AS before, sum(after_compression_total_bytes) AS after
     FROM hypertable_compression_stats('samples')`)
  const before = Number(comp.rows[0]?.before ?? 0), after = Number(comp.rows[0]?.after ?? 0)
  return {
    rows_total: Number(rows.rows[0]?.n ?? 0),
    compression_ratio: after ? Math.round((before / after) * 10) / 10 : null,
    score_query_ms: queryMs,
  }
})

app.get('/health', async () => ({ ok: true }))

const port = Number(process.env.PORT ?? 3001)
app.listen({ port, host: '0.0.0.0' })
