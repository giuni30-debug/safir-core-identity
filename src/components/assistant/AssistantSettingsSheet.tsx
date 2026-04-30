import { useEffect, useState } from "react";
import { X, Save } from "lucide-react";
import { toast } from "sonner";
import type { AssistantPersonality, AssistantPrefs } from "@/hooks/useAssistantPrefs";

type Props = {
  open: boolean;
  onClose: () => void;
  prefs: AssistantPrefs;
  onSave: (patch: Partial<AssistantPrefs>) => Promise<void> | void;
};

const VOICES = [
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", desc: "warm, calm" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", desc: "natural, conversational" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", name: "Alice", desc: "crisp, modern" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", desc: "deep, cinematic" },
  { id: "FGY2WhTYpPnrIDTdsKH5", name: "Laura", desc: "friendly, soft" },
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", desc: "mature, narrator" },
];

const PERSONAS: { id: AssistantPersonality; label: string; desc: string }[] = [
  { id: "calm", label: "Calm & friendly", desc: "Warm, concise, empathetic" },
  { id: "friendly", label: "Energetic", desc: "Playful, upbeat" },
  { id: "professional", label: "Professional", desc: "Formal, efficient" },
];

export function AssistantSettingsSheet({ open, onClose, prefs, onSave }: Props) {
  const [voiceId, setVoiceId] = useState(prefs.voiceId);
  const [personality, setPersonality] = useState<AssistantPersonality>(prefs.personality);
  const [autoMode, setAutoMode] = useState(prefs.autoMode);
  const [saving, setSaving] = useState(false);

  // Re-sync local form whenever the sheet is (re)opened or prefs change.
  useEffect(() => {
    if (!open) return;
    setVoiceId(prefs.voiceId);
    setPersonality(prefs.personality);
    setAutoMode(prefs.autoMode);
  }, [open, prefs.voiceId, prefs.personality, prefs.autoMode]);

  if (!open) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        voiceId,
        personality,
        autoMode,
      });
      toast.success("Saved");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end sm:items-center sm:justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-white/10 bg-[#0d1024] p-5 text-white shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Voice Assistant Settings</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Agent ID */}
        <div className="mb-4">
          <label className="mb-1 block text-xs uppercase tracking-wider text-white/50">
            ElevenLabs Agent ID
          </label>
          <input
            value={agentId}
            onChange={(e) => setAgentId(e.target.value)}
            placeholder="agent_xxxxxxxxxxxxxxxx"
            aria-invalid={!!agentIdError}
            className={`w-full rounded-xl border bg-white/5 px-3 py-2 text-sm outline-none transition ${
              agentIdError
                ? "border-red-400/70 focus:border-red-400"
                : agentIdValid && trimmedId
                ? "border-emerald-400/60 focus:border-emerald-400"
                : "border-white/10 focus:border-cyan-400/60"
            }`}
          />
          {agentIdError ? (
            <p className="mt-1 text-[11px] text-red-300">{agentIdError}</p>
          ) : (
            <p className="mt-1 text-[11px] text-white/40">
              Create a Conversational AI agent at elevenlabs.io → Conversational AI → Create Agent, then paste its ID here.
            </p>
          )}
        </div>

        {/* Voice */}
        <div className="mb-4">
          <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Voice</label>
          <div className="grid grid-cols-2 gap-2">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoiceId(v.id)}
                className={`rounded-xl border px-3 py-2 text-left transition ${
                  voiceId === v.id
                    ? "border-cyan-400/70 bg-cyan-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-medium">{v.name}</div>
                <div className="text-[11px] text-white/50">{v.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div className="mb-4">
          <label className="mb-2 block text-xs uppercase tracking-wider text-white/50">Personality</label>
          <div className="space-y-2">
            {PERSONAS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersonality(p.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  personality === p.id
                    ? "border-cyan-400/70 bg-cyan-400/10"
                    : "border-white/10 bg-white/5 hover:bg-white/10"
                }`}
              >
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-[11px] text-white/50">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Auto mode */}
        <label className="mb-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-3">
          <div>
            <div className="text-sm font-medium">Hands-free mode</div>
            <div className="text-[11px] text-white/50">AI listens continuously — no need to hold the mic</div>
          </div>
          <input
            type="checkbox"
            checked={autoMode}
            onChange={(e) => setAutoMode(e.target.checked)}
            className="h-5 w-5 accent-cyan-400"
          />
        </label>

        <button
          onClick={submit}
          disabled={saving || !!agentIdError}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-indigo-500 px-4 py-3 font-medium text-white shadow-lg disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
