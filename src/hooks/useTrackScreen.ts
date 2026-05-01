import { useEffect } from "react";
import { track } from "@/lib/analytics";

/** Fires `track(event)` once on mount. Safe in any client component. */
export function useTrackScreen(event: string, meta?: Record<string, unknown>) {
  useEffect(() => {
    track(event, meta);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
