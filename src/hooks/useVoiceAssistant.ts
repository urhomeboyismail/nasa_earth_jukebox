// Live voice conversation with the app guide, over /api/v1/assistant/live.
// Ported from the FinAssist voice assistant.
//
// The server holds the Gemini session and runs every tool. The only thing it can ask
// this page to do is navigate to a page. Every action is re-validated here, because it
// arrives from a model over a WebSocket.

import { useCallback, useEffect, useRef, useState } from "react";
import { frameLevel, SpeechPlayer, startRecorder, type Recorder } from "../assistant/audio";
import { currentContext, subscribeContext, type ContextUpdate } from "../assistant/context";
import { socketUrl } from "../config";
import { isPage, type Page } from "../pages";

export type AssistantStatus = "idle" | "connecting" | "listening" | "speaking" | "ended" | "error";
export type TranscriptEntry = { id: number; role: "user" | "assistant"; text: string };
export type AssistantAction = { action: "navigate"; page: Page };

/** The action in a server message, or null when it is unknown or unusable. Never guesses. */
export function toAssistantAction(message: Record<string, unknown>): AssistantAction | null {
  if (message.action === "navigate" && typeof message.page === "string" && isPage(message.page)) return { action: "navigate", page: message.page };
  return null;
}

type Options = {
  language: string;
  page: string;
  onAction: (action: AssistantAction) => void;
};

const MAX_ENTRIES = 40;
const MIC_HEARD_LEVEL = 0.02;
/** 5 seconds of 50 ms frames. */
const SILENT_WARNING_FRAMES = 100;
/** Screens republish on every keystroke; forward at most this often per screen. */
const CONTEXT_DEBOUNCE_MS = 400;

const SOCKET_PATH = "/api/v1/assistant/live";

export function micErrorMessage(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow the microphone for this site, then try again.";
  if (name === "NotFoundError") return "No microphone was found on this device.";
  return "The microphone could not be started.";
}

