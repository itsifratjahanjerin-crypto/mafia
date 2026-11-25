import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AudioLines,
  Check,
  Clock,
  CloudRain,
  Copy,
  FileText,
  Flame,
  HeadphoneOff,
  Headphones,
  Home,
  LogOut,
  Menu,
  Mic,
  MicOff,
  Moon,
  Palette,
  Pause,
  Play,
  Radio,
  Settings,
  Sun,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { ClientGameState, GamePhase } from '../shared/types.ts';
import { ambientAudio } from '../utils/ambientAudio.ts';
import { soundFx } from '../utils/soundFx.ts';
import { voiceNarrator } from '../utils/voiceNarrator.ts';
import {
  PARLOR_THEMES,
  type ParlorTheme,
  type ParlorThemeId,
} from '../utils/parlorThemes.ts';
import { ROLE_CARD_IMAGES } from '../utils/avatars.tsx';

function formatPhaseLabel(phase: GamePhase, viewerIsGM: boolean): string {
  switch (phase) {
    case 'LOBBY':
      return 'Lobby';
    case 'ROUND_READY':
      return 'Round Ready';
    case 'NIGHT_INTRO':
      return 'Night Phase';
    case 'NIGHT_MAFIA':
      return viewerIsGM ? 'Night · Mafia Action' : 'Night Phase';
    case 'NIGHT_BODYGUARD':
      return viewerIsGM ? 'Night · Bodyguard Action' : 'Night Phase';
    case 'NIGHT_DETECTIVE':
      return viewerIsGM ? 'Night · Detective Investigation' : 'Night Phase';
    case 'NIGHT_CUSTOM':
      return viewerIsGM ? 'Night · Custom Roles' : 'Night Phase';
    case 'NIGHT_RESOLVE':
      return viewerIsGM ? 'Night · Resolution' : 'Night Phase';
    case 'DAY_ANNOUNCE':
      return 'Day Phase';
    case 'DAY_DISCUSSION':
      return 'Discussion';
    case 'DAY_VOTING':
      return 'Voting Phase';
    case 'DAY_VOTE_RESULT':
      return 'Vote Results';
    case 'ROUND_COMPLETE':
      return 'Round Results';
    case 'GAME_OVER':
      return 'Game Over';
  }
}

