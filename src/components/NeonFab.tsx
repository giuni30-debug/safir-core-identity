import { Plus, type LucideIcon } from "lucide-react";

type Props = {
  onClick: () => void;
  ariaLabel: string;
  icon?: LucideIcon;
};

/**
 * Premium neon Floating Action Button — consistent across all modules.
 * Apply per-route to keep the "+" context-aware (Add expense / event / note / etc).
 */
export function NeonFab({ onClick, ariaLabel, icon: Icon = Plus }: Props) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      className="press-glow fixed bottom-6 right-5 z-30 grid h-16 w-16 place-items-center rounded-full text-white transition-transform active:scale-90"
      style={{
        background:
          "linear-gradient(135deg, var(--theme-accent), color-mix(in oklab, var(--theme-accent) 45%, #000))",
        boxShadow:
          "0 0 0 4px color-mix(in oklab, var(--theme-accent) 18%, transparent), 0 0 30px color-mix(in oklab, var(--theme-accent) 60%, transparent), 0 12px 40px oklch(0 0 0 / 55%), inset 0 1px 0 oklch(1 0 0 / 25%)",
        animation: "logo-breath 3s ease-in-out infinite",
      }}
    >
      <Icon className="h-7 w-7" strokeWidth={2.4} />
    </button>
  );
}
