export type BuiltInRole = 'Mafia' | 'Detective' | 'Bodyguard' | 'Villager';

export type TeamAlignment = 'Town' | 'Mafia' | 'Neutral';

export type NightActionKind = 'none' | 'eliminate' | 'protect' | 'investigate' | 'custom';

export interface CustomRoleDefinition {
  id: string;
  name: string;
  team: TeamAlignment;
  description: string;
  nightAction: NightActionKind;
  appearsAsMafia: boolean;
  winConditionNote?: string;
}

export type GamePhase =
  | 'LOBBY'
  | 'ROUND_READY'
  | 'NIGHT_INTRO'
  | 'NIGHT_MAFIA'
  | 'NIGHT_BODYGUARD'
  | 'NIGHT_DETECTIVE'
  | 'NIGHT_CUSTOM'
  | 'NIGHT_RESOLVE'
  | 'DAY_ANNOUNCE'
  | 'DAY_DISCUSSION'
  | 'DAY_VOTING'
  | 'DAY_VOTE_RESULT'
  | 'ROUND_COMPLETE'
  | 'GAME_OVER';

export type TieRule = 'revote' | 'no_elimination' | 'tie_breaker' | 'manual';

export type MafiaWinCondition = 'equal_or_more' | 'strict_majority';

export interface GameSettings {
  playerLimit: number;
  maxRounds: number; // 0 = unlimited
  roleCounts: Record<string, number>;
  nightDuration: number;
  discussionDuration: number;
  votingDuration: number;
  revealRoleOnElimination: boolean;
  anonymousVoting: boolean;
  allowVoteChange: boolean;
  allowNoVote: boolean;
  tieRule: TieRule;
  mafiaTeamCommunication: boolean;
  mafiaKnowEachOther: boolean;
  mafiaWinCondition: MafiaWinCondition;
  bodyguardSelfProtect: boolean;
  bodyguardConsecutiveProtect: boolean;
  allowGmNightOverride: boolean;
  voiceChatEnabled: boolean;
  spectatorModeEnabled: boolean;
  deadChatEnabled: boolean;
  customAnnouncementsEnabled: boolean;
  progressionMode: 'manual' | 'assisted_timers';
}

export type AvatarId =
  | 'lantern'
  | 'fedora'
  | 'magnifying'
  | 'shield'
  | 'rose'
  | 'pocketwatch'
  | 'key'
  | 'raven'
  | 'compass'
  | 'quill'
  | 'chalice'
  | 'mask';

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: AvatarId;
  isGM: boolean;
  isOnline: boolean;
  isAlive: boolean;
  isReady: boolean;
  isMuted: boolean;
  canSpeak: boolean;
  role: string | null; // Strictly filtered server-side! Null unless viewer is authorized to see it
  roleRevealed: boolean;
  hasVotedThisRound: boolean;
  hasActedThisSubphase?: boolean; // Only populated for GM or authorized night teammates
  eliminatedRound: number | null;
  eliminatedBy: 'night' | 'vote' | 'gm' | null;
}

export interface ChatMessage {
  id: string;
  channel: 'public' | 'mafia' | 'dead' | 'system';
  senderId: string;
  senderName: string;
  text: string;
  kind: 'chat' | 'accuse' | 'defend' | 'quick' | 'reaction' | 'announcement';
  targetPlayerName?: string;
  timestamp: number;
}

export interface DetectiveInvestigationRecord {
  round: number;
  targetId: string;
  targetName: string;
  isMafia: boolean;
}

export interface NightActionStateView {
  mafiaSelections?: Record<string, string>; // mafiaPlayerId -> targetPlayerId
  mafiaConsensusTargetId?: string | null;
  mafiaFinalTargetId?: string | null;
  mafiaLocked?: boolean;
  bodyguardTargetId?: string | null;
  bodyguardLocked?: boolean;
  detectiveTargetId?: string | null;
  detectiveResultIsMafia?: boolean | null;
  detectiveLocked?: boolean;
  customActions?: Record<string, { roleName: string; targetId: string | null; note?: string }>;
  protectedTargetSaved?: boolean;
  computedVictimId?: string | null;
  gmOverrideVictimId?: string | null | undefined; // undefined = no override, null = force no kill, string = force victim
  resolvedVictimId?: string | null;
  detectiveHistory?: DetectiveInvestigationRecord[];
}

