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
  // A text version of the chart for screen readers: when this place usually peaks,
  // and how today compares so far
  const peak = rows.reduce<{ time: string; typical: number } | null>((best, r) => (!best || r.typical > best.typical ? r : best), null)
  const lastToday = [...rows].reverse().find((r) => r.today != null)
  const chartSummary = peak
    ? `Chart: on a typical day ${def.name} is busiest around ${peak.time}, at about ${Math.round(peak.typical)} out of 100.` +
      (lastToday ? ` Today at ${lastToday.time} it was ${Math.round(lastToday.today!)}, against a typical ${Math.round(lastToday.typical)}.` : '')
    : 'Chart loading.'
  const relevant = events.filter((e) => e.includes(def.name) || e.toLowerCase().includes('let out'))

  return (
    <section aria-label={`${def.name} details`} className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-white/75">{def.bank === 'west' ? 'West Bank' : 'East Bank'}</div>
          <h2 className="font-[Archivo] text-xl font-extrabold leading-tight">{def.name}</h2>
          {def.food && <p className="mt-0.5 text-[13px] text-white/85">Food here: {def.food}</p>}
        </div>
        <button onClick={onClose} aria-label={`Close ${def.name} details`}
          className="-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-[Archivo] text-3xl font-extrabold tabular-nums">{space.score}</span>
        <span className="rounded-full px-2 py-0.5 text-xs font-bold text-black" style={{ background: heatColor(space.score) }}>{LEVEL_LABEL[space.level]}</span>
        <span className="text-[13px] text-white/80">
          <span aria-hidden="true">{space.trend === 'up' ? '↑ ' : space.trend === 'down' ? '↓ ' : '→ '}</span>
          {space.trend === 'up' ? 'filling up' : space.trend === 'down' ? 'emptying' : 'steady'}
        </span>
      </div>

      {/* Score bar with marker: the number and word above already say the same, so screen readers skip it */}
      <div aria-hidden="true">
        <div className="relative mt-3 h-2 rounded-full" style={{ background: 'linear-gradient(90deg,#2f9e6a,#e0a526,#d9472b)' }}>
          <div className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white" style={{ left: `${space.score}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-xs text-white/70"><span>Quiet</span><span>Packed</span></div>
      </div>

      {relevant.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-100">
          {relevant[0]}
        </div>
      )}

      {!compact && (
        <>
          <div className="mt-4 flex items-center justify-between gap-2 text-xs text-white/80">
            <span>Today vs a typical day</span>
            <span aria-hidden="true" className="flex items-center gap-3">
              <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 bg-[#e0a526]" />Today</span>
              <span className="flex items-center gap-1"><span className="inline-block w-4 border-t border-dashed border-white/70" />Typical</span>
            </span>
          </div>
          <p className="sr-only">{chartSummary}</p>
          <div className="mt-1 h-32" aria-hidden="true">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                <XAxis dataKey="time" tick={{ fill: 'rgba(255,255,255,.7)', fontSize: 11 }} interval={5} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: 'rgba(255,255,255,.7)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0c120f', border: '1px solid rgba(255,255,255,.15)', borderRadius: 8, fontSize: 12 }} />
                <Line type="monotone" dataKey="typical" stroke="rgba(255,255,255,.4)" strokeDasharray="4 4" dot={false} strokeWidth={1.5} />
                <Line type="monotone" dataKey="today" stroke="#e0a526" dot={false} strokeWidth={2.5} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="mt-3 rounded-lg bg-white/[0.08] px-3 py-2 text-sm leading-relaxed" aria-live="polite">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-gold">Tip</span>
        {suggest.isLoading ? 'Thinking…' : suggest.data?.text}
      </div>

      <button onClick={onCheckin}
        className="mt-3 min-h-11 w-full rounded-xl bg-trent py-2.5 font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        I'm here: check in
      </button>
      <div className="mt-1.5 text-center text-xs text-white/75">
        {space.reports_20m === 1 ? '1 check-in' : `${space.reports_20m} check-ins`} in the last 20 min
      </div>
    </section>
  )
}
