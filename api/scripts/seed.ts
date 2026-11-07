// Fills Tiger Data with realistic history so charts and baselines look real.
// 90 days x 9 spaces x 1 sample per minute = about 1.2 million rows.
// Run: npm run seed   (takes a few minutes)
import { pool } from '../src/db.js'

const DAYS = Number(process.env.SEED_DAYS ?? 90)
const CURVE: Record<string, number[]> = {
  study:   [5, 10, 25, 45, 55, 62, 66, 70, 72, 70, 60, 55, 50, 45, 35, 20, 8],
  gym:     [20, 35, 30, 25, 30, 40, 35, 30, 40, 65, 80, 75, 60, 40, 25, 10, 3],
  social:  [5, 15, 30, 40, 55, 80, 70, 50, 45, 50, 45, 35, 30, 25, 15, 8, 3],
  college: [10, 25, 30, 28, 35, 60, 48, 32, 30, 45, 58, 42, 30, 22, 14, 8, 3],
  lecture: [0, 20, 50, 45, 50, 35, 50, 50, 45, 35, 22, 14, 10, 5, 0, 0, 0],
}
const DAY_FACTOR = [0.55, 1.0, 1.05, 1.0, 1.05, 0.8, 0.5] // Sun..Sat

function curveAt(type: string, h: number) {
  const c = CURVE[type], i = h - 7
  if (i < 0) return Math.max(0, c[0] * (1 + i / 3))       // fade in before 7:00
  if (i >= c.length - 1) return Math.max(0, c[c.length - 1] * (1 - (i - c.length + 1) / 2))
  const f = Math.floor(i), t = i - f
  return c[f] * (1 - t) + c[f + 1] * t
}

const spaces = (await pool.query<{ id: string; type: string }>('SELECT id, type FROM spaces')).rows
if (!spaces.length) throw new Error('No spaces. Run npm run db:schema first.')

console.log(`Clearing old seed data...`)
await pool.query('TRUNCATE samples')

const end = new Date(); end.setSeconds(0, 0)
const start = new Date(end.getTime() - DAYS * 86_400_000)
const BATCH = 20_000
let times: string[] = [], ids: string[] = [], scores: number[] = [], total = 0

async function flush() {
  if (!times.length) return
  await pool.query(
    'INSERT INTO samples (time, space_id, score) SELECT * FROM unnest($1::timestamptz[], $2::text[], $3::smallint[])',
    [times, ids, scores])
  total += times.length
  times = []; ids = []; scores = []
  process.stdout.write(`\r${total.toLocaleString()} rows`)
}

// A slow random walk per space makes each day a little different
const drift: Record<string, number> = Object.fromEntries(spaces.map((s) => [s.id, 0]))
for (let t = start.getTime(); t < end.getTime(); t += 60_000) {
  const d = new Date(t)
  const local = new Date(d.toLocaleString('en-US', { timeZone: 'America/Toronto' }))
  const h = local.getHours() + local.getMinutes() / 60
  const examWeek = local.getMonth() === 11 && local.getDate() < 20 ? 1.25 : 1 // December exams are busier
  for (const s of spaces) {
    drift[s.id] = Math.max(-12, Math.min(12, drift[s.id] + (Math.random() - 0.5) * 0.8))
    const v = curveAt(s.type, h) * DAY_FACTOR[local.getDay()] * examWeek + drift[s.id] + (Math.random() - 0.5) * 6
    times.push(d.toISOString()); ids.push(s.id); scores.push(Math.max(0, Math.min(100, Math.round(v))))
  }
  if (times.length >= BATCH) await flush()
}
await flush()
console.log(`\nInserted ${total.toLocaleString()} samples.`)

// Some fake check-ins from the last 2 hours so "live" has data
await pool.query(`
  INSERT INTO checkins (time, space_id, level, device)
  SELECT now() - (random() * INTERVAL '2 hours'), s.id, 1 + floor(random() * 5)::int, 'seed'
  FROM spaces s, generate_series(1, 15)`)

console.log('Refreshing aggregates (busyness_1h, busyness_5m)...')
await pool.query(`CALL refresh_continuous_aggregate('busyness_1h', NULL, NULL)`)
await pool.query(`CALL refresh_continuous_aggregate('busyness_5m', NULL, NULL)`)

console.log('Compressing chunks older than 7 days...')
await pool.query(`SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('samples', older_than => INTERVAL '7 days') c`)

const stats = await pool.query(`SELECT * FROM hypertable_compression_stats('samples')`)
const r = stats.rows[0]
if (r?.before_compression_total_bytes) {
  console.log(`Compression: ${(r.before_compression_total_bytes / 1e6).toFixed(1)} MB -> ${(r.after_compression_total_bytes / 1e6).toFixed(1)} MB`)
}
console.log('Done.')
await pool.end()
