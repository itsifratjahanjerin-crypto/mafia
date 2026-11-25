import type { ClientGameState, CustomRoleDefinition } from '../shared/types.ts';
import { getRoleDescription } from './avatars.tsx';
import { soundFx } from './soundFx.ts';

class ParlorVoiceNarrator {
  private enabled = true;
  private listeners = new Set<() => void>();
  private lastAnnouncedKey = '';
  private lastRoleBriefingKey = '';
  private lastPausedState = false;
  private preferredVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.pickPreferredVoice();
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {
        this.pickPreferredVoice();
      });
    }
    soundFx.subscribeMute((muted) => {
      if (muted) {
        this.stop();
      }
      this.notify();
    });
  }

  private pickPreferredVoice(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return;
    this.preferredVoice =
      voices.find((v) => /google us english/i.test(v.name)) ||
      voices.find((v) => /google uk english/i.test(v.name)) ||
      voices.find((v) => /en[-_]us/i.test(v.lang) && /natural|samantha|daniel|aria|jenny/i.test(v.name)) ||
      voices.find((v) => /^en[-_]/i.test(v.lang)) ||
      voices[0] ||
      null;
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const cb of this.listeners) cb();
  }

  public isEnabled(): boolean {
    return this.enabled && !soundFx.muted;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    if (next && soundFx.muted) {
      soundFx.setMuted(false);
    }
    if (!next) {
      this.stop();
    }
    this.notify();
  }

  public toggle(): boolean {
    const next = !this.isEnabled();
    this.setEnabled(next);
    return next;
  }

  public stop(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore browser speech errors
    }
  }

  public speak(text: string, options: { interrupt?: boolean; rate?: number; pitch?: number } = {}): void {
    if (!this.isEnabled()) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const clean = text.trim();
    if (!clean) return;

    try {
      if (options.interrupt !== false) {
        window.speechSynthesis.cancel();
      }
      if (!this.preferredVoice) {
        this.pickPreferredVoice();
      }
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.lang = 'en-US';
      utterance.rate = options.rate ?? 0.98;
      utterance.pitch = options.pitch ?? 0.96;
      utterance.volume = 0.85;
      if (this.preferredVoice) {
        utterance.voice = this.preferredVoice;
      }
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore autoplay/synthesis blocks cleanly
    }
  }

  public buildRoleRulesScript(
    role: string | null,
    customRole?: CustomRoleDefinition,
    options?: {
      teammates?: string[];
      bodyguardSelfProtect?: boolean;
      viewerIsGM?: boolean;
    }
  ): string {
    if (options?.viewerIsGM) {
      return 'You are the Game Master. Control the night calls manually, manage private role actions, announce results, and guide every round.';
    }
    if (!role) {
      return 'Waiting for the Game Master to assign your secret role.';
    }
    if (customRole) {
      return `Your secret role is ${customRole.name}, on the ${customRole.team} team. Rule: ${customRole.description || getRoleDescription(role)}`;
    }
    switch (role) {
      case 'Mafia': {
        const mateText =
          options?.teammates && options.teammates.length > 0
            ? ` Your Mafia teammate is ${options.teammates.join(' and ')}.`
            : '';
        return `You are the Mafia. Your rule: stay hidden during the day, and when the Game Master calls Mafia at night, secretly pick one target to eliminate.${mateText}`;
      }
      case 'Detective':
        return 'You are the Detective. Your rule: each night when called by the Game Master, investigate one living player to privately discover whether they are Mafia or innocent.';
      case 'Bodyguard':
        return `You are the Bodyguard. Your rule: each night when called by the Game Master, select one living player to protect from elimination. ${
          options?.bodyguardSelfProtect
            ? 'Self-protection is allowed.'
            : 'Self-protection is disabled.'
        }`;
      case 'Villager':
        return 'You are a Villager. Your rule: listen carefully during Day Discussion, share your clues, and vote out the Mafia before they outnumber the Town.';
      default:
        return `Your secret role is ${role}. ${getRoleDescription(role)}`;
    }
  }

  public speakRoleBriefing(
    state: ClientGameState,
    options?: { force?: boolean }
  ): void {
    const myCustomRole = state.customRoles.find((c) => c.name === state.viewerRole);
    const teammates =
      state.viewerRole === 'Mafia' && state.settings.mafiaKnowEachOther
        ? state.players
            .filter((p) => !p.isGM && p.role === 'Mafia' && p.id !== state.viewerId)
            .map((p) => p.name)
        : [];

    const script = this.buildRoleRulesScript(state.viewerRole, myCustomRole, {
      teammates,
      bodyguardSelfProtect: state.settings.bodyguardSelfProtect,
      viewerIsGM: state.viewerIsGM,
    });
    this.speak(script, { interrupt: Boolean(options?.force) });
  }

  public syncWithGameState(state: ClientGameState | null): void {
    if (!state) {
      this.lastAnnouncedKey = '';
      this.lastRoleBriefingKey = '';
      this.lastPausedState = false;
      return;
    }

    if (state.phase === 'LOBBY') {
      this.lastRoleBriefingKey = '';
    }

    // Speak pause cue once on transition
    if (state.isPaused !== this.lastPausedState) {
      this.lastPausedState = state.isPaused;
      if (state.isPaused && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER') {
        this.speak('Match paused by the Game Master.');
      }
    }

    if (state.isPaused) return;

    // Role briefing once per match start when round >= 1
    if (state.round >= 1 && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER') {
      const roleKey = `${state.roomCode}:${state.viewerId}:${state.viewerIsGM ? 'GM' : state.viewerRole || 'NONE'}`;
      if (roleKey !== this.lastRoleBriefingKey) {
        this.lastRoleBriefingKey = roleKey;
        const myCustomRole = state.customRoles.find((c) => c.name === state.viewerRole);
        const teammates =
          state.viewerRole === 'Mafia' && state.settings.mafiaKnowEachOther
            ? state.players
                .filter((p) => !p.isGM && p.role === 'Mafia' && p.id !== state.viewerId)
                .map((p) => p.name)
            : [];
        const briefing = this.buildRoleRulesScript(state.viewerRole, myCustomRole, {
          teammates,
          bodyguardSelfProtect: state.settings.bodyguardSelfProtect,
          viewerIsGM: state.viewerIsGM,
        });
        this.speak(briefing, { interrupt: true });
      }
    }

    // Phase narration cues (strictly privacy-filtered!)
    const phaseKey = `${state.roomCode}:R${state.round}:${state.phase}:${state.dayAnnouncement?.headline || ''}`;
    if (phaseKey === this.lastAnnouncedKey) return;
    this.lastAnnouncedKey = phaseKey;

    const myCustomRole = state.customRoles.find((c) => c.name === state.viewerRole);
    const hasCustomNight = Boolean(myCustomRole && myCustomRole.nightAction !== 'none');

    switch (state.phase) {
      case 'NIGHT_INTRO':
        this.speak('Night has begun. Everyone close your eyes.', { interrupt: false });
        break;
      case 'NIGHT_MAFIA':
        if (state.viewerIsGM) {
          this.speak('Calling Mafia.');
        } else if (state.viewerIsAlive && state.viewerRole === 'Mafia') {
          this.speak('Mafia, wake up. Secretly choose your target to eliminate.');
        }
        break;
      case 'NIGHT_BODYGUARD':
        if (state.viewerIsGM) {
          this.speak('Calling Bodyguard.');
        } else if (state.viewerIsAlive && state.viewerRole === 'Bodyguard') {
          this.speak('Bodyguard, wake up. Select one player to protect tonight.');
        }
        break;
      case 'NIGHT_DETECTIVE':
        if (state.viewerIsGM) {
          this.speak('Calling Detective.');
        } else if (state.viewerIsAlive && state.viewerRole === 'Detective') {
          this.speak('Detective, wake up. Select one player to investigate tonight.');
        }
        break;
      case 'NIGHT_CUSTOM':
        if (state.viewerIsGM) {
          this.speak('Calling custom night roles.');
        } else if (state.viewerIsAlive && hasCustomNight && myCustomRole) {
          this.speak(`${myCustomRole.name}, wake up. Perform your night action.`);
        }
        break;
      case 'NIGHT_RESOLVE':
        if (state.viewerIsGM) {
          this.speak('Night complete. Review the private summary and continue to day.');
        }
        break;
      case 'DAY_ANNOUNCE':
        if (state.dayAnnouncement?.headline) {
          this.speak(`Day breaks. ${state.dayAnnouncement.headline}`);
        } else {
          this.speak('Day breaks. Everyone open your eyes.');
        }
        break;
      case 'DAY_DISCUSSION':
        this.speak('Day discussion has begun. Share your clues and find the Mafia.');
        break;
      case 'DAY_VOTING':
        this.speak('Voting phase has begun. Select a player to eliminate and submit your vote.');
        break;
      case 'DAY_VOTE_RESULT':
        if (state.voteResult?.isTie) {
          this.speak('Voting ended in a tie. Waiting for the Game Master.');
        } else if (state.voteResult?.eliminatedPlayerName) {
          this.speak(`Voting complete. ${state.voteResult.eliminatedPlayerName} received the most votes.`);
        } else {
          this.speak('Voting complete. Nobody was eliminated.');
        }
        break;
      case 'GAME_OVER':
        if (state.winner) {
          const teamTitle =
            state.winner.team === 'Mafia'
              ? 'Mafia wins!'
              : state.winner.team === 'Neutral'
                ? 'Custom victory!'
                : 'Town wins!';
          this.speak(`Game over. ${teamTitle} ${state.winner.reason}`);
        }
        break;
      default:
        break;
    }
  }
}

export const voiceNarrator = new ParlorVoiceNarrator();
