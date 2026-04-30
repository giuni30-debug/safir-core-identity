import { createFileRoute, Link, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CallProvider } from "@/contexts/CallContext";
import { useApp } from "@/contexts/AppContext";
import { usePresenceHeartbeat } from "@/hooks/usePresence";
import { initSoundEngine } from "@/lib/sound";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  const location = useLocation();
  const { user } = useApp();
  // Broadcast online presence while signed in & inside the app
  usePresenceHeartbeat(user?.id ?? null);

  // Preload premium sound pack once on app entry
  useEffect(() => {
    initSoundEngine();
  }, []);

  return (
    <CallProvider>
      <div className="app-shell">
        <div className="app-frame">
          {/* keyed wrapper triggers smooth page-enter on every navigation */}
          <div key={location.pathname} className="page-enter flex min-h-0 flex-1 flex-col">
            <Outlet />
          </div>
        </div>
      </div>
    </CallProvider>
  );
}

export { Link };
