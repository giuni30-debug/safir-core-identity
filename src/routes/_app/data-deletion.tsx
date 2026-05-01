import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, X, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/data-deletion")({
  component: DataDeletionPage,
  head: () => ({
    meta: [
      { title: "Data & Account Deletion — Safir Home Chat" },
      { name: "description", content: "Learn how to delete your data or remove your account permanently." },
    ],
  }),
});

function DataDeletionPage() {
  const { signOut } = useApp();
  const navigate = useNavigate();

  const onDelete = async () => {
    if (!confirm("This permanently deletes your account and data.")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from("profiles").delete().eq("id", user.id);
    await supabase.auth.signOut();
    toast.success("Account removed");
    navigate({ to: "/login" });
  };

  return (
    <div>
      <header className="flex items-center gap-3">
        <Link to="/settings" aria-label="Back" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-semibold">Data & Account Deletion</h1>
          <p className="text-xs text-muted-foreground">Manage your data lifecycle</p>
        </div>
        <Link to="/home" aria-label="Close" className="press-glow grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40 backdrop-blur-xl">
          <X className="h-5 w-5" />
        </Link>
      </header>

      <section className="mt-6 glass-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-[var(--theme-accent)]" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">What gets deleted</h2>
        </div>
        <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
          <li>Profile, username, avatar and email association</li>
          <li>All chats, voice notes, calls and reactions you authored</li>
          <li>AI memory, notes, expenses, calendar and shopping items</li>
          <li>Your authentication credentials</li>
        </ul>
      </section>

      <section className="mt-6 glass-card p-5">
        <div className="mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Important</h2>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Deletion is immediate and cannot be reversed. Messages already received by other users
          remain in their inbox. For an export of your data before deletion contact{" "}
          <span className="text-[var(--theme-accent)]">support@safir.app</span>.
        </p>
      </section>

      <section className="mt-6 glass-card p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Delete now</h2>
        <button
          onClick={onDelete}
          className="press-glow flex w-full items-center justify-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm font-medium text-destructive transition hover:bg-destructive/20"
        >
          <Trash2 className="h-4 w-4" />
          Delete my account permanently
        </button>
        <button
          onClick={async () => { await signOut(); navigate({ to: "/login" }); }}
          className="press-glow mt-3 w-full rounded-2xl border border-border bg-white/[0.03] p-4 text-sm font-medium hover:border-[var(--theme-accent)]"
        >
          Just log out instead
        </button>
      </section>
    </div>
  );
}
