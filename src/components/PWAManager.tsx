import { useEffect, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  registerPWA,
  onInstallPromptChange,
  triggerInstall,
  isStandalone,
  isIOS,
} from "@/lib/pwa";
import { Download, RefreshCw, Share, X } from "lucide-react";

const LS_DISMISSED = "spl_install_dismissed";

export function PWAManager() {
  const location = useLocation();
  const [installAvailable, setInstallAvailable] = useState(false);
  const [showInstall, setShowInstall] = useState(false);
  const [updateReload, setUpdateReload] = useState<null | (() => void)>(null);
  const [iosHint, setIosHint] = useState(false);

  // Register SW + capture update events
  useEffect(() => {
    registerPWA((reload) => setUpdateReload(() => reload));
  }, []);

  // Listen for install prompt availability
  useEffect(() => onInstallPromptChange(setInstallAvailable), []);

  // Decide whether to show the install banner.
  // Rules: only on /home, never if already installed, never if previously dismissed.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (location.pathname !== "/home") {
      setShowInstall(false);
      setIosHint(false);
      return;
    }
    if (isStandalone()) return;
    const dismissed = localStorage.getItem(LS_DISMISSED) === "1";
    if (dismissed) return;

    if (installAvailable) {
      setShowInstall(true);
    } else if (isIOS()) {
      // iOS Safari has no beforeinstallprompt — show "Add to Home Screen" hint.
      setIosHint(true);
    }
  }, [location.pathname, installAvailable]);

  const dismiss = () => {
    localStorage.setItem(LS_DISMISSED, "1");
    setShowInstall(false);
    setIosHint(false);
  };

  const install = async () => {
    const outcome = await triggerInstall();
    if (outcome === "accepted" || outcome === "dismissed") {
      localStorage.setItem(LS_DISMISSED, "1");
      setShowInstall(false);
    }
  };

  return (
    <>
      {/* Update banner */}
      {updateReload && (
        <div
          className="fixed left-1/2 z-50 w-[min(92vw,28rem)] -translate-x-1/2 animate-[fade-in_0.3s_ease-out]"
          style={{ top: "calc(env(safe-area-inset-top) + 0.75rem)" }}
        >
          <div className="glass-card flex items-center gap-3 p-3">
            <div
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
              style={{
                background: "color-mix(in oklab, var(--theme-accent) 15%, transparent)",
                color: "var(--theme-accent)",
              }}
            >
              <RefreshCw className="h-4 w-4" />
            </div>
            <p className="flex-1 text-sm font-medium">New update available</p>
            <button
              onClick={updateReload}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Update now
            </button>
          </div>
        </div>
      )}

      {/* Install banner (Android / desktop Chrome) */}
      {showInstall && (
        <div
          className="fixed left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 animate-[fade-in_0.4s_ease-out]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <div className="glass-card p-4">
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "var(--gradient-primary)",
                  color: "var(--primary-foreground)",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                <Download className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Install Safir</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Get the full-screen app on your home screen.
                </p>
              </div>
              <button onClick={dismiss} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={dismiss}
                className="flex-1 rounded-2xl border border-border py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary"
              >
                Later
              </button>
              <button
                onClick={install}
                className="flex-1 rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                style={{ boxShadow: "var(--shadow-glow)" }}
              >
                Install App
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS hint banner */}
      {iosHint && !showInstall && (
        <div
          className="fixed left-1/2 z-40 w-[min(92vw,28rem)] -translate-x-1/2 animate-[fade-in_0.4s_ease-out]"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
        >
          <div className="glass-card p-4">
            <div className="flex items-start gap-3">
              <div
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
                style={{
                  background: "var(--gradient-primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <Share className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">Install Safir</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tap <Share className="inline h-3 w-3" /> Share, then "Add to Home Screen".
                </p>
              </div>
              <button onClick={dismiss} aria-label="Close" className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
