// The busyness score (plan section 05):
//   score = 0.5 * live + 0.3 * baseline + 0.2 * lecture_boost
// With fewer than 3 recent check-ins, live's weight ramps up per check-in.
import { pool } from './db.js'
import { levelOf, type NowResponse } from './types.js'

type SpaceRow = { id: string; name: string; bank: 'west' | 'east'; type: string; lng: number; lat: number }
// Spaces rarely change, so keep them in memory, but re-read every 5 minutes so an
// edit in the database (new building, corrected position) shows up without a restart.
const SPACES_TTL_MS = 5 * 60_000
let spacesCache: { rows: SpaceRow[]; at: number } | null = null

export async function getSpaces(): Promise<SpaceRow[]> {
  if (!spacesCache || Date.now() - spacesCache.at > SPACES_TTL_MS) {
    const rows = (await pool.query<SpaceRow>('SELECT id, name, bank, type, lng, lat FROM spaces ORDER BY id')).rows
    spacesCache = { rows, at: Date.now() }
  }
  return spacesCache.rows
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

  // live: recent check-ins, newer ones weigh more. Only each device's latest vote
  // per building counts, so one phone tapping repeatedly is still one voice.
  // Old rows without a device each count on their own.
  const live = await pool.query<{ space_id: string; live: number; n: number }>(
    `WITH recent AS (
       SELECT DISTINCT ON (space_id, coalesce(device, time::text)) space_id, level, time
       FROM checkins
       WHERE time > $1::timestamptz - INTERVAL '20 minutes' AND time <= $1::timestamptz
       ORDER BY space_id, coalesce(device, time::text), time DESC
     )
     SELECT space_id,
            sum((level - 1) * 25 * (1 - extract(epoch FROM ($1::timestamptz - time)) / 1200))
              / nullif(sum(1 - extract(epoch FROM ($1::timestamptz - time)) / 1200), 0) AS live,
            count(*)::int AS n
     FROM recent
     GROUP BY space_id`, [at.toISOString()])

  // baseline: typical score for this weekday and quarter hour (15-minute aggregate),
  // so the rush when classes let out at :50 shows up, not just hourly averages
  // Rather than scanning every bucket, list the exact matching slots (the same
  // quarter hour on the same weekday in each of the past 13 weeks, worked out in
  // campus time so daylight-saving changes don't shift them) and look those up
  // by time, which uses the aggregate's time index.
  const base = await pool.query<{ space_id: string; typical: number }>(
    `WITH local_slot AS (
       SELECT date_trunc('hour', $1::timestamptz AT TIME ZONE 'America/Toronto')
              + floor(extract(minute FROM $1::timestamptz AT TIME ZONE 'America/Toronto') / 15) * INTERVAL '15 minutes' AS s
     ), slots AS (
       SELECT (s - w * INTERVAL '7 days') AT TIME ZONE 'America/Toronto' AS t
       FROM local_slot, generate_series(1, 13) AS w
     )
     SELECT space_id, avg(avg_score) AS typical
     FROM busyness_15m
     WHERE bucket IN (SELECT t FROM slots)
     GROUP BY space_id`, [at.toISOString()])

  const lectures = await pool.query<{ space_id: string; s: number; e: number; est_size: number }>(
    `SELECT space_id, extract(epoch FROM starts) / 3600 AS s, extract(epoch FROM ends) / 3600 AS e, est_size
     FROM lectures WHERE dow = $1`, [dow])

  const byId = Object.fromEntries(spaces.map((s) => [s.id, s]))
  const boost: Record<string, number> = Object.fromEntries(spaces.map((s) => [s.id, 0]))
  const events: string[] = []
  // A row of 300 or more people is a campus event (like the HackTrent closing
  // ceremony), not a class: the building itself is full while it runs.
  const eventFloor: Record<string, number> = {}
  for (const L of lectures.rows) {
    const where = byId[L.space_id]
    if (!where) continue
    if (hours >= L.s && hours < L.e) {
      boost[L.space_id] += (L.est_size / 260) * 100
      if (L.est_size >= 300) {
        eventFloor[L.space_id] = 85
        events.push(`Event now: about ${L.est_size} people at ${where.name}`)
      } else {
        events.push(`In class: about ${L.est_size} students in ${where.name}`)
      }
    }
    const since = (hours - L.e) * 60
    if (since >= 0 && since <= 25) {
      events.push(`${L.est_size >= 300 ? 'Event ended' : 'Lecture let out'} ${Math.round(since)} min ago at ${where.name}`)
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
    // Trust check-ins more as they add up: 1 report gets a third of live's 0.5
    // weight, 2 get two thirds, 3 or more get all of it. The rest of that weight
    // stays on the baseline. With 0 or 3+ reports this is the original formula.
    const wLive = 0.5 * Math.min(l?.n ?? 0, 3) / 3
    const score = Math.max(eventFloor[s.id] ?? 0, wLive * Number(l?.live ?? 0) + (0.8 - wLive) * b + 0.2 * k)
    scores[s.id] = Math.max(0, Math.min(100, Math.round(score)))
  }
  return { scores, reports, events }
}

// Real check-ins from campus midnight up to `at`. The seed script's fake
// check-ins (device = 'seed') are left out so the number means real people.
async function checkinsToday(at: Date): Promise<number> {
  const r = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM checkins
     WHERE time >= (date_trunc('day', $1::timestamptz AT TIME ZONE 'America/Toronto') AT TIME ZONE 'America/Toronto')
       AND time <= $1::timestamptz
       AND device IS DISTINCT FROM 'seed'`, [at.toISOString()])
  return r.rows[0]?.n ?? 0
}

export async function nowResponse(at: Date): Promise<NowResponse> {
  const [cur, prev, today] = await Promise.all([
    computeScores(at), computeScores(new Date(at.getTime() - 15 * 60_000)), checkinsToday(at),
  ])
  const spaces = await getSpaces()
  return {
    updated_at: at.toISOString(),
    checkins_today: today,
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
