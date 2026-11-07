import { useEffect, useRef, useState } from 'react'
import { SPACES } from '../lib/spaces'
import type { CheckinBody } from '../lib/types'

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

  async function pick(level: CheckinBody['level']) {
    setState('sending')
    try { await onSubmit({ space_id: space, level }); setState('done'); setTimeout(onClose, 900) }
    catch { setState('error') }
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
        <div className="mt-4 grid grid-cols-5 gap-2" role="group" aria-label="How busy">
          {LEVELS.map((l) => (
            <button key={l.level} disabled={state === 'sending'} onClick={() => pick(l.level)}
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
          {state === 'error' && 'Could not send. Check your connection and try again.'}
        </p>
      </div>
    </div>
  )
}
