import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent } from "react";
import { Button, IconButton, Notice } from "./components";
import type { useVoiceAssistant } from "./hooks/useVoiceAssistant";
import "./styles/assistant.css";

type Assistant = ReturnType<typeof useVoiceAssistant>;

// Material Symbols paths (Apache 2.0), drawn on a 24 x 24 grid.
// Switch to the shared src/components/Icon.tsx once T50 has merged.
const icons = {
  mic: "M9.875 13.125Q9 12.25 9 11V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 1.25-.875 2.125T12 14t-2.125-.875M11 21v-3.075q-2.6-.35-4.3-2.325T5 11h2q0 2.075 1.463 3.538T12 16t3.538-1.463T17 11h2q0 2.625-1.7 4.6T13 17.925V21z",
  micOff: "M17.75 14.95L16.3 13.5q.35-.575.525-1.2T17 11h2q0 1.1-.325 2.088t-.925 1.862m-2.95-3L9 6.15V5q0-1.25.875-2.125T12 2t2.125.875T15 5v6q0 .275-.062.5t-.138.45M11 21v-3.1q-2.6-.35-4.3-2.312T5 11h2q0 2.075 1.463 3.538T12 16q.85 0 1.613-.262T15 15l1.425 1.425q-.725.575-1.588.963T13 17.9V21zm8.8 1.6L1.4 4.2l1.4-1.4l18.4 18.4z",
  volume: "M14 20.725v-2.05q2.25-.65 3.625-2.5t1.375-4.2t-1.375-4.2T14 5.275v-2.05q3.1.7 5.05 3.138T21 11.975t-1.95 5.613T14 20.725M3 15V9h4l5-5v16l-5-5zm11 1V7.95q1.175.55 1.838 1.65T16.5 12q0 1.275-.663 2.363T14 16",
  close: "M6.4 19L5 17.6l5.6-5.6L5 6.4L6.4 5l5.6 5.6L17.6 5L19 6.4L13.4 12l5.6 5.6l-1.4 1.4l-5.6-5.6z",
  send: "M3 20v-6l8-2l-8-2V4l19 8z",
  stop: "M6 18V6h12v12z",
};

function Icon({ name, size = 24 }: { name: keyof typeof icons; size?: number }) {
  return <svg className="voice-assistant__icon" width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d={icons[name]} /></svg>;
}

/** Sample questions shown as chips before the first message. Each one is sent as if typed. */
const SUGGESTIONS = ["What do the sounds mean?", "How do I use the Listen page?", "Where does the data come from?"];

export default function VoiceAssistant({ assistant, onClose }: { assistant: Assistant; onClose: () => void }) {
  const { status, transcript, error, micMuted, level, micSilent } = assistant;
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const panel = useRef<HTMLElement>(null);
  const active = status === "connecting" || status === "listening" || status === "speaking";
  const connected = status === "listening" || status === "speaking";
  const canType = active && status !== "connecting";

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

  // Escape closes the panel from anywhere inside it. App puts focus back on the button that opened it.
  function onKeyDown(event: KeyboardEvent) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      onClose();
    }
  }

  const orbClass = ["voice-assistant__orb", `voice-assistant__orb--${status}`, micMuted && active && "is-muted"].filter(Boolean).join(" ");
  const showMeter = status === "listening" && !micMuted;

  return <section ref={panel} className="voice-assistant" role="region" aria-labelledby="voice-assistant-title" onKeyDown={onKeyDown}>
    <span className="voice-assistant__handle" aria-hidden="true" />
    <header className="voice-assistant__header">
      <span className={orbClass} aria-hidden="true">
        <Icon name={status === "speaking" ? "volume" : micMuted && active ? "micOff" : "mic"} size={28} />
      </span>
      <div className="voice-assistant__heading">
        <h2 id="voice-assistant-title" ref={title} tabIndex={-1}>Voice guide</h2>
        <p className={status === "error" ? "voice-assistant__status is-error" : "voice-assistant__status"} role="status">{statusText}</p>
        {showMeter && <span className="voice-assistant__meter" aria-hidden="true"
          style={{ "--level": Math.min(1, level * 4) } as CSSProperties}><span className="voice-assistant__meter-fill" /></span>}
      </div>
      <IconButton aria-label="Close voice guide" onClick={onClose}><Icon name="close" /></IconButton>
    </header>

    {micSilent && status === "listening" && !micMuted && <Notice variant="warning">
      We cannot hear your microphone. Check which microphone your computer is using in its sound settings, or type your question below.
    </Notice>}

    <ol className="voice-assistant__log" ref={log} aria-label="Conversation">
      {transcript.length === 0 && <li className="voice-assistant__hint">Ask what a page does, how to use it, or say where you want to go. For example: "What do the sounds mean?"</li>}
      {transcript.map(entry => <li key={entry.id} className={`voice-assistant__line voice-assistant__line--${entry.role}`}>
        <span className="ui-visually-hidden">{entry.role === "user" ? "You said:" : "Guide said:"} </span>{entry.text}
      </li>)}
    </ol>

    {connected && transcript.length === 0 && <ul className="voice-assistant__chips" aria-label="Suggested questions">
      {SUGGESTIONS.map(question => <li key={question}>
        <button type="button" className="voice-assistant__chip" onClick={() => assistant.sendText(question)}>{question}</button>
      </li>)}
    </ul>}

    <form className="voice-assistant__type" onSubmit={submit}>
      <label className="ui-visually-hidden" htmlFor="voice-assistant-input">Type a question instead</label>
      <input id="voice-assistant-input" className="voice-assistant__input" value={draft} maxLength={500} autoComplete="off"
        placeholder="Type a question instead" disabled={!canType} aria-describedby={canType ? undefined : "voice-assistant-input-why"}
        onChange={event => setDraft(event.target.value)} />
      <IconButton aria-label="Send" type="submit" variant="filled" disabled={!active || !draft.trim()}><Icon name="send" /></IconButton>
    </form>
    {!canType && <p id="voice-assistant-input-why" className="voice-assistant__why">
      {status === "connecting" ? "You can type once the guide has connected." : "Start talking to type a question too."}
    </p>}

    <div className="voice-assistant__actions">
      {active
        ? <>
          {/* A fixed label with aria-pressed: "Mute microphone, pressed" means it is muted. */}
          <Button variant="tonal" pressed={micMuted} disabled={status === "connecting"} onClick={assistant.toggleMute}>
            <Icon name={micMuted ? "micOff" : "mic"} size={20} />Mute microphone
          </Button>
          <Button variant="text" onClick={assistant.stop}><Icon name="stop" size={20} />End conversation</Button>
        </>
        : <Button variant="filled" onClick={() => void assistant.start()}>
          <Icon name="mic" size={20} />{status === "error" ? "Try again" : "Start talking"}
        </Button>}
    </div>

    <p className="voice-assistant__note">
      While this is open, your voice and what you type are sent to Google's Gemini cloud AI to answer you. This app saves none of it.
      {" "}<a href="#about">How we use AI</a>
    </p>
  </section>;
}
