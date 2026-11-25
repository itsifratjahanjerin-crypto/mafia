import { useEffect } from 'react';
import type { ClientGameState, GamePhase } from '../shared/types.ts';
import { ambientAudio } from '../utils/ambientAudio.ts';
import { voiceNarrator } from '../utils/voiceNarrator.ts';

interface BackgroundAudioControllerProps {
  gameState: ClientGameState | null;
  phase: GamePhase | null;
  isPaused: boolean;
  inRoom: boolean;
  voiceActive: boolean;
}

export function BackgroundAudioController({
  gameState,
  phase,
  isPaused,
  inRoom,
  voiceActive,
}: BackgroundAudioControllerProps) {
  useEffect(() => {
    const handleUnlock = () => {
      ambientAudio.unlock();
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
    };

    window.addEventListener('pointerdown', handleUnlock, { passive: true });
    window.addEventListener('keydown', handleUnlock, { passive: true });

    return () => {
      window.removeEventListener('pointerdown', handleUnlock);
      window.removeEventListener('keydown', handleUnlock);
      ambientAudio.dispose();
      voiceNarrator.stop();
    };
  }, []);

  useEffect(() => {
    ambientAudio.updateContext({
      phase,
      isPaused,
      inRoom,
      voiceActive,
    });
  }, [phase, isPaused, inRoom, voiceActive]);

  useEffect(() => {
    voiceNarrator.syncWithGameState(gameState);
  }, [gameState]);

  return null;
}
