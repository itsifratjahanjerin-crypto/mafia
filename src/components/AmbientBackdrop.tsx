import React, { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import type { GamePhase } from '../shared/types.ts';
import type { ParlorTheme } from '../utils/parlorThemes.ts';
import { RAINY_PARLOR_URL } from '../utils/avatars.tsx';

const MOTES = [
  { id: 1, left: '14%', top: '24%', dur: 9, delay: 0, size: 3, desktopOnly: false },
  { id: 2, left: '30%', top: '68%', dur: 11, delay: 1.5, size: 2, desktopOnly: true },
  { id: 3, left: '46%', top: '18%', dur: 10, delay: 0.8, size: 3, desktopOnly: false },
  { id: 4, left: '64%', top: '76%', dur: 12, delay: 2.2, size: 2, desktopOnly: true },
  { id: 5, left: '78%', top: '34%', dur: 8.5, delay: 1.1, size: 3, desktopOnly: false },
  { id: 6, left: '89%', top: '58%', dur: 13, delay: 0.4, size: 2, desktopOnly: true },
];

const RAIN_STREAKS = [
  { id: 1, left: '10%', dur: 1.15, delay: 0, desktopOnly: false },
  { id: 2, left: '24%', dur: 0.98, delay: 0.4, desktopOnly: true },
  { id: 3, left: '38%', dur: 1.25, delay: 0.15, desktopOnly: false },
  { id: 4, left: '53%', dur: 1.05, delay: 0.65, desktopOnly: true },
  { id: 5, left: '68%', dur: 1.2, delay: 0.3, desktopOnly: false },
  { id: 6, left: '84%', dur: 1.1, delay: 0.55, desktopOnly: true },
];

export function AmbientBackdrop({
  phase,
  theme,
  viewerRole,
  viewerIsGM,
}: {
  phase: GamePhase;
  theme: ParlorTheme;
  viewerRole: string | null;
  viewerIsGM: boolean;
}) {
  const [roomFailed, setRoomFailed] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const isNight = phase.startsWith('NIGHT_');

  // Phase-reactive atmospheric room lighting
  let auraColor = theme.glowColor;
  let vignetteOpacity = 0.78;
  let roomOpacity = 0.22;

  if (phase === 'NIGHT_MAFIA' && (viewerIsGM || viewerRole === 'Mafia')) {
    auraColor = 'rgba(220, 38, 38, 0.24)';
    vignetteOpacity = 0.86;
    roomOpacity = 0.18;
  } else if (phase === 'NIGHT_BODYGUARD' && (viewerIsGM || viewerRole === 'Bodyguard')) {
    auraColor = 'rgba(56, 189, 248, 0.22)';
    vignetteOpacity = 0.85;
    roomOpacity = 0.18;
  } else if (phase === 'NIGHT_DETECTIVE' && (viewerIsGM || viewerRole === 'Detective')) {
    auraColor = 'rgba(229, 169, 60, 0.24)';
    vignetteOpacity = 0.84;
    roomOpacity = 0.2;
  } else if (isNight) {
    auraColor = 'rgba(56, 189, 248, 0.11)';
    vignetteOpacity = 0.9;
    roomOpacity = 0.13;
  } else if (phase === 'DAY_ANNOUNCE' || phase === 'DAY_DISCUSSION') {
    auraColor = 'rgba(245, 158, 11, 0.18)';
    vignetteOpacity = 0.72;
    roomOpacity = 0.28;
  } else if (phase === 'DAY_VOTING') {
    auraColor = 'rgba(220, 38, 38, 0.16)';
    vignetteOpacity = 0.76;
    roomOpacity = 0.24;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Realistic 1940s Noir Parlor Interior Backdrop */}
      {!roomFailed && (
        <img
          src={RAINY_PARLOR_URL}
          alt=""
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setRoomFailed(true)}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
          style={{ opacity: roomOpacity }}
        />
      )}

      {/* Measured Room Darkness & Vignette Scrim */}
      <div
        className="absolute inset-0 transition-opacity duration-700"
        style={{
          opacity: vignetteOpacity,
          background: `radial-gradient(circle at 50% 35%, transparent 10%, ${theme.bgCanvas}E6 75%, ${theme.bgCanvas} 100%)`,
        }}
      />

      {/* Lightweight GPU Radial Chandelier Glow (avoids heavy blur-3xl repaints on mobile) */}
      <div
        className="absolute -top-20 left-1/2 -translate-x-1/2 w-full max-w-[920px] h-[440px] sm:h-[540px] transition-opacity duration-700"
        style={{
          opacity: isNight ? 0.55 : 0.85,
          background: `radial-gradient(ellipse at center, ${auraColor} 0%, transparent 68%)`,
        }}
      />

      {/* Lightweight CSS-Animated Rain Streaks During Night Phases */}
      {isNight &&
        !prefersReducedMotion &&
        RAIN_STREAKS.map((r) => (
          <div
            key={r.id}
            className={`parlor-rain-streak absolute top-0 w-[1px] h-20 bg-gradient-to-b from-transparent via-sky-200/25 to-transparent ${
              r.desktopOnly ? 'hidden sm:block' : ''
            }`}
            style={{
              left: r.left,
              animationDuration: `${r.dur}s`,
              animationDelay: `${r.delay}s`,
            }}
          />
        ))}

      {/* Subtle Rising Candlelight Embers (compositor transform + opacity only) */}
      {!prefersReducedMotion &&
        MOTES.map((m) => (
          <motion.div
            key={m.id}
            className={`absolute rounded-full ${m.desktopOnly ? 'hidden sm:block' : ''}`}
            style={{
              left: m.left,
              top: m.top,
              width: m.size,
              height: m.size,
              backgroundColor: isNight ? '#93C5FD' : theme.accent,
            }}
            animate={{
              y: [-14, 14, -14],
              opacity: [0.15, 0.5, 0.15],
            }}
            transition={{
              duration: m.dur,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: m.delay,
            }}
          />
        ))}
    </div>
  );
}
