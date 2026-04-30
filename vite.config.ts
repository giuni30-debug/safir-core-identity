// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  vite: {
    plugins: [
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        // Disable in dev so the SW never loads inside the Lovable preview iframe.
        devOptions: { enabled: false },
        includeAssets: [
          "favicon.ico",
          "icons/apple-touch-icon.png",
          "offline.html",
        ],
        manifest: {
          name: "Safir Private Life",
          short_name: "Safir",
          description: "Personal private life app",
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: "#000000",
          background_color: "#000000",
          lang: "en",
          icons: [
            {
              src: "/icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/icons/maskable-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        workbox: {
          // Never let the SW intercept these routes.
          navigateFallback: "/offline.html",
          navigateFallbackDenylist: [
            /^\/~oauth/,
            /^\/api\//,
            /^\/sw\.js$/,
            /^\/workbox-/,
          ],
          globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
          // NetworkFirst for HTML so users always get fresh app shells when online.
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === "navigate",
              handler: "NetworkFirst",
              options: {
                cacheName: "html-cache",
                networkTimeoutSeconds: 3,
                expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
            {
              urlPattern: ({ request }) =>
                ["style", "script", "worker"].includes(request.destination),
              handler: "StaleWhileRevalidate",
              options: { cacheName: "asset-cache" },
            },
            {
              urlPattern: ({ request }) =>
                ["image", "font"].includes(request.destination),
              handler: "CacheFirst",
              options: {
                cacheName: "media-cache",
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              },
            },
          ],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
  },
});