export interface DayAnnouncement {
  round: number;
  headline: string;
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  revealedRole: string | null;
  customText: string | null;
}

export interface VoteResultSummary {
  round: number;
  counts: Record<string, number>; // targetId ('NO_VOTE' for skip) -> vote count
  totalVotes: number;
  tiedPlayerIds: string[];
  isTie: boolean;
  eliminatedPlayerId: string | null;
  eliminatedPlayerName: string | null;
  revealedRole: string | null;
  secretVoterMap?: Record<string, string>; // Only sent to GM, OR to all if public voting & round ended
}

export interface RoundHistoryEntry {
  round: number;
  startedAt: number;
  endedAt: number | null;
  // Secret fields (strictly stripped for ordinary players!)
  mafiaTargetId?: string | null;
  mafiaTargetName?: string | null;
  bodyguardTargetId?: string | null;
  bodyguardTargetName?: string | null;
  detectiveTargetId?: string | null;
  detectiveTargetName?: string | null;
  detectiveResultIsMafia?: boolean | null;
  nightProtectedSaved?: boolean;
  // Public fields
  nightVictimId: string | null;
  nightVictimName: string | null;
  nightVictimRoleRevealed: string | null;
  dayAnnouncementText: string;
  discussionSecondsUsed: number;
  voteCounts: Record<string, number>;
  voteEliminatedId: string | null;
  voteEliminatedName: string | null;
  voteEliminatedRoleRevealed: string | null;
  remainingAliveCount: number;
  gmEvents?: string[];
}

export interface GameEventLog {
  id: string;
  round: number;
  phase: GamePhase;
  visibility: 'public' | 'gm_only';
  message: string;
  timestamp: number;
}

export interface ClientGameState {
  roomCode: string;
  roomName: string;
  viewerId: string;
  viewerIsGM: boolean;
  viewerRole: string | null;
  viewerTeam: TeamAlignment | null;
  viewerIsAlive: boolean;
  phase: GamePhase;
  round: number;
  isPaused: boolean;
  phaseEndsAt: number | null;
  pausedRemainingMs: number | null;
  completedRoundSteps: string[];
  settings: GameSettings;
  customRoles: CustomRoleDefinition[];
  players: PublicPlayer[];
  nightState: NightActionStateView | null;
  dayAnnouncement: DayAnnouncement | null;
  myVoteTargetId: string | null;
  voteResult: VoteResultSummary | null;
  lastRoundSummary: RoundHistoryEntry | null;
  winner: { team: TeamAlignment; reason: string } | null;
  publicChat: ChatMessage[];
  mafiaChat: ChatMessage[]; // Only populated for GM & living Mafia
  deadChat: ChatMessage[]; // Only populated for GM & eliminated players
  events: GameEventLog[]; // Filtered server-side: public events for players, all for GM
  roundHistory: RoundHistoryEntry[]; // Secret fields stripped server-side for players
  gmNotes: string | null; // Strictly null for players
  voicePeers: string[]; // Player IDs currently active in voice chat
}

export interface ClientToServerMessage {
  type:
    | 'AUTH'
    | 'READY_TOGGLE'
    | 'CHAT_SEND'
    | 'NIGHT_ACTION'
    | 'CAST_VOTE'
    | 'VOICE_STATE'
    | 'RTC_SIGNAL'
    | 'GM_ACTION';
  payload: Record<string, unknown>;
}

export interface ServerToClientMessage {
  type: 'STATE_SYNC' | 'ERROR' | 'TOAST' | 'RTC_SIGNAL';
  payload: unknown;
}
