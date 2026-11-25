import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Crown,
  KeyRound,
  LogIn,
  Palette,
  Search,
  Shield,
  Skull,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  ROLE_CARD_IMAGES,
  RoleCardArtwork,
  TITLE_BACKDROP_URL,
} from '../utils/avatars.tsx';
import {
  PARLOR_THEMES,
  type ParlorTheme,
  type ParlorThemeId,
} from '../utils/parlorThemes.ts';

export function LoginScreen({
  theme,
  themeId,
  onSelectTheme,
  authBusy,
  authError,
  onSignInWithGoogle,
  onContinueAsGuest,
}: {
  theme: ParlorTheme;
  themeId: ParlorThemeId;
  onSelectTheme: (id: ParlorThemeId) => void;
  authBusy: boolean;
  authError: string | null;
  onSignInWithGoogle: () => void;
  onContinueAsGuest: () => void;
}) {
  const [backdropFailed, setBackdropFailed] = useState(false);
  const [invitedRoomCode, setInvitedRoomCode] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('room');
    if (code && code.trim()) {
      setInvitedRoomCode(code.trim().toUpperCase().slice(0, 12));
    }
  }, []);

  const roleShowcase = [
    { name: 'Mafia', team: 'Syndicate', icon: Skull, accent: '#EF4444' },
    { name: 'Detective', team: 'Investigator', icon: Search, accent: '#38BDF8' },
    { name: 'Bodyguard', team: 'Protector', icon: Shield, accent: '#60A5FA' },
    { name: 'Villager', team: 'Townfolk', icon: Users, accent: '#10B981' },
  ] as const;

  return (
    <div
      className="relative min-h-screen w-full text-[#F1F5F9] flex flex-col justify-between overflow-x-clip"
      style={{ backgroundColor: theme.bgCanvas }}
    >
      {/* Atmospheric Backdrop with Zero-Broken-Image scrim */}
      {!backdropFailed && (
        <motion.img
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.36 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          src={TITLE_BACKDROP_URL}
          alt="Rain-slicked noir parlor skyline"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBackdropFailed(true)}
          className="pointer-events-none fixed inset-0 h-full w-full object-cover"
        />
      )}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background: `radial-gradient(circle at 18% 22%, rgba(220,38,38,0.20), transparent 46%), radial-gradient(circle at 82% 76%, ${theme.glowColor}, transparent 52%), linear-gradient(135deg, ${theme.bgCanvas}F2, ${theme.bgCanvas}CC)`,
        }}
        aria-hidden="true"
      />

      {/* Minimal Clean Header */}
      <header className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-red-500/45 bg-[#12090D] shrink-0 flex items-center justify-center">
            <img
              src={ROLE_CARD_IMAGES.Mafia}
              alt="Nocturne Parlor emblem"
              decoding="async"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            Nocturne Parlor
          </span>
        </div>

        {/* Theme Quick Picker */}
        <div className="flex items-center gap-1.5 shrink-0" role="group" aria-label="Parlor theme">
          <Palette size={14} className="text-slate-400 hidden sm:block mr-1" />
          {(Object.keys(PARLOR_THEMES) as ParlorThemeId[]).map((id) => {
            const t = PARLOR_THEMES[id];
            const active = themeId === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelectTheme(id)}
                className={`px-2.5 py-1.5 min-h-[36px] rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? 'text-white border-amber-400/60'
                    : 'text-slate-400 border-white/10 hover:text-white'
                }`}
                style={{
                  backgroundColor: active ? `${t.accent}24` : theme.bgSurface,
                }}
              >
                {t.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Split Login Stage */}
      <main className="relative z-10 flex-1 flex items-center max-w-[1440px] 2xl:max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* LEFT SHOWCASE (7 cols on desktop) */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 rounded-2xl border border-white/12 overflow-hidden relative flex flex-col justify-between p-5 sm:p-8 lg:p-10 min-h-[300px] sm:min-h-[380px] lg:min-h-[520px] shadow-2xl"
            style={{ backgroundColor: theme.bgSurface }}
          >
            {!backdropFailed && (
              <img
                src={TITLE_BACKDROP_URL}
                alt="Mafia parlor interior"
                decoding="async"
                referrerPolicy="no-referrer"
                onError={() => setBackdropFailed(true)}
                className="pointer-events-none absolute inset-0 w-full h-full object-cover opacity-50"
              />
            )}
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'linear-gradient(160deg, rgba(7,11,20,0.88) 0%, rgba(10,14,24,0.52) 48%, rgba(7,11,20,0.96) 100%)',
              }}
              aria-hidden="true"
            />

            <div className="relative z-10 space-y-3 sm:space-y-4 max-w-xl">
              <div className="text-xs font-medium text-amber-300/95 tracking-wide">
                Online Multiplayer Social Deduction · Live Voice · Game Master Edition
              </div>
              <h1
                className="font-display font-bold tracking-tight text-white leading-[1.06]"
                style={{ fontSize: 'clamp(2.2rem, 4.2vw, 3.6rem)', textWrap: 'balance' }}
              >
                <span className="text-red-500">MAFIA</span> — Trust No One at the Table.
              </h1>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-lg">
                Host private rooms with friends, speak over encrypted voice chat, assign secret
                roles with server-enforced privacy, and command every round from Dawn to Midnight.
              </p>
            </div>

            {/* 4 Role Card Preview Strip */}
            <div className="relative z-10 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              {roleShowcase.map(({ name, team, icon: Icon, accent }) => (
                <div
                  key={name}
                  className="rounded-xl border border-white/12 bg-[#070B14]/85 p-2.5 flex items-center gap-2.5 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden border border-white/15 shrink-0">
                    <RoleCardArtwork role={name} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white flex items-center gap-1 truncate">
                      <Icon size={12} style={{ color: accent }} className="shrink-0" />
                      <span className="truncate">{name}</span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">{team}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* RIGHT LOGIN CARD (5 cols on desktop) */}
          <motion.section
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 rounded-2xl border border-white/14 p-5 sm:p-8 flex flex-col justify-center shadow-2xl"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="space-y-5 sm:space-y-6">
              {invitedRoomCode && (
                <div
                  className="rounded-xl border border-amber-400/40 px-4 py-3 text-xs text-amber-100 flex items-center gap-2.5"
                  style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)' }}
                >
                  <KeyRound size={16} className="text-amber-400 shrink-0" />
                  <div>
                    Room <span className="font-mono-tabular font-bold text-amber-300">#{invitedRoomCode}</span>{' '}
                    invite detected. Sign in or continue as guest to join right away.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300">
                  <Crown size={14} />
                  <span>Player Account Access</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Enter the Parlor
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Sign in with Google to claim your permanent Player ID, add friends, send 1-click
                  room invites, and record your win ledger across devices.
                </p>
              </div>

              {authError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/45 bg-red-950/60 px-4 py-3 text-xs text-red-200 flex items-start gap-2.5"
                >
                  <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{authError}</div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  type="button"
                  onClick={onSignInWithGoogle}
                  disabled={authBusy}
                  style={{ backgroundColor: theme.accent, color: theme.accentText }}
                  className="w-full min-h-[50px] rounded-xl px-5 py-3 text-sm sm:text-base font-bold flex items-center justify-center gap-2.5 shadow-lg transition-transform active:scale-[0.99] cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <LogIn size={18} />
                  <span>{authBusy ? 'Signing in with Google...' : 'Continue with Google'}</span>
                </button>

                <button
                  type="button"
                  onClick={onContinueAsGuest}
                  disabled={authBusy}
                  style={{ backgroundColor: theme.bgCanvas }}
                  className="w-full min-h-[46px] rounded-xl border border-white/15 hover:border-white/30 px-5 py-2.5 text-xs sm:text-sm font-semibold text-slate-200 hover:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap"
                >
                  <span>Continue as Guest</span>
                  <ArrowRight size={15} />
                </button>
              </div>

              {/* Clean divider + account perks */}
              <div className="pt-4 border-t border-white/10 space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <UserCheck size={14} className="text-emerald-400 shrink-0" />
                  <span>Permanent Friend Code (e.g. MAF-4K9A) saved to your Google ID</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Users size={14} className="text-sky-400 shrink-0" />
                  <span>See which room your friends are in and invite them in 1 tap</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Shield size={14} className="text-amber-400 shrink-0" />
                  <span>Server-enforced secret role privacy and live match voice chat</span>
                </div>
              </div>
            </div>
          </motion.section>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="relative z-10 max-w-[1440px] 2xl:max-w-[1560px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 pb-safe text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
        <span>Nocturne Parlor · Online Multiplayer Mafia</span>
        <span>Guest mode lets you join any room immediately · Sign in anytime to save progress</span>
      </footer>
    </div>
  );
}
