/**
 * Overload's shared feedback language: one Web Audio context (unlocked on
 * user gestures, iOS-safe) used by the rest-timer chime and the set-complete
 * tick. Sound is enhancement only — every path fails silent.
 */
const MUTE_KEY = "overload_sound_muted";

let audioCtx: AudioContext | null = null;

/** Call from any user gesture. Cheap when already running. */
export function unlockAudio() {
  // Re-run on every tap: iOS suspends the context when the app is
  // backgrounded or the phone locks, and only a gesture may resume it.
  if (audioCtx?.state === "running") return;
  try {
    const nav = navigator as Navigator & { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "ambient"; // mix, don't pause music
    audioCtx ??= new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch {
    /* no audio available */
  }
}

export function getAudioCtx(): AudioContext | null {
  return audioCtx;
}

export function isSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setSoundMuted(muted: boolean) {
  try {
    if (muted) localStorage.setItem(MUTE_KEY, "1");
    else localStorage.removeItem(MUTE_KEY);
  } catch {
    /* private mode — setting just doesn't persist */
  }
}

/** Soft two-partial "tick": ~140 ms, quiet, rising a fifth. */
function playTone(ctx: AudioContext) {
  const t = ctx.currentTime;
  [988, 1480].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    const start = t + i * 0.055;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(i === 0 ? 0.09 : 0.06, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.13);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.14);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
  });
}

/**
 * The "done" cue for a successfully ticked set: light haptic + tiny chime.
 * Must be called from the tap handler itself (gesture requirement).
 */
export function playCompleteFeedback() {
  navigator.vibrate?.(15);
  if (isSoundMuted()) return;
  try {
    unlockAudio();
    const ctx = audioCtx;
    if (!ctx) return;
    if (ctx.state === "running") playTone(ctx);
    else void ctx.resume().then(() => ctx.state === "running" && playTone(ctx)).catch(() => {});
  } catch {
    /* silent */
  }
}
