// A minute-by-minute model of how busy each Symons Campus space is, built from
// how students actually move through a day rather than one smooth curve per place.
//
// What it models:
// - Weekday classes run on the hour until :50, 8:30 am to 5 pm. Lecture halls fill
//   during class and empty at the changeover.
// - When classes let out, students flow to nearby spaces (Bata, the Student Centre,
//   the colleges) for about 25 minutes, more strongly the closer the space is.
// - Students leave study spaces just before class (:45 to :55).
// - Meal peaks at the colleges and the Student Centre; gym peaks early morning and
//   late afternoon; Bata fills in the evening Sunday to Thursday.
// - Fridays are lighter in the afternoon, Saturdays are quiet, Sunday evening is busy.
// - The calendar: quiet summer before fall classes start on Tue Sept 8, 2026, and
//   Thanksgiving Monday (Oct 12, 2026) is a holiday.
//
// All of this is simulated. It gives the typical-week baseline realistic shape
// until enough real check-ins exist.

export type SpaceInfo = { id: string; type: string; lng: number; lat: number }
export type LocalTime = { dow: number; hour: number; minute: number; month: number; date: number; year: number } // dow 0 = Sunday

// A smooth bump: 1 at `center` hours, fading over about `width` hours
const bump = (h: number, center: number, width: number) => Math.exp(-((h - center) ** 2) / (2 * width * width))

function metersBetween(a: SpaceInfo, b: SpaceInfo) {
  const R = 6_371_000, r = (d: number) => (d * Math.PI) / 180
  const x = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(x))
}

// How much of the term is running: summer, holidays, normal term
export function termFactor(t: LocalTime) {
  const ymd = t.year * 10_000 + (t.month + 1) * 100 + t.date
  if (ymd < 20260908) return 0.3              // before fall classes start
  if (ymd === 20261012) return 0.35           // Thanksgiving Monday
  return 1
}

export function inClassHours(t: LocalTime) {
  const h = t.hour + t.minute / 60
  return t.dow >= 1 && t.dow <= 5 && h >= 8.5 && h < 17
}

// The base pattern for one type of space at one moment, before flow and noise
export function basePattern(type: string, t: LocalTime): number {
  const h = t.hour + t.minute / 60
  const m = t.minute
  const weekday = t.dow >= 1 && t.dow <= 5
  const friday = t.dow === 5
  const classes = inClassHours(t)
  const changeover = classes && m >= 50

  switch (type) {
    case 'lecture': {
      if (classes && !changeover) return 35 + 35 * bump(h, 11, 2) + 25 * bump(h, 14, 1.5) - (friday ? 15 : 0)
      if (changeover) return 18
      if (weekday && !friday && h >= 18 && h < 21) return 18 // a few evening classes
      return 3
    }
    case 'study': { // Bata Library
      let v = weekday ? 12 + 42 * bump(h, 13.5, 3) : 8
      if ((t.dow >= 0 && t.dow <= 4)) v += 34 * bump(h, 20.3, 1.8) // Sun-Thu evening study
      if (friday) v -= 12 * bump(h, 16, 2)
      if (t.dow === 6) v += 18 * bump(h, 14, 2.5)
      if (t.dow === 0) v += 22 * bump(h, 14.5, 2.5)
      if (classes && m >= 45 && m < 55) v -= 7 // leaving for class
      return v
    }
    case 'social': { // Student Centre
      let v = weekday ? 8 + 58 * bump(h, 12.4, 1.1) + 22 * bump(h, 15.5, 1.8) : 6 + 14 * bump(h, 13.5, 3)
      if (changeover || (classes && m < 8)) v += 14 // people passing through between classes
      if (friday) v += 14 * bump(h, 16.5, 1.5)
      return v
    }
    case 'college': { // dining halls and common rooms
      const mealsLater = weekday ? 0 : 0.6
      return 8 + 16 * bump(h, 8.2 + mealsLater, 0.8) + 34 * bump(h, 12.3 + mealsLater, 0.9) +
        32 * bump(h, 18 + mealsLater / 2, 1) + 16 * bump(h, 21.5, 1.6)
    }
    case 'gym': { // Athletics Centre
      if (weekday) return 6 + 28 * bump(h, 7.4, 0.9) + 14 * bump(h, 12.3, 0.7) + 56 * bump(h, 17.6, 1.5) - (friday ? 12 * bump(h, 17.6, 1.5) : 0)
      return 8 + 34 * bump(h, 14, 2.5)
    }
    default:
      return 10
  }
}

// How strongly each type of space receives students leaving a lecture
const FLOW_PULL: Record<string, number> = { study: 1, social: 1, college: 0.6, gym: 0.2, lecture: 0 }

// Builds the model for a set of spaces: distances are worked out once.
export function makeFlowModel(spaces: SpaceInfo[]) {
  const lectures = spaces.filter((s) => s.type === 'lecture')
  // For each space, how close it is to the lecture halls (1 = next door, fades by ~450 m)
  const nearness: Record<string, number> = Object.fromEntries(spaces.map((s) => [
    s.id,
    lectures.reduce((sum, l) => sum + Math.exp(-metersBetween(s, l) / 450), 0) / Math.max(1, lectures.length),
  ]))

  // Flow into a space in the 25 minutes after classes let out at :50
  function flowIn(space: SpaceInfo, t: LocalTime) {
    const pull = FLOW_PULL[space.type] ?? 0
    if (!pull) return 0
    // minutes since the most recent :50, if that :50 ended a class
    const sinceEnd = t.minute >= 50 ? t.minute - 50 : t.minute + 10
    const endHour = t.minute >= 50 ? t.hour : t.hour - 1
    const ended: LocalTime = { ...t, hour: endHour, minute: 49 }
    if (sinceEnd > 25 || !inClassHours(ended)) return 0
    return 34 * pull * nearness[space.id] * (1 - sinceEnd / 25)
  }

  return (space: SpaceInfo, t: LocalTime) => (basePattern(space.type, t) + flowIn(space, t)) * termFactor(t)
}
