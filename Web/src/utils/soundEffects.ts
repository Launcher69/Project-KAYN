let audioCtx: AudioContext | null = null;
let ambientOsc1: OscillatorNode | null = null;
let ambientOsc2: OscillatorNode | null = null;
let ambientGain: GainNode | null = null;
let isAudioActive = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type: 'click' | 'hover' | 'modal' | 'success' | 'woosh') {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.05);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'hover') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.02, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
      osc.start(now);
      osc.stop(now + 0.03);
    } else if (type === 'modal') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.12);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now);
      osc.stop(now + 0.15);
    } else if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.08);
      osc.frequency.setValueAtTime(783.99, now + 0.16);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // Ignore audio errors on un-interacted browsers
  }
}

export function toggleAmbientAtmosphere(): boolean {
  try {
    const ctx = getAudioContext();
    if (!ctx) return false;

    if (isAudioActive) {
      if (ambientGain && ctx) {
        ambientGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1);
        setTimeout(() => {
          ambientOsc1?.stop();
          ambientOsc2?.stop();
          ambientOsc1?.disconnect();
          ambientOsc2?.disconnect();
          ambientGain?.disconnect();
          ambientOsc1 = null;
          ambientOsc2 = null;
          ambientGain = null;
        }, 1000);
      }
      isAudioActive = false;
      return false;
    } else {
      const now = ctx.currentTime;
      ambientGain = ctx.createGain();
      ambientGain.gain.setValueAtTime(0.001, now);
      ambientGain.gain.exponentialRampToValueAtTime(0.03, now + 2);

      // Low soothing ambient binaural synth drone
      ambientOsc1 = ctx.createOscillator();
      ambientOsc2 = ctx.createOscillator();

      ambientOsc1.type = 'sine';
      ambientOsc1.frequency.setValueAtTime(110, now); // A2

      ambientOsc2.type = 'triangle';
      ambientOsc2.frequency.setValueAtTime(164.81, now); // E3 fifth

      // Lowpass filter for warm space sound
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, now);

      ambientOsc1.connect(filter);
      ambientOsc2.connect(filter);
      filter.connect(ambientGain);
      ambientGain.connect(ctx.destination);

      ambientOsc1.start(now);
      ambientOsc2.start(now);

      isAudioActive = true;
      return true;
    }
  } catch {
    return false;
  }
}

export function getAudioActiveState(): boolean {
  return isAudioActive;
}
