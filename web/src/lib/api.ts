// One place the app talks to the back end.
// If VITE_API_URL is set, call the real API. Otherwise use the built-in mock.
import * as mock from './mockApi'
import type { CheckinBody, HistoryResponse, NowResponse, StatsResponse, SuggestResponse } from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '')
export const USING_MOCK = !BASE

async function get<T>(path: string): Promise<T> {
  const r = await fetch(BASE + path)
  if (!r.ok) throw new Error(`${path} failed: ${r.status}`)
  return r.json() as Promise<T>
}

export function fetchNow(at?: Date): Promise<NowResponse> {
  if (!BASE) return mock.getNow(at)
  return at ? get(`/api/forecast?at=${encodeURIComponent(at.toISOString())}`) : get('/api/now')
}

export function fetchHistory(id: string): Promise<HistoryResponse> {
  return BASE ? get(`/api/spaces/${id}/history?range=day`) : mock.getHistory(id)
}

export function fetchSuggest(near: string, at?: Date): Promise<SuggestResponse> {
  return BASE ? get(`/api/suggest?near=${near}`) : mock.getSuggest(near, at)
}

// Tiger Data numbers (rows, compression, query time). Demo mode has no database,
// so it returns null and the tile stays hidden rather than showing made-up figures.
export function fetchStats(): Promise<StatsResponse | null> {
  return BASE ? get('/api/stats') : Promise.resolve(null)
}

export async function sendCheckin(body: CheckinBody): Promise<void> {
  if (!BASE) return mock.postCheckin(body)
  const r = await fetch(BASE + '/api/checkins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error('Check-in failed: ' + r.status)
}
