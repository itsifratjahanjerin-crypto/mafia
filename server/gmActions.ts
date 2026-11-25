import crypto from 'crypto';
import {
  addChat,
  addEvent,
  checkWinCondition,
  computeNightResolution,
  computeVoteResult,
  createEmptyNightState,
  doesRoleAppearAsMafia,
  getMafiaConsensus,
  type ServerPlayer,
  type ServerRoom,
} from './gameEngine.ts';
import type { CustomRoleDefinition, GameSettings, TeamAlignment } from '../src/shared/types.ts';

function markStep(room: ServerRoom, step: string): void {
  if (!room.completedRoundSteps.includes(step)) {
    room.completedRoundSteps.push(step);
  }
}

function recordDiscussionTime(room: ServerRoom): void {
  if (room.currentRoundDiscussionStart) {
    const elapsed = Math.max(
      0,
      Math.round((Date.now() - room.currentRoundDiscussionStart) / 1000)
    );
    room.currentRoundDiscussionSeconds += elapsed;
    room.currentRoundDiscussionStart = null;
  }
}

function getLivingNonGm(room: ServerRoom): ServerPlayer[] {
  return Array.from(room.players.values()).filter((p) => !p.isGM && p.isAlive);
}

function finalizeRoundEntry(room: ServerRoom): void {
  const nightVictim = room.nightState.resolvedVictimId
    ? room.players.get(room.nightState.resolvedVictimId)
    : undefined;
  const mafiaTarget = room.nightState.mafiaFinalTargetId
    ? room.players.get(room.nightState.mafiaFinalTargetId)
    : undefined;
  const bgTarget = room.nightState.bodyguardTargetId
    ? room.players.get(room.nightState.bodyguardTargetId)
    : undefined;
  const detTarget = room.nightState.detectiveTargetId
    ? room.players.get(room.nightState.detectiveTargetId)
    : undefined;
  const voteVictim = room.voteResult?.eliminatedPlayerId
    ? room.players.get(room.voteResult.eliminatedPlayerId)
    : undefined;

  const entry = {
    round: room.round,
    startedAt: room.roundStartedAt,
    endedAt: Date.now(),
    mafiaTargetId: mafiaTarget?.id ?? null,
    mafiaTargetName: mafiaTarget?.name ?? null,
    bodyguardTargetId: bgTarget?.id ?? null,
    bodyguardTargetName: bgTarget?.name ?? null,
    detectiveTargetId: detTarget?.id ?? null,
    detectiveTargetName: detTarget?.name ?? null,
    detectiveResultIsMafia: room.nightState.detectiveResultIsMafia,
    nightProtectedSaved: room.nightState.protectedTargetSaved,
    nightVictimId: nightVictim?.id ?? null,
    nightVictimName: nightVictim?.name ?? null,
    nightVictimRoleRevealed:
      nightVictim && nightVictim.roleRevealed ? nightVictim.role : null,
    dayAnnouncementText:
      room.dayAnnouncement?.headline || 'Daylight broke over the parlor.',
    discussionSecondsUsed: room.currentRoundDiscussionSeconds,
    voteCounts: room.voteResult ? { ...room.voteResult.counts } : {},
    voteEliminatedId: voteVictim?.id ?? null,
    voteEliminatedName: voteVictim?.name ?? null,
    voteEliminatedRoleRevealed:
      voteVictim && voteVictim.roleRevealed ? voteVictim.role : null,
    remainingAliveCount: getLivingNonGm(room).length,
    gmEvents: [...room.currentRoundGmEvents],
  };

  // Idempotent replace if already recorded for this round
  const idx = room.roundHistory.findIndex((r) => r.round === room.round);
  if (idx >= 0) {
    room.roundHistory[idx] = entry;
  } else {
    room.roundHistory.push(entry);
  }
  room.lastRoundSummary = entry;
}

