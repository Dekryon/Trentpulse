// The busyness score (plan section 05):
//   score = 0.5 * live + 0.3 * baseline + 0.2 * lecture_boost
// With fewer than 3 recent check-ins, live's weight moves to the baseline.
import { pool } from './db.js'
import { levelOf, type NowResponse } from './types.js'

type SpaceRow = { id: string; name: string; type: string; lng: number; lat: number }
let spacesCache: SpaceRow[] | null = null

export async function getSpaces(): Promise<SpaceRow[]> {
  if (!spacesCache) spacesCache = (await pool.query<SpaceRow>('SELECT id, name, bank, type, lng, lat FROM spaces ORDER BY id')).rows
  return spacesCache
}

function meters(a: SpaceRow, b: SpaceRow) {
  const R = 6_371_000, r = (d: number) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Campus local time pieces (the server may run in UTC)
function campusTime(at: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(at)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const dow = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday')) + 1 // ISO 1..7
  return { dow, hour: Number(get('hour')), hours: Number(get('hour')) + Number(get('minute')) / 60 }
}

export async function computeScores(at: Date): Promise<{ scores: Record<string, number>; reports: Record<string, number>; events: string[] }> {
  const spaces = await getSpaces()
  const { dow, hour, hours } = campusTime(at)

  // live: recent check-ins, newer ones weigh more
  const live = await pool.query<{ space_id: string; live: number; n: number }>(
    `SELECT space_id,
            sum((level - 1) * 25 * (1 - extract(epoch FROM ($1::timestamptz - time)) / 1200))
              / nullif(sum(1 - extract(epoch FROM ($1::timestamptz - time)) / 1200), 0) AS live,
            count(*)::int AS n
     FROM checkins
     WHERE time > $1::timestamptz - INTERVAL '20 minutes' AND time <= $1::timestamptz
     GROUP BY space_id`, [at.toISOString()])

  // baseline: typical score for this weekday and hour
  const base = await pool.query<{ space_id: string; typical: number }>(
    `SELECT space_id, avg(avg_score) AS typical
     FROM busyness_1h
     WHERE extract(isodow FROM bucket AT TIME ZONE 'America/Toronto') = $1
       AND extract(hour FROM bucket AT TIME ZONE 'America/Toronto') = $2
       AND bucket < $3::timestamptz - INTERVAL '1 day'
     GROUP BY space_id`, [dow, hour, at.toISOString()])

  const lectures = await pool.query<{ space_id: string; s: number; e: number; est_size: number }>(
    `SELECT space_id, extract(epoch FROM starts) / 3600 AS s, extract(epoch FROM ends) / 3600 AS e, est_size
     FROM lectures WHERE dow = $1`, [dow])

  const byId = Object.fromEntries(spaces.map((s) => [s.id, s]))
  const boost: Record<string, number> = Object.fromEntries(spaces.map((s) => [s.id, 0]))
  const events: string[] = []
  for (const L of lectures.rows) {
    const where = byId[L.space_id]
    if (!where) continue
    if (hours >= L.s && hours < L.e) {
      boost[L.space_id] += (L.est_size / 260) * 100
      events.push(`In class: about ${L.est_size} students in ${where.name}`)
    }
    const since = (hours - L.e) * 60
    if (since >= 0 && since <= 25) {
      events.push(`Lecture let out ${Math.round(since)} min ago at ${where.name}`)
      for (const s of spaces) {
        if (s.type === 'lecture') continue
        boost[s.id] += (L.est_size / 260) * 100 * Math.exp(-meters(where, s) / 450) * (1 - since / 25)
      }
    }
  }

  const scores: Record<string, number> = {}
  const reports: Record<string, number> = {}
  for (const s of spaces) {
    const l = live.rows.find((r) => r.space_id === s.id)
    const b = Number(base.rows.find((r) => r.space_id === s.id)?.typical ?? 0)
    const k = Math.min(100, boost[s.id])
    reports[s.id] = l?.n ?? 0
    const score = l && l.n >= 3
      ? 0.5 * Number(l.live) + 0.3 * b + 0.2 * k
      : 0.8 * b + 0.2 * k
    scores[s.id] = Math.max(0, Math.min(100, Math.round(score)))
  }
  return { scores, reports, events }
}

export async function nowResponse(at: Date): Promise<NowResponse> {
  const [cur, prev] = await Promise.all([computeScores(at), computeScores(new Date(at.getTime() - 15 * 60_000))])
  const spaces = await getSpaces()
  return {
    updated_at: at.toISOString(),
    events: cur.events,
    spaces: spaces.map((s) => {
      const score = cur.scores[s.id], before = prev.scores[s.id]
      return {
        id: s.id, score, level: levelOf(score), reports_20m: cur.reports[s.id],
        trend: score - before > 3 ? 'up' : before - score > 3 ? 'down' : 'flat',
      }
    }),
  }
}
