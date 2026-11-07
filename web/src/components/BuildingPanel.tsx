import { useQuery } from '@tanstack/react-query'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fetchHistory, fetchSuggest } from '../lib/api'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import { SPACE_BY_ID } from '../lib/spaces'
import type { SpaceNow } from '../lib/types'

// The dark glass detail card (Landtrack style)
export function BuildingPanel({ space, at, events, onClose, onCheckin }: {
  space: SpaceNow
  at?: Date
  events: string[]
  onClose: () => void
  onCheckin: () => void
}) {
  const def = SPACE_BY_ID[space.id]
  const history = useQuery({ queryKey: ['history', space.id], queryFn: () => fetchHistory(space.id) })
  const suggest = useQuery({
    queryKey: ['suggest', space.id, at?.toISOString().slice(0, 16) ?? 'live', space.score],
    queryFn: () => fetchSuggest(space.id, at),
  })

  // Line up "today" and "typical" by time for the chart
  const rows = (history.data?.typical ?? []).map((p, i) => ({
    time: new Date(p.t).toLocaleTimeString([], { hour: 'numeric' }),
    typical: p.score,
    today: history.data?.today[i]?.score,
  }))
  const relevant = events.filter((e) => e.includes(def.name) || e.toLowerCase().includes('let out'))

  return (
    <div className="glass pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-white/55">{def.bank === 'west' ? 'West Bank' : 'East Bank'}</div>
          <h2 className="font-[Archivo] text-xl font-extrabold leading-tight">{def.name}</h2>
        </div>
        <button onClick={onClose} className="rounded-lg px-2 py-1 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Close panel">✕</button>
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

      <div className="mt-4 text-xs text-white/60">Today vs a typical day</div>
      <div className="mt-1 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
            <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 10 }} interval={5} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,.45)', fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#0c120f', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, fontSize: 12 }} />
            <Line type="monotone" dataKey="typical" stroke="rgba(255,255,255,.4)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
            <Line type="monotone" dataKey="today" stroke="#e0a526" dot={false} strokeWidth={2.5} connectNulls={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 rounded-lg bg-white/[0.06] px-3 py-2 text-sm">
        <span className="mr-1 text-[11px] font-semibold uppercase tracking-wide text-gold">Tip</span>
        {suggest.isLoading ? 'Thinking…' : suggest.data?.text}
      </div>

      <button onClick={onCheckin} className="mt-3 w-full rounded-xl bg-trent py-2.5 font-semibold text-white hover:brightness-110">
        I'm here: check in
      </button>
      <div className="mt-1 text-center text-[11px] text-white/45">{space.reports_20m} check-ins in the last 20 min</div>
    </div>
  )
}
