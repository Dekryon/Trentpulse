import { useEffect, useRef, useState } from 'react'
import { SPACES } from '../lib/spaces'
import { OFF_CAMPUS_METERS, TRUSTED_ACCURACY_METERS, formatDistance, nearestSpace } from '../lib/nearby'
import type { CheckinBody } from '../lib/types'

// Optional location step. Only runs when the student taps "Use my location".
type Locate =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'near'; text: string }
  | { kind: 'away'; text: string }   // clearly off campus: sending is paused
  | { kind: 'error'; text: string }
const CAN_LOCATE = typeof navigator !== 'undefined' && 'geolocation' in navigator

const LEVELS: { level: CheckinBody['level']; label: string; color: string }[] = [
  { level: 1, label: 'Empty', color: '#2f9e6a' },
  { level: 2, label: 'Quiet', color: '#6fae4d' },
  { level: 3, label: 'Moderate', color: '#e0a526' },
  { level: 4, label: 'Busy', color: '#e07a2b' },
  { level: 5, label: 'Packed', color: '#d9472b' },
]

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

// Bottom sheet: pick a building, tap how busy it is. One tap and done.
// Closes with the Close button, a tap outside, or Escape.
export function CheckInSheet({ initialSpace, onSubmit, onClose }: {
  initialSpace: string | null
  onSubmit: (b: CheckinBody) => Promise<void>
  onClose: () => void
}) {
  const [space, setSpace] = useState(initialSpace ?? 'bata')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const firstRef = useRef<HTMLSelectElement>(null)
  // Keep the latest onClose without re-running the effect on every parent render
  // (the app re-renders every 15 s, which would otherwise steal focus).
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Escape closes; focus starts inside the sheet so keyboard users land in it
  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const [locate, setLocate] = useState<Locate>({ kind: 'idle' })
  const [errorText, setErrorText] = useState('Could not send. Check your connection and try again.')

  // Use the phone's position to pick the nearest building. The coordinates stay
  // in this function; only the chosen building is ever sent.
  function locateMe() {
    setLocate({ kind: 'locating' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { longitude, latitude, accuracy } = pos.coords
        const near = nearestSpace(longitude, latitude)
        const trusted = accuracy <= TRUSTED_ACCURACY_METERS
        if (trusted && near.distance > OFF_CAMPUS_METERS) {
          setLocate({ kind: 'away', text: `You seem to be about ${formatDistance(near.distance)} from campus. Check-ins are for people on site.` })
          return
        }
        setSpace(near.id)
        setLocate({ kind: 'near', text: trusted
          ? `Nearest building: ${near.name}. Change it below if that's wrong.`
          : `Location is rough, so we guessed ${near.name}. Change it below if that's wrong.` })
      },
      (err) => setLocate({ kind: 'error', text: err.code === err.PERMISSION_DENIED
        ? 'Location is off. Pick your building from the list instead.'
        : "Couldn't get your location. Pick your building from the list instead." }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    )
  }

  const blocked = locate.kind === 'away'

  async function pick(level: CheckinBody['level']) {
    if (blocked) return
    setState('sending')
    try { await onSubmit({ space_id: space, level }); setState('done'); setTimeout(onClose, 900) }
    catch (e) {
      setErrorText(e instanceof Error && e.message.startsWith('Too many')
        ? e.message : 'Could not send. Check your connection and try again.')
      setState('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div className="glass glass-solid w-full max-w-md rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="checkin-title">
        <div aria-hidden="true" className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <h2 id="checkin-title" className="font-[Archivo] text-xl font-extrabold">How busy is it?</h2>
          <button onClick={onClose} aria-label="Close check-in"
            className={`-mr-1 -mt-1 grid h-10 w-10 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white ${focus}`}>
            ✕
          </button>
        </div>
        <label className="mt-3 block text-xs text-white/65" htmlFor="space">I'm at</label>
        <select id="space" ref={firstRef} value={space} onChange={(e) => setSpace(e.target.value)}
          className={`mt-1 min-h-11 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white ${focus}`}>
          {SPACES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {CAN_LOCATE && (
          <div className="mt-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <button type="button" onClick={locateMe} disabled={locate.kind === 'locating'}
                className={`min-h-11 rounded-lg bg-white/10 px-3 text-sm font-semibold hover:bg-white/20 disabled:opacity-60 ${focus}`}>
                {locate.kind === 'locating' ? 'Finding you…' : locate.kind === 'away' ? 'Try again' : 'Use my location'}
              </button>
              <span className="text-xs text-white/60">Only used on this phone to pick the nearest building. Never sent or stored.</span>
            </div>
            {'text' in locate && (
              <p role="status" className={`mt-1.5 text-sm ${locate.kind === 'away' ? 'text-amber-200' : 'text-white/80'}`}>{locate.text}</p>
            )}
          </div>
        )}

        <div className="mt-4 grid grid-cols-5 gap-2" role="group" aria-label="How busy">
          {LEVELS.map((l) => (
            <button key={l.level} disabled={state === 'sending' || blocked} onClick={() => pick(l.level)}
              aria-label={`${l.level}, ${l.label}`}
              className={`flex min-h-16 flex-col items-center justify-center rounded-xl text-[11px] font-bold text-black transition hover:scale-105 disabled:opacity-50 motion-reduce:transition-none motion-reduce:hover:scale-100 ${focus}`}
              style={{ background: l.color }}>
              <span className="font-[Archivo] text-xl">{l.level}</span>{l.label}
            </button>
          ))}
        </div>
        <p className="mt-3 min-h-5 text-center text-sm text-white/75" role="status">
          {state === 'sending' && 'Sending…'}
          {state === 'done' && 'Thanks. The map updates within 15 seconds.'}
          {state === 'error' && errorText}
        </p>
      </div>
    </div>
  )
}
