export type GiftTier = "low" | "mid" | "premium";

export type Gift = {
  id: string;
  emoji: string;
  name: string;
  price: number;
  tier: GiftTier;
  color: string; // oklch
  fx:
    | "petals"
    | "hearts"
    | "smile"
    | "crown"
    | "ring"
    | "rocket"
    | "sapphire"
    | "ruby"
    | "diamond";
};

export const GIFTS: Gift[] = [
  // LOW
  { id: "flower", emoji: "🌸", name: "Flower", price: 0.5, tier: "low", color: "oklch(0.85 0.12 350)", fx: "petals" },
  { id: "heart",  emoji: "❤️", name: "Heart",  price: 1,    tier: "low", color: "oklch(0.70 0.22 25)",  fx: "hearts" },
  { id: "smile",  emoji: "😊", name: "Smile",  price: 2,    tier: "low", color: "oklch(0.88 0.17 95)",  fx: "smile" },
  // MID
  { id: "crown",  emoji: "👑", name: "Crown",  price: 5,    tier: "mid", color: "oklch(0.85 0.16 85)",  fx: "crown" },
  { id: "ring",   emoji: "💍", name: "Ring",   price: 10,   tier: "mid", color: "oklch(0.92 0.06 95)",  fx: "ring" },
  { id: "rocket", emoji: "🚀", name: "Rocket", price: 15,   tier: "mid", color: "oklch(0.78 0.18 55)",  fx: "rocket" },
  // PREMIUM
  { id: "sapphire", emoji: "💎", name: "Sapphire", price: 25,  tier: "premium", color: "oklch(0.70 0.18 250)", fx: "sapphire" },
  { id: "ruby",     emoji: "🔴", name: "Ruby",     price: 50,  tier: "premium", color: "oklch(0.65 0.22 25)",  fx: "ruby" },
  { id: "diamond",  emoji: "💠", name: "Diamond",  price: 100, tier: "premium", color: "oklch(0.85 0.14 200)", fx: "diamond" },
];

export const giftById = (id: string) => GIFTS.find((g) => g.id === id);

// Encode a gift message in message_text so the chat can render it cinematically.
// Format: [[gift:<id>:<priceEur>]]
export const GIFT_PREFIX_RE = /^\[\[gift:([a-z]+):([\d.]+)\]\]$/i;

export function encodeGiftMessage(g: Gift): string {
  return `[[gift:${g.id}:${g.price}]]`;
}

export function decodeGiftMessage(text: string | null): Gift | null {
  if (!text) return null;
  const m = text.match(GIFT_PREFIX_RE);
  if (!m) return null;
  return giftById(m[1]) ?? null;
}
