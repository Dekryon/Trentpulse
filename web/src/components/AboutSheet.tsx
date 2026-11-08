import { useEffect, useRef } from 'react'
import type { StatsResponse } from '../lib/types'

// "How it works": plain answers for students, plus the numbers behind the map
// for anyone curious (and for judges), kept off the main screen.
const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function AboutSheet({ stats, onClose }: { stats: StatsResponse | null; onClose: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    headingRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 sm:items-center" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="about-title" onClick={(e) => e.stopPropagation()}
        className="glass glass-solid max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <h2 id="about-title" ref={headingRef} tabIndex={-1} className="font-[Archivo] text-2xl font-extrabold outline-none">How TrentPulse works</h2>
          <button onClick={onClose} aria-label="Close"
            className={`-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white ${focus}`}>✕</button>
        </div>

        <div className="mt-3 flex flex-col gap-4 text-[15px] leading-relaxed text-white/85">
          <p>
            TrentPulse shows how busy study and hangout spaces on Symons Campus are, without any sensors.
            Each building's colour comes from three things: what students on site report, how busy that
            space usually is at this hour on this weekday, and whether a big class has just let out nearby.
          </p>
          <p>
            When you check in, the map updates for everyone within about 15 seconds. When nobody has checked
            in yet, the usual pattern for the day keeps the map honest.
          </p>

          <div>
            <h3 className="font-[Archivo] text-base font-extrabold text-white">Your privacy</h3>
            <ul className="mt-1 list-disc pl-5">
              <li>No account and no name. Your phone gets a random ID so it counts once per building.</li>
              <li>"Use my location" only picks the nearest building on your phone. Your location is never sent.</li>
              <li>Photos are only used for the AI estimate and are never saved.</li>
            </ul>
          </div>

          <div>
            <h3 className="font-[Archivo] text-base font-extrabold text-white">Under the hood</h3>
            <p className="mt-1">
              Every check-in is stored as time-series data in Tiger Data. Rollups update on their own every
              few minutes, and older history is compressed.
            </p>
            {stats && (
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-white/[0.06] px-2 py-2.5">
                  <dt className="text-xs text-white/60">History</dt>
                  <dd className="font-[Archivo] text-lg font-extrabold tabular-nums">{stats.rows_total.toLocaleString('en-CA')}</dd>
                  <dd className="text-xs text-white/60">rows</dd>
                </div>
                <div className="rounded-xl bg-white/[0.06] px-2 py-2.5">
                  <dt className="text-xs text-white/60">Compressed</dt>
                  <dd className="font-[Archivo] text-lg font-extrabold tabular-nums">{stats.compression_ratio}×</dd>
                  <dd className="text-xs text-white/60">smaller</dd>
                </div>
                <div className="rounded-xl bg-white/[0.06] px-2 py-2.5">
                  <dt className="text-xs text-white/60">Scoring</dt>
                  <dd className="font-[Archivo] text-lg font-extrabold tabular-nums">{stats.score_query_ms} ms</dd>
                  <dd className="text-xs text-white/60">all spaces</dd>
                </div>
              </dl>
            )}
            <p className="mt-3 text-sm text-white/60">
              The history behind the usual patterns is simulated until enough real check-ins build up, and the
              lecture schedule is a sample.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
