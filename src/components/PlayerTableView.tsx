import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Crosshair,
  Eye,
  EyeOff,
  Gavel,
  HeadphoneOff,
  Headphones,
  History,
  Megaphone,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  Search,
  Send,
  Shield,
  Skull,
  Sun,
  Trophy,
  Volume2,
  Vote,
} from 'lucide-react';
import type { ClientGameState, PublicPlayer } from '../shared/types.ts';
import {
  AvatarEmblem,
  getRoleDescription,
  getRoleTextColor,
  ROLE_CARD_IMAGES,
  RoleCardArtwork,
} from '../utils/avatars.tsx';
import { soundFx } from '../utils/soundFx.ts';
import { voiceNarrator } from '../utils/voiceNarrator.ts';
import type { ParlorTheme } from '../utils/parlorThemes.ts';
import { ParlorSeatingTable } from './ParlorSeatingTable.tsx';

const QUICK_REACTIONS = ['👀', '🤔', '👍', '⚖️', '🛡️'];

export function PlayerTableView({
  state,
  theme,
  activeSection,
  micActive,
  deafened,
  isLocalSpeaking,
  voiceError,
  onToggleMic,
  onToggleDeafen,
  onSendMessage,
}: {
  state: ClientGameState;
  theme: ParlorTheme;
  activeSection: 'room' | 'settings' | 'history';
  micActive: boolean;
  deafened: boolean;
  isLocalSpeaking: boolean;
  voiceError: string | null;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
  onSendMessage: (type: string, payload: Record<string, unknown>) => void;
}) {
  const [concealRole, setConcealRole] = useState(false);
  const [selectedNightTarget, setSelectedNightTarget] = useState<string>('');
  const [pendingVoteId, setPendingVoteId] = useState<string>('');
  const [rightTab, setRightTab] = useState<'chat' | 'dead' | 'log'>('chat');
  const [chatInput, setChatInput] = useState('');
  const [mafiaChatInput, setMafiaChatInput] = useState('');
  const [deadChatInput, setDeadChatInput] = useState('');
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const update = () => {
      if (state.isPaused && state.pausedRemainingMs !== null) {
        setSecondsLeft(Math.ceil(state.pausedRemainingMs / 1000));
      } else if (state.phaseEndsAt) {
        setSecondsLeft(Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)));
      } else {
        setSecondsLeft(null);
      }
    };
    update();
    const t = window.setInterval(update, 400);
    return () => window.clearInterval(t);
  }, [state.isPaused, state.pausedRemainingMs, state.phaseEndsAt]);

  const me = state.players.find((p) => p.id === state.viewerId);
  const nonGmPlayers = state.players.filter((p) => !p.isGM);
  const livingPlayers = nonGmPlayers.filter((p) => p.isAlive);
  const isNight = state.phase.startsWith('NIGHT_');

  const isMyMafiaTurn =
    state.viewerIsAlive && state.viewerRole === 'Mafia' && state.phase === 'NIGHT_MAFIA';
  const isMyBodyguardTurn =
    state.viewerIsAlive &&
    state.viewerRole === 'Bodyguard' &&
    state.phase === 'NIGHT_BODYGUARD';
  const isMyDetectiveTurn =
    state.viewerIsAlive &&
    state.viewerRole === 'Detective' &&
    state.phase === 'NIGHT_DETECTIVE';
  const myCustomRole = state.customRoles.find((c) => c.name === state.viewerRole);
  const isMyCustomNightTurn =
    state.viewerIsAlive &&
    Boolean(myCustomRole && myCustomRole.nightAction !== 'none') &&
    state.phase === 'NIGHT_CUSTOM';

  const mafiaTeammates =
    state.viewerRole === 'Mafia' && state.settings.mafiaKnowEachOther
      ? nonGmPlayers.filter((p) => p.role === 'Mafia' && p.id !== state.viewerId)
      : [];

  const handleConfirmNightTarget = () => {
    if (!selectedNightTarget) return;
    if (isMyMafiaTurn) soundFx.playHeartbeat();
    else if (isMyBodyguardTurn) soundFx.playShieldLock();
    else soundFx.playVoteClick();
    onSendMessage('NIGHT_ACTION', { targetId: selectedNightTarget });
  };

  const handleConfirmVote = () => {
    const choice = pendingVoteId || state.myVoteTargetId;
    if (!choice) return;
    soundFx.playVoteClick();
    onSendMessage('CAST_VOTE', { targetId: choice });
  };

  const handleSendPublicChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage('CHAT_SEND', { channel: 'public', text: chatInput.trim() });
    setChatInput('');
  };

  const handleSendMafiaChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mafiaChatInput.trim()) return;
    onSendMessage('CHAT_SEND', { channel: 'mafia', text: mafiaChatInput.trim() });
    setMafiaChatInput('');
  };

  const handleSendDeadChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deadChatInput.trim()) return;
    onSendMessage('CHAT_SEND', { channel: 'dead', text: deadChatInput.trim() });
    setDeadChatInput('');
  };

  const canPostPublic =
    state.viewerIsAlive && !me?.isMuted && (me?.canSpeak ?? true) && !isNight;

  const handleTablePlayerClick = (p: PublicPlayer) => {
    if (state.phase === 'DAY_VOTING' && state.viewerIsAlive) {
      setPendingVoteId(p.id);
      soundFx.playVoteClick();
      onSendMessage('CAST_VOTE', { targetId: p.id });
    } else if (state.phase === 'DAY_DISCUSSION' && canPostPublic && p.id !== state.viewerId) {
      onSendMessage('CHAT_SEND', {
        channel: 'public',
        text: `I suspect ${p.name}!`,
        kind: 'accuse',
        targetPlayerName: p.name,
      });
    }
  };

  const effectiveTab = activeSection === 'history' ? 'log' : rightTab;

  return (
    <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
      {/* LEFT COLUMN: YOUR SECRET ROLE Card matching Mockup */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-4 min-w-0">
        <div
          className="rounded-2xl border p-4 space-y-3.5"
          style={{
            backgroundColor: theme.bgSurface,
            borderColor:
              state.viewerRole === 'Mafia'
                ? 'rgba(220,38,38,0.4)'
                : state.viewerRole === 'Bodyguard'
                  ? 'rgba(56,189,248,0.35)'
                  : 'rgba(255,255,255,0.12)',
          }}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
            <div>
              <span className="text-[11px] font-semibold tracking-wider text-slate-300">
                YOUR VIEW · {me?.name || 'PLAYER'}
              </span>
              <div className={`text-[11px] font-semibold ${state.viewerIsAlive ? 'text-emerald-400' : 'text-red-400'}`}>
                {state.viewerIsAlive ? 'Alive' : 'Eliminated'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                soundFx.playCardFlip();
                setConcealRole((v) => !v);
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[11px] text-slate-300 hover:text-white cursor-pointer"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              {concealRole ? <Eye size={12} /> : <EyeOff size={12} />}
              <span>{concealRole ? 'Peek' : 'Hide'}</span>
            </button>
          </div>

          {!concealRole && (
            <div className="flex items-center justify-center gap-2 py-1">
              {state.viewerRole === 'Mafia' && <Skull size={20} className="text-red-500" />}
              {state.viewerRole === 'Detective' && <Search size={20} className="text-sky-400" />}
              {state.viewerRole === 'Bodyguard' && <Shield size={20} className="text-blue-400" />}
              <span
                className={`font-display text-2xl font-bold tracking-wide ${getRoleTextColor(
                  state.viewerRole
                )}`}
              >
                {(state.viewerRole || 'UNASSIGNED').toUpperCase()}
              </span>
            </div>
          )}

          {/* 3D Flipping Role Card with Deal Entrance & Foil Sheen */}
          <motion.div
            initial={{ opacity: 0, y: 20, rotateZ: -3, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, rotateZ: 0, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="perspective-1000"
          >
            <motion.div
              animate={{ rotateY: concealRole ? 180 : 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 24 }}
              onClick={() => {
                soundFx.playCardFlip();
                setConcealRole((v) => !v);
              }}
              className="relative w-full aspect-[3/4] max-h-[250px] mx-auto cursor-pointer preserve-3d"
            >
              <div className="absolute inset-0 backface-hidden rounded-xl overflow-hidden shadow-xl">
                <RoleCardArtwork
                  role={state.viewerRole || 'Villager'}
                  className="w-full h-full"
                />
                {/* Tactile diagonal metallic sheen */}
                <motion.div
                  animate={{ x: ['-120%', '220%'] }}
                  transition={{ duration: 5.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                  className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/15 to-transparent skew-x-[-20deg]"
                />
              </div>
              <div
                className="absolute inset-0 backface-hidden rotate-y-180 rounded-xl border-2 flex flex-col items-center justify-center p-5 text-center"
                style={{
                  backgroundColor: theme.bgCanvas,
                  borderColor: `${theme.accent}66`,
                }}
              >
                <EyeOff size={26} className="text-slate-400 mb-2" />
                <div className="font-display text-base font-semibold text-white">
                  Role Hidden
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Click to reveal privately</p>
              </div>
            </motion.div>
          </motion.div>

          {!concealRole && (
            <div className="space-y-2.5 text-center">
              <div
                className="rounded-xl border border-white/10 p-3 text-left space-y-1.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] font-semibold text-amber-300">Your Goal</div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!voiceNarrator.isEnabled()) {
                        voiceNarrator.setEnabled(true);
                      }
                      voiceNarrator.speakRoleBriefing(state, { force: true });
                    }}
                    title="Hear your secret role and rules in English"
                    className="inline-flex items-center gap-1 rounded-md border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <Volume2 size={11} />
                    <span>Hear Rules</span>
                  </button>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {myCustomRole
                    ? myCustomRole.description
                    : getRoleDescription(state.viewerRole)}
                </p>
              </div>

              {mafiaTeammates.length > 0 && (
                <div className="text-xs text-slate-300">
                  Your teammate:{' '}
                  <span className="text-red-400 font-semibold">
                    {mafiaTeammates.map((m) => m.name).join(', ')}
                  </span>
                </div>
              )}

              <div className="rounded-xl border border-red-500/30 bg-red-950/35 px-3 py-2 text-xs text-red-200 flex items-center justify-center gap-1.5">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span>Keep your role secret!</span>
              </div>

              {state.viewerRole === 'Detective' &&
                state.nightState?.detectiveHistory &&
                state.nightState.detectiveHistory.length > 0 && (
                  <div
                    className="rounded-xl border border-white/10 p-3 text-left text-xs space-y-1"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div className="font-semibold text-amber-300">Investigation Log</div>
                    {state.nightState.detectiveHistory.map((rec) => (
                      <div key={rec.round} className="flex justify-between text-slate-200">
                        <span>
                          R{rec.round}: {rec.targetName}
                        </span>
                        <span className={rec.isMafia ? 'text-red-400' : 'text-emerald-400'}>
                          {rec.isMafia ? 'Mafia' : 'Not Mafia'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}

          {/* Tabular Game Info Summary Box */}
          <div
            className="rounded-xl border border-white/10 p-3 space-y-1.5 text-xs"
            style={{ backgroundColor: theme.bgCanvas }}
          >
            <div className="flex items-center justify-between text-slate-300">
              <span>Players Alive</span>
              <span className="font-mono-tabular font-bold text-white">
                {livingPlayers.length} / {nonGmPlayers.length}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-300">
              <span>Current Round</span>
              <span className="font-mono-tabular font-bold text-amber-300">
                Round {state.round}
              </span>
            </div>
            {secondsLeft !== null && (
              <div className="flex items-center justify-between text-slate-300">
                <span>Phase Timer</span>
                <span className="font-mono-tabular font-bold text-white">
                  {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                  {String(secondsLeft % 60).padStart(2, '0')}
                </span>
              </div>
            )}
          </div>

          {!state.viewerIsAlive && (
            <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-xs text-slate-300 flex items-center gap-2">
              <Skull size={14} className="text-red-400 shrink-0" />
              <span>Eliminated · Spectator Mode</span>
            </div>
          )}
        </div>
      </div>

      {/* CENTER STAGE: Matching Mockup Action & Phase Cards */}
      <div className="lg:col-span-8 xl:col-span-5 space-y-4 sm:space-y-5 min-w-0">
        <AnimatePresence mode="wait">
          {/* MAFIA ACTION CARD (Crimson portrait grid matching Mockup) */}
          {isMyMafiaTurn && (
            <motion.div
              key="mafia-action-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="relative overflow-hidden rounded-2xl border border-red-500/50 bg-[#120A0E] p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl overflow-hidden border border-red-500/45 shrink-0">
                    <img
                      src={ROLE_CARD_IMAGES.Mafia}
                      alt="Mafia emblem"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-red-400">
                      Mafia’s Turn
                    </h2>
                    <p className="text-xs text-slate-300">Choose your target secretly...</p>
                  </div>
                </div>
                <div className="inline-flex items-center gap-1.5 text-xs font-mono-tabular text-slate-300">
                  <Clock size={14} className="text-red-400" />
                  <span>00:{String(state.settings.nightDuration).padStart(2, '0')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {livingPlayers.map((p) => {
                  const serverPick = state.nightState?.mafiaSelections?.[state.viewerId];
                  const isPicked = (selectedNightTarget || serverPick) === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.97 }}
                      type="button"
                      disabled={Boolean(state.nightState?.mafiaLocked)}
                      onClick={() => {
                        soundFx.playHeartbeat();
                        setSelectedNightTarget(p.id);
                      }}
                      className={`relative rounded-xl border p-2.5 flex flex-col items-center gap-2 transition-colors cursor-pointer ${
                        isPicked
                          ? 'border-red-500 bg-red-950/55 shadow-[0_0_20px_rgba(220,38,38,0.4)]'
                          : 'border-white/10 bg-[#0B0D14] hover:border-red-400/50'
                      }`}
                    >
                      {isPicked && (
                        <motion.span
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute top-1.5 right-1.5 text-red-400"
                        >
                          <Crosshair size={14} />
                        </motion.span>
                      )}
                      <AvatarEmblem avatar={p.avatar} size="lg" />
                      <span className="text-xs font-semibold text-white truncate max-w-full">
                        {p.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <button
                  type="button"
                  disabled={!selectedNightTarget || Boolean(state.nightState?.mafiaLocked)}
                  onClick={handleConfirmNightTarget}
                  className="w-full py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-500 disabled:opacity-45 text-white font-semibold text-sm cursor-pointer"
                >
                  {state.nightState?.mafiaSelections?.[state.viewerId]
                    ? 'Update Target'
                    : 'Confirm Target'}
                </button>
                <div className="text-[11px] text-center text-slate-400">
                  Your choice is private and visible only to the Game Master and Mafia.
                </div>
              </div>

              {state.settings.mafiaTeamCommunication && (
                <div className="pt-3 border-t border-red-500/20 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-red-300">
                      Mafia Night Comms (Private)
                    </div>
                    {state.settings.voiceChatEnabled && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(me?.isMuted || !me?.canSpeak)}
                          onClick={onToggleMic}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                            micActive
                              ? isLocalSpeaking
                                ? 'bg-red-500 text-white shadow-[0_0_14px_rgba(239,68,68,0.55)]'
                                : 'bg-red-600 text-white'
                              : 'border border-red-500/35 bg-black/50 text-red-200 hover:border-red-400'
                          }`}
                        >
                          {micActive ? <Mic size={12} /> : <MicOff size={12} />}
                          <span>{micActive ? 'Mafia Voice Live' : 'Mafia Voice'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={onToggleDeafen}
                          aria-label={deafened ? 'Unmute speakers' : 'Deafen speakers'}
                          className={`p-1.5 rounded-lg border cursor-pointer ${
                            deafened
                              ? 'border-red-500/50 bg-red-950/60 text-red-300'
                              : 'border-white/10 bg-black/50 text-slate-300'
                          }`}
                        >
                          {deafened ? <HeadphoneOff size={12} /> : <Headphones size={12} />}
                        </button>
                      </div>
                    )}
                  </div>
                  {voiceError && <div className="text-[11px] text-amber-300">{voiceError}</div>}
                  <div className="max-h-28 overflow-y-auto space-y-1 text-xs">
                    {state.mafiaChat.map((m) => (
                      <div key={m.id} className="bg-black/40 rounded-lg px-2.5 py-1.5 text-slate-200">
                        <span className="font-semibold text-red-300 mr-1.5">{m.senderName}:</span>
                        {m.text}
                      </div>
                    ))}
                  </div>
                  <form onSubmit={handleSendMafiaChat} className="flex gap-2">
                    <input
                      type="text"
                      value={mafiaChatInput}
                      onChange={(e) => setMafiaChatInput(e.target.value)}
                      placeholder="Discuss target with fellow Mafia..."
                      className="flex-1 min-w-0 rounded-lg bg-black/50 border border-red-500/25 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
                    />
                    <button
                      type="submit"
                      className="rounded-lg bg-[#DC2626] text-white px-3.5 py-2 min-h-[40px] text-xs font-medium cursor-pointer shrink-0"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </motion.div>
          )}

          {/* BODYGUARD ACTION CARD */}
          {isMyBodyguardTurn && (
            <motion.div
              key="bodyguard-action-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-sky-500/45 bg-[#0A1320] p-5 space-y-4 shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-sky-500/20 pb-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-sky-400/45 shrink-0">
                  <img
                    src={ROLE_CARD_IMAGES.Bodyguard}
                    alt="Bodyguard emblem"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold text-sky-300">
                    Bodyguard’s Turn
                  </h2>
                  <p className="text-xs text-slate-300">
                    Choose someone to protect tonight
                    {!state.settings.bodyguardSelfProtect && ' (Self-protection disabled)'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {livingPlayers.map((p) => {
                  const disabledSelf =
                    p.id === state.viewerId && !state.settings.bodyguardSelfProtect;
                  const isPicked =
                    (selectedNightTarget || state.nightState?.bodyguardTargetId) === p.id;
                  return (
                    <motion.button
                      key={p.id}
                      whileHover={!disabledSelf ? { y: -2 } : undefined}
                      whileTap={!disabledSelf ? { scale: 0.96 } : undefined}
                      type="button"
                      disabled={disabledSelf || Boolean(state.nightState?.bodyguardLocked)}
                      onClick={() => {
                        soundFx.playShieldLock();
                        setSelectedNightTarget(p.id);
                      }}
                      className={`relative rounded-xl border p-2.5 flex flex-col items-center gap-2 transition-colors cursor-pointer disabled:opacity-40 ${
                        isPicked
                          ? 'border-sky-400 bg-sky-950/55 shadow-[0_0_20px_rgba(56,189,248,0.35)]'
                          : 'border-white/10 bg-[#0B0D14] hover:border-sky-400/50'
                      }`}
                    >
                      {isPicked && (
                        <motion.span
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="absolute top-1.5 right-1.5 text-sky-400"
                        >
                          <Shield size={13} />
                        </motion.span>
                      )}
                      <AvatarEmblem avatar={p.avatar} size="lg" />
                      <span className="text-xs font-semibold text-white truncate max-w-full">
                        {p.name}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              <div className="space-y-1.5">
                <motion.button
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  disabled={!selectedNightTarget || Boolean(state.nightState?.bodyguardLocked)}
                  onClick={handleConfirmNightTarget}
                  className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 disabled:opacity-45 text-[#070B14] font-semibold text-sm cursor-pointer"
                >
                  Confirm Protection
                </motion.button>
                <div className="text-[11px] text-center text-slate-400">
                  Your protection is private and blocks Mafia eliminations on that player.
                </div>
              </div>
            </motion.div>
          )}

          {/* DETECTIVE ACTION & INVESTIGATION RESULT CARD */}
          {isMyDetectiveTurn && (
            <motion.div
              key="detective-action-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="rounded-2xl border border-emerald-500/45 bg-[#081A14] p-5 space-y-4 shadow-xl"
            >
              {state.nightState?.detectiveTargetId ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.94 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="py-4 text-center space-y-4"
                >
                  <div className="text-sm font-semibold text-slate-200">
                    Case Dossier — Investigation Result
                  </div>
                  <div className="flex justify-center">
                    {state.nightState.detectiveResultIsMafia ? (
                      <motion.div
                        initial={{ scale: 1.5, rotate: -14, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        className="w-20 h-20 rounded-full border-4 border-red-500 bg-red-500/15 flex items-center justify-center shadow-[0_0_28px_rgba(220,38,38,0.35)]"
                      >
                        <Skull size={36} className="text-red-400" />
                      </motion.div>
                    ) : (
                      <motion.div
                        initial={{ scale: 1.5, rotate: 12, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
                        className="w-20 h-20 rounded-full border-4 border-emerald-500 bg-emerald-500/15 flex items-center justify-center shadow-[0_0_28px_rgba(16,185,129,0.3)]"
                      >
                        <CheckCircle2 size={40} className="text-emerald-400" />
                      </motion.div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="text-base text-slate-200">This player is</div>
                    <div
                      className={`text-xl font-bold ${
                        state.nightState.detectiveResultIsMafia
                          ? 'text-red-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {state.nightState.detectiveResultIsMafia ? 'MAFIA!' : 'NOT Mafia!'}
                    </div>
                    <div className="text-xs text-slate-400">
                      (Player:{' '}
                      {
                        state.players.find(
                          (p) => p.id === state.nightState?.detectiveTargetId
                        )?.name
                      }
                      )
                    </div>
                  </div>
                </motion.div>
              ) : (
                <>
                  <div className="flex items-center gap-3 border-b border-emerald-500/20 pb-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-400/45 shrink-0">
                      <img
                        src={ROLE_CARD_IMAGES.Detective}
                        alt="Detective emblem"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold text-emerald-300">
                        Detective’s Turn
                      </h2>
                      <p className="text-xs text-slate-300">
                        Select a player to investigate tonight
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {livingPlayers
                      .filter((p) => p.id !== state.viewerId)
                      .map((p) => (
                        <motion.button
                          key={p.id}
                          whileHover={{ y: -2 }}
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => {
                            soundFx.playStamp();
                            onSendMessage('NIGHT_ACTION', { targetId: p.id });
                          }}
                          className="rounded-xl border border-white/10 bg-[#0B0D14] hover:border-emerald-400/60 p-2.5 flex flex-col items-center gap-2 cursor-pointer"
                        >
                          <AvatarEmblem avatar={p.avatar} size="lg" />
                          <span className="text-xs font-semibold text-white truncate max-w-full">
                            {p.name}
                          </span>
                        </motion.button>
                      ))}
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* CUSTOM NIGHT ROLE */}
          {isMyCustomNightTurn && myCustomRole && (
            <motion.div
              key="custom-night-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-indigo-400/40 p-5 space-y-4"
              style={{ backgroundColor: theme.bgSurface }}
            >
              <h2 className="font-display text-xl font-semibold text-white">
                {myCustomRole.name} — Night Action
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {livingPlayers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSendMessage('NIGHT_ACTION', { targetId: p.id })}
                    className="rounded-xl border border-white/10 bg-[#0B0D14] hover:border-indigo-400/60 p-2.5 flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <AvatarEmblem avatar={p.avatar} size="lg" />
                    <span className="text-xs font-semibold text-white">{p.name}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          {/* NIGHT WAITING SCREEN */}
          {isNight &&
            !isMyMafiaTurn &&
            !isMyBodyguardTurn &&
            !isMyDetectiveTurn &&
            !isMyCustomNightTurn && (
              <motion.div
                key="night-waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl border border-white/10 p-10 text-center space-y-4"
                style={{ backgroundColor: theme.bgSurface }}
              >
                <Moon size={36} className="text-sky-400 mx-auto" />
                <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">
                  🌙 NIGHT PHASE
                </h2>
                <p className="text-sm text-slate-300">
                  Everyone close your eyes... The Game Master is calling night roles.
                </p>
              </motion.div>
            )}

          {/* DAY / VOTING / ROUND RESULTS */}
          {!isNight && (
            <motion.div
              key="day-phase-area"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {state.dayAnnouncement && (
                <motion.div
                  key={state.dayAnnouncement.headline}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="relative overflow-hidden rounded-2xl border border-amber-400/35 p-5 space-y-2"
                  style={{ backgroundColor: theme.bgSurface }}
                >
                  <motion.div
                    initial={{ x: '-100%' }}
                    animate={{ x: '220%' }}
                    transition={{ duration: 1.3, ease: 'easeOut' }}
                    className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-amber-400/10 to-transparent skew-x-[-18deg]"
                  />
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                    <Sun size={16} />
                    <span>DAY PHASE · SUNRISE ANNOUNCEMENT</span>
                  </div>
                  <p className="font-display text-xl font-semibold text-white">
                    {state.dayAnnouncement.headline}
                  </p>
                </motion.div>
              )}

              {/* DAY PHASE DISCUSSION COUNTDOWN CARD */}
              {state.phase === 'DAY_DISCUSSION' && (
                <div className="rounded-2xl border border-amber-400/40 bg-gradient-to-br from-[#23190B] to-[#0F1624] p-5 space-y-3 shadow-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                        <Megaphone size={18} className="text-amber-300" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-bold text-white">
                          Day Phase · Discussion
                        </h2>
                        <p className="text-xs text-amber-200/85">
                          Make your argument and find the Mafia!
                        </p>
                      </div>
                    </div>
                    {secondsLeft !== null && (
                      <div className="font-mono-tabular text-2xl font-bold text-amber-300 shrink-0">
                        {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                        {String(secondsLeft % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                  {secondsLeft !== null && state.settings.discussionDuration > 0 && (
                    <div className="h-2 rounded-full bg-black/45 overflow-hidden border border-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(100, (secondsLeft / state.settings.discussionDuration) * 100)
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* VOTING PHASE CARD */}
              {state.phase === 'DAY_VOTING' && (
                <div className="rounded-2xl border border-indigo-400/45 bg-gradient-to-br from-[#16122E] to-[#0F1624] p-5 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Vote size={20} className="text-indigo-300" />
                      <div>
                        <h2 className="font-display text-xl font-bold text-white">
                          Voting Phase
                        </h2>
                        <p className="text-xs text-slate-300">
                          Vote to eliminate a player
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-mono-tabular text-indigo-300">
                      {state.settings.anonymousVoting ? 'Anonymous' : 'Public'}
                    </span>
                  </div>

                  {!state.viewerIsAlive ? (
                    <div className="text-xs text-slate-400">
                      Eliminated spectators cannot vote.
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {livingPlayers.map((p) => {
                          const selected = (pendingVoteId || state.myVoteTargetId) === p.id;
                          return (
                            <motion.button
                              key={p.id}
                              whileHover={{ y: -2 }}
                              whileTap={{ scale: 0.97 }}
                              type="button"
                              onClick={() => setPendingVoteId(p.id)}
                              className={`rounded-xl border p-2.5 flex flex-col items-center gap-2 cursor-pointer ${
                                selected
                                  ? 'border-indigo-400 bg-indigo-500/20 shadow-[0_0_16px_rgba(129,140,248,0.35)]'
                                  : 'border-white/10 bg-[#0B0D14] hover:border-indigo-400/50'
                              }`}
                            >
                              <AvatarEmblem avatar={p.avatar} size="lg" />
                              <span className="text-xs font-semibold text-white truncate max-w-full">
                                {p.name}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>

                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={handleConfirmVote}
                            disabled={!pendingVoteId && !state.myVoteTargetId}
                            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-45 text-white font-bold text-sm cursor-pointer"
                          >
                            Submit Vote
                          </button>
                          {state.settings.allowNoVote && (
                            <button
                              type="button"
                              onClick={() => {
                                setPendingVoteId('NO_VOTE');
                                soundFx.playVoteClick();
                                onSendMessage('CAST_VOTE', { targetId: 'NO_VOTE' });
                              }}
                              className="px-4 py-2.5 rounded-xl border border-white/15 bg-[#0B0D14] text-xs font-semibold text-slate-200 cursor-pointer"
                            >
                              Skip Vote
                            </button>
                          )}
                        </div>
                        <div className="text-[11px] text-center text-slate-400">
                          {state.settings.allowVoteChange
                            ? 'You can change your vote anytime before voting closes.'
                            : 'Your vote locks once submitted.'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* VOTE RESULT */}
              {state.phase === 'DAY_VOTE_RESULT' && state.voteResult && (
                <div
                  className="rounded-2xl border border-white/10 p-5 space-y-3"
                  style={{ backgroundColor: theme.bgSurface }}
                >
                  <div className="flex items-center gap-2">
                    <Gavel size={18} className="text-amber-400" />
                    <h3 className="font-display text-lg font-semibold text-white">
                      Ballot Tally — Round {state.round}
                    </h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    {Object.entries(state.voteResult.counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([targetId, count]) => {
                        const label =
                          targetId === 'NO_VOTE'
                            ? 'Skip / No Vote'
                            : state.players.find((p) => p.id === targetId)?.name || 'Unknown';
                        const ratio =
                          state.voteResult && state.voteResult.totalVotes > 0
                            ? Math.min(1, count / state.voteResult.totalVotes)
                            : 0;
                        return (
                          <div
                            key={targetId}
                            className="relative overflow-hidden flex items-center justify-between rounded-lg px-3 py-2 border border-white/5"
                            style={{ backgroundColor: theme.bgCanvas }}
                          >
                            <motion.div
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: ratio }}
                              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                              className="pointer-events-none absolute inset-0 origin-left bg-amber-500/15"
                            />
                            <span className="relative z-10 text-slate-200 font-medium">
                              {label}
                            </span>
                            <span className="relative z-10 font-mono-tabular font-semibold text-amber-300">
                              {count} {count === 1 ? 'ballot' : 'ballots'}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* ROUND X RESULTS CARD matching Mockup */}
              {state.phase === 'ROUND_COMPLETE' && state.lastRoundSummary && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="rounded-2xl border border-amber-400/45 p-6 text-center space-y-4"
                  style={{ backgroundColor: theme.bgSurface }}
                >
                  <motion.div
                    initial={{ scale: 0.6, rotate: -10, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 18 }}
                  >
                    <Trophy size={34} className="text-amber-400 mx-auto" />
                  </motion.div>
                  <div className="font-display text-xl font-bold text-white">
                    ROUND {state.lastRoundSummary.round} RESULTS
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-center">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="rounded-xl border border-white/10 p-3"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <div className="text-[11px] text-slate-400">Player Eliminated</div>
                      <div className="text-sm font-bold text-red-400 mt-1">
                        {state.lastRoundSummary.voteEliminatedName ||
                          state.lastRoundSummary.nightVictimName ||
                          'Nobody'}
                      </div>
                    </motion.div>
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.16 }}
                      className="rounded-xl border border-white/10 p-3"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <div className="text-[11px] text-slate-400">Role</div>
                      <div className="text-sm font-bold text-emerald-400 mt-1">
                        {state.lastRoundSummary.voteEliminatedRoleRevealed ||
                          state.lastRoundSummary.nightVictimRoleRevealed ||
                          'Hidden'}
                      </div>
                    </motion.div>
                  </div>
                  <div className="text-xs font-mono-tabular text-slate-300">
                    Remaining Players: {state.lastRoundSummary.remainingAliveCount}
                  </div>
                </motion.div>
              )}

              {/* Day Parlor Voice & Quick Discussion Actions */}
              {(state.settings.voiceChatEnabled ||
                (state.phase === 'DAY_DISCUSSION' && state.viewerIsAlive)) && (
                <div
                  className="rounded-2xl border border-white/10 p-4 space-y-3"
                  style={{ backgroundColor: theme.bgSurface }}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-white">
                        <Volume2 size={15} className="text-emerald-400 shrink-0" />
                        <span>
                          {state.phase === 'DAY_DISCUSSION'
                            ? 'Discuss and find the Mafia!'
                            : 'Parlor Live Voice'}
                        </span>
                      </div>
                      {state.settings.voiceChatEnabled && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {state.voicePeers.length > 0
                            ? `Live on mic: ${state.voicePeers
                                .map((id) => state.players.find((p) => p.id === id)?.name)
                                .filter(Boolean)
                                .join(', ')}`
                            : state.viewerIsAlive
                              ? 'Click Join Voice to talk live with the table.'
                              : 'Listening to living players.'}
                        </div>
                      )}
                    </div>
                    {state.settings.voiceChatEnabled && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {state.viewerIsAlive && (
                          <button
                            type="button"
                            disabled={Boolean(me?.isMuted || !me?.canSpeak)}
                            onClick={onToggleMic}
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                              micActive
                                ? isLocalSpeaking
                                  ? 'bg-emerald-500 text-[#04120B] shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                                  : 'bg-emerald-600 text-white'
                                : 'border border-emerald-500/40 bg-[#070B14] text-emerald-200 hover:border-emerald-400'
                            }`}
                          >
                            {micActive ? <Mic size={14} /> : <MicOff size={14} />}
                            <span>{micActive ? 'Mic Live' : 'Join Voice'}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={onToggleDeafen}
                          aria-label={deafened ? 'Unmute room speakers' : 'Deafen room speakers'}
                          title={deafened ? 'Speakers Deafened' : 'Speakers Active'}
                          className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                            deafened
                              ? 'border-red-500/45 bg-red-950/50 text-red-300'
                              : 'border-white/10 bg-[#070B14] text-slate-300 hover:border-white/25'
                          }`}
                        >
                          {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                  {voiceError && <div className="text-xs text-amber-300">{voiceError}</div>}
                  {state.phase === 'DAY_DISCUSSION' && state.viewerIsAlive && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {QUICK_REACTIONS.map((emoji) => (
                        <motion.button
                          key={emoji}
                          type="button"
                          whileHover={{ scale: 1.15, y: -2 }}
                          whileTap={{ scale: 0.88 }}
                          disabled={!canPostPublic}
                          onClick={() =>
                            onSendMessage('CHAT_SEND', {
                              channel: 'public',
                              text: emoji,
                              kind: 'reaction',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-white/10 bg-[#070B14] text-sm cursor-pointer disabled:opacity-40"
                        >
                          {emoji}
                        </motion.button>
                      ))}
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        disabled={!canPostPublic}
                        onClick={() =>
                          onSendMessage('CHAT_SEND', {
                            channel: 'public',
                            text: 'I am innocent! Watch who is pushing this vote.',
                            kind: 'defend',
                          })
                        }
                        className="px-3 py-1.5 rounded-lg border border-white/10 bg-[#070B14] text-xs text-slate-200 cursor-pointer disabled:opacity-40"
                      >
                        Defend Myself
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              <ParlorSeatingTable
                state={state}
                theme={theme}
                canVoteOnTable={state.phase === 'DAY_VOTING' && state.viewerIsAlive}
                canAccuseOnTable={state.phase === 'DAY_DISCUSSION' && canPostPublic}
                onSelectPlayer={handleTablePlayerClick}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* RIGHT COLUMN: DAY PHASE Portrait Chat Bubbles + Dead Chat + Public Log */}
      <div
        className="lg:col-span-12 xl:col-span-4 rounded-2xl border border-white/10 p-4 flex flex-col h-[420px] lg:h-[calc(100vh-170px)] lg:min-h-[480px] min-w-0"
        style={{ backgroundColor: theme.bgSurface }}
      >
        <div
          className="flex items-center gap-1 p-1 rounded-xl border border-white/10 mb-3 shrink-0"
          style={{ backgroundColor: theme.bgCanvas }}
        >
          <button
            type="button"
            onClick={() => setRightTab('chat')}
            className="flex-1 py-2 px-2 text-xs font-medium rounded-lg cursor-pointer"
            style={
              effectiveTab === 'chat'
                ? { backgroundColor: theme.accent, color: theme.accentText, fontWeight: 600 }
                : { color: '#CBD5E1' }
            }
          >
            Day Chat
          </button>
          {!state.viewerIsAlive && state.settings.deadChatEnabled && (
            <button
              type="button"
              onClick={() => setRightTab('dead')}
              className="flex-1 py-2 px-2 text-xs font-medium rounded-lg cursor-pointer"
              style={
                effectiveTab === 'dead'
                  ? { backgroundColor: theme.accent, color: theme.accentText, fontWeight: 600 }
                  : { color: '#CBD5E1' }
              }
            >
              Dead Chat
            </button>
          )}
          <button
            type="button"
            onClick={() => setRightTab('log')}
            className="flex-1 py-2 px-2 text-xs font-medium rounded-lg cursor-pointer"
            style={
              effectiveTab === 'log'
                ? { backgroundColor: theme.accent, color: theme.accentText, fontWeight: 600 }
                : { color: '#CBD5E1' }
            }
          >
            History
          </button>
        </div>

        {effectiveTab === 'chat' && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {state.publicChat.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-8">
                  <MessageSquare size={18} className="mx-auto mb-1 opacity-60" />
                  Discuss and find the Mafia!
                </div>
              ) : (
                state.publicChat.map((m) => {
                  const sender = state.players.find((p) => p.id === m.senderId);
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.18 }}
                      className={`rounded-xl border px-3 py-2.5 text-xs flex items-start gap-2.5 ${
                        m.kind === 'announcement'
                          ? 'border-amber-400/35 bg-amber-950/30 text-amber-100'
                          : m.kind === 'accuse'
                            ? 'border-red-500/30 bg-red-950/30 text-red-100'
                            : 'border-white/5 text-slate-200'
                      }`}
                      style={
                        m.kind !== 'announcement' && m.kind !== 'accuse'
                          ? { backgroundColor: theme.bgCanvas }
                          : undefined
                      }
                    >
                      {sender && <AvatarEmblem avatar={sender.avatar} isGM={sender.isGM} size="sm" />}
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-semibold text-white">
                          {m.senderName}
                        </div>
                        <p className="mt-0.5 break-words text-slate-300">{m.text}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {canPostPublic ? (
              <form onSubmit={handleSendPublicChat} className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  style={{ backgroundColor: theme.bgCanvas }}
                  className="flex-1 min-w-0 rounded-xl border border-white/10 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
                />
                <button
                  type="submit"
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                  className="rounded-xl px-3.5 py-2 min-h-[40px] min-w-[44px] flex items-center justify-center cursor-pointer"
                >
                  <Send size={14} />
                </button>
              </form>
            ) : (
              <div className="mt-3 text-[11px] text-slate-500 text-center py-2 border-t border-white/5">
                {isNight
                  ? 'Chat is closed during Night Phase.'
                  : !state.viewerIsAlive
                    ? 'Eliminated players cannot post to living parlor chat.'
                    : 'Chat muted by Game Master.'}
              </div>
            )}
          </div>
        )}

        {effectiveTab === 'dead' && !state.viewerIsAlive && (
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {state.deadChat.map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl border border-white/5 px-3 py-2 text-xs text-slate-300"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <div className="text-[11px] font-semibold text-slate-200">
                    {m.senderName}
                  </div>
                  <p className="mt-0.5 break-words">{m.text}</p>
                </div>
              ))}
            </div>
            <form onSubmit={handleSendDeadChat} className="mt-3 flex gap-2">
              <input
                type="text"
                value={deadChatInput}
                onChange={(e) => setDeadChatInput(e.target.value)}
                placeholder="Chat with eliminated spectators..."
                style={{ backgroundColor: theme.bgCanvas }}
                className="flex-1 min-w-0 rounded-xl border border-white/10 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
              />
              <button
                type="submit"
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
                className="rounded-xl px-3.5 py-2 min-h-[40px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <Send size={14} />
              </button>
            </form>
          </div>
        )}

        {effectiveTab === 'log' && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {state.roundHistory.map((r) => (
              <div
                key={r.round}
                className="rounded-xl border border-white/10 p-3 space-y-1"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="font-semibold text-amber-300">Round {r.round}</div>
                <div className="text-slate-400">{r.dayAnnouncementText}</div>
                <div className="text-slate-300">
                  Vote Eliminated: {r.voteEliminatedName || 'Nobody'}
                  {r.voteEliminatedRoleRevealed ? ` (${r.voteEliminatedRoleRevealed})` : ''}
                </div>
              </div>
            ))}
            <div className="space-y-1.5">
              <div className="font-semibold text-slate-300 flex items-center gap-1.5">
                <History size={13} />
                <span>Public Timeline</span>
              </div>
              {[...state.events].reverse().map((ev) => (
                <div
                  key={ev.id}
                  className="border-b border-white/5 pb-1 text-[11px] text-slate-400"
                >
                  <span className="font-mono-tabular text-slate-500 mr-1.5">R{ev.round}</span>
                  <span>{ev.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
