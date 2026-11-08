// One place the app talks to the back end.
// If VITE_API_URL is set, call the real API. Otherwise use the built-in mock.
import * as mock from './mockApi'
import { deviceId } from './device'
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

// Ask TrentPulse: a free-text question answered from live data
export async function askQuestion(question: string): Promise<{ text: string; source: 'gemini' | 'data' }> {
  if (!BASE) return { text: 'Ask TrentPulse needs the live API. In demo mode, use the map and the list.', source: 'data' }
  const r = await fetch(BASE + '/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (r.status === 429) throw new Error('Lots of questions right now. Try again in a few minutes.')
  if (!r.ok) throw new Error('Could not get an answer. Try again.')
  return r.json()
}

// Photo check-in: Gemini suggests a 1..5 level from a photo of the room.
// level is null when the photo can't be judged (outdoors, too dark, not a room).
export async function estimateFromPhoto(photo: { data: string; mimeType: string }): Promise<{ level: 1 | 2 | 3 | 4 | 5 | null; reason: string }> {
  if (!BASE) throw new Error('Photo check needs the live API. Pick a level yourself.')
  const r = await fetch(BASE + '/api/photo-estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: photo.data, mimeType: photo.mimeType }),
  })
  if (!r.ok) {
    const body = await r.json().catch(() => null) as { error?: string } | null
    throw new Error(body?.error ?? "Couldn't check the photo. Pick a level yourself.")
  }
  return r.json()
}

// Tiger Data numbers (rows, compression, query time). Demo mode has no database,
// so it returns null and the tile stays hidden rather than showing made-up figures.
export function fetchStats(): Promise<StatsResponse | null> {
  return BASE ? get('/api/stats') : Promise.resolve(null)
}

// Campus events (300+ people). dow is ISO: 1 Mon .. 7 Sun. Times are campus time, "HH:MM".
export type CampusEvent = { title: string; space_id: string; dow: number; starts: string; ends: string; est_size: number }
export function fetchEvents(): Promise<CampusEvent[]> {
  return BASE ? get('/api/events') : Promise.resolve([])
}

export async function sendCheckin(body: CheckinBody): Promise<void> {
  if (!BASE) return mock.postCheckin(body)
  const r = await fetch(BASE + '/api/checkins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, device: deviceId() }),
  })
  if (r.status === 429) throw new Error('Too many check-ins from this network. Try again in a few minutes.')
  if (!r.ok) throw new Error('Check-in failed: ' + r.status)
}
