import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  History,
  LogIn,
  LogOut,
  RefreshCw,
  Send,
  Shield,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {
  FriendEntry,
  IncomingInviteItem,
  MatchHistoryItem,
  UserProfileData,
} from '../hooks/useFirebaseAccount.ts';
import type { AvatarId } from '../shared/types.ts';
import { AVATAR_OPTIONS, AvatarEmblem } from '../utils/avatars.tsx';
import type { ParlorTheme } from '../utils/parlorThemes.ts';

export function FriendsDrawerModal({
  open,
  onClose,
  theme,
  isSignedIn,
  authBusy,
  profile,
  friends,
  invites,
  matchHistory,
  currentRoomCode,
  currentRoomName,
  onSignIn,
  onSignOut,
  onUpdateProfile,
  onAddFriend,
  onRemoveFriend,
  onSendInvite,
  onJoinRoomByCode,
  onRespondInvite,
  onRefreshFriends,
  onNotify,
}: {
  open: boolean;
  onClose: () => void;
  theme: ParlorTheme;
  isSignedIn: boolean;
  authBusy: boolean;
  profile: UserProfileData | null;
  friends: FriendEntry[];
  invites: IncomingInviteItem[];
  matchHistory: MatchHistoryItem[];
  currentRoomCode?: string;
  currentRoomName?: string;
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateProfile: (name: string, avatar: AvatarId) => Promise<void>;
  onAddFriend: (code: string) => Promise<{ ok: boolean; message: string }>;
  onRemoveFriend: (friendUid: string) => Promise<void>;
  onSendInvite: (friend: FriendEntry, roomCode: string, roomName: string) => Promise<void>;
  onJoinRoomByCode: (roomCode: string) => Promise<void>;
  onRespondInvite: (inviteId: string, status: 'accepted' | 'dismissed') => Promise<void>;
  onRefreshFriends: () => Promise<void>;
  onNotify: (msg: string, kind?: 'info' | 'error') => void;
}) {
  const [tab, setTab] = useState<'friends' | 'history' | 'profile'>('friends');
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [invitedUids, setInvitedUids] = useState<Record<string, boolean>>({});
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editAvatar, setEditAvatar] = useState<AvatarId>(profile?.avatar || 'fedora');
  const [savingProfile, setSavingProfile] = useState(false);

  const handleOpenProfileTab = () => {
    if (profile) {
      setEditName(profile.displayName);
      setEditAvatar(profile.avatar);
    }
    setTab('profile');
  };

  const handleCopyFriendCode = () => {
    if (!profile?.friendCode) return;
    navigator.clipboard
      ?.writeText(profile.friendCode)
      .then(() => onNotify(`Copied your Player ID: ${profile.friendCode}`))
      .catch(() => onNotify(`Your Player ID: ${profile.friendCode}`));
  };

  const handleAddFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendCodeInput.trim()) return;
    setAddingFriend(true);
    try {
      const res = await onAddFriend(friendCodeInput.trim());
      onNotify(res.message, res.ok ? 'info' : 'error');
      if (res.ok) setFriendCodeInput('');
    } catch {
      onNotify('Could not add friend right now.', 'error');
    } finally {
      setAddingFriend(false);
    }
  };

  const handleInviteFriend = async (f: FriendEntry) => {
    if (!currentRoomCode || !currentRoomName) return;
    try {
      await onSendInvite(f, currentRoomCode, currentRoomName);
      setInvitedUids((prev) => ({ ...prev, [f.friendUid]: true }));
      onNotify(`Room invite sent to ${f.displayName}!`);
    } catch {
      onNotify('Failed to send room invite.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await onUpdateProfile(editName, editAvatar);
      onNotify('Profile saved to your account.');
    } catch {
      onNotify('Failed to save profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#070B14]/75 backdrop-blur-sm flex justify-end"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: 'spring', stiffness: 340, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: theme.bgSurface }}
            className="w-full max-w-md h-full border-l border-white/15 flex flex-col shadow-2xl pb-safe"
          >
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Users size={18} style={{ color: theme.accent }} />
                <div>
                  <h2 className="font-display text-lg font-bold text-white leading-tight">
                    Friends & Account
                  </h2>
                  {profile && (
                    <div className="text-[11px] font-mono-tabular text-amber-300">
                      ID: {profile.friendCode}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <X size={18} />
              </button>
            </div>

            {!isSignedIn ? (
              <div className="p-6 flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl border border-amber-400/35 bg-amber-500/10 flex items-center justify-center">
                  <Shield size={26} className="text-amber-400" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="font-display text-xl font-semibold text-white">
                    Save Your Player ID & Friends
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                    Sign in with Google to get a permanent Player ID, save your friends list, send
                    1-click room invites, and track every Mafia match you play.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onSignIn}
                  disabled={authBusy}
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer disabled:opacity-60"
                >
                  <LogIn size={16} />
                  <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
                </button>
              </div>
            ) : (
              <>
                {/* Account Bar */}
                {profile && (
                  <div
                    className="px-5 py-3 border-b border-white/10 flex items-center justify-between gap-3"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <AvatarEmblem avatar={profile.avatar} size="sm" />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-white truncate">
                          {profile.displayName}
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyFriendCode}
                          className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-amber-300 hover:underline cursor-pointer"
                        >
                          <span>{profile.friendCode}</span>
                          <Copy size={10} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-right shrink-0">
                      <div className="text-[11px] font-mono-tabular text-slate-300">
                        <span className="text-emerald-400 font-semibold">{profile.gamesWon}</span>W /{' '}
                        {profile.gamesPlayed}G
                      </div>
                      <button
                        type="button"
                        onClick={onSignOut}
                        title="Sign out"
                        className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-300 cursor-pointer"
                      >
                        <LogOut size={13} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Sub-tabs */}
                <div className="px-5 pt-3 flex items-center gap-2 border-b border-white/10 pb-3">
                  <button
                    type="button"
                    onClick={() => setTab('friends')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                      tab === 'friends'
                        ? 'bg-amber-500 text-[#070B14]'
                        : 'text-slate-300 hover:text-white bg-white/5'
                    }`}
                  >
                    Friends ({friends.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab('history')}
                    className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center justify-center gap-1 ${
                      tab === 'history'
                        ? 'bg-amber-500 text-[#070B14]'
                        : 'text-slate-300 hover:text-white bg-white/5'
                    }`}
                  >
                    <History size={12} />
                    <span>History ({matchHistory.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenProfileTab}
                    className={`py-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer ${
                      tab === 'profile'
                        ? 'bg-amber-500 text-[#070B14]'
                        : 'text-slate-300 hover:text-white bg-white/5'
                    }`}
                  >
                    Profile
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {tab === 'friends' && (
                    <>
                      {/* Pending Invites */}
                      {invites.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold text-amber-300">
                            Incoming Room Invites ({invites.length})
                          </div>
                          {invites.map((inv) => (
                            <div
                              key={inv.inviteId}
                              className="rounded-xl border border-amber-400/40 p-3 space-y-2"
                              style={{ backgroundColor: theme.bgCanvas }}
                            >
                              <div className="flex items-center gap-2.5">
                                <AvatarEmblem avatar={inv.fromAvatar} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-semibold text-white truncate">
                                    {inv.fromName} invited you!
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {inv.roomName} ·{' '}
                                    <span className="font-mono-tabular text-amber-300">
                                      #{inv.roomCode}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await onRespondInvite(inv.inviteId, 'accepted');
                                    await onJoinRoomByCode(inv.roomCode);
                                    onClose();
                                  }}
                                  className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Accept & Join
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onRespondInvite(inv.inviteId, 'dismissed')}
                                  className="px-3 py-1.5 rounded-lg border border-white/10 text-xs text-slate-300 hover:text-white cursor-pointer"
                                >
                                  Dismiss
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add Friend Form */}
                      <form onSubmit={handleAddFriend} className="space-y-2">
                        <label className="block text-xs font-medium text-slate-300">
                          Add Friend by Player ID
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={friendCodeInput}
                            onChange={(e) => setFriendCodeInput(e.target.value.toUpperCase())}
                            placeholder="MAF-7K4Q"
                            maxLength={16}
                            style={{ backgroundColor: theme.bgCanvas }}
                            className="flex-1 min-w-0 rounded-xl border border-white/10 px-3 py-2 min-h-[44px] text-base sm:text-xs font-mono-tabular uppercase text-white placeholder-slate-500"
                          />
                          <button
                            type="submit"
                            disabled={addingFriend || !friendCodeInput.trim()}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-[#070B14] font-bold px-4 py-2 min-h-[44px] text-xs cursor-pointer"
                          >
                            <UserPlus size={14} />
                            <span>Add</span>
                          </button>
                        </div>
                      </form>

                      {/* Saved Friends List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-300">
                            Saved Friends
                          </span>
                          <button
                            type="button"
                            onClick={() => void onRefreshFriends()}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-amber-300 cursor-pointer"
                          >
                            <RefreshCw size={11} />
                            <span>Refresh</span>
                          </button>
                        </div>

                        {friends.length === 0 ? (
                          <div
                            className="rounded-xl border border-white/10 p-5 text-center text-xs text-slate-400"
                            style={{ backgroundColor: theme.bgCanvas }}
                          >
                            Share your Player ID{' '}
                            <span className="font-mono-tabular text-amber-300 font-semibold">
                              {profile?.friendCode}
                            </span>{' '}
                            with friends or enter theirs above to play together in 1 click.
                          </div>
                        ) : (
                          friends.map((f) => {
                            const inRoom = Boolean(f.currentRoomCode);
                            const inSameRoom =
                              Boolean(currentRoomCode) && f.currentRoomCode === currentRoomCode;
                            return (
                              <div
                                key={f.friendUid}
                                className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2"
                                style={{ backgroundColor: theme.bgCanvas }}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <AvatarEmblem avatar={f.avatar} size="sm" />
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-white truncate">
                                      {f.displayName}
                                    </div>
                                    <div className="text-[11px] font-mono-tabular text-slate-400 truncate">
                                      {f.friendCode}
                                      {inRoom && (
                                        <span className="text-emerald-400 ml-1.5">
                                          · {inSameRoom ? 'In this room' : `Room #${f.currentRoomCode}`}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {currentRoomCode && !inSameRoom && (
                                    <button
                                      type="button"
                                      onClick={() => void handleInviteFriend(f)}
                                      disabled={invitedUids[f.friendUid]}
                                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:bg-emerald-700 disabled:text-white text-[#070B14] font-semibold px-2.5 py-1.5 text-[11px] cursor-pointer"
                                    >
                                      {invitedUids[f.friendUid] ? (
                                        <>
                                          <Check size={11} />
                                          <span>Sent</span>
                                        </>
                                      ) : (
                                        <>
                                          <Send size={11} />
                                          <span>Invite</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {inRoom && !inSameRoom && f.currentRoomCode && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await onJoinRoomByCode(f.currentRoomCode!);
                                        onClose();
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-2.5 py-1.5 text-[11px] cursor-pointer"
                                    >
                                      <span>Join</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => void onRemoveFriend(f.friendUid)}
                                    title="Remove friend"
                                    className="p-1.5 text-slate-500 hover:text-red-400 cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}

                  {tab === 'history' && (
                    <div className="space-y-2.5">
                      {matchHistory.length === 0 ? (
                        <div
                          className="rounded-xl border border-white/10 p-6 text-center text-xs text-slate-400"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          Completed Mafia matches will appear here automatically.
                        </div>
                      ) : (
                        matchHistory.map((m) => (
                          <div
                            key={m.matchId}
                            className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2"
                            style={{ backgroundColor: theme.bgCanvas }}
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {m.roomName}{' '}
                                <span className="text-slate-500 font-mono-tabular">
                                  #{m.roomCode}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                Role: <span className="text-slate-200">{m.role}</span> ·{' '}
                                {m.roundsPlayed} rounds · {m.playerCount} players
                              </div>
                            </div>
                            <span
                              className={`px-2 py-1 rounded-md text-[11px] font-bold shrink-0 ${
                                m.wasGM
                                  ? 'bg-amber-500/15 text-amber-300 border border-amber-400/30'
                                  : m.won
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30'
                                    : 'bg-red-500/15 text-red-300 border border-red-400/30'
                              }`}
                            >
                              {m.wasGM ? 'GM' : m.won ? 'WIN' : 'LOSS'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {tab === 'profile' && profile && (
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Saved Player Name
                        </label>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          maxLength={24}
                          style={{ backgroundColor: theme.bgCanvas }}
                          className="w-full rounded-xl border border-white/10 px-3 py-2 min-h-[44px] text-base sm:text-sm text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1.5">
                          Saved Character Portrait
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {AVATAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setEditAvatar(opt.id)}
                              className="flex items-center justify-center min-h-[44px] p-1.5 rounded-xl border cursor-pointer"
                              style={{
                                backgroundColor:
                                  editAvatar === opt.id ? `${theme.accent}25` : theme.bgCanvas,
                                borderColor:
                                  editAvatar === opt.id
                                    ? theme.accent
                                    : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              <AvatarEmblem avatar={opt.id} size="sm" />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        className="rounded-xl border border-white/10 p-3 grid grid-cols-3 gap-2 text-center"
                        style={{ backgroundColor: theme.bgCanvas }}
                      >
                        <div>
                          <div className="text-lg font-bold font-mono-tabular text-white">
                            {profile.gamesPlayed}
                          </div>
                          <div className="text-[11px] text-slate-400">Matches</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold font-mono-tabular text-emerald-400 flex items-center justify-center gap-1">
                            <Trophy size={13} />
                            <span>{profile.gamesWon}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">Wins</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold font-mono-tabular text-amber-300">
                            {profile.gmHostedCount}
                          </div>
                          <div className="text-[11px] text-slate-400">GM Hosted</div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={savingProfile}
                        style={{ backgroundColor: theme.accent, color: theme.accentText }}
                        className="w-full py-2.5 rounded-xl font-bold text-sm cursor-pointer disabled:opacity-60"
                      >
                        {savingProfile ? 'Saving...' : 'Save Account Profile'}
                      </button>
                    </form>
                  )}
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
