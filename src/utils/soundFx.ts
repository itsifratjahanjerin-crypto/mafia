class ParlorSoundEngine {
  private ctx: AudioContext | null = null;
  private muteListeners = new Set<(muted: boolean) => void>();
  public muted = false;

  public ensureSharedContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    return this.ensureSharedContext();
  }

  public subscribeMute(listener: (muted: boolean) => void): () => void {
    this.muteListeners.add(listener);
    return () => {
      this.muteListeners.delete(listener);
    };
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak = 0.08,
    delay = 0,
    endFreq?: number
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq) {
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  private playFilteredNoise(
    duration: number,
    filterFreq: number,
    filterType: BiquadFilterType,
    gainPeak: number,
    delay = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const sampleCount = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(filterFreq, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  setMuted(mute: boolean): void {
    this.muted = mute;
    for (const cb of this.muteListeners) {
      cb(mute);
    }
  }

  playCardFlip(): void {
    this.playFilteredNoise(0.09, 1800, 'bandpass', 0.06, 0);
    this.playTone(190, 0.08, 'triangle', 0.04, 0.01, 130);
  }

  playGavelStrike(): void {
    // Realistic wooden courtroom double knock
    this.playTone(155, 0.14, 'triangle', 0.12, 0, 72);
    this.playFilteredNoise(0.06, 650, 'lowpass', 0.09, 0);
    this.playTone(145, 0.16, 'triangle', 0.1, 0.18, 68);
    this.playFilteredNoise(0.07, 620, 'lowpass', 0.08, 0.18);
  }

  playStamp(): void {
    this.playTone(120, 0.12, 'sine', 0.11, 0, 58);
    this.playFilteredNoise(0.05, 1100, 'lowpass', 0.07, 0);
  }

  playHeartbeat(): void {
    this.playTone(68, 0.12, 'sine', 0.11, 0, 48);
    this.playTone(62, 0.16, 'sine', 0.08, 0.16, 44);
  }

  playShieldLock(): void {
    this.playTone(330, 0.2, 'sine', 0.06, 0);
    this.playTone(493.88, 0.35, 'triangle', 0.06, 0.08);
  }

  playNightFall(): void {
    this.playFilteredNoise(0.55, 500, 'lowpass', 0.04, 0);
    this.playTone(220, 0.55, 'triangle', 0.07, 0, 185);
    this.playTone(146.83, 0.85, 'sine', 0.08, 0.16);
  }

  playRoleWake(): void {
    this.playTone(392, 0.25, 'sine', 0.07, 0);
    this.playTone(523.25, 0.38, 'triangle', 0.06, 0.12);
  }

  playDayBreak(): void {
    this.playTone(293.66, 0.32, 'triangle', 0.06, 0);
    this.playTone(369.99, 0.32, 'triangle', 0.06, 0.1);
    this.playTone(440, 0.5, 'sine', 0.07, 0.2);
    this.playTone(587.33, 0.55, 'sine', 0.05, 0.3);
  }

  playVoteClick(): void {
    this.playFilteredNoise(0.04, 1400, 'bandpass', 0.045, 0);
    this.playTone(480, 0.08, 'sine', 0.05, 0);
  }

  playElimination(): void {
    this.playGavelStrike();
    this.playTone(110, 0.75, 'triangle', 0.09, 0.22, 82);
  }

  playVictory(): void {
    this.playTone(261.63, 0.25, 'triangle', 0.07, 0);
    this.playTone(329.63, 0.25, 'triangle', 0.07, 0.12);
    this.playTone(392, 0.3, 'triangle', 0.07, 0.24);
    this.playTone(523.25, 0.6, 'sine', 0.08, 0.36);
  }
}

export const soundFx = new ParlorSoundEngine();
