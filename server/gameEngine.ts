import crypto from 'crypto';
import type {
  AvatarId,
  ChatMessage,
  ClientGameState,
  CustomRoleDefinition,
  DayAnnouncement,
  DetectiveInvestigationRecord,
  GameEventLog,
  GamePhase,
  GameSettings,
  NightActionStateView,
  PublicPlayer,
  RoundHistoryEntry,
  TeamAlignment,
  VoteResultSummary,
} from '../src/shared/types.ts';

export interface ServerPlayer {
  id: string;
  name: string;
  avatar: AvatarId;
  accountUid?: string;
  sessionToken: string;
  rejoinPin: string;
  isGM: boolean;
  isOnline: boolean;
  isAlive: boolean;
  isReady: boolean;
  isMuted: boolean;
  canSpeak: boolean;
  role: string | null;
  roleRevealed: boolean;
  eliminatedRound: number | null;
  eliminatedBy: 'night' | 'vote' | 'gm' | null;
  detectiveHistory: DetectiveInvestigationRecord[];
  lastProtectedId: string | null;
}

export interface ServerNightState {
  mafiaSelections: Record<string, string>;
  mafiaFinalTargetId: string | null;
  mafiaLocked: boolean;
  bodyguardTargetId: string | null;
  bodyguardLocked: boolean;
  detectiveTargetId: string | null;
  detectiveResultIsMafia: boolean | null;
  detectiveLocked: boolean;
  customActions: Record<string, { roleName: string; targetId: string | null; note?: string }>;
  protectedTargetSaved: boolean;
  computedVictimId: string | null;
  gmOverrideVictimId: string | null | undefined;
  resolvedVictimId: string | null;
  nightResolved: boolean;
  appliedToDay: boolean;
}

export interface ServerRoom {
  roomCode: string;
  roomName: string;
  gmPlayerId: string;
  gmSecretToken: string;
  phase: GamePhase;
  round: number;
  roundStartedAt: number;
  isPaused: boolean;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  discussionEnded: boolean;
  completedRoundSteps: string[];
  settings: GameSettings;
  customRoles: CustomRoleDefinition[];
  players: Map<string, ServerPlayer>;
  nightState: ServerNightState;
  dayAnnouncement: DayAnnouncement | null;
  votes: Record<string, string>; // voterId -> targetId | 'NO_VOTE'
  voteResult: VoteResultSummary | null;
  lastRoundSummary: RoundHistoryEntry | null;
  winner: { team: TeamAlignment; reason: string } | null;
  publicChat: ChatMessage[];
  mafiaChat: ChatMessage[];
  deadChat: ChatMessage[];
  events: GameEventLog[];
  roundHistory: RoundHistoryEntry[];
  gmNotes: string;
  voicePeers: Set<string>;
  currentRoundGmEvents: string[];
  currentRoundDiscussionStart: number | null;
  currentRoundDiscussionSeconds: number;
}

const VALID_AVATARS: AvatarId[] = [
  'lantern',
  'fedora',
  'magnifying',
  'shield',
  'rose',
  'pocketwatch',
  'key',
  'raven',
  'compass',
  'quill',
  'chalice',
  'mask',
];

export function defaultSettings(): GameSettings {
  return {
    playerLimit: 12,
    maxRounds: 0,
    roleCounts: {
      Mafia: 2,
      Detective: 1,
      Bodyguard: 1,
      Villager: 4,
    },
    nightDuration: 45,
    discussionDuration: 120,
    votingDuration: 45,
    revealRoleOnElimination: true,
    anonymousVoting: false,
    allowVoteChange: true,
    allowNoVote: true,
    tieRule: 'manual',
    mafiaTeamCommunication: true,
    mafiaKnowEachOther: true,
    mafiaWinCondition: 'equal_or_more',
    bodyguardSelfProtect: true,
    bodyguardConsecutiveProtect: false,
    allowGmNightOverride: true,
    voiceChatEnabled: true,
    spectatorModeEnabled: true,
    deadChatEnabled: true,
    customAnnouncementsEnabled: true,
    progressionMode: 'manual',
  };
}

export function createEmptyNightState(): ServerNightState {
  return {
    mafiaSelections: {},
    mafiaFinalTargetId: null,
    mafiaLocked: false,
    bodyguardTargetId: null,
    bodyguardLocked: false,
    detectiveTargetId: null,
    detectiveResultIsMafia: null,
    detectiveLocked: false,
    customActions: {},
    protectedTargetSaved: false,
    computedVictimId: null,
    gmOverrideVictimId: undefined,
    resolvedVictimId: null,
    nightResolved: false,
    appliedToDay: false,
  };
}

