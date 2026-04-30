import type { CapacitorConfig } from '@capacitor/cli';

/**
 * MOD TEST APK (curent):
 * APK-ul încarcă direct preview-ul Lovable live → orice modificare în Lovable
 * apare instant pe telefon. Perfect pentru testare. Necesită internet.
 *
 * Pentru release final (offline, magazin), trebuie un build SPA static.
 * Atunci comentezi `server.url` și `server.cleartext` și pui webDir corect.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.safirhomecall',
  appName: 'Safir Home Call',
  // Folder cu un index.html placeholder (real conținut vine de la server.url)
  webDir: 'capacitor-webdir',
  server: {
    // ✅ TEST MODE: încarcă preview-ul Lovable live
    url: 'https://id-preview--c37270b2-ee89-406c-9f05-d457f52c1094.lovable.app',
    cleartext: true,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0a0a1a',
  },
  android: {
    backgroundColor: '#0a0a1a',
    // Permite trafic clartext pentru WebRTC dacă e nevoie
    allowMixedContent: true,
  },
};

export default config;