export function handleGmAction(
  room: ServerRoom,
  action: string,
  payload: Record<string, unknown>
): { error?: string; toast?: string } {
  switch (action) {
    case 'UPDATE_SETTINGS': {
      const partial = payload.settings as Partial<GameSettings> | undefined;
      if (!partial) return { error: 'Missing settings payload.' };
      if (typeof partial.playerLimit === 'number') {
        room.settings.playerLimit = Math.max(3, Math.min(24, Math.floor(partial.playerLimit)));
      }
      if (typeof partial.maxRounds === 'number') {
        room.settings.maxRounds = Math.max(0, Math.min(50, Math.floor(partial.maxRounds)));
      }
      if (partial.roleCounts && typeof partial.roleCounts === 'object') {
        const cleaned: Record<string, number> = {};
        for (const [k, v] of Object.entries(partial.roleCounts)) {
          if (typeof v === 'number' && v >= 0 && v <= 24) {
            cleaned[k] = Math.floor(v);
          }
        }
        room.settings.roleCounts = { ...room.settings.roleCounts, ...cleaned };
      }
      if (typeof partial.nightDuration === 'number') {
        room.settings.nightDuration = Math.max(10, Math.min(300, Math.floor(partial.nightDuration)));
      }
      if (typeof partial.discussionDuration === 'number') {
        room.settings.discussionDuration = Math.max(15, Math.min(600, Math.floor(partial.discussionDuration)));
      }
      if (typeof partial.votingDuration === 'number') {
        room.settings.votingDuration = Math.max(15, Math.min(300, Math.floor(partial.votingDuration)));
      }
      const boolKeys: (keyof GameSettings)[] = [
        'revealRoleOnElimination',
        'anonymousVoting',
        'allowVoteChange',
        'allowNoVote',
        'mafiaTeamCommunication',
        'mafiaKnowEachOther',
        'bodyguardSelfProtect',
        'bodyguardConsecutiveProtect',
        'allowGmNightOverride',
        'voiceChatEnabled',
        'spectatorModeEnabled',
        'deadChatEnabled',
        'customAnnouncementsEnabled',
      ];
      for (const bk of boolKeys) {
        if (typeof partial[bk] === 'boolean') {
          (room.settings as unknown as Record<string, unknown>)[bk] = partial[bk];
        }
      }
      if (
        partial.tieRule === 'revote' ||
        partial.tieRule === 'no_elimination' ||
        partial.tieRule === 'tie_breaker' ||
        partial.tieRule === 'manual'
      ) {
        room.settings.tieRule = partial.tieRule;
      }
      if (
        partial.mafiaWinCondition === 'equal_or_more' ||
        partial.mafiaWinCondition === 'strict_majority'
      ) {
        room.settings.mafiaWinCondition = partial.mafiaWinCondition;
      }
      if (
        partial.progressionMode === 'manual' ||
        partial.progressionMode === 'assisted_timers'
      ) {
        room.settings.progressionMode = partial.progressionMode;
      }
      addEvent(room, 'gm_only', 'Game Master updated match rules.');
      return { toast: 'Match settings updated.' };
    }

    case 'ADD_CUSTOM_ROLE': {
      if (room.phase !== 'LOBBY') {
        return { error: 'Custom roles can only be added in the Lobby.' };
      }
      const name = String(payload.name || '').trim().slice(0, 28);
      if (!name) return { error: 'Role name is required.' };
      if (
        ['Mafia', 'Detective', 'Bodyguard', 'Villager', 'Game Master'].includes(name) ||
        room.customRoles.some((r) => r.name.toLowerCase() === name.toLowerCase())
      ) {
        return { error: 'A role with that name already exists.' };
      }
      const team =
        payload.team === 'Mafia' || payload.team === 'Neutral' ? payload.team : 'Town';
      const nightAction =
        payload.nightAction === 'investigate' ||
        payload.nightAction === 'protect' ||
        payload.nightAction === 'eliminate' ||
        payload.nightAction === 'custom'
          ? payload.nightAction
          : 'none';
      const custom: CustomRoleDefinition = {
        id: crypto.randomUUID(),
        name,
        team,
        description:
          String(payload.description || '').trim().slice(0, 240) ||
          'Custom parlor role defined by the Game Master.',
        nightAction,
        appearsAsMafia: Boolean(payload.appearsAsMafia),
        winConditionNote: String(payload.winConditionNote || '').trim().slice(0, 160) || undefined,
      };
      room.customRoles.push(custom);
      room.settings.roleCounts[custom.name] = room.settings.roleCounts[custom.name] ?? 0;
      addEvent(room, 'gm_only', `Added custom role "${custom.name}" (${custom.team}).`);
      return { toast: `Custom role "${custom.name}" created.` };
    }

    case 'DELETE_CUSTOM_ROLE': {
      if (room.phase !== 'LOBBY') {
        return { error: 'Custom roles can only be removed in the Lobby.' };
      }
      const roleId = String(payload.roleId || '');
      const idx = room.customRoles.findIndex((r) => r.id === roleId);
      if (idx === -1) return { error: 'Custom role not found.' };
      const [removed] = room.customRoles.splice(idx, 1);
      delete room.settings.roleCounts[removed.name];
      for (const p of room.players.values()) {
        if (p.role === removed.name) p.role = null;
      }
      return { toast: `Removed custom role "${removed.name}".` };
    }

    case 'ASSIGN_ROLE': {
      if (room.phase !== 'LOBBY') {
        return { error: 'Roles can only be reassigned before the match starts.' };
      }
      const playerId = String(payload.playerId || '');
      const role = payload.role ? String(payload.role) : null;
      const target = room.players.get(playerId);
      if (!target || target.isGM) {
        return { error: 'Target player not found.' };
      }
      target.role = role;
      addEvent(
        room,
        'gm_only',
        `Assigned ${target.name} → ${role ?? 'Unassigned'}.`
      );
      return {};
    }

    case 'AUTO_ASSIGN_ROLES': {
      if (room.phase !== 'LOBBY') {
        return { error: 'Roles can only be assigned in the Lobby.' };
      }
      const nonGm = Array.from(room.players.values()).filter((p) => !p.isGM);
      if (nonGm.length === 0) return { error: 'No players have joined yet.' };
      const pool: string[] = [];
      for (const [roleName, count] of Object.entries(room.settings.roleCounts)) {
        for (let i = 0; i < count; i++) {
          pool.push(roleName);
        }
      }
      while (pool.length < nonGm.length) {
        pool.push('Villager');
      }
      const trimmed = pool.slice(0, nonGm.length);
      // Fisher-Yates shuffle
      for (let i = trimmed.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [trimmed[i], trimmed[j]] = [trimmed[j], trimmed[i]];
      }
      nonGm.forEach((p, i) => {
        p.role = trimmed[i];
      });
      addEvent(room, 'gm_only', 'Game Master distributed configured roles across all players.');
      return { toast: 'Roles distributed. You may still adjust any player manually.' };
    }

    case 'START_GAME': {
      if (room.phase !== 'LOBBY') {
        return { error: 'Game has already started.' };
      }
      const nonGm = Array.from(room.players.values()).filter((p) => !p.isGM);
      if (nonGm.length < 2) {
        return { error: 'At least 2 players must join before starting the match.' };
      }
      const unassigned = nonGm.filter((p) => !p.role);
      if (unassigned.length > 0) {
        return {
          error: `Assign roles to all players first (${unassigned.map((p) => p.name).join(', ')} unassigned).`,
        };
      }
      for (const p of nonGm) {
        p.isAlive = true;
        p.roleRevealed = false;
        p.eliminatedRound = null;
        p.eliminatedBy = null;
        p.detectiveHistory = [];
        p.lastProtectedId = null;
      }
      room.round = 1;
      room.roundStartedAt = Date.now();
      room.isPaused = false;
      room.phaseEndsAt = null;
      room.pausedRemainingMs = null;
      room.nightState = createEmptyNightState();
      room.dayAnnouncement = null;
      room.votes = {};
      room.voteResult = null;
      room.winner = null;
      room.roundHistory = [];
      room.lastRoundSummary = null;
      room.currentRoundGmEvents = [];
      room.currentRoundDiscussionSeconds = 0;
      room.completedRoundSteps = [];
      room.phase = 'NIGHT_INTRO';
      addEvent(room, 'public', 'Match started. Round 1 Night has begun.');
      addEvent(
        room,
        'gm_only',
        `Roster locked: ${nonGm.map((p) => `${p.name} (${p.role})`).join(', ')}`
      );
      addChat(
        room,
        'system',
        room.gmPlayerId,
        'Parlor Narrator',
        '🌙 NIGHT HAS BEGUN. EVERYONE CLOSE YOUR EYES.',
        'announcement'
      );
      return { toast: 'Round 1 started.' };
    }

    case 'START_NIGHT': {
      if (room.phase === 'GAME_OVER' || room.phase === 'LOBBY') {
        return { error: 'Cannot start night in current state.' };
      }
      room.phase = 'NIGHT_INTRO';
      room.phaseEndsAt = null;
      addEvent(room, 'public', `Round ${room.round} Night Phase active.`);
      return {};
    }

    case 'CALL_MAFIA': {
      if (!['NIGHT_INTRO', 'NIGHT_MAFIA', 'NIGHT_BODYGUARD', 'NIGHT_DETECTIVE', 'NIGHT_CUSTOM'].includes(room.phase)) {
        return { error: 'You can only call Mafia during the Night Phase.' };
      }
      room.phase = 'NIGHT_MAFIA';
      room.nightState.mafiaLocked = false;
      room.phaseEndsAt =
        room.settings.progressionMode === 'assisted_timers'
          ? Date.now() + room.settings.nightDuration * 1000
          : null;
      addEvent(room, 'gm_only', `Round ${room.round}: Game Master called Mafia.`);
      return {};
    }

    case 'GM_SET_MAFIA_TARGET': {
      const targetId = payload.targetId ? String(payload.targetId) : null;
      if (targetId) {
        const target = room.players.get(targetId);
        if (!target || target.isGM || !target.isAlive) {
          return { error: 'Invalid living target.' };
        }
        room.nightState.mafiaFinalTargetId = targetId;
        addEvent(room, 'gm_only', `GM set Mafia target to ${target.name}.`);
      } else {
        room.nightState.mafiaFinalTargetId = null;
      }
      return {};
    }

    case 'MAFIA_SLEEP': {
      if (room.phase !== 'NIGHT_MAFIA') {
        return { error: 'Mafia is not currently awake.' };
      }
      room.nightState.mafiaFinalTargetId =
        room.nightState.mafiaFinalTargetId ?? getMafiaConsensus(room);
      room.nightState.mafiaLocked = true;
      room.phaseEndsAt = null;
      markStep(room, 'mafia');
      room.phase = 'NIGHT_INTRO';
      const tName = room.nightState.mafiaFinalTargetId
        ? room.players.get(room.nightState.mafiaFinalTargetId)?.name
        : 'No target selected';
      addEvent(room, 'gm_only', `Round ${room.round}: Mafia went to sleep (Target: ${tName}).`);
      return {};
    }

    case 'CALL_BODYGUARD': {
      if (!['NIGHT_INTRO', 'NIGHT_MAFIA', 'NIGHT_BODYGUARD', 'NIGHT_DETECTIVE', 'NIGHT_CUSTOM'].includes(room.phase)) {
        return { error: 'You can only call Bodyguard during the Night Phase.' };
      }
      room.phase = 'NIGHT_BODYGUARD';
      room.nightState.bodyguardLocked = false;
      room.phaseEndsAt =
        room.settings.progressionMode === 'assisted_timers'
          ? Date.now() + room.settings.nightDuration * 1000
          : null;
      addEvent(room, 'gm_only', `Round ${room.round}: Game Master called Bodyguard.`);
      return {};
    }

    case 'BODYGUARD_SLEEP': {
      if (room.phase !== 'NIGHT_BODYGUARD') {
        return { error: 'Bodyguard is not currently awake.' };
      }
      room.nightState.bodyguardLocked = true;
      room.phaseEndsAt = null;
      markStep(room, 'bodyguard');
      // Save lastProtectedId on living Bodyguard(s)
      for (const p of room.players.values()) {
        if (!p.isGM && p.isAlive && p.role === 'Bodyguard') {
          p.lastProtectedId = room.nightState.bodyguardTargetId;
        }
      }
      room.phase = 'NIGHT_INTRO';
      const bName = room.nightState.bodyguardTargetId
        ? room.players.get(room.nightState.bodyguardTargetId)?.name
        : 'No protection selected';
      addEvent(room, 'gm_only', `Round ${room.round}: Bodyguard went to sleep (Protected: ${bName}).`);
      return {};
    }

    case 'CALL_DETECTIVE': {
      if (!['NIGHT_INTRO', 'NIGHT_MAFIA', 'NIGHT_BODYGUARD', 'NIGHT_DETECTIVE', 'NIGHT_CUSTOM'].includes(room.phase)) {
        return { error: 'You can only call Detective during the Night Phase.' };
      }
      room.phase = 'NIGHT_DETECTIVE';
      room.nightState.detectiveLocked = false;
      room.phaseEndsAt =
        room.settings.progressionMode === 'assisted_timers'
          ? Date.now() + room.settings.nightDuration * 1000
          : null;
      addEvent(room, 'gm_only', `Round ${room.round}: Game Master called Detective.`);
      return {};
    }

    case 'DETECTIVE_SLEEP': {
      if (room.phase !== 'NIGHT_DETECTIVE') {
        return { error: 'Detective is not currently awake.' };
      }
      room.nightState.detectiveLocked = true;
      room.phaseEndsAt = null;
      markStep(room, 'detective');
      room.phase = 'NIGHT_INTRO';
      const dName = room.nightState.detectiveTargetId
        ? room.players.get(room.nightState.detectiveTargetId)?.name
        : 'No investigation';
      addEvent(
        room,
        'gm_only',
        `Round ${room.round}: Detective went to sleep (Investigated: ${dName}).`
      );
      return {};
    }

    case 'CALL_CUSTOM_NIGHT': {
      room.phase = 'NIGHT_CUSTOM';
      addEvent(room, 'gm_only', `Round ${room.round}: Game Master called Custom Night Roles.`);
      return {};
    }

    case 'CUSTOM_NIGHT_SLEEP': {
      markStep(room, 'custom_night');
      room.phase = 'NIGHT_INTRO';
      return {};
    }

    case 'RESOLVE_NIGHT': {
      if (!room.phase.startsWith('NIGHT_')) {
        return { error: 'Night can only be resolved from the Night Phase.' };
      }
      room.nightState.mafiaLocked = true;
      room.nightState.bodyguardLocked = true;
      room.nightState.detectiveLocked = true;
      computeNightResolution(room);
      markStep(room, 'night');
      room.phase = 'NIGHT_RESOLVE';
      room.phaseEndsAt = null;
      const victimName = room.nightState.resolvedVictimId
        ? room.players.get(room.nightState.resolvedVictimId)?.name
        : 'None';
      addEvent(
        room,
        'gm_only',
        `Night resolved — Saved: ${room.nightState.protectedTargetSaved ? 'Yes' : 'No'} · Victim: ${victimName}.`
      );
      return {};
    }

    case 'OVERRIDE_NIGHT_OUTCOME': {
      if (!room.settings.allowGmNightOverride) {
        return { error: 'Manual Night Override is disabled in Match Settings.' };
      }
      const victimId = payload.victimId ? String(payload.victimId) : null;
      if (victimId) {
        const target = room.players.get(victimId);
        if (!target || target.isGM || !target.isAlive) {
          return { error: 'Selected override target is not a living player.' };
        }
      }
      room.nightState.gmOverrideVictimId = victimId;
      computeNightResolution(room);
      const name = victimId ? room.players.get(victimId)?.name : 'Nobody (Forced Survival)';
      addEvent(room, 'gm_only', `GM overrode Night outcome → ${name}.`);
      return { toast: 'Night outcome updated.' };
    }

    case 'START_DAY': {
      if (!room.nightState.nightResolved) {
        computeNightResolution(room);
      }
      if (!room.nightState.appliedToDay && room.nightState.resolvedVictimId) {
        const victim = room.players.get(room.nightState.resolvedVictimId);
        if (victim && victim.isAlive) {
          victim.isAlive = false;
          victim.eliminatedRound = room.round;
          victim.eliminatedBy = 'night';
          victim.roleRevealed = false;
          room.voicePeers.delete(victim.id);
        }
        room.nightState.appliedToDay = true;
      }
      markStep(room, 'day');
      room.phase = 'DAY_ANNOUNCE';
      room.phaseEndsAt = null;
      room.dayAnnouncement = {
        round: room.round,
        headline: '☀️ DAY HAS BEGUN. EVERYONE OPEN YOUR EYES.',
        eliminatedPlayerId: null,
        eliminatedPlayerName: null,
        revealedRole: null,
        customText: null,
      };
      addEvent(room, 'public', `Round ${room.round} Day Phase began.`);
      addChat(
        room,
        'system',
        room.gmPlayerId,
        'Parlor Narrator',
        '☀️ DAY HAS BEGUN. EVERYONE OPEN YOUR EYES.',
        'announcement'
      );
      return {};
    }

    case 'ANNOUNCE_DAY': {
      if (room.phase !== 'DAY_ANNOUNCE' && room.phase !== 'DAY_DISCUSSION') {
        return { error: 'Day announcements can only be posted during Day Phase.' };
      }
      const mode = payload.mode === 'eliminated' || payload.mode === 'custom' ? payload.mode : 'none';
      const revealRole = Boolean(payload.revealRole);
      const customText =
        room.settings.customAnnouncementsEnabled && payload.customText
          ? String(payload.customText).trim().slice(0, 300)
          : null;

      const victim = room.nightState.resolvedVictimId
        ? room.players.get(room.nightState.resolvedVictimId)
        : undefined;

      let headline = 'A quiet dawn: nobody was eliminated during the night.';
      let announcedVictimId: string | null = null;
      let announcedVictimName: string | null = null;
      let revealedRole: string | null = null;

      if (mode === 'eliminated' && victim) {
        victim.roleRevealed = revealRole;
        announcedVictimId = victim.id;
        announcedVictimName = victim.name;
        revealedRole = revealRole ? victim.role : null;
        headline = revealRole
          ? `${victim.name} was eliminated during the night. Their role was ${victim.role}.`
          : `${victim.name} was eliminated during the night. Their role remains hidden.`;
      } else if (mode === 'custom' && customText) {
        headline = customText;
        if (victim && revealRole) {
          victim.roleRevealed = true;
          announcedVictimId = victim.id;
          announcedVictimName = victim.name;
          revealedRole = victim.role;
        }
      }

      room.dayAnnouncement = {
        round: room.round,
        headline,
        eliminatedPlayerId: announcedVictimId,
        eliminatedPlayerName: announcedVictimName,
        revealedRole,
        customText,
      };

      addEvent(room, 'public', headline);
      addChat(room, 'system', room.gmPlayerId, 'Parlor Narrator', headline, 'announcement');

      // Check immediate win condition after night kill announcement
      const win = checkWinCondition(room);
      if (win) {
        finalizeRoundEntry(room);
        room.winner = win;
        room.phase = 'GAME_OVER';
        for (const p of room.players.values()) p.roleRevealed = true;
        addEvent(room, 'public', `Match ended: ${win.reason}`);
      }
      return { toast: 'Day announcement published.' };
    }

    case 'START_DISCUSSION': {
      if (room.phase !== 'DAY_ANNOUNCE' && room.phase !== 'DAY_DISCUSSION') {
        return { error: 'Cannot start discussion in current phase.' };
      }
      room.phase = 'DAY_DISCUSSION';
      room.discussionEnded = false;
      room.isPaused = false;
      room.pausedRemainingMs = null;
      room.currentRoundDiscussionStart = Date.now();
      room.phaseEndsAt = Date.now() + room.settings.discussionDuration * 1000;
      addEvent(
        room,
        'public',
        `Round ${room.round} Discussion started (${room.settings.discussionDuration}s).`
      );
      return {};
    }

    case 'END_DISCUSSION': {
      if (room.phase !== 'DAY_DISCUSSION') {
        return { error: 'Discussion is not currently active.' };
      }
      recordDiscussionTime(room);
      room.discussionEnded = true;
      room.phaseEndsAt = null;
      room.isPaused = false;
      room.pausedRemainingMs = null;
      markStep(room, 'discussion');
      addEvent(room, 'public', `Round ${room.round} Discussion ended.`);
      return {};
    }

    case 'START_VOTING': {
      if (!['DAY_ANNOUNCE', 'DAY_DISCUSSION', 'DAY_VOTE_RESULT'].includes(room.phase)) {
        return { error: 'Cannot start voting from current phase.' };
      }
      recordDiscussionTime(room);
      markStep(room, 'discussion');
      room.votes = {};
      room.voteResult = null;
      room.phase = 'DAY_VOTING';
      room.isPaused = false;
      room.pausedRemainingMs = null;
      room.phaseEndsAt = Date.now() + room.settings.votingDuration * 1000;
      addEvent(room, 'public', `Round ${room.round} Voting began.`);
      addChat(
        room,
        'system',
        room.gmPlayerId,
        'Parlor Narrator',
        `🗳️ Voting is open for Round ${room.round}. Living players may cast their ballot.`,
        'announcement'
      );
      return {};
    }

    case 'END_VOTING': {
      if (room.phase !== 'DAY_VOTING') {
        return { error: 'Voting is not currently active.' };
      }
      room.phaseEndsAt = null;
      room.isPaused = false;
      room.pausedRemainingMs = null;
      room.voteResult = computeVoteResult(room);
      room.phase = 'DAY_VOTE_RESULT';
      markStep(room, 'voting');
      addEvent(
        room,
        'public',
        `Round ${room.round} Voting closed (${room.voteResult.totalVotes} ballots cast).`
      );
      return {};
    }

    case 'RESOLVE_TIE': {
      if (room.phase !== 'DAY_VOTE_RESULT') {
        return { error: 'No vote result to resolve.' };
      }
      const resolution = String(payload.resolution || '');
      if (resolution === 'revote') {
        room.votes = {};
        room.voteResult = null;
        room.phase = 'DAY_VOTING';
        room.phaseEndsAt = Date.now() + room.settings.votingDuration * 1000;
        addEvent(room, 'public', 'Vote tied — Game Master called a re-vote.');
        return { toast: 'Re-vote started.' };
      }
      if (resolution === 'no_elimination') {
        if (room.voteResult) {
          room.voteResult.eliminatedPlayerId = null;
          room.voteResult.eliminatedPlayerName = null;
          room.voteResult.isTie = false;
        }
        markStep(room, 'elimination');
        addEvent(room, 'public', 'Tie resolved: nobody was eliminated.');
        return { toast: 'No elimination confirmed.' };
      }
      if (resolution === 'eliminate_player') {
        const targetId = String(payload.targetPlayerId || '');
        const revealRole =
          typeof payload.revealRole === 'boolean'
            ? payload.revealRole
            : room.settings.revealRoleOnElimination;
        return handleGmAction(room, 'ELIMINATE_PLAYER', {
          playerId: targetId,
          revealRole,
          reason: 'vote',
        });
      }
      return { error: 'Invalid tie resolution.' };
    }

    case 'ELIMINATE_PLAYER': {
      const playerId = String(payload.playerId || '');
      const target = room.players.get(playerId);
      if (!target || target.isGM) {
        return { error: 'Player not found.' };
      }
      if (!target.isAlive) {
        return { error: `${target.name} is already eliminated.` };
      }
      const revealRole =
        typeof payload.revealRole === 'boolean'
          ? payload.revealRole
          : room.settings.revealRoleOnElimination;
      const reason = payload.reason === 'vote' ? 'vote' : 'gm';

      target.isAlive = false;
      target.eliminatedRound = room.round;
      target.eliminatedBy = reason;
      target.roleRevealed = revealRole;
      room.voicePeers.delete(target.id);

      if (reason === 'vote' && room.voteResult) {
        room.voteResult.eliminatedPlayerId = target.id;
        room.voteResult.eliminatedPlayerName = target.name;
        room.voteResult.revealedRole = revealRole ? target.role : null;
        room.voteResult.isTie = false;
        markStep(room, 'elimination');
      }

      const roleText = revealRole ? ` Their role was ${target.role}.` : ' Their role remains secret.';
      const msg =
        reason === 'vote'
          ? `${target.name} was eliminated by parlor vote.${roleText}`
          : `${target.name} was eliminated by the Game Master.${roleText}`;
      addEvent(room, 'public', msg);
      addChat(room, 'system', room.gmPlayerId, 'Parlor Narrator', `⚰️ ${msg}`, 'announcement');

      const win = checkWinCondition(room);
      if (win) {
        finalizeRoundEntry(room);
        room.winner = win;
        room.phase = 'GAME_OVER';
        for (const p of room.players.values()) p.roleRevealed = true;
        addEvent(room, 'public', `Match ended: ${win.reason}`);
      }
      return { toast: `${target.name} eliminated.` };
    }

    case 'TOGGLE_REVEAL_ROLE': {
      const playerId = String(payload.playerId || '');
      const target = room.players.get(playerId);
      if (!target || target.isGM) return { error: 'Player not found.' };
      if (target.isAlive) {
        return { error: 'Only eliminated players can have their role publicly revealed or hidden.' };
      }
      const reveal = Boolean(payload.reveal);
      target.roleRevealed = reveal;
      if (room.voteResult && room.voteResult.eliminatedPlayerId === target.id) {
        room.voteResult.revealedRole = reveal ? target.role : null;
      }
      if (room.dayAnnouncement && room.dayAnnouncement.eliminatedPlayerId === target.id) {
        room.dayAnnouncement.revealedRole = reveal ? target.role : null;
      }
      addEvent(
        room,
        'public',
        reveal
          ? `Game Master revealed ${target.name}'s role: ${target.role}.`
          : `Game Master hid ${target.name}'s role.`
      );
      return {};
    }

    case 'COMPLETE_ROUND': {
      if (room.phase === 'LOBBY' || room.phase === 'GAME_OVER') {
        return { error: 'Cannot complete round in current state.' };
      }
      recordDiscussionTime(room);
      markStep(room, 'elimination');
      markStep(room, 'complete');
      room.phase = 'ROUND_COMPLETE';
      room.phaseEndsAt = null;
      finalizeRoundEntry(room);
      addEvent(room, 'public', `Round ${room.round} completed.`);

      const win = checkWinCondition(room);
      if (win) {
        room.winner = win;
        room.phase = 'GAME_OVER';
        for (const p of room.players.values()) p.roleRevealed = true;
        addEvent(room, 'public', `Match ended: ${win.reason}`);
      }
      return { toast: `Round ${room.round} completed.` };
    }

    case 'START_NEXT_ROUND': {
      if (room.winner || room.phase === 'GAME_OVER') {
        return { error: 'Match has already ended. Restart to play a new game.' };
      }
      if (room.settings.maxRounds > 0 && room.round >= room.settings.maxRounds) {
        const win = {
          team: 'Town' as TeamAlignment,
          reason: `Maximum round limit (${room.settings.maxRounds}) reached. Town survives.`,
        };
        room.winner = win;
        room.phase = 'GAME_OVER';
        for (const p of room.players.values()) p.roleRevealed = true;
        return { toast: 'Max rounds reached — match complete.' };
      }
      room.round += 1;
      room.roundStartedAt = Date.now();
      room.isPaused = false;
      room.phaseEndsAt = null;
      room.pausedRemainingMs = null;
      room.discussionEnded = false;
      room.nightState = createEmptyNightState();
      room.dayAnnouncement = null;
      room.votes = {};
      room.voteResult = null;
      room.currentRoundGmEvents = [];
      room.currentRoundDiscussionStart = null;
      room.currentRoundDiscussionSeconds = 0;
      room.completedRoundSteps = [];
      room.phase = 'NIGHT_INTRO';
      addEvent(room, 'public', `Round ${room.round} started. Night has fallen.`);
      addChat(
        room,
        'system',
        room.gmPlayerId,
        'Parlor Narrator',
        `🌙 ROUND ${room.round} — NIGHT HAS BEGUN. EVERYONE CLOSE YOUR EYES.`,
        'announcement'
      );
      return { toast: `Round ${room.round} started.` };
    }

    case 'PAUSE_GAME': {
      if (room.isPaused) return {};
      room.isPaused = true;
      if (room.phaseEndsAt) {
        room.pausedRemainingMs = Math.max(0, room.phaseEndsAt - Date.now());
        room.phaseEndsAt = null;
      }
      addEvent(room, 'public', 'Game Master paused the match.');
      return { toast: 'Match paused.' };
    }

    case 'RESUME_GAME': {
      if (!room.isPaused) return {};
      room.isPaused = false;
      if (room.pausedRemainingMs !== null) {
        room.phaseEndsAt = Date.now() + room.pausedRemainingMs;
        room.pausedRemainingMs = null;
      }
      addEvent(room, 'public', 'Game Master resumed the match.');
      return { toast: 'Match resumed.' };
    }

    case 'TOGGLE_PLAYER_MUTE': {
      const target = room.players.get(String(payload.playerId || ''));
      if (!target || target.isGM) return { error: 'Player not found.' };
      target.isMuted = !target.isMuted;
      addEvent(
        room,
        'gm_only',
        `GM ${target.isMuted ? 'muted' : 'unmuted'} ${target.name}.`
      );
      return {};
    }

    case 'TOGGLE_PLAYER_SPEAK': {
      const target = room.players.get(String(payload.playerId || ''));
      if (!target || target.isGM) return { error: 'Player not found.' };
      target.canSpeak = !target.canSpeak;
      addEvent(
        room,
        'gm_only',
        `GM ${target.canSpeak ? 'granted' : 'revoked'} speaking permission for ${target.name}.`
      );
      return {};
    }

    case 'UPDATE_GM_NOTES': {
      room.gmNotes = String(payload.notes || '').slice(0, 4000);
      return {};
    }

    case 'ANNOUNCE_RESULT': {
      const team =
        payload.team === 'Mafia' || payload.team === 'Neutral' ? payload.team : 'Town';
      const reason =
        String(payload.reason || '').trim().slice(0, 240) ||
        `Game Master declared ${team} victory.`;
      finalizeRoundEntry(room);
      room.winner = { team, reason };
      room.phase = 'GAME_OVER';
      room.phaseEndsAt = null;
      for (const p of room.players.values()) p.roleRevealed = true;
      addEvent(room, 'public', `Result announced: ${reason}`);
      return { toast: 'Game results announced.' };
    }

    case 'RESTART_GAME': {
      room.phase = 'LOBBY';
      room.round = 0;
      room.isPaused = false;
      room.phaseEndsAt = null;
      room.pausedRemainingMs = null;
      room.discussionEnded = false;
      room.completedRoundSteps = [];
      room.nightState = createEmptyNightState();
      room.dayAnnouncement = null;
      room.votes = {};
      room.voteResult = null;
      room.lastRoundSummary = null;
      room.winner = null;
      room.roundHistory = [];
      room.currentRoundGmEvents = [];
      room.currentRoundDiscussionStart = null;
      room.currentRoundDiscussionSeconds = 0;
      for (const p of room.players.values()) {
        if (!p.isGM) {
          p.isAlive = true;
          p.isReady = false;
          p.isMuted = false;
          p.canSpeak = true;
          p.roleRevealed = false;
          p.eliminatedRound = null;
          p.eliminatedBy = null;
          p.detectiveHistory = [];
          p.lastProtectedId = null;
        }
      }
      addEvent(room, 'public', 'Game Master restarted the match back to Lobby.');
      return { toast: 'Match reset to Lobby.' };
    }

    default:
      return { error: `Unknown Game Master action: ${action}` };
  }
}

