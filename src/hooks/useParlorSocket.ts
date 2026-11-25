import { useCallback, useEffect, useRef, useState } from 'react';
import type { ClientGameState, ServerToClientMessage } from '../shared/types.ts';
import { soundFx } from '../utils/soundFx.ts';

export interface ActiveSession {
  roomCode: string;
  roomName: string;
  playerId: string;
  sessionToken: string;
  gmSecretToken?: string;
  rejoinPin: string;
  isPublicRoom?: boolean;
}

const ICE_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

function canClientSpeakNow(state: ClientGameState): { allowed: boolean; reason?: string } {
  if (!state.settings.voiceChatEnabled) {
    return { allowed: false, reason: 'Voice chat is disabled in Match Rules.' };
  }
  if (state.viewerIsGM) return { allowed: true };
  const me = state.players.find((p) => p.id === state.viewerId);
  if (me?.isMuted) {
    return { allowed: false, reason: 'You are muted by the Game Master.' };
  }
  if (me && !me.canSpeak) {
    return { allowed: false, reason: 'Speaking permission is paused by the Game Master.' };
  }
  if (state.phase === 'LOBBY' || state.phase === 'GAME_OVER') {
    return { allowed: true };
  }
  if (!state.viewerIsAlive) {
    return { allowed: false, reason: 'Eliminated spectators cannot talk during active rounds.' };
  }
  if (state.phase === 'NIGHT_MAFIA') {
    if (state.viewerRole === 'Mafia' && state.settings.mafiaTeamCommunication) {
      return { allowed: true };
    }
    return { allowed: false, reason: 'Night silence is active while the parlor sleeps.' };
  }
  if (state.phase.startsWith('NIGHT_')) {
    return { allowed: false, reason: 'Night silence is active while roles act.' };
  }
  return { allowed: true };
}

