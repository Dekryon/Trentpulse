import { useEffect, useRef, useState } from 'react'
import { askQuestion } from '../lib/api'

// Ask TrentPulse: a student types a question and Gemini answers from the live
// Tiger Data scores and the next few hours of the forecast.
const EXAMPLES = [
  'Where is quiet to study right now?',
  'When will Bata be quieter?',
  'Busiest place on the East Bank?',
]

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function AskPanel({ onClose }: { onClose: () => void }) {
  const [question, setQuestion] = useState('')
  const [state, setState] = useState<'idle' | 'asking' | 'done' | 'error'>('idle')
  const [answer, setAnswer] = useState<{ text: string; source: 'gemini' | 'data' } | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Focus the box when the panel opens; Escape closes it
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  async function ask(q: string) {
    const text = q.trim()
    if (text.length < 3 || state === 'asking') return
    setQuestion(text)
    setState('asking')
    try {
      setAnswer(await askQuestion(text))
      setState('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get an answer. Try again.')
      setState('error')
    }
  }

  return (
    <section aria-labelledby="ask-title"
      className="glass glass-solid pointer-events-auto w-full rounded-2xl p-4 shadow-2xl sm:w-[340px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="ask-title" className="font-[Archivo] text-xl font-extrabold leading-tight">Ask TrentPulse</h2>
          <p className="text-xs text-white/65">Answers come from live campus data.</p>
        </div>
        <button onClick={onClose} aria-label="Close Ask TrentPulse"
          className={`-mr-1 -mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-lg text-lg text-white/70 hover:bg-white/10 hover:text-white ${focus}`}>
          ✕
        </button>
      </div>

      <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); ask(question) }}>
        <label htmlFor="ask-input" className="sr-only">Your question</label>
        <input id="ask-input" ref={inputRef} value={question} maxLength={200}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Where can I study quietly?"
          className={`min-h-11 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-3 text-white placeholder:text-white/40 ${focus}`} />
        <button type="submit" disabled={state === 'asking' || question.trim().length < 3}
          className={`min-h-11 rounded-lg bg-trent px-4 font-semibold text-white hover:brightness-110 disabled:opacity-50 ${focus}`}>
          Ask
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Example questions">
        {EXAMPLES.map((q) => (
          <button key={q} type="button" onClick={() => ask(q)} disabled={state === 'asking'}
            className={`min-h-9 rounded-full bg-white/[0.07] px-3 text-xs text-white/85 hover:bg-white/15 disabled:opacity-50 ${focus}`}>
            {q}
          </button>
        ))}
      </div>

      <div role="status" aria-live="polite" className="mt-3 min-h-6 text-sm">
        {state === 'asking' && <p className="text-white/70">Thinking…</p>}
        {state === 'done' && answer && (
          <div className="rounded-lg bg-white/[0.06] px-3 py-2">
            <p>{answer.text}</p>
            <p className="mt-1 text-[11px] text-white/50">{answer.source === 'gemini' ? 'Answered by Gemini from live data' : 'Answered straight from the data'}</p>
          </div>
        )}
        {state === 'error' && <p className="text-amber-200">{error}</p>}
      </div>
    </section>
  )
}