export function handlePlayerNightAction(
  room: ServerRoom,
  player: ServerPlayer,
  payload: Record<string, unknown>
): { error?: string; toast?: string } {
  if (room.isPaused) return { error: 'Game is currently paused.' };
  if (player.isGM || !player.isAlive) {
    return { error: 'Only living players can perform night actions.' };
  }
  const targetId = String(payload.targetId || '');
  const target = room.players.get(targetId);
  if (!target || target.isGM || !target.isAlive) {
    return { error: 'Target must be a living player.' };
  }

  if (room.phase === 'NIGHT_MAFIA') {
    if (player.role !== 'Mafia') {
      return { error: 'Only Mafia members can act right now.' };
    }
    if (room.nightState.mafiaLocked) {
      return { error: 'Mafia action is already locked.' };
    }
    room.nightState.mafiaSelections[player.id] = target.id;
    room.nightState.mafiaFinalTargetId = getMafiaConsensus(room);
    addEvent(
      room,
      'gm_only',
      `Mafia member ${player.name} selected ${target.name}.`
    );
    return { toast: `Target set to ${target.name}.` };
  }

  if (room.phase === 'NIGHT_BODYGUARD') {
    if (player.role !== 'Bodyguard') {
      return { error: 'Only the Bodyguard can act right now.' };
    }
    if (room.nightState.bodyguardLocked) {
      return { error: 'Bodyguard protection is already locked.' };
    }
    if (target.id === player.id && !room.settings.bodyguardSelfProtect) {
      return { error: 'Self-protection is disabled in Match Rules.' };
    }
    if (
      !room.settings.bodyguardConsecutiveProtect &&
      player.lastProtectedId === target.id
    ) {
      return { error: 'Cannot protect the same player two nights in a row.' };
    }
    room.nightState.bodyguardTargetId = target.id;
    addEvent(
      room,
      'gm_only',
      `Bodyguard ${player.name} chose to protect ${target.name}.`
    );
    return { toast: `Protecting ${target.name} tonight.` };
  }

  if (room.phase === 'NIGHT_DETECTIVE') {
    if (player.role !== 'Detective') {
      return { error: 'Only the Detective can act right now.' };
    }
    if (room.nightState.detectiveLocked || room.nightState.detectiveTargetId) {
      return { error: 'You have already submitted your investigation for this round.' };
    }
    const isMafia = doesRoleAppearAsMafia(target.role, room.customRoles);
    room.nightState.detectiveTargetId = target.id;
    room.nightState.detectiveResultIsMafia = isMafia;
    player.detectiveHistory.push({
      round: room.round,
      targetId: target.id,
      targetName: target.name,
      isMafia,
    });
    addEvent(
      room,
      'gm_only',
      `Detective ${player.name} investigated ${target.name} → ${isMafia ? 'MAFIA' : 'NOT MAFIA'}.`
    );
    return { toast: `Investigation complete.` };
  }

  if (room.phase === 'NIGHT_CUSTOM') {
    const custom = room.customRoles.find((c) => c.name === player.role);
    if (!custom || custom.nightAction === 'none') {
      return { error: 'Your role has no active custom night action.' };
    }
    room.nightState.customActions[player.id] = {
      roleName: custom.name,
      targetId: target.id,
      note: String(payload.note || '').slice(0, 120),
    };
    addEvent(
      room,
      'gm_only',
      `${custom.name} (${player.name}) targeted ${target.name}.`
    );
    return { toast: `Action recorded on ${target.name}.` };
  }

  return { error: 'It is not your role turn.' };
}

