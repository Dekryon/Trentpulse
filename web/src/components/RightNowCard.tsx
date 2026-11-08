import { SPACE_BY_ID } from '../lib/spaces'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import type { NowResponse } from '../lib/types'

// Answers the one question a student opens the app with: where should I go?
// Shows the quietest place to sit down (not lecture halls or the gym), the
// busiest place, and what the colours mean. Tapping a place opens its details.
const LEGEND = [
  { label: 'Quiet', score: 10 }, { label: 'Moderate', score: 40 },
  { label: 'Busy', score: 65 }, { label: 'Packed', score: 90 },
]
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function RightNowCard({ now, live, onSelect }: {
  now?: NowResponse
  live: boolean
  onSelect: (id: string) => void
}) {
  const places = (now?.spaces ?? []).filter((s) => !['lecture', 'gym'].includes(SPACE_BY_ID[s.id]?.type))
  const all = (now?.spaces ?? []).filter((s) => SPACE_BY_ID[s.id]?.type !== 'lecture')
  const quietest = [...places].sort((a, b) => a.score - b.score)[0]
  const busiest = [...all].sort((a, b) => b.score - a.score)[0]

  return (
    <section aria-label="Right now" className="glass glass-solid pointer-events-auto w-full max-w-[340px] rounded-2xl p-3.5">
      {quietest ? (
        <>
          <p className="text-sm text-white/65">{live ? 'Quietest place to sit right now' : 'Quietest place to sit then'}</p>
          <button onClick={() => onSelect(quietest.id)}
            className={`mt-0.5 flex w-full items-center gap-2 rounded-lg text-left hover:underline ${focus}`}>
            <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: heatColor(quietest.score) }} />
            <span className="font-[Archivo] text-lg font-extrabold leading-tight">{SPACE_BY_ID[quietest.id].name}</span>
            <span className="ml-auto shrink-0 text-sm font-semibold text-white/80">{LEVEL_LABEL[quietest.level]}</span>
          </button>
          {busiest && busiest.level === 'quiet' && (
            <p className="mt-1.5 text-sm text-white/75">Everywhere is quiet {live ? 'right now' : 'then'}.</p>
          )}
          {busiest && busiest.level !== 'quiet' && busiest.id !== quietest.id && (
            <button onClick={() => onSelect(busiest.id)}
              className={`mt-1.5 flex w-full items-center gap-2 rounded-lg text-left text-sm text-white/75 hover:underline ${focus}`}>
              <span>Busiest:</span>
              <span className="font-semibold text-white">{SPACE_BY_ID[busiest.id].name}</span>
              <span className="ml-auto shrink-0">{LEVEL_LABEL[busiest.level]}</span>
            </button>
          )}
        </>
      ) : (
        <p className="text-sm text-white/70">Loading campus…</p>
      )}
      <ul aria-label="What the colours mean" className="mt-3 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2.5 text-xs text-white/70">
        {LEGEND.map((l) => (
          <li key={l.label} className="flex items-center gap-1.5">
            <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: heatColor(l.score) }} />
            {l.label}
          </li>
        ))}
      </ul>
    </section>
  )
}
