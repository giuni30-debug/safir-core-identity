type Props = { url?: string | null; name: string; size?: number; className?: string };

export function Avatar({ url, name, size = 48, className = "" }: Props) {
  const initial = (name || "?").trim().charAt(0).toUpperCase();
  return (
    <div
      className={`flex items-center justify-center rounded-full overflow-hidden font-semibold text-primary-foreground shrink-0 ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        background: "var(--gradient-primary)",
        boxShadow: "var(--shadow-glow)",
      }}
    >
      {url ? (
        <img src={url} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span>{initial}</span>
      )}
    </div>
  );
}
