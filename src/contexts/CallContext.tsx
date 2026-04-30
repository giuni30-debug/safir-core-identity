import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, Video as VideoIcon, VideoOff, SwitchCamera } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";

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
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
};

type AudioSinkElement = HTMLAudioElement & { setSinkId?: (sinkId: string) => Promise<void> };
type RemoteAudioGraph = {
  input: MediaStream;
  source: MediaStreamAudioSourceNode;
  compressor: DynamicsCompressorNode;
  gain: GainNode;
  destination: MediaStreamAudioDestinationNode;
};

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const myId = user?.id ?? null;

  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const remoteAudioGraphRef = useRef<RemoteAudioGraph | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const remoteDescSetRef = useRef(false);
  const elapsedTimerRef = useRef<number | null>(null);
  const facingRef = useRef<"user" | "environment">("user");
  const speakerOnRef = useRef(false);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    remoteAudioGraphRef.current?.source.disconnect();
    remoteAudioGraphRef.current?.compressor.disconnect();
    remoteAudioGraphRef.current?.gain.disconnect();
    remoteAudioGraphRef.current = null;
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
    setElapsed(0);
    setMuted(false);
    setSpeakerOn(false);
    speakerOnRef.current = false;
    setCameraOn(true);
    setHasRemoteVideo(false);
    facingRef.current = "user";
  }, []);

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

  const unlockCallAudio = useCallback(async () => {
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;
    const ctx = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
  }, []);

  const getRemotePlaybackStream = useCallback((stream: MediaStream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return stream;
    const graph = remoteAudioGraphRef.current;
    if (graph?.input === stream) return graph.destination.stream;
    graph?.source.disconnect();
    graph?.compressor.disconnect();
    graph?.gain.disconnect();
    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return stream;
    const ctx = audioContextRef.current ?? new AudioContextCtor();
    audioContextRef.current = ctx;
    const source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -28;
    compressor.knee.value = 24;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.004;
    compressor.release.value = 0.18;
    const gain = ctx.createGain();
    gain.gain.value = 1.18;
    const destination = ctx.createMediaStreamDestination();
    source.connect(compressor).connect(gain).connect(destination);
    remoteAudioGraphRef.current = { input: stream, source, compressor, gain, destination };
    return destination.stream;
  }, []);

  // Clean speaker routing: keep the remote track alive, only switch output device.
  const applyAudioRouting = useCallback(async (on: boolean) => {
    const a = remoteAudioRef.current;
    if (!a) return;
    a.muted = false;
    a.volume = 1;
    const sinkable = a as AudioSinkElement;
    if (typeof sinkable.setSinkId !== "function") return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter((d) => d.kind === "audiooutput");
      const findOutput = (words: RegExp) => outputs.find((d) => words.test(d.label.toLowerCase()))?.deviceId;
      const earpiece = findOutput(/earpiece|receiver|phone|communication|comunicare|cască|casca/);
      const loudspeaker = findOutput(/speaker|loud|media|multimedia|difuzor/);
      await sinkable.setSinkId(on ? loudspeaker || "default" : earpiece || "default");
    } catch (e) {
      console.warn("[call] audio output routing unavailable", e);
    }
  }, []);

  const playRemoteMedia = useCallback(() => {
    const stream = remoteStreamRef.current;
    if (!stream) return;
    if (remoteAudioRef.current) {
      const a = remoteAudioRef.current;
      const playbackStream = getRemotePlaybackStream(stream);
      if (a.srcObject !== playbackStream) a.srcObject = playbackStream;
      a.muted = false;
      a.volume = 1;
      a.play().catch((e) => {
        console.warn("remote audio play blocked", e);
        setInfo("Tap speaker to enable audio");
      });
      // Re-apply current routing whenever we (re)bind the stream.
      void applyAudioRouting(speakerOnRef.current);
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [applyAudioRouting, getRemotePlaybackStream]);

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
          return s;
        } catch (e) {
          console.warn("video+audio failed, trying audio only", e);
          try {
            const s = await navigator.mediaDevices.getUserMedia({ audio: CALL_AUDIO_CONSTRAINTS });
            setInfo("Video unavailable, audio still connected");
            return s;
          } catch {
            setError("Camera and microphone permission are required for video calls.");
            return null;
          }
        }
      }
      return await navigator.mediaDevices.getUserMedia({ audio: CALL_AUDIO_CONSTRAINTS });
    } catch {
      setError(media === "video"
        ? "Camera and microphone permission are required for video calls."
        : "Microphone permission is required for calls.");
      return null;
    }
  }, []);

  // ---- Caller flow ----
  const startCallInternal = useCallback(
    async (contactId: string, media: CallMedia) => {
      if (!myId) return;
      if (state.kind !== "idle") return;
      setError(null);
      setInfo(null);
      facingRef.current = "user";
      await unlockCallAudio();

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
    [myId, state.kind, buildPeer, sendSignal, getLocalMedia, unlockCallAudio],
  );

  const startCall = useCallback((id: string) => startCallInternal(id, "audio"), [startCallInternal]);
  const startVideoCall = useCallback((id: string) => startCallInternal(id, "video"), [startCallInternal]);

  // ---- Receiver: accept ----
  const acceptIncoming = useCallback(async () => {
    if (state.kind !== "incoming" || !myId) return;
    const { callId, peer, offer, media } = state;
    await unlockCallAudio();

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
  }, [state, myId, buildPeer, sendSignal, updateCallStatus, cleanup, getLocalMedia, unlockCallAudio]);

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

  const toggleSpeaker = () => {
    const a = remoteAudioRef.current;
    if (!a) return;
    const next = !speakerOn;
    speakerOnRef.current = next;
    setSpeakerOn(next);
    // Reroute output WITHOUT muting the stream and WITHOUT touching the
    // peer connection / local mic. Voice keeps flowing throughout.
    void unlockCallAudio()
      .then(() => applyAudioRouting(next))
      .catch((e) => console.warn("[call] speaker toggle routing failed", e));
  };

  const toggleCamera = () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const next = !cameraOn;
    stream.getVideoTracks().forEach((t) => (t.enabled = next));
    setCameraOn(next);
  };

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
      playRemoteMedia();
    }
  }, [state, playRemoteMedia]);

  // ---- Elapsed timer ----
  useEffect(() => {
    if (state.kind === "active") {
      const start = state.startedAt;
      elapsedTimerRef.current = window.setInterval(() => {
        setElapsed(Math.floor((Date.now() - start) / 1000));
      }, 500);
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

  // Ringtone
  useEffect(() => {
    if (state.kind !== "incoming") return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    let stopped = false;
    const playBeep = () => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 480;
      gain.gain.value = 0.05;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    };
    playBeep();
    const i = window.setInterval(playBeep, 1500);
    return () => {
      stopped = true;
      window.clearInterval(i);
      ctx.close().catch(() => {});
    };
  }, [state.kind]);

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
          speakerOn={speakerOn}
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
          onToggleSpeaker={toggleSpeaker}
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
  state, elapsed, muted, speakerOn, cameraOn, hasRemoteVideo, error, info,
  remoteVideoRef, localVideoRef,
  onAccept, onDecline, onEnd, onToggleMute, onToggleSpeaker, onToggleCamera, onSwitchCamera,
}: {
  state: Exclude<CallState, { kind: "idle" }>;
  elapsed: number;
  muted: boolean;
  speakerOn: boolean;
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
  onToggleSpeaker: () => void;
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
            ) : (
              <button
                onClick={onToggleSpeaker}
                disabled={state.kind !== "active"}
                className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 backdrop-blur disabled:opacity-40"
                aria-label="Speaker"
              >
                <Volume2 className={speakerOn ? "h-5 w-5 text-primary" : "h-5 w-5"} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
