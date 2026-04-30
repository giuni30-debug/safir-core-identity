import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppProvider } from "@/contexts/AppContext";
import { BackgroundFX } from "@/components/BackgroundFX";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card max-w-md p-10 text-center">
        <h1 className="text-7xl font-bold neon-text">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Safir Private Life" },
      { name: "description", content: "A premium private life companion. Connect, chat, and organize your world." },
      { name: "theme-color", content: "#0a0e14" },
      { property: "og:title", content: "Safir Private Life" },
      { property: "og:description", content: "A premium private life companion. Connect, chat, and organize your world." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "Safir Private Life" },
      { name: "twitter:description", content: "A premium private life companion. Connect, chat, and organize your world." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4690378f-87f4-45e8-b069-0299df76a2b3/id-preview-ddda5fcb--c37270b2-ee89-406c-9f05-d457f52c1094.lovable.app-1777509627875.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/4690378f-87f4-45e8-b069-0299df76a2b3/id-preview-ddda5fcb--c37270b2-ee89-406c-9f05-d457f52c1094.lovable.app-1777509627875.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="cyan">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AppProvider>
      <BackgroundFX />
      <Outlet />
      <Toaster />
    </AppProvider>
  );
}
