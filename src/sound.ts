// Tiny synthesized sound effects (Web Audio). No audio files, works offline.
// iOS only allows audio after a user gesture, so the context is created/resumed lazily.

export type SoundName = 'honeyAppear' | 'beeAppear' | 'honey' | 'sting' | 'tired' | 'win' | 'tick';

export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  /** Call from a user gesture (pointerdown/click) to unlock audio on iOS. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
      }
      if (this.ctx.state !== 'running') void this.ctx.resume();
    } catch {
      /* no audio available */
    }
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ctx) return;
    try {
      const c = this.ctx;
      const t = c.currentTime;
      switch (name) {
        case 'honeyAppear':
          this.tone(c, t, 660, 880, 0.12, 'sine', 0.08);
          break;
        case 'beeAppear':
          this.buzz(c, t, 0.35, 0.05);
          break;
        case 'honey':
          this.tone(c, t, 520, 780, 0.1, 'triangle', 0.18);
          this.tone(c, t + 0.09, 780, 1170, 0.16, 'triangle', 0.16);
          break;
        case 'sting':
          this.buzz(c, t, 0.45, 0.16);
          this.tone(c, t, 300, 90, 0.3, 'sawtooth', 0.12);
          break;
        case 'tired':
          this.tone(c, t, 330, 140, 0.5, 'sine', 0.16);
          this.tone(c, t + 0.28, 260, 110, 0.5, 'sine', 0.12);
          break;
        case 'win':
          [523, 659, 784, 1046].forEach((f, i) => this.tone(c, t + i * 0.12, f, f, 0.22, 'triangle', 0.16));
          break;
        case 'tick':
          this.tone(c, t, 220, 200, 0.04, 'square', 0.03);
          break;
      }
    } catch {
      /* ignore audio errors */
    }
  }

  private tone(c: AudioContext, t: number, f0: number, f1: number, dur: number, type: OscillatorType, vol: number): void {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** Bee-like buzz: sawtooth around 190 Hz with fast vibrato. */
  private buzz(c: AudioContext, t: number, dur: number, vol: number): void {
    const osc = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, t);
    lfo.frequency.setValueAtTime(32, t);
    lfoGain.gain.setValueAtTime(28, t);
    lfo.connect(lfoGain).connect(osc.frequency);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(c.destination);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.02);
    lfo.stop(t + dur + 0.02);
  }
}
