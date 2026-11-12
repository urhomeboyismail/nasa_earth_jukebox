import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button, ButtonGroup, IconButton, Notice } from "./components";
import type { AnswerLength } from "./assistant/consent";
import { Echo, type MascotPose } from "./components/Mascot";
import { NO_RETRY_CODES, type useVoiceAssistant } from "./hooks/useVoiceAssistant";
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

const ANSWER_LENGTHS: readonly { value: AnswerLength; label: string }[] = [{ value: "short", label: "Short" }, { value: "detailed", label: "Detailed" }];

export default function VoiceAssistant({ assistant, onClose }: { assistant: Assistant; onClose: () => void }) {
  const {
    status, transcript, error, errorCode, endedMessage, actions, micMuted, micSilent, micNote, micReady, levelRef,
    consent, consentAsked, talkMode, talking, answerLength, limitWarning, waking,
  } = assistant;
  const [draft, setDraft] = useState("");
  const log = useRef<HTMLOListElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const consentTitle = useRef<HTMLHeadingElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLElement>(null);
  const active = status === "connecting" || status === "listening" || status === "speaking";
  const connected = status === "listening" || status === "speaking";
  const canType = active && status !== "connecting";
  const latestAction = actions[actions.length - 1];
  const showConsent = consent === null && consentAsked;
  /** The browser is sending the listener's voice right now. */
  const micSending = micReady && (talkMode === "open" ? !micMuted : talking);
  const showMeter = status === "listening" && micSending;

  useEffect(() => { title.current?.focus(); }, []);
  // The card replaces the button that asked for it, so focus moves to the card's heading.
  useEffect(() => { if (showConsent) consentTitle.current?.focus(); }, [showConsent]);
  // The meter follows the mic level without re-rendering anything: the hook writes a ref, this reads it once a frame.
  // It shows the listener's own sound, not an animation, so it keeps updating under reduced motion.
  useEffect(() => {
    if (!showMeter) return;
    let frame = 0;
    const draw = () => {
      meter.current?.style.setProperty("--level", String(Math.min(1, levelRef.current * 4)));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [showMeter, levelRef]);
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
    listening: !micReady ? "Ready. Type a question below."
      : talkMode === "push" ? (talking ? "Listening. Press Talk again when you are done." : "Press Talk to speak, or type a question below.")
      : micMuted ? "Microphone off. Type a question below." : "Listening. Speak any time.",
    speaking: micSending ? "Speaking. Talk to interrupt." : "Speaking.",
    ended: endedMessage || "The conversation has ended.",
    error: error || "The voice guide stopped unexpectedly.",
  }[status];

  // The Undo button goes away once pressed (nothing undoes an undo), so focus moves to the panel title instead of being lost.
  function undo() {
    assistant.undo();
    title.current?.focus();
  }

  // The card and the warning go away once answered, so focus moves to the panel title instead of being lost.
  function choose(choice: "mic" | "text") {
    assistant.chooseConsent(choice);
    title.current?.focus();
  }

  function continueSession() {
    assistant.continueSession();
    title.current?.focus();
  }

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

  const micOff = connected && !micSending;
  const orbClass = ["voice-assistant__orb", `voice-assistant__orb--${status}`, micOff && "is-muted"].filter(Boolean).join(" ");
  const pose: MascotPose = status === "speaking" ? "talking" : status === "connecting" ? "thinking" : status === "listening" && micSending ? "listening" : "idle";

  return <>
  {/* The mascot stands beside the panel on tablet and desktop. Decoration only: the status line says the same in words. */}
  <Echo className={`voice-mascot voice-mascot--${pose}`} pose={pose} />
  <section ref={panel} className="voice-assistant" role="region" aria-labelledby="voice-assistant-title" onKeyDown={onKeyDown}>
    <span className="voice-assistant__handle" aria-hidden="true" />
    <header className="voice-assistant__header">
      <span className={orbClass} aria-hidden="true">
        <Icon name={status === "speaking" ? "volume" : micOff ? "micOff" : "mic"} size={28} />
      </span>
      <div className="voice-assistant__heading">
        <h2 id="voice-assistant-title" ref={title} tabIndex={-1}>Voice guide</h2>
        <p className={status === "error" ? "voice-assistant__status is-error" : "voice-assistant__status"} role="status">{statusText}</p>
        {showMeter && <span ref={meter} className="voice-assistant__meter" aria-hidden="true"><span className="voice-assistant__meter-fill" /></span>}
      </div>
      <IconButton aria-label="Close voice guide" onClick={onClose}><Icon name="close" /></IconButton>
    </header>

    {status === "connecting" && waking && <p className="voice-assistant__why">Waking Echo up, this can take a minute.</p>}

    {showConsent && <section className="voice-assistant__consent" role="region" aria-labelledby="voice-consent-title">
      <h3 id="voice-consent-title" ref={consentTitle} tabIndex={-1}>Use your microphone?</h3>
      <p>
        Echo can hear you through your microphone. While the conversation is open, your voice and what you type are sent
        to Google's Gemini to answer you. This app saves none of it.
      </p>
      {/* Neither choice is the default: the same variant and size, side by side. */}
      <div className="voice-assistant__consent-actions">
        <Button variant="tonal" onClick={() => choose("mic")}><Icon name="mic" size={20} />Allow microphone</Button>
        <Button variant="tonal" onClick={() => choose("text")}><Icon name="send" size={20} />Use text only</Button>
      </div>
      <label className="ui-choice">
        <input type="checkbox" checked={talkMode === "open"} aria-describedby="voice-consent-open-why"
          onChange={event => assistant.setTalkMode(event.target.checked ? "open" : "push")} />
        <span>Keep the microphone open</span>
      </label>
      <p id="voice-consent-open-why" className="voice-assistant__why">
        Off: press Talk each time you speak. On: Echo listens until you mute it, and turns the microphone off after 60 seconds with no speech.
      </p>
    </section>}

    {limitWarning && <Notice variant="warning" action={{ label: "Continue", onClick: continueSession }}>
      Echo will stop in 1 minute. Continue?
    </Notice>}

    {micNote && active && <Notice>{micNote}</Notice>}

    {micSilent && status === "listening" && micSending && <Notice variant="warning">
      We cannot hear your microphone. Check which microphone your computer is using in its sound settings, or type your question below.
    </Notice>}

    <ol className="voice-assistant__log" ref={log} aria-label="Conversation">
      {transcript.length === 0 && <li className="voice-assistant__hint">Ask what a page does, how to use it, or say where you want to go. For example: "What do the sounds mean?"</li>}
      {transcript.map(entry => <li key={entry.id} className={`voice-assistant__line voice-assistant__line--${entry.role}`}>
        <span className="ui-visually-hidden">{entry.role === "user" ? "You said:" : "Guide said:"} </span>{entry.text}
      </li>)}
    </ol>

    {/* Says what the guide just did, once, without moving focus. */}
    <p className="ui-visually-hidden" aria-live="polite">{latestAction?.label}</p>
    {actions.length > 0 && <ul className="voice-assistant__did" aria-label="Echo did">
      {actions.map(item => <li key={item.id}>
        <span>{item.label}</span>
        {item === latestAction && item.inverse && <Button variant="text" className="voice-assistant__undo" aria-label={`Undo: ${item.label}`} onClick={undo}>Undo</Button>}
      </li>)}
    </ul>}

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
      {status === "connecting" ? "You can type once the guide has connected." : consent === "text" ? "Press Start typing to ask a question." : "Start talking to type a question too."}
    </p>}

    <div className="voice-assistant__actions">
      {active
        ? <>
          {/* Fixed labels with aria-pressed: "Talk, pressed" means the mic is sending; "Mute microphone, pressed" means it is muted. */}
          {micReady && talkMode === "push" && <Button variant="tonal" pressed={talking} disabled={status === "connecting"} onClick={assistant.toggleTalk}>
            <Icon name={talking ? "mic" : "micOff"} size={20} />Talk
          </Button>}
          {micReady && talkMode === "open" && <Button variant="tonal" pressed={micMuted} disabled={status === "connecting"} onClick={assistant.toggleMute}>
            <Icon name={micMuted ? "micOff" : "mic"} size={20} />Mute microphone
          </Button>}
          {status === "speaking" && <Button variant="tonal" onClick={assistant.stopSpeaking}><Icon name="volume" size={20} />Stop talking</Button>}
          <Button variant="text" onClick={assistant.stop}><Icon name="stop" size={20} />End conversation</Button>
        </>
        : (status === "error" && NO_RETRY_CODES.includes(errorCode)) || showConsent ? null
        : <Button variant="filled" onClick={() => void assistant.start()}>
          <Icon name={consent === "text" ? "send" : "mic"} size={20} />{status === "error" ? "Try again" : consent === "text" ? "Start typing" : "Start talking"}
        </Button>}
      {consent !== null && <Button variant="text" onClick={assistant.clearConsent}>Change microphone choice</Button>}
    </div>

    <ButtonGroup type="connected" legend="Answers" name="voice-answer-length" options={ANSWER_LENGTHS} value={answerLength}
      onChange={assistant.setAnswerLength} />
    {active && <p className="voice-assistant__why">A change to Answers applies to the next conversation.</p>}

    <p className="voice-assistant__note">
      While this is open, your voice and what you type are sent to Google's Gemini cloud AI to answer you. This app saves none of it.
      {" "}<a href="#about">How we use AI</a>
    </p>
  </section>
  </>;
}
