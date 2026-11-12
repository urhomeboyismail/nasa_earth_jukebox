// What the listener chose for the voice guide (V02): whether Echo may use the microphone, push-to-talk or an open mic,
// and how long the answers are. Remembered on this device. Storage can be blocked (private windows), so every access is
// guarded, the same rule as `src/audio/style.ts`: a read that fails is "not decided" (or the default), a write that
// fails stores nothing.

/** "mic": the microphone may be used. "text": typing only. */
export type MicConsent = "mic" | "text";
/** "push": frames are sent only while Talk is pressed. "open": the mic stays open until muted or 60 s of quiet. */
export type MicTalk = "push" | "open";
export type AnswerLength = "short" | "detailed";

export const MIC_CONSENT_KEY = "earth-jukebox:mic-consent";
export const MIC_TALK_KEY = "earth-jukebox:mic-talk";
export const ANSWER_LENGTH_KEY = "earth-jukebox:answer-length";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not remembered, but the choice still holds for this visit.
  }
}

/** The stored choice, or null when the listener has not decided (or storage cannot be read). */
export function readMicConsent(): MicConsent | null {
  const stored = read(MIC_CONSENT_KEY);
  return stored === "mic" || stored === "text" ? stored : null;
}

/** Stores the choice; null forgets it, so the consent card shows again. */
export function saveMicConsent(choice: MicConsent | null) {
  write(MIC_CONSENT_KEY, choice);
}

/** Push-to-talk unless "open" was chosen. */
export function readMicTalk(): MicTalk {
  return read(MIC_TALK_KEY) === "open" ? "open" : "push";
}

export function saveMicTalk(mode: MicTalk) {
  write(MIC_TALK_KEY, mode);
}

/** Short unless "detailed" was chosen. */
export function readAnswerLength(): AnswerLength {
  return read(ANSWER_LENGTH_KEY) === "detailed" ? "detailed" : "short";
}

export function saveAnswerLength(length: AnswerLength) {
  write(ANSWER_LENGTH_KEY, length);
}
