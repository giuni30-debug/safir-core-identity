import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { CallProvider } from "@/contexts/CallContext";

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

function AppLayout() {
  return (
    <CallProvider>
      <div className="app-shell">
        <div className="app-frame">
          <Outlet />
        </div>
      </div>
    </CallProvider>
  );
}

export { Link };
