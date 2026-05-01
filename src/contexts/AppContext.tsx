import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  type Lang, type TKey,
  resolve as resolveT,
  ensureLanguageLoaded, subscribeI18n, getLangInfo,
} from "@/lib/i18n";

export type ThemeColor = "cyan" | "blue" | "purple" | "gold" | "emerald" | "red";
export type BgKind = "gradient" | "image" | "neon";
export type AnimKind = "none" | "stars" | "glow" | "particles";
export type NeonColor = "blue" | "purple" | "pink" | "green" | "orange" | "red";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
};

type Ctx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  // settings
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (k: TKey) => string;
  theme: ThemeColor;
  setTheme: (c: ThemeColor) => void;
  bg: BgKind;
  setBg: (b: BgKind) => void;
  anim: AnimKind;
  setAnim: (a: AnimKind) => void;
  neon: NeonColor;
  setNeon: (n: NeonColor) => void;
  neonAnim: boolean;
  setNeonAnim: (v: boolean) => void;
};

const AppCtx = createContext<Ctx | null>(null);

const LS = {
  lang: "spl_lang",
  theme: "spl_theme",
  bg: "spl_bg",
  anim: "spl_anim",
  neon: "spl_neon",
  neonAnim: "spl_neon_anim",
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [lang, setLangState] = useState<Lang>("en");
  const [theme, setThemeState] = useState<ThemeColor>("cyan");
  const [bg, setBgState] = useState<BgKind>("gradient");
  const [anim, setAnimState] = useState<AnimKind>("stars");
  const [neon, setNeonState] = useState<NeonColor>("blue");
  const [neonAnim, setNeonAnimState] = useState<boolean>(true);

  // Load preferences
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLangState((localStorage.getItem(LS.lang) as Lang) || "en");
    setThemeState((localStorage.getItem(LS.theme) as ThemeColor) || "cyan");
    setBgState((localStorage.getItem(LS.bg) as BgKind) || "gradient");
    setAnimState((localStorage.getItem(LS.anim) as AnimKind) || "stars");
    setNeonState((localStorage.getItem(LS.neon) as NeonColor) || "blue");
    setNeonAnimState(localStorage.getItem(LS.neonAnim) !== "0");
  }, []);

  // Apply theme attribute
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LS.lang, l);
    // Kick off AI translation load for non-native languages
    void ensureLanguageLoaded(l);
    // Update <html lang> + dir for accessibility / RTL
    if (typeof document !== "undefined") {
      const info = getLangInfo(l);
      document.documentElement.setAttribute("lang", l);
      document.documentElement.setAttribute("dir", info.rtl ? "rtl" : "ltr");
    }
  };
  const setTheme = (c: ThemeColor) => { setThemeState(c); localStorage.setItem(LS.theme, c); };
  const setBg = (b: BgKind) => { setBgState(b); localStorage.setItem(LS.bg, b); };
  const setAnim = (a: AnimKind) => { setAnimState(a); localStorage.setItem(LS.anim, a); };
  const setNeon = (n: NeonColor) => { setNeonState(n); localStorage.setItem(LS.neon, n); };
  const setNeonAnim = (v: boolean) => { setNeonAnimState(v); localStorage.setItem(LS.neonAnim, v ? "1" : "0"); };

  // Re-render when AI translations finish loading
  const [, force] = useState(0);
  useEffect(() => subscribeI18n(() => force((n) => n + 1)), []);
  // Ensure current language is loaded on mount + on change
  useEffect(() => { void ensureLanguageLoaded(lang); }, [lang]);

  const t = (k: TKey) => resolveT(lang, k);

  const loadProfile = async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, email")
      .eq("id", uid)
      .maybeSingle();
    setProfile(data ?? null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  // Auth listener
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s?.user) {
        // defer DB call
        setTimeout(() => loadProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user.id);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AppCtx.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        loading,
        refreshProfile,
        signOut,
        lang, setLang, t,
        theme, setTheme,
        bg, setBg,
        anim, setAnim,
        neon, setNeon,
        neonAnim, setNeonAnim,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