function makeRoomCode(existing: Map<string, ServerRoom>): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(0, chars.length)];
    }
    if (!existing.has(code)) return code;
  }
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function makeToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

function makePin(): string {
  return String(crypto.randomInt(1000, 9999));
}

export function sanitizeAvatar(raw: unknown): AvatarId {
  if (typeof raw === 'string' && VALID_AVATARS.includes(raw as AvatarId)) {
    return raw as AvatarId;
  }
  return 'lantern';
}

export function getRoleTeam(role: string | null, customRoles: CustomRoleDefinition[]): TeamAlignment | null {
  if (!role) return null;
  if (role === 'Mafia') return 'Mafia';
  if (role === 'Detective' || role === 'Bodyguard' || role === 'Villager') return 'Town';
  const custom = customRoles.find((c) => c.name === role || c.id === role);
  return custom ? custom.team : 'Town';
}

export function doesRoleAppearAsMafia(role: string | null, customRoles: CustomRoleDefinition[]): boolean {
  if (!role) return false;
  if (role === 'Mafia') return true;
  if (role === 'Detective' || role === 'Bodyguard' || role === 'Villager') return false;
  const custom = customRoles.find((c) => c.name === role || c.id === role);
  return custom ? custom.appearsAsMafia : false;
}

export function addEvent(
  room: ServerRoom,
  visibility: 'public' | 'gm_only',
  message: string
): void {
  room.events.push({
    id: crypto.randomUUID(),
    round: room.round,
    phase: room.phase,
    visibility,
    message,
    timestamp: Date.now(),
  });
  if (room.events.length > 400) {
    room.events.shift();
  }
  if (visibility === 'gm_only') {
    room.currentRoundGmEvents.push(message);
  }
}

export function addChat(
  room: ServerRoom,
  channel: ChatMessage['channel'],
  senderId: string,
  senderName: string,
  text: string,
  kind: ChatMessage['kind'] = 'chat',
  targetPlayerName?: string
): void {
  const msg: ChatMessage = {
    id: crypto.randomUUID(),
    channel,
    senderId,
    senderName,
    text: text.slice(0, 500),
    kind,
    targetPlayerName,
    timestamp: Date.now(),
  };
  if (channel === 'public' || channel === 'system') {
    room.publicChat.push(msg);
    if (room.publicChat.length > 250) room.publicChat.shift();
  } else if (channel === 'mafia') {
    room.mafiaChat.push(msg);
    if (room.mafiaChat.length > 150) room.mafiaChat.shift();
  } else if (channel === 'dead') {
    room.deadChat.push(msg);
    if (room.deadChat.length > 150) room.deadChat.shift();
  }
}

export function createRoom(
  rooms: Map<string, ServerRoom>,
  gmName: string,
  roomName: string,
  avatar?: unknown
): { room: ServerRoom; gmPlayer: ServerPlayer } {
  const roomCode = makeRoomCode(rooms);
  const gmId = crypto.randomUUID();
  const gmPlayer: ServerPlayer = {
    id: gmId,
    name: gmName.trim().slice(0, 24) || 'Game Master',
    avatar: sanitizeAvatar(avatar),
    sessionToken: makeToken(),
    rejoinPin: makePin(),
    isGM: true,
    isOnline: false,
    isAlive: false, // GM is moderator/narrator, not a living target
    isReady: true,
    isMuted: false,
    canSpeak: true,
    role: 'Game Master',
    roleRevealed: true,
    eliminatedRound: null,
    eliminatedBy: null,
    detectiveHistory: [],
    lastProtectedId: null,
  };

  const room: ServerRoom = {
    roomCode,
    roomName: roomName.trim().slice(0, 40) || 'Nocturne Parlor',
    gmPlayerId: gmId,
    gmSecretToken: makeToken(),
    phase: 'LOBBY',
    round: 0,
    roundStartedAt: Date.now(),
    isPaused: false,
    phaseEndsAt: null,
    pausedRemainingMs: null,
    discussionEnded: false,
    completedRoundSteps: [],
    settings: defaultSettings(),
    customRoles: [],
    players: new Map([[gmId, gmPlayer]]),
    nightState: createEmptyNightState(),
    dayAnnouncement: null,
    votes: {},
    voteResult: null,
    lastRoundSummary: null,
    winner: null,
    publicChat: [],
    mafiaChat: [],
    deadChat: [],
    events: [],
    roundHistory: [],
    gmNotes: '',
    voicePeers: new Set(),
    currentRoundGmEvents: [],
    currentRoundDiscussionStart: null,
    currentRoundDiscussionSeconds: 0,
  };

  addEvent(room, 'public', `Room ${roomCode} opened by Game Master ${gmPlayer.name}.`);
  rooms.set(roomCode, room);
  return { room, gmPlayer };
}

