import { useCallback, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BLUEPRINT_LIMITS,
  db,
  formatFirestoreError,
  generateFriendCode,
  googleProvider,
  handleFirestoreError,
  OperationType,
  sanitizeAvatarId,
  sanitizeDisplayName,
  sanitizeFriendCode,
  sanitizeRoomCode,
  sanitizeRoomName,
} from '../firebase.ts';
import type { AvatarId, GamePhase, TeamAlignment } from '../shared/types.ts';

export interface UserProfileData {
  uid: string;
  friendCode: string;
  displayName: string;
  avatar: AvatarId;
  gamesPlayed: number;
  gamesWon: number;
  gmHostedCount: number;
  lastActiveRoomCode: string;
}

export interface FriendEntry {
  uid: string;
  friendUid: string;
  friendCode: string;
  displayName: string;
  avatar: AvatarId;
  currentRoomCode?: string;
  currentRoomName?: string;
}

export interface MatchHistoryItem {
  matchId: string;
  uid: string;
  roomCode: string;
  roomName: string;
  role: string;
  team: TeamAlignment | 'GM';
  winnerTeam: TeamAlignment;
  won: boolean;
  wasGM: boolean;
  roundsPlayed: number;
  playerCount: number;
  playedAtMs: number;
}

export interface PublicRoomListing {
  roomCode: string;
  roomName: string;
  hostUid: string;
  hostName: string;
  hostFriendCode: string;
  phase: 'LOBBY' | 'IN_GAME' | 'GAME_OVER';
  playerCount: number;
  playerLimit: number;
  isPublic: boolean;
  updatedAtMs: number;
}

