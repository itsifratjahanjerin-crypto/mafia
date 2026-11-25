import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { User } from 'firebase/auth';
import {
  ArrowRight,
  Bell,
  BookOpen,
  Check,
  Copy,
  Crown,
  Globe,
  HelpCircle,
  Home,
  KeyRound,
  LogIn,
  LogOut,
  Menu,
  Moon,
  Palette,
  Search,
  Settings,
  Shield,
  Skull,
  Sun,
  Trophy,
  User as UserIcon,
  Users,
  Volume2,
  Vote,
  X,
} from 'lucide-react';
import type {
  FriendEntry,
  IncomingInviteItem,
  MatchHistoryItem,
  PublicRoomListing,
  UserProfileData,
} from '../hooks/useFirebaseAccount.ts';
import type { ActiveSession } from '../hooks/useParlorSocket.ts';
import type { AvatarId } from '../shared/types.ts';
import {
  AVATAR_OPTIONS,
  AvatarEmblem,
  RAINY_PARLOR_URL,
  ROLE_CARD_IMAGES,
  RoleCardArtwork,
  TITLE_BACKDROP_URL,
} from '../utils/avatars.tsx';
import {
  PARLOR_THEMES,
  type ParlorTheme,
  type ParlorThemeId,
} from '../utils/parlorThemes.ts';
import { voiceNarrator } from '../utils/voiceNarrator.ts';

type PortalNavTab = 'home' | 'profile' | 'hall' | 'rules' | 'themes';

