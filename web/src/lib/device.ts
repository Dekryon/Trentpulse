// A random, anonymous ID for this phone or browser, made once and kept on the device.
// The API uses it so each device gets one vote per building per 15 minutes.
// It is not linked to a name, an account or a location.
const KEY = 'trentpulse-device'

function makeId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 10)).join('-')
}

let memo: string | null = null

export function deviceId(): string {
  if (memo) return memo
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return (memo = saved)
    const id = makeId()
    localStorage.setItem(KEY, id)
    return (memo = id)
  } catch {
    // Storage blocked (private window, strict settings): use an ID for this visit only
    return (memo = makeId())
  }
}
