class SoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.85;

  setEnabled(value: boolean) {
    this.enabled = value;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  setVolume(value: number) {
    this.volume = Math.max(0, Math.min(1, value));
  }

  private getContext(): AudioContext | null {
    if (!this.enabled || this.volume <= 0.001 || typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, gainVal: number, delay = 0) {
    const ctx = this.getContext();
    if (!ctx) return;
    const scaledGain = Math.max(0.0002, gainVal * this.volume);
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(scaledGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  playCardComplete() {
    this.tone(523.25, 0.14, 'sine', 0.06, 0);
    this.tone(659.25, 0.18, 'sine', 0.05, 0.06);
  }

  playCorrect() {
    this.tone(587.33, 0.14, 'triangle', 0.07, 0);
    this.tone(880, 0.22, 'triangle', 0.06, 0.08);
  }

  playWrong() {
    this.tone(240, 0.18, 'sawtooth', 0.035, 0);
    this.tone(195, 0.22, 'sine', 0.04, 0.09);
  }

  playStationMastered() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, idx) => this.tone(n, 0.24, 'triangle', 0.065, idx * 0.08));
  }

  playAchievement() {
    const notes = [659.25, 783.99, 987.77, 1318.5];
    notes.forEach((n, idx) => this.tone(n, 0.28, 'sine', 0.07, idx * 0.075));
  }

  playFly() {
    this.tone(360, 0.16, 'sine', 0.03, 0);
    this.tone(440, 0.18, 'sine', 0.025, 0.05);
  }

  playStarCollect() {
    this.tone(740, 0.12, 'sine', 0.055, 0);
    this.tone(987.77, 0.18, 'sine', 0.05, 0.055);
  }

  playBridgeLit() {
    this.tone(440, 0.2, 'sine', 0.04, 0);
    this.tone(554.37, 0.22, 'sine', 0.045, 0.08);
    this.tone(659.25, 0.26, 'sine', 0.05, 0.16);
  }
}

export const soundEngine = new SoundEngine();
