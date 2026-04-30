import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { fetchConversationSignedUrl, fetchConversationToken } from "./elevenlabs.server";

const AGENT_ID_REGEX = /^(?:agent_[A-Za-z0-9]{16,}|[A-Za-z0-9]{20,})$/;

const EmptyInput = z.object({}).optional();

function resolveAgentId(): string | null {
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  if (!agentId) return null;
  if (!AGENT_ID_REGEX.test(agentId)) throw new Error("Invalid ELEVENLABS_AGENT_ID secret format");
  return agentId;
}

/**
 * Returns a short-lived WebRTC token for the given ElevenLabs agent.
 */
export const getElevenLabsAgentToken = createServerFn({ method: "POST" })
  .inputValidator((input) => EmptyInput.parse(input))
  .handler(async () => {
    try {
      const agentId = resolveAgentId();
      if (!agentId) {
        return {
          token: null as string | null,
          error: "No Agent ID configured. Add ELEVENLABS_AGENT_ID as a backend secret.",
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
  .inputValidator((input) => EmptyInput.parse(input))
  .handler(async () => {
    try {
      const agentId = resolveAgentId();
      if (!agentId) {
        return {
          signedUrl: null as string | null,
          error: "No Agent ID configured. Add ELEVENLABS_AGENT_ID as a backend secret.",
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