export function TitleScreen({
  theme,
  themeId,
  onSelectTheme,
  onEnterRoom,
  user,
  profile,
  profileLoading,
  authBusy,
  authError,
  friends,
  invites,
  publicRooms,
  matchHistory,
  onSignIn,
  onSignOut,
  onUpdateProfile,
  onOpenFriendsDrawer,
  onRespondInvite,
  onNotify,
}: {
  theme: ParlorTheme;
  themeId: ParlorThemeId;
  onSelectTheme: (id: ParlorThemeId) => void;
  onEnterRoom: (session: ActiveSession) => void;
  user: User | null;
  profile: UserProfileData | null;
  profileLoading: boolean;
  authBusy: boolean;
  authError: string | null;
  friends: FriendEntry[];
  invites: IncomingInviteItem[];
  publicRooms: PublicRoomListing[];
  matchHistory: MatchHistoryItem[];
  onSignIn: () => void;
  onSignOut: () => void;
  onUpdateProfile: (name: string, avatar: AvatarId) => Promise<void>;
  onOpenFriendsDrawer: () => void;
  onRespondInvite: (inviteId: string, status: 'accepted' | 'dismissed') => Promise<void>;
  onNotify: (msg: string, kind?: 'info' | 'error') => void;
}) {
  const [navTab, setNavTab] = useState<PortalNavTab>('home');
  const [mode, setMode] = useState<'host' | 'join' | 'browse'>('host');
  const [gmName, setGmName] = useState('');
  const [roomName, setRoomName] = useState('Midnight Parlor');
  const [isPublicRoom, setIsPublicRoom] = useState(true);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [rejoinPin, setRejoinPin] = useState('');
  const [avatar, setAvatar] = useState<AvatarId>('fedora');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [showFeaturedSpecs, setShowFeaturedSpecs] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Profile Editor state
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editAvatar, setEditAvatar] = useState<AvatarId>('fedora');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code) {
      setNavTab('home');
      setMode('join');
      setRoomCode(code.toUpperCase().slice(0, 8));
    }
  }, []);

  // Auto-populate saved account profile name & avatar
  useEffect(() => {
    if (!profile) return;
    setGmName((prev) => prev || profile.displayName);
    setPlayerName((prev) => prev || profile.displayName);
    setAvatar(profile.avatar);
    setEditDisplayName(profile.displayName);
    setEditAvatar(profile.avatar);
  }, [profile]);

  const joinRoomByCode = async (targetCode: string, customPin?: string) => {
    setError(null);
    const cleanCode = targetCode.trim().toUpperCase();
    const chosenName =
      playerName.trim() || profile?.displayName || 'Investigator';
    if (!cleanCode) {
      setError('Enter a Room Code.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: chosenName,
          avatar,
          rejoinPin: customPin?.trim() || undefined,
          accountUid: user?.uid || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Unable to join room.');
        setBusy(false);
        return;
      }
      onEnterRoom({
        roomCode: data.roomCode,
        roomName: data.roomName,
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        rejoinPin: data.rejoinPin,
      });
    } catch {
      setError('Unable to reach game server.');
      setBusy(false);
    }
  };

  const handleHost = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmName: gmName.trim() || profile?.displayName || 'Game Master',
          roomName: roomName.trim() || 'Midnight Parlor',
          avatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not create parlor room.');
        setBusy(false);
        return;
      }
      onEnterRoom({
        roomCode: data.roomCode,
        roomName: data.roomName,
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        gmSecretToken: data.gmSecretToken,
        rejoinPin: data.rejoinPin,
        isPublicRoom,
      });
    } catch {
      setError('Unable to reach game server.');
      setBusy(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();
    if (!code || !name) {
      setError('Enter both the Room Code and your Player Name.');
      return;
    }
    await joinRoomByCode(code, rejoinPin);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editDisplayName.trim()) return;
    setSavingProfile(true);
    try {
      await onUpdateProfile(editDisplayName.trim(), editAvatar);
      onNotify('Saved your profile & portrait!');
    } catch {
      onNotify('Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const copyFriendId = () => {
    if (!profile?.friendCode) return;
    navigator.clipboard
      ?.writeText(profile.friendCode)
      .then(() => onNotify(`Copied your Player ID: ${profile.friendCode}`))
      .catch(() => onNotify(`Your Player ID: ${profile.friendCode}`));
  };

  const friendsOnlineInRooms = friends.filter((f) => Boolean(f.currentRoomCode));
  const openPublicRooms = publicRooms.filter((r) => r.phase === 'LOBBY');
  const spotlightRoom = openPublicRooms[0] || null;
  const winRate =
    profile && profile.gamesPlayed > 0
      ? Math.round((profile.gamesWon / profile.gamesPlayed) * 100)
      : 0;

  return (
    <div
      className="relative min-h-screen w-full text-[#F1F5F9] transition-colors duration-300"
      style={{ backgroundColor: theme.bgCanvas }}
    >
      {!backdropFailed && (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.34 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          src={TITLE_BACKDROP_URL}
          alt="Noir Mafia parlor city backdrop"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBackdropFailed(true)}
          className="pointer-events-none fixed inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(circle at 24% 25%, rgba(220,38,38,0.18), transparent 45%), radial-gradient(circle at 80% 75%, ${theme.glowColor}, transparent 50%), linear-gradient(135deg, ${theme.bgCanvas}F2, ${theme.bgCanvas}CC)`,
        }}
        aria-hidden="true"
      />

      {/* MOBILE / TABLET STICKY TOP HEADER (< lg) */}
      <header
        className="lg:hidden sticky top-0 z-30 border-b border-white/12 backdrop-blur-md"
        style={{ backgroundColor: `${theme.bgSurface}E8` }}
      >
        <div className="px-3 sm:px-5 h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-lg overflow-hidden border border-red-500/45 shrink-0">
              <img
                src={ROLE_CARD_IMAGES.Mafia}
                alt="Mafia emblem"
                decoding="async"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <div className="font-display text-lg font-bold tracking-tight text-red-500 leading-none truncate">
                MAFIA
              </div>
              <div className="text-[10px] text-amber-300/90 leading-tight truncate">
                Trust No One
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {user && profile ? (
              <button
                type="button"
                onClick={() => {
                  setNavTab('profile');
                  setMobileMenuOpen(false);
                }}
                aria-label="Open my profile"
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 px-2 py-1.5 min-h-[40px] cursor-pointer"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <AvatarEmblem avatar={profile.avatar} size="sm" />
                <span className="hidden xs:inline text-xs font-semibold text-white max-w-[84px] truncate">
                  {profile.displayName}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={authBusy || profileLoading}
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 min-h-[40px] text-xs font-bold cursor-pointer whitespace-nowrap"
              >
                <LogIn size={13} />
                <span>{authBusy ? '...' : 'Sign In'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenFriendsDrawer}
              aria-label="Open friends and invites"
              className="relative inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl border border-white/12 text-slate-200 cursor-pointer px-2.5"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <Bell size={15} className={invites.length > 0 ? 'text-amber-400' : 'text-slate-300'} />
              {invites.length > 0 && (
                <span className="ml-1 font-mono-tabular text-[11px] font-bold text-red-400">
                  {invites.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="inline-flex items-center justify-center min-w-[44px] min-h-[40px] rounded-xl border border-white/12 text-white cursor-pointer"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Mobile Quick Horizontal Tab Strip (always 1-tap reachable) */}
        <nav
          aria-label="Quick Mobile Navigation"
          className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar"
        >
          {(
            [
              { id: 'home', label: 'Home', icon: Home },
              { id: 'profile', label: 'Profile', icon: UserIcon },
              { id: 'hall', label: 'Rooms', icon: Trophy },
              { id: 'rules', label: 'Rules', icon: BookOpen },
              { id: 'themes', label: 'Themes', icon: Palette },
            ] as const
          ).map(({ id, label, icon: Icon }) => {
            const active = navTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setNavTab(id);
                  setMobileMenuOpen(false);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                  active
                    ? 'text-white border border-red-500/45'
                    : 'text-slate-300 border border-white/10 hover:text-white'
                }`}
                style={
                  active
                    ? { background: `linear-gradient(90deg, ${theme.crimson}CC, ${theme.crimson}55)` }
                    : { backgroundColor: theme.bgCanvas }
                }
              >
                <Icon size={13} />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        {/* Collapsible Mobile Menu Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-white/10 px-4 py-3 space-y-3"
              style={{ backgroundColor: theme.bgSurface }}
            >
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className="rounded-xl border border-white/10 p-2.5 flex items-center justify-between"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <span className="text-slate-400">Open Rooms</span>
                  <span className="font-mono-tabular font-bold text-emerald-400">
                    {openPublicRooms.length}
                  </span>
                </div>
                <div
                  className="rounded-xl border border-white/10 p-2.5 flex items-center justify-between"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <span className="text-slate-400">Friends Live</span>
                  <span className="font-mono-tabular font-bold text-amber-300">
                    {friendsOnlineInRooms.length}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onOpenFriendsDrawer();
                    setMobileMenuOpen(false);
                  }}
                  className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-semibold text-white cursor-pointer"
                  style={{ backgroundColor: theme.bgCanvas }}
                >
                  <Users size={14} className="text-amber-400" />
                  <span>Friends ({friends.length})</span>
                </button>
                {user && profile && (
                  <>
                    <button
                      type="button"
                      onClick={copyFriendId}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/35 px-3 py-2 text-xs font-mono-tabular text-amber-300 cursor-pointer"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <span>ID: {profile.friendCode}</span>
                      <Copy size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSignOut();
                        setMobileMenuOpen(false);
                      }}
                      className="min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/35 px-3 py-2 text-xs text-red-200 cursor-pointer"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <LogOut size={13} />
                      <span>Sign Out</span>
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <div className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] mx-auto px-3 sm:px-5 lg:px-6 py-4 sm:py-6 lg:py-7 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-start">
        {/* LEFT NOIR COMMAND RAIL (Desktop lg+) */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          className="hidden lg:flex lg:col-span-3 rounded-2xl border border-white/12 p-4 flex-col gap-5 shadow-2xl lg:sticky lg:top-6"
          style={{ backgroundColor: `${theme.bgSurface}F2` }}
        >
          {/* Brand Poster Lockup */}
          <div className="relative rounded-xl overflow-hidden border border-red-500/30 p-4 flex items-center gap-3.5">
            <img
              src={ROLE_CARD_IMAGES.Mafia}
              alt="Mafia Syndicate crest"
              referrerPolicy="no-referrer"
              className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-30"
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(135deg, rgba(127,29,29,0.72), rgba(7,11,20,0.92))',
              }}
            />
            <div className="relative z-10 w-12 h-12 rounded-xl overflow-hidden border border-red-400/50 shadow-[0_0_20px_rgba(220,38,38,0.3)] shrink-0">
              <img
                src={ROLE_CARD_IMAGES.Mafia}
                alt="Mafia emblem"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="relative z-10 min-w-0">
              <h1 className="font-display text-3xl font-bold tracking-tight text-red-500 leading-none">
                MAFIA
              </h1>
              <div className="text-xs font-medium text-amber-300/95 mt-1">
                Trust No One
              </div>
            </div>
          </div>

          {/* Primary Portal Navigation */}
          <nav aria-label="Main Portal Navigation" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5">
            {(
              [
                { id: 'home', label: 'Home', icon: Home },
                { id: 'profile', label: 'My Profile', icon: UserIcon },
                { id: 'hall', label: 'Squad & Rooms', icon: Trophy },
                { id: 'rules', label: 'How to Play', icon: BookOpen },
                { id: 'themes', label: 'Parlor Themes', icon: Palette },
              ] as const
            ).map(({ id, label, icon: Icon }) => {
              const active = navTab === id;
              return (
                <motion.button
                  key={id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setNavTab(id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    active
                      ? 'text-white border border-red-500/45 shadow-sm'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white border border-transparent'
                  }`}
                  style={
                    active
                      ? { background: `linear-gradient(90deg, ${theme.crimson}CC, ${theme.crimson}55)` }
                      : undefined
                  }
                >
                  <Icon size={15} className={active ? 'text-white' : 'text-slate-400'} />
                  <span>{label}</span>
                </motion.button>
              );
            })}

            <motion.button
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={onOpenFriendsDrawer}
              className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white border border-transparent transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <span className="inline-flex items-center gap-2.5">
                <Users size={15} className="text-amber-400" />
                <span>Friends</span>
              </span>
              {(friends.length > 0 || invites.length > 0) && (
                <span className="font-mono-tabular text-[11px] text-amber-300">
                  {invites.length > 0 ? `${invites.length} invite` : friends.length}
                </span>
              )}
            </motion.button>
          </nav>

          {/* Live Network Summary + Account Footer */}
          <div className="border-t border-white/10 pt-4 space-y-3">
            <div
              className="rounded-xl border border-white/10 p-3 space-y-1.5"
              style={{ backgroundColor: theme.bgCanvas }}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Open Public Rooms</span>
                <span className="font-mono-tabular font-bold text-emerald-400">
                  {openPublicRooms.length}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Friends in Matches</span>
                <span className="font-mono-tabular font-bold text-amber-300">
                  {friendsOnlineInRooms.length}
                </span>
              </div>
            </div>

            {user && profile ? (
              <div
                className="rounded-xl border border-white/10 p-3 space-y-2.5"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <AvatarEmblem avatar={profile.avatar} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-white truncate">
                      {profile.displayName}
                    </div>
                    <button
                      type="button"
                      onClick={copyFriendId}
                      className="inline-flex items-center gap-1 text-[11px] font-mono-tabular text-amber-300 hover:underline cursor-pointer"
                    >
                      <span>ID: {profile.friendCode}</span>
                      <Copy size={10} />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 hover:border-red-500/40 py-1.5 text-xs text-slate-300 hover:text-red-200 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <LogOut size={13} />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                disabled={authBusy || profileLoading}
                style={{ backgroundColor: theme.accent, color: theme.accentText }}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <LogIn size={14} />
                <span>{authBusy ? 'Signing in...' : 'Google Sign In'}</span>
              </button>
            )}
          </div>
        </motion.aside>

        {/* MAIN RIGHT STAGE */}
        <div className="lg:col-span-9 space-y-4 sm:space-y-5 min-w-0">
          {/* Top Portal Header Strip (shown md+ or compact on mobile) */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="hidden sm:flex rounded-2xl border border-white/12 px-4 sm:px-5 py-3.5 flex-wrap items-center justify-between gap-3 sm:gap-4 shadow-xl"
            style={{ backgroundColor: `${theme.bgSurface}F2` }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl border border-amber-400/40 bg-amber-500/15 flex items-center justify-center shrink-0">
                <Crown size={18} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <div className="text-sm sm:text-base font-display font-bold text-white truncate">
                  Game Master Parlor Edition
                </div>
                <div className="text-xs text-slate-400 truncate">
                  Think · Deduce · Survive · Real-time Voice & Private Roles
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              {authError && (
                <span className="text-xs text-red-300 max-w-[200px] truncate">{authError}</span>
              )}
              <button
                type="button"
                onClick={onOpenFriendsDrawer}
                aria-label="Open friends and room invites"
                title="Friends & Invites"
                className="relative inline-flex items-center gap-2 rounded-xl border border-white/12 px-3 py-2 text-xs font-medium text-slate-200 hover:border-amber-400/50 cursor-pointer whitespace-nowrap"
                style={{ backgroundColor: theme.bgCanvas }}
              >
                <Bell size={14} className={invites.length > 0 ? 'text-amber-400' : 'text-slate-400'} />
                <span>Invites</span>
                {invites.length > 0 && (
                  <span className="font-mono-tabular text-xs font-bold text-red-400">
                    ({invites.length})
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setNavTab('rules')}
                aria-label="How to play Mafia"
                className="p-2 rounded-xl border border-white/12 text-slate-300 hover:border-amber-400/50 hover:text-white cursor-pointer"
                style={{ backgroundColor: theme.bgCanvas }}
                title="How to Play & Role Guide"
              >
                <HelpCircle size={15} />
              </button>
            </div>
          </motion.div>

          {/* Real-time Incoming Friend Invite Banner */}
          <AnimatePresence>
            {invites.length > 0 && (
              <motion.div
                key={invites[0].inviteId}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-emerald-500/45 bg-emerald-950/55 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 shadow-lg"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-200 truncate">
                    {invites[0].fromName} invited you to {invites[0].roomName}
                  </div>
                  <div className="text-xs text-emerald-300/85 font-mono-tabular">
                    Room #{invites[0].roomCode}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={async () => {
                      await onRespondInvite(invites[0].inviteId, 'accepted');
                      await joinRoomByCode(invites[0].roomCode);
                    }}
                    className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold px-4 py-2 text-xs cursor-pointer whitespace-nowrap"
                  >
                    Join Now
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => void onRespondInvite(invites[0].inviteId, 'dismissed')}
                    className="rounded-xl border border-white/15 px-3 py-2 text-xs text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
                  >
                    Dismiss
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {navTab === 'home' && (
              <motion.div
                key="portal-home"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch"
              >
                {/* FEATURED ROOM SPOTLIGHT CARD (Inspired by Room #7421 Card in reference) */}
                <div
                  className="xl:col-span-6 rounded-2xl border border-white/12 overflow-hidden flex flex-col justify-between shadow-2xl"
                  style={{ backgroundColor: `${theme.bgSurface}F5` }}
                >
                  <div className="relative h-48 sm:h-60 lg:h-64 overflow-hidden">
                    <img
                      src={spotlightRoom ? RAINY_PARLOR_URL : TITLE_BACKDROP_URL}
                      alt="Featured Mafia Parlor backdrop"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                    />
                    <div
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background: `linear-gradient(to top, ${theme.bgSurface} 8%, rgba(7,11,20,0.45) 60%, rgba(7,11,20,0.25) 100%)`,
                      }}
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5 space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono-tabular">
                        <span className="text-amber-300 font-semibold">
                          {spotlightRoom
                            ? `Room #${spotlightRoom.roomCode}`
                            : 'Featured Parlor Preset'}
                        </span>
                        <span className="text-emerald-300">
                          {spotlightRoom
                            ? `${spotlightRoom.playerCount}/${spotlightRoom.playerLimit} Players · Public`
                            : '3–24 Players · Manual GM'}
                        </span>
                      </div>
                      <h2 className="font-display text-xl sm:text-3xl font-bold text-white">
                        {spotlightRoom ? spotlightRoom.roomName : roomName || 'Midnight Parlor'}
                      </h2>
                      <p className="text-xs text-slate-300">
                        {spotlightRoom
                          ? `Hosted by ${spotlightRoom.hostName} · Open Lobby ready for players`
                          : 'Manual Game Master night calls, strict server-side role privacy, and live WebRTC voice.'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 sm:p-5 space-y-4">
                    {spotlightRoom ? (
                      <motion.button
                        whileHover={{ y: -1 }}
                        whileTap={{ scale: 0.99 }}
                        type="button"
                        disabled={busy}
                        onClick={() => void joinRoomByCode(spotlightRoom.roomCode)}
                        style={{ backgroundColor: theme.accent, color: theme.accentText }}
                        className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl font-bold py-3 px-5 text-sm cursor-pointer disabled:opacity-60"
                      >
                        <Users size={16} />
                        <span>Join Live Room #{spotlightRoom.roomCode}</span>
                      </motion.button>
                    ) : (
                      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-2.5 text-center">
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <Shield size={16} className="text-amber-400 mx-auto mb-1" />
                          <div className="text-xs font-semibold text-white">GM Control</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Manual Night</div>
                        </div>
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <KeyRound size={16} className="text-emerald-400 mx-auto mb-1" />
                          <div className="text-xs font-semibold text-white">Privacy Lock</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Filtered API</div>
                        </div>
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <Users size={16} className="text-sky-400 mx-auto mb-1" />
                          <div className="text-xs font-semibold text-white">Voice & Chat</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">Mafia Private</div>
                        </div>
                      </div>
                    )}

                    {/* Room Settings Preview Drawer */}
                    <div
                      className="rounded-xl border border-white/10 p-3.5 space-y-2"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <button
                        type="button"
                        onClick={() => setShowFeaturedSpecs((v) => !v)}
                        className="w-full flex items-center justify-between text-xs font-semibold text-slate-200 cursor-pointer"
                      >
                        <span>Parlor Match Settings</span>
                        <span className="text-amber-300">{showFeaturedSpecs ? 'Hide' : 'Show'}</span>
                      </button>
                      {showFeaturedSpecs && (
                        <div className="space-y-1.5 pt-1 text-xs border-t border-white/10">
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Max Players</span>
                            <span className="font-mono-tabular text-white">Up to 24</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Role Assignment</span>
                            <span className="text-white">Manual GM + Custom Roles</span>
                          </div>
                          <div className="flex items-center justify-between text-slate-300">
                            <span>Night Control</span>
                            <span className="text-amber-300">Manual Call / Sleep</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* HOST / JOIN / BROWSE ACTION CARD */}
                <div
                  className="xl:col-span-6 border border-white/12 rounded-2xl p-4 sm:p-6 shadow-2xl flex flex-col justify-between"
                  style={{ backgroundColor: `${theme.bgSurface}F5` }}
                >
                  <div>
                    <div
                      className="grid grid-cols-3 gap-1 p-1 rounded-xl border border-white/10 mb-5"
                      style={{ backgroundColor: theme.bgCanvas }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setMode('host');
                          setError(null);
                        }}
                        className="py-2 px-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        style={
                          mode === 'host'
                            ? { backgroundColor: theme.accent, color: theme.accentText, fontWeight: 700 }
                            : { color: '#CBD5E1' }
                        }
                      >
                        Host Room
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('join');
                          setError(null);
                        }}
                        className="py-2 px-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                        style={
                          mode === 'join'
                            ? { backgroundColor: theme.crimson, color: '#FFFFFF', fontWeight: 700 }
                            : { color: '#CBD5E1' }
                        }
                      >
                        Join Code
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMode('browse');
                          setError(null);
                        }}
                        className="py-2 px-2 min-h-[40px] text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer inline-flex items-center justify-center gap-1"
                        style={
                          mode === 'browse'
                            ? { backgroundColor: '#0EA5E9', color: '#070B14', fontWeight: 700 }
                            : { color: '#CBD5E1' }
                        }
                      >
                        <Globe size={13} />
                        <span>Online ({publicRooms.length + friendsOnlineInRooms.length})</span>
                      </button>
                    </div>

                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        role="alert"
                        className="mb-4 rounded-xl border border-red-500/35 bg-red-950/55 px-4 py-3 text-sm text-red-200"
                      >
                        {error}
                      </motion.div>
                    )}

                    <AnimatePresence mode="wait">
                      {mode === 'host' ? (
                        <motion.form
                          key="mode-host"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          onSubmit={handleHost}
                          className="space-y-4"
                        >
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Room Name
                            </label>
                            <input
                              type="text"
                              value={roomName}
                              onChange={(e) => setRoomName(e.target.value)}
                              maxLength={40}
                              placeholder="Midnight Parlor"
                              style={{ backgroundColor: theme.bgCanvas }}
                              className="w-full rounded-xl border border-white/10 px-4 py-2.5 min-h-[44px] text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Game Master Name
                            </label>
                            <input
                              type="text"
                              value={gmName}
                              onChange={(e) => setGmName(e.target.value)}
                              maxLength={24}
                              placeholder="Game Master"
                              style={{ backgroundColor: theme.bgCanvas }}
                              className="w-full rounded-xl border border-white/10 px-4 py-2.5 min-h-[44px] text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                            />
                          </div>

                          {user && (
                            <label
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/10 px-3.5 py-2.5 min-h-[44px] text-xs text-slate-200 cursor-pointer"
                              style={{ backgroundColor: theme.bgCanvas }}
                            >
                              <span>List in Online Open Rooms (for friend & public join)</span>
                              <input
                                type="checkbox"
                                checked={isPublicRoom}
                                onChange={(e) => setIsPublicRoom(e.target.checked)}
                                className="h-4 w-4 shrink-0 accent-amber-400"
                              />
                            </label>
                          )}

                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={busy}
                            style={{ backgroundColor: theme.accent, color: theme.accentText }}
                            className="w-full mt-2 min-h-[48px] flex items-center justify-center gap-2 rounded-xl disabled:opacity-60 font-bold py-3 px-5 text-sm cursor-pointer"
                          >
                            <span>{busy ? 'Creating Room...' : 'Create Room & Open GM Panel'}</span>
                            <ArrowRight size={16} />
                          </motion.button>
                        </motion.form>
                      ) : mode === 'join' ? (
                        <motion.form
                          key="mode-join"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          onSubmit={handleJoin}
                          className="space-y-4"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Room ID
                              </label>
                              <input
                                type="text"
                                value={roomCode}
                                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                                maxLength={8}
                                placeholder="ABC123"
                                style={{ backgroundColor: theme.bgCanvas }}
                                className="w-full rounded-xl border border-white/10 px-4 py-2.5 min-h-[44px] text-base sm:text-sm font-mono-tabular uppercase tracking-widest text-white placeholder-slate-500 focus:outline-none focus:border-red-400"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                                Player Name
                              </label>
                              <input
                                type="text"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                maxLength={24}
                                placeholder="Rahat"
                                style={{ backgroundColor: theme.bgCanvas }}
                                className="w-full rounded-xl border border-white/10 px-4 py-2.5 min-h-[44px] text-base sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-400"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5">
                              Choose Character Portrait
                            </label>
                            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                              {AVATAR_OPTIONS.map((opt) => (
                                <motion.button
                                  key={opt.id}
                                  type="button"
                                  title={opt.label}
                                  whileHover={{ scale: 1.06 }}
                                  whileTap={{ scale: 0.94 }}
                                  onClick={() => setAvatar(opt.id)}
                                  className="flex items-center justify-center min-h-[44px] p-1.5 rounded-xl border transition-colors cursor-pointer"
                                  style={{
                                    backgroundColor:
                                      avatar === opt.id ? `${theme.crimson}30` : theme.bgCanvas,
                                    borderColor:
                                      avatar === opt.id ? theme.crimson : 'rgba(255,255,255,0.1)',
                                  }}
                                >
                                  <AvatarEmblem avatar={opt.id} size="sm" />
                                </motion.button>
                              ))}
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-400 mb-1.5">
                              Rejoin PIN (only if reclaiming a seat without login)
                            </label>
                            <input
                              type="text"
                              value={rejoinPin}
                              onChange={(e) => setRejoinPin(e.target.value)}
                              maxLength={6}
                              placeholder="Optional 4-digit PIN"
                              style={{ backgroundColor: theme.bgCanvas }}
                              className="w-full rounded-xl border border-white/10 px-4 py-2 min-h-[44px] text-base sm:text-sm font-mono-tabular text-white placeholder-slate-600 focus:outline-none"
                            />
                          </div>

                          <motion.button
                            whileHover={{ y: -1 }}
                            whileTap={{ scale: 0.99 }}
                            type="submit"
                            disabled={busy}
                            style={{ backgroundColor: theme.crimson, color: '#FFFFFF' }}
                            className="w-full mt-2 min-h-[48px] flex items-center justify-center gap-2 rounded-xl disabled:opacity-60 font-bold py-3 px-5 text-sm cursor-pointer"
                          >
                            <span>{busy ? 'Joining Room...' : 'Join Match'}</span>
                            <ArrowRight size={16} />
                          </motion.button>
                        </motion.form>
                      ) : (
                        <motion.div
                          key="mode-browse"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.16 }}
                          className="space-y-4 max-h-[380px] overflow-y-auto pr-1"
                        >
                          {!user ? (
                            <div
                              className="rounded-xl border border-white/10 p-5 text-center space-y-3"
                              style={{ backgroundColor: theme.bgCanvas }}
                            >
                              <p className="text-xs text-slate-300">
                                Sign in with Google to browse open Mafia rooms and see which rooms
                                your friends are playing in right now.
                              </p>
                              <button
                                type="button"
                                onClick={onSignIn}
                                disabled={authBusy}
                                style={{ backgroundColor: theme.accent, color: theme.accentText }}
                                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold cursor-pointer"
                              >
                                <LogIn size={14} />
                                <span>Sign in with Google</span>
                              </button>
                            </div>
                          ) : (
                            <>
                              {friendsOnlineInRooms.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-xs font-semibold text-emerald-300">
                                    Friends in Rooms
                                  </div>
                                  {friendsOnlineInRooms.map((f) => (
                                    <div
                                      key={f.friendUid}
                                      className="rounded-xl border border-emerald-500/30 p-3 flex items-center justify-between gap-2"
                                      style={{ backgroundColor: theme.bgCanvas }}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <AvatarEmblem avatar={f.avatar} size="sm" />
                                        <div className="min-w-0">
                                          <div className="text-xs font-semibold text-white truncate">
                                            {f.displayName}
                                          </div>
                                          <div className="text-[11px] text-emerald-400 truncate">
                                            {f.currentRoomName || 'Parlor'} · #{f.currentRoomCode}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void joinRoomByCode(f.currentRoomCode!)}
                                        className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-[#070B14] font-bold px-3 py-1.5 text-xs shrink-0 cursor-pointer"
                                      >
                                        Join
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-300">
                                  Open Public Rooms
                                </div>
                                {publicRooms.length === 0 ? (
                                  <div
                                    className="rounded-xl border border-white/10 p-5 text-center text-xs text-slate-400"
                                    style={{ backgroundColor: theme.bgCanvas }}
                                  >
                                    No public lobbies open right now. Create a room or join with a
                                    Room ID!
                                  </div>
                                ) : (
                                  publicRooms.map((r) => (
                                    <div
                                      key={r.roomCode}
                                      className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2"
                                      style={{ backgroundColor: theme.bgCanvas }}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-white truncate">
                                          {r.roomName}{' '}
                                          <span className="font-mono-tabular text-amber-300">
                                            #{r.roomCode}
                                          </span>
                                        </div>
                                        <div className="text-[11px] text-slate-400">
                                          GM: {r.hostName} · {r.playerCount}/{r.playerLimit} players
                                          {' · '}
                                          {r.phase === 'LOBBY' ? 'Open Lobby' : 'In Progress'}
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        disabled={busy || r.phase !== 'LOBBY'}
                                        onClick={() => void joinRoomByCode(r.roomCode)}
                                        className="rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-[#070B14] font-bold px-3 py-1.5 text-xs shrink-0 cursor-pointer"
                                      >
                                        {r.phase === 'LOBBY' ? 'Join' : 'Started'}
                                      </button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}

            {navTab === 'profile' && (
              <motion.div
                key="portal-profile"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-white/12 p-6 space-y-6 shadow-2xl"
                style={{ backgroundColor: `${theme.bgSurface}F5` }}
              >
                {!user || !profile ? (
                  <div className="py-10 text-center space-y-4 max-w-md mx-auto">
                    <UserIcon size={36} className="text-amber-400 mx-auto" />
                    <h2 className="font-display text-2xl font-bold text-white">
                      Your Investigator Dossier
                    </h2>
                    <p className="text-sm text-slate-300">
                      Sign in with Google to save your permanent Friend ID, customize your character
                      portrait, and track every win and Game Master match.
                    </p>
                    <button
                      type="button"
                      onClick={onSignIn}
                      disabled={authBusy}
                      style={{ backgroundColor: theme.accent, color: theme.accentText }}
                      className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold cursor-pointer"
                    >
                      <LogIn size={16} />
                      <span>{authBusy ? 'Signing in...' : 'Sign in with Google'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    <div className="lg:col-span-5 space-y-4">
                      <div className="flex items-center gap-3.5">
                        <AvatarEmblem avatar={profile.avatar} size="xl" />
                        <div className="min-w-0">
                          <h2 className="font-display text-2xl font-bold text-white truncate">
                            {profile.displayName}
                          </h2>
                          <button
                            type="button"
                            onClick={copyFriendId}
                            className="inline-flex items-center gap-1.5 text-xs font-mono-tabular text-amber-300 hover:underline cursor-pointer"
                          >
                            <span>Player ID: {profile.friendCode}</span>
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5 text-center">
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="text-[11px] text-slate-400">Matches</div>
                          <div className="font-mono-tabular text-lg font-bold text-white">
                            {profile.gamesPlayed}
                          </div>
                        </div>
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="text-[11px] text-slate-400">Wins ({winRate}%)</div>
                          <div className="font-mono-tabular text-lg font-bold text-emerald-400">
                            {profile.gamesWon}
                          </div>
                        </div>
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="text-[11px] text-slate-400">GM Hosted</div>
                          <div className="font-mono-tabular text-lg font-bold text-amber-300">
                            {profile.gmHostedCount}
                          </div>
                        </div>
                        <div
                          className="rounded-xl border border-white/10 p-3"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="text-[11px] text-slate-400">Saved Friends</div>
                          <div className="font-mono-tabular text-lg font-bold text-sky-300">
                            {friends.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleSaveProfile} className="lg:col-span-7 space-y-4">
                      <div className="text-sm font-semibold text-white">
                        Customize Profile & Portrait
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          maxLength={24}
                          style={{ backgroundColor: theme.bgCanvas }}
                          className="w-full rounded-xl border border-white/10 px-4 py-2.5 min-h-[44px] text-base sm:text-sm text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1.5">
                          Character Portrait
                        </label>
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {AVATAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              onClick={() => setEditAvatar(opt.id)}
                              className="flex items-center justify-center min-h-[44px] p-1.5 rounded-xl border cursor-pointer"
                              style={{
                                backgroundColor:
                                  editAvatar === opt.id ? `${theme.accent}28` : theme.bgCanvas,
                                borderColor:
                                  editAvatar === opt.id ? theme.accent : 'rgba(255,255,255,0.1)',
                              }}
                            >
                              <AvatarEmblem avatar={opt.id} size="sm" />
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="submit"
                        disabled={savingProfile || !editDisplayName.trim()}
                        style={{ backgroundColor: theme.accent, color: theme.accentText }}
                        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 min-h-[44px] text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        <Check size={14} />
                        <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
                      </button>
                    </form>
                  </div>
                )}
              </motion.div>
            )}

            {navTab === 'hall' && (
              <motion.div
                key="portal-hall"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-5"
              >
                <div
                  className="lg:col-span-6 rounded-2xl border border-white/12 p-5 space-y-4"
                  style={{ backgroundColor: `${theme.bgSurface}F5` }}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                      <Globe size={18} className="text-sky-400" />
                      <span>Active Rooms & Friends</span>
                    </h2>
                    <button
                      type="button"
                      onClick={() => {
                        setNavTab('home');
                        setMode('browse');
                      }}
                      className="text-xs text-amber-300 hover:underline cursor-pointer"
                    >
                      Browse All
                    </button>
                  </div>

                  {!user ? (
                    <div className="text-xs text-slate-400 py-8 text-center">
                      Sign in with Google to see friends playing live and public rooms.
                    </div>
                  ) : publicRooms.length === 0 && friendsOnlineInRooms.length === 0 ? (
                    <div className="text-xs text-slate-400 py-8 text-center">
                      No live public rooms right now. Create a room on Home!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                      {friendsOnlineInRooms.map((f) => (
                        <div
                          key={f.friendUid}
                          className="rounded-xl border border-emerald-500/35 p-3 flex items-center justify-between gap-2"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <AvatarEmblem avatar={f.avatar} size="sm" />
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-white truncate">
                                {f.displayName} (Friend)
                              </div>
                              <div className="text-[11px] text-emerald-400 font-mono-tabular">
                                {f.currentRoomName || 'Parlor'} · #{f.currentRoomCode}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void joinRoomByCode(f.currentRoomCode!)}
                            className="rounded-lg bg-emerald-500 text-[#070B14] font-bold px-3 py-1.5 text-xs cursor-pointer"
                          >
                            Join
                          </button>
                        </div>
                      ))}
                      {publicRooms.map((r) => (
                        <div
                          key={r.roomCode}
                          className="rounded-xl border border-white/10 p-3 flex items-center justify-between gap-2"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">
                              {r.roomName}{' '}
                              <span className="font-mono-tabular text-amber-300">
                                #{r.roomCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              GM: {r.hostName} · {r.playerCount}/{r.playerLimit} players
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={r.phase !== 'LOBBY'}
                            onClick={() => void joinRoomByCode(r.roomCode)}
                            className="rounded-lg bg-amber-500 disabled:opacity-40 text-[#070B14] font-bold px-3 py-1.5 text-xs cursor-pointer"
                          >
                            {r.phase === 'LOBBY' ? 'Join' : 'Live'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  className="lg:col-span-6 rounded-2xl border border-white/12 p-5 space-y-4"
                  style={{ backgroundColor: `${theme.bgSurface}F5` }}
                >
                  <h2 className="font-display text-xl font-bold text-white flex items-center gap-2">
                    <Trophy size={18} className="text-amber-400" />
                    <span>Your Recent Match Record</span>
                  </h2>
                  {matchHistory.length === 0 ? (
                    <div className="text-xs text-slate-400 py-8 text-center">
                      Complete a match to record your role wins, round counts, and team victories.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {matchHistory.slice(0, 12).map((m) => (
                        <div
                          key={m.matchId}
                          className="rounded-xl border border-white/10 px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
                          style={{ backgroundColor: theme.bgCanvas }}
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">
                              {m.roomName}{' '}
                              <span className="font-mono-tabular text-slate-400">
                                #{m.roomCode}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Role: {m.role} · {m.roundsPlayed} rounds · {m.playerCount} players
                            </div>
                          </div>
                          <span
                            className={`font-semibold shrink-0 ${
                              m.wasGM
                                ? 'text-amber-300'
                                : m.won
                                  ? 'text-emerald-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {m.wasGM ? 'Game Master' : m.won ? 'Victory' : 'Defeat'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {navTab === 'rules' && (
              <motion.div
                key="portal-rules"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-white/12 p-6 space-y-6 shadow-2xl"
                style={{ backgroundColor: `${theme.bgSurface}F5` }}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white">
                      How to Play Mafia — Parlor Guide
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      One player hosts as the Game Master and controls every night call, day debate,
                      and vote manually.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNavTab('home')}
                    style={{ backgroundColor: theme.accent, color: theme.accentText }}
                    className="rounded-xl px-4 py-2 text-xs font-bold cursor-pointer whitespace-nowrap"
                  >
                    Host or Join Match
                  </button>
                </div>

                {/* Role Cards Showcase */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
                  {[
                    {
                      role: 'Mafia',
                      icon: Skull,
                      color: 'text-red-400 border-red-500/35',
                      desc: 'Coordinate secretly at night to eliminate one target and blend into Town by day.',
                    },
                    {
                      role: 'Detective',
                      icon: Search,
                      color: 'text-sky-400 border-sky-500/35',
                      desc: 'Investigate one player privately each night to discover whether they are Mafia.',
                    },
                    {
                      role: 'Bodyguard',
                      icon: Shield,
                      color: 'text-emerald-400 border-emerald-500/35',
                      desc: 'Protect one living player each night to block Mafia eliminations.',
                    },
                    {
                      role: 'Villager',
                      icon: Users,
                      color: 'text-amber-300 border-amber-500/35',
                      desc: 'Debate clues during Day Phase and vote out the Mafia before they outnumber Town.',
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.role}
                        className={`rounded-xl border p-3.5 space-y-2.5 ${item.color}`}
                        style={{ backgroundColor: theme.bgCanvas }}
                      >
                        <div className="h-28 rounded-lg overflow-hidden">
                          <RoleCardArtwork role={item.role} className="w-full h-full" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <Icon size={15} />
                            <span>{item.role}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (!voiceNarrator.isEnabled()) {
                                voiceNarrator.setEnabled(true);
                              }
                              voiceNarrator.speak(voiceNarrator.buildRoleRulesScript(item.role), {
                                interrupt: true,
                              });
                            }}
                            title={`Listen to ${item.role} rules in English`}
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-200 hover:bg-white/10 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                          >
                            <Volume2 size={11} />
                            <span>Listen</span>
                          </button>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{item.desc}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Round Loop */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                  <div
                    className="rounded-xl border border-white/10 p-4 space-y-1.5"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div className="font-semibold text-sky-300 flex items-center gap-1.5">
                      <Moon size={14} />
                      <span>1. Night Phase (Private)</span>
                    </div>
                    <p className="text-slate-300">
                      Everyone closes their eyes. The Game Master calls Mafia, Bodyguard, and
                      Detective one by one privately, then reviews the Night Summary.
                    </p>
                  </div>
                  <div
                    className="rounded-xl border border-white/10 p-4 space-y-1.5"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sun size={14} />
                      <span>2. Day Discussion</span>
                    </div>
                    <p className="text-slate-300">
                      The GM announces the morning outcome. Living players debate via live voice
                      chat and parlor messages to spot contradictions.
                    </p>
                  </div>
                  <div
                    className="rounded-xl border border-white/10 p-4 space-y-1.5"
                    style={{ backgroundColor: theme.bgCanvas }}
                  >
                    <div className="font-semibold text-red-300 flex items-center gap-1.5">
                      <Vote size={14} />
                      <span>3. Voting & Elimination</span>
                    </div>
                    <p className="text-slate-300">
                      Players cast secret or public ballots. The GM resolves ties, announces round
                      results, and starts the next round until one faction wins.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {navTab === 'themes' && (
              <motion.div
                key="portal-themes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-white/12 p-6 space-y-4 shadow-2xl"
                style={{ backgroundColor: `${theme.bgSurface}F5` }}
              >
                <div>
                  <h2 className="font-display text-2xl font-bold text-white">
                    Choose Parlor Atmosphere
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Switch color palette across the lobby, seating table, and Game Master console.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {Object.values(PARLOR_THEMES).map((t) => {
                    const selected = t.id === themeId;
                    return (
                      <motion.button
                        key={t.id}
                        type="button"
                        whileHover={{ y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectTheme(t.id)}
                        className="rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-3"
                        style={{
                          backgroundColor: selected ? `${t.accent}1C` : theme.bgCanvas,
                          borderColor: selected ? t.accent : 'rgba(255,255,255,0.12)',
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {t.swatchColors.map((sw, i) => (
                            <span
                              key={i}
                              className="w-5 h-5 rounded-md border border-white/15"
                              style={{ backgroundColor: sw }}
                            />
                          ))}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{t.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{t.subtitle}</div>
                        </div>
                        <div className="text-[11px] font-semibold" style={{ color: t.accent }}>
                          {selected ? 'Active Theme' : 'Apply Theme'}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
