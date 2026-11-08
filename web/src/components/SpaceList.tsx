import { useEffect, useRef, useState } from 'react'
import { SPACE_BY_ID } from '../lib/spaces'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import type { SpaceNow } from '../lib/types'

// Every tracked space as a plain list, quietest first. This is the accessible way
// to read the map: no colour-only meaning, no map gestures, works with a keyboard
// and a screen reader. Each row opens that building's details.
const TYPE_LABEL: Record<string, string> = {
  study: 'Study', social: 'Social', gym: 'Gym', college: 'College', lecture: 'Lecture halls',
}

// Filters: everything, places with food, or places to sit and study
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'food', label: 'Food' },
  { id: 'study', label: 'Study' },
] as const
type Filter = (typeof FILTERS)[number]['id']

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function SpaceList({ spaces, selectedId, onSelect, onClose }: {
  spaces: SpaceNow[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const [filter, setFilter] = useState<Filter>('all')
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

  const shown = [...spaces]
    .filter((s) => {
      const def = SPACE_BY_ID[s.id]
      if (filter === 'food') return Boolean(def.food)
      if (filter === 'study') return def.type === 'study' || def.type === 'social' || def.type === 'college'
      return true
    })
    .sort((a, b) => a.score - b.score)

  return (
    <section aria-labelledby="space-list-title" id="side-list"
      className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="space-list-title" ref={headingRef} tabIndex={-1}
            className="font-[Archivo] text-xl font-extrabold leading-tight outline-none">
            All spaces
          </h2>
          <p className="text-[13px] text-white/80">Quietest first. Select one for details.</p>
        </div>
        <button onClick={onClose} aria-label="Close list"
          className={`-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg text-white/80 hover:bg-white/10 hover:text-white ${focus}`}>
          ✕
        </button>
      </div>

      <div role="group" aria-label="Show" className="mt-3 flex gap-1.5">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id}
            className={`min-h-11 flex-1 rounded-lg text-sm font-semibold sm:min-h-9 ${focus} ${filter === f.id ? 'bg-white text-black' : 'bg-white/[0.08] text-white/90 hover:bg-white/15'}`}>
            {f.label}
          </button>
        ))}
      </div>

      <p className="sr-only" role="status">{shown.length} {shown.length === 1 ? 'space' : 'spaces'} shown</p>

      <ul className="mt-3 flex flex-col gap-1.5" role="list">
        {shown.map((s) => {
          const def = SPACE_BY_ID[s.id]
          const reports = s.reports_20m === 1 ? '1 check-in' : `${s.reports_20m} check-ins`
          const bank = def.bank === 'west' ? 'West Bank' : 'East Bank'
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                aria-current={selectedId === s.id ? 'true' : undefined}
                aria-label={`${def.name}, ${LEVEL_LABEL[s.level]}, score ${s.score} out of 100${def.food ? `, food: ${def.food}` : ''}, ${bank}, ${reports} in the last 20 minutes`}
                className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/10 ${focus} ${selectedId === s.id ? 'bg-white/10 ring-1 ring-white/50' : 'bg-white/[0.04]'}`}
              >
                <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ background: heatColor(s.score) }} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold leading-snug">{def.name}</span>
                  <span className="block text-[13px] leading-snug text-white/80">{def.food ?? TYPE_LABEL[def.type]}</span>
                  <span className="block text-xs text-white/70">{bank} · {reports}</span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-bold">{LEVEL_LABEL[s.level]}</span>
                  <span className="block text-[13px] tabular-nums text-white/80">{s.score}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
