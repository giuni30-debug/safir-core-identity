import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";

export const Route = createFileRoute("/_app/notifications")({
  component: NotifPage,
  head: () => ({
    meta: [
      { title: "Notifications — Safir Private Life" },
      { name: "description", content: "Manage notification preferences." },
    ],
  }),
});

function NotifPage() {
  const { t } = useApp();
  const [push, setPush] = useState(true);
  const [email, setEmail] = useState(false);
  const [sound, setSound] = useState(true);

  return (
    <div className="animate-[fade-in_0.4s_ease-out]">
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-semibold">{t("notifications")}</h1>
      </header>

      <div className="mt-6 space-y-3">
        <Toggle label="Push" value={push} onChange={setPush} />
        <Toggle label="Email" value={email} onChange={setEmail} />
        <Toggle label="Sound" value={sound} onChange={setSound} />
      </div>
    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="glass-card flex items-center justify-between p-4">
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`relative h-7 w-12 rounded-full transition ${value ? "bg-primary" : "bg-muted"}`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-background transition-all ${value ? "left-6" : "left-1"}`}
        />
      </button>
    </div>
  );
}
