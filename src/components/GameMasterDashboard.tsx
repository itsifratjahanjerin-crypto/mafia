import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Crown,
  Eye,
  EyeOff,
  FileText,
  Gavel,
  HeadphoneOff,
  Headphones,
  History,
  Home,
  Lock,
  MessageSquare,
  Mic,
  MicOff,
  Moon,
  RotateCcw,
  Search,
  Settings,
  Shield,
  Skull,
  Sun,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Send,
} from 'lucide-react';
import type { ClientGameState } from '../shared/types.ts';
import { AvatarEmblem, getRoleTextColor, TITLE_BACKDROP_URL } from '../utils/avatars.tsx';
import type { ParlorTheme } from '../utils/parlorThemes.ts';

export function GameMasterDashboard({
  state,
  theme,
  activeSection,
  micActive,
  deafened,
  isLocalSpeaking,
  voiceError,
  onToggleMic,
  onToggleDeafen,
  onGmAction,
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
  onGmAction: (action: string, extra?: Record<string, unknown>) => void;
  onSendMessage: (type: string, payload: Record<string, unknown>) => void;
}) {
  const [sidebarTab, setSidebarTab] = useState<
    'overview' | 'night' | 'secret' | 'history' | 'roles' | 'settings'
  >('overview');
  const [chatChannel, setChatChannel] = useState<'public' | 'mafia' | 'dead'>('public');
  const [chatInput, setChatInput] = useState('');
  const [notesDraft, setNotesDraft] = useState(state.gmNotes ?? '');
  const [revealRoleToggle, setRevealRoleToggle] = useState(
    state.settings.revealRoleOnElimination
  );
  const [customAnnouncement, setCustomAnnouncement] = useState('');
  const [manualResultTeam, setManualResultTeam] = useState<'Town' | 'Mafia' | 'Neutral'>('Town');
  const [manualResultReason, setManualResultReason] = useState('');
  const [showEndModal, setShowEndModal] = useState(false);

  useEffect(() => {
    setNotesDraft(state.gmNotes ?? '');
  }, [state.gmNotes]);

  useEffect(() => {
    if (activeSection === 'settings') setSidebarTab('settings');
    else if (activeSection === 'history') setSidebarTab('history');
    else setSidebarTab('overview');
  }, [activeSection]);

  const nonGmPlayers = state.players.filter((p) => !p.isGM);
  const livingPlayers = nonGmPlayers.filter((p) => p.isAlive);
  const livingMafiaCount = livingPlayers.filter((p) => p.role === 'Mafia').length;
  const hasCustomNightRoles = livingPlayers.some((p) => {
    const cr = state.customRoles.find((c) => c.name === p.role);
    return cr && cr.nightAction !== 'none';
  });

  const night = state.nightState;
  const mafiaTargetName = night?.mafiaFinalTargetId
    ? state.players.find((p) => p.id === night.mafiaFinalTargetId)?.name
    : null;
  const bgTargetName = night?.bodyguardTargetId
    ? state.players.find((p) => p.id === night.bodyguardTargetId)?.name
    : null;
  const detTargetName = night?.detectiveTargetId
    ? state.players.find((p) => p.id === night.detectiveTargetId)?.name
    : null;
  const resolvedVictim = night?.resolvedVictimId
    ? state.players.find((p) => p.id === night.resolvedVictimId)
    : null;

  const isNightPhase = state.phase.startsWith('NIGHT_');

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage('CHAT_SEND', { channel: chatChannel, text: chatInput.trim() });
    setChatInput('');
  };

  const activeChatList =
    chatChannel === 'mafia'
      ? state.mafiaChat
      : chatChannel === 'dead'
        ? state.deadChat
        : state.publicChat;

  const currentActionLabel =
    state.phase === 'NIGHT_INTRO'
      ? 'Night Waiting'
      : state.phase === 'NIGHT_MAFIA'
        ? 'Mafia Action'
        : state.phase === 'NIGHT_BODYGUARD'
          ? 'Bodyguard Action'
          : state.phase === 'NIGHT_DETECTIVE'
            ? 'Detective Investigation'
            : state.phase === 'NIGHT_RESOLVE'
              ? 'Resolve Night'
              : state.phase === 'DAY_ANNOUNCE'
                ? 'Morning Announcement'
                : state.phase === 'DAY_DISCUSSION'
                  ? 'Discussion Phase'
                  : state.phase === 'DAY_VOTING'
                    ? 'Voting Phase'
                    : state.phase === 'DAY_VOTE_RESULT'
                      ? 'Ballot Resolution'
                      : 'Round Complete';

  return (
    <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
      {/* LEFT SIDEBAR: Game Master Dashboard Navigation matching Mockup */}
      <div
        className="lg:col-span-3 rounded-2xl border border-white/10 p-4 flex flex-col justify-between gap-4 min-w-0"
        style={{ backgroundColor: theme.bgSurface }}
      >
        <div className="space-y-4">
          <div className="border-b border-white/10 pb-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown size={17} className="text-amber-400" />
                <span className="text-sm font-semibold text-amber-300">
                  Game Master Dashboard
                </span>
              </div>
            </div>
            {state.settings.voiceChatEnabled && (
              <div
                className="rounded-xl border border-white/10 p-2.5 space-y-1.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onToggleMic}
                    className={`flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer whitespace-nowrap ${
                      micActive
                        ? isLocalSpeaking
                          ? 'bg-emerald-500 border-emerald-300 text-[#04120B]'
                          : 'bg-emerald-600 border-emerald-400 text-white'
                        : 'border-emerald-500/35 bg-[#070B14] text-emerald-200 hover:border-emerald-400'
                    }`}
                  >
                    {micActive ? <Mic size={13} /> : <MicOff size={13} />}
                    <span>{micActive ? 'Narrator Mic Live' : 'Join Voice'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onToggleDeafen}
                    aria-label={deafened ? 'Unmute room speakers' : 'Deafen room speakers'}
                    title={deafened ? 'Speakers Deafened' : 'Speakers Active'}
                    className={`p-1.5 rounded-lg border cursor-pointer ${
                      deafened
                        ? 'border-red-500/45 bg-red-950/50 text-red-300'
                        : 'border-white/10 bg-[#070B14] text-slate-300'
                    }`}
                  >
                    {deafened ? <HeadphoneOff size={13} /> : <Headphones size={13} />}
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {state.voicePeers.length > 0
                    ? `Live (${state.voicePeers.length}): ${state.voicePeers
                        .map((id) => state.players.find((p) => p.id === id)?.name)
                        .filter(Boolean)
                        .join(', ')}`
                    : 'No speakers live right now'}
                </div>
                {voiceError && (
                  <div className="text-[10px] text-amber-300">{voiceError}</div>
                )}
              </div>
            )}
          </div>

          <nav className="hidden lg:block space-y-1">
            {(
              [
                ['overview', 'Control Panel', Home],
                ['night', 'Night Actions', Moon],
                ['secret', 'Secret Info', Lock],
                ['roles', 'Player Roles', Users],
                ['history', 'Game History', FileText],
                ['settings', 'Game Settings', Settings],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSidebarTab(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                  sidebarTab === id
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                    : 'text-slate-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Vertical Night Phase Stepper Card matching Top-Right of Mockup */}
          <div
            className="rounded-xl border border-white/10 p-3.5 space-y-2.5"
            style={{ backgroundColor: theme.bgCanvas }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <Moon size={14} className="text-sky-400" />
              <span>NIGHT PHASE</span>
            </div>
            <div className="space-y-2 text-xs">
              {[
                {
                  label: 'Call Mafia',
                  sub: `Target: ${mafiaTargetName || 'Pending'}`,
                  done: state.completedRoundSteps.includes('mafia'),
                  active: state.phase === 'NIGHT_MAFIA',
                },
                {
                  label: 'Call Bodyguard',
                  sub: `Protect: ${bgTargetName || 'Pending'}`,
                  done: state.completedRoundSteps.includes('bodyguard'),
                  active: state.phase === 'NIGHT_BODYGUARD',
                },
                {
                  label: 'Call Detective',
                  sub: detTargetName
                    ? `Investigate: ${detTargetName} (${night?.detectiveResultIsMafia ? 'Mafia' : 'Safe'})`
                    : 'Investigate: Pending',
                  done: state.completedRoundSteps.includes('detective'),
                  active: state.phase === 'NIGHT_DETECTIVE',
                },
                {
                  label: 'Resolve Night',
                  sub: resolvedVictim ? `Victim: ${resolvedVictim.name}` : 'No victim',
                  done: state.completedRoundSteps.includes('day'),
                  active: state.phase === 'NIGHT_RESOLVE',
                },
              ].map((step) => (
                <div
                  key={step.label}
                  className={`rounded-lg border px-2.5 py-2 flex items-start gap-2 ${
                    step.active
                      ? 'border-amber-400/50 bg-amber-500/10'
                      : step.done
                        ? 'border-emerald-500/25 bg-emerald-500/5'
                        : 'border-white/5'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0 ${
                      step.done
                        ? 'bg-emerald-500 text-[#070B14]'
                        : step.active
                          ? 'bg-amber-400 text-[#070B14]'
                          : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {step.done && <Check size={10} />}
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-white">{step.label}</div>
                    <div className="text-[11px] text-slate-400 truncate">{step.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onGmAction('RESTART_GAME')}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-[#070B14] hover:border-red-500/40 py-2 text-xs text-slate-300 hover:text-red-200 cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Restart Match to Lobby</span>
        </button>
      </div>

      {/* CENTER MAIN WORKSPACE */}
      <div className="lg:col-span-5 space-y-5 min-w-0">
        {/* KPI Strip & Quick 4-Tab Bar matching GM Control Panel */}
        <div
          className="rounded-2xl border border-white/10 p-4 space-y-3"
          style={{ backgroundColor: theme.bgSurface }}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-display text-lg font-semibold text-white">
              Round {state.round}
              {state.settings.maxRounds > 0 ? ` / ${state.settings.maxRounds}` : ''}
            </div>
            <label className="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={revealRoleToggle}
                onChange={(e) => setRevealRoleToggle(e.target.checked)}
                className="h-3.5 w-3.5 accent-amber-400"
              />
              <span>Reveal Role on Elimination</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {(
              [
                ['overview', 'Control Panel', Home],
                ['roles', 'Role Roster', Users],
                ['secret', 'Secret Info', Lock],
                ['history', 'Game History', History],
              ] as const
            ).map(([id, label, Icon]) => {
              const isTabActive =
                sidebarTab === id || (id === 'overview' && sidebarTab === 'night');
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSidebarTab(id)}
                  className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    isTabActive
                      ? 'bg-[#DC2626] border-red-400/50 text-white'
                      : 'border-white/10 text-slate-300 hover:border-white/25 hover:text-white'
                  }`}
                  style={!isTabActive ? { backgroundColor: theme.bgCanvas } : undefined}
                >
                  <Icon size={13} />
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
            <div
              className="col-span-2 sm:col-span-1 rounded-xl border border-white/10 p-2.5"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <div className="text-[10px] text-slate-400">Current Action</div>
              <div className="text-xs font-semibold text-white mt-0.5 truncate">
                {currentActionLabel}
              </div>
            </div>
            <div
              className="rounded-xl border border-white/10 p-2.5"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <div className="text-[10px] text-slate-400">Players Alive</div>
              <div className="font-mono-tabular text-sm font-bold text-emerald-400 mt-0.5">
                {livingPlayers.length}
              </div>
            </div>
            <div
              className="rounded-xl border border-white/10 p-2.5"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <div className="text-[10px] text-slate-400">Mafia Alive</div>
              <div className="font-mono-tabular text-sm font-bold text-red-400 mt-0.5">
                {livingMafiaCount}
              </div>
            </div>
          </div>
        </div>

        <AnimatePresence mode="wait">
        <motion.div
          key={sidebarTab === 'night' ? 'overview' : sidebarTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="space-y-5"
        >
        {/* OVERVIEW OR NIGHT ACTIONS */}
        {(sidebarTab === 'overview' || sidebarTab === 'night') && (
          <>
            {isNightPhase && (
              <div
                className="rounded-2xl border border-indigo-400/30 overflow-hidden shadow-xl"
                style={{ backgroundColor: theme.bgSurface }}
              >
                {/* Moonlit Night Header Banner */}
                <div className="relative px-5 py-4 border-b border-white/10 text-center space-y-1 overflow-hidden">
                  <img
                    src={TITLE_BACKDROP_URL}
                    alt="Moonlit night sky"
                    referrerPolicy="no-referrer"
                    className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-25"
                  />
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        'linear-gradient(to bottom, rgba(15,23,42,0.75), rgba(7,11,20,0.94))',
                    }}
                  />
                  <div className="relative z-10 flex items-center justify-center gap-2 text-xs font-semibold text-sky-300">
                    <Moon size={15} className="text-sky-400" />
                    <span>Night Phase · {state.phase.replace('NIGHT_', '')}</span>
                  </div>
                  <div className="relative z-10 font-display text-lg font-bold text-amber-300">
                    NIGHT HAS BEGUN
                  </div>
                  <div className="relative z-10 text-[11px] font-semibold tracking-wide text-slate-200">
                    EVERYONE CLOSE YOUR EYES · CALL EACH ROLE IN ORDER
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Numbered Call/Sleep Queue */}
                  <div className="space-y-2.5">
                    <div
                      className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                        state.phase === 'NIGHT_MAFIA'
                          ? 'border-red-500/55 bg-red-950/25'
                          : 'border-white/10'
                      }`}
                      style={state.phase !== 'NIGHT_MAFIA' ? { backgroundColor: theme.bgCanvas } : undefined}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-red-600/25 border border-red-500/40 text-red-300 font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0">
                          1
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-red-300">Call Mafia</div>
                          <div className="text-[11px] text-slate-400">
                            Target: {mafiaTargetName || 'Pending'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          aria-label="Override Mafia target"
                          value={night?.mafiaFinalTargetId || ''}
                          onChange={(e) =>
                            onGmAction('GM_SET_MAFIA_TARGET', {
                              targetId: e.target.value || null,
                            })
                          }
                          style={{ backgroundColor: theme.bgSurface }}
                          className="rounded-lg border border-white/10 px-2 py-1 text-[11px] text-white"
                        >
                          <option value="">Override...</option>
                          {livingPlayers.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => onGmAction('CALL_MAFIA')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            state.phase === 'NIGHT_MAFIA'
                              ? 'bg-red-600 text-white'
                              : 'bg-white/10 text-slate-200 hover:bg-white/15'
                          }`}
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={() => onGmAction('MAFIA_SLEEP')}
                          disabled={state.phase !== 'NIGHT_MAFIA'}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 disabled:opacity-35 text-[#070B14] cursor-pointer"
                        >
                          Sleep
                        </button>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                        state.phase === 'NIGHT_BODYGUARD'
                          ? 'border-sky-500/55 bg-sky-950/25'
                          : 'border-white/10'
                      }`}
                      style={
                        state.phase !== 'NIGHT_BODYGUARD' ? { backgroundColor: theme.bgCanvas } : undefined
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-sky-600/25 border border-sky-500/40 text-sky-300 font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0">
                          2
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-sky-300">Call Bodyguard</div>
                          <div className="text-[11px] text-slate-400">
                            Protected: {bgTargetName || 'Pending'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onGmAction('CALL_BODYGUARD')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            state.phase === 'NIGHT_BODYGUARD'
                              ? 'bg-sky-600 text-white'
                              : 'bg-white/10 text-slate-200 hover:bg-white/15'
                          }`}
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={() => onGmAction('BODYGUARD_SLEEP')}
                          disabled={state.phase !== 'NIGHT_BODYGUARD'}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 disabled:opacity-35 text-[#070B14] cursor-pointer"
                        >
                          Sleep
                        </button>
                      </div>
                    </div>

                    <div
                      className={`rounded-xl border p-3 flex flex-wrap items-center justify-between gap-2 ${
                        state.phase === 'NIGHT_DETECTIVE'
                          ? 'border-emerald-500/55 bg-emerald-950/25'
                          : 'border-white/10'
                      }`}
                      style={
                        state.phase !== 'NIGHT_DETECTIVE' ? { backgroundColor: theme.bgCanvas } : undefined
                      }
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-emerald-600/25 border border-emerald-500/40 text-emerald-300 font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0">
                          3
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-emerald-300">Call Detective</div>
                          <div className="text-[11px] text-slate-400">
                            Checked: {detTargetName || 'Pending'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onGmAction('CALL_DETECTIVE')}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                            state.phase === 'NIGHT_DETECTIVE'
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white/10 text-slate-200 hover:bg-white/15'
                          }`}
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={() => onGmAction('DETECTIVE_SLEEP')}
                          disabled={state.phase !== 'NIGHT_DETECTIVE'}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 disabled:opacity-35 text-[#070B14] cursor-pointer"
                        >
                          Sleep
                        </button>
                      </div>
                    </div>

                    {hasCustomNightRoles && (
                      <div
                        className="rounded-xl border border-white/10 p-3 flex items-center justify-between"
                        style={{ backgroundColor: theme.bgCanvas }}
                      >
                        <span className="text-xs font-semibold text-indigo-300">
                          Custom Night Roles
                        </span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => onGmAction('CALL_CUSTOM_NIGHT')}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/10 text-white cursor-pointer"
                          >
                            Call
                          </button>
                          <button
                            type="button"
                            onClick={() => onGmAction('CUSTOM_NIGHT_SLEEP')}
                            disabled={state.phase !== 'NIGHT_CUSTOM'}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 disabled:opacity-35 text-[#070B14] cursor-pointer"
                          >
                            Sleep
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {state.phase !== 'NIGHT_RESOLVE' ? (
                    <button
                      type="button"
                      onClick={() => onGmAction('RESOLVE_NIGHT')}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-bold text-xs cursor-pointer"
                    >
                      Resolve Night & Review Private Summary
                    </button>
                  ) : (
                    /* Rich Night Summary Card */
                    <div
                      className="rounded-xl border border-amber-400/45 p-4 space-y-3"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold text-amber-300 border-b border-white/10 pb-2">
                        <span>Night Summary (GM Private)</span>
                        <Lock size={13} />
                      </div>
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-slate-300">
                            <Skull size={14} className="text-red-400" />
                            <span>Mafia Target</span>
                          </span>
                          <span className="font-semibold text-amber-300">
                            {mafiaTargetName || 'None'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-slate-300">
                            <Shield size={14} className="text-emerald-400" />
                            <span>Bodyguard Protection</span>
                          </span>
                          <span className="font-semibold text-emerald-300">
                            {bgTargetName || 'None'}
                            {night?.protectedTargetSaved ? ' (Saved!)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-2 text-slate-300">
                            <Search size={14} className="text-sky-400" />
                            <span>Detective Investigation</span>
                          </span>
                          <span className="font-semibold text-sky-300">
                            {detTargetName
                              ? `${detTargetName} → ${
                                  night?.detectiveResultIsMafia ? 'Mafia' : 'Not Mafia'
                                }`
                              : 'None'}
                          </span>
                        </div>
                        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                          <span className="text-slate-400">Final Morning Outcome</span>
                          <span className="text-white font-semibold">
                            {night?.protectedTargetSaved
                              ? 'Saved by Bodyguard'
                              : resolvedVictim
                                ? `${resolvedVictim.name} eliminated`
                                : 'Nobody eliminated'}
                          </span>
                        </div>
                        {state.settings.allowGmNightOverride && (
                          <div className="flex items-center justify-between pt-1">
                            <span className="text-slate-400">Manual Override:</span>
                            <select
                              value={night?.resolvedVictimId || 'NONE'}
                              onChange={(e) =>
                                onGmAction('OVERRIDE_NIGHT_OUTCOME', {
                                  victimId: e.target.value === 'NONE' ? null : e.target.value,
                                })
                              }
                              style={{ backgroundColor: theme.bgSurface }}
                              className="rounded-lg border border-white/10 px-2 py-1 text-xs text-white"
                            >
                              <option value="NONE">Nobody Eliminated</option>
                              {livingPlayers.map((p) => (
                                <option key={p.id} value={p.id}>
                                  Eliminate {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => onGmAction('START_DAY')}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-bold text-xs cursor-pointer inline-flex items-center justify-center gap-2"
                      >
                        <Sun size={14} />
                        <span>Continue to Day</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!isNightPhase && state.phase !== 'GAME_OVER' && (
              <div
                className="rounded-2xl border border-white/10 p-5 space-y-4"
                style={{ backgroundColor: theme.bgSurface }}
              >
                <div className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sun size={16} className="text-amber-400" />
                  <span>Day & Voting Controls</span>
                </div>

                {state.phase === 'DAY_ANNOUNCE' && (
                  <div className="space-y-3 text-xs">
                    <div className="flex flex-wrap gap-2">
                      {resolvedVictim && (
                        <button
                          type="button"
                          onClick={() =>
                            onGmAction('ANNOUNCE_DAY', {
                              mode: 'eliminated',
                              revealRole: revealRoleToggle,
                            })
                          }
                          className="px-3.5 py-2 rounded-lg bg-[#DC2626] text-white font-semibold cursor-pointer"
                        >
                          Announce {resolvedVictim.name} Eliminated
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          onGmAction('ANNOUNCE_DAY', { mode: 'none', revealRole: false })
                        }
                        className="px-3.5 py-2 rounded-lg bg-white/10 text-white font-semibold cursor-pointer"
                      >
                        Announce Nobody Eliminated
                      </button>
                    </div>
                    {state.settings.customAnnouncementsEnabled && (
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customAnnouncement}
                          onChange={(e) => setCustomAnnouncement(e.target.value)}
                          placeholder="Custom morning announcement..."
                          style={{ backgroundColor: theme.bgCanvas }}
                          className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (!customAnnouncement.trim()) return;
                            onGmAction('ANNOUNCE_DAY', {
                              mode: 'custom',
                              revealRole: revealRoleToggle,
                              customText: customAnnouncement.trim(),
                            });
                            setCustomAnnouncement('');
                          }}
                          className="px-3 py-2 rounded-lg bg-white/10 text-white cursor-pointer"
                        >
                          Post
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => onGmAction('START_DISCUSSION')}
                        className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#070B14] font-bold cursor-pointer"
                      >
                        Start Discussion
                      </button>
                      <button
                        type="button"
                        onClick={() => onGmAction('START_VOTING')}
                        className="py-2.5 px-4 rounded-xl bg-white/10 text-white font-semibold cursor-pointer"
                      >
                        Start Voting
                      </button>
                    </div>
                  </div>
                )}

                {state.phase === 'DAY_DISCUSSION' && (
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => onGmAction('END_DISCUSSION')}
                      className="px-4 py-2.5 rounded-xl bg-white/10 text-white font-semibold cursor-pointer"
                    >
                      End Discussion
                    </button>
                    <button
                      type="button"
                      onClick={() => onGmAction('START_VOTING')}
                      className="flex-1 py-2.5 rounded-xl bg-amber-500 text-[#070B14] font-bold cursor-pointer"
                    >
                      Start Voting Phase
                    </button>
                  </div>
                )}

                {state.phase === 'DAY_VOTING' && (
                  <div className="space-y-3 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      {livingPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-lg border border-white/5 px-2.5 py-1.5 flex justify-between"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <span className="text-slate-200">{p.name}</span>
                          <span className={p.hasVotedThisRound ? 'text-emerald-400' : 'text-slate-500'}>
                            {p.hasVotedThisRound ? 'Voted' : 'Pending'}
                          </span>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => onGmAction('END_VOTING')}
                      className="w-full py-2.5 rounded-xl bg-amber-500 text-[#070B14] font-bold cursor-pointer"
                    >
                      End Voting & Calculate Results
                    </button>
                  </div>
                )}

                {state.phase === 'DAY_VOTE_RESULT' && state.voteResult && (
                  <div className="space-y-3 text-xs">
                    {Object.entries(state.voteResult.counts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([targetId, count]) => {
                        const label =
                          targetId === 'NO_VOTE'
                            ? 'Skip / No Vote'
                            : state.players.find((p) => p.id === targetId)?.name || 'Unknown';
                        return (
                          <div
                            key={targetId}
                            className="flex justify-between rounded-lg px-3 py-2"
                            style={{ backgroundColor: theme.bgCanvas }}
                          >
                            <span className="text-white">{label}</span>
                            <span className="font-mono-tabular text-amber-300 font-semibold">
                              {count}
                            </span>
                          </div>
                        );
                      })}

                    {state.voteResult.isTie ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onGmAction('RESOLVE_TIE', { resolution: 'revote' })}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white cursor-pointer"
                        >
                          Re-vote
                        </button>
                        <button
                          type="button"
                          onClick={() => onGmAction('RESOLVE_TIE', { resolution: 'no_elimination' })}
                          className="px-3 py-1.5 rounded-lg bg-white/10 text-white cursor-pointer"
                        >
                          No Elimination
                        </button>
                        {state.voteResult.tiedPlayerIds.map((pid) => {
                          const p = state.players.find((x) => x.id === pid);
                          return p ? (
                            <button
                              key={pid}
                              type="button"
                              onClick={() =>
                                onGmAction('RESOLVE_TIE', {
                                  resolution: 'eliminate_player',
                                  targetPlayerId: pid,
                                  revealRole: revealRoleToggle,
                                })
                              }
                              className="px-3 py-1.5 rounded-lg bg-[#DC2626] text-white font-semibold cursor-pointer"
                            >
                              Eliminate {p.name}
                            </button>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      state.voteResult.eliminatedPlayerId &&
                      state.players.find((p) => p.id === state.voteResult?.eliminatedPlayerId)
                        ?.isAlive && (
                        <button
                          type="button"
                          onClick={() =>
                            onGmAction('ELIMINATE_PLAYER', {
                              playerId: state.voteResult?.eliminatedPlayerId,
                              revealRole: revealRoleToggle,
                              reason: 'vote',
                            })
                          }
                          className="w-full py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Gavel size={14} />
                          <span>Eliminate {state.voteResult.eliminatedPlayerName}</span>
                        </button>
                      )
                    )}

                    <button
                      type="button"
                      onClick={() => onGmAction('COMPLETE_ROUND')}
                      className="w-full py-2.5 rounded-xl bg-amber-500 text-[#070B14] font-bold cursor-pointer"
                    >
                      Complete Round {state.round}
                    </button>
                  </div>
                )}

                {state.phase === 'ROUND_COMPLETE' && state.lastRoundSummary && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="rounded-xl border border-amber-400/45 p-5 text-center space-y-3"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <Trophy size={30} className="text-amber-400 mx-auto" />
                    <div className="font-display text-lg font-bold text-white">
                      ROUND {state.round} RESULTS
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-slate-400">Eliminated</div>
                        <div className="font-bold text-red-400">
                          {state.lastRoundSummary.voteEliminatedName ||
                            state.lastRoundSummary.nightVictimName ||
                            'Nobody'}
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/5 p-2">
                        <div className="text-slate-400">Remaining</div>
                        <div className="font-mono-tabular font-bold text-white">
                          {state.lastRoundSummary.remainingAliveCount}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGmAction('START_NEXT_ROUND')}
                      className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-[#070B14] font-bold text-sm cursor-pointer"
                    >
                      Start Round {state.round + 1}
                    </button>
                  </motion.div>
                )}

                <div className="pt-2 border-t border-white/10 flex justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setShowEndModal((v) => !v)}
                    className="text-slate-300 hover:text-white underline cursor-pointer"
                  >
                    Announce Game Result
                  </button>
                </div>

                {showEndModal && (
                  <div className="flex gap-2 text-xs">
                    <select
                      value={manualResultTeam}
                      onChange={(e) =>
                        setManualResultTeam(e.target.value as 'Town' | 'Mafia' | 'Neutral')
                      }
                      style={{ backgroundColor: theme.bgCanvas }}
                      className="rounded-lg border border-white/10 px-2 py-1.5 text-white"
                    >
                      <option value="Town">Town Wins</option>
                      <option value="Mafia">Mafia Wins</option>
                      <option value="Neutral">Custom</option>
                    </select>
                    <input
                      type="text"
                      value={manualResultReason}
                      onChange={(e) => setManualResultReason(e.target.value)}
                      placeholder="Victory note..."
                      style={{ backgroundColor: theme.bgCanvas }}
                      className="flex-1 rounded-lg border border-white/10 px-2 py-1.5 text-white"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        onGmAction('ANNOUNCE_RESULT', {
                          team: manualResultTeam,
                          reason: manualResultReason,
                        });
                        setShowEndModal(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-[#070B14] font-semibold cursor-pointer"
                    >
                      Declare
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* PLAYER ROLES TAB */}
        {sidebarTab === 'roles' && (
          <div
            className="rounded-2xl border border-white/10 p-4 space-y-2.5"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="text-sm font-semibold text-white">Player Roles & Moderation</div>
            {nonGmPlayers.map((p) => {
              const isVoiceLive = state.voicePeers.includes(p.id);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2"
                  style={{
                    backgroundColor: theme.bgCanvas,
                    borderColor: isVoiceLive ? 'rgba(16,185,129,0.5)' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <AvatarEmblem avatar={p.avatar} isAlive={p.isAlive} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                        <span className="truncate">{p.name}</span>
                        {isVoiceLive && <Mic size={11} className="text-emerald-400 shrink-0" />}
                      </div>
                      <div className={`text-[11px] font-semibold ${getRoleTextColor(p.role)}`}>
                        {p.role} · {p.isAlive ? 'Alive' : 'Eliminated'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onGmAction('TOGGLE_PLAYER_MUTE', { playerId: p.id })}
                      title={p.isMuted ? 'Unmute Player' : 'Mute Player Voice & Chat'}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-300 cursor-pointer"
                    >
                      {p.isMuted ? <VolumeX size={13} className="text-red-400" /> : <Volume2 size={13} />}
                    </button>
                  {p.isAlive ? (
                    <button
                      type="button"
                      onClick={() =>
                        onGmAction('ELIMINATE_PLAYER', {
                          playerId: p.id,
                          revealRole: revealRoleToggle,
                          reason: 'gm',
                        })
                      }
                      className="p-1.5 rounded-lg border border-white/10 text-slate-300 hover:text-red-300 cursor-pointer"
                    >
                      <Skull size={13} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        onGmAction('TOGGLE_REVEAL_ROLE', {
                          playerId: p.id,
                          reveal: !p.roleRevealed,
                        })
                      }
                      className="p-1.5 rounded-lg border border-white/10 text-amber-300 cursor-pointer"
                    >
                      {p.roleRevealed ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* ROUND HISTORY TAB */}
        {sidebarTab === 'history' && (
          <div
            className="rounded-2xl border border-white/10 p-4 space-y-3"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <History size={15} className="text-amber-400" />
              <span>Full Private Round History</span>
            </div>
            {state.roundHistory.length === 0 ? (
              <div className="text-xs text-slate-400 py-8 text-center">
                No completed rounds recorded yet.
              </div>
            ) : (
              [...state.roundHistory].reverse().map((r) => (
                <div
                  key={r.round}
                  className="rounded-xl border border-white/10 p-3 text-xs space-y-1"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <div className="font-semibold text-amber-300">
                    Round {r.round} · {r.remainingAliveCount} Alive
                  </div>
                  <div className="text-slate-300">
                    Mafia: {r.mafiaTargetName || 'None'} · Bodyguard:{' '}
                    {r.bodyguardTargetName || 'None'}
                  </div>
                  <div className="text-slate-300">
                    Detective: {r.detectiveTargetName || 'None'}{' '}
                    {r.detectiveTargetName
                      ? `(${r.detectiveResultIsMafia ? 'Mafia' : 'Not Mafia'})`
                      : ''}
                  </div>
                  <div className="text-slate-400">{r.dayAnnouncementText}</div>
                  <div className="text-slate-300">
                    Vote Eliminated: {r.voteEliminatedName || 'None'}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* SECRET INFO DOSSIER TAB */}
        {sidebarTab === 'secret' && (
          <div
            className="rounded-2xl border border-amber-400/30 p-4 space-y-4 text-xs"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                <Lock size={14} />
                <span>Secret GM Dossier</span>
              </div>
              <span className="text-[11px] text-slate-400">Hidden from players</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div
                className="rounded-xl border border-red-500/30 p-2.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="text-[10px] text-slate-400">Mafia Target</div>
                <div className="font-semibold text-red-300 mt-0.5 truncate">
                  {mafiaTargetName || 'None'}
                </div>
              </div>
              <div
                className="rounded-xl border border-emerald-500/30 p-2.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="text-[10px] text-slate-400">Bodyguard Protect</div>
                <div className="font-semibold text-emerald-300 mt-0.5 truncate">
                  {bgTargetName || 'None'}
                </div>
              </div>
              <div
                className="rounded-xl border border-sky-500/30 p-2.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="text-[10px] text-slate-400">Detective Check</div>
                <div className="font-semibold text-sky-300 mt-0.5 truncate">
                  {detTargetName
                    ? `${detTargetName} (${night?.detectiveResultIsMafia ? 'Mafia' : 'Safe'})`
                    : 'None'}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-slate-200">All Assigned Roles</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {nonGmPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-lg border border-white/10 px-2.5 py-1.5 flex items-center justify-between gap-2"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <span className={`truncate ${p.isAlive ? 'text-white' : 'text-slate-500 line-through'}`}>
                      {p.name}
                    </span>
                    <span className={`font-semibold shrink-0 ${getRoleTextColor(p.role)}`}>
                      {p.role || 'None'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <div className="font-semibold text-slate-200">Private GM Notes</div>
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={4}
                placeholder="Private Game Master notes (never sent to players)..."
                style={{ backgroundColor: theme.bgCanvas }}
                className="w-full rounded-xl border border-white/10 p-3 text-slate-200"
              />
              <button
                type="button"
                onClick={() => onGmAction('UPDATE_GM_NOTES', { notes: notesDraft })}
                className="px-3.5 py-2 rounded-lg bg-amber-500 text-[#070B14] font-semibold cursor-pointer"
              >
                Save Private Notes
              </button>
            </div>
          </div>
        )}

        {/* GAME SETTINGS & PRIVATE NOTES TAB */}
        {sidebarTab === 'settings' && (
          <div
            className="rounded-2xl border border-white/10 p-4 space-y-3 text-xs"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="text-sm font-semibold text-white">GM Private Notes</div>
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={5}
              placeholder="Private Game Master notes (never sent to players)..."
              style={{ backgroundColor: theme.bgCanvas }}
              className="w-full rounded-xl border border-white/10 p-3 text-slate-200"
            />
            <button
              type="button"
              onClick={() => onGmAction('UPDATE_GM_NOTES', { notes: notesDraft })}
              className="px-3.5 py-2 rounded-lg bg-amber-500 text-[#070B14] font-semibold cursor-pointer"
            >
              Save Notes
            </button>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
      </div>

      {/* RIGHT COLUMN: Live Secret Roster & Multi-Channel Comms */}
      <div
        className="lg:col-span-4 rounded-2xl border border-white/10 p-4 flex flex-col h-[420px] lg:h-[calc(100vh-170px)] lg:min-h-[480px] min-w-0"
        style={{ backgroundColor: theme.bgSurface }}
      >
        <div className="flex items-center gap-1 mb-3">
          {(['public', 'mafia', 'dead'] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setChatChannel(ch)}
              className={`flex-1 py-2 min-h-[38px] rounded-lg text-xs font-medium cursor-pointer whitespace-nowrap ${
                chatChannel === ch
                  ? 'bg-amber-500 text-[#070B14] font-semibold'
                  : 'bg-white/5 text-slate-300'
              }`}
            >
              {ch === 'public' ? 'Day Chat' : ch === 'mafia' ? 'Mafia Chat' : 'Dead Chat'}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {activeChatList.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-8">
              <MessageSquare size={18} className="mx-auto mb-1 opacity-60" />
              No messages yet.
            </div>
          ) : (
            activeChatList.map((m) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18 }}
                className={`rounded-xl border px-3 py-2 text-xs ${
                  m.kind === 'announcement'
                    ? 'border-amber-400/35 bg-amber-950/30 text-amber-100'
                    : 'border-white/5 text-slate-300'
                }`}
                style={m.kind !== 'announcement' ? { backgroundColor: theme.bgCanvas } : undefined}
              >
                <div className="text-[11px] font-semibold text-white">{m.senderName}</div>
                <p className="mt-0.5 break-words">{m.text}</p>
              </motion.div>
            ))
          )}
        </div>

        <form onSubmit={sendChat} className="mt-3 flex gap-2">
          <input
            type="text"
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            placeholder={`Post to ${chatChannel} channel...`}
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
    </div>
  );
}
