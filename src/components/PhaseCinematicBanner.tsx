import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Gavel, Moon, Search, Shield, Skull, Sun, Trophy } from 'lucide-react';
import type { ClientGameState, GamePhase } from '../shared/types.ts';

interface BannerMeta {
  key: string;
  title: string;
  subtitle: string;
  accent: string;
  icon: React.ReactNode;
}

function getBannerForPhase(state: ClientGameState): BannerMeta | null {
  const { phase, round, viewerIsGM, viewerRole, viewerIsAlive } = state;

  if (phase === 'NIGHT_INTRO') {
    return {
      key: `R${round}_NIGHT_INTRO`,
      title: 'Night Falls on the Parlor',
      subtitle: 'Everyone close your eyes... Shadows stir outside the rain-streaked glass.',
      accent: '#38BDF8',
      icon: <Moon size={28} className="text-sky-400" />,
    };
  }

  // Strictly privacy-filtered: ONLY authorized active roles or GM see sub-phase call banners!
  if (phase === 'NIGHT_MAFIA' && (viewerIsGM || (viewerIsAlive && viewerRole === 'Mafia'))) {
    return {
      key: `R${round}_NIGHT_MAFIA`,
      title: 'The Syndicate Wakes',
      subtitle: viewerIsGM
        ? 'Mafia members are choosing tonight’s target in secret.'
        : 'Quietly align with your syndicate and lock in tonight’s target.',
      accent: '#DC2626',
      icon: <Skull size={28} className="text-red-400" />,
    };
  }

  if (
    phase === 'NIGHT_BODYGUARD' &&
    (viewerIsGM || (viewerIsAlive && viewerRole === 'Bodyguard'))
  ) {
    return {
      key: `R${round}_NIGHT_BODYGUARD`,
      title: 'Guardian’s Watch',
      subtitle: viewerIsGM
        ? 'The Bodyguard is selecting someone to shield tonight.'
        : 'Choose one living player to shield from harm tonight.',
      accent: '#38BDF8',
      icon: <Shield size={28} className="text-sky-400" />,
    };
  }

  if (
    phase === 'NIGHT_DETECTIVE' &&
    (viewerIsGM || (viewerIsAlive && viewerRole === 'Detective'))
  ) {
    return {
      key: `R${round}_NIGHT_DETECTIVE`,
      title: 'Midnight Investigation',
      subtitle: viewerIsGM
        ? 'The Detective is inspecting a suspect’s dossier.'
        : 'Open one suspect’s dossier to learn if they belong to the Mafia.',
      accent: '#E5A93C',
      icon: <Search size={28} className="text-amber-400" />,
    };
  }

  if (phase === 'DAY_ANNOUNCE') {
    return {
      key: `R${round}_DAY_ANNOUNCE`,
      title: `Dawn Breaks — Round ${round}`,
      subtitle: state.dayAnnouncement?.headline || 'Sunlight cuts through the parlor haze.',
      accent: '#F59E0B',
      icon: <Sun size={28} className="text-amber-400" />,
    };
  }

  if (phase === 'DAY_VOTING') {
    return {
      key: `R${round}_DAY_VOTING`,
      title: 'The Gavel Falls',
      subtitle: 'Cast your ballot at the table. Decide who faces elimination.',
      accent: '#DC2626',
      icon: <Gavel size={28} className="text-red-400" />,
    };
  }

  if (phase === 'ROUND_COMPLETE') {
    return {
      key: `R${round}_ROUND_COMPLETE`,
      title: `Round ${round} Verdict Sealed`,
      subtitle: 'The ledger is updated. Prepare for the next round.',
      accent: '#E5A93C',
      icon: <Trophy size={28} className="text-amber-400" />,
    };
  }

  return null;
}

export function PhaseCinematicBanner({ state }: { state: ClientGameState }) {
  const [activeBanner, setActiveBanner] = useState<BannerMeta | null>(null);
  const lastShownKeyRef = useRef<string | null>(null);
  const lastPhaseRef = useRef<GamePhase | null>(null);

  useEffect(() => {
    // Skip showing a banner on initial page mount if already mid-lobby
    if (lastPhaseRef.current === null && state.phase === 'LOBBY') {
      lastPhaseRef.current = state.phase;
      return;
    }
    lastPhaseRef.current = state.phase;

    const meta = getBannerForPhase(state);
    if (!meta || lastShownKeyRef.current === meta.key) return;

    lastShownKeyRef.current = meta.key;
    setActiveBanner(meta);

    const timer = window.setTimeout(() => {
      setActiveBanner(null);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [state]);

  return (
    <AnimatePresence>
      {activeBanner && (
        <motion.div
          key={activeBanner.key}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={() => setActiveBanner(null)}
          className="fixed inset-0 z-40 pointer-events-auto bg-[#05070D]/60 backdrop-blur-[2px] flex items-center justify-center p-4 cursor-pointer"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-lg w-full max-h-[90dvh] overflow-y-auto overflow-x-hidden rounded-2xl border px-5 py-5 sm:px-7 sm:py-6 text-center space-y-2.5 shadow-2xl relative"
            style={{
              backgroundColor: 'rgba(13, 17, 26, 0.96)',
              borderColor: `${activeBanner.accent}66`,
              boxShadow: `0 24px 64px rgba(0,0,0,0.75), 0 0 42px ${activeBanner.accent}25`,
            }}
          >
            {/* Light sweep */}
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.4, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-20deg]"
            />
            <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center mx-auto">
              {activeBanner.icon}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
              {activeBanner.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {activeBanner.subtitle}
            </p>
            <div className="text-[10px] text-slate-500 pt-1">Click anywhere to continue</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
