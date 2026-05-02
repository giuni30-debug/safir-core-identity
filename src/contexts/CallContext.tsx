import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { Phone, PhoneOff, Mic, MicOff, Video as VideoIcon, VideoOff, SwitchCamera, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";
import {
  startNativeCallSession,
  endNativeCallSession,
  setNativeSpeakerphone,
  isNativePlatform,
} from "@/lib/nativeAudio";

type ContactProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
};

type CallMedia = "audio" | "video";

type CallState =
  | { kind: "idle" }
  | { kind: "outgoing"; callId: string; peer: ContactProfile; status: "calling" | "ringing"; media: CallMedia }
  | { kind: "incoming"; callId: string; peer: ContactProfile; offer: RTCSessionDescriptionInit; media: CallMedia }
  | { kind: "active"; callId: string; peer: ContactProfile; role: "caller" | "callee"; startedAt: number; media: CallMedia };

type CallApi = {
  startCall: (contactId: string) => Promise<void>;
  startVideoCall: (contactId: string) => Promise<void>;
  inCall: boolean;
};

const CallCtx = createContext<CallApi | null>(null);

export function useCall() {
  const v = useContext(CallCtx);
  if (!v) throw new Error("useCall outside CallProvider");
  return v;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: { ideal: true },
  noiseSuppression: { ideal: true },
  autoGainControl: { ideal: true },
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 48000 },
  sampleSize: { ideal: 16 },
  advanced: [
    { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    {
      googEchoCancellation: true,
      googNoiseSuppression: true,
      googAutoGainControl: true,
      googAutoGainControl2: true,
      googHighpassFilter: true,
    } as MediaTrackConstraintSet,
  ],
};

const REMOTE_AUDIO_VOLUME = 0.78;

