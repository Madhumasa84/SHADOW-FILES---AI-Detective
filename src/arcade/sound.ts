// Synthesized Midnight Noir Web Audio SFX for all collection games (100% local, zero external assets)

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume().catch(() => {});
  }
  return sharedCtx;
}

export type ArcadeSfxKind =
  | 'tap'
  | 'drop'
  | 'flip'
  | 'capture'
  | 'hit'
  | 'miss'
  | 'explosion'
  | 'powerup'
  | 'hint'
  | 'error'
  | 'win'
  | 'lose';

export function playArcadeSfx(muted: boolean, kind: ArcadeSfxKind): void {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;
    const playTone = (
      freq: number,
      endFreq: number,
      dur: number,
      type: OscillatorType,
      vol: number,
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + delay);
      if (endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(24, endFreq), now + delay + dur);
      }
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(vol, now + delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + dur + 0.015);
    };

    switch (kind) {
      case 'tap':
        playTone(420, 310, 0.055, 'triangle', 0.06);
        break;
      case 'drop':
        playTone(260, 120, 0.11, 'sine', 0.09);
        playTone(520, 440, 0.05, 'triangle', 0.04, 0.04);
        break;
      case 'flip':
        playTone(340, 560, 0.08, 'triangle', 0.06);
        break;
      case 'capture':
        playTone(300, 140, 0.12, 'sawtooth', 0.06);
        playTone(540, 680, 0.08, 'triangle', 0.05, 0.03);
        break;
      case 'hit':
        playTone(520, 760, 0.08, 'triangle', 0.075);
        break;
      case 'miss':
        playTone(200, 130, 0.1, 'sine', 0.05);
        break;
      case 'explosion':
        playTone(150, 38, 0.28, 'sawtooth', 0.09);
        playTone(90, 30, 0.32, 'triangle', 0.08, 0.02);
        break;
      case 'powerup':
        playTone(440, 660, 0.09, 'triangle', 0.07);
        playTone(660, 880, 0.12, 'triangle', 0.07, 0.07);
        break;
      case 'hint':
        playTone(587, 880, 0.11, 'sine', 0.055);
        break;
      case 'error':
        playTone(190, 140, 0.13, 'sawtooth', 0.055);
        break;
      case 'win':
        playTone(523.25, 523.25, 0.12, 'triangle', 0.075, 0);
        playTone(659.25, 659.25, 0.12, 'triangle', 0.075, 0.09);
        playTone(783.99, 1046.5, 0.24, 'triangle', 0.085, 0.18);
        break;
      case 'lose':
        playTone(349.23, 311.13, 0.16, 'triangle', 0.065, 0);
        playTone(293.66, 220, 0.28, 'sine', 0.07, 0.14);
        break;
    }
  } catch {
    // Ignore autoplay restrictions
  }
}
