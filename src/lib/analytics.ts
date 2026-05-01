// Lightweight, local-only analytics. No backend changes.
// Events are persisted in localStorage and exposed via getEvents() / getStats().

export type AnalyticsEvent = {
  id: string;
  name: string;
  ts: number;
  userId?: string | null;
  meta?: Record<string, unknown>;
};

const STORAGE_KEY = "spl_analytics_events_v1";
const SESSION_KEY = "spl_analytics_session_v1";
const MAX_EVENTS = 1000;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readAll(): AnalyticsEvent[] {
  if (typeof window === "undefined") return [];
  return safeParse<AnalyticsEvent[]>(localStorage.getItem(STORAGE_KEY), []);
}

function writeAll(events: AnalyticsEvent[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = events.slice(-MAX_EVENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    window.dispatchEvent(new CustomEvent("spl-analytics-updated"));
  } catch {
    // ignore quota errors
  }
}

let currentUserId: string | null = null;
export function setAnalyticsUser(id: string | null) {
  currentUserId = id;
}

export function track(name: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const evt: AnalyticsEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    ts: Date.now(),
    userId: currentUserId,
    meta,
  };
  const all = readAll();
  all.push(evt);
  writeAll(all);
}

export function trackError(source: string, error: unknown, extra?: Record<string, unknown>) {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown error";
  const stack = error instanceof Error ? error.stack : undefined;
  track("error", { source, message, stack, ...extra });
}

export function getEvents(): AnalyticsEvent[] {
  return readAll().slice().reverse();
}

export function clearEvents() {
  writeAll([]);
}

export type AnalyticsStats = {
  totalAppOpens: number;
  totalEvents: number;
  activeUsers: number;
  activeUsers24h: number;
  moduleCounts: { name: string; count: number }[];
  errors: AnalyticsEvent[];
  lastActivity: AnalyticsEvent | null;
};

const MODULE_EVENTS: Record<string, string> = {
  home_opened: "Home",
  chat_opened: "Chat",
  translator_opened: "Translator",
  assistant_opened: "AI Assist",
  shopping_opened: "Shopping",
  wallet_opened: "Wallet",
  settings_opened: "Settings",
  expenses_opened: "Expenses",
  calendar_opened: "Calendar",
  notes_opened: "Notes",
  call_button_tapped: "Call button",
  video_button_tapped: "Video button",
};

export function getStats(): AnalyticsStats {
  const events = readAll();
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  const totalAppOpens = events.filter((e) => e.name === "app_opened").length;
  const userIds = new Set<string>();
  const userIds24h = new Set<string>();
  for (const e of events) {
    if (e.userId) {
      userIds.add(e.userId);
      if (e.ts >= dayAgo) userIds24h.add(e.userId);
    }
  }

  const counts = new Map<string, number>();
  for (const e of events) {
    const label = MODULE_EVENTS[e.name];
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const moduleCounts = Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const errors = events.filter((e) => e.name === "error").slice(-50).reverse();
  const lastActivity = events.length ? events[events.length - 1] : null;

  return {
    totalAppOpens,
    totalEvents: events.length,
    activeUsers: userIds.size,
    activeUsers24h: userIds24h.size,
    moduleCounts,
    errors,
    lastActivity,
  };
}

export function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => cb();
  window.addEventListener("spl-analytics-updated", handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener("spl-analytics-updated", handler);
    window.removeEventListener("storage", handler);
  };
}

// Initialize once per browser session: app_opened + global error capture.
export function initAnalytics() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __splAnalyticsInit?: boolean };
  if (w.__splAnalyticsInit) return;
  w.__splAnalyticsInit = true;

  const session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    sessionStorage.setItem(SESSION_KEY, String(Date.now()));
    track("app_opened", { ua: navigator.userAgent });
  }

  window.addEventListener("error", (e) => {
    trackError("window.onerror", e.error ?? e.message, {
      filename: e.filename,
      lineno: e.lineno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    trackError("unhandledrejection", e.reason);
  });
}
