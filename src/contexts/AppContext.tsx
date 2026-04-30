import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { translations, type Lang, type TKey } from "@/lib/i18n";

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

  // Load preferences
  useEffect(() => {
    if (typeof window === "undefined") return;
    setLangState((localStorage.getItem(LS.lang) as Lang) || "en");
    setThemeState((localStorage.getItem(LS.theme) as ThemeColor) || "cyan");
    setBgState((localStorage.getItem(LS.bg) as BgKind) || "gradient");
    setAnimState((localStorage.getItem(LS.anim) as AnimKind) || "stars");
  }, []);

  // Apply theme attribute
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  const setLang = (l: Lang) => { setLangState(l); localStorage.setItem(LS.lang, l); };
  const setTheme = (c: ThemeColor) => { setThemeState(c); localStorage.setItem(LS.theme, c); };
  const setBg = (b: BgKind) => { setBgState(b); localStorage.setItem(LS.bg, b); };
  const setAnim = (a: AnimKind) => { setAnimState(a); localStorage.setItem(LS.anim, a); };

  const t = (k: TKey) => translations[lang][k] ?? translations.en[k];

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