export function useVoiceAssistant({ language, page, onAction }: Options) {
  const [status, setStatus] = useState<AssistantStatus>("idle");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState("");
  const [micMuted, setMicMuted] = useState(false);
  const [level, setLevel] = useState(0);
  const [micSilent, setMicSilent] = useState(false);
  const socket = useRef<WebSocket | null>(null);
  const recorder = useRef<Recorder | null>(null);
  const player = useRef<SpeechPlayer | null>(null);
  const openEntry = useRef<{ role: TranscriptEntry["role"]; id: number } | null>(null);
  const nextId = useRef(0);
  const actionRef = useRef(onAction);
  const pageRef = useRef(page);
  useEffect(() => {
    actionRef.current = onAction;
    pageRef.current = page;
  });

  const entries = useRef<TranscriptEntry[]>([]);

  // Built outside the state updater, which StrictMode runs twice.
  const addTranscript = useCallback((role: TranscriptEntry["role"], text: string) => {
    const open = openEntry.current;
    if (open && open.role === role) {
      entries.current = entries.current.map(entry => entry.id === open.id ? { ...entry, text: entry.text + text } : entry);
    } else {
      const id = nextId.current++;
      openEntry.current = { role, id };
      entries.current = [...entries.current, { id, role, text: text.trimStart() }].slice(-MAX_ENTRIES);
    }
    setTranscript(entries.current);
  }, []);

  const stopContext = useRef<(() => void) | null>(null);

  const forwardContext = useCallback((ws: WebSocket) => {
    const send = (update: ContextUpdate) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "context", ...update })); };
    currentContext().forEach(send);
    const pending = new Map<string, { update: ContextUpdate; timer: number }>();
    const unsubscribe = subscribeContext(update => {
      const waiting = pending.get(update.key);
      if (waiting) window.clearTimeout(waiting.timer);
      const merged = { ...update, announce: update.announce ?? waiting?.update.announce };
      pending.set(update.key, { update: merged, timer: window.setTimeout(() => { pending.delete(update.key); send(merged); }, CONTEXT_DEBOUNCE_MS) });
    });
    stopContext.current = () => { unsubscribe(); pending.forEach(item => window.clearTimeout(item.timer)); };
  }, []);

  const teardown = useCallback(() => {
    stopContext.current?.();
    stopContext.current = null;
    recorder.current?.stop();
    recorder.current = null;
    player.current?.close();
    player.current = null;
    const ws = socket.current;
    socket.current = null;
    if (ws) {
      ws.onmessage = ws.onclose = ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "stop" }));
      ws.close();
    }
    openEntry.current = null;
  }, []);

  const fail = useCallback((message: string) => {
    teardown();
    setError(message);
    setStatus("error");
  }, [teardown]);

  // Must be called from a click: browsers only allow audio and microphone after a user gesture.
  const start = useCallback(() => {
    teardown();
    setError("");
    setMicMuted(false);
    setStatus("connecting");
    setLevel(0);
    setMicSilent(false);
    // Everything that needs the click's user activation happens before the first await.
    const speech = new SpeechPlayer();
    player.current = speech;
    speech.onIdle = () => setStatus(current => current === "speaking" ? "listening" : current);
    void speech.resume();

    const ws = new WebSocket(socketUrl(SOCKET_PATH));
    ws.binaryType = "arraybuffer";
    socket.current = ws;
    let ready = false;
    let quietFrames = 0;
    let heard = false;
    const recorderReady = startRecorder(frame => {
      if (!ready) return;
      // Browser echo cancellation misses Web Audio playback, so the guide would hear itself and cut itself off.
      if (player.current?.busy) { setLevel(0); return; }
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
      const peak = frameLevel(frame);
      setLevel(peak);
      if (peak > MIC_HEARD_LEVEL) { if (!heard) { heard = true; setMicSilent(false); } }
      else if (!heard && ++quietFrames === SILENT_WARNING_FRAMES) setMicSilent(true);
    }).then(
      created => { if (socket.current === ws) { recorder.current = created; return true; } created.stop(); return false; },
      cause => { if (socket.current === ws) fail(micErrorMessage(cause)); return false; },
    );
    ws.onopen = () => ws.send(JSON.stringify({ type: "start", language, page: pageRef.current }));
    ws.onerror = () => fail("The voice guide could not connect. Check that the service is running.");
    ws.onclose = () => {
      if (socket.current !== ws) return;
      teardown();
      setStatus(current => current === "error" ? current : "ended");
    };
    ws.onmessage = async event => {
      if (event.data instanceof ArrayBuffer) {
        player.current?.play(event.data);
        setStatus(current => current === "listening" ? "speaking" : current);
        return;
      }
      let message: Record<string, unknown>;
      try { message = JSON.parse(event.data as string); } catch { return; }
      switch (message.type) {
        case "ready":
          if (await recorderReady && socket.current === ws) {
            ready = true;
            forwardContext(ws);
            setStatus("listening");
          }
          break;
        case "transcript":
          if ((message.role === "user" || message.role === "assistant") && typeof message.text === "string") addTranscript(message.role, message.text);
          break;
        case "interrupted":
          player.current?.flush();
          openEntry.current = null;
          break;
        case "turn_complete":
          openEntry.current = null;
          break;
        case "action":
          {
            const action = toAssistantAction(message);
            if (action) actionRef.current(action);
          }
          break;
        case "error":
          fail(typeof message.message === "string" ? message.message : "The voice guide stopped unexpectedly.");
          break;
        case "ended":
          teardown();
          setStatus("ended");
          break;
      }
    };
  }, [language, teardown, fail, addTranscript, forwardContext]);

  const stop = useCallback(() => { teardown(); setStatus("idle"); }, [teardown]);

  const toggleMute = useCallback(() => {
    setMicMuted(current => {
      const next = !current;
      recorder.current?.setMuted(next);
      if (next && socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "mic_off" }));
      return next;
    });
  }, []);

  const sendText = useCallback((text: string) => {
    const ws = socket.current;
    if (!text.trim() || ws?.readyState !== WebSocket.OPEN) return false;
    openEntry.current = null;
    addTranscript("user", text.trim());
    openEntry.current = null;
    ws.send(JSON.stringify({ type: "text", text: text.trim() }));
    return true;
  }, [addTranscript]);

  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "page", page }));
  }, [page]);

  useEffect(() => teardown, [teardown]);

  return { status, transcript, error, micMuted, level, micSilent, start, stop, toggleMute, sendText };
}
