import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchEvents, type CampusEvent } from '../lib/api'
import { SPACE_BY_ID } from '../lib/spaces'

// Big campus events (300+ people), so students can plan around the crowd:
// what is on, where, when, and whether it is happening right now.
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const DAY = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }
const time12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, '0')}` : ''} ${h < 12 ? 'am' : 'pm'}`
}

// Where this event sits relative to now: days until its next run, and a status line
function when(e: CampusEvent, now: Date) {
  const isoToday = ((now.getDay() + 6) % 7) + 1
  const mins = now.getHours() * 60 + now.getMinutes()
  let days = (e.dow - isoToday + 7) % 7
  if (days === 0 && mins >= toMin(e.ends)) days = 7
  const live = days === 0 && mins >= toMin(e.starts)
  const dayWord = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : DAY[e.dow]
  let status: string
  if (live) status = `Happening now, ends ${time12(e.ends)}`
  else if (days === 0) {
    const m = toMin(e.starts) - mins
    status = m < 60 ? `Starts in ${m} min` : `Starts in about ${Math.round(m / 60)} h`
  } else status = `${dayWord}`
  return { days, live, dayWord, status, order: days * 1440 + toMin(e.starts) }
}

export function EventsPanel({ onClose, onSelect }: { onClose: () => void; onSelect: (id: string) => void }) {
  const events = useQuery({ queryKey: ['events'], queryFn: fetchEvents, refetchInterval: 60_000 })
  const headingRef = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const now = new Date()
  const list = (events.data ?? []).map((e) => ({ e, w: when(e, now) })).sort((a, b) => a.w.order - b.w.order)

  return (
    <section aria-labelledby="events-title" id="side-events"
      className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="events-title" ref={headingRef} tabIndex={-1}
            className="font-[Archivo] text-xl font-extrabold leading-tight outline-none">
            Events
          </h2>
          <p className="text-[13px] text-white/80">Big crowds coming up. Plan around them, or join in.</p>
        </div>
        <button onClick={onClose} aria-label="Close events"
          className={`-mr-1 -mt-1 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-lg text-white/80 hover:bg-white/10 hover:text-white ${focus}`}>
          ✕
        </button>
      </div>

      {events.isLoading && <p className="mt-3 text-sm text-white/80">Loading events…</p>}
      {events.data && list.length === 0 && (
        <p className="mt-3 text-sm text-white/80">No big events this week. The map shows the usual crowd.</p>
      )}

      <ul className="mt-3 flex flex-col gap-1.5" role="list">
        {list.map(({ e, w }) => {
          const place = SPACE_BY_ID[e.space_id]?.name ?? e.space_id
          return (
            <li key={`${e.space_id}-${e.dow}-${e.starts}`}>
              <button onClick={() => onSelect(e.space_id)}
                aria-label={`${e.title}, ${place}, ${w.dayWord} ${time12(e.starts)} to ${time12(e.ends)}, about ${e.est_size} people. ${w.status}. Show on map.`}
                className={`flex w-full flex-col gap-0.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-left hover:bg-white/10 ${focus}`}>
                <span className="flex items-center gap-1.5 text-[13px] font-semibold text-white/85">
                  {w.live && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[#d9472b]" />}
                  {w.status}
                </span>
                <span className="font-semibold leading-snug">{e.title}</span>
                <span className="text-[13px] text-white/80">{place} · {w.dayWord} {time12(e.starts)} to {time12(e.ends)}</span>
                <span className="text-xs text-white/70">About {e.est_size} people expected</span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
