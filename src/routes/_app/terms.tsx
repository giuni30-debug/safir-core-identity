import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, X, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Safir Home Chat" },
      { name: "description", content: "Terms governing your use of Safir Home Chat." },
    ],
  }),
});

function TermsPage() {
  return (
    <div>
      <Header title="Terms & Conditions" subtitle="Last updated · 2026" />

      <Card icon={FileText} title="Acceptance">
        <p>By using Safir Home Chat you agree to these terms. If you do not agree, do not use the app.</p>
      </Card>

      <Card title="Your Account">
        <ul className="list-disc space-y-2 pl-5">
          <li>You are responsible for keeping your credentials safe.</li>
          <li>You must be legally allowed to use communication apps in your country.</li>
          <li>One person per account. Do not impersonate others.</li>
        </ul>
      </Card>

      <Card title="Acceptable Use">
        <ul className="list-disc space-y-2 pl-5">
          <li>No spam, harassment, illegal content or malware.</li>
          <li>Respect copyright and other people's privacy.</li>
          <li>We may suspend accounts that violate these rules.</li>
        </ul>
      </Card>

      <Card title="Service Availability">
        <p>
          The app is provided "as is". We work hard to keep it stable but cannot guarantee
          uninterrupted service.
        </p>
      </Card>

      <Card title="Liability">
        <p>
          To the extent permitted by law, Safir is not liable for indirect or consequential damages
          arising from the use of the app.
        </p>
      </Card>

      <Card title="Changes">
        <p>We may update these terms. Significant changes will be announced inside the app.</p>
      </Card>
    </div>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center gap-3">
      <Link to="/settings" aria-label="Back" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
        <ArrowLeft className="h-5 w-5" />
      </Link>
      <div className="flex-1">
        <h1 className="text-xl font-semibold">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Link to="/home" aria-label="Close" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
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
