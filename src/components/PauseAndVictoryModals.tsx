import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crown, History, Pause, Play, RotateCcw, Trophy } from 'lucide-react';
import type { ClientGameState } from '../shared/types.ts';
import { AvatarEmblem, getRoleTextColor, TITLE_BACKDROP_URL } from '../utils/avatars.tsx';

export function PauseOverlay({
  state,
  onGmAction,
}: {
  state: ClientGameState;
  onGmAction: (action: string, extra?: Record<string, unknown>) => void;
}) {
  const show = state.isPaused && state.phase !== 'GAME_OVER' && state.phase !== 'LOBBY';

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-40 bg-[#070B14]/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 10 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="max-w-md w-full max-h-[90dvh] overflow-y-auto rounded-2xl border border-amber-400/35 bg-[#0F1624] p-5 sm:p-6 text-center space-y-4 shadow-2xl"
          >
            <motion.div
              animate={{ scale: [1, 1.07, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center mx-auto"
            >
              <Pause size={22} className="text-amber-400" />
            </motion.div>
            <h2 className="font-display text-2xl font-semibold text-white">
              Match Paused
            </h2>
            <p className="text-sm text-slate-300">
              The Game Master has paused Round {state.round}. All timers and actions are frozen until
              resumed.
            </p>
            {state.viewerIsGM && (
              <motion.button
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => onGmAction('RESUME_GAME')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-semibold py-2.5 px-4 text-sm cursor-pointer"
              >
                <Play size={16} />
                <span>Resume Match</span>
              </motion.button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function GameOverView({
  state,
  onGmAction,
  onLeave,
}: {
  state: ClientGameState;
  onGmAction: (action: string, extra?: Record<string, unknown>) => void;
  onLeave: () => void;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const nonGmPlayers = state.players.filter((p) => !p.isGM);
  const winTeam = state.winner?.team || 'Town';
  const accentGlow =
    winTeam === 'Mafia' ? 'rgba(220, 38, 38, 0.28)' : 'rgba(245, 158, 11, 0.25)';

  return (
    <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6">
      {/* MAFIA Game Over! Banner with celebratory spotlight & spring crown */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative rounded-2xl border border-amber-400/45 bg-[#0F1624] overflow-hidden p-5 sm:p-8 text-center space-y-4 shadow-2xl"
        style={{ boxShadow: `0 25px 60px rgba(0,0,0,0.65), 0 0 55px ${accentGlow}` }}
      >
        <img
          src={TITLE_BACKDROP_URL}
          alt="Game Over skyline"
          decoding="async"
          referrerPolicy="no-referrer"
          className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-30"
        />
        <motion.div
          initial={{ x: '-100%' }}
          animate={{ x: '220%' }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
          className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-18deg]"
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(to top, rgba(7,11,20,0.96), rgba(7,11,20,0.55), rgba(7,11,20,0.85))',
          }}
        />
        <div className="relative z-10 space-y-3">
          <motion.div
            initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          >
            <Crown size={40} className="text-amber-400 mx-auto" />
          </motion.div>
          <div className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-amber-400">
            MAFIA
          </div>
          <h2 className="font-display text-3xl font-bold text-white">Game Over!</h2>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.16, duration: 0.3 }}
            className={`text-2xl font-bold inline-flex items-center gap-2 ${
              winTeam === 'Mafia' ? 'text-red-400' : 'text-amber-300'
            }`}
          >
            <Trophy size={22} />
            <span>
              {winTeam === 'Mafia'
                ? 'Mafia Wins!'
                : winTeam === 'Neutral'
                  ? 'Custom Victory!'
                  : 'Town Wins!'}
            </span>
          </motion.div>
          <p className="text-sm text-slate-300 max-w-xl mx-auto">
            {state.winner?.reason}
          </p>

          <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 pt-2">
            {state.viewerIsGM && (
              <motion.button
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() => onGmAction('RESTART_GAME')}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-bold px-5 py-2.5 text-sm cursor-pointer whitespace-nowrap"
              >
                <RotateCcw size={16} />
                <span>Play Again</span>
              </motion.button>
            )}
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#DC2626] hover:bg-red-500 text-white font-semibold px-5 py-2.5 text-sm cursor-pointer whitespace-nowrap"
            >
              <History size={16} />
              <span>{showHistory ? 'Hide Full History' : 'View Full History'}</span>
            </motion.button>
            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={onLeave}
              className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#070B14] hover:bg-white/5 text-slate-200 px-5 py-2.5 text-sm cursor-pointer whitespace-nowrap"
            >
              <span>Back to Lobby</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24 }}
            className="rounded-2xl border border-white/10 bg-[#0F1624] p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold text-white flex items-center gap-2">
                <History size={18} className="text-amber-400" />
                <span>Complete Match History</span>
              </h3>
              <span className="text-xs font-mono-tabular text-slate-400">
                {state.roundHistory.length} {state.roundHistory.length === 1 ? 'round' : 'rounds'}
              </span>
            </div>
            {state.roundHistory.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">
                No completed rounds recorded for this match.
              </div>
            ) : (
              <div className="space-y-2.5">
                {state.roundHistory.map((r) => (
                  <div
                    key={r.round}
                    className="rounded-xl border border-white/10 bg-[#070B14] p-3.5 text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-amber-300">Round {r.round}</span>
                      <span className="font-mono-tabular text-slate-400">
                        {r.remainingAliveCount} Alive
                      </span>
                    </div>
                    <div className="text-slate-200">{r.dayAnnouncementText}</div>
                    {r.mafiaTargetName && (
                      <div className="text-slate-400">
                        Night Actions — Mafia: {r.mafiaTargetName} · Bodyguard:{' '}
                        {r.bodyguardTargetName || 'None'} · Detective:{' '}
                        {r.detectiveTargetName || 'None'}
                      </div>
                    )}
                    <div className="text-slate-300">
                      Vote Elimination: {r.voteEliminatedName || 'Nobody'}
                      {r.voteEliminatedRoleRevealed ? ` (${r.voteEliminatedRoleRevealed})` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Final Role Reveal Dossier */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-2xl border border-white/10 bg-[#0F1624] p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold text-white">
            Final Role Dossier
          </h3>
          <span className="text-xs text-slate-400 inline-flex items-center gap-1">
            <Crown size={13} className="text-amber-400" />
            GM: {state.players.find((p) => p.isGM)?.name}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {nonGmPlayers.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.22 + idx * 0.05, duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -2 }}
              className="rounded-xl border border-white/10 bg-[#070B14] p-3 flex items-center gap-3"
            >
              <AvatarEmblem avatar={p.avatar} isAlive={p.isAlive} />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-white truncate">
                  {p.name}
                </div>
                <div className={`text-xs font-semibold ${getRoleTextColor(p.role)}`}>
                  {p.role}
                </div>
                <div className="text-[11px] text-slate-400">
                  {p.isAlive ? 'Survived' : `Eliminated R${p.eliminatedRound ?? '?'}`}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
