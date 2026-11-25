import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'motion/react';
import { TitleScreen } from './components/TitleScreen.tsx';
import { RoundTimelineBar } from './components/RoundTimelineBar.tsx';
import { LobbyView } from './components/LobbyView.tsx';
import { GameMasterDashboard } from './components/GameMasterDashboard.tsx';
import { PlayerTableView } from './components/PlayerTableView.tsx';
import { GameOverView, PauseOverlay } from './components/PauseAndVictoryModals.tsx';
import { AmbientBackdrop } from './components/AmbientBackdrop.tsx';
import { FriendsDrawerModal } from './components/FriendsDrawerModal.tsx';
import { PhaseCinematicBanner } from './components/PhaseCinematicBanner.tsx';
import { BackgroundAudioController } from './components/BackgroundAudioController.tsx';
import { type ActiveSession, useParlorSocket } from './hooks/useParlorSocket.ts';
import { useFirebaseAccount } from './hooks/useFirebaseAccount.ts';
import { PARLOR_THEMES, type ParlorThemeId } from './utils/parlorThemes.ts';

const SESSION_STORAGE_KEY = 'nocturne_parlor_active_session';

function loadSavedSession(): ActiveSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveSession;
    if (parsed && parsed.roomCode && parsed.playerId && parsed.sessionToken) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [session, setSession] = useState<ActiveSession | null>(() => loadSavedSession());
  const [themeId, setThemeId] = useState<ParlorThemeId>('syndicate');
  const [activeSection, setActiveSection] = useState<'room' | 'settings' | 'history'>('room');
  const [friendsOpen, setFriendsOpen] = useState(false);
  const theme = PARLOR_THEMES[themeId];

  useEffect(() => {
    try {
      if (session) {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
      } else {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      }
    } catch {
      // Ignore private browsing storage restrictions
    }
  }, [session]);

  const account = useFirebaseAccount();

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--parlor-canvas', theme.bgCanvas);
    root.style.setProperty('--parlor-surface', theme.bgSurface);
    root.style.setProperty('--parlor-elevated', theme.bgElevated);
    root.style.setProperty('--parlor-accent', theme.accent);
    root.style.setProperty('--parlor-accent-hover', theme.accentHover);
    root.style.setProperty('--parlor-accent-text', theme.accentText);
  }, [theme]);

  const showToastRef = useRef<((text: string, kind?: 'info' | 'error') => void) | null>(null);

  const handleSessionInvalid = useCallback((reason: string) => {
    setSession(null);
    setActiveSection('room');
    showToastRef.current?.(reason, 'error');
  }, []);

  const {
    gameState,
    connected,
    toast,
    showToast,
    sendMessage,
    sendGmAction,
    micActive,
    deafened,
    isLocalSpeaking,
    voiceError,
    toggleMic,
    toggleDeafen,
    stopVoice,
  } = useParlorSocket(session, handleSessionInvalid);

  showToastRef.current = showToast;

  const prevRoomPhaseRef = useRef<string | null>(null);
  const lastRoomSyncKeyRef = useRef<string | null>(null);
  const recordedMatchKeyRef = useRef<string | null>(null);

  // Sync player's current room presence in Firestore directory
  useEffect(() => {
    if (!account.user || !account.profile) return;
    if (session) {
      void account.syncRoomPresence(session.roomCode, session.roomName).catch(() => {});
    } else {
      void account.syncRoomPresence('', '').catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.user?.uid, account.profile?.friendCode, session?.roomCode]);

  // Sync hosted room directory metadata in Firestore when GM
  useEffect(() => {
    if (!account.user || !account.profile || !session || !gameState?.viewerIsGM) return;

    const nonGmCount = gameState.players.filter((p) => !p.isGM).length;
    const isRestart =
      prevRoomPhaseRef.current === 'GAME_OVER' && gameState.phase === 'LOBBY';
    const isFirstSync = prevRoomPhaseRef.current === null;
    prevRoomPhaseRef.current = gameState.phase;

    const syncKey = `${gameState.roomCode}:${gameState.phase}:${nonGmCount}:${gameState.settings.playerLimit}:${Boolean(session.isPublicRoom)}`;
    if (!isRestart && !isFirstSync && lastRoomSyncKeyRef.current === syncKey) {
      return;
    }
    lastRoomSyncKeyRef.current = syncKey;

    void account
      .syncHostedRoom({
        roomCode: gameState.roomCode,
        roomName: gameState.roomName,
        phase: gameState.phase,
        playerCount: nonGmCount,
        playerLimit: gameState.settings.playerLimit,
        isPublic: session.isPublicRoom ?? true,
        isNewOrRestart: isFirstSync || isRestart,
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    account.user?.uid,
    account.profile?.friendCode,
    session?.roomCode,
    session?.isPublicRoom,
    gameState?.viewerIsGM,
    gameState?.phase,
    gameState?.players.length,
    gameState?.settings.playerLimit,
  ]);

  // Reset match-recorded guard when returning to lobby or changing room
  useEffect(() => {
    if (!session || gameState?.phase === 'LOBBY') {
      recordedMatchKeyRef.current = null;
    }
  }, [session?.roomCode, gameState?.phase]);

  // Record completed match history & career stats when GAME_OVER triggers
  useEffect(() => {
    if (
      !account.user ||
      !account.profile ||
      !gameState ||
      gameState.phase !== 'GAME_OVER' ||
      !gameState.winner
    ) {
      return;
    }
    const key = `${gameState.roomCode}_R${gameState.round}_${gameState.winner.team}`;
    if (recordedMatchKeyRef.current === key) return;
    recordedMatchKeyRef.current = key;

    const nonGmCount = gameState.players.filter((p) => !p.isGM).length;
    const won = gameState.viewerIsGM
      ? false
      : gameState.viewerTeam === gameState.winner.team;

    void account
      .recordCompletedMatch({
        roomCode: gameState.roomCode,
        roomName: gameState.roomName,
        role: gameState.viewerIsGM ? 'Game Master' : gameState.viewerRole || 'Player',
        team: gameState.viewerIsGM ? 'GM' : gameState.viewerTeam || 'Town',
        winnerTeam: gameState.winner.team,
        won,
        wasGM: gameState.viewerIsGM,
        roundsPlayed: gameState.round,
        playerCount: nonGmCount,
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    account.user?.uid,
    account.profile?.friendCode,
    gameState?.phase,
    gameState?.round,
    gameState?.winner?.team,
  ]);

  const handleLeave = useCallback(() => {
    const oldSession = session;
    const wasGM = Boolean(gameState?.viewerIsGM);
    stopVoice();
    prevRoomPhaseRef.current = null;
    lastRoomSyncKeyRef.current = null;
    setSession(null);
    setActiveSection('room');
    if (account.user) {
      void account.syncRoomPresence('', '').catch(() => {});
      if (wasGM && oldSession?.roomCode) {
        void account.deleteHostedRoom(oldSession.roomCode).catch(() => {});
      }
    }
  }, [account, gameState?.viewerIsGM, session, stopVoice]);

  const handleJoinRoomByCode = useCallback(
    async (roomCode: string) => {
      const cleanCode = roomCode.trim().toUpperCase();
      if (!cleanCode) return;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(cleanCode)}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: account.profile?.displayName || 'Investigator',
            avatar: account.profile?.avatar || 'fedora',
            accountUid: account.user?.uid || undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || 'Could not join room.', 'error');
          return;
        }
        if (session) {
          stopVoice();
          prevRoomPhaseRef.current = null;
          lastRoomSyncKeyRef.current = null;
        }
        setSession({
          roomCode: data.roomCode,
          roomName: data.roomName,
          playerId: data.playerId,
          sessionToken: data.sessionToken,
          rejoinPin: data.rejoinPin,
        });
        setActiveSection('room');
      } catch {
        showToast('Unable to reach game server.', 'error');
      }
    },
    [account.profile, account.user?.uid, session, showToast, stopVoice]
  );

  const friendsDrawer = (
    <FriendsDrawerModal
      open={friendsOpen}
      onClose={() => setFriendsOpen(false)}
      theme={theme}
      isSignedIn={Boolean(account.user)}
      authBusy={account.authBusy}
      profile={account.profile}
      friends={account.friends}
      invites={account.invites}
      matchHistory={account.matchHistory}
      currentRoomCode={session?.roomCode}
      currentRoomName={session?.roomName}
      onSignIn={() => void account.signInWithGoogle()}
      onSignOut={() => void account.signOutUser()}
      onUpdateProfile={account.updateProfile}
      onAddFriend={account.addFriendByCode}
      onRemoveFriend={account.removeFriend}
      onSendInvite={account.sendRoomInvite}
      onJoinRoomByCode={handleJoinRoomByCode}
      onRespondInvite={account.respondToInvite}
      onRefreshFriends={account.refreshFriendsStatus}
      onNotify={(msg, kind) => showToast(msg, kind || 'info')}
    />
  );

  const voiceActive =
    micActive || Boolean(gameState && gameState.voicePeers.length > 0);

  return (
    <MotionConfig reducedMotion="user">
      <BackgroundAudioController
        gameState={gameState}
        phase={gameState?.phase ?? null}
        isPaused={Boolean(gameState?.isPaused)}
        inRoom={Boolean(session && gameState)}
        voiceActive={voiceActive}
      />

      {!session ? (
        <>
          <TitleScreen
            theme={theme}
            themeId={themeId}
            onSelectTheme={setThemeId}
            onEnterRoom={(s) => setSession(s)}
            user={account.user}
            profile={account.profile}
            profileLoading={account.profileLoading}
            authBusy={account.authBusy}
            authError={account.authError}
            friends={account.friends}
            invites={account.invites}
            publicRooms={account.publicRooms}
            matchHistory={account.matchHistory}
            onSignIn={() => void account.signInWithGoogle()}
            onSignOut={() => void account.signOutUser()}
            onUpdateProfile={account.updateProfile}
            onOpenFriendsDrawer={() => setFriendsOpen(true)}
            onRespondInvite={account.respondToInvite}
            onNotify={(msg, kind) => showToast(msg, kind || 'info')}
          />
          <AnimatePresence>
            {toast && (
              <motion.div
                key={toast.id}
                initial={{ opacity: 0, y: 12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.18 }}
                className="fixed bottom-4 left-3 right-3 sm:left-auto sm:bottom-5 sm:right-5 z-[60] sm:max-w-sm"
              >
                <div
                  role="status"
                  className={`rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl ${
                    toast.kind === 'error'
                      ? 'border-red-500/40 bg-red-950/95 text-red-100'
                      : 'border-white/15 text-white'
                  }`}
                  style={
                    toast.kind !== 'error'
                      ? { backgroundColor: theme.bgSurface, borderColor: `${theme.accent}60` }
                      : undefined
                  }
                >
                  {toast.text}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {friendsDrawer}
        </>
      ) : !gameState ? (
        <div
          className="min-h-screen text-slate-200 flex items-center justify-center p-6"
          style={{ backgroundColor: theme.bgCanvas }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl border border-white/10 px-8 py-6 text-center space-y-2"
            style={{ backgroundColor: theme.bgSurface }}
          >
            <div className="font-display text-xl text-white">
              Entering {session.roomName}...
            </div>
            <div
              className="text-xs font-mono-tabular"
              style={{ color: theme.accent }}
            >
              Room #{session.roomCode}
            </div>
          </motion.div>
        </div>
      ) : (
        <div
          className="relative min-h-screen text-[#F1F5F9] flex flex-col transition-colors duration-300"
          style={{ backgroundColor: theme.bgCanvas }}
        >
        <AmbientBackdrop
          phase={gameState.phase}
          theme={theme}
          viewerRole={gameState.viewerRole}
          viewerIsGM={gameState.viewerIsGM}
        />

        <RoundTimelineBar
          state={gameState}
          theme={theme}
          themeId={themeId}
          onSelectTheme={setThemeId}
          rejoinPin={session.rejoinPin}
          connected={connected}
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          onGmAction={sendGmAction}
          onLeave={handleLeave}
          onCopied={(msg) => showToast(msg, 'info')}
          onOpenFriends={() => setFriendsOpen(true)}
          inviteCount={account.invites.length}
          micActive={micActive}
          deafened={deafened}
          isLocalSpeaking={isLocalSpeaking}
          onToggleMic={toggleMic}
          onToggleDeafen={toggleDeafen}
        />

        <AnimatePresence>
          {toast && (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18 }}
              className="fixed bottom-4 left-3 right-3 sm:left-auto sm:bottom-5 sm:right-5 z-[60] sm:max-w-sm"
            >
              <div
                role="status"
                className={`rounded-xl border px-4 py-3 text-xs font-medium shadow-2xl ${
                  toast.kind === 'error'
                    ? 'border-red-500/40 bg-red-950/95 text-red-100'
                    : 'border-white/15 text-white'
                }`}
                style={
                  toast.kind !== 'error'
                    ? { backgroundColor: theme.bgSurface, borderColor: `${theme.accent}60` }
                    : undefined
                }
              >
                {toast.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <PauseOverlay state={gameState} onGmAction={sendGmAction} />
        <PhaseCinematicBanner state={gameState} />
        {friendsDrawer}

        <main className="relative z-10 flex-1 pb-safe">
          <AnimatePresence mode="wait">
            {gameState.phase === 'LOBBY' ? (
              <motion.div
                key="view-lobby"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <LobbyView
                  state={gameState}
                  theme={theme}
                  activeSection={activeSection}
                  micActive={micActive}
                  deafened={deafened}
                  isLocalSpeaking={isLocalSpeaking}
                  voiceError={voiceError}
                  onToggleMic={toggleMic}
                  onToggleDeafen={toggleDeafen}
                  onGmAction={sendGmAction}
                  onSendMessage={sendMessage}
                  onCopied={(msg) => showToast(msg, 'info')}
                  onOpenFriends={() => setFriendsOpen(true)}
                />
              </motion.div>
            ) : gameState.phase === 'GAME_OVER' ? (
              <motion.div
                key="view-gameover"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              >
                <GameOverView
                  state={gameState}
                  onGmAction={sendGmAction}
                  onLeave={handleLeave}
                />
              </motion.div>
            ) : gameState.viewerIsGM ? (
              <motion.div
                key="view-gm"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <GameMasterDashboard
                  state={gameState}
                  theme={theme}
                  activeSection={activeSection}
                  micActive={micActive}
                  deafened={deafened}
                  isLocalSpeaking={isLocalSpeaking}
                  voiceError={voiceError}
                  onToggleMic={toggleMic}
                  onToggleDeafen={toggleDeafen}
                  onGmAction={sendGmAction}
                  onSendMessage={sendMessage}
                />
              </motion.div>
            ) : (
              <motion.div
                key="view-player"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <PlayerTableView
                  state={gameState}
                  theme={theme}
                  activeSection={activeSection}
                  micActive={micActive}
                  deafened={deafened}
                  isLocalSpeaking={isLocalSpeaking}
                  voiceError={voiceError}
                  onToggleMic={toggleMic}
                  onToggleDeafen={toggleDeafen}
                  onSendMessage={sendMessage}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
        </div>
      )}
    </MotionConfig>
  );
}
