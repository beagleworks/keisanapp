class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  private tone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    volume = 0.12,
    delay = 0,
    endFreq?: number,
  ): void {
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);
    }

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  /** Soft card flip sound */
  public playReveal(): void {
    this.tone(523.25, 0.09, 'triangle', 0.14, 0);
    this.tone(659.25, 0.11, 'triangle', 0.12, 0.05);
  }

  /** Soft wooden click for next card */
  public playNextCard(): void {
    this.tone(440, 0.06, 'sine', 0.11, 0, 560);
  }

  /** Start chime */
  public playStart(): void {
    this.tone(523.25, 0.09, 'triangle', 0.13, 0);
    this.tone(659.25, 0.09, 'triangle', 0.13, 0.07);
    this.tone(783.99, 0.16, 'triangle', 0.14, 0.14);
  }

  /** Celebratory clear fanfare */
  public playFanfare(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => {
      this.tone(n, idx === notes.length - 1 ? 0.35 : 0.11, 'triangle', 0.14, idx * 0.09);
    });
  }

  /** 8-bit sword swing */
  public playSword(): void {
    this.tone(680, 0.09, 'square', 0.07, 0, 180);
  }

  /** 8-bit correct answer / monster hit */
  public playCorrect(): void {
    this.tone(587.33, 0.07, 'square', 0.08, 0);
    this.tone(880, 0.13, 'square', 0.09, 0.06);
  }

  /** 8-bit wrong answer / player bump */
  public playWrong(): void {
    this.tone(220, 0.12, 'sawtooth', 0.08, 0, 150);
    this.tone(160, 0.16, 'sawtooth', 0.08, 0.11, 110);
  }

  /** 8-bit rupee / heart pickup */
  public playPickup(): void {
    this.tone(987.77, 0.06, 'square', 0.07, 0);
    this.tone(1318.51, 0.11, 'square', 0.08, 0.055);
  }

  /** Classic secret/chest discovery chime */
  public playSecret(): void {
    const seq = [783.99, 739.99, 622.25, 440, 415.3, 659.25, 830.61, 1046.5];
    seq.forEach((f, idx) => {
      this.tone(f, idx === seq.length - 1 ? 0.28 : 0.085, 'square', 0.07, idx * 0.08);
    });
  }

  /** Boss victory fanfare */
  public playVictory(): void {
    const seq = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
    const times = [0, 0.1, 0.2, 0.3, 0.45, 0.57];
    const durs = [0.09, 0.09, 0.09, 0.13, 0.1, 0.42];
    seq.forEach((f, idx) => {
      this.tone(f, durs[idx], 'square', 0.08, times[idx]);
    });
  }
}

export const sound = new SoundEngine();
