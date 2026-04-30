import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from "react";
import { Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { Avatar } from "@/components/Avatar";

type ContactProfile = {
  id: string;
  display_name: string;
  username: string;
  avatar_url: string | null;
};

type CallState =
  | { kind: "idle" }
  | { kind: "outgoing"; callId: string; peer: ContactProfile; status: "calling" | "ringing" }
  | { kind: "incoming"; callId: string; peer: ContactProfile; offer: RTCSessionDescriptionInit }
  | { kind: "active"; callId: string; peer: ContactProfile; role: "caller" | "callee"; startedAt: number };

type CallApi = {
  startCall: (contactId: string) => Promise<void>;
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

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  const myId = user?.id ?? null;

  const [state, setState] = useState<CallState>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callIdRef = useRef<string | null>(null);
  const peerIdRef = useRef<string | null>(null);
  const remoteDescSetRef = useRef(false);
  const elapsedTimerRef = useRef<number | null>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const cleanup = useCallback(() => {
    pcRef.current?.getSenders().forEach((s) => s.track?.stop());
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    pendingIceRef.current = [];
    callIdRef.current = null;
    peerIdRef.current = null;
    remoteDescSetRef.current = false;
    if (elapsedTimerRef.current) window.clearInterval(elapsedTimerRef.current);
    elapsedTimerRef.current = null;
    setElapsed(0);
    setMuted(false);
    setSpeakerOn(true);
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
      const patch: Record<string, unknown> = { status };
      if (status === "accepted") patch.answered_at = new Date().toISOString();
      if (["ended", "declined", "missed", "failed"].includes(status))
        patch.ended_at = new Date().toISOString();
      await supabase.from("calls").update(patch).eq("id", callId);
    },
    [],
  );

  const buildPeer = useCallback(
    (callId: string, peerId: string) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          sendSignal(callId, peerId, "ice", ev.candidate.toJSON());
        }
      };
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (remoteAudioRef.current && stream) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(() => {});
        }
      };
      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected" ||
          pc.connectionState === "closed"
        ) {
          if (pc.connectionState === "failed") {
            setError("Call failed");
            handleEnd("failed");
          }
        }
      };
      pcRef.current = pc;
      return pc;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sendSignal],
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

  // ---- Caller flow ----
  const startCall = useCallback(
    async (contactId: string) => {
      if (!myId) return;
      if (state.kind !== "idle") return;
      setError(null);

      // Load contact profile
      const { data: peer } = await supabase
        .from("profiles")
        .select("id, display_name, username, avatar_url")
        .eq("id", contactId)
        .maybeSingle();
      if (!peer) {
        setError("User is unavailable");
        return;
      }

      // Mic
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        setError("Microphone permission is required for calls.");
        return;
      }
      localStreamRef.current = stream;

      // Create call row
      const { data: call, error: callErr } = await supabase
        .from("calls")
        .insert({
          caller_id: myId,
          callee_id: contactId,
          call_type: "audio",
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

      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      await sendSignal(call.id, contactId, "offer", offer);

      setState({
        kind: "outgoing",
        callId: call.id,
        peer: peer as ContactProfile,
        status: "calling",
      });
    },
    [myId, state.kind, buildPeer, sendSignal],
  );

  // ---- Receiver: accept ----
  const acceptIncoming = useCallback(async () => {
    if (state.kind !== "incoming" || !myId) return;
    const { callId, peer, offer } = state;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone permission is required for calls.");
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

    // flush queued ICE
    for (const c of pendingIceRef.current) {
      try { await pc.addIceCandidate(c); } catch (e) { console.warn("ice add failed", e); }
    }
    pendingIceRef.current = [];

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await sendSignal(callId, peer.id, "answer", answer);
    await sendSignal(callId, peer.id, "accept", {});
    await updateCallStatus(callId, "accepted");

    setState({ kind: "active", callId, peer, role: "callee", startedAt: Date.now() });
  }, [state, myId, buildPeer, sendSignal, updateCallStatus, cleanup]);

  const declineIncoming = useCallback(async () => {
    if (state.kind !== "incoming") return;
    const { callId, peer } = state;
    await sendSignal(callId, peer.id, "decline", {});
    await updateCallStatus(callId, "declined");
    cleanup();
    setState({ kind: "idle" });
  }, [state, sendSignal, updateCallStatus, cleanup]);

  // ---- Toggle mute / speaker ----
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
    a.muted = !next;
    setSpeakerOn(next);
  };

  // ---- Elapsed timer when active ----
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
            payload: unknown;
          };

          // Incoming OFFER → show ringing UI (only if idle)
          if (sig.signal_type === "offer") {
            if (state.kind !== "idle" || pcRef.current) {
              // busy — auto-decline
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
            setState({
              kind: "incoming",
              callId: sig.call_id,
              peer: peer as ContactProfile,
              offer: sig.payload as RTCSessionDescriptionInit,
            });
            return;
          }

          // ANSWER from callee → caller sets remote desc
          if (sig.signal_type === "answer") {
            const pc = pcRef.current;
            if (!pc) return;
            try {
              await pc.setRemoteDescription(sig.payload as RTCSessionDescriptionInit);
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

          // ACCEPT confirmation → caller transitions to active
          if (sig.signal_type === "accept") {
            setState((cur) =>
              cur.kind === "outgoing"
                ? { kind: "active", callId: cur.callId, peer: cur.peer, role: "caller", startedAt: Date.now() }
                : cur,
            );
            return;
          }

          // ICE candidate
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

          // DECLINE / HANGUP from peer
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

  // Auto-clear error after 4s
  useEffect(() => {
    if (!error) return;
    const t = window.setTimeout(() => setError(null), 4000);
    return () => window.clearTimeout(t);
  }, [error]);

  // Ringtone for incoming
  useEffect(() => {
    if (state.kind !== "incoming") return;
    // Simple beep loop using oscillator
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
    () => ({ startCall, inCall: state.kind !== "idle" }),
    [startCall, state.kind],
  );

  return (
    <CallCtx.Provider value={api}>
      {children}

      {/* Hidden remote audio element */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
      <audio ref={ringtoneRef} />

      {/* Error toast */}
      {error && state.kind === "idle" && (
        <div className="fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive backdrop-blur">
          {error}
        </div>
      )}

      {/* Outgoing / Incoming / Active overlay */}
      {state.kind !== "idle" && (
        <CallOverlay
          state={state}
          elapsed={elapsed}
          muted={muted}
          speakerOn={speakerOn}
          error={error}
          onAccept={acceptIncoming}
          onDecline={declineIncoming}
          onEnd={() => handleEnd("ended")}
          onToggleMute={toggleMute}
          onToggleSpeaker={toggleSpeaker}
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
  state, elapsed, muted, speakerOn, error,
  onAccept, onDecline, onEnd, onToggleMute, onToggleSpeaker,
}: {
  state: Exclude<CallState, { kind: "idle" }>;
  elapsed: number;
  muted: boolean;
  speakerOn: boolean;
  error: string | null;
  onAccept: () => void;
  onDecline: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleSpeaker: () => void;
}) {
  const peer = state.peer;
  const statusLabel =
    state.kind === "incoming"
      ? "Incoming call"
      : state.kind === "outgoing"
      ? "Calling…"
      : fmtElapsed(elapsed);

  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-between bg-background/95 px-6 py-12 backdrop-blur-xl">
      <div className="flex flex-col items-center gap-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {state.kind === "incoming" ? "Incoming audio call" : "Audio call"}
        </p>
        <Avatar
          url={peer.avatar_url}
          name={peer.display_name}
          size={120}
          className={state.kind !== "active" ? "animate-pulse" : ""}
        />
        <div className="text-center">
          <p className="text-xl font-semibold">{peer.display_name}</p>
          <p className="text-sm text-muted-foreground">@{peer.username}</p>
        </div>
        <p className="mt-2 text-sm tabular-nums text-primary">{statusLabel}</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      <div className="flex w-full max-w-sm items-center justify-around">
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
              <Phone className="h-7 w-7" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onToggleMute}
              disabled={state.kind !== "active"}
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 disabled:opacity-40"
              aria-label="Mute"
            >
              {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              onClick={onEnd}
              className="grid h-16 w-16 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
              aria-label="End call"
            >
              <PhoneOff className="h-7 w-7" />
            </button>
            <button
              onClick={onToggleSpeaker}
              disabled={state.kind !== "active"}
              className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card/60 disabled:opacity-40"
              aria-label="Speaker"
            >
              {speakerOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
