import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/admin/affiliates")({
  component: AffiliatesAdminPage,
  head: () => ({
    meta: [
      { title: "Affiliate Manager — Safir" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

type Row = {
  id: string;
  network: string;
  label: string;
  description: string | null;
  url: string;
  icon: string | null;
  accent_color: string;
  enabled: boolean;
  sort_order: number;
};

function AffiliatesAdminPage() {
  const { isAdmin, loading } = useIsAdmin();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!isAdmin) {
      toast.error("Admin access required");
      navigate({ to: "/settings" });
      return;
    }
    void load();
  }, [isAdmin, loading, navigate]);

  const load = async () => {
    const { data } = await supabase
      .from("affiliate_settings")
      .select("*")
      .order("sort_order", { ascending: true });
    setRows(data ?? []);
  };

  const update = (id: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const save = async (r: Row) => {
    setBusy(r.id);
    const { error } = await supabase
      .from("affiliate_settings")
      .update({
        label: r.label,
        description: r.description,
        url: r.url,
        icon: r.icon,
        accent_color: r.accent_color,
        enabled: r.enabled,
        sort_order: r.sort_order,
      })
      .eq("id", r.id);
    setBusy(null);
    if (error) toast.error(error.message);
    else toast.success(`${r.label} saved`);
  };

  const remove = async (r: Row) => {
    if (!confirm(`Delete ${r.label}?`)) return;
    const { error } = await supabase.from("affiliate_settings").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    void load();
  };

  const addNew = async () => {
    const network = prompt("Network slug (e.g. ebay)")?.trim().toLowerCase();
    if (!network) return;
    const label = prompt("Display label")?.trim();
    if (!label) return;
    const url = prompt("Affiliate URL")?.trim();
    if (!url) return;
    const { error } = await supabase.from("affiliate_settings").insert({
      network,
      label,
      url,
      sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    toast.success("Added");
    void load();
  };

  if (loading) {
    return <div className="p-6 text-center text-white/60">Loading…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-white/60">
        <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
        Admin access required
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-background/60 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/settings" className="rounded-full p-2 hover:bg-white/5" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-lg font-semibold text-gradient">Affiliate Manager</h1>
          <button
            onClick={addNew}
            className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-primary/20 px-3 py-1.5 text-xs hover:bg-primary/30"
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-6">
        {rows.map((r) => (
          <div key={r.id} className="glass-premium space-y-3 p-4">
            <div className="flex items-center gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg"
                style={{
                  background: `linear-gradient(135deg, ${r.accent_color}, color-mix(in oklab, ${r.accent_color} 45%, #000))`,
                  boxShadow: `0 0 10px ${r.accent_color}`,
                }}
              >
                {r.icon ?? "★"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.label}</p>
                <p className="text-[10px] uppercase tracking-wider text-white/50">{r.network}</p>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => update(r.id, { enabled: e.target.checked })}
                  className="h-5 w-9 cursor-pointer appearance-none rounded-full bg-white/10 transition-all checked:bg-emerald-500 relative before:absolute before:left-0.5 before:top-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
                />
                {r.enabled ? "On" : "Off"}
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Field label="Label" value={r.label} onChange={(v) => update(r.id, { label: v })} />
              <Field label="Icon (emoji)" value={r.icon ?? ""} onChange={(v) => update(r.id, { icon: v })} />
              <Field label="URL" value={r.url} onChange={(v) => update(r.id, { url: v })} className="col-span-2" />
              <Field
                label="Description"
                value={r.description ?? ""}
                onChange={(v) => update(r.id, { description: v })}
                className="col-span-2"
              />
              <Field
                label="Accent (oklch / hex)"
                value={r.accent_color}
                onChange={(v) => update(r.id, { accent_color: v })}
              />
              <Field
                label="Order"
                type="number"
                value={String(r.sort_order)}
                onChange={(v) => update(r.id, { sort_order: Number(v) || 0 })}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => save(r)}
                disabled={busy === r.id}
                className="press-glow inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/20 px-3 py-2 text-sm font-medium hover:bg-primary/30 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> {busy === r.id ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => remove(r)}
                className="press-glow inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <p className="py-8 text-center text-sm text-white/50">No affiliate offers yet.</p>
        )}
      </main>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-white/50">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm outline-none focus:border-primary/50"
      />
    </label>
  );
}
