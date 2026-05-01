import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, X, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_app/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Safir Home Chat" },
      { name: "description", content: "How Safir Home Chat collects, uses and protects your data." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <div>
      <LegalHeader title="Privacy Policy" subtitle="Last updated · 2026" />

      <Card icon={ShieldCheck} title="Overview">
        <p>
          Safir Home Chat respects your privacy. This policy explains what data we collect,
          how we use it, and the choices you have. We collect the minimum required to run the app.
        </p>
      </Card>

      <Card title="Data We Collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>Account info: email, username, display name, avatar.</li>
          <li>Chats, calls and notes you create inside the app.</li>
          <li>Device info needed for notifications and audio routing.</li>
        </ul>
      </Card>

      <Card title="How We Use Data">
        <ul className="list-disc space-y-2 pl-5">
          <li>To deliver messages, calls and translations between you and your contacts.</li>
          <li>To keep your session secure and prevent abuse.</li>
          <li>To personalize theme, language and AI memory if enabled.</li>
        </ul>
      </Card>

      <Card title="Sharing">
        <p>
          We do not sell your personal data. Data is shared only with infrastructure providers
          (hosting, AI, voice) strictly to operate features you use.
        </p>
      </Card>

      <Card title="Your Rights">
        <ul className="list-disc space-y-2 pl-5">
          <li>Access, edit or delete your profile at any time from Settings.</li>
          <li>Delete your account permanently — this removes all your data.</li>
          <li>Contact support for data export requests.</li>
        </ul>
      </Card>

      <Card title="Contact">
        <p>For privacy questions write to <span className="text-[var(--theme-accent)]">privacy@safir.app</span>.</p>
      </Card>
    </div>
  );
}

function LegalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link
        to="/settings"
        aria-label="Back"
        className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
      >
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Link
        to="/home"
        aria-label="Close"
        className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl"
      >
        <X className="h-5 w-5" />
      </Link>
    </header>
  );
}

function Card({
  title, icon: Icon, children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 glass-card p-5">
      <div className="mb-2 flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-[var(--theme-accent)]" />}
        <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
