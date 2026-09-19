/** Tiny synthesized sound effects — no audio files needed while prototyping. */
export class Sfx {
  enabled: boolean;
  private ctx: AudioContext | null = null;

  constructor(enabled: boolean) {
    this.enabled = enabled;
  }

  pick(): void {
    this.tone(620, 0.07, 'triangle', 0.07, 0, 760);
  }


  slide(): void {
    this.tone(420, 0.12, 'triangle', 0.05, 0, 620);
  }

  thud(): void {
    this.tone(180, 0.09, 'triangle', 0.1, 0, 110);
  }

  mud(): void {
    this.tone(140, 0.2, 'sawtooth', 0.03, 0, 70);
  }

  hop(): void {
    this.tone(500, 0.14, 'sine', 0.07, 0, 980);
  }


  baa(): void {
    // A tiny wobbly bleat.
    [0, 0.07, 0.14].forEach((d, i) => this.tone(470 - i * 25, 0.08, 'sawtooth', 0.025, d, 430 - i * 25));
  }

  nope(): void {
    this.tone(210, 0.16, 'square', 0.035, 0, 150);
  }

  win(): void {
    [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.08, i * 0.085));
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
    if (!this.enabled) return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      const t = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const amp = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      amp.gain.setValueAtTime(0.0001, t);
      amp.gain.exponentialRampToValueAtTime(gain, t + 0.01);
      amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(amp).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // Audio unavailable; stay silent.
    }
  }
}
