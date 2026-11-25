import type { GamePhase } from '../shared/types.ts';
import { soundFx } from './soundFx.ts';

export type AmbientProfile =
  | 'title'
  | 'lobby'
  | 'night'
  | 'day'
  | 'voting'
  | 'victory'
  | 'paused'
  | 'off';

export interface AmbientContextInput {
  phase: GamePhase | null;
  isPaused: boolean;
  inRoom: boolean;
  voiceActive: boolean;
}

const PROFILE_LABELS: Record<AmbientProfile, string> = {
  title: 'Parlor Hearth',
  lobby: 'Parlor Hearth',
  night: 'Night Crickets & Rain',
  day: 'Day Clock Ticking',
  voting: 'Voting Tension Watch',
  victory: 'Evening Breeze',
  paused: 'Paused',
  off: 'Off',
};

function resolveProfile(ctx: AmbientContextInput): AmbientProfile {
  if (!ctx.inRoom || !ctx.phase) return 'title';
  if (ctx.isPaused) return 'paused';
  switch (ctx.phase) {
    case 'LOBBY':
    case 'ROUND_READY':
      return 'lobby';
    case 'NIGHT_INTRO':
    case 'NIGHT_MAFIA':
    case 'NIGHT_BODYGUARD':
    case 'NIGHT_DETECTIVE':
    case 'NIGHT_CUSTOM':
    case 'NIGHT_RESOLVE':
      return 'night';
    case 'DAY_ANNOUNCE':
    case 'DAY_DISCUSSION':
    case 'ROUND_COMPLETE':
      return 'day';
    case 'DAY_VOTING':
    case 'DAY_VOTE_RESULT':
      return 'voting';
    case 'GAME_OVER':
      return 'victory';
    default:
      return 'lobby';
  }
}

class AmbientAudioController {
  private enabled = true;
  private hasGesture = false;
  private contextInput: AmbientContextInput = {
    phase: null,
    isPaused: false,
    inRoom: false,
    voiceActive: false,
  };
  private activeProfile: AmbientProfile = 'title';
  private listeners = new Set<() => void>();

  // Persistent Web Audio graph nodes
  private graphReady = false;
  private masterGain: GainNode | null = null;
  private bedGain: GainNode | null = null;
  private bedFilter: BiquadFilterNode | null = null;
  private bedSource: AudioBufferSourceNode | null = null;
  private droneGain: GainNode | null = null;
  private droneOscA: OscillatorNode | null = null;
  private droneOscB: OscillatorNode | null = null;

  // Discrete atmospheric timers
  private clockTimer: number | null = null;
  private cricketTimer: number | null = null;
  private crackleTimer: number | null = null;
  private tickPhase = false;

  constructor() {
    soundFx.subscribeMute(() => {
      this.syncAudioGraph();
      this.notify();
    });
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }

  public isEnabled(): boolean {
    return this.enabled && !soundFx.muted;
  }

  public getRawEnabled(): boolean {
    return this.enabled;
  }

  public getActiveProfile(): AmbientProfile {
    if (!this.isEnabled()) return 'off';
    return this.activeProfile;
  }

  public getProfileLabel(): string {
    return PROFILE_LABELS[this.getActiveProfile()];
  }

  public isPlaying(): boolean {
    return this.hasGesture && this.isEnabled() && this.activeProfile !== 'off';
  }

