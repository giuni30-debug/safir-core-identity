import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft, X, HelpCircle, MessageCircle, Phone, Languages, Sparkles,
  Mail, Bug, ChevronDown, LifeBuoy,
} from "lucide-react";

export const Route = createFileRoute("/_app/help")({
  component: HelpPage,
  head: () => ({
    meta: [
      { title: "Help Center — Safir Home Chat" },
      { name: "description", content: "Guides, FAQs and support for Safir Home Chat." },
    ],
  }),
});

const FAQS = [
  { q: "Why don't I receive notifications?", a: "Allow notifications in system settings and re-open the app once. Battery optimizations on Android can also block them." },
  { q: "How do I add a contact?", a: "Open Connect, search by @username, then tap Connect. Once accepted you can chat or call." },
  { q: "Are my messages private?", a: "Messages travel through secure servers and are visible only to you and the recipient. See the Privacy Policy for full details." },
  { q: "Can I use the app offline?", a: "Most features need internet. Drafts and previously loaded chats remain visible offline." },
];

const GUIDES = [
  { icon: MessageCircle, title: "How to use Chat", steps: [
    "Open Contacts and tap a person to start a chat.",
    "Type a message or hold the mic to record a voice note.",
    "Long-press a message to react or copy it.",
  ]},
  { icon: Phone, title: "How to use Calls", steps: [
    "Open a chat and tap the phone icon to call.",
    "On mobile, audio is routed to the earpiece by default.",
    "Tap the speaker icon during the call to switch output.",
  ]},
  { icon: Languages, title: "How to use Translator", steps: [
    "Open Translator from the Home screen.",
    "Pick source and target language, then type or speak.",
    "Tap the speaker icon to hear the translation aloud.",
  ]},
  { icon: Sparkles, title: "How to use All Assist (AI)", steps: [
    "Open Assistant from the Home screen.",
    "Ask anything — the AI remembers context if AI Memory is enabled.",
    "Use voice mode for hands-free conversations.",
  ]},
];

function HelpPage() {
  return (
    <div>
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Help Center</h1>
          <p className="text-xs text-muted-foreground">Guides, FAQs & support</p>
        </div>
        <Link to="/home" aria-label="Close" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <X className="h-5 w-5" />
        </Link>
      </header>

      {/* FAQ */}
      <Section icon={HelpCircle} title="Frequently Asked Questions">
        <div className="space-y-2">
          {FAQS.map((f) => <Faq key={f.q} q={f.q} a={f.a} />)}
        </div>
      </Section>

      {/* Guides */}
      <Section icon={LifeBuoy} title="Guides">
        <div className="space-y-3">
          {GUIDES.map((g) => (
            <div key={g.title} className="rounded-2xl border border-border bg-white/[0.03] p-4">
              <div className="mb-2 flex items-center gap-2">
                <g.icon className="h-4 w-4 text-[var(--theme-accent)]" />
                <h3 className="text-sm font-semibold">{g.title}</h3>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                {g.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          ))}
        </div>
      </Section>

      {/* Support */}
      <Section icon={Mail} title="Contact Support">
        <a
          href="mailto:support@safir.app?subject=Safir%20Home%20Chat%20support"
          className="press-glow glass-card glass-card-hover flex items-center gap-3 p-4"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)]">
            <Mail className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Email support</p>
            <p className="text-xs text-muted-foreground">support@safir.app</p>
          </div>
        </a>
        <a
          href="mailto:bugs@safir.app?subject=Bug%20report%20%E2%80%94%20Safir%20Home%20Chat"
          className="press-glow glass-card glass-card-hover mt-3 flex items-center gap-3 p-4"
        >
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-white/5 text-[var(--theme-accent)]">
            <Bug className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">Report a problem</p>
            <p className="text-xs text-muted-foreground">Tell us what went wrong — include steps if possible</p>
          </div>
        </a>
      </Section>
    </div>
  );
}

function Section({
  title, icon: Icon, children,
}: { title: string; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Icon className="h-4 w-4 text-[var(--theme-accent)]" />
        <p className="text-xs font-semibold uppercase tracking-wider text-foreground/90">{title}</p>
      </div>
      {children}
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="press-glow w-full rounded-2xl border border-border bg-white/[0.03] p-4 text-left transition hover:border-[var(--theme-accent)]"
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm font-medium">{q}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a}</p>}
    </button>
  );
}
