import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, X, Sparkles, Shield, Heart } from "lucide-react";

export const Route = createFileRoute("/_app/about")({
  component: AboutPage,
  head: () => ({
    meta: [
      { title: "About — Safir Home Chat" },
      { name: "description", content: "About Safir Home Chat — premium private communication." },
    ],
  }),
});

const APP_VERSION = "1.0.0";

function AboutPage() {
  return (
    <div>
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">About</h1>
          <p className="text-xs text-muted-foreground">App information</p>
        </div>
        <Link to="/home" aria-label="Close" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <X className="h-5 w-5" />
        </Link>
      </header>

      <section className="mt-8 glass-card flex flex-col items-center p-6 text-center">
        <div
          className="grid h-20 w-20 place-items-center rounded-3xl"
          style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
        >
          <Sparkles className="h-10 w-10 text-primary-foreground" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold">Safir Home Chat</h2>
        <p className="mt-1 text-xs text-muted-foreground">Version {APP_VERSION}</p>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
          A premium private communication app for chats, voice and video calls,
          translations and an AI assistant — designed to feel calm, fast and yours.
        </p>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoCard icon={Shield} title="Private by design" text="Your conversations stay between you and the people you trust." />
        <InfoCard icon={Heart} title="Built with care" text="Crafted for clarity, comfort and a beautiful daily experience." />
      </section>

      <section className="mt-6 glass-card p-5 text-center">
        <p className="text-xs text-muted-foreground">© Safir 2026 · All rights reserved.</p>
      </section>
    </div>
  );
}

function InfoCard({
  icon: Icon, title, text,
}: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="glass-card p-5">
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-[var(--theme-accent)]" />
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}
