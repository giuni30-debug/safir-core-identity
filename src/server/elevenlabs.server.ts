// Server-only ElevenLabs helpers. Never import this file from a component.
const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

function requireKey(): string {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY is not configured");
  return k;
}

/**
 * Generates a single-use WebRTC conversation token for an ElevenLabs
 * Conversational AI agent. Token is valid for ~15 minutes.
 */
export async function fetchConversationToken(agentId: string): Promise<string> {
  const apiKey = requireKey();
  const url = `${ELEVEN_BASE}/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`;
  const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) {
    const body = await res.text();
    console.error("ElevenLabs token error", res.status, body);
    throw new Error(`ElevenLabs token request failed (${res.status})`);
  }
  const json = (await res.json()) as { token?: string };
  if (!json?.token) throw new Error("No token in ElevenLabs response");
  return json.token;
}