export function handleCastVote(
  room: ServerRoom,
  player: ServerPlayer,
  payload: Record<string, unknown>
): { error?: string; toast?: string } {
  if (room.isPaused) return { error: 'Match is paused.' };
  if (room.phase !== 'DAY_VOTING') {
    return { error: 'Voting is not currently open.' };
  }
  if (player.isGM || !player.isAlive) {
    return { error: 'Only living players may vote.' };
  }
  if (room.votes[player.id] && !room.settings.allowVoteChange) {
    return { error: 'Vote changes are disabled in Match Rules.' };
  }
  const targetId = String(payload.targetId || '');
  if (targetId === 'NO_VOTE') {
    if (!room.settings.allowNoVote) {
      return { error: 'Skipping vote is disabled in Match Rules.' };
    }
    room.votes[player.id] = 'NO_VOTE';
    addEvent(room, 'gm_only', `${player.name} voted to Skip / No Elimination.`);
    return { toast: 'Ballot cast: No Vote.' };
  }

  const target = room.players.get(targetId);
  if (!target || target.isGM || !target.isAlive) {
    return { error: 'You can only vote for a living player.' };
  }
  room.votes[player.id] = target.id;
  addEvent(room, 'gm_only', `${player.name} voted for ${target.name}.`);
  return { toast: `Ballot cast for ${target.name}.` };
}
