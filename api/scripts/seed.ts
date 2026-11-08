// Fills Tiger Data with realistic history so charts and baselines look real.
// 90 days x 9 spaces x 1 sample per minute = about 1.2 million rows.
// The shape of each day comes from flow-model.ts: class changes, students moving
// from lecture halls to nearby spaces, meals, gym hours, weekends and the calendar.
// Run: npm run seed   (takes about a minute)
import { pool } from '../src/db.js'
import { makeFlowModel, type LocalTime, type SpaceInfo } from './flow-model.js'

const DAYS = Number(process.env.SEED_DAYS ?? 90)

const spaces = (await pool.query<SpaceInfo>('SELECT id, type, lng, lat FROM spaces')).rows
if (!spaces.length) throw new Error('No spaces. Run npm run db:schema first.')
const model = makeFlowModel(spaces)

// Campus local time for a UTC instant
const campusParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Toronto', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', weekday: 'short', hourCycle: 'h23',
})
const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
function campusTime(d: Date): LocalTime {
  const p = Object.fromEntries(campusParts.formatToParts(d).map((x) => [x.type, x.value]))
  return { dow: DOW[p.weekday], hour: Number(p.hour), minute: Number(p.minute), month: Number(p.month) - 1, date: Number(p.day), year: Number(p.year) }
}

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

// Variation so no two days look the same: each space gets its own factor per day
// (some days are just busier), plus a slow drift and a little minute-to-minute noise.
const drift: Record<string, number> = Object.fromEntries(spaces.map((s) => [s.id, 0]))
const dayFactor: Record<string, number> = {}
for (let t = start.getTime(); t < end.getTime(); t += 60_000) {
  const d = new Date(t)
  const local = campusTime(d)
  for (const s of spaces) {
    const dayKey = `${s.id}:${local.year}-${local.month}-${local.date}`
    dayFactor[dayKey] ??= 0.85 + Math.random() * 0.3
    drift[s.id] = Math.max(-6, Math.min(6, drift[s.id] + (Math.random() - 0.5) * 0.5))
    const v = model(s, local) * dayFactor[dayKey] + drift[s.id] + (Math.random() - 0.5) * 5
    times.push(d.toISOString()); ids.push(s.id); scores.push(Math.max(0, Math.min(100, Math.round(v))))
  }
  if (times.length >= BATCH) await flush()
}
await flush()
console.log(`\nInserted ${total.toLocaleString()} samples.`)

// Fake check-ins are no longer seeded: the app is live and real check-ins come
// from phones. Remove any left over from earlier seed runs (tagged device = 'seed')
// so a live demo tap counts fully. Real check-ins are never touched.
const cleared = await pool.query(`DELETE FROM checkins WHERE device = 'seed'`)
console.log(`Removed ${cleared.rowCount} old fake check-ins.`)

console.log('Refreshing aggregates (busyness_15m, busyness_1h, busyness_5m)...')
await pool.query(`CALL refresh_continuous_aggregate('busyness_15m', NULL, NULL)`)
await pool.query(`CALL refresh_continuous_aggregate('busyness_1h', NULL, NULL)`)
await pool.query(`CALL refresh_continuous_aggregate('busyness_5m', NULL, NULL)`)

console.log('Compressing chunks older than 7 days...')
await pool.query(`SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('samples', older_than => INTERVAL '7 days') c`)

// Refresh table statistics so /api/stats (approximate_row_count) reports the
// real row total; without this it reads stale numbers after compression.
await pool.query('ANALYZE samples')

const stats = await pool.query(`SELECT * FROM hypertable_compression_stats('samples')`)
const r = stats.rows[0]
if (r?.before_compression_total_bytes) {
  console.log(`Compression: ${(r.before_compression_total_bytes / 1e6).toFixed(1)} MB -> ${(r.after_compression_total_bytes / 1e6).toFixed(1)} MB`)
}
console.log('Done.')
await pool.end()
