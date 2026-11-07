import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CampusMap } from './components/CampusMap'
import { TopTiles } from './components/TopTiles'
import { BuildingPanel } from './components/BuildingPanel'
import { TimeBar } from './components/TimeBar'
import { CheckInSheet } from './components/CheckInSheet'
import { SpaceList } from './components/SpaceList'
import { AskPanel } from './components/AskPanel'
import { USING_MOCK, fetchNow, fetchStats, sendCheckin } from './lib/api'
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

// Phones get a different layout (panel stacked above the time bar).
// Matches Tailwind's "sm" breakpoint (640px).
const SMALL_QUERY = '(max-width: 639px)'
function useIsSmall() {
  const [small, setSmall] = useState(() => window.matchMedia(SMALL_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(SMALL_QUERY)
    const onChange = () => setSmall(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return small
}

export default function App() {
  const qc = useQueryClient()
  const isSmall = useIsSmall()
  const [live, setLive] = useState(START_LIVE)
  const [minutes, setMinutes] = useState(START_LIVE ? minutesNow() : 12 * 60)
  const [day, setDay] = useState(START_LIVE ? new Date().getDay() : 2)
  const [playing, setPlaying] = useState(false)
  const [is3D, setIs3D] = useState(false)
  // On a phone, open on the map itself; the panel would cover it.
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    window.matchMedia(SMALL_QUERY).matches ? null : 'bata')
  const [checkinOpen, setCheckinOpen] = useState(false)
  // The side panel: the list of all spaces, or Ask TrentPulse (one at a time)
  const [side, setSide] = useState<'list' | 'ask' | null>(null)
  const toggleSide = (which: 'list' | 'ask') => setSide((v) => (v === which ? null : which))
  const [localCheckins, setLocalCheckins] = useState(0)

  // Picking a space from the list opens its details. On a phone the side panel and
  // the details share the bottom area, so the list steps aside.
  function pickFromList(id: string) {
    setSelectedId(id)
    if (isSmall) setSide(null)
  }

  // Measure the bottom stack so the map's own bottom controls sit just above it
  const rootRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bottomRef.current, root = rootRef.current
    if (!el || !root) return
    const ro = new ResizeObserver(() => root.style.setProperty('--bottom-ui', `${el.offsetHeight}px`))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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

  // Tiger Data numbers for the stats tile; they change slowly, so once a minute
  const stats = useQuery({ queryKey: ['stats'], queryFn: fetchStats, refetchInterval: 60_000 })

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

  const panel = selected && (
    <BuildingPanel
      space={selected}
      at={at}
      events={now.data?.events ?? []}
      compact={isSmall}
      onClose={() => setSelectedId(null)}
      onCheckin={() => setCheckinOpen(true)}
    />
  )

  const sidePanel = side === 'ask'
    ? <AskPanel onClose={() => setSide(null)} />
    : side === 'list' && now.data
      ? <SpaceList spaces={now.data.spaces} selectedId={selectedId} onSelect={pickFromList} onClose={() => setSide(null)} />
      : null

  return (
    <div ref={rootRef} className="relative h-full w-full overflow-hidden">
      {buildings.data ? (
        <CampusMap buildings={buildings.data} scores={scores} selectedId={selectedId} is3D={is3D} onSelect={setSelectedId} />
      ) : (
        <div className="grid h-full place-items-center text-white/60">Loading campus…</div>
      )}

      {/* Top: brand + tiles. Right padding leaves room for the zoom buttons. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col gap-2 p-3 pr-14 sm:p-4 sm:pr-16">
        <div className="flex items-center gap-2">
          <h1 className="glass pointer-events-auto m-0 rounded-xl px-3 py-2 font-[Archivo] text-lg font-extrabold">
            Trent<span className="text-gold">Pulse</span>
          </h1>
          {(['list', 'ask'] as const).map((which) => (
            <button key={which} onClick={() => toggleSide(which)} aria-pressed={side === which}
              className={`glass pointer-events-auto min-h-11 rounded-xl px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${side === which ? 'bg-white/20 text-white' : 'text-white/85 hover:bg-white/10'}`}>
              {which === 'list' ? 'List' : 'Ask'}
            </button>
          ))}
          {USING_MOCK && (
            <span className="glass rounded-full px-2.5 py-1 text-[11px] text-white/70" title="Set VITE_API_URL to use the real API">
              Demo data
            </span>
          )}
        </div>
        <TopTiles
          now={now.data}
          stats={stats.data ?? null}
          checkins={USING_MOCK ? 180 + checkinsToday() : (now.data?.checkins_today ?? localCheckins)}
          timeLabel={timeLabel}
        />
      </div>

      {/* Desktop: side panel (list or Ask) on the left */}
      {!isSmall && sidePanel && (
        <div className="pointer-events-none absolute left-4 top-36 flex max-h-[calc(100%-16rem)] overflow-y-auto">
          {sidePanel}
        </div>
      )}

      {/* Desktop: building panel top right */}
      {!isSmall && panel && (
        <div className="pointer-events-none absolute right-4 top-36 flex max-h-[calc(100%-16rem)] justify-end overflow-y-auto">
          {panel}
        </div>
      )}

      {/* Bottom stack: (phone) building panel, check-in button, time bar */}
      <div ref={bottomRef} className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col gap-2 p-3 sm:p-4">
        {isSmall && sidePanel && (
          <div className="pointer-events-none flex max-h-[55vh] overflow-y-auto rounded-2xl">{sidePanel}</div>
        )}
        {isSmall && !side && panel && (
          <div className="pointer-events-none flex max-h-[52vh] overflow-y-auto rounded-2xl">{panel}</div>
        )}
        {!selected && !(isSmall && side) && (
          <button onClick={() => setCheckinOpen(true)}
            className="pointer-events-auto min-h-11 self-end rounded-full bg-trent px-5 py-3 font-semibold text-white shadow-xl hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
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
