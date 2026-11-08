import { SPACE_BY_ID } from '../lib/spaces'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import type { NowResponse } from '../lib/types'

// The number tiles across the top (Analytics-dashboard style).
// On a phone they sit in one swipeable row and never wrap, and the "Showing"
// tile is hidden because the time bar at the bottom already says Live or the time.
function Tile({ label, value, sub, dot, className = '' }: {
  label: string; value: string; sub?: string; dot?: string; className?: string
}) {
  return (
    <div className={`glass shrink-0 rounded-xl px-3.5 py-2.5 ${className}`}>
      <div className="whitespace-nowrap text-xs uppercase tracking-wide text-white/75">{label}</div>
      <div className="flex items-center gap-1.5 whitespace-nowrap font-[Archivo] text-base font-extrabold">
        {dot && <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: dot }} />}
        {value}
      </div>
      {sub && <div className="whitespace-nowrap text-xs text-white/80">{sub}</div>}
    </div>
  )
}

export function TopTiles({ now, checkins, timeLabel }: {
  now?: NowResponse; checkins: number; timeLabel: string
}) {
  const places = (now?.spaces ?? []).filter((s) => SPACE_BY_ID[s.id]?.type !== 'lecture')
  const quietest = [...places].sort((a, b) => a.score - b.score)[0]
  const busiest = [...places].sort((a, b) => b.score - a.score)[0]

  return (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      <Tile label="Showing" value={timeLabel} className="hidden sm:block" />
      {quietest && <Tile label="Quietest now" value={SPACE_BY_ID[quietest.id].name} sub={`${LEVEL_LABEL[quietest.level]} · ${quietest.score}`} dot={heatColor(quietest.score)} />}
      {busiest && <Tile label="Busiest" value={SPACE_BY_ID[busiest.id].name} sub={`${LEVEL_LABEL[busiest.level]} · ${busiest.score}`} dot={heatColor(busiest.score)} />}
      <Tile label="Check-ins today" value={String(checkins)} />
    </div>
  )
}