export function joinRoom(
  room: ServerRoom,
  playerName: string,
  avatar: unknown,
  rejoinPin?: string,
  accountUid?: string
): { player?: ServerPlayer; error?: string; status?: number } {
  let cleanName = playerName.trim().slice(0, 24);
  if (!cleanName) {
    return { error: 'Player name is required.', status: 400 };
  }

  // 1. Reclaim seat by verified Google accountUid first
  let existing = accountUid
    ? Array.from(room.players.values()).find(
        (p) => !p.isGM && p.accountUid === accountUid
      )
    : undefined;

  // 2. Otherwise match by exact name (unless a different signed-in friend shares the same display name)
  if (!existing) {
    const nameMatch = Array.from(room.players.values()).find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (nameMatch) {
      const isDifferentSignedInUser = Boolean(
        !nameMatch.isGM &&
          accountUid &&
          nameMatch.accountUid &&
          nameMatch.accountUid !== accountUid
      );
      if (isDifferentSignedInUser) {
        // Two different signed-in friends share the same name: auto-suffix cleanly
        let suffix = 2;
        const base = cleanName.slice(0, 19);
        while (
          Array.from(room.players.values()).some(
            (p) => p.name.toLowerCase() === `${base} #${suffix}`.toLowerCase()
          )
        ) {
          suffix += 1;
        }
        cleanName = `${base} #${suffix}`;
      } else {
        existing = nameMatch;
      }
    }
  }

  if (existing) {
    if (existing.isGM) {
      if (rejoinPin && rejoinPin.trim() === existing.rejoinPin) {
        existing.avatar = sanitizeAvatar(avatar);
        return { player: existing };
      }
      return { error: 'That name belongs to the Game Master.', status: 409 };
    }
    if (existing.isOnline) {
      return { error: 'A player with that name is already active in this room.', status: 409 };
    }
    const uidMatches = Boolean(accountUid && existing.accountUid && existing.accountUid === accountUid);
    if (!uidMatches) {
      if (rejoinPin && rejoinPin.trim() !== existing.rejoinPin) {
        return { error: 'Incorrect Rejoin PIN for that player seat.', status: 403 };
      }
      if (!rejoinPin && room.phase !== 'LOBBY') {
        return {
          error: 'Match is in progress. Enter your 4-digit Rejoin PIN to reclaim your seat.',
          status: 403,
        };
      }
    }
    existing.avatar = sanitizeAvatar(avatar);
    if (accountUid && !existing.accountUid) {
      existing.accountUid = accountUid;
    }
    return { player: existing };
  }

  if (room.phase !== 'LOBBY') {
    return { error: 'Match already started. Only disconnected players can rejoin with their PIN.', status: 403 };
  }

  const nonGmCount = Array.from(room.players.values()).filter((p) => !p.isGM).length;
  if (nonGmCount >= room.settings.playerLimit) {
    return { error: `Room is full (limit ${room.settings.playerLimit} players).`, status: 403 };
  }

  const player: ServerPlayer = {
    id: crypto.randomUUID(),
    name: cleanName,
    avatar: sanitizeAvatar(avatar),
    accountUid: accountUid ? accountUid.slice(0, 128) : undefined,
    sessionToken: makeToken(),
    rejoinPin: makePin(),
    isGM: false,
    isOnline: false,
    isAlive: true,
    isReady: false,
    isMuted: false,
    canSpeak: true,
    role: null,
    roleRevealed: false,
    eliminatedRound: null,
    eliminatedBy: null,
    detectiveHistory: [],
    lastProtectedId: null,
  };

  room.players.set(player.id, player);
  addEvent(room, 'public', `${player.name} joined the parlor.`);
  return { player };
}