type AudioSinkElement = HTMLMediaElement & { setSinkId?: (sinkId: string) => Promise<void> };
type CallAudioSessionNavigator = Navigator & {
  audioSession?: { type: "auto" | "playback" | "transient" | "transient-solo" | "ambient" | "play-and-record" };
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const myId = user?.id ?? null;

  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const rawLocalAudioTracksRef = useRef<MediaStreamTrack[]>([]);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const remoteDescSetRef = useRef(false);
  const elapsedTimerRef = useRef<number | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const facingRef = useRef<"user" | "environment">("user");

  const releaseLocalAudioProcessing = useCallback(() => {
    rawLocalAudioTracksRef.current.forEach((t) => t.stop());
    rawLocalAudioTracksRef.current = [];
  }, []);

  const cleanup = useCallback(() => {
    void endNativeCallSession();
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    releaseLocalAudioProcessing();
    remoteStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    pendingIceRef.current = [];
    callIdRef.current = null;
    peerIdRef.current = null;
    remoteDescSetRef.current = false;
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
    if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
    ringTimeoutRef.current = null;
    setElapsed(0);
    setMuted(false);
    setCameraOn(true);
    setSpeakerOn(false);
    setHasRemoteVideo(false);
    facingRef.current = "user";
  }, [releaseLocalAudioProcessing]);

  const sendSignal = useCallback(
    async (
      callId: string,
      to: string,
      type: "offer" | "answer" | "ice" | "hangup" | "accept" | "decline",
      payload: unknown,
    ) => {
      if (!myId) return;
      const { error } = await supabase.from("call_signals").insert({
        call_id: callId,
        from_user_id: myId,
        to_user_id: to,
        signal_type: type,
        payload: payload as never,
      });
      if (error) console.error("signal send error", type, error);
    },
    [myId],
  );

  const updateCallStatus = useCallback(
    async (
      callId: string,
      status: "accepted" | "declined" | "ended" | "missed" | "failed",
    ) => {
      const patch: { status: string; answered_at?: string; ended_at?: string } = { status };
      if (status === "accepted") patch.answered_at = new Date().toISOString();
      if (["ended", "declined", "missed", "failed"].includes(status))
        patch.ended_at = new Date().toISOString();
      await supabase.from("calls").update(patch).eq("id", callId);
    },
    [],
  );

  const prepareCallAudioElement = useCallback((audio: HTMLAudioElement) => {
    audio.autoplay = true;
    audio.muted = false;
    audio.volume = REMOTE_AUDIO_VOLUME;
    audio.disableRemotePlayback = true;
    audio.setAttribute("playsinline", "true");
    audio.setAttribute("webkit-playsinline", "true");
    audio.setAttribute("x-webkit-airplay", "deny");
    audio.setAttribute("controlslist", "nodownload noremoteplayback");
  }, []);

  const forceNativeCallAudioSession = useCallback(() => {
    const nav = navigator as CallAudioSessionNavigator;
    if (nav.audioSession) {
      try {
        nav.audioSession.type = "play-and-record";
      } catch (e) {
        console.warn("[call] native call audio session unavailable", e);
      }
    }
  }, []);

  const unlockCallAudio = useCallback(async () => {
    forceNativeCallAudioSession();
    if (remoteAudioRef.current) prepareCallAudioElement(remoteAudioRef.current);
  }, [forceNativeCallAudioSession, prepareCallAudioElement]);

  const normalizeLocalMicrophone = useCallback((stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return stream;
    releaseLocalAudioProcessing();
    audioTracks.forEach((track) => {
      track.contentHint = "speech";
      track.applyConstraints(CALL_AUDIO_CONSTRAINTS).catch(() => {});
    });
    return stream;
  }, [releaseLocalAudioProcessing]);

  const applyAudioRouting = useCallback(async () => {
    forceNativeCallAudioSession();
    const targets = [remoteAudioRef.current, remoteVideoRef.current].filter(Boolean) as AudioSinkElement[];
    if (remoteAudioRef.current) {
      prepareCallAudioElement(remoteAudioRef.current);
      remoteAudioRef.current.muted = false;
    }
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices?.();
      if (!devices) return;
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const normalize = (v: string) => v.toLowerCase();
      const loudspeakerPattern = /speaker|loudspeaker|difuzor|media|handsfree|external|bluetooth|airplay|hdmi|usb|cast|default/;
      const earpiece = outputs.find((d) => {
        const label = normalize(d.label);
        return /earpiece|receiver|phone|communication|communications|comunicare|cască|casca|telefon|auricular/.test(label)
          && !loudspeakerPattern.test(label);
      })?.deviceId;
      const sinkId = earpiece || "communications";
      await Promise.all(targets.map(async (target) => {
        if (typeof target.setSinkId !== "function") return;
        try {
          await target.setSinkId(sinkId);
        } catch {
          if (sinkId !== "communications") await target.setSinkId("communications");
        }
      }));
    } catch (e) {
      console.warn("[call] earpiece routing unavailable", e);
    }
  }, [forceNativeCallAudioSession, prepareCallAudioElement]);

  const setSpeakerphoneOff = useCallback(() => {
    // Pe mobil nativ (Capacitor): forțează casca prin AVAudioSession / AudioManager
    if (isNativePlatform()) {
      void startNativeCallSession();
      void setNativeSpeakerphone(false);
    }
    // Pe web: continuă cu fallback-ul existent
    forceNativeCallAudioSession();
    void applyAudioRouting();
  }, [applyAudioRouting, forceNativeCallAudioSession]);

  const playRemoteMedia = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    if (remoteAudioRef.current) {
      const a = remoteAudioRef.current;
      prepareCallAudioElement(a);
      const audioOnlyStream = new MediaStream(stream.getAudioTracks());
      const current = a.srcObject as MediaStream | null;
      const currentIds = current?.getAudioTracks().map((t) => t.id).join(",") ?? "";
      const nextIds = audioOnlyStream.getAudioTracks().map((t) => t.id).join(",");
      if (currentIds !== nextIds) a.srcObject = audioOnlyStream;
      a.muted = false;
      a.play().catch((e) => {
        console.warn("remote audio play blocked", e);
        setInfo("Tap to enable call audio");
      });
      void applyAudioRouting();
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [applyAudioRouting, prepareCallAudioElement]);

  const buildPeer = useCallback(
    (callId: string, peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;

      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal(callId, peerId, "ice", ev.candidate.toJSON());
        }
      };
      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((t) => {
          if (!remoteStream.getTracks().find((x) => x.id === t.id)) {
            remoteStream.addTrack(t);
          }
          if (t.kind === "video") setHasRemoteVideo(true);
        });
        playRemoteMedia();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          setError("Call failed");
          handleEnd("failed");
        }
      };
      pcRef.current = pc;
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [playRemoteMedia, sendSignal],
  );

  const handleEnd = useCallback(
    (status: "ended" | "declined" | "failed" | "missed" = "ended") => {
      const callId = callIdRef.current;
      const peerId = peerIdRef.current;
      if (callId && peerId) {
        sendSignal(callId, peerId, "hangup", {}).catch(() => {});
        updateCallStatus(callId, status).catch(() => {});
      }
      cleanup();
      setState({ kind: "idle" });
    },
    [cleanup, sendSignal, updateCallStatus],
  );

  // ---- Get local media (audio or audio+video with fallback) ----
  const getLocalMedia = useCallback(async (media: CallMedia): Promise<MediaStream | null> => {
    try {
      if (media === "video") {
        try {
          const s = await navigator.mediaDevices.getUserMedia({
            audio: CALL_AUDIO_CONSTRAINTS,
            video: { facingMode: facingRef.current },
          });
          return normalizeLocalMicrophone(s);
        } catch (e) {
          console.warn("video+audio failed, trying audio only", e);
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: CALL_AUDIO_CONSTRAINTS });
            setInfo("Video unavailable, audio still connected");
            return normalizeLocalMicrophone(s);
          } catch {
            setError("Camera and microphone permission are required for video calls.");
            return null;
          }
        }
      }
      const s = await navigator.mediaDevices.getUserMedia({ audio: CALL_AUDIO_CONSTRAINTS });
      return normalizeLocalMicrophone(s);
    } catch {
      setError(media === "video"
        ? "Camera and microphone permission are required for video calls."
        : "Microphone permission is required for calls.");
      return null;
    }
  }, [normalizeLocalMicrophone]);

  // ---- Caller flow ----
  const startCallInternal = useCallback(
    async (contactId: string, media: CallMedia) => {
      if (!myId) return;
      if (state.kind !== "idle") return;
      setError(null);
      setInfo(null);
      facingRef.current = "user";
      await unlockCallAudio();
      setSpeakerphoneOff();

      const { data: peer } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", contactId)
        .maybeSingle();
      if (!peer) {
        setError("User is unavailable");
        return;
      }

      const stream = await getLocalMedia(media);
      if (!stream) return;
      localStreamRef.current = stream;

      const { data: call, error: callErr } = await supabase
        .from("calls")
        .insert({
          caller_id: myId,
          callee_id: contactId,
          call_type: media,
          status: "ringing",
        })
        .select("id")
        .single();
      if (callErr || !call) {
        stream.getTracks().forEach((t) => t.stop());
        setError("Could not start call");
        return;
      }

      callIdRef.current = call.id;
      peerIdRef.current = contactId;

      const pc = buildPeer(call.id, contactId);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      setSpeakerphoneOff();

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: media === "video",
      });
      await pc.setLocalDescription(offer);

      // include media kind in payload via wrapper? signal_type is fixed.
      // We embed in payload itself by augmenting offer object.
      await sendSignal(call.id, contactId, "offer", { ...offer, _media: media });

      setState({
        kind: "outgoing",
        callId: call.id,
        peer: peer as ContactProfile,
        status: "calling",
        media,
      });
    },
    [myId, state.kind, buildPeer, sendSignal, getLocalMedia, unlockCallAudio, setSpeakerphoneOff],
  );

  const startCall = useCallback((id: string) => startCallInternal(id, "audio"), [startCallInternal]);
  const startVideoCall = useCallback((id: string) => startCallInternal(id, "video"), [startCallInternal]);

  // ---- Receiver: accept ----
  const acceptIncoming = useCallback(async () => {
    if (state.kind !== "incoming" || !myId) return;
    const { callId, peer, offer, media } = state;
    await unlockCallAudio();
    setSpeakerphoneOff();

    const stream = await getLocalMedia(media);
    if (!stream) {
      await sendSignal(callId, peer.id, "decline", {});
      await updateCallStatus(callId, "declined");
      cleanup();
      setState({ kind: "idle" });
      return;
    }
    localStreamRef.current = stream;

    callIdRef.current = callId;
    peerIdRef.current = peer.id;

    const pc = buildPeer(callId, peer.id);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    setSpeakerphoneOff();

    await pc.setRemoteDescription(offer);
    remoteDescSetRef.current = true;

    for (const c of pendingIceRef.current) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn("ice add failed", e); }
    }
    pendingIceRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal(callId, peer.id, "answer", answer);
    await sendSignal(callId, peer.id, "accept", {});
    await updateCallStatus(callId, "accepted");

    setState({ kind: "active", callId, peer, role: "callee", startedAt: Date.now(), media });
  }, [state, myId, buildPeer, sendSignal, updateCallStatus, cleanup, getLocalMedia, unlockCallAudio, setSpeakerphoneOff]);

  const declineIncoming = useCallback(async () => {
    if (state.kind !== "incoming") return;
    const { callId, peer } = state;
    await sendSignal(callId, peer.id, "decline", {});
    await updateCallStatus(callId, "declined");
    cleanup();
    setState({ kind: "idle" });
  }, [state, sendSignal, updateCallStatus, cleanup]);

  // ---- Toggles ----
  const toggleMute = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraOn(next);
  };

  const toggleSpeaker = useCallback(async () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    // Native (iOS/Android via Capacitor)
    if (isNativePlatform()) {
      try {
        await setNativeSpeakerphone(next);
      } catch (e) {
        console.warn("[call] toggleSpeaker native failed", e);
        // retry once
        try { await setNativeSpeakerphone(next); } catch { /* fallback silent */ }
      }
      return;
    }
    // Web fallback: try setSinkId on remote audio element
    const targets = [remoteAudioRef.current, remoteVideoRef.current].filter(Boolean) as AudioSinkElement[];
    try {
      const devices = await navigator.mediaDevices?.enumerateDevices?.();
      if (!devices) return;
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      let sinkId = "";
      if (next) {
        // Speaker: prefer default/speaker
        const speaker = outputs.find((d) => /speaker|loudspeaker|difuzor|default/i.test(d.label));
        sinkId = speaker?.deviceId || "default";
      } else {
        const earpiece = outputs.find((d) =>
          /earpiece|receiver|communication|cască|casca/i.test(d.label),
        );
        sinkId = earpiece?.deviceId || "communications";
      }
      await Promise.all(targets.map(async (t) => {
        if (typeof t.setSinkId === "function") {
          try { await t.setSinkId(sinkId); } catch { /* ignore */ }
        }
      }));
    } catch (e) {
      console.warn("[call] toggleSpeaker web failed", e);
    }
  }, [speakerOn]);

  const switchCamera = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream) return;
    const newFacing = facingRef.current === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
      // swap on local stream
      stream.getVideoTracks().forEach((t) => { t.stop(); stream.removeTrack(t); });
      stream.addTrack(newTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      facingRef.current = newFacing;
    } catch (e) {
      console.warn("switch camera failed", e);
    }
  }, []);

  // ---- Bind local video element when stream available ----
  useEffect(() => {
    if (state.kind === "active" && state.media === "video" && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
      localVideoRef.current.play().catch(() => {});
    }
    if (state.kind === "active") {
      setSpeakerphoneOff();
      playRemoteMedia();
    }
  }, [state, playRemoteMedia, setSpeakerphoneOff]);

  // ---- Elapsed timer ----
  useEffect(() => {
    if (state.kind === "active") {
      const start = state.startedAt;
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 1000);
      return () => {
        if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
      };
    }
  }, [state]);

  // ---- Global signal listener ----
  useEffect(() => {
    if (!myId) return;

    const channel = supabase
      .channel(`call-signals:${myId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "call_signals",
          filter: `to_user_id=eq.${myId}`,
        },
        async (payload) => {
          const sig = payload.new as {
            id: string;
            call_id: string;
            from_user_id: string;
            signal_type: string;
            payload: Record<string, unknown>;
          };

          if (sig.signal_type === "offer") {
            if (state.kind !== "idle" || pcRef.current) {
              await sendSignal(sig.call_id, sig.from_user_id, "decline", {});
              await updateCallStatus(sig.call_id, "declined");
              return;
            }
            const { data: peer } = await supabase
              .from("profiles")
              .select("id, display_name, username, avatar_url")
              .eq("id", sig.from_user_id)
              .maybeSingle();
            if (!peer) return;
            const media: CallMedia = (sig.payload?._media as CallMedia) === "video" ? "video" : "audio";
            const offer = { type: sig.payload.type, sdp: sig.payload.sdp } as RTCSessionDescriptionInit;
            setState({
              kind: "incoming",
              callId: sig.call_id,
              peer: peer as ContactProfile,
              offer,
              media,
            });
            return;
          }

          if (sig.signal_type === "answer") {
            const pc = pcRef.current;
            if (!pc) return;
            try {
              await pc.setRemoteDescription(sig.payload as unknown as RTCSessionDescriptionInit);
              remoteDescSetRef.current = true;
              for (const c of pendingIceRef.current) {
                try { await pc.addIceCandidate(c); } catch (e) { console.warn(e); }
              }
              pendingIceRef.current = [];
            } catch (e) {
              console.error("setRemoteDescription answer", e);
            }
            return;
          }

          if (sig.signal_type === "accept") {
            setState((cur) =>
              cur.kind === "outgoing"
                ? { kind: "active", callId: cur.callId, peer: cur.peer, role: "caller", startedAt: Date.now(), media: cur.media }
                : cur,
            );
            return;
          }

          if (sig.signal_type === "ice") {
            const pc = pcRef.current;
            const cand = sig.payload as RTCIceCandidateInit;
            if (!pc || !remoteDescSetRef.current) {
              pendingIceRef.current.push(cand);
              return;
            }
            try { await pc.addIceCandidate(cand); } catch (e) { console.warn("ice add", e); }
            return;
          }

          if (sig.signal_type === "decline" || sig.signal_type === "hangup") {
            const wasActive = state.kind === "active" || pcRef.current;
            cleanup();
            setState({ kind: "idle" });
            if (sig.signal_type === "decline" && !wasActive) {
              setError("Call declined");
            }
            return;
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myId, state.kind]);

  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  useEffect(() => {
    if (!info) return;
    const t = window.setTimeout(() => setInfo(null), 4000);
    return () => window.clearTimeout(t);
  }, [info]);

  const api = useMemo<CallApi>(
    () => ({ startCall, startVideoCall, inCall: state.kind !== "idle" }),
    [startCall, startVideoCall, state.kind],
  );

  return (
    <CallCtx.Provider value={api}>
      {children}

      <audio ref={remoteAudioRef} autoPlay playsInline />

      {error && state.kind === "idle" && (
        <div className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive backdrop-blur">
          {error}
        </div>
      )}

      {state.kind !== "idle" && (
        <CallOverlay
          state={state}
          elapsed={elapsed}
          muted={muted}
          cameraOn={cameraOn}
          hasRemoteVideo={hasRemoteVideo}
          error={error}
          info={info}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
          onEnd={() => handleEnd("ended")}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onSwitchCamera={switchCamera}
        />
      )}
    </CallCtx.Provider>
  );
}

function fmtElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function CallOverlay({
  state, elapsed, muted, cameraOn, hasRemoteVideo, error, info,
  remoteVideoRef, localVideoRef,
  onAccept, onDecline, onEnd, onToggleMute, onToggleCamera, onSwitchCamera,
}: {
  state: Exclude<CallState, { kind: "idle" }>;
  elapsed: number;
  muted: boolean;
  cameraOn: boolean;
  hasRemoteVideo: boolean;
  error: string | null;
  info: string | null;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
}) {
  const peer = state.peer;
  const isVideo = state.media === "video";
  const statusLabel =
    state.kind === "incoming"
      ? `Incoming ${isVideo ? "video" : "audio"} call`
      : state.kind === "outgoing"
      ? "Calling…"
      : fmtElapsed(elapsed);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-background/95 px-6 py-12 backdrop-blur-xl">
      {/* Remote video (full bg) when active video call */}
      {isVideo && state.kind === "active" && (
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="absolute inset-0 z-0 h-full w-full object-cover"
          style={{ background: "#000" }}
        />
      )}
      {isVideo && state.kind === "active" && !hasRemoteVideo && (
        <div className="absolute inset-0 z-0 flex items-center justify-center bg-background/80">
          <Avatar url={peer.avatar_url} name={peer.display_name} size={160} />
        </div>
      )}

      {/* Local PiP */}
      {isVideo && state.kind === "active" && (
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute right-4 top-4 z-10 h-40 w-28 rounded-2xl border border-border object-cover shadow-lg"
          style={{ background: "#000", transform: "scaleX(-1)" }}
        />
      )}

      {/* Top header info */}
      <div className="relative z-20 flex flex-col items-center gap-4">
        {!(isVideo && state.kind === "active") && (
          <>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {isVideo ? "Video call" : "Audio call"}
            </p>
            <Avatar
              url={peer.avatar_url}
              name={peer.display_name}
              size={120}
              className={state.kind !== "active" ? "animate-pulse" : ""}
            />
          </>
        )}
        <div className="text-center" style={isVideo && state.kind === "active" ? { textShadow: "0 1px 4px rgba(0,0,0,0.8)" } : undefined}>
          <p className="text-xl font-semibold">{peer.display_name}</p>
          <p className="text-sm text-muted-foreground">@{peer.username}</p>
        </div>
        <p className="mt-2 text-sm tabular-nums text-primary">{statusLabel}</p>
        {info && <p className="text-xs text-muted-foreground">{info}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Controls */}
      <div className="relative z-20 flex w-full max-w-sm items-center justify-around">
        {state.kind === "incoming" ? (
          <>
            <button
              onClick={onDecline}
              className="grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
              aria-label="Decline"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={onAccept}
              className="grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg"
              aria-label="Accept"
              style={{ boxShadow: "var(--shadow-glow)" }}
            >
              {isVideo ? <VideoIcon className="h-7 w-7" /> : <Phone className="h-7 w-7" />}
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              disabled={state.kind !== "active"}
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 backdrop-blur disabled:opacity-40"
              aria-label="Mute"
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            {isVideo ? (
              <button
                onClick={onToggleCamera}
                disabled={state.kind !== "active"}
                className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 backdrop-blur disabled:opacity-40"
                aria-label="Camera"
              >
                {cameraOn ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </button>
            ) : null}
            <button
              onClick={onEnd}
              className="grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            {isVideo ? (
              <button
                onClick={onSwitchCamera}
                disabled={state.kind !== "active"}
                className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 backdrop-blur disabled:opacity-40"
                aria-label="Switch camera"
              >
                <SwitchCamera className="h-5 w-5" />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
