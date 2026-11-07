import { SPACE_BY_ID } from '../lib/spaces'
import { LEVEL_LABEL, heatColor } from '../lib/colors'
import type { NowResponse } from '../lib/types'

// The number tiles across the top (Analytics-dashboard style)
export function TopTiles({ now, checkins, timeLabel }: { now?: NowResponse; checkins: number; timeLabel: string }) {
  const places = (now?.spaces ?? []).filter((s) => SPACE_BY_ID[s.id]?.type !== 'lecture')
  const quietest = [...places].sort((a, b) => a.score - b.score)[0]
  const busiest = [...places].sort((a, b) => b.score - a.score)[0]

  const Tile = ({ label, value, sub, dot }: { label: string; value: string; sub?: string; dot?: string }) => (
    <div className="glass min-w-[130px] rounded-xl px-3.5 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-white/60">{label}</div>
      <div className="flex items-center gap-1.5 font-[Archivo] text-base font-extrabold">
        {dot && <span className="h-2.5 w-2.5 rounded-full" style={{ background: dot }} />}
        {value}
      </div>
      {sub && <div className="text-[11px] text-white/60">{sub}</div>}
    </div>
  )

  return (
    <div className="pointer-events-auto flex gap-2 overflow-x-auto pb-1">
      <Tile label="Showing" value={timeLabel} />
      {quietest && <Tile label="Quietest now" value={SPACE_BY_ID[quietest.id].name} sub={`${LEVEL_LABEL[quietest.level]} · ${quietest.score}`} dot={heatColor(quietest.score)} />}
      {busiest && <Tile label="Busiest" value={SPACE_BY_ID[busiest.id].name} sub={`${LEVEL_LABEL[busiest.level]} · ${busiest.score}`} dot={heatColor(busiest.score)} />}
      <Tile label="Check-ins today" value={String(checkins)} />
    </div>
  )
}