export function getMafiaConsensus(room: ServerRoom): string | null {
  const livingMafia = Array.from(room.players.values()).filter(
    (p) => !p.isGM && p.isAlive && p.role === 'Mafia'
  );
  if (livingMafia.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const m of livingMafia) {
    const pick = room.nightState.mafiaSelections[m.id];
    if (pick) {
      counts[pick] = (counts[pick] || 0) + 1;
    }
  }
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;
  if (entries.length > 1 && entries[0][1] === entries[1][1]) {
    // Tie among Mafia members: return first or null unless overridden by GM
    return room.nightState.mafiaFinalTargetId || entries[0][0];
  }
  return entries[0][0];
}

export function checkWinCondition(room: ServerRoom): { team: TeamAlignment; reason: string } | null {
  const living = Array.from(room.players.values()).filter((p) => !p.isGM && p.isAlive);
  const livingMafia = living.filter((p) => getRoleTeam(p.role, room.customRoles) === 'Mafia');
  const livingTown = living.filter((p) => getRoleTeam(p.role, room.customRoles) === 'Town');

  if (livingMafia.length === 0) {
    return {
      team: 'Town',
      reason: 'All Mafia members have been eliminated. The Town prevails.',
    };
  }

  if (room.settings.mafiaWinCondition === 'strict_majority') {
    if (livingMafia.length > livingTown.length) {
      return {
        team: 'Mafia',
        reason: `Mafia holds strict majority (${livingMafia.length} vs ${livingTown.length} Town).`,
      };
    }
  } else {
    if (livingMafia.length >= livingTown.length) {
      return {
        team: 'Mafia',
        reason: `Mafia equals or outnumbers the Town (${livingMafia.length} vs ${livingTown.length} Town).`,
      };
    }
  }

  if (room.settings.maxRounds > 0 && room.round >= room.settings.maxRounds && room.phase === 'ROUND_COMPLETE') {
    return {
      team: 'Town',
      reason: `Maximum round limit (${room.settings.maxRounds}) reached. Town survives.`,
    };
  }

  return null;
}

export function computeNightResolution(room: ServerRoom): void {
  const consensus = room.nightState.mafiaFinalTargetId ?? getMafiaConsensus(room);
  room.nightState.mafiaFinalTargetId = consensus;
  const bgTarget = room.nightState.bodyguardTargetId;
  const saved = Boolean(consensus && bgTarget && consensus === bgTarget);
  room.nightState.protectedTargetSaved = saved;
  room.nightState.computedVictimId = consensus && !saved ? consensus : null;
  if (room.nightState.gmOverrideVictimId !== undefined) {
    room.nightState.resolvedVictimId = room.nightState.gmOverrideVictimId;
  } else {
    room.nightState.resolvedVictimId = room.nightState.computedVictimId;
  }
  room.nightState.nightResolved = true;
}

export function computeVoteResult(room: ServerRoom): VoteResultSummary {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    counts[targetId] = (counts[targetId] || 0) + 1;
  }

  const playerEntries = Object.entries(counts)
    .filter(([k]) => k !== 'NO_VOTE')
    .sort((a, b) => b[1] - a[1]);

  let maxVotes = 0;
  let tiedPlayerIds: string[] = [];
  if (playerEntries.length > 0) {
    maxVotes = playerEntries[0][1];
    tiedPlayerIds = playerEntries.filter(([, c]) => c === maxVotes).map(([id]) => id);
  }

  const noVotes = counts['NO_VOTE'] || 0;
  // If No-Vote has strictly more votes than top candidate, nobody is eliminated
  const noVoteWins = noVotes > maxVotes;
  const isTie = !noVoteWins && tiedPlayerIds.length > 1;
  let eliminatedId: string | null = null;
  if (!noVoteWins && tiedPlayerIds.length === 1) {
    eliminatedId = tiedPlayerIds[0];
  }

  const targetPlayer = eliminatedId ? room.players.get(eliminatedId) : undefined;

  return {
    round: room.round,
    counts,
    totalVotes: Object.keys(room.votes).length,
    tiedPlayerIds: noVoteWins ? [] : tiedPlayerIds,
    isTie,
    eliminatedPlayerId: eliminatedId,
    eliminatedPlayerName: targetPlayer?.name ?? null,
    revealedRole: null,
    secretVoterMap: { ...room.votes },
  };
}

