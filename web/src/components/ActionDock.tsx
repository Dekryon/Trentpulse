import { useRef, useState } from 'react'

// The bottom bar: what time you're looking at, plus the two main actions
// (check in, check in with a photo). Time controls fold away behind the time
// pill, so a first-time student sees one obvious thing to do.
const DAYS: { value: number; short: string }[] = [
  { value: 1, short: 'Mon' }, { value: 2, short: 'Tue' }, { value: 3, short: 'Wed' },
  { value: 4, short: 'Thu' }, { value: 5, short: 'Fri' }, { value: 6, short: 'Sat' }, { value: 0, short: 'Sun' },
]
const START = 420, END = 1380 // 7:00 to 23:00, in minutes
const HOUR_MARKS = [420, 660, 900, 1140, 1380]

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function clockLabel(minutes: number) {
  const h = Math.floor(minutes / 60), m = minutes % 60
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}
function hourLabel(minutes: number) {
  const h = Math.floor(minutes / 60)
  return `${((h + 11) % 12) + 1} ${h < 12 ? 'am' : 'pm'}`
}

function CameraIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

export function ActionDock({ live, minutes, day, dayName, playing, onLive, onMinutes, onDay, onPlay, onCheckin, onPhoto }: {
  live: boolean
  minutes: number
  day: number
  dayName: string
  playing: boolean
  onLive: () => void
  onMinutes: (m: number) => void
  onDay: (d: number) => void
  onPlay: () => void
  onCheckin: () => void
  onPhoto: (file: File) => void
}) {
  const [planOpen, setPlanOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-[640px] flex-col gap-2">
      {/* "See another time": opens above the bar */}
      {planOpen && (
        <section aria-labelledby="plan-title" className="glass glass-solid rounded-2xl p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 id="plan-title" className="font-[Archivo] text-lg font-extrabold">See another time</h2>
            <button onClick={() => setPlanOpen(false)} aria-label="Close time controls"
              className={`grid h-10 w-10 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white ${focus}`}>✕</button>
          </div>
          <p className="text-sm text-white/65">Busyness follows a typical week. Pick a day and time to plan ahead.</p>

          <div className="mt-3 grid grid-cols-7 gap-1" role="group" aria-label="Day">
            {DAYS.map((d) => (
              <button key={d.value} onClick={() => onDay(d.value)} aria-pressed={!live && day === d.value}
                className={`min-h-11 min-w-0 rounded-lg text-sm font-semibold ${focus} ${!live && day === d.value ? 'bg-white text-[#0c120f]' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}>
                {d.short}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <label htmlFor="time-slider" className="text-sm text-white/65">Time</label>
              <span className="font-[Archivo] text-lg font-extrabold tabular-nums">{clockLabel(minutes)}</span>
            </div>
            <input id="time-slider" type="range" min={START} max={END} step={10} value={minutes}
              onChange={(e) => onMinutes(Number(e.target.value))}
              aria-valuetext={`${dayName} ${clockLabel(minutes)}`}
              className={`mt-1 h-10 w-full accent-[#e0a526] ${focus}`} />
            <div aria-hidden="true" className="relative h-4 text-[11px] text-white/50">
              {HOUR_MARKS.map((m) => (
                <span key={m} className="absolute -translate-x-1/2 whitespace-nowrap first:translate-x-0 last:-translate-x-full"
                  style={{ left: `${((m - START) / (END - START)) * 100}%` }}>{hourLabel(m)}</span>
              ))}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={onPlay} className={`min-h-11 flex-1 rounded-lg bg-white/10 px-4 font-semibold hover:bg-white/20 ${focus}`}>
              {playing ? 'Pause' : 'Play the day'}
            </button>
            <button onClick={() => { onLive(); setPlanOpen(false) }} disabled={live}
              className={`min-h-11 flex-1 rounded-lg bg-white/10 px-4 font-semibold hover:bg-white/20 disabled:opacity-50 ${focus}`}>
              Back to now
            </button>
          </div>
        </section>
      )}

      {/* The bar itself */}
      <div className="glass glass-solid flex items-center gap-2 rounded-2xl p-2">
        <button onClick={() => setPlanOpen((v) => !v)} aria-expanded={planOpen}
          aria-label={live ? `Showing now, ${clockLabel(minutes)}. Change time` : `Showing ${dayName} ${clockLabel(minutes)}. Change time`}
          className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl px-3 text-left hover:bg-white/10 ${focus}`}>
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${live ? 'animate-pulse bg-[#d9472b] motion-reduce:animate-none' : 'bg-gold'}`} />
          <span className="leading-tight">
            <span className="block text-xs text-white/60">{live ? 'Live' : 'Planning'}</span>
            <span className="block whitespace-nowrap font-semibold tabular-nums">{live ? clockLabel(minutes) : `${dayName} ${clockLabel(minutes)}`}</span>
          </span>
        </button>

        <button onClick={onCheckin}
          className={`min-h-12 flex-1 rounded-xl bg-trent px-4 font-semibold text-white hover:brightness-110 ${focus}`}>
          Check in
        </button>

        <input ref={fileRef} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPhoto(f); e.target.value = '' }} />
        <button onClick={() => fileRef.current?.click()} aria-label="Check in with a photo"
          className={`flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-white/10 px-3.5 font-semibold hover:bg-white/20 ${focus}`}>
          <CameraIcon />
          <span className="hidden sm:inline">Photo</span>
        </button>
      </div>
    </div>
  )
}
