import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchConversationSignedUrl, fetchConversationToken } from "./elevenlabs.server";

/**
 * Accept ElevenLabs agent ids in either of the two known shapes:
 *   - "agent_" + 16+ alphanumerics (current format)
 *   - 20+ alphanumerics (legacy format)
 * Anything else is rejected with a clear message instead of being forwarded
 * to ElevenLabs (which would 4xx with a confusing body).
 */
const AGENT_ID_REGEX = /^(?:agent_[A-Za-z0-9]{16,}|[A-Za-z0-9]{20,})$/;

const TokenInput = z.object({
  agentId: z
    .string()
    .trim()
    .min(8, "Agent ID is too short")
    .max(128, "Agent ID is too long")
    .regex(AGENT_ID_REGEX, "Invalid Agent ID format")
    .optional()
    .nullable(),
});

/**
 * Resolve which agent id to use for a given request.
 * Always prefers the user-supplied id (validated above), and falls back to the
 * server-side ELEVENLABS_AGENT_ID secret only when nothing was provided.
 */
function resolveAgentId(provided: string | null | undefined): string | null {
  const trimmed = provided?.trim();
  if (trimmed) return trimmed;
  const fallback = process.env.ELEVENLABS_AGENT_ID?.trim();
  return fallback || null;
}

/**
 * Returns a short-lived WebRTC token for the given ElevenLabs agent.
 */
export const getElevenLabsAgentToken = createServerFn({ method: "POST" })
  .inputValidator((input) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const agentId = resolveAgentId(data.agentId);
      if (!agentId) {
        return {
          token: null as string | null,
          error: "No Agent ID configured. Set one in Voice Assistant Settings.",
        };
      }
      const token = await fetchConversationToken(agentId);
      return { token, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("getElevenLabsAgentToken failed", msg);
      return { token: null as string | null, error: msg };
    }
  });

/**
 * Returns a signed WebSocket URL for the same ElevenLabs agent.
 * Used as a fallback when WebRTC is blocked by the browser/network.
 */
export const getElevenLabsAgentSignedUrl = createServerFn({ method: "POST" })
  .inputValidator((input) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    try {
      const agentId = resolveAgentId(data.agentId);
      if (!agentId) {
        return {
          signedUrl: null as string | null,
          error: "No Agent ID configured. Set one in Voice Assistant Settings.",
        };
      }
      const signedUrl = await fetchConversationSignedUrl(agentId);
      return { signedUrl, error: null as string | null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("getElevenLabsAgentSignedUrl failed", msg);
      return { signedUrl: null as string | null, error: msg };
    }
  });