export interface IncomingInviteItem {
  inviteId: string;
  fromUid: string;
  fromName: string;
  fromFriendCode: string;
  fromAvatar: AvatarId;
  toUid: string;
  roomCode: string;
  roomName: string;
  status: 'pending' | 'accepted' | 'dismissed';
  createdAtMs: number;
}

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function useFirebaseAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountError, setAccountError] = useState<string | null>(null);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [publicRooms, setPublicRooms] = useState<PublicRoomListing[]>([]);
  const [invites, setInvites] = useState<IncomingInviteItem[]>([]);

  // 1. Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      setAccountError(null);
      if (!u) {
        setProfile(null);
        setFriends([]);
        setMatchHistory([]);
        setPublicRooms([]);
        setInvites([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. Ensure Firestore UserProfile + PlayerDirectory exist on sign-in
  useEffect(() => {
    if (!authReady || !user) return;
    let cancelled = false;

    const bootstrapUser = async () => {
      setProfileLoading(true);
      const userPath = `users/${user.uid}`;
      try {
        const userRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          let chosenCode = generateFriendCode();
          for (let i = 0; i < 6; i++) {
            const dirSnap = await getDoc(doc(db, 'playerDirectory', chosenCode));
            if (!dirSnap.exists()) break;
            chosenCode = generateFriendCode();
          }

          const displayName = sanitizeDisplayName(
            user.displayName || user.email?.split('@')[0] || 'Investigator',
            'Investigator'
          );
          const avatar: AvatarId = 'fedora';

          const batch = writeBatch(db);
          batch.set(userRef, {
            uid: user.uid,
            friendCode: chosenCode,
            displayName,
            avatar,
            gamesPlayed: 0,
            gamesWon: 0,
            gmHostedCount: 0,
            lastActiveRoomCode: '',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          batch.set(doc(db, 'playerDirectory', chosenCode), {
            uid: user.uid,
            friendCode: chosenCode,
            displayName,
            avatar,
            currentRoomCode: '',
            currentRoomName: '',
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } else {
          const data = snap.data();
          const code = sanitizeFriendCode(String(data.friendCode || ''));
          if (code) {
            const dirRef = doc(db, 'playerDirectory', code);
            const dirSnap = await getDoc(dirRef);
            if (!dirSnap.exists()) {
              await setDoc(dirRef, {
                uid: user.uid,
                friendCode: code,
                displayName: sanitizeDisplayName(String(data.displayName || 'Player')),
                avatar: sanitizeAvatarId(String(data.avatar || 'fedora')),
                currentRoomCode: '',
                currentRoomName: '',
                updatedAt: serverTimestamp(),
              });
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          const { friendlyMessage } = formatFirestoreError(err, OperationType.WRITE, userPath);
          setAccountError(friendlyMessage);
        }
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    };

    void bootstrapUser();
    return () => {
      cancelled = true;
    };
  }, [authReady, user, bootstrapAttempt]);

  const retryAccountSync = useCallback(() => {
    setAccountError(null);
    setAuthError(null);
    setBootstrapAttempt((n) => n + 1);
  }, []);

  // 3. Real-time onSnapshot subscriptions (ONLY when authenticated)
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    const unsubProfile = onSnapshot(
      doc(db, 'users', uid),
      (snap) => {
        if (!snap.exists()) return;
        const d = snap.data();
        setProfile({
          uid: String(d.uid || uid),
          friendCode: String(d.friendCode || ''),
          displayName: String(d.displayName || 'Player'),
          avatar: sanitizeAvatarId(String(d.avatar || 'fedora')),
          gamesPlayed: Number(d.gamesPlayed || 0),
          gamesWon: Number(d.gamesWon || 0),
          gmHostedCount: Number(d.gmHostedCount || 0),
          lastActiveRoomCode: String(d.lastActiveRoomCode || ''),
        });
      },
      (err) => {
        const { friendlyMessage } = formatFirestoreError(err, OperationType.GET, `users/${uid}`);
        setAccountError(friendlyMessage);
      }
    );

    const friendsQuery = query(
      collection(db, 'users', uid, 'friends'),
      where('uid', '==', uid)
    );
    const unsubFriends = onSnapshot(
      friendsQuery,
      (snap) => {
        const list: FriendEntry[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            uid: String(data.uid),
            friendUid: String(data.friendUid),
            friendCode: String(data.friendCode),
            displayName: String(data.displayName),
            avatar: sanitizeAvatarId(String(data.avatar)),
          };
        });
        setFriends((prev) =>
          list.map((item) => {
            const old = prev.find((p) => p.friendUid === item.friendUid);
            return old
              ? {
                  ...item,
                  currentRoomCode: old.currentRoomCode,
                  currentRoomName: old.currentRoomName,
                }
              : item;
          })
        );
      },
      (err) => {
        const { friendlyMessage } = formatFirestoreError(err, OperationType.LIST, `users/${uid}/friends`);
        setAccountError(friendlyMessage);
      }
    );

    const historyQuery = query(
      collection(db, 'users', uid, 'matchHistory'),
      where('uid', '==', uid),
      limit(30)
    );
    const unsubHistory = onSnapshot(
      historyQuery,
      (snap) => {
        const items: MatchHistoryItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              matchId: String(data.matchId || d.id),
              uid: String(data.uid),
              roomCode: String(data.roomCode),
              roomName: String(data.roomName),
              role: String(data.role),
              team: (data.team || 'Town') as TeamAlignment | 'GM',
              winnerTeam: (data.winnerTeam || 'Town') as TeamAlignment,
              won: Boolean(data.won),
              wasGM: Boolean(data.wasGM),
              roundsPlayed: Number(data.roundsPlayed || 0),
              playerCount: Number(data.playerCount || 0),
              playedAtMs: toMillis(data.playedAt),
            };
          })
          .sort((a, b) => b.playedAtMs - a.playedAtMs);
        setMatchHistory(items);
      },
      (err) => {
        const { friendlyMessage } = formatFirestoreError(
          err,
          OperationType.LIST,
          `users/${uid}/matchHistory`
        );
        setAccountError(friendlyMessage);
      }
    );

    const roomsQuery = query(
      collection(db, 'rooms'),
      where('isPublic', '==', true),
      limit(25)
    );
    const unsubRooms = onSnapshot(
      roomsQuery,
      (snap) => {
        const cutoff = Date.now() - 4 * 60 * 60 * 1000; // Hide stale rooms > 4 hours old
        const list: PublicRoomListing[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              roomCode: String(data.roomCode || d.id),
              roomName: String(data.roomName || 'Parlor'),
              hostUid: String(data.hostUid || ''),
              hostName: String(data.hostName || 'GM'),
              hostFriendCode: String(data.hostFriendCode || ''),
              phase: (data.phase || 'LOBBY') as 'LOBBY' | 'IN_GAME' | 'GAME_OVER',
              playerCount: Number(data.playerCount || 0),
              playerLimit: Number(data.playerLimit || 12),
              isPublic: Boolean(data.isPublic),
              updatedAtMs: toMillis(data.updatedAt),
            };
          })
          .filter((r) => r.phase !== 'GAME_OVER' && r.updatedAtMs >= cutoff)
          .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
        setPublicRooms(list);
      },
      (err) => {
        const { friendlyMessage } = formatFirestoreError(err, OperationType.LIST, 'rooms');
        setAccountError(friendlyMessage);
      }
    );

    const invitesQuery = query(
      collection(db, 'invites'),
      where('toUid', '==', uid),
      limit(20)
    );
    const unsubInvites = onSnapshot(
      invitesQuery,
      (snap) => {
        const list: IncomingInviteItem[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              inviteId: String(data.inviteId || d.id),
              fromUid: String(data.fromUid || ''),
              fromName: String(data.fromName || 'Friend'),
              fromFriendCode: String(data.fromFriendCode || ''),
              fromAvatar: sanitizeAvatarId(String(data.fromAvatar || 'fedora')),
              toUid: String(data.toUid || uid),
              roomCode: String(data.roomCode || ''),
              roomName: String(data.roomName || 'Mafia Room'),
              status: (data.status || 'pending') as 'pending' | 'accepted' | 'dismissed',
              createdAtMs: toMillis(data.createdAt),
            };
          })
          .filter((inv) => inv.status === 'pending')
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setInvites(list);
      },
      (err) => {
        const { friendlyMessage } = formatFirestoreError(err, OperationType.LIST, 'invites');
        setAccountError(friendlyMessage);
      }
    );

    return () => {
      unsubProfile();
      unsubFriends();
      unsubHistory();
      unsubRooms();
      unsubInvites();
    };
  }, [authReady, user]);

  // 4. Refresh friends' live room status from /playerDirectory/{friendCode}
  const refreshFriendsStatus = useCallback(async () => {
    if (!user || friends.length === 0) return;
    try {
      const updated = await Promise.all(
        friends.map(async (f) => {
          try {
            const snap = await getDoc(doc(db, 'playerDirectory', f.friendCode));
            if (!snap.exists()) return f;
            const d = snap.data();
            return {
              ...f,
              displayName: String(d.displayName || f.displayName),
              avatar: sanitizeAvatarId(String(d.avatar || f.avatar)),
              currentRoomCode: String(d.currentRoomCode || ''),
              currentRoomName: String(d.currentRoomName || ''),
            };
          } catch {
            return f;
          }
        })
      );
      setFriends(updated);
    } catch {
      // Ignore individual directory read errors
    }
  }, [friends, user]);

  useEffect(() => {
    if (!user || friends.length === 0) return;
    void refreshFriendsStatus();
    const timer = window.setInterval(() => {
      void refreshFriendsStatus();
    }, 15000);
    return () => window.clearInterval(timer);
    // Only re-register interval when friend list length or user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, friends.length]);

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null);
    setAccountError(null);
    setAuthBusy(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      const raw = err instanceof Error ? err.message : 'Google Sign-In failed.';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        // User intentionally closed sign-in popup
      } else if (code === 'auth/popup-blocked') {
        setAuthError(
          'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          'This domain is not yet authorized in Firebase Authentication. Add this domain under Authorized Domains in Firebase Console.'
        );
      } else if (code === 'auth/network-request-failed') {
        setAuthError('Network error during Google Sign-In. Check your connection and try again.');
      } else {
        setAuthError(raw);
      }
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-out failed.');
    }
  }, []);

  const updateProfile = useCallback(
    async (displayName: string, avatar: AvatarId) => {
      if (!user || !profile) return;
      const cleanName = sanitizeDisplayName(displayName, profile.displayName);
      const cleanAvatar = sanitizeAvatarId(avatar);
      const batch = writeBatch(db);
      batch.update(doc(db, 'users', user.uid), {
        displayName: cleanName,
        avatar: cleanAvatar,
        updatedAt: serverTimestamp(),
      });
      if (profile.friendCode) {
        batch.update(doc(db, 'playerDirectory', profile.friendCode), {
          displayName: cleanName,
          avatar: cleanAvatar,
          updatedAt: serverTimestamp(),
        });
      }
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [profile, user]
  );

  const addFriendByCode = useCallback(
    async (rawCode: string): Promise<{ ok: boolean; message: string }> => {
      if (!user || !profile) {
        return { ok: false, message: 'Sign in with Google first.' };
      }
      const code = sanitizeFriendCode(rawCode);
      if (code.length < 6 || !BLUEPRINT_LIMITS.FRIEND_CODE_REGEX.test(code)) {
        return { ok: false, message: 'Enter a valid Friend ID (e.g. MAF-7K4Q).' };
      }
      if (code === profile.friendCode) {
        return { ok: false, message: 'You cannot add yourself as a friend.' };
      }

      const dirPath = `playerDirectory/${code}`;
      let targetSnap;
      try {
        targetSnap = await getDoc(doc(db, 'playerDirectory', code));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, dirPath);
      }

      if (!targetSnap.exists()) {
        return { ok: false, message: `No player found with Friend ID "${code}".` };
      }

      const target = targetSnap.data();
      const friendUid = String(target.uid);
      if (friendUid === user.uid) {
        return { ok: false, message: 'You cannot add yourself.' };
      }

      const friendPath = `users/${user.uid}/friends/${friendUid}`;
      try {
        await setDoc(doc(db, 'users', user.uid, 'friends', friendUid), {
          uid: user.uid,
          friendUid,
          friendCode: code,
          displayName: sanitizeDisplayName(String(target.displayName || 'Player')),
          avatar: sanitizeAvatarId(String(target.avatar || 'fedora')),
          createdAt: serverTimestamp(),
        });
        return {
          ok: true,
          message: `Added ${target.displayName} (${code}) to your friends list.`,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, friendPath);
      }
    },
    [profile, user]
  );

  const removeFriend = useCallback(
    async (friendUid: string) => {
      if (!user) return;
      const path = `users/${user.uid}/friends/${friendUid}`;
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'friends', friendUid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [user]
  );

  const sendRoomInvite = useCallback(
    async (friend: FriendEntry, roomCode: string, roomName: string): Promise<void> => {
      if (!user || !profile) return;
      const cleanRoom = sanitizeRoomCode(roomCode);
      const cleanName = sanitizeRoomName(roomName);
      const inviteId = `${user.uid.slice(0, 8)}_${friend.friendUid.slice(0, 8)}_${cleanRoom}_${Date.now()}`;
      const path = `invites/${inviteId}`;
      try {
        await setDoc(doc(db, 'invites', inviteId), {
          inviteId,
          fromUid: user.uid,
          fromName: sanitizeDisplayName(profile.displayName),
          fromFriendCode: profile.friendCode,
          fromAvatar: profile.avatar,
          toUid: friend.friendUid,
          roomCode: cleanRoom,
          roomName: cleanName,
          status: 'pending',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [profile, user]
  );

  const respondToInvite = useCallback(
    async (inviteId: string, status: 'accepted' | 'dismissed') => {
      if (!user) return;
      const path = `invites/${inviteId}`;
      try {
        await updateDoc(doc(db, 'invites', inviteId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [user]
  );

  const syncRoomPresence = useCallback(
    async (roomCode: string, roomName: string) => {
      if (!user || !profile?.friendCode) return;
      const cleanCode = roomCode ? sanitizeRoomCode(roomCode) : '';
      const cleanName = roomName ? sanitizeRoomName(roomName) : '';
      try {
        await updateDoc(doc(db, 'playerDirectory', profile.friendCode), {
          displayName: sanitizeDisplayName(profile.displayName),
          avatar: profile.avatar,
          currentRoomCode: cleanCode,
          currentRoomName: cleanName,
          updatedAt: serverTimestamp(),
        });
        if (cleanCode) {
          await updateDoc(doc(db, 'users', user.uid), {
            lastActiveRoomCode: cleanCode,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `playerDirectory/${profile.friendCode}`);
      }
    },
    [profile, user]
  );

  const syncHostedRoom = useCallback(
    async (params: {
      roomCode: string;
      roomName: string;
      phase: GamePhase;
      playerCount: number;
      playerLimit: number;
      isPublic: boolean;
      isNewOrRestart?: boolean;
    }) => {
      if (!user || !profile) return;
      const cleanCode = sanitizeRoomCode(params.roomCode);
      if (!cleanCode) return;
      const roomRef = doc(db, 'rooms', cleanCode);
      const mappedPhase: 'LOBBY' | 'IN_GAME' | 'GAME_OVER' =
        params.phase === 'LOBBY'
          ? 'LOBBY'
          : params.phase === 'GAME_OVER'
            ? 'GAME_OVER'
            : 'IN_GAME';

      try {
        const existingSnap = await getDoc(roomRef);
        if (params.isNewOrRestart && existingSnap.exists()) {
          await deleteDoc(roomRef);
        }

        const freshSnap = params.isNewOrRestart ? null : existingSnap;
        if (!freshSnap || !freshSnap.exists()) {
          await setDoc(roomRef, {
            roomCode: cleanCode,
            roomName: sanitizeRoomName(params.roomName),
            hostUid: user.uid,
            hostName: sanitizeDisplayName(profile.displayName),
            hostFriendCode: profile.friendCode,
            phase: mappedPhase,
            playerCount: Math.max(0, Math.min(32, params.playerCount)),
            playerLimit: Math.max(3, Math.min(24, params.playerLimit)),
            isPublic: params.isPublic,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          const prevData = freshSnap.data();
          if (prevData.hostUid === user.uid && prevData.phase !== 'GAME_OVER') {
            await updateDoc(roomRef, {
              roomName: sanitizeRoomName(params.roomName),
              phase: mappedPhase,
              playerCount: Math.max(0, Math.min(32, params.playerCount)),
              playerLimit: Math.max(3, Math.min(24, params.playerLimit)),
              isPublic: params.isPublic,
              updatedAt: serverTimestamp(),
            });
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `rooms/${cleanCode}`);
      }
    },
    [profile, user]
  );

  const deleteHostedRoom = useCallback(
    async (roomCode: string) => {
      if (!user) return;
      const cleanCode = sanitizeRoomCode(roomCode);
      if (!cleanCode) return;
      const roomRef = doc(db, 'rooms', cleanCode);
      try {
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().hostUid === user.uid) {
          await deleteDoc(roomRef);
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `rooms/${cleanCode}`);
      }
    },
    [user]
  );

  const recordCompletedMatch = useCallback(
    async (params: {
      roomCode: string;
      roomName: string;
      role: string;
      team: TeamAlignment | 'GM';
      winnerTeam: TeamAlignment;
      won: boolean;
      wasGM: boolean;
      roundsPlayed: number;
      playerCount: number;
    }) => {
      if (!user || !profile) return;
      const cleanCode = sanitizeRoomCode(params.roomCode);
      const matchId = `${cleanCode}_${Date.now()}`;
      const batch = writeBatch(db);
      batch.set(doc(db, 'users', user.uid, 'matchHistory', matchId), {
        matchId,
        uid: user.uid,
        roomCode: cleanCode,
        roomName: sanitizeRoomName(params.roomName),
        role: (params.role || 'Player').slice(0, BLUEPRINT_LIMITS.ROLE_NAME_MAX),
        team: params.team,
        winnerTeam: params.winnerTeam,
        won: params.won,
        wasGM: params.wasGM,
        roundsPlayed: Math.max(0, params.roundsPlayed),
        playerCount: Math.max(0, params.playerCount),
        playedAt: serverTimestamp(),
      });
      batch.update(doc(db, 'users', user.uid), {
        gamesPlayed: profile.gamesPlayed + 1,
        gamesWon: profile.gamesWon + (params.won ? 1 : 0),
        gmHostedCount: profile.gmHostedCount + (params.wasGM ? 1 : 0),
        updatedAt: serverTimestamp(),
      });
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/matchHistory/${matchId}`);
      }
    },
    [profile, user]
  );

  return {
    user,
    authReady,
    profile,
    profileLoading,
    authBusy,
    authError,
    accountError,
    friends,
    matchHistory,
    publicRooms,
    invites,
    signInWithGoogle,
    signOutUser,
    retryAccountSync,
    updateProfile,
    addFriendByCode,
    removeFriend,
    sendRoomInvite,
    respondToInvite,
    syncRoomPresence,
    syncHostedRoom,
    deleteHostedRoom,
    recordCompletedMatch,
    refreshFriendsStatus,
  };
}
