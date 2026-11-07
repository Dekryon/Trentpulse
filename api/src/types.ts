// Shared data shapes. This file is copied in web/src/lib/types.ts and api/src/types.ts.
// If you change one, change the other (section 08 of the plan is the source of truth).

export type SpaceType = 'study' | 'social' | 'gym' | 'college' | 'lecture'
export type Level = 'quiet' | 'moderate' | 'busy' | 'packed'

export interface Space {
  id: string
  name: string
  bank: 'west' | 'east'
  type: SpaceType
}

export interface SpaceNow {
  id: string
  score: number // 0..100
  level: Level
  reports_20m: number
  trend: 'up' | 'down' | 'flat'
}

export interface NowResponse {
  updated_at: string
  spaces: SpaceNow[]
  events?: string[] // optional: "Lecture let out 5 min ago at Science Complex"
}

export interface HistoryPoint {
  t: string
  score: number
}

export interface HistoryResponse {
  today: HistoryPoint[]
  typical: HistoryPoint[]
}

export interface CheckinBody {
  space_id: string
  level: 1 | 2 | 3 | 4 | 5 // 1 empty .. 5 packed
}

export interface SuggestResponse {
  text: string
}

export function levelOf(score: number): Level {
  if (score <= 25) return 'quiet'
  if (score <= 50) return 'moderate'
  if (score <= 75) return 'busy'
  return 'packed'
}
