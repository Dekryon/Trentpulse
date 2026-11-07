// Built-in fake back end. Used when VITE_API_URL is empty, so the front end
// works before the real API exists. Same shapes as the real API.
import { SPACES, SPACE_BY_ID } from './spaces'
import { metersBetween } from './geo'
import type { CheckinBody, HistoryResponse, NowResponse, SpaceType, SuggestResponse } from './types'
import { levelOf } from './types'

// Typical busyness for each kind of space, hours 7:00 to 23:00 (example shapes)
const CURVE: Record<SpaceType, number[]> = {
  study:   [5, 10, 25, 45, 55, 62, 66, 70, 72, 70, 60, 55, 50, 45, 35, 20, 8],
  gym:     [20, 35, 30, 25, 30, 40, 35, 30, 40, 65, 80, 75, 60, 40, 25, 10, 3],
  social:  [5, 15, 30, 40, 55, 80, 70, 50, 45, 50, 45, 35, 30, 25, 15, 8, 3],
  college: [10, 25, 30, 28, 35, 60, 48, 32, 30, 45, 58, 42, 30, 22, 14, 8, 3],
  lecture: [0, 20, 50, 45, 50, 35, 50, 50, 45, 35, 22, 14, 10, 5, 0, 0, 0],
}
// 0 = Sunday .. 6 = Saturday
const DAY_FACTOR = [0.55, 1.0, 1.05, 1.0, 1.05, 0.8, 0.5]

// Example big lectures (not real courses). day: 1 Mon .. 5 Fri, hours as decimals
export const LECTURES = [
  { space: 'sci', days: [1, 2, 3, 4, 5], start: 11, end: 11.83, size: 200 },
  { space: 'gz',  days: [2, 4],          start: 12, end: 13.33, size: 180 },
  { space: 'dna', days: [1, 3],          start: 14, end: 14.83, size: 150 },
  { space: 'oc',  days: [1, 3, 5],       start: 10, end: 10.83, size: 260 },
  { space: 'sci', days: [2, 4],          start: 9,  end: 10.33, size: 160 },
  { space: 'gz',  days: [1, 3],          start: 16, end: 16.83, size: 140 },
]

function curveAt(type: SpaceType, h: number) {
  const c = CURVE[type], i = h - 7
  if (i <= 0) return c[0]
  if (i >= c.length - 1) return c[c.length - 1]
  const f = Math.floor(i), t = i - f
  return c[f] * (1 - t) + c[f + 1] * t
}

// Check-ins made in this browser session (the real API stores them in Tiger Data)
const checkins: { time: number; space: string; level: number }[] = []

function model(at: Date) {
  const h = at.getHours() + at.getMinutes() / 60
  const day = at.getDay()
  const scores: Record<string, number> = {}
  const events: string[] = []
  for (const s of SPACES) scores[s.id] = curveAt(s.type, h) * DAY_FACTOR[day]

  for (const L of LECTURES) {
    if (!L.days.includes(day)) continue
    const where = SPACE_BY_ID[L.space]
    if (h >= L.start && h < L.end) {
      scores[L.space] += (L.size / 260) * 40
      events.push(`In class: about ${L.size} students in ${where.name}`)
    }
    const since = (h - L.end) * 60
    if (since >= 0 && since <= 25) {
      events.push(`Lecture let out ${Math.round(since)} min ago at ${where.name}`)
      const decay = 1 - since / 25
      for (const s of SPACES) {
        if (s.type === 'lecture') continue
        const w = Math.exp(-metersBetween(where.approx, s.approx) / 450)
        scores[s.id] += (L.size / 260) * 42 * w * decay
      }
    }
  }

  // Blend in live check-ins from the last 20 minutes (level 1..5 -> 0..100)
  const cutoff = at.getTime() - 20 * 60_000
  for (const s of SPACES) {
    const recent = checkins.filter((c) => c.space === s.id && c.time >= cutoff && c.time <= at.getTime())
    if (recent.length) {
      const live = recent.reduce((a, c) => a + (c.level - 1) * 25, 0) / recent.length
      scores[s.id] = 0.6 * live + 0.4 * scores[s.id]
    }
  }
  for (const k of Object.keys(scores)) scores[k] = Math.max(0, Math.min(100, Math.round(scores[k])))
  return { scores, events }
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function getNow(at = new Date()): Promise<NowResponse> {
  await sleep(150)
  const { scores, events } = model(at)
  const before = model(new Date(at.getTime() - 15 * 60_000)).scores
  return {
    updated_at: at.toISOString(),
    events,
    spaces: SPACES.map((s) => ({
      id: s.id,
      score: scores[s.id],
      level: levelOf(scores[s.id]),
      reports_20m: checkins.filter((c) => c.space === s.id && c.time >= at.getTime() - 20 * 60_000).length,
      trend: scores[s.id] - before[s.id] > 3 ? 'up' : before[s.id] - scores[s.id] > 3 ? 'down' : 'flat',
    })),
  }
}

export async function getHistory(id: string, day = new Date()): Promise<HistoryResponse> {
  await sleep(150)
  const today: HistoryResponse['today'] = []
  const typical: HistoryResponse['typical'] = []
  const now = new Date()
  for (let m = 7 * 60; m <= 23 * 60; m += 30) {
    const t = new Date(day); t.setHours(Math.floor(m / 60), m % 60, 0, 0)
    const base = model(t).scores[id]
    typical.push({ t: t.toISOString(), score: Math.round(curveAt(SPACE_BY_ID[id].type, m / 60) * 0.95) })
    if (t <= now || day.toDateString() !== now.toDateString()) {
      // a little wobble so "today" differs from "typical"
      today.push({ t: t.toISOString(), score: Math.max(0, Math.min(100, Math.round(base + Math.sin(m / 37) * 6))) })
    }
  }
  return { today, typical }
}

export async function postCheckin(body: CheckinBody): Promise<void> {
  await sleep(100)
  checkins.push({ time: Date.now(), space: body.space_id, level: body.level })
}

export async function getSuggest(near: string, at = new Date()): Promise<SuggestResponse> {
  await sleep(200)
  const { scores } = model(at)
  const from = SPACE_BY_ID[near]
  const options = SPACES.filter((s) => s.id !== near && s.type !== 'lecture' && s.type !== 'gym')
    .map((s) => ({ s, score: scores[s.id], min: Math.max(1, Math.round(metersBetween(from.approx, s.approx) / 80)) }))
    .sort((a, b) => a.score + a.min * 3 - (b.score + b.min * 3))
  const best = options[0]
  const here = levelOf(scores[near])
  if (!best) return { text: `${from.name} is ${here} right now.` }
  return {
    text: here === 'busy' || here === 'packed'
      ? `${from.name} is ${here}. ${best.s.name} is ${levelOf(best.score)}, about ${best.min} min walk.`
      : `${from.name} is ${here}. Good time to go.`,
  }
}

export function checkinsToday() {
  const start = new Date(); start.setHours(0, 0, 0, 0)
  return checkins.filter((c) => c.time >= start.getTime()).length
}
