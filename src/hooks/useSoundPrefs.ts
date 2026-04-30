import { useEffect, useState, useCallback } from "react";
import {
  getSoundPrefs,
  setSoundPrefs as setSoundPrefsCore,
  subscribeSoundPrefs,
  type SoundPrefs,
} from "@/lib/sound";

/**
 * React hook to read & update the user's sound/haptics preferences.
 * Subscribes to changes so multiple Settings panels stay in sync.
 */
export function useSoundPrefs(): {
  prefs: SoundPrefs;
  setPrefs: (patch: Partial<SoundPrefs>) => void;
} {
  const [prefs, setPrefs] = useState<SoundPrefs>(() => getSoundPrefs());

  useEffect(() => {
    const off = subscribeSoundPrefs((p) => setPrefs(p));
    return () => {
      off();
    };
  }, []);

  const update = useCallback((patch: Partial<SoundPrefs>) => {
    setSoundPrefsCore(patch);
  }, []);

  return { prefs, setPrefs: update };
}
