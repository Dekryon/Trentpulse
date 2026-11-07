import { useState } from 'react'
import { SPACES } from '../lib/spaces'
import type { CheckinBody } from '../lib/types'

const LEVELS: { level: CheckinBody['level']; label: string; color: string }[] = [
  { level: 1, label: 'Empty', color: '#2f9e6a' },
  { level: 2, label: 'Quiet', color: '#6fae4d' },
  { level: 3, label: 'Moderate', color: '#e0a526' },
  { level: 4, label: 'Busy', color: '#e07a2b' },
  { level: 5, label: 'Packed', color: '#d9472b' },
]

// Bottom sheet: pick a building, tap how busy it is. One tap and done.
export function CheckInSheet({ initialSpace, onSubmit, onClose }: {
  initialSpace: string | null
  onSubmit: (b: CheckinBody) => Promise<void>
  onClose: () => void
}) {
  const [space, setSpace] = useState(initialSpace ?? 'bata')
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')

  async function pick(level: CheckinBody['level']) {
    setState('sending')
    try { await onSubmit({ space_id: space, level }); setState('done'); setTimeout(onClose, 900) }
    catch { setState('error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div className="glass w-full max-w-md rounded-t-3xl p-5 sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Check in">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25 sm:hidden" />
        <h2 className="font-[Archivo] text-xl font-extrabold">How busy is it?</h2>
        <label className="mt-3 block text-xs text-white/60" htmlFor="space">I'm at</label>
        <select id="space" value={space} onChange={(e) => setSpace(e.target.value)}
          className="mt-1 w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-white">
          {SPACES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div className="mt-4 grid grid-cols-5 gap-2">
          {LEVELS.map((l) => (
            <button key={l.level} disabled={state === 'sending'} onClick={() => pick(l.level)}
              className="flex aspect-square flex-col items-center justify-center rounded-xl text-xs font-bold text-black transition hover:scale-105 disabled:opacity-50"
              style={{ background: l.color }}>
              <span className="font-[Archivo] text-xl">{l.level}</span>{l.label}
            </button>
          ))}
        </div>
        <p className="mt-3 h-5 text-center text-sm text-white/70">
          {state === 'done' && 'Thanks! The map is updating.'}
          {state === 'error' && 'Could not send. Check your connection and try again.'}
        </p>
      </div>
    </div>
  )
}
