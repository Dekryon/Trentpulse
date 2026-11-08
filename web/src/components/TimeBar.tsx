// Bottom bar: Live / time scrubber / day / play / 3D toggle.
// On a phone it wraps to two rows (Live, time and slider on top; day, play and
// 3D below) and every control is at least 44px tall for thumbs.
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'
const control = `min-h-11 rounded-lg px-3 text-sm font-semibold sm:min-h-9 ${focus}`

export function TimeBar({ minutes, day, live, playing, is3D, onMinutes, onDay, onLive, onPlay, on3D }: {
  minutes: number
  day: number
  onDay: (d: number) => void
  live: boolean
  playing: boolean
  is3D: boolean
  onMinutes: (m: number) => void
  onLive: () => void
  onPlay: () => void
  on3D: () => void
}) {
  const label = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
  return (
    <div className="glass pointer-events-auto flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl px-3 py-2.5 sm:px-4 sm:py-3">
      <button onClick={onLive} aria-pressed={live}
        className={`${control} ${live ? 'bg-packed text-white' : 'bg-white/10 text-white/85 hover:bg-white/20'}`}>
        <span aria-hidden="true" className={`mr-1.5 inline-block h-2 w-2 rounded-full ${live ? 'animate-pulse bg-white motion-reduce:animate-none' : 'bg-white/50'}`} />Live
      </button>
      <div className="w-14 font-[Archivo] text-lg font-extrabold tabular-nums" aria-live="off">{label}</div>
      <input
        type="range" min={420} max={1380} step={10} value={minutes}
        onChange={(e) => onMinutes(Number(e.target.value))}
        aria-label="Time of day" aria-valuetext={label}
        className={`h-11 min-w-[140px] flex-1 accent-[#e0a526] sm:h-auto ${focus}`}
      />
      <div className="flex w-full gap-2 sm:w-auto">
        <select value={day} onChange={(e) => onDay(Number(e.target.value))} aria-label="Day of week"
          className={`${control} border border-white/15 bg-black/40 text-white`}>
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <button onClick={onPlay} className={`${control} flex-1 bg-white/10 hover:bg-white/20 sm:flex-none`}>
          {playing ? 'Pause' : 'Play day'}
        </button>
        <button onClick={on3D} aria-pressed={is3D} aria-label={is3D ? 'Switch to 2D map' : 'Switch to 3D map'}
          className={`${control} font-bold ${is3D ? 'bg-gold text-black' : 'bg-trent text-white'}`}>
          {is3D ? '2D' : '3D'}
        </button>
      </div>
    </div>
  )
}