export function buildClientState(
  room: ServerRoom,
  viewerId: string,
  viewerIsGM: boolean
): ClientGameState {
  const viewer = room.players.get(viewerId);
  const viewerRole = viewer?.role ?? null;
  const viewerTeam = viewerIsGM ? null : getRoleTeam(viewerRole, room.customRoles);
  const viewerIsAlive = viewer?.isAlive ?? false;

  const mafiaTeammateCountIds = new Set(
    Array.from(room.players.values())
      .filter((p) => !p.isGM && p.role === 'Mafia')
      .map((p) => p.id)
  );

  // Strictly filtered players array
  const players: PublicPlayer[] = Array.from(room.players.values()).map((p) => {
    const isSelf = p.id === viewerId;
    const isDeadAndRevealed = !p.isAlive && p.roleRevealed;
    const isGameOver = room.phase === 'GAME_OVER';
    const isMafiaPartner =
      !viewerIsGM &&
      viewerRole === 'Mafia' &&
      room.settings.mafiaKnowEachOther &&
      p.role === 'Mafia';

    const canSeeRole =
      viewerIsGM || p.isGM || isSelf || isDeadAndRevealed || isGameOver || isMafiaPartner;

    let hasActedThisSubphase: boolean | undefined = undefined;
    if (viewerIsGM) {
      if (room.phase === 'NIGHT_MAFIA' && p.role === 'Mafia') {
        hasActedThisSubphase = Boolean(room.nightState.mafiaSelections[p.id]);
      } else if (room.phase === 'NIGHT_BODYGUARD' && p.role === 'Bodyguard') {
        hasActedThisSubphase = Boolean(room.nightState.bodyguardTargetId);
      } else if (room.phase === 'NIGHT_DETECTIVE' && p.role === 'Detective') {
        hasActedThisSubphase = Boolean(room.nightState.detectiveTargetId);
      }
    } else if (viewerRole === 'Mafia' && p.role === 'Mafia' && room.phase === 'NIGHT_MAFIA') {
      hasActedThisSubphase = Boolean(room.nightState.mafiaSelections[p.id]);
    }

    return {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      isGM: p.isGM,
      isOnline: p.isOnline,
      isAlive: p.isAlive,
      isReady: p.isReady,
      isMuted: p.isMuted,
      canSpeak: p.canSpeak,
      role: canSeeRole ? p.role : null,
      roleRevealed: p.roleRevealed,
      hasVotedThisRound:
        room.phase === 'DAY_VOTING' || room.phase === 'DAY_VOTE_RESULT'
          ? Boolean(room.votes[p.id])
          : false,
      hasActedThisSubphase,
      eliminatedRound: p.eliminatedRound,
      eliminatedBy: p.eliminatedBy,
    };
  });

  // Strictly filtered nightState
  let nightState: NightActionStateView | null = null;
  if (viewerIsGM) {
    nightState = {
      mafiaSelections: { ...room.nightState.mafiaSelections },
      mafiaConsensusTargetId: getMafiaConsensus(room),
      mafiaFinalTargetId: room.nightState.mafiaFinalTargetId,
      mafiaLocked: room.nightState.mafiaLocked,
      bodyguardTargetId: room.nightState.bodyguardTargetId,
      bodyguardLocked: room.nightState.bodyguardLocked,
      detectiveTargetId: room.nightState.detectiveTargetId,
      detectiveResultIsMafia: room.nightState.detectiveResultIsMafia,
      detectiveLocked: room.nightState.detectiveLocked,
      customActions: { ...room.nightState.customActions },
      protectedTargetSaved: room.nightState.protectedTargetSaved,
      computedVictimId: room.nightState.computedVictimId,
      gmOverrideVictimId: room.nightState.gmOverrideVictimId,
      resolvedVictimId: room.nightState.resolvedVictimId,
    };
  } else if (viewer && viewer.isAlive && !viewer.isGM) {
    if (viewerRole === 'Mafia' && (room.phase === 'NIGHT_MAFIA' || room.phase === 'NIGHT_INTRO')) {
      const visibleSelections: Record<string, string> = {};
      if (room.settings.mafiaTeamCommunication) {
        for (const [mId, tId] of Object.entries(room.nightState.mafiaSelections)) {
          if (mafiaTeammateCountIds.has(mId)) {
            visibleSelections[mId] = tId;
          }
        }
      } else if (room.nightState.mafiaSelections[viewerId]) {
        visibleSelections[viewerId] = room.nightState.mafiaSelections[viewerId];
      }
      nightState = {
        mafiaSelections: visibleSelections,
        mafiaConsensusTargetId: room.settings.mafiaTeamCommunication
          ? getMafiaConsensus(room)
          : room.nightState.mafiaSelections[viewerId] ?? null,
        mafiaFinalTargetId: room.nightState.mafiaFinalTargetId,
        mafiaLocked: room.nightState.mafiaLocked,
      };
    } else if (viewerRole === 'Bodyguard') {
      nightState = {
        bodyguardTargetId: room.nightState.bodyguardTargetId,
        bodyguardLocked: room.nightState.bodyguardLocked,
      };
    } else if (viewerRole === 'Detective') {
      nightState = {
        detectiveTargetId: room.nightState.detectiveTargetId,
        detectiveResultIsMafia: room.nightState.detectiveResultIsMafia,
        detectiveLocked: room.nightState.detectiveLocked,
        detectiveHistory: [...viewer.detectiveHistory],
      };
    } else {
      const custom = room.customRoles.find((c) => c.name === viewerRole);
      if (custom && custom.nightAction !== 'none' && room.phase === 'NIGHT_CUSTOM') {
        nightState = {
          customActions: room.nightState.customActions[viewerId]
            ? { [viewerId]: room.nightState.customActions[viewerId] }
            : {},
        };
      }
    }
  }

  // Strictly filtered voteResult
  let voteResult: VoteResultSummary | null = null;
  if (room.voteResult && (room.phase === 'DAY_VOTE_RESULT' || room.phase === 'ROUND_COMPLETE' || room.phase === 'GAME_OVER')) {
    const canSeeVoterMap =
      viewerIsGM || !room.settings.anonymousVoting;
    voteResult = {
      round: room.voteResult.round,
      counts: { ...room.voteResult.counts },
      totalVotes: room.voteResult.totalVotes,
      tiedPlayerIds: [...room.voteResult.tiedPlayerIds],
      isTie: room.voteResult.isTie,
      eliminatedPlayerId: room.voteResult.eliminatedPlayerId,
      eliminatedPlayerName: room.voteResult.eliminatedPlayerName,
      revealedRole: room.voteResult.revealedRole,
      secretVoterMap: canSeeVoterMap ? room.voteResult.secretVoterMap : undefined,
    };
  }

  // Strictly filtered round history
  const roundHistory: RoundHistoryEntry[] = room.roundHistory.map((entry) => {
    if (viewerIsGM) {
      return entry;
    }
    return {
      round: entry.round,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      nightVictimId: entry.nightVictimId,
      nightVictimName: entry.nightVictimName,
      nightVictimRoleRevealed: entry.nightVictimRoleRevealed,
      dayAnnouncementText: entry.dayAnnouncementText,
      discussionSecondsUsed: entry.discussionSecondsUsed,
      voteCounts: entry.voteCounts,
      voteEliminatedId: entry.voteEliminatedId,
      voteEliminatedName: entry.voteEliminatedName,
      voteEliminatedRoleRevealed: entry.voteEliminatedRoleRevealed,
      remainingAliveCount: entry.remainingAliveCount,
    };
  });

  const lastRoundSummary =
    room.lastRoundSummary && !viewerIsGM
      ? {
          round: room.lastRoundSummary.round,
          startedAt: room.lastRoundSummary.startedAt,
          endedAt: room.lastRoundSummary.endedAt,
          nightVictimId: room.lastRoundSummary.nightVictimId,
          nightVictimName: room.lastRoundSummary.nightVictimName,
          nightVictimRoleRevealed: room.lastRoundSummary.nightVictimRoleRevealed,
          dayAnnouncementText: room.lastRoundSummary.dayAnnouncementText,
          discussionSecondsUsed: room.lastRoundSummary.discussionSecondsUsed,
          voteCounts: room.lastRoundSummary.voteCounts,
          voteEliminatedId: room.lastRoundSummary.voteEliminatedId,
          voteEliminatedName: room.lastRoundSummary.voteEliminatedName,
          voteEliminatedRoleRevealed: room.lastRoundSummary.voteEliminatedRoleRevealed,
          remainingAliveCount: room.lastRoundSummary.remainingAliveCount,
        }
      : room.lastRoundSummary;

  const canSeeMafiaChat =
    viewerIsGM || (viewerRole === 'Mafia' && viewerIsAlive);
  const canSeeDeadChat =
    viewerIsGM || (Boolean(viewer) && !viewer!.isGM && !viewerIsAlive);

  const visibleVoicePeers = Array.from(room.voicePeers).filter((peerId) => {
    if (viewerIsGM) return true;
    const peer = room.players.get(peerId);
    if (!peer) return false;
    if (room.phase === 'NIGHT_MAFIA') {
      if (viewerRole === 'Mafia' && viewerIsAlive && room.settings.mafiaTeamCommunication) {
        return peer.isGM || (peer.isAlive && peer.role === 'Mafia');
      }
      return peer.isGM;
    }
    if (room.phase.startsWith('NIGHT_')) {
      return peer.isGM;
    }
    return true;
  });

  return {
    roomCode: room.roomCode,
    roomName: room.roomName,
    viewerId,
    viewerIsGM,
    viewerRole,
    viewerTeam,
    viewerIsAlive,
    phase: room.phase,
    round: room.round,
    isPaused: room.isPaused,
    phaseEndsAt: room.phaseEndsAt,
    pausedRemainingMs: room.pausedRemainingMs,
    completedRoundSteps: [...room.completedRoundSteps],
    settings: { ...room.settings, roleCounts: { ...room.settings.roleCounts } },
    customRoles: [...room.customRoles],
    players,
    nightState,
    dayAnnouncement: room.dayAnnouncement,
    myVoteTargetId: room.votes[viewerId] ?? null,
    voteResult,
    lastRoundSummary,
    winner: room.winner,
    publicChat: [...room.publicChat],
    mafiaChat: canSeeMafiaChat ? [...room.mafiaChat] : [],
    deadChat: canSeeDeadChat ? [...room.deadChat] : [],
    events: viewerIsGM
      ? [...room.events]
      : room.events.filter((e) => e.visibility === 'public'),
    roundHistory,
    gmNotes: viewerIsGM ? room.gmNotes : null,
    voicePeers: visibleVoicePeers,
  };
}

