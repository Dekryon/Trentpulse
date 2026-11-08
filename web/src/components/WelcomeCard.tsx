import { heatColor } from '../lib/colors'

// Shown once, on a first visit: what the app is and what to do.
// Remembered on the device; if storage is blocked it simply shows again next visit.
const KEY = 'trentpulse-welcomed'

export function wasWelcomed() {
  try { return localStorage.getItem(KEY) === '1' } catch { return false }
}
function markWelcomed() {
  try { localStorage.setItem(KEY, '1') } catch { /* storage blocked: fine */ }
}

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function WelcomeCard({ onDone }: { onDone: () => void }) {
  function done() { markWelcomed(); onDone() }
  return (
    <section aria-labelledby="welcome-title"
      className="glass glass-solid pointer-events-auto w-full max-w-[420px] rounded-2xl p-5 shadow-2xl">
      <h2 id="welcome-title" className="font-[Archivo] text-2xl font-extrabold leading-tight">Is it busy over there?</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/85">
        See how full each study spot on Symons Campus is right now, before you walk over.
      </p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/80">
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: heatColor(10) }} />Green is quiet</span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: heatColor(90) }} />red is packed</span>
      </p>
      <p className="mt-3 text-[15px] leading-relaxed text-white/85">
        Tap a building for details. If you're somewhere on campus, tap <b>Check in</b> to tell everyone how busy it is.
      </p>
      <button onClick={done} autoFocus
        className={`mt-4 min-h-11 w-full rounded-xl bg-trent font-semibold text-white hover:brightness-110 ${focus}`}>
        Show me the map
      </button>
    </section>
  )
}
