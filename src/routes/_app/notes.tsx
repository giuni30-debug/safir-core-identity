import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Plus, Search, Pin, Trash2, X } from "lucide-react";

export const Route = createFileRoute("/_app/notes")({
  component: Notes,
  head: () => ({
    meta: [
      { title: "Notes — Safir Private Life" },
      { name: "description", content: "Premium private notes." },
    ],
  }),
});

type Note = {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  updated: string;
};

const LS = "spl_notes_v1";

function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Note | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(LS);
      setNotes(raw ? JSON.parse(raw) : []);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS, JSON.stringify(notes));
  }, [notes]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const arr = ql
      ? notes.filter((n) => n.title.toLowerCase().includes(ql) || n.body.toLowerCase().includes(ql))
      : notes;
    return [...arr].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updated.localeCompare(a.updated);
    });
  }, [notes, q]);

  function create() {
    const n: Note = { id: crypto.randomUUID(), title: "", body: "", pinned: false, updated: new Date().toISOString() };
    setNotes((p) => [n, ...p]);
    setEditing(n);
  }
  function save(n: Note) {
    setNotes((p) => p.map((x) => (x.id === n.id ? { ...n, updated: new Date().toISOString() } : x)));
  }
  function remove(id: string) {
    setNotes((p) => p.filter((x) => x.id !== id));
    if (editing?.id === id) setEditing(null);
  }
  function pin(id: string) {
    setNotes((p) => p.map((x) => (x.id === id ? { ...x, pinned: !x.pinned } : x)));
  }

  if (editing) return <Editor note={editing} onChange={save} onClose={() => setEditing(null)} onDelete={() => remove(editing.id)} />;

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.4s_ease-out] pb-24">
      <header className="flex items-center gap-3 py-1">
        <Link to="/home" aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-lg font-semibold">Notes</h1>
      </header>

      <div className="input-pill mt-4 flex items-center gap-2 px-4 py-2.5">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {filtered.length === 0 && (
          <p className="col-span-2 py-10 text-center text-sm text-muted-foreground">No notes yet</p>
        )}
        {filtered.map((n, i) => (
          <button
            key={n.id}
            onClick={() => setEditing(n)}
            className="glass-card glass-card-hover tile-press flex h-40 flex-col items-start gap-2 p-3 text-left"
            style={{ borderRadius: 18, animation: `scale-in 0.25s ease-out ${i * 35}ms both` }}
          >
            <div className="flex w-full items-center justify-between">
              <p className="line-clamp-1 text-sm font-semibold">{n.title || "Untitled"}</p>
              {n.pinned && <Pin className="h-3.5 w-3.5" style={{ color: "var(--theme-accent)" }} />}
            </div>
            <p className="line-clamp-4 flex-1 text-xs text-muted-foreground">{n.body || "Empty note"}</p>
            <p className="text-[10px] text-muted-foreground/70">{new Date(n.updated).toLocaleDateString()}</p>
          </button>
        ))}
      </div>

      <button
        onClick={create}
        aria-label="Add note"
        className="neon-circle press-glow fixed bottom-20 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  );
}

function Editor({ note, onChange, onClose, onDelete }: { note: Note; onChange: (n: Note) => void; onClose: () => void; onDelete: () => void }) {
  const [local, setLocal] = useState(note);

  // Auto-save (debounced)
  useEffect(() => {
    const t = setTimeout(() => onChange(local), 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local.title, local.body, local.pinned]);

  return (
    <div className="flex min-h-full flex-col animate-[fade-in_0.3s_ease-out] pb-6">
      <header className="flex items-center gap-2 py-1">
        <button onClick={onClose} aria-label="Back" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1" />
        <button onClick={() => setLocal({ ...local, pinned: !local.pinned })} aria-label="Pin" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40" style={local.pinned ? { color: "var(--theme-accent)", borderColor: "var(--theme-accent)" } : {}}>
          <Pin className="h-5 w-5" />
        </button>
        <button onClick={onDelete} aria-label="Delete" className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card/40">
          <Trash2 className="h-5 w-5" />
        </button>
      </header>

      <input
        autoFocus
        value={local.title}
        onChange={(e) => setLocal({ ...local, title: e.target.value })}
        placeholder="Title"
        className="mt-4 w-full bg-transparent text-2xl font-bold outline-none placeholder:text-muted-foreground/60"
      />
      <p className="mt-1 text-xs text-muted-foreground">{new Date(local.updated).toLocaleString()}</p>

      <textarea
        value={local.body}
        onChange={(e) => setLocal({ ...local, body: e.target.value })}
        placeholder="Start writing…"
        className="mt-4 w-full flex-1 resize-none bg-transparent text-base leading-relaxed outline-none placeholder:text-muted-foreground/60"
        style={{ minHeight: "60vh" }}
      />
    </div>
  );
}
