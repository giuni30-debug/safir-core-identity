import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";

type Offer = {
  id: string;
  network: string;
  label: string;
  description: string | null;
  url: string;
  icon: string | null;
  accent_color: string;
};

export function AffiliateOffersCard() {
  const [offers, setOffers] = useState<Offer[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("affiliate_settings")
        .select("id, network, label, description, url, icon, accent_color")
        .eq("enabled", true)
        .order("sort_order", { ascending: true });
      setOffers(data ?? []);
    })();
  }, []);

  if (offers.length === 0) return null;

  return (
    <section className="relative z-10 mt-3 rounded-3xl p-4"
      style={{
        background:
          "linear-gradient(135deg, oklch(1 0 0 / 8%) 0%, oklch(0.78 0.16 60 / 8%) 50%, oklch(1 0 0 / 4%) 100%)",
        border: "1.5px solid oklch(0.78 0.16 60 / 35%)",
        backdropFilter: "blur(28px) saturate(160%)",
        WebkitBackdropFilter: "blur(28px) saturate(160%)",
        boxShadow:
          "0 0 24px oklch(0.78 0.16 60 / 22%), 0 12px 40px oklch(0 0 0 / 50%), inset 0 1px 0 oklch(1 0 0 / 12%)",
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold tracking-wide text-white"
          style={{ textShadow: "0 0 10px oklch(0.78 0.16 60 / 50%)" }}>
          Partner offers
        </p>
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
          Curated
        </span>
      </div>

      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {offers.map((o) => (
          <a
            key={o.id}
            href={o.url}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() => track("affiliate_click", { network: o.network })}
            className="press-glow group relative flex w-[120px] shrink-0 flex-col items-center gap-1.5 rounded-2xl px-2 py-3 text-center transition-transform active:scale-95"
            style={{
              background:
                "linear-gradient(160deg, oklch(1 0 0 / 10%) 0%, oklch(1 0 0 / 3%) 100%)",
              border: `1.5px solid ${o.accent_color}`,
              backdropFilter: "blur(20px) saturate(160%)",
              WebkitBackdropFilter: "blur(20px) saturate(160%)",
              boxShadow: `0 0 14px color-mix(in oklab, ${o.accent_color} 40%, transparent), inset 0 1px 0 oklch(1 0 0 / 12%)`,
            }}
          >
            <div
              className="grid h-11 w-11 place-items-center rounded-2xl text-xl"
              style={{
                background: `linear-gradient(135deg, ${o.accent_color}, color-mix(in oklab, ${o.accent_color} 45%, #000))`,
                boxShadow: `0 0 12px ${o.accent_color}, inset 0 1px 0 oklch(1 0 0 / 25%)`,
              }}
            >
              {o.icon ?? "★"}
            </div>
            <p className="text-[11px] font-bold tracking-wide text-white"
              style={{ textShadow: `0 0 8px color-mix(in oklab, ${o.accent_color} 60%, transparent)` }}>
              {o.label}
            </p>
            {o.description && (
              <p className="text-[9px] leading-tight text-white/55 line-clamp-2">{o.description}</p>
            )}
            <ExternalLink className="absolute right-1.5 top-1.5 h-3 w-3 opacity-50" />
          </a>
        ))}
      </div>
      <p className="mt-2 text-center text-[9px] tracking-wide text-white/40">
        Sponsored partners — we may earn a commission
      </p>
    </section>
  );
}
