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
  console.log("[elevenlabs] requesting WebRTC token for agent", agentId);
  const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) {
    const body = await res.text();
    console.error("[elevenlabs] token error", res.status, body);
    throw new Error(`ElevenLabs token request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { token?: string };
  if (!json?.token) throw new Error("No token in ElevenLabs response");
  console.log("[elevenlabs] WebRTC token issued ok");
  return json.token;
}

/**
 * Generates a short-lived WebSocket signed URL for the same ElevenLabs agent.
 * Used as a real fallback when WebRTC/LiveKit is blocked by the browser/network.
 */
export async function fetchConversationSignedUrl(agentId: string): Promise<string> {
  const apiKey = requireKey();
  const url = `${ELEVEN_BASE}/convai/conversation/get-signed-url?agent_id=${encodeURIComponent(agentId)}`;
  console.log("[elevenlabs] requesting signed URL for agent", agentId);
  const res = await fetch(url, { headers: { "xi-api-key": apiKey } });
  if (!res.ok) {
    const body = await res.text();
    console.error("[elevenlabs] signed URL error", res.status, body);
    throw new Error(`ElevenLabs signed URL request failed (${res.status}): ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { signed_url?: string };
  if (!json?.signed_url) throw new Error("No signed URL in ElevenLabs response");
  console.log("[elevenlabs] signed URL issued ok");
  return json.signed_url;
}
