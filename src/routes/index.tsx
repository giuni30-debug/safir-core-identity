import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useApp } from "@/contexts/AppContext";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, loading } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (session) navigate({ to: "/home" });
    else navigate({ to: "/login" });
  }, [session, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-muted-foreground">Loading…</div>
    </div>
  );
}
