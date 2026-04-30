import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import {
  onInstallPromptChange,
  triggerInstall,
  isStandalone,
  isIOS,
} from "@/lib/pwa";

const LS_HOME_DISMISSED_AT = "spl_home_install_dismissed_at";
const DISMISS_MS = 24 * 60 * 60 * 1000; // 24h

export function HomeInstallBanner() {
  const [installAvailable, setInstallAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden, decide in effect
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const raw = typeof window !== "undefined" ? localStorage.getItem(LS_HOME_DISMISSED_AT) : null;
    const ts = raw ? parseInt(raw, 10) : 0;
    const stillDismissed = ts && Date.now() - ts < DISMISS_MS;
    setDismissed(!!stillDismissed);
    return onInstallPromptChange(setInstallAvailable);
  }, []);

  if (installed || dismissed) return null;

  const ios = isIOS();
  // Always show banner if not installed/dismissed — fall back to manual instructions
  // when no native prompt is available (covers Android Chrome edge cases too).

  const onLater = () => {
    localStorage.setItem(LS_HOME_DISMISSED_AT, Date.now().toString());
    setDismissed(true);
  };

  const onInstall = async () => {
    if (installAvailable) {
      const outcome = await triggerInstall();
      if (outcome === "accepted") {
        setInstalled(true);
      } else if (outcome === "dismissed") {
        onLater();
      } else if (outcome === "unavailable") {
        if (ios) setShowIosHelp(true);
        else setShowAndroidHelp(true);
      }
    } else if (ios) {
      setShowIosHelp(true);
    } else {
      setShowAndroidHelp(true);
    }
  };

  return (
    <div className="mt-3 animate-[fade-in_0.4s_ease-out]">
      <div className="glass-card relative p-4">
        <button
          onClick={onLater}
          aria-label="Close"
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl"
            style={{
              background: "var(--gradient-primary)",
              color: "var(--primary-foreground)",
              boxShadow: "var(--shadow-glow)",
            }}
          >
            <Download className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <p className="text-sm font-semibold">Download Safir Private Life</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Install the app on your phone for faster access
            </p>
          </div>
        </div>

        {showIosHelp && ios && (
          <p className="mt-3 rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
            Tap <Share className="inline h-3 w-3" /> Share, then “Add to Home Screen”.
          </p>
        )}
        {showAndroidHelp && !ios && (
          <p className="mt-3 rounded-xl border border-border bg-card/40 p-3 text-xs text-muted-foreground">
            Open this app in Chrome, tap ⋮, then tap “Add to Home screen”.
          </p>
        )}

        <div className="mt-3 flex gap-2">
          <button
            onClick={onLater}
            className="flex-1 rounded-2xl border border-border py-2.5 text-xs font-medium text-muted-foreground transition hover:border-primary"
          >
            Later
          </button>
          <button
            onClick={onInstall}
            className="flex-1 rounded-2xl bg-primary py-2.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            style={{ boxShadow: "var(--shadow-glow)" }}
          >
            Install App
          </button>
        </div>
      </div>
    </div>
  );
}
