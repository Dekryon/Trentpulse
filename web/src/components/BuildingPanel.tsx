import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchHistory, fetchSuggest } from '../lib/api'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import { SPACE_BY_ID } from '../lib/spaces'
import type { SpaceNow } from '../lib/types'

// The dark glass detail card (Landtrack style)
export function BuildingPanel({ space, at, events, compact = false, onClose, onCheckin }: {
  space: SpaceNow
  at?: Date
  events: string[]
  compact?: boolean // phone: skip the chart, it is too small to read there
  onClose: () => void
  onCheckin: () => void
}) {
  const def = SPACE_BY_ID[space.id]
  const history = useQuery({ queryKey: ['history', space.id], queryFn: () => fetchHistory(space.id) })
  const suggest = useQuery({
    queryKey: ['suggest', space.id, at?.toISOString().slice(0, 16) ?? 'live', space.score],
    queryFn: () => fetchSuggest(space.id, at),
  })

  // Line up "today" and "typical" by hour for the chart (7 am to 11 pm)
  const todayByHour = new Map((history.data?.today ?? []).map((p) => [new Date(p.t).getHours(), p.score]))
  const rows = (history.data?.typical ?? []).map((p) => {
    const d = new Date(p.t)
    return { time: d.toLocaleTimeString([], { hour: 'numeric' }), typical: p.score, today: todayByHour.get(d.getHours()) }
  })
  const relevant = events.filter((e) => e.includes(def.name) || e.toLowerCase().includes('let out'))

  return (
    <section aria-label={`${def.name} details`} className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-white/60">{def.bank === 'west' ? 'West Bank' : 'East Bank'}</div>
          <h2 className="font-[Archivo] text-xl font-extrabold leading-tight">{def.name}</h2>
        </div>
        <button onClick={onClose} aria-label={`Close ${def.name} details`}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-[Archivo] text-3xl font-extrabold tabular-nums">{space.score}</span>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-black" style={{ background: heatColor(space.score) }}>{LEVEL_LABEL[space.level]}</span>
        <span className="text-xs text-white/55">
          {space.trend === 'up' ? '↑ filling up' : space.trend === 'down' ? '↓ emptying' : '→ steady'}
        </span>
      </div>

      {/* Score bar with marker */}
      <div className="relative mt-3 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#2f9e6a,#e0a526,#d9472b)' }}>
        <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white" style={{ left: `${space.score}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-white/45"><span>Quiet</span><span>Packed</span></div>

      {relevant.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {relevant[0]}
        </div>
      )}

      {!compact && (
        <>
          <div className="mt-4 text-xs text-white/60">Today vs a typical day</div>
          <div className="mt-1 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} interval={5} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,.5)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0c120f', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="typical" stroke="rgba(255,255,255,.4)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="today" stroke="#e0a526" dot={false} strokeWidth={2.5} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-sm">
        <span className="mr-1 font-semibold text-gold">Tip:</span>
        {suggest.isLoading ? 'Thinking…' : suggest.data?.text}
      </div>

      <button onClick={onCheckin}
        className="mt-3 min-h-11 w-full rounded-xl bg-trent py-2.5 font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        I'm here: check in
      </button>
      <div className="mt-1.5 text-center text-xs text-white/60">
        {space.reports_20m === 1 ? '1 check-in' : `${space.reports_20m} check-ins`} in the last 20 min
      </div>
    </section>
  )
}
