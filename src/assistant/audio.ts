// Browser audio for the voice assistant: microphone -> 16 kHz PCM16 frames, and
// 24 kHz PCM16 speech -> speakers. Gemini Live uses these rates in each direction.

export const INPUT_RATE = 16_000;
export const OUTPUT_RATE = 24_000;
/** 50 ms of input audio per frame. */
const FRAME_SAMPLES = 800;

// Inlined so no separate asset has to be served. It resamples from the context rate
// (often 44.1 or 48 kHz, which the browser picks) down to 16 kHz by linear interpolation.
const RECORDER_WORKLET = `
class PcmRecorder extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ratio = sampleRate / options.processorOptions.targetRate;
    this.frame = new Int16Array(options.processorOptions.frameSamples);
    this.filled = 0;
    this.pos = 0;
    this.last = 0;
  }
  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;
    let pos = this.pos;
    while (pos < input.length) {
      const i = Math.floor(pos);
      const frac = pos - i;
      const a = i === 0 ? this.last : input[i - 1];
      const b = input[i];
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      this.frame[this.filled++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.filled === this.frame.length) {
        this.port.postMessage(this.frame.buffer.slice(0));
        this.filled = 0;
      }
      pos += this.ratio;
    }
    this.pos = pos - input.length;
    this.last = input[input.length - 1];
    return true;
  }
}
registerProcessor("pcm-recorder", PcmRecorder);
`;

export type Recorder = { stop: () => void; setMuted: (muted: boolean) => void };

/** Peak level of a PCM16 frame, 0 to 1. */
export function frameLevel(pcm: ArrayBuffer): number {
  const samples = new Int16Array(pcm);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  return peak / 0x8000;
}

/** Call from a click handler: the AudioContext is created before the first await, inside the gesture. */
export async function startRecorder(onFrame: (pcm: ArrayBuffer) => void): Promise<Recorder> {
  const context = new AudioContext();
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch (cause) {
    void context.close();
    throw cause;
  }
  const url = URL.createObjectURL(new Blob([RECORDER_WORKLET], { type: "application/javascript" }));
  try {
    await context.audioWorklet.addModule(url);
  } finally {
    URL.revokeObjectURL(url);
  }
  const source = context.createMediaStreamSource(stream);
  const node = new AudioWorkletNode(context, "pcm-recorder", {
    processorOptions: { targetRate: INPUT_RATE, frameSamples: FRAME_SAMPLES },
  });
  let muted = false;
  node.port.onmessage = event => { if (!muted) onFrame(event.data as ArrayBuffer); };
  // The worklet must be pulled by the graph to run; a muted gain keeps it silent.
  const sink = context.createGain();
  sink.gain.value = 0;
  source.connect(node).connect(sink).connect(context.destination);
  if (context.state === "suspended") await context.resume();
  return {
    setMuted(next) {
      muted = next;
      stream.getAudioTracks().forEach(track => { track.enabled = !next; });
    },
    stop() {
      node.port.onmessage = null;
      stream.getTracks().forEach(track => track.stop());
      void context.close();
    },
  };
}

/** Room echo lingers after playback stops, and chunks can arrive with small gaps. */
const ECHO_TAIL_MS = 500;

/** Plays streamed PCM16 chunks back to back, and can be cut off instantly on barge-in. */
export class SpeechPlayer {
  private context = new AudioContext({ sampleRate: OUTPUT_RATE });
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private quietAt = 0;
  onIdle: (() => void) | null = null;

  async resume() {
    try {
      if (this.context.state === "suspended") await this.context.resume();
    } catch { /* closed before resume finished */ }
  }

  get playing() {
    return this.sources.size > 0;
  }

  /** True while speech is audible, so the microphone would pick it up. */
  get busy() {
    return this.sources.size > 0 || performance.now() < this.quietAt;
  }

  play(chunk: ArrayBuffer) {
    const samples = new Int16Array(chunk, 0, Math.floor(chunk.byteLength / 2));
    if (!samples.length) return;
    const buffer = this.context.createBuffer(1, samples.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) channel[i] = samples[i] / 0x8000;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    // A small lead absorbs network jitter; after a gap, restart from "now".
    const now = this.context.currentTime;
    if (this.nextStart < now + 0.02) this.nextStart = now + 0.06;
    source.start(this.nextStart);
    this.nextStart += buffer.duration;
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      if (!this.sources.size) {
        this.quietAt = performance.now() + ECHO_TAIL_MS;
        this.onIdle?.();
      }
    };
  }

  flush() {
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* already stopped */ }
    }
    this.sources.clear();
    this.nextStart = 0;
    this.quietAt = 0;
    this.onIdle?.();
  }

  close() {
    this.flush();
    this.onIdle = null;
    this.context.close().catch(() => {});
  }
}