  public unlock(): void {
    this.hasGesture = true;
    const ctx = soundFx.ensureSharedContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.ensureGraph(ctx);
          this.syncAudioGraph();
          this.notify();
        })
        .catch(() => {});
    } else {
      this.ensureGraph(ctx);
      this.syncAudioGraph();
      this.notify();
    }
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next) {
      if (soundFx.muted) {
        soundFx.setMuted(false);
      }
      this.unlock();
    } else {
      this.syncAudioGraph();
    }
    this.notify();
  }

  public toggle(): boolean {
    const next = !this.isEnabled();
    this.setEnabled(next);
    return next;
  }

  public updateContext(input: AmbientContextInput): void {
    const nextProfile = resolveProfile(input);
    const profileChanged = nextProfile !== this.activeProfile;
    const phaseChanged = input.phase !== this.contextInput.phase;
    const voiceChanged = input.voiceActive !== this.contextInput.voiceActive;
    const pauseChanged = input.isPaused !== this.contextInput.isPaused;

    this.contextInput = input;
    this.activeProfile = nextProfile;

    if (profileChanged || phaseChanged || voiceChanged || pauseChanged) {
      this.syncAudioGraph();
      this.notify();
    }
  }

  public dispose(): void {
    this.clearTimers();
    try {
      this.bedSource?.stop();
    } catch {
      // ignore already stopped
    }
    try {
      this.droneOscA?.stop();
      this.droneOscB?.stop();
    } catch {
      // ignore already stopped
    }
    this.bedSource?.disconnect();
    this.droneOscA?.disconnect();
    this.droneOscB?.disconnect();
    this.bedFilter?.disconnect();
    this.bedGain?.disconnect();
    this.droneGain?.disconnect();
    this.masterGain?.disconnect();
    this.bedSource = null;
    this.droneOscA = null;
    this.droneOscB = null;
    this.bedFilter = null;
    this.bedGain = null;
    this.droneGain = null;
    this.masterGain = null;
    this.graphReady = false;
  }

  private ensureGraph(ctx: AudioContext): boolean {
    if (this.graphReady) return true;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // 4-second looping warm brown-tinted noise buffer for parlor air / rain / hearth bed
    const bufferLen = Math.floor(ctx.sampleRate * 4);
    const buffer = ctx.createBuffer(1, bufferLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferLen; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.035 * white) / 1.035;
      data[i] = Math.max(-1, Math.min(1, lastOut * 2.8));
    }

    const bedSource = ctx.createBufferSource();
    bedSource.buffer = buffer;
    bedSource.loop = true;

    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = 'lowpass';
    bedFilter.frequency.setValueAtTime(420, ctx.currentTime);
    bedFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    const bedGain = ctx.createGain();
    bedGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    bedSource.connect(bedFilter);
    bedFilter.connect(bedGain);
    bedGain.connect(masterGain);
    bedSource.start();

    // Subtle low tonal pad for night / voting tension
    const droneOscA = ctx.createOscillator();
    const droneOscB = ctx.createOscillator();
    droneOscA.type = 'sine';
    droneOscB.type = 'sine';
    droneOscA.frequency.setValueAtTime(65.41, ctx.currentTime); // C2
    droneOscB.frequency.setValueAtTime(98.0, ctx.currentTime); // G2

    const droneGain = ctx.createGain();
    droneGain.gain.setValueAtTime(0.0001, ctx.currentTime);

    droneOscA.connect(droneGain);
    droneOscB.connect(droneGain);
    droneGain.connect(masterGain);
    droneOscA.start();
    droneOscB.start();

    this.masterGain = masterGain;
    this.bedSource = bedSource;
    this.bedFilter = bedFilter;
    this.bedGain = bedGain;
    this.droneOscA = droneOscA;
    this.droneOscB = droneOscB;
    this.droneGain = droneGain;
    this.graphReady = true;
    return true;
  }

  private clearTimers(): void {
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
    if (this.cricketTimer !== null) {
      window.clearTimeout(this.cricketTimer);
      this.cricketTimer = null;
    }
    if (this.crackleTimer !== null) {
      window.clearTimeout(this.crackleTimer);
      this.crackleTimer = null;
    }
  }

  private syncAudioGraph(): void {
    this.clearTimers();

    if (!this.hasGesture) return;
    const ctx = soundFx.ensureSharedContext();
    if (!ctx || !this.ensureGraph(ctx)) return;
    if (!this.masterGain || !this.bedGain || !this.bedFilter || !this.droneGain) return;

    const now = ctx.currentTime;
    const active = this.isEnabled() && this.activeProfile !== 'off';

    if (!active) {
      this.masterGain.gain.setTargetAtTime(0.0001, now, 0.25);
      this.bedGain.gain.setTargetAtTime(0.0001, now, 0.2);
      this.droneGain.gain.setTargetAtTime(0.0001, now, 0.2);
      return;
    }

    const duckFactor = this.contextInput.isPaused
      ? 0.22
      : this.contextInput.voiceActive
        ? 0.45
        : 1.0;

    this.masterGain.gain.setTargetAtTime(duckFactor, now, 0.35);

    const profile = this.activeProfile;
    switch (profile) {
      case 'title':
      case 'lobby': {
        this.bedFilter.type = 'lowpass';
        this.bedFilter.frequency.setTargetAtTime(360, now, 0.5);
        this.bedFilter.Q.setTargetAtTime(0.65, now, 0.5);
        this.bedGain.gain.setTargetAtTime(0.032, now, 0.45);
        this.droneGain.gain.setTargetAtTime(0.0001, now, 0.35);
        this.scheduleHearthCrackle();
        break;
      }

      case 'night': {
        this.bedFilter.type = 'bandpass';
        this.bedFilter.frequency.setTargetAtTime(780, now, 0.6);
        this.bedFilter.Q.setTargetAtTime(0.55, now, 0.6);
        this.bedGain.gain.setTargetAtTime(0.042, now, 0.5);

        const deepNight =
          this.contextInput.phase === 'NIGHT_INTRO' ||
          this.contextInput.phase === 'NIGHT_MAFIA';
        if (this.droneOscA && this.droneOscB) {
          this.droneOscA.frequency.setTargetAtTime(61.74, now, 0.4); // B1
          this.droneOscB.frequency.setTargetAtTime(92.5, now, 0.4);
        }
        this.droneGain.gain.setTargetAtTime(deepNight ? 0.0085 : 0.0045, now, 0.5);
        this.scheduleCricketChirp(true);
        break;
      }

      case 'day': {
        this.bedFilter.type = 'lowpass';
        this.bedFilter.frequency.setTargetAtTime(520, now, 0.5);
        this.bedFilter.Q.setTargetAtTime(0.6, now, 0.5);
        this.bedGain.gain.setTargetAtTime(0.018, now, 0.45);
        this.droneGain.gain.setTargetAtTime(0.0001, now, 0.35);
        this.startClockLoop(1000, false);
        break;
      }

      case 'voting': {
        this.bedFilter.type = 'lowpass';
        this.bedFilter.frequency.setTargetAtTime(440, now, 0.45);
        this.bedFilter.Q.setTargetAtTime(0.8, now, 0.45);
        this.bedGain.gain.setTargetAtTime(0.02, now, 0.4);
        if (this.droneOscA && this.droneOscB) {
          this.droneOscA.frequency.setTargetAtTime(55.0, now, 0.35); // A1
          this.droneOscB.frequency.setTargetAtTime(82.41, now, 0.35); // E2
        }
        this.droneGain.gain.setTargetAtTime(0.011, now, 0.4);
        this.startClockLoop(720, true);
        break;
      }

      case 'victory': {
        this.bedFilter.type = 'bandpass';
        this.bedFilter.frequency.setTargetAtTime(620, now, 0.6);
        this.bedFilter.Q.setTargetAtTime(0.5, now, 0.6);
        this.bedGain.gain.setTargetAtTime(0.022, now, 0.5);
        this.droneGain.gain.setTargetAtTime(0.0001, now, 0.4);
        break;
      }

      case 'paused': {
        this.bedFilter.type = 'lowpass';
        this.bedFilter.frequency.setTargetAtTime(280, now, 0.4);
        this.bedGain.gain.setTargetAtTime(0.018, now, 0.4);
        this.droneGain.gain.setTargetAtTime(0.0001, now, 0.3);
        break;
      }
    }
  }

  private startClockLoop(intervalMs: number, tenseWatch: boolean): void {
    this.tickPhase = false;
    this.playClockTick(false, tenseWatch);
    this.clockTimer = window.setInterval(() => {
      if (!this.isPlaying()) return;
      if (this.activeProfile !== 'day' && this.activeProfile !== 'voting') return;
      this.tickPhase = !this.tickPhase;
      this.playClockTick(this.tickPhase, tenseWatch);
    }, intervalMs);
  }

  private playClockTick(isTock: boolean, tenseWatch: boolean): void {
    const ctx = soundFx.ensureSharedContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    // Crisp wood/escapement transient using filtered noise impulse + short tonal resonance
    const sampleCount = Math.floor(ctx.sampleRate * 0.026);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const env = Math.exp(-i / (sampleCount * 0.18));
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    const centerFreq = tenseWatch
      ? isTock
        ? 2300
        : 2950
      : isTock
        ? 1420
        : 1880;
    filter.frequency.setValueAtTime(centerFreq, now);
    filter.Q.setValueAtTime(tenseWatch ? 4.2 : 3.2, now);

    const tickGain = ctx.createGain();
    const peak = tenseWatch ? 0.026 : 0.024;
    tickGain.gain.setValueAtTime(0.0001, now);
    tickGain.gain.exponentialRampToValueAtTime(peak, now + 0.0025);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

    noiseSrc.connect(filter);
    filter.connect(tickGain);
    tickGain.connect(this.masterGain);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.035);

    // Subtle wooden mantle body click
    const woodOsc = ctx.createOscillator();
    const woodGain = ctx.createGain();
    woodOsc.type = 'triangle';
    woodOsc.frequency.setValueAtTime(
      tenseWatch ? (isTock ? 980 : 1180) : isTock ? 540 : 690,
      now
    );
    woodGain.gain.setValueAtTime(0.0001, now);
    woodGain.gain.exponentialRampToValueAtTime(0.011, now + 0.002);
    woodGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);
    woodOsc.connect(woodGain);
    woodGain.connect(this.masterGain);
    woodOsc.start(now);
    woodOsc.stop(now + 0.028);
  }

  private scheduleCricketChirp(immediate = false): void {
    const delayMs = immediate ? 450 : 1800 + Math.random() * 2100;
    this.cricketTimer = window.setTimeout(() => {
      if (!this.isPlaying() || this.activeProfile !== 'night') return;
      this.playCricketChirp();
      this.scheduleCricketChirp(false);
    }, delayMs);
  }

  private playCricketChirp(): void {
    const ctx = soundFx.ensureSharedContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const pulses = Math.random() > 0.35 ? 3 : 4;
    const baseFreq = 4120 + Math.random() * 280;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq, now);
    filter.Q.setValueAtTime(5.5, now);
    filter.connect(this.masterGain);

    for (let i = 0; i < pulses; i++) {
      const start = now + i * 0.052;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq + (i % 2 === 0 ? 0 : 35), start);
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.013, start + 0.009);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.038);
      osc.connect(g);
      g.connect(filter);
      osc.start(start);
      osc.stop(start + 0.044);
    }

    window.setTimeout(() => {
      filter.disconnect();
    }, pulses * 60 + 100);
  }

  private scheduleHearthCrackle(): void {
    const delayMs = 2000 + Math.random() * 2800;
    this.crackleTimer = window.setTimeout(() => {
      if (
        !this.isPlaying() ||
        (this.activeProfile !== 'title' && this.activeProfile !== 'lobby')
      ) {
        return;
      }
      this.playHearthCrackle();
      this.scheduleHearthCrackle();
    }, delayMs);
  }

  private playHearthCrackle(): void {
    const ctx = soundFx.ensureSharedContext();
    if (!ctx || !this.masterGain || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const pops = 1 + (Math.random() > 0.6 ? 1 : 0);
    for (let p = 0; p < pops; p++) {
      const offset = p * (0.04 + Math.random() * 0.08);
      const start = now + offset;
      const sampleCount = Math.floor(ctx.sampleRate * 0.014);
      const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < sampleCount; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (sampleCount * 0.25));
      }

      const src = ctx.createBufferSource();
      src.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2200 + Math.random() * 1400, start);
      filter.Q.setValueAtTime(2.0, start);

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.012, start + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.015);

      src.connect(filter);
      filter.connect(g);
      g.connect(this.masterGain);
      src.start(start);
      src.stop(start + 0.02);
    }
  }
}

export const ambientAudio = new AmbientAudioController();
