import { type LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
};

/**
 * Premium neon empty state.
 * Reused across Expenses / Appointments / Notes / Contacts / Chat history.
 */
export function EmptyState({ icon: Icon, title, subtitle, ctaLabel, onCta }: Props) {
  return (
    <div className="glass-card mt-6 grid place-items-center p-10 text-center animate-[fade-in_0.4s_ease-out]">
      <div className="relative mb-5">
        <div
          className="absolute inset-0 -z-10 rounded-full blur-2xl"
          style={{ background: "color-mix(in oklab, var(--theme-accent) 45%, transparent)" }}
        />
        <div
          className="grid h-20 w-20 place-items-center rounded-3xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--theme-accent) 28%, transparent), color-mix(in oklab, var(--theme-accent) 6%, transparent))",
            border: "1.5px solid color-mix(in oklab, var(--theme-accent) 55%, transparent)",
            boxShadow:
              "0 0 28px color-mix(in oklab, var(--theme-accent) 50%, transparent), inset 0 1px 0 oklch(1 0 0 / 18%)",
            animation: "logo-breath 3.6s ease-in-out infinite",
          }}
        >
          <Icon
            className="h-9 w-9"
            style={{
              color: "var(--theme-accent)",
              filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--theme-accent) 70%, transparent))",
            }}
          />
        </div>
      </div>
      <p
        className="text-base font-semibold tracking-wide text-foreground"
        style={{ textShadow: "0 0 14px color-mix(in oklab, var(--theme-accent) 40%, transparent)" }}
      >
        {title}
      </p>
      {subtitle && (
        <p className="mt-1.5 max-w-[260px] text-xs leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      )}
      {ctaLabel && onCta && (
        <button
          onClick={onCta}
          className="press-glow mt-5 rounded-2xl px-5 py-2.5 text-sm font-semibold text-white transition-transform active:scale-95"
          style={{
            background:
              "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 50%, #000))",
            boxShadow:
              "0 0 22px color-mix(in oklab, var(--theme-accent) 55%, transparent), inset 0 1px 0 oklch(1 0 0 / 25%)",
          }}
        >
          {ctaLabel}
        </button>
      )}
    </div>
  );
}
