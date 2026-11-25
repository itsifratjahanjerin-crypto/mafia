import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Flame, Gavel, Mail, Moon, Sun, Volume2 } from 'lucide-react';
import type { ClientGameState, PublicPlayer } from '../shared/types.ts';
import { AvatarEmblem, getRoleTextColor, PARLOR_TABLE_URL } from '../utils/avatars.tsx';
import type { ParlorTheme } from '../utils/parlorThemes.ts';

export function ParlorSeatingTable({
  state,
  theme,
  canVoteOnTable,
  canAccuseOnTable,
  onSelectPlayer,
}: {
  state: ClientGameState;
  theme: ParlorTheme;
  canVoteOnTable?: boolean;
  canAccuseOnTable?: boolean;
  onSelectPlayer?: (player: PublicPlayer) => void;
}) {
  const [tableFailed, setTableFailed] = useState(false);
  const players = state.players.filter((p) => !p.isGM);
  const isNight = state.phase.startsWith('NIGHT_');

  const now = Date.now();
  const recentReactions = new Map<string, string>();
  for (const m of state.publicChat) {
    if (m.kind === 'reaction' && now - m.timestamp < 7000) {
      recentReactions.set(m.senderId, m.text);
    }
  }

  const livingCount = players.filter((p) => p.isAlive).length;
  const votedCount = players.filter((p) => p.isAlive && p.hasVotedThisRound).length;

  return (
    <div
      className="rounded-2xl border border-white/10 p-4 sm:p-5 space-y-4 overflow-hidden shadow-xl"
      style={{ backgroundColor: theme.bgSurface }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <span className="font-semibold text-white text-sm">
          Parlor Seating Table
        </span>
        <span className="font-mono-tabular">
          {livingCount} Living · {players.length} Seated
        </span>
      </div>

      {/* Physical Mahogany & Velvet Card Table on md+ with Percentage-Adaptive Seating */}
      <div
        className="hidden md:block relative w-full h-[380px] xl:h-[420px] rounded-2xl border border-white/10 overflow-hidden shadow-inner"
        style={{ backgroundColor: '#05070B' }}
      >
        {/* Photorealistic Overhead Mahogany & Velvet Table Surface */}
        {!tableFailed ? (
          <img
            src={PARLOR_TABLE_URL}
            alt="Vintage mahogany Mafia parlor table"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setTableFailed(true)}
            className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-90"
          />
        ) : (
          <div
            className="pointer-events-none absolute inset-6 rounded-[999px] border-4 border-[#5C3317]"
            style={{
              background: `radial-gradient(circle, ${theme.bgElevated}, #080B12)`,
            }}
          />
        )}

        {/* Phase-Reactive Overhead Hanging Lamp Spotlight */}
        <div
          className="pointer-events-none absolute inset-0 transition-opacity duration-700"
          style={{
            opacity: isNight ? 0.65 : 0.9,
            background: isNight
              ? 'radial-gradient(circle at 50% 50%, rgba(56,189,248,0.16) 0%, rgba(5,7,11,0.58) 55%, rgba(5,7,11,0.88) 100%)'
              : state.phase === 'DAY_VOTING'
                ? 'radial-gradient(circle at 50% 50%, rgba(220,38,38,0.16) 0%, rgba(5,7,11,0.38) 60%, rgba(5,7,11,0.78) 100%)'
                : 'radial-gradient(circle at 50% 50%, rgba(245,158,11,0.2) 0%, rgba(5,7,11,0.34) 60%, rgba(5,7,11,0.74) 100%)',
          }}
        />

        {/* Center Velvet Felt Medallion / Tabletop Prop */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[132px] h-[132px] lg:w-[156px] lg:h-[156px] rounded-full border border-amber-400/30 bg-[#0A0D14]/78 backdrop-blur-[2px] flex flex-col items-center justify-center text-center px-3 shadow-2xl"
          style={{
            boxShadow: `inset 0 0 28px rgba(0,0,0,0.8), 0 0 26px ${theme.glowColor}`,
          }}
        >
          <motion.div
            key={state.phase}
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.28 }}
            className="flex flex-col items-center gap-1"
          >
            {isNight ? (
              <Moon size={22} className="text-[#38BDF8]" />
            ) : state.phase === 'DAY_VOTING' ? (
              <Mail size={22} className="text-amber-400" />
            ) : state.phase === 'DAY_DISCUSSION' ? (
              <Gavel size={22} style={{ color: theme.accent }} />
            ) : (
              <Sun size={22} style={{ color: theme.accent }} />
            )}
            <div
              className="font-mono-tabular text-[10px] lg:text-[11px] font-semibold tracking-wider"
              style={{ color: theme.accent }}
            >
              ROUND {state.round || 1}
            </div>
            <div className="font-display text-xs lg:text-sm font-semibold text-white leading-tight">
              {isNight
                ? 'Night Slumber'
                : state.phase === 'DAY_VOTING'
                  ? `Ballots: ${votedCount}/${livingCount}`
                  : state.phase === 'DAY_DISCUSSION'
                    ? 'Open Debate'
                    : 'Daylight'}
            </div>
          </motion.div>
        </div>

        {/* Seated Player Medallions Around Responsive Elliptical Rim */}
        {players.map((p, index) => {
          const angle = (index / Math.max(1, players.length)) * Math.PI * 2 - Math.PI / 2;
          const leftPct = 50 + Math.cos(angle) * 35;
          const topPct = 50 + Math.sin(angle) * 34;
          const isMe = p.id === state.viewerId;
          const isVotedTarget = state.myVoteTargetId === p.id;
          const isSpeaking = state.voicePeers.includes(p.id);
          const reaction = recentReactions.get(p.id);
          const interactive =
            p.isAlive && (Boolean(canVoteOnTable) || (Boolean(canAccuseOnTable) && !isMe));

          const ballotX = -Math.cos(angle) * 44;
          const ballotY = -Math.sin(angle) * 32;

          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.82 }}
              animate={{ opacity: p.isAlive ? 1 : 0.58, scale: 1 }}
              transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.24) }}
              style={{
                left: `${leftPct}%`,
                top: `${topPct}%`,
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 z-10"
            >
              {/* Floating Reaction Bubble */}
              <AnimatePresence>
                {reaction && (
                  <motion.div
                    key={reaction + p.id}
                    initial={{ opacity: 0, y: 6, scale: 0.7 }}
                    animate={{ opacity: 1, y: -22, scale: 1.15 }}
                    exit={{ opacity: 0, y: -34 }}
                    transition={{ duration: 0.3 }}
                    className="pointer-events-none absolute -top-5 left-1/2 -translate-x-1/2 text-lg z-30"
                  >
                    {reaction}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sealed Ballot Slip sliding inward onto felt when voted */}
              <AnimatePresence>
                {state.phase === 'DAY_VOTING' && p.hasVotedThisRound && (
                  <motion.div
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: 1, x: ballotX, y: ballotY, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    transition={{ type: 'spring', stiffness: 280, damping: 22 }}
                    className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 rounded border border-amber-400/50 bg-[#1B1710] px-1.5 py-0.5 shadow-lg flex items-center gap-1"
                  >
                    <Mail size={10} className="text-amber-300" />
                    <span className="text-[9px] font-semibold text-amber-200">Vote</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Voice Chat Live Soundwave Halo */}
              {isSpeaking && (
                <div className="pointer-events-none absolute -inset-1 rounded-xl border border-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.45)]" />
              )}

              <motion.button
                type="button"
                disabled={!interactive}
                whileHover={interactive ? { y: -2, scale: 1.03 } : undefined}
                whileTap={interactive ? { scale: 0.97 } : undefined}
                onClick={() => interactive && onSelectPlayer?.(p)}
                className={`group relative flex items-center gap-2 rounded-xl border px-2.5 py-2 min-w-[106px] xl:min-w-[120px] max-w-[140px] text-left transition-colors shadow-lg ${
                  interactive ? 'cursor-pointer' : 'cursor-default'
                }`}
                style={{
                  backgroundColor: isVotedTarget ? `${theme.accent}2E` : 'rgba(13, 17, 26, 0.94)',
                  borderColor: isVotedTarget
                    ? theme.accent
                    : isSpeaking
                      ? '#10B981'
                      : isMe
                        ? `${theme.accent}80`
                        : 'rgba(255,255,255,0.16)',
                }}
              >
                <AvatarEmblem avatar={p.avatar} isAlive={p.isAlive} size="sm" />
                <div className="min-w-0 flex-1">
                  <div
                    className={`text-xs font-semibold truncate ${
                      p.isAlive ? 'text-white' : 'line-through text-slate-400'
                    }`}
                  >
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                    {!p.isAlive ? (
                      <span className="text-red-400 font-semibold">
                        {p.roleRevealed && p.role ? p.role : 'Eliminated'}
                      </span>
                    ) : (
                      <>
                        {!isNight && (
                          <Flame size={9} className="text-amber-400/80 shrink-0" />
                        )}
                        <span className="truncate">
                          {state.viewerIsGM && p.role
                            ? p.role
                            : canVoteOnTable
                              ? isVotedTarget
                                ? 'Selected'
                                : 'Tap to vote'
                              : canAccuseOnTable && !isMe
                                ? 'Tap to accuse'
                                : isMe
                                  ? 'You'
                                  : 'Seated'}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {isSpeaking && (
                  <Volume2 size={12} className="text-emerald-400 shrink-0" />
                )}
                {state.phase === 'DAY_VOTING' && p.hasVotedThisRound && (
                  <Check size={12} style={{ color: theme.accent }} className="shrink-0" />
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </div>

      {/* Touch-Friendly Responsive Grid for Mobile (< md) */}
      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-2.5 md:hidden">
        {players.map((p) => {
          const isMe = p.id === state.viewerId;
          const isVotedTarget = state.myVoteTargetId === p.id;
          const isSpeaking = state.voicePeers.includes(p.id);
          const interactive =
            p.isAlive && (Boolean(canVoteOnTable) || (Boolean(canAccuseOnTable) && !isMe));
          return (
            <button
              key={p.id}
              type="button"
              disabled={!interactive}
              onClick={() => interactive && onSelectPlayer?.(p)}
              className={`rounded-xl border p-3 min-h-[58px] flex items-center justify-between gap-2 text-left transition-colors ${
                interactive ? 'cursor-pointer active:scale-[0.98]' : 'cursor-default'
              }`}
              style={{
                backgroundColor: isVotedTarget ? `${theme.accent}20` : theme.bgCanvas,
                borderColor: isVotedTarget
                  ? theme.accent
                  : isSpeaking
                    ? '#10B981'
                    : 'rgba(255,255,255,0.1)',
                opacity: p.isAlive ? 1 : 0.65,
              }}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <AvatarEmblem avatar={p.avatar} isAlive={p.isAlive} size="sm" />
                <div className="min-w-0">
                  <div
                    className={`text-xs sm:text-sm font-medium truncate ${
                      p.isAlive ? 'text-white' : 'line-through text-slate-400'
                    }`}
                  >
                    {p.name} {isMe ? '(You)' : ''}
                  </div>
                  <div
                    className={`text-[11px] truncate ${
                      !p.isAlive
                        ? p.roleRevealed
                          ? getRoleTextColor(p.role)
                          : 'text-red-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {!p.isAlive
                      ? p.roleRevealed && p.role
                        ? p.role
                        : 'Eliminated'
                      : canVoteOnTable
                        ? isVotedTarget
                          ? 'Voted'
                          : 'Tap to vote'
                        : canAccuseOnTable && !isMe
                          ? 'Tap to accuse'
                          : 'Alive'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {isSpeaking && <Volume2 size={13} className="text-emerald-400" />}
                {state.phase === 'DAY_VOTING' && p.hasVotedThisRound && (
                  <Check size={13} style={{ color: theme.accent }} />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
