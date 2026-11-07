// Bottom bar: Live / time scrubber / play / 3D toggle
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
    <div className="glass pointer-events-auto flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3">
      <button onClick={onLive}
        className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${live ? 'bg-packed text-white' : 'bg-white/10 text-white/80 hover:bg-white/20'}`}>
        <span className={`mr-1.5 inline-block h-2 w-2 rounded-full ${live ? 'animate-pulse bg-white' : 'bg-white/50'}`} />Live
      </button>
      <div className="w-14 font-[Archivo] text-lg font-extrabold tabular-nums">{label}</div>
      <input
        type="range" min={420} max={1380} step={10} value={minutes}
        onChange={(e) => onMinutes(Number(e.target.value))}
        aria-label="Time of day"
        className="min-w-[160px] flex-1 accent-[#e0a526]"
      />
      <select value={day} onChange={(e) => onDay(Number(e.target.value))} aria-label="Day of week"
        className="rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-sm text-white">
        {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
      </select>
      <button onClick={onPlay} className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold hover:bg-white/20">
        {playing ? 'Pause' : 'Play day'}
      </button>
      <button onClick={on3D}
        className={`rounded-lg px-3 py-1.5 text-sm font-bold ${is3D ? 'bg-gold text-black' : 'bg-trent text-white'}`}>
        {is3D ? '2D' : '3D'}
      </button>
    </div>
  )
}
