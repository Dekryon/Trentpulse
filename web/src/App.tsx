import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CampusMap } from './components/CampusMap'
import { TopTiles } from './components/TopTiles'
import { BuildingPanel } from './components/BuildingPanel'
import { TimeBar } from './components/TimeBar'
import { CheckInSheet } from './components/CheckInSheet'
import { USING_MOCK, fetchNow, sendCheckin } from './lib/api'
import { loadBuildings } from './lib/geo'
import { checkinsToday } from './lib/mockApi'
import type { CheckinBody } from './lib/types'

function minutesNow() {
  const d = new Date()
  return Math.min(1380, Math.max(420, d.getHours() * 60 + d.getMinutes()))
}

// The date for a chosen weekday (this week) at a chosen time
function dateFor(day: number, minutes: number) {
  const d = new Date()
  d.setDate(d.getDate() + (day - d.getDay()))
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return d
}

// Overnight (before 7:00 or after 23:00) there is nothing to show live,
// so open on a busy weekday lunchtime instead.
const h = new Date().getHours()
const START_LIVE = h >= 7 && h < 23

export default function App() {
  const qc = useQueryClient()
  const [live, setLive] = useState(START_LIVE)
  const [minutes, setMinutes] = useState(START_LIVE ? minutesNow() : 12 * 60)
  const [day, setDay] = useState(START_LIVE ? new Date().getDay() : 2)
  const [playing, setPlaying] = useState(false)
  const [is3D, setIs3D] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>('bata')
  const [checkinOpen, setCheckinOpen] = useState(false)
  const [localCheckins, setLocalCheckins] = useState(0)

  // Building outlines from OpenStreetMap (or placeholders)
  const buildings = useQuery({ queryKey: ['buildings'], queryFn: loadBuildings, staleTime: Infinity })

  // Live: ask every 15 s. Scrubbing: ask for that exact time.
  const at = live ? undefined : dateFor(day, minutes)
  const now = useQuery({
    queryKey: ['now', at ? at.toISOString() : 'live'],
    queryFn: () => fetchNow(at),
    refetchInterval: live ? 15_000 : false,
    placeholderData: (prev) => prev,
  })

  // Keep the clock moving in live mode
  useEffect(() => {
    if (!live) return
    const t = setInterval(() => { setMinutes(minutesNow()); setDay(new Date().getDay()) }, 30_000)
    return () => clearInterval(t)
  }, [live])

  // "Play day": move 10 minutes every 0.35 s
  useEffect(() => {
    if (!playing) return
    const t = setInterval(() => {
      setMinutes((m) => {
        if (m >= 1380) { setPlaying(false); return m }
        return m + 10
      })
    }, 350)
    return () => clearInterval(t)
  }, [playing])

  const scores = useMemo(
    () => Object.fromEntries((now.data?.spaces ?? []).map((s) => [s.id, s.score])),
    [now.data],
  )
  const selected = now.data?.spaces.find((s) => s.id === selectedId)
  const dayName = new Date(dateFor(day, minutes)).toLocaleDateString([], { weekday: 'short' })
  const timeLabel = live ? 'Live now' : `${dayName} ${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

  async function submitCheckin(b: CheckinBody) {
    await sendCheckin(b)
    setLocalCheckins((n) => n + 1)
    setLive(true)
    setMinutes(minutesNow())
    setDay(new Date().getDay())
    await qc.invalidateQueries({ queryKey: ['now'] })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {buildings.data ? (
        <CampusMap buildings={buildings.data} scores={scores} selectedId={selectedId} is3D={is3D} onSelect={setSelectedId} />
      ) : (
        <div className="grid h-full place-items-center text-white/60">Loading campus…</div>
      )}

      {/* Top: brand + tiles */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <div className="glass pointer-events-auto rounded-xl px-3 py-2">
            <span className="font-[Archivo] text-lg font-extrabold">Trent<span className="text-gold">Pulse</span></span>
          </div>
          {USING_MOCK && (
            <span className="glass rounded-full px-2.5 py-1 text-[11px] text-white/70" title="Set VITE_API_URL to use the real API">
              Demo data
            </span>
          )}
        </div>
        <TopTiles now={now.data} checkins={(USING_MOCK ? 180 + checkinsToday() : 0) || localCheckins} timeLabel={timeLabel} />
      </div>

      {/* Right: building panel */}
      {selected && (
        <div className="pointer-events-none absolute bottom-28 right-3 top-auto flex max-h-[calc(100%-14rem)] w-[calc(100%-1.5rem)] justify-end overflow-y-auto sm:bottom-auto sm:right-4 sm:top-36 sm:w-auto">
          <BuildingPanel
            space={selected}
            at={at}
            events={now.data?.events ?? []}
            onClose={() => setSelectedId(null)}
            onCheckin={() => setCheckinOpen(true)}
          />
        </div>
      )}

      {/* Bottom: time bar + check-in button */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 sm:p-4">
        {!selected && (
          <button onClick={() => setCheckinOpen(true)}
            className="pointer-events-auto self-end rounded-full bg-trent px-5 py-3 font-semibold text-white shadow-xl hover:brightness-110">
            + Check in
          </button>
        )}
        <TimeBar
          minutes={minutes}
          day={day}
          live={live}
          playing={playing}
          is3D={is3D}
          onMinutes={(m) => { setLive(false); setMinutes(m) }}
          onDay={(d) => { setLive(false); setDay(d) }}
          onLive={() => { setLive(true); setPlaying(false); setMinutes(minutesNow()); setDay(new Date().getDay()) }}
          onPlay={() => {
            if (playing) { setPlaying(false); return }
            setLive(false)
            if (minutes >= 1380) setMinutes(420)
            setPlaying(true)
          }}
          on3D={() => setIs3D((v) => !v)}
        />
      </div>

      {checkinOpen && (
        <CheckInSheet initialSpace={selectedId} onSubmit={submitCheckin} onClose={() => setCheckinOpen(false)} />
      )}
    </div>
  )
}