export function useParlorSocket(
  session: ActiveSession | null,
  onSessionInvalid?: (reason: string) => void
) {
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState<{ id: number; text: string; kind: 'info' | 'error' } | null>(
    null
  );
  const [micActive, setMicActive] = useState(false);
  const [deafened, setDeafened] = useState(false);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteAudiosRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const makingOfferRef = useRef<Set<string>>(new Set());
  const gameStateRef = useRef<ClientGameState | null>(null);
  const deafenedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const meterTimerRef = useRef<number | null>(null);
  const onSessionInvalidRef = useRef(onSessionInvalid);
  onSessionInvalidRef.current = onSessionInvalid;

  const showToast = useCallback((text: string, kind: 'info' | 'error' = 'info') => {
    setToast({ id: Date.now(), text, kind });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type, payload }));
    }
  }, []);

  const cleanupPeer = useCallback((peerId: string) => {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
      peersRef.current.delete(peerId);
    }
    const audio = remoteAudiosRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      remoteAudiosRef.current.delete(peerId);
    }
    pendingCandidatesRef.current.delete(peerId);
    makingOfferRef.current.delete(peerId);
  }, []);

  const stopLocalMeter = useCallback(() => {
    if (meterTimerRef.current !== null) {
      window.clearInterval(meterTimerRef.current);
      meterTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      void audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsLocalSpeaking(false);
  }, []);

  const startLocalMeter = useCallback(
    (stream: MediaStream) => {
      stopLocalMeter();
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        audioCtxRef.current = ctx;

        const data = new Uint8Array(analyser.frequencyBinCount);
        let prevSpeaking = false;
        meterTimerRef.current = window.setInterval(() => {
          analyser.getByteFrequencyData(data);
          let sum = 0;
          for (let i = 0; i < data.length; i++) sum += data[i];
          const avg = sum / data.length;
          const speakingNow = avg > 14;
          if (speakingNow !== prevSpeaking) {
            prevSpeaking = speakingNow;
            setIsLocalSpeaking(speakingNow);
          }
        }, 140);
      } catch {
        // Ignore AudioContext restrictions
      }
    },
    [stopLocalMeter]
  );

  const stopVoice = useCallback(
    (notifyServer = true) => {
      setMicActive(false);
      stopLocalMeter();
      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          track.stop();
        }
        localStreamRef.current = null;
      }
      // Remove local audio tracks from existing listen-only connections or close if not listening
      const current = gameStateRef.current;
      const activeVoiceSet = new Set(current?.voicePeers || []);
      for (const [peerId, pc] of Array.from(peersRef.current.entries())) {
        if (!activeVoiceSet.has(peerId)) {
          cleanupPeer(peerId);
        } else {
          for (const sender of pc.getSenders()) {
            if (sender.track && sender.track.kind === 'audio') {
              try {
                pc.removeTrack(sender);
              } catch {
                // Ignore if already closed
              }
            }
          }
        }
      }
      if (notifyServer) {
        sendMessage('VOICE_STATE', { active: false });
      }
    },
    [cleanupPeer, sendMessage, stopLocalMeter]
  );

  const unlockRemoteAudio = useCallback(() => {
    for (const audio of remoteAudiosRef.current.values()) {
      audio.muted = deafenedRef.current;
      void audio.play().catch(() => {});
    }
  }, []);

  const toggleDeafen = useCallback(() => {
    setDeafened((prev) => {
      const next = !prev;
      deafenedRef.current = next;
      for (const audio of remoteAudiosRef.current.values()) {
        audio.muted = next;
        if (!next) {
          void audio.play().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const sendOfferToPeer = useCallback(
    async (peerId: string, pc: RTCPeerConnection) => {
      if (makingOfferRef.current.has(peerId)) return;
      makingOfferRef.current.add(peerId);
      try {
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        sendMessage('RTC_SIGNAL', {
          toPlayerId: peerId,
          signal: { sdp: pc.localDescription },
        });
      } catch {
        // Ignore transient negotiation errors
      } finally {
        makingOfferRef.current.delete(peerId);
      }
    },
    [sendMessage]
  );

  const createPeerConnection = useCallback(
    (peerId: string, initiator: boolean) => {
      const existing = peersRef.current.get(peerId);
      if (existing) {
        if (localStreamRef.current) {
          const track = localStreamRef.current.getAudioTracks()[0];
          if (track) {
            const audioSender = existing.getSenders().find((s) => s.track?.kind === 'audio');
            if (!audioSender) {
              existing.addTrack(track, localStreamRef.current);
              if (initiator) {
                void sendOfferToPeer(peerId, existing);
              }
            } else if (audioSender.track !== track) {
              void audioSender.replaceTrack(track);
            }
          }
        }
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_CONFIG);

      if (localStreamRef.current) {
        for (const track of localStreamRef.current.getTracks()) {
          pc.addTrack(track, localStreamRef.current);
        }
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          sendMessage('RTC_SIGNAL', {
            toPlayerId: peerId,
            signal: { candidate: e.candidate.toJSON() },
          });
        }
      };

      pc.ontrack = (e) => {
        let audio = remoteAudiosRef.current.get(peerId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.setAttribute('playsinline', 'true');
          audio.style.display = 'none';
          document.body.appendChild(audio);
          remoteAudiosRef.current.set(peerId, audio);
        }
        audio.muted = deafenedRef.current;
        audio.srcObject = e.streams[0] || new MediaStream([e.track]);
        void audio.play().catch(() => {});
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          cleanupPeer(peerId);
        }
      };

      peersRef.current.set(peerId, pc);

      if (initiator) {
        void sendOfferToPeer(peerId, pc);
      }

      return pc;
    },
    [cleanupPeer, sendMessage, sendOfferToPeer]
  );

  const syncVoicePeers = useCallback(
    (state: ClientGameState) => {
      if (!state.settings.voiceChatEnabled) {
        for (const peerId of Array.from(peersRef.current.keys())) {
          cleanupPeer(peerId);
        }
        return;
      }

      const hasLocalMic = Boolean(localStreamRef.current);
      const onlineIds = new Set(
        state.players.filter((p) => p.id !== state.viewerId && p.isOnline).map((p) => p.id)
      );
      const voicePeerSet = new Set(state.voicePeers);
      const desiredPeers = new Set<string>();

      if (hasLocalMic) {
        for (const p of state.players) {
          if (p.id === state.viewerId || !p.isOnline) continue;
          if (state.phase === 'NIGHT_MAFIA' && !state.viewerIsGM) {
            if (p.isGM || (p.isAlive && p.role === 'Mafia')) {
              desiredPeers.add(p.id);
            }
          } else if (state.phase.startsWith('NIGHT_') && state.phase !== 'NIGHT_MAFIA' && !state.viewerIsGM) {
            // Non-GM players do not send night voice
          } else {
            desiredPeers.add(p.id);
          }
        }
      } else {
        for (const peerId of state.voicePeers) {
          if (peerId !== state.viewerId && onlineIds.has(peerId)) {
            desiredPeers.add(peerId);
          }
        }
      }

      for (const existingPeerId of Array.from(peersRef.current.keys())) {
        if (!desiredPeers.has(existingPeerId)) {
          cleanupPeer(existingPeerId);
        }
      }

      if (hasLocalMic) {
        for (const peerId of desiredPeers) {
          const peerAlsoSpeaking = voicePeerSet.has(peerId);
          const shouldInitiate = !peerAlsoSpeaking || state.viewerId < peerId;
          const existing = peersRef.current.get(peerId);
          if (!existing) {
            createPeerConnection(peerId, shouldInitiate);
          } else {
            const track = localStreamRef.current?.getAudioTracks()[0];
            if (track && !existing.getSenders().some((s) => s.track?.kind === 'audio')) {
              existing.addTrack(track, localStreamRef.current!);
              void sendOfferToPeer(peerId, existing);
            }
          }
        }
      }
    },
    [cleanupPeer, createPeerConnection, sendOfferToPeer]
  );

  const handleRtcSignal = useCallback(
    async (
      fromPlayerId: string,
      signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit }
    ) => {
      const current = gameStateRef.current;
      if (!current || !current.settings.voiceChatEnabled) return;

      const pc = createPeerConnection(fromPlayerId, false);
      const polite = current.viewerId < fromPlayerId;

      try {
        if (signal.sdp) {
          const offerCollision =
            signal.sdp.type === 'offer' &&
            (makingOfferRef.current.has(fromPlayerId) || pc.signalingState !== 'stable');

          if (offerCollision && !polite) {
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          const queued = pendingCandidatesRef.current.get(fromPlayerId);
          if (queued && queued.length > 0) {
            pendingCandidatesRef.current.delete(fromPlayerId);
            for (const cand of queued) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(cand));
              } catch {
                // Ignore stale ICE candidate
              }
            }
          }

          if (signal.sdp.type === 'offer') {
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sendMessage('RTC_SIGNAL', {
              toPlayerId: fromPlayerId,
              signal: { sdp: pc.localDescription },
            });
          }
        } else if (signal.candidate) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } else {
            const list = pendingCandidatesRef.current.get(fromPlayerId) || [];
            list.push(signal.candidate);
            pendingCandidatesRef.current.set(fromPlayerId, list);
          }
        }
      } catch {
        // Ignore transient WebRTC signaling errors
      }
    },
    [createPeerConnection, sendMessage]
  );

  const toggleMic = useCallback(async () => {
    setVoiceError(null);
    unlockRemoteAudio();

    if (micActive) {
      stopVoice(true);
      return;
    }

    const current = gameStateRef.current;
    if (!current) return;

    const perm = canClientSpeakNow(current);
    if (!perm.allowed) {
      setVoiceError(perm.reason || 'Voice chat is unavailable right now.');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceError('Microphone is unavailable in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicActive(true);
      startLocalMeter(stream);
      sendMessage('VOICE_STATE', { active: true });
      syncVoicePeers(current);
    } catch {
      setVoiceError('Microphone permission denied or no audio device found.');
    }
  }, [micActive, sendMessage, startLocalMeter, stopVoice, syncVoicePeers, unlockRemoteAudio]);

  useEffect(() => {
    if (!session) {
      setGameState(null);
      setConnected(false);
      return;
    }

    let disposed = false;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
        ws.send(
          JSON.stringify({
            type: 'AUTH',
            payload: {
              roomCode: session.roomCode,
              sessionToken: session.sessionToken,
              gmSecretToken: session.gmSecretToken,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerToClientMessage;
        } catch {
          return;
        }
        if (msg.type === 'STATE_SYNC') {
          const next = msg.payload as ClientGameState;
          gameStateRef.current = next;
          setGameState(next);

          // Sound FX cues on phase transitions
          const prev = prevPhaseRef.current;
          if (prev !== next.phase) {
            if (next.phase === 'NIGHT_INTRO') soundFx.playNightFall();
            else if (
              next.phase === 'NIGHT_MAFIA' &&
              (next.viewerIsGM || next.viewerRole === 'Mafia')
            ) {
              soundFx.playRoleWake();
            } else if (
              next.phase === 'NIGHT_BODYGUARD' &&
              (next.viewerIsGM || next.viewerRole === 'Bodyguard')
            ) {
              soundFx.playRoleWake();
            } else if (
              next.phase === 'NIGHT_DETECTIVE' &&
              (next.viewerIsGM || next.viewerRole === 'Detective')
            ) {
              soundFx.playRoleWake();
            } else if (next.phase === 'DAY_ANNOUNCE') {
              soundFx.playDayBreak();
            } else if (next.phase === 'DAY_VOTING') {
              soundFx.playGavelStrike();
            } else if (next.phase === 'DAY_VOTE_RESULT') {
              if (next.voteResult?.eliminatedPlayerId) soundFx.playElimination();
              else soundFx.playGavelStrike();
            } else if (next.phase === 'ROUND_COMPLETE') {
              soundFx.playStamp();
            } else if (next.phase === 'GAME_OVER') {
              soundFx.playVictory();
            }
            prevPhaseRef.current = next.phase;
          }

          // Enforce server-side GM mute / elimination / night silence on local mic
          const perm = canClientSpeakNow(next);
          if (!perm.allowed && localStreamRef.current) {
            stopVoice(true);
          }

          syncVoicePeers(next);
        } else if (msg.type === 'ERROR') {
          const err = msg.payload as { message?: string };
          if (err?.message) {
            if (
              err.message.includes('Room not found') ||
              err.message.includes('Invalid session token') ||
              err.message.includes('Room no longer exists') ||
              err.message.includes('Player not in room')
            ) {
              onSessionInvalidRef.current?.(err.message);
            } else {
              showToast(err.message, 'error');
            }
          }
        } else if (msg.type === 'TOAST') {
          const info = msg.payload as { message?: string };
          if (info?.message) showToast(info.message, 'info');
        } else if (msg.type === 'RTC_SIGNAL') {
          const sig = msg.payload as {
            fromPlayerId: string;
            signal: { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
          };
          void handleRtcSignal(sig.fromPlayerId, sig.signal);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        if (!disposed) {
          const delay = Math.min(5000, 700 * Math.pow(1.5, attempt));
          attempt += 1;
          reconnectTimerRef.current = window.setTimeout(connect, delay);
        }
      };
    };

    connect();

    return () => {
      disposed = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      stopVoice(false);
      for (const peerId of Array.from(peersRef.current.keys())) {
        cleanupPeer(peerId);
      }
    };
  }, [cleanupPeer, handleRtcSignal, session, showToast, stopVoice, syncVoicePeers]);

  const sendGmAction = useCallback(
    (action: string, extra: Record<string, unknown> = {}) => {
      sendMessage('GM_ACTION', { action, ...extra });
    },
    [sendMessage]
  );

  return {
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
  };
}
