import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Copy,
  Crown,
  HeadphoneOff,
  Headphones,
  Mic,
  MicOff,
  Plus,
  Send,
  Shield,
  Skull,
  Search,
  Trash2,
  Users,
  Volume2,
} from 'lucide-react';
import type { ClientGameState, GameSettings, TeamAlignment } from '../shared/types.ts';
import {
  AvatarEmblem,
  getRoleTextColor,
  RAINY_PARLOR_URL,
} from '../utils/avatars.tsx';
import type { ParlorTheme } from '../utils/parlorThemes.ts';

export function LobbyView({
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
  onCopied,
  onOpenFriends,
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
  onCopied: (text: string) => void;
  onOpenFriends?: () => void;
}) {
  const [gmSubTab, setGmSubTab] = useState<'assign' | 'rules' | 'custom'>('assign');
  const [chatInput, setChatInput] = useState('');
  const [customName, setCustomName] = useState('');
  const [customTeam, setCustomTeam] = useState<TeamAlignment>('Town');
  const [customAction, setCustomAction] = useState<
    'none' | 'investigate' | 'protect' | 'eliminate' | 'custom'
  >('none');
  const [customAppearsMafia, setCustomAppearsMafia] = useState(false);
  const [customDesc, setCustomDesc] = useState('');

  const nonGmPlayers = state.players.filter((p) => !p.isGM);
  const unassignedCount = nonGmPlayers.filter((p) => !p.role).length;
  const allRolesValid = nonGmPlayers.length >= 2 && unassignedCount === 0;
  const availableRoles = [
    'Mafia',
    'Detective',
    'Bodyguard',
    'Villager',
    ...state.customRoles.map((c) => c.name),
  ];

  const effectiveTab = activeSection === 'settings' ? 'rules' : gmSubTab;

  const updateSetting = <K extends keyof GameSettings>(key: K, value: GameSettings[K]) => {
    onGmAction('UPDATE_SETTINGS', { settings: { [key]: value } });
  };

  const updateRoleCount = (role: string, count: number) => {
    onGmAction('UPDATE_SETTINGS', {
      settings: {
        roleCounts: {
          ...state.settings.roleCounts,
          [role]: Math.max(0, Math.min(24, count)),
        },
      },
    });
  };

  const handleAddCustomRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onGmAction('ADD_CUSTOM_ROLE', {
      name: customName.trim(),
      team: customTeam,
      nightAction: customAction,
      appearsAsMafia: customAppearsMafia,
      description: customDesc.trim(),
    });
    setCustomName('');
    setCustomDesc('');
  };

  const handleChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    onSendMessage('CHAT_SEND', { channel: 'public', text: chatInput.trim() });
    setChatInput('');
  };

  const copyInvite = () => {
    const url = `${window.location.origin}/?room=${state.roomCode}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => onCopied(`Invite link copied (#${state.roomCode}).`))
      .catch(() => onCopied(`Room ID: #${state.roomCode}`));
  };

  const me = state.players.find((p) => p.id === state.viewerId);

  const renderRoleIcon = (roleName: string) => {
    if (roleName === 'Mafia') return <Skull size={15} className="text-red-400" />;
    if (roleName === 'Detective') return <Search size={15} className="text-sky-400" />;
    if (roleName === 'Bodyguard') return <Shield size={15} className="text-blue-400" />;
    return <Users size={15} className="text-emerald-400" />;
  };

  return (
    <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
      {/* LEFT COLUMN: Player List with Portrait Avatars & Green Ready Status */}
      <motion.div
        initial={{ opacity: 0, x: -14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="lg:col-span-3 rounded-2xl border border-white/10 p-4 flex flex-col lg:max-h-[700px] min-w-0"
        style={{ backgroundColor: theme.bgSurface }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="text-sm font-semibold text-white">
            Players ({nonGmPlayers.length}/{state.settings.playerLimit})
          </div>
          <div className="flex items-center gap-2.5">
            {onOpenFriends && (
              <button
                type="button"
                onClick={onOpenFriends}
                className="inline-flex items-center gap-1 text-xs text-emerald-300 hover:underline cursor-pointer"
              >
                <Users size={12} />
                <span>Friends</span>
              </button>
            )}
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex items-center gap-1 text-xs text-amber-300 hover:underline cursor-pointer"
            >
              <Copy size={12} />
              <span>Copy Link</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {nonGmPlayers.length === 0 ? (
            <div className="text-xs text-slate-400 text-center py-10">
              Share Room ID <span className="text-amber-300 font-mono-tabular">#{state.roomCode}</span> for
              players to join.
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {nonGmPlayers.map((p, idx) => {
                const isVoiceLive = state.voicePeers.includes(p.id);
                return (
                  <motion.div
                    key={p.id}
                    layout
                    initial={{ opacity: 0, x: -10, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.96 }}
                    transition={{ duration: 0.22, delay: Math.min(idx * 0.03, 0.25) }}
                    className="rounded-xl border border-white/10 px-3 py-2 flex items-center justify-between gap-2"
                    style={{
                      backgroundColor: theme.bgCanvas,
                      borderColor: isVoiceLive ? 'rgba(16,185,129,0.5)' : undefined,
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarEmblem avatar={p.avatar} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {p.name} {p.id === state.viewerId ? '(You)' : ''}
                        </div>
                        {state.viewerIsGM && (
                          <div className={`text-[11px] font-semibold truncate ${getRoleTextColor(p.role)}`}>
                            {p.role || 'Unassigned'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {isVoiceLive && (
                        <Volume2 size={13} className="text-emerald-400" />
                      )}
                      <motion.span
                        key={p.isReady ? 'ready' : 'wait'}
                        initial={{ scale: 0.85, opacity: 0.6 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`text-xs font-semibold ${
                          p.isReady ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {p.isReady ? 'Ready' : 'Waiting'}
                      </motion.span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {!state.viewerIsGM && me && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onSendMessage('READY_TOGGLE', {})}
            className={`mt-3 w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-sm font-semibold transition-colors cursor-pointer ${
              me.isReady
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-amber-500 hover:bg-amber-400 text-[#070B14]'
            }`}
          >
            <CheckCircle2 size={16} />
            <span>{me.isReady ? 'Ready' : 'Mark Ready'}</span>
          </motion.button>
        )}
      </motion.div>

      {/* CENTER HERO: Noir Character Centerpiece + Waiting Banner + Lobby Chat */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
        className="lg:col-span-5 space-y-4 min-w-0"
      >
        <div
          className="relative rounded-2xl border border-white/10 overflow-hidden min-h-[220px] sm:min-h-[280px] lg:min-h-[340px] flex flex-col justify-end p-5 sm:p-6 text-center"
          style={{ backgroundColor: theme.bgSurface }}
        >
          <img
            src={RAINY_PARLOR_URL}
            alt="Noir Mafia speakeasy parlor interior"
            decoding="async"
            referrerPolicy="no-referrer"
            className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-75"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(7,11,20,0.96) 15%, rgba(7,11,20,0.35) 60%, rgba(127,29,29,0.22) 100%)',
            }}
          />
          <div className="relative z-10 space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-white">
              {state.viewerIsGM
                ? 'Assign Roles & Start Match'
                : 'Waiting for Game Master...'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              {state.viewerIsGM
                ? 'Manually assign each player’s secret role on the right, or click Confirm Roles to fill counts.'
                : 'Game Master will assign roles manually and start the game.'}
            </p>
          </div>
        </div>

        {/* Online Voice Parlor Strip */}
        {state.settings.voiceChatEnabled && (
          <div
            className="rounded-2xl border border-white/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-white">
                <Volume2 size={15} className="text-emerald-400 shrink-0" />
                <span>Online Voice Parlor</span>
                <span className="font-mono-tabular text-[11px] text-emerald-300">
                  · {state.voicePeers.length} Live
                </span>
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                {state.voicePeers.length > 0
                  ? `Speaking: ${state.voicePeers
                      .map((id) => state.players.find((p) => p.id === id)?.name)
                      .filter(Boolean)
                      .join(', ')}`
                  : 'Turn on your mic to talk live with friends in the room.'}
              </div>
              {voiceError && (
                <div className="text-[11px] text-amber-300 mt-1">{voiceError}</div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                disabled={Boolean(me?.isMuted || !me?.canSpeak)}
                onClick={onToggleMic}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40 ${
                  micActive
                    ? isLocalSpeaking
                      ? 'bg-emerald-500 text-[#04120B] shadow-[0_0_16px_rgba(16,185,129,0.5)]'
                      : 'bg-emerald-600 text-white'
                    : 'border border-emerald-500/40 bg-[#070B14] text-emerald-200 hover:border-emerald-400'
                }`}
              >
                {micActive ? <Mic size={14} /> : <MicOff size={14} />}
                <span>{micActive ? 'Mic Live' : 'Join Voice'}</span>
              </motion.button>
              <button
                type="button"
                onClick={onToggleDeafen}
                aria-label={deafened ? 'Unmute room speakers' : 'Deafen room speakers'}
                className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                  deafened
                    ? 'border-red-500/45 bg-red-950/50 text-red-300'
                    : 'border-white/10 bg-[#070B14] text-slate-300 hover:border-white/25'
                }`}
                title={deafened ? 'Speakers Deafened' : 'Speakers Active'}
              >
                {deafened ? <HeadphoneOff size={14} /> : <Headphones size={14} />}
              </button>
            </div>
          </div>
        )}

        {/* Parlor Lobby Chat */}
        <div
          className="rounded-2xl border border-white/10 p-4 flex flex-col h-[280px]"
          style={{ backgroundColor: theme.bgSurface }}
        >
          <div className="text-xs font-semibold text-slate-300 mb-2">
            Parlor Lobby Chat
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {state.publicChat.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-10">
                Say hello while everyone joins the room.
              </div>
            ) : (
              state.publicChat.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-xl border border-white/5 px-3 py-2 text-xs"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <span className="font-semibold text-white mr-1.5">{m.senderName}:</span>
                  <span className="text-slate-300">{m.text}</span>
                </motion.div>
              ))
            )}
          </div>
          <form onSubmit={handleChat} className="mt-2.5 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type a message..."
              style={{ backgroundColor: theme.bgCanvas }}
              className="flex-1 min-w-0 rounded-xl border border-white/10 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
            />
            <motion.button
              whileTap={{ scale: 0.94 }}
              type="submit"
              style={{ backgroundColor: theme.accent, color: theme.accentText }}
              className="rounded-xl px-3.5 py-2 min-h-[40px] min-w-[44px] flex items-center justify-center cursor-pointer"
            >
              <Send size={14} />
            </motion.button>
          </form>
        </div>
      </motion.div>

      {/* RIGHT COLUMN: Game Master Control Panel (or Rules Summary for Players) */}
      <motion.div
        initial={{ opacity: 0, x: 14 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.35, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="lg:col-span-4 rounded-2xl border border-amber-400/30 p-4 flex flex-col lg:max-h-[700px] min-w-0"
        style={{ backgroundColor: theme.bgSurface }}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
          <div className="flex items-center gap-2">
            <Crown size={17} className="text-amber-400" />
            <span className="text-sm font-semibold text-amber-300">
              {state.viewerIsGM
                ? 'Game Master Control'
                : `GM: ${state.players.find((p) => p.isGM)?.name || 'Game Master'}`}
            </span>
          </div>
          {state.viewerIsGM && (
            <div className="flex items-center gap-1">
              {(['assign', 'rules', 'custom'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setGmSubTab(t)}
                  className={`px-2 py-1 rounded-md text-[11px] font-medium capitalize cursor-pointer ${
                    effectiveTab === t
                      ? 'bg-amber-400 text-[#070B14] font-semibold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </div>

        {state.viewerIsGM ? (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {effectiveTab === 'assign' && (
              <>
                {/* Visual 4-Card Role Assignment Deck */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-200">Role Deck Setup</span>
                    <button
                      type="button"
                      onClick={() => setGmSubTab('custom')}
                      className="text-[11px] font-semibold text-amber-300 hover:underline cursor-pointer"
                    >
                      + Custom Roles
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    {(
                      [
                        {
                          role: 'Mafia',
                          cardBg: 'linear-gradient(160deg, rgba(127,29,29,0.55), rgba(15,22,36,0.95))',
                          border: 'rgba(239,68,68,0.45)',
                          iconBg: 'rgba(220,38,38,0.22)',
                        },
                        {
                          role: 'Detective',
                          cardBg: 'linear-gradient(160deg, rgba(30,58,138,0.5), rgba(15,22,36,0.95))',
                          border: 'rgba(59,130,246,0.45)',
                          iconBg: 'rgba(37,99,235,0.22)',
                        },
                        {
                          role: 'Bodyguard',
                          cardBg: 'linear-gradient(160deg, rgba(6,78,59,0.5), rgba(15,22,36,0.95))',
                          border: 'rgba(16,185,129,0.45)',
                          iconBg: 'rgba(16,185,129,0.22)',
                        },
                        {
                          role: 'Villager',
                          cardBg: 'linear-gradient(160deg, rgba(120,53,15,0.5), rgba(15,22,36,0.95))',
                          border: 'rgba(245,158,11,0.45)',
                          iconBg: 'rgba(245,158,11,0.22)',
                        },
                      ] as const
                    ).map((card) => {
                      const count = state.settings.roleCounts[card.role] ?? 0;
                      return (
                        <div
                          key={card.role}
                          className="rounded-xl border p-3 text-center space-y-2"
                          style={{
                            background: card.cardBg,
                            borderColor: card.border,
                          }}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center mx-auto"
                            style={{ backgroundColor: card.iconBg }}
                          >
                            {renderRoleIcon(card.role)}
                          </div>
                          <div>
                            <div className={`text-xs font-bold ${getRoleTextColor(card.role)}`}>
                              {card.role}
                            </div>
                            <div className="font-mono-tabular text-[11px] text-slate-300">
                              {count} {count === 1 ? 'Player' : 'Players'}
                            </div>
                          </div>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              aria-label={`Decrease ${card.role}`}
                              onClick={() => updateRoleCount(card.role, count - 1)}
                              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-black/40 border border-white/10 hover:bg-white/15 text-slate-200 text-sm font-bold cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-mono-tabular text-xs font-bold text-white">
                              {count}
                            </span>
                            <button
                              type="button"
                              aria-label={`Increase ${card.role}`}
                              onClick={() => updateRoleCount(card.role, count + 1)}
                              className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-black/40 border border-white/10 hover:bg-white/15 text-slate-200 text-sm font-bold cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Any Custom Roles */}
                  {state.customRoles.map((cr) => {
                    const count = state.settings.roleCounts[cr.name] ?? 0;
                    return (
                      <div
                        key={cr.id}
                        className="rounded-xl border border-indigo-400/35 px-3 py-2 flex items-center justify-between gap-2"
                        style={{ backgroundColor: theme.bgCanvas }}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {renderRoleIcon(cr.name)}
                          <span className="text-xs font-semibold text-indigo-300 truncate">
                            {cr.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => updateRoleCount(cr.name, count - 1)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 text-sm cursor-pointer"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-mono-tabular text-sm font-semibold text-white">
                            {count}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateRoleCount(cr.name, count + 1)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 text-slate-200 text-sm cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Manual Player Role Dropdowns */}
                <div className="space-y-2 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Manual Player Role Assignment</span>
                    <span className="font-mono-tabular">
                      {nonGmPlayers.length - unassignedCount}/{nonGmPlayers.length}
                    </span>
                  </div>
                  {nonGmPlayers.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-xl border border-white/10 px-3 py-2 flex items-center justify-between gap-2"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <span className="text-xs font-medium text-white truncate min-w-0 flex-1">{p.name}</span>
                      <select
                        aria-label={`Role for ${p.name}`}
                        value={p.role || ''}
                        onChange={(e) =>
                          onGmAction('ASSIGN_ROLE', {
                            playerId: p.id,
                            role: e.target.value || null,
                          })
                        }
                        style={{ backgroundColor: theme.bgSurface }}
                        className="rounded-lg border border-white/15 px-2.5 py-1.5 min-h-[38px] max-w-[150px] sm:max-w-[180px] text-xs text-white shrink-0"
                      >
                        <option value="">Select role...</option>
                        {availableRoles.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {/* Role Validation Status + Confirm / Start CTA */}
                <div className="space-y-2 pt-2">
                  <div
                    className={`rounded-xl border px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${
                      allRolesValid
                        ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    <CheckCircle2
                      size={14}
                      className={allRolesValid ? 'text-emerald-400' : 'text-slate-500'}
                    />
                    <span>
                      {nonGmPlayers.length < 2
                        ? 'Need at least 2 players to start match'
                        : unassignedCount === 0
                          ? 'All roles assigned successfully!'
                          : `Assign ${unassignedCount} remaining player role${
                              unassignedCount === 1 ? '' : 's'
                            }`}
                    </span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onGmAction('AUTO_ASSIGN_ROLES')}
                    disabled={nonGmPlayers.length === 0}
                    className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-[#070B14] font-bold text-sm cursor-pointer"
                  >
                    Confirm Roles
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onGmAction('START_GAME')}
                    disabled={!allRolesValid}
                    className="w-full py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-500 disabled:opacity-40 text-white font-bold text-sm cursor-pointer"
                  >
                    Start Game
                  </motion.button>
                </div>
              </>
            )}

            {effectiveTab === 'rules' && (
              <div className="space-y-2.5 text-xs">
                <label className="flex items-center justify-between rounded-xl border border-white/10 p-2.5" style={{ backgroundColor: theme.bgCanvas }}>
                  <span className="text-slate-200">Player Limit</span>
                  <input
                    type="number"
                    min={3}
                    max={24}
                    value={state.settings.playerLimit}
                    onChange={(e) => updateSetting('playerLimit', Number(e.target.value))}
                    className="w-16 rounded bg-white/10 px-2 py-1 text-right font-mono-tabular text-white"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 p-2.5" style={{ backgroundColor: theme.bgCanvas }}>
                  <span className="text-slate-200">Max Rounds (0 = Unlimited)</span>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    value={state.settings.maxRounds}
                    onChange={(e) => updateSetting('maxRounds', Number(e.target.value))}
                    className="w-16 rounded bg-white/10 px-2 py-1 text-right font-mono-tabular text-white"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 p-2.5" style={{ backgroundColor: theme.bgCanvas }}>
                  <span className="text-slate-200">Discussion Sec</span>
                  <input
                    type="number"
                    min={15}
                    max={600}
                    value={state.settings.discussionDuration}
                    onChange={(e) => updateSetting('discussionDuration', Number(e.target.value))}
                    className="w-16 rounded bg-white/10 px-2 py-1 text-right font-mono-tabular text-white"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 p-2.5" style={{ backgroundColor: theme.bgCanvas }}>
                  <span className="text-slate-200">Voting Sec</span>
                  <input
                    type="number"
                    min={15}
                    max={300}
                    value={state.settings.votingDuration}
                    onChange={(e) => updateSetting('votingDuration', Number(e.target.value))}
                    className="w-16 rounded bg-white/10 px-2 py-1 text-right font-mono-tabular text-white"
                  />
                </label>
                <label className="flex items-center justify-between rounded-xl border border-white/10 p-2.5" style={{ backgroundColor: theme.bgCanvas }}>
                  <span className="text-slate-200">Tie Rule</span>
                  <select
                    value={state.settings.tieRule}
                    onChange={(e) =>
                      updateSetting('tieRule', e.target.value as GameSettings['tieRule'])
                    }
                    className="rounded bg-white/10 px-2 py-1 text-white"
                  >
                    <option value="manual">GM Manual</option>
                    <option value="revote">Re-vote</option>
                    <option value="no_elimination">No Elimination</option>
                    <option value="tie_breaker">Tie-breaker</option>
                  </select>
                </label>
                {(
                  [
                    ['revealRoleOnElimination', 'Reveal role on elimination'],
                    ['anonymousVoting', 'Anonymous voting'],
                    ['allowVoteChange', 'Allow vote changes'],
                    ['allowNoVote', 'Allow Skip / No Vote'],
                    ['mafiaTeamCommunication', 'Mafia night chat'],
                    ['mafiaKnowEachOther', 'Mafia know teammates'],
                    ['bodyguardSelfProtect', 'Bodyguard self-protect'],
                    ['allowGmNightOverride', 'GM night override'],
                    ['voiceChatEnabled', 'Voice chat enabled'],
                    ['deadChatEnabled', 'Dead spectator chat'],
                  ] as const
                ).map(([k, label]) => (
                  <label
                    key={k}
                    className="flex items-center justify-between rounded-xl border border-white/10 p-2.5 cursor-pointer"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <span className="text-slate-200">{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(state.settings[k])}
                      onChange={(e) => updateSetting(k, e.target.checked)}
                      className="h-4 w-4 accent-amber-400"
                    />
                  </label>
                ))}
              </div>
            )}

            {effectiveTab === 'custom' && (
              <div className="space-y-3 text-xs">
                <form
                  onSubmit={handleAddCustomRole}
                  className="rounded-xl border border-white/10 p-3 space-y-2.5"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Custom role name (e.g. Vigilante)"
                    style={{ backgroundColor: theme.bgSurface }}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={customTeam}
                      onChange={(e) => setCustomTeam(e.target.value as TeamAlignment)}
                      style={{ backgroundColor: theme.bgSurface }}
                      className="rounded-lg border border-white/10 px-2 py-1.5 text-white"
                    >
                      <option value="Town">Town</option>
                      <option value="Mafia">Mafia</option>
                      <option value="Neutral">Neutral</option>
                    </select>
                    <select
                      value={customAction}
                      onChange={(e) =>
                        setCustomAction(
                          e.target.value as
                            | 'none'
                            | 'investigate'
                            | 'protect'
                            | 'eliminate'
                            | 'custom'
                        )
                      }
                      style={{ backgroundColor: theme.bgSurface }}
                      className="rounded-lg border border-white/10 px-2 py-1.5 text-white"
                    >
                      <option value="none">No Night Action</option>
                      <option value="custom">Custom Action</option>
                      <option value="investigate">Investigate</option>
                      <option value="protect">Protect</option>
                      <option value="eliminate">Eliminate</option>
                    </select>
                  </div>
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customAppearsMafia}
                      onChange={(e) => setCustomAppearsMafia(e.target.checked)}
                      className="h-3.5 w-3.5 accent-amber-400"
                    />
                    <span>Appears as Mafia to Detective</span>
                  </label>
                  <input
                    type="text"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                    placeholder="Ability description..."
                    style={{ backgroundColor: theme.bgSurface }}
                    className="w-full rounded-lg border border-white/10 px-3 py-2 min-h-[40px] text-base sm:text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-500 text-[#070B14] font-semibold py-2 cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add Custom Role</span>
                  </button>
                </form>

                {state.customRoles.map((r) => (
                  <div
                    key={r.id}
                    className="rounded-xl border border-white/10 p-2.5 flex items-center justify-between"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div>
                      <div className="font-semibold text-white">
                        {r.name} · {r.team}
                      </div>
                      <div className="text-[11px] text-slate-400">{r.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onGmAction('DELETE_CUSTOM_ROLE', { roleId: r.id })}
                      className="text-slate-400 hover:text-red-400 p-1 cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Ordinary Player Role Counts & Rules Preview */
          <div className="space-y-3">
            {availableRoles.map((roleName) => (
              <div
                key={roleName}
                className="rounded-xl border border-white/10 px-3 py-2.5 flex items-center justify-between"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="flex items-center gap-2.5">
                  {renderRoleIcon(roleName)}
                  <span className={`text-xs font-semibold ${getRoleTextColor(roleName)}`}>
                    {roleName}
                  </span>
                </div>
                <span className="font-mono-tabular text-sm font-semibold text-white">
                  {state.settings.roleCounts[roleName] ?? 0}
                </span>
              </div>
            ))}
            <div
              className="rounded-xl border border-white/10 p-3 text-xs text-slate-300 space-y-1"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <div>Discussion: {state.settings.discussionDuration}s</div>
              <div>
                Voting: {state.settings.votingDuration}s ·{' '}
                {state.settings.anonymousVoting ? 'Anonymous' : 'Public'}
              </div>
              <div>
                Rounds:{' '}
                {state.settings.maxRounds === 0 ? 'Unlimited' : `Max ${state.settings.maxRounds}`}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