export function RoundTimelineBar({
  state,
  theme,
  themeId,
  onSelectTheme,
  rejoinPin,
  connected,
  activeSection,
  onSelectSection,
  onGmAction,
  onLeave,
  onCopied,
  onOpenFriends,
  inviteCount = 0,
  micActive,
  deafened,
  isLocalSpeaking,
  onToggleMic,
  onToggleDeafen,
}: {
  state: ClientGameState;
  theme: ParlorTheme;
  themeId: ParlorThemeId;
  onSelectTheme: (id: ParlorThemeId) => void;
  rejoinPin: string;
  connected: boolean;
  activeSection: 'room' | 'settings' | 'history';
  onSelectSection: (s: 'room' | 'settings' | 'history') => void;
  onGmAction: (action: string, extra?: Record<string, unknown>) => void;
  onLeave: () => void;
  onCopied: (text: string) => void;
  onOpenFriends?: () => void;
  inviteCount?: number;
  micActive: boolean;
  deafened: boolean;
  isLocalSpeaking: boolean;
  onToggleMic: () => void;
  onToggleDeafen: () => void;
}) {
  const [mutedFx, setMutedFx] = useState(soundFx.muted);
  const [ambienceOn, setAmbienceOn] = useState(ambientAudio.isEnabled());
  const [narratorOn, setNarratorOn] = useState(voiceNarrator.isEnabled());
  const [ambientProfile, setAmbientProfile] = useState(ambientAudio.getActiveProfile());
  const [ambientLabel, setAmbientLabel] = useState(ambientAudio.getProfileLabel());
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [showThemes, setShowThemes] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const syncAudioState = () => {
      setMutedFx(soundFx.muted);
      setAmbienceOn(ambientAudio.isEnabled());
      setNarratorOn(voiceNarrator.isEnabled());
      setAmbientProfile(ambientAudio.getActiveProfile());
      setAmbientLabel(ambientAudio.getProfileLabel());
    };
    syncAudioState();
    const unsubAmbient = ambientAudio.subscribe(syncAudioState);
    const unsubNarrator = voiceNarrator.subscribe(syncAudioState);
    const unsubMute = soundFx.subscribeMute(syncAudioState);
    return () => {
      unsubAmbient();
      unsubNarrator();
      unsubMute();
    };
  }, []);

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

  const totalNonGm = state.players.filter((p) => !p.isGM).length;
  const isNight = state.phase.startsWith('NIGHT_');
  const me = state.players.find((p) => p.id === state.viewerId);
  const canTalkNow =
    state.settings.voiceChatEnabled &&
    (state.viewerIsGM ||
      (!me?.isMuted &&
        (me?.canSpeak ?? true) &&
        (state.phase === 'LOBBY' ||
          state.phase === 'GAME_OVER' ||
          (state.viewerIsAlive &&
            (!isNight ||
              (state.phase === 'NIGHT_MAFIA' &&
                state.viewerRole === 'Mafia' &&
                state.settings.mafiaTeamCommunication))))));
  const liveSpeakersCount = state.voicePeers.length;

  const copyInvite = () => {
    const url = `${window.location.origin}/?room=${state.roomCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => onCopied(`Invite link copied (#${state.roomCode}).`))
      .catch(() => onCopied(`Room ID: #${state.roomCode}`));
  };

  const toggleSound = () => {
    const nextMuted = !soundFx.muted;
    soundFx.setMuted(nextMuted);
  };

  const toggleAmbience = () => {
    ambientAudio.toggle();
  };

  const toggleNarrator = () => {
    voiceNarrator.toggle();
  };

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const p = state.phase;
  const done = new Set(state.completedRoundSteps);
  const nodes = [
    { id: 'night', label: 'Night', active: isNight, done: done.has('night') && !isNight },
    { id: 'day', label: 'Day', active: p === 'DAY_ANNOUNCE', done: done.has('day') && p !== 'DAY_ANNOUNCE' },
    { id: 'discussion', label: 'Discussion', active: p === 'DAY_DISCUSSION', done: done.has('discussion') && p !== 'DAY_DISCUSSION' },
    { id: 'voting', label: 'Voting', active: p === 'DAY_VOTING', done: done.has('voting') && p !== 'DAY_VOTING' },
    { id: 'elimination', label: 'Elimination', active: p === 'DAY_VOTE_RESULT' || p === 'ROUND_COMPLETE', done: done.has('complete') },
  ];

  return (
    <header
      className="sticky top-0 z-20 border-b border-white/10 backdrop-blur-md"
      style={{ backgroundColor: `${theme.bgSurface}F2` }}
    >
      {/* Top Bar: Mobile-First Single Compact Row -> Full 3-Zone Desktop Bar */}
      <div className="max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4">
        {/* Zone 1: MAFIA Brand Lockup + Mobile Quick Room Readout */}
        <div className="flex items-center gap-2.5 min-w-0 shrink-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg overflow-hidden border border-red-500/40 shrink-0">
            <img
              src={ROLE_CARD_IMAGES.Mafia}
              alt="Mafia emblem"
              decoding="async"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="min-w-0">
            <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-red-500 leading-none">
              MAFIA
            </div>
            <div className="hidden sm:block text-[11px] text-amber-300/90 leading-tight mt-0.5">
              Trust No One...
            </div>
            <button
              type="button"
              onClick={copyInvite}
              className="sm:hidden inline-flex items-center gap-1 text-[10px] font-mono-tabular text-slate-300 mt-0.5 cursor-pointer"
            >
              <span>#{state.roomCode}</span>
              <span>·</span>
              <span>{totalNonGm}/{state.settings.playerLimit}</span>
              <Copy size={9} className="text-amber-400" />
            </button>
          </div>
        </div>

        {/* Zone 2: Desktop / Tablet Primary Nav Links */}
        <nav className="hidden lg:flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onSelectSection('room')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'room'
                ? 'bg-red-500/15 text-red-300 border border-red-500/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Home size={14} />
            <span>Room</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('settings')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'settings'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <Settings size={14} />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSection('history')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeSection === 'history'
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
                : 'text-slate-300 hover:text-white border border-transparent'
            }`}
          >
            <FileText size={14} />
            <span>History</span>
          </button>
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-red-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <LogOut size={14} />
            <span>Leave</span>
          </button>
        </nav>

        {/* Zone 3: Quick Voice, Timer, Desktop Utilities & Mobile Menu Trigger */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {secondsLeft !== null && (
            <div
              className={`px-2 sm:px-2.5 py-1 rounded-lg border font-mono-tabular text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                secondsLeft <= 10 && !state.isPaused
                  ? 'border-red-500/40 bg-red-950/50 text-red-200'
                  : 'border-white/10 text-amber-300'
              }`}
              style={{ backgroundColor: theme.bgCanvas }}
            >
              {state.isPaused ? `PAUSED ${formatClock(secondsLeft)}` : formatClock(secondsLeft)}
            </div>
          )}

          {state.viewerIsGM && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' && (
            <button
              type="button"
              onClick={() => onGmAction(state.isPaused ? 'RESUME_GAME' : 'PAUSE_GAME')}
              className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs text-slate-200 hover:border-white/25 cursor-pointer whitespace-nowrap shrink-0"
              style={{ backgroundColor: theme.bgElevated }}
            >
              {state.isPaused ? <Play size={13} /> : <Pause size={13} />}
              <span>{state.isPaused ? 'Resume' : 'Pause'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={copyInvite}
            title={`Copy invite link · PIN: ${rejoinPin}`}
            className="hidden sm:block text-right px-2.5 py-1 rounded-lg border border-white/10 hover:border-amber-400/40 transition-colors cursor-pointer"
            style={{ backgroundColor: theme.bgCanvas }}
          >
            <div className="text-[11px] font-mono-tabular text-slate-200 flex items-center gap-1.5 whitespace-nowrap">
              <span>Room ID: #{state.roomCode}</span>
              <Copy size={11} className="text-amber-400" />
            </div>
            <div className="text-[10px] font-mono-tabular text-slate-400 whitespace-nowrap">
              Players: {totalNonGm}/{state.settings.playerLimit}
              {!connected && ' · Reconnecting...'}
            </div>
          </button>

          {state.settings.voiceChatEnabled && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={onToggleMic}
                disabled={!canTalkNow && !micActive}
                title={
                  micActive
                    ? 'Click to mute microphone'
                    : canTalkNow
                      ? 'Join live voice chat'
                      : 'Voice muted during sleep or by Game Master'
                }
                className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 min-h-[38px] sm:min-h-[34px] rounded-lg border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 ${
                  micActive
                    ? isLocalSpeaking
                      ? 'bg-emerald-500 border-emerald-300 text-[#04120B] shadow-[0_0_16px_rgba(16,185,129,0.55)]'
                      : 'bg-emerald-600 border-emerald-400 text-white'
                    : 'border-emerald-500/35 text-emerald-200 hover:border-emerald-400/70'
                }`}
                style={!micActive ? { backgroundColor: theme.bgElevated } : undefined}
              >
                {micActive ? <Mic size={14} /> : <MicOff size={14} />}
                <span className="hidden min-[380px]:inline">
                  {micActive ? 'Mic Live' : 'Voice'}
                </span>
                {liveSpeakersCount > 0 && (
                  <span className="font-mono-tabular text-[10px] opacity-90">
                    ({liveSpeakersCount})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onToggleDeafen}
                aria-label={deafened ? 'Unmute room speakers' : 'Deafen room speakers'}
                title={deafened ? 'Speakers Deafened (Click to hear players)' : 'Hearing Room Voice'}
                className={`hidden md:inline-flex items-center justify-center p-1.5 min-h-[34px] min-w-[34px] rounded-lg border cursor-pointer transition-colors ${
                  deafened
                    ? 'border-red-500/45 text-red-300 bg-red-950/50'
                    : 'border-white/10 text-slate-300 hover:border-white/25'
                }`}
                style={!deafened ? { backgroundColor: theme.bgElevated } : undefined}
              >
                {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
              </button>
            </div>
          )}

          {/* Desktop Utility Controls (md+) */}
          <div className="hidden md:flex items-center gap-1.5">
            {onOpenFriends && (
              <button
                type="button"
                onClick={onOpenFriends}
                aria-label="Friends & Account"
                className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-200 hover:border-amber-400/40 cursor-pointer whitespace-nowrap shrink-0"
                style={{ backgroundColor: theme.bgElevated }}
              >
                <Users size={14} style={{ color: theme.accent }} />
                <span className="hidden xl:inline">Friends</span>
                {inviteCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-red-600 text-white text-[10px] font-bold">
                    {inviteCount}
                  </span>
                )}
              </button>
            )}

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowThemes((v) => !v)}
                aria-label="Theme switcher"
                className="p-2 rounded-lg border border-white/10 text-slate-200 hover:border-white/25 cursor-pointer"
                style={{ backgroundColor: theme.bgElevated }}
              >
                <Palette size={14} style={{ color: theme.accent }} />
              </button>
              <AnimatePresence>
                {showThemes && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.95 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-2 w-52 rounded-xl border border-white/15 p-2 shadow-2xl z-50 space-y-1 origin-top-right"
                    style={{ backgroundColor: theme.bgSurface }}
                  >
                    {Object.values(PARLOR_THEMES).map((t) => (
                      <motion.button
                        key={t.id}
                        type="button"
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          onSelectTheme(t.id);
                          setShowThemes(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer ${
                          t.id === themeId ? 'bg-white/10 text-white font-semibold' : 'text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{t.name}</span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: t.accent }}
                        />
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={toggleNarrator}
              aria-label="Toggle English voice narrator"
              title={
                narratorOn
                  ? 'English Voice Narrator: On (Private role & phase cues)'
                  : 'English Voice Narrator: Off'
              }
              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                narratorOn
                  ? 'border-emerald-400/50 text-emerald-300'
                  : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: narratorOn ? 'rgba(16,185,129,0.14)' : theme.bgElevated,
              }}
            >
              <Radio size={14} />
            </button>

            <button
              type="button"
              onClick={toggleAmbience}
              aria-label={`Toggle background ambient audio (${ambientLabel})`}
              title={`Ambient: ${ambientLabel}`}
              className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                ambienceOn
                  ? ambientProfile === 'day' || ambientProfile === 'voting'
                    ? 'border-amber-400/50 text-amber-300'
                    : 'border-sky-400/50 text-sky-300'
                  : 'border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-200'
              }`}
              style={{
                backgroundColor: ambienceOn
                  ? ambientProfile === 'day' || ambientProfile === 'voting'
                    ? 'rgba(245,158,11,0.14)'
                    : 'rgba(56,189,248,0.14)'
                  : theme.bgElevated,
              }}
            >
              {ambientProfile === 'day' || ambientProfile === 'voting' ? (
                <Clock size={14} />
              ) : ambientProfile === 'night' || ambientProfile === 'victory' ? (
                <CloudRain size={14} />
              ) : ambientProfile === 'lobby' || ambientProfile === 'title' ? (
                <Flame size={14} />
              ) : (
                <AudioLines size={14} />
              )}
            </button>

            <button
              type="button"
              onClick={toggleSound}
              aria-label="Mute toggle"
              title={mutedFx ? 'Sound FX: Muted' : 'Sound FX: On'}
              className="p-2 rounded-lg border border-white/10 text-slate-300 hover:border-white/25 cursor-pointer"
              style={{ backgroundColor: theme.bgElevated }}
            >
              {mutedFx ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          </div>

          {/* Mobile & Small Tablet Menu Button (< lg) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close room menu' : 'Open room menu'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden inline-flex items-center justify-center min-w-[40px] min-h-[38px] rounded-lg border border-white/12 text-white cursor-pointer"
            style={{ backgroundColor: theme.bgElevated }}
          >
            {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Slide-Down Room Menu (< lg) */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden border-t border-white/10 px-3 sm:px-5 py-3 space-y-3"
            style={{ backgroundColor: theme.bgSurface }}
          >
            {/* Primary Navigation */}
            <div className="grid grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'room', label: 'Room', icon: Home },
                  { id: 'settings', label: 'Settings', icon: Settings },
                  { id: 'history', label: 'History', icon: FileText },
                ] as const
              ).map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    onSelectSection(id);
                    setMobileMenuOpen(false);
                  }}
                  className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl border text-[11px] font-semibold cursor-pointer ${
                    activeSection === id
                      ? 'border-amber-400/50 bg-amber-500/15 text-amber-200'
                      : 'border-white/10 text-slate-300'
                  }`}
                  style={activeSection !== id ? { backgroundColor: theme.bgCanvas } : undefined}
                >
                  <Icon size={14} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  onLeave();
                }}
                className="min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-950/30 text-[11px] font-semibold text-red-200 cursor-pointer"
              >
                <LogOut size={14} />
                <span>Leave</span>
              </button>
            </div>

            {/* Audio, Speakers, Friends & GM Pause Controls */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {state.settings.voiceChatEnabled && (
                <button
                  type="button"
                  onClick={onToggleDeafen}
                  className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                    deafened
                      ? 'border-red-500/45 bg-red-950/50 text-red-300'
                      : 'border-white/10 text-slate-200'
                  }`}
                  style={!deafened ? { backgroundColor: theme.bgCanvas } : undefined}
                >
                  {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
                  <span>{deafened ? 'Unmute Audio' : 'Deafen Room'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={toggleNarrator}
                className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                  narratorOn
                    ? 'border-emerald-400/45 bg-emerald-500/15 text-emerald-300'
                    : 'border-white/10 text-slate-300'
                }`}
                style={!narratorOn ? { backgroundColor: theme.bgCanvas } : undefined}
              >
                <Radio size={14} />
                <span>Narrator: {narratorOn ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={toggleAmbience}
                className={`min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium cursor-pointer ${
                  ambienceOn
                    ? 'border-sky-400/45 bg-sky-500/15 text-sky-300'
                    : 'border-white/10 text-slate-300'
                }`}
                style={!ambienceOn ? { backgroundColor: theme.bgCanvas } : undefined}
              >
                <AudioLines size={14} />
                <span>Ambience: {ambienceOn ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={toggleSound}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                {mutedFx ? <VolumeX size={14} /> : <Volume2 size={14} />}
                <span>SFX: {mutedFx ? 'Muted' : 'On'}</span>
              </button>

              {onOpenFriends && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenFriends();
                  }}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-slate-200 cursor-pointer"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <Users size={14} style={{ color: theme.accent }} />
                  <span>Friends {inviteCount > 0 ? `(${inviteCount})` : ''}</span>
                </button>
              )}

              <button
                type="button"
                onClick={copyInvite}
                className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/35 px-3 py-2 text-xs font-medium text-amber-300 cursor-pointer"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <Copy size={13} />
                <span>Invite #{state.roomCode}</span>
              </button>

              {state.viewerIsGM && state.phase !== 'LOBBY' && state.phase !== 'GAME_OVER' && (
                <button
                  type="button"
                  onClick={() => {
                    onGmAction(state.isPaused ? 'RESUME_GAME' : 'PAUSE_GAME');
                    setMobileMenuOpen(false);
                  }}
                  className="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-200 cursor-pointer"
                >
                  {state.isPaused ? <Play size={14} /> : <Pause size={14} />}
                  <span>{state.isPaused ? 'Resume Game' : 'Pause Game'}</span>
                </button>
              )}
            </div>

            {/* Theme Quick Picker on Mobile */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              {Object.values(PARLOR_THEMES).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTheme(t.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg border text-xs whitespace-nowrap shrink-0 cursor-pointer ${
                    t.id === themeId
                      ? 'border-white/40 bg-white/10 text-white font-semibold'
                      : 'border-white/10 text-slate-300'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: t.accent }}
                  />
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Connected Node Progress Bar when match is active */}
      {state.round > 0 && state.phase !== 'GAME_OVER' && (
        <div
          className="border-t border-white/5"
          style={{ backgroundColor: theme.bgCanvas }}
        >
          <div className="max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="inline-flex">
                {isNight ? (
                  <Moon size={14} className="text-sky-400" />
                ) : (
                  <Sun size={14} className="text-amber-400" />
                )}
              </span>
              <span className="font-mono-tabular text-white whitespace-nowrap">
                Round {state.round}
                {state.settings.maxRounds > 0 ? ` / ${state.settings.maxRounds}` : ''}
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-slate-300 truncate">
                {formatPhaseLabel(state.phase, state.viewerIsGM)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
              {nodes.map((node, i) => (
                <React.Fragment key={node.id}>
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs border whitespace-nowrap shrink-0 ${
                      node.active
                        ? 'border-amber-400/60 bg-amber-500/15 text-amber-200 font-semibold'
                        : node.done
                          ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-300'
                          : 'border-white/10 text-slate-500'
                    }`}
                  >
                    {node.done && <Check size={11} className="text-emerald-400" />}
                    <span>{node.label}</span>
                  </div>
                  {i < nodes.length - 1 && (
                    <span className="text-slate-600 text-xs shrink-0" aria-hidden="true">
                      —
                    </span>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
