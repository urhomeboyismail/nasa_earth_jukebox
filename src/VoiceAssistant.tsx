import { useEffect, useRef, useState, type FormEvent } from "react";
import type { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import "./styles/assistant.css";

type Assistant = ReturnType<typeof useVoiceAssistant>;

// Material Symbols paths (Apache 2.0), drawn on a 24 x 24 grid.
const icons = {
  mic: "M12 14q-1.25 0-2.125-.875T9 11V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 1.25-.875 2.125T12 14m-1 7v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 2.075 1.463 3.538T12 16t3.538-1.463T17 11h2q0 2.625-1.7 4.6T13 17.925V21z",
  volume: "M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16",
  close: "M6.4 19 5 17.6l5.6-5.6L5 6.4 6.4 5l5.6 5.6L17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6z",
  send: "M16.175 13H4v-2h12.175l-5.6-5.6L12 4l8 8-8 8-1.425-1.4z",
  stop: "M6 18V6h12v12z",
};

function Icon({ name, size = 20 }: { name: keyof typeof icons; size?: number }) {
  return <svg className="voice-assistant__icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={icons[name]} /></svg>;
}

export default function VoiceAssistant({ assistant, onClose }: { assistant: Assistant; onClose: () => void }) {
  const { status, transcript, error, micMuted, level, micSilent } = assistant;
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const active = status === "connecting" || status === "listening" || status === "speaking";

  useEffect(() => { title.current?.focus(); }, []);
  // The panel floats over the page, so the page keeps a focused control clear of it (App.css reads --voice-panel-space on a phone: its height and 16 px of room).
  useEffect(() => {
    const root = document.documentElement;
    const measure = () => { if (panel.current) root.style.setProperty("--voice-panel-space", `${panel.current.offsetHeight + 16}px`); };
    measure();
    const watch = typeof ResizeObserver === "undefined" || !panel.current ? undefined : new ResizeObserver(measure);
    if (panel.current) watch?.observe(panel.current);
    return () => { watch?.disconnect(); root.style.removeProperty("--voice-panel-space"); };
  }, []);
  useEffect(() => { log.current?.scrollTo({ top: log.current.scrollHeight }); }, [transcript]);

  const statusText = {
    idle: "Not connected.",
    connecting: "Connecting...",
    listening: micMuted ? "Microphone off. Type a question below." : "Listening. Speak any time.",
    speaking: "Speaking. Talk to interrupt.",
    ended: "The conversation has ended.",
    error: error || "The voice guide stopped unexpectedly.",
  }[status];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (assistant.sendText(draft)) setDraft("");
  }

  return <section ref={panel} className="voice-assistant" role="region" aria-labelledby="voice-assistant-title">
    <header className="voice-assistant__header">
      <span className={`voice-assistant__orb voice-assistant__orb--${status}${micMuted ? " is-muted" : ""}`} aria-hidden="true"
        style={status === "listening" && !micMuted ? { boxShadow: `0 0 0 ${Math.round(Math.min(1, level * 4) * 10)}px var(--accent-bg)` } : undefined}><Icon name={status === "speaking" ? "volume" : "mic"} size={22} /></span>
      <div className="voice-assistant__heading">
        <h2 id="voice-assistant-title" ref={title} tabIndex={-1}>Voice guide</h2>
        <p className={status === "error" ? "voice-assistant__status is-error" : "voice-assistant__status"} role="status">{statusText}</p>
      </div>
      <button className="voice-assistant__icon-btn" aria-label="Close voice guide" onClick={onClose}><Icon name="close" /></button>
    </header>

    {micSilent && status === "listening" && !micMuted && <p className="voice-assistant__warning" role="alert">
      We cannot hear your microphone. Check which microphone your computer is using in its sound settings, or type your question below.</p>}

    <ol className="voice-assistant__log" ref={log} aria-label="Conversation">
      {transcript.length === 0 && <li className="voice-assistant__hint">Ask what a page does, how to use it, or say where you want to go. For example: "What do the sounds mean?"</li>}
      {transcript.map(entry => <li key={entry.id} className={`voice-assistant__line voice-assistant__line--${entry.role}`}>
        <span className="sr-only">{entry.role === "user" ? "You said:" : "Guide said:"} </span>{entry.text}
      </li>)}
    </ol>

    <form className="voice-assistant__type" onSubmit={submit}>
      <label className="sr-only" htmlFor="voice-assistant-input">Type a question instead</label>
      <input id="voice-assistant-input" className="voice-assistant__input" value={draft} maxLength={500} autoComplete="off"
        placeholder="Type a question instead" disabled={!active || status === "connecting"} onChange={event => setDraft(event.target.value)} />
      <button className="voice-assistant__icon-btn" type="submit" aria-label="Send" disabled={!active || !draft.trim()}><Icon name="send" /></button>
    </form>

    <div className="voice-assistant__actions">
      {active
        ? <>
          <button className="voice-assistant__btn" aria-pressed={micMuted} disabled={status === "connecting"} onClick={assistant.toggleMute}>
            <Icon name="mic" size={18} />{micMuted ? "Turn microphone on" : "Turn microphone off"}
          </button>
          <button className="voice-assistant__btn voice-assistant__btn--text" onClick={assistant.stop}><Icon name="stop" size={18} />End conversation</button>
        </>
        : <button className="voice-assistant__btn voice-assistant__btn--filled" onClick={() => void assistant.start()}><Icon name="mic" size={18} />Start talking</button>}
    </div>

    <p className="voice-assistant__note">While this is open, your voice and what you type are sent to Google's Gemini cloud AI to answer you. This app saves none of it.</p>
  </section>;
}
