import { useEffect, useRef } from 'react'
import { SPACE_BY_ID } from '../lib/spaces'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import type { SpaceNow } from '../lib/types'

// Every tracked space as a plain list, quietest first. This is the accessible way
// to read the map: no colour-only meaning, no map gestures, works with a keyboard
// and a screen reader. Each row opens that building's details.
const TYPE_LABEL: Record<string, string> = {
  study: 'Study', social: 'Social', gym: 'Gym', college: 'College', lecture: 'Lecture halls',
}

export function SpaceList({ spaces, selectedId, onSelect, onClose }: {
  spaces: SpaceNow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Move focus to the list when it opens, and close it with Escape
  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const sorted = [...spaces].sort((a, b) => a.score - b.score)

  return (
    <section aria-labelledby="space-list-title"
      className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[320px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="space-list-title" ref={headingRef} tabIndex={-1}
            className="font-[Archivo] text-xl font-extrabold leading-tight outline-none">
            All spaces
          </h2>
          <p className="text-xs text-white/65">Quietest first. Select one for details.</p>
        </div>
        <button onClick={onClose} aria-label="Close list"
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          ✕
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-1.5" role="list">
        {sorted.map((s) => {
          const def = SPACE_BY_ID[s.id]
          const reports = s.reports_20m === 1 ? '1 check-in' : `${s.reports_20m} check-ins`
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                aria-current={selectedId === s.id ? 'true' : undefined}
                aria-label={`${def.name}${def.food ? `, food: ${def.food}` : ''}, ${LEVEL_LABEL[s.level]}, score ${s.score} out of 100, ${def.bank === 'west' ? 'West Bank' : 'East Bank'}, ${reports} in the last 20 minutes`}
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white ${selectedId === s.id ? 'bg-white/10 ring-1 ring-white/40' : 'bg-white/[0.04]'}`}
              >
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: heatColor(s.score) }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{def.name}</span>
                  <span className="block text-xs text-white/60">
                    {def.food ?? TYPE_LABEL[def.type]} ·{def.bank === 'west' ? 'West Bank' : 'East Bank'} · {reports}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold">{LEVEL_LABEL[s.level]}</span>
                  <span className="block text-xs tabular-nums text-white/60">{s.score}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
