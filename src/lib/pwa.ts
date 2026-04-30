// PWA registration helper.
// IMPORTANT: never register the SW inside the Lovable editor preview (iframe / preview hostnames),
// or it will cache stale builds and break live edits.

import type { Workbox } from "workbox-window";

let wb: Workbox | null = null;

export function isPreviewEnvironment(): boolean {
  if (typeof window === "undefined") return true;
  const inIframe = (() => {
    try { return window.self !== window.top; } catch { return true; }
  })();
  const host = window.location.hostname;
  const isPreviewHost =
    host.includes("id-preview--") ||
    host.includes("lovableproject.com") ||
    host.includes("lovable.dev") ||
    host === "localhost" ||
    host === "127.0.0.1";
  return inIframe || isPreviewHost;
}

type UpdateCallback = (reload: () => void) => void;

export async function registerPWA(onUpdate?: UpdateCallback) {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewEnvironment()) {
    // Defensive: clean up any SW that previously snuck in.
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    } catch {
      /* ignore */
    }
    return;
  }

  try {
    const { Workbox } = await import("workbox-window");
    wb = new Workbox("/sw.js");

    wb.addEventListener("waiting", () => {
      onUpdate?.(() => {
        if (!wb) return;
        wb.addEventListener("controlling", () => window.location.reload());
        wb.messageSkipWaiting();
      });
    });

    await wb.register();
  } catch (err) {
    console.warn("[pwa] registration failed", err);
  }
}

// beforeinstallprompt capture (Chromium / Android)
type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BIPEvent | null = null;
const promptListeners = new Set<(available: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BIPEvent;
    console.log("Install prompt ready");
    promptListeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    promptListeners.forEach((fn) => fn(false));
  });
}

export function onInstallPromptChange(fn: (available: boolean) => void) {
  promptListeners.add(fn);
  fn(!!deferredPrompt);
  return () => {
    promptListeners.delete(fn);
  };
}

export async function triggerInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  promptListeners.forEach((fn) => fn(false));
  return choice.outcome;
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window);
}
