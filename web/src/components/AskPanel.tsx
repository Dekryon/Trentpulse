import { useEffect, useRef, useState } from 'react'
import { askQuestion } from '../lib/api'

// Ask TrentPulse: a small chat window that opens from the orb, bottom left.
// Gemini answers from the live Tiger Data scores and the next few hours of forecast.
const EXAMPLES = [
  'Where is quiet to study right now?',
  'Which dining hall is quietest for lunch?',
  'When will Bata be quieter?',
]

type Msg = { id: number; role: 'bot' | 'me'; text: string; source?: 'gemini' | 'data' }

const focus = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

export function AskPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { id: 0, role: 'bot', text: 'Hi. Ask me where to eat, study or hang out on campus, and I will check how busy it is right now.' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  // Focus the box when the chat opens; Escape closes it
  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [messages, sending])

  async function ask(q: string) {
    const text = q.trim()
    if (text.length < 3 || sending) return
    setInput('')
    setMessages((m) => [...m, { id: Date.now(), role: 'me', text }])
    setSending(true)
    try {
      const a = await askQuestion(text)
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'bot', text: a.text, source: a.source }])
    } catch (e) {
      setMessages((m) => [...m, { id: Date.now() + 1, role: 'bot', text: e instanceof Error ? e.message : 'Could not get an answer. Try again.' }])
    } finally {
      setSending(false)
    }
  }

  const fresh = messages.length === 1

  return (
    <section role="dialog" aria-labelledby="ask-title" id="side-ask"
      className="glass glass-solid pointer-events-auto flex h-[min(520px,calc(100dvh-14rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl shadow-2xl">
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="ask-orb block h-9 w-9 shrink-0 rounded-full" />
          <div>
            <h2 id="ask-title" className="font-[Archivo] text-base font-extrabold leading-tight">Ask TrentPulse</h2>
            <p className="text-xs text-white/75">Live campus data, answered by Gemini</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close Ask TrentPulse"
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white/80 hover:bg-white/10 hover:text-white ${focus}`}>
          ✕
        </button>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'me' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${m.role === 'me' ? 'rounded-br-md bg-gold text-black' : 'rounded-bl-md bg-white/[0.09] text-white'}`}>
              <span className="sr-only">{m.role === 'me' ? 'You: ' : 'TrentPulse: '}</span>
              {m.text}
              {m.source && <span className="mt-1 block text-[11px] text-white/60">{m.source === 'gemini' ? 'Gemini, from live data' : 'Straight from the data'}</span>}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div className="flex gap-1 rounded-2xl rounded-bl-md bg-white/[0.09] px-3.5 py-3" aria-label="TrentPulse is typing">
              {[0, 1, 2].map((i) => (
                <span key={i} className="typing-dot block h-1.5 w-1.5 rounded-full bg-white/70" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}
        {fresh && (
          <div className="flex flex-wrap gap-1.5 pt-1" role="group" aria-label="Try a question">
            {EXAMPLES.map((q) => (
              <button key={q} type="button" onClick={() => ask(q)}
                className={`min-h-10 rounded-full border border-white/20 px-3 text-left text-[13px] text-white/90 hover:border-gold hover:text-white ${focus}`}>
                {q}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form className="flex items-center gap-2 border-t border-white/10 px-3 py-3" onSubmit={(e) => { e.preventDefault(); ask(input) }}>
        <label htmlFor="ask-input" className="sr-only">Your question</label>
        <input id="ask-input" ref={inputRef} value={input} maxLength={200}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Is Champlain busy for lunch?"
          className={`min-h-11 min-w-0 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-[14px] text-white placeholder:text-white/50 ${focus}`} />
        <button type="submit" aria-label="Send" disabled={sending || input.trim().length < 3}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold text-black disabled:opacity-40 ${focus}`}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
        </button>
      </form>
    </section>
  )
}