export function canPlayerTalkInVoice(
  room: ServerRoom,
  player: ServerPlayer
): { allowed: boolean; reason?: string } {
  if (!room.settings.voiceChatEnabled) {
    return { allowed: false, reason: 'Voice chat is disabled in Match Rules.' };
  }
  if (player.isGM) {
    return { allowed: true };
  }
  if (player.isMuted) {
    return { allowed: false, reason: 'You have been muted by the Game Master.' };
  }
  if (!player.canSpeak) {
    return { allowed: false, reason: 'The Game Master paused your speaking permission.' };
  }
  if (room.phase === 'LOBBY' || room.phase === 'GAME_OVER') {
    return { allowed: true };
  }
  if (!player.isAlive) {
    return { allowed: false, reason: 'Eliminated spectators cannot speak during active rounds.' };
  }
  if (room.phase === 'NIGHT_MAFIA') {
    if (player.role === 'Mafia' && room.settings.mafiaTeamCommunication) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Night silence is active while the parlor sleeps.' };
  }
  if (room.phase.startsWith('NIGHT_')) {
    return { allowed: false, reason: 'Night silence is active while roles take their turn.' };
  }
  return { allowed: true };
}

export function pruneDisallowedVoicePeers(room: ServerRoom): void {
  for (const peerId of Array.from(room.voicePeers)) {
    const player = room.players.get(peerId);
    if (!player || !player.isOnline || !canPlayerTalkInVoice(room, player).allowed) {
      room.voicePeers.delete(peerId);
    }
  }
}

export function canRelayVoiceSignal(
  room: ServerRoom,
  fromPlayer: ServerPlayer,
  toPlayer: ServerPlayer
): boolean {
  if (!room.settings.voiceChatEnabled) return false;
  if (fromPlayer.id === toPlayer.id) return false;
  if (room.phase === 'NIGHT_MAFIA') {
    if (fromPlayer.isGM) return true;
    const fromIsAllowedMafia =
      room.settings.mafiaTeamCommunication &&
      fromPlayer.isAlive &&
      fromPlayer.role === 'Mafia' &&
      !fromPlayer.isMuted &&
      fromPlayer.canSpeak;
    const toIsMafiaOrGm =
      toPlayer.isGM || (toPlayer.isAlive && toPlayer.role === 'Mafia');
    return (fromIsAllowedMafia && toIsMafiaOrGm) || toPlayer.isGM;
  }
  if (room.phase.startsWith('NIGHT_')) {
    return fromPlayer.isGM || (toPlayer.isGM && room.voicePeers.has(toPlayer.id));
  }
  return true;
}

