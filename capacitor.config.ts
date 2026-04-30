import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.safirhomecall',
  appName: 'Safir Home Call',
  webDir: 'dist',
  server: {
    // Pentru dezvoltare live de pe Lovable preview, decomentează:
    // url: 'https://id-preview--c37270b2-ee89-406c-9f05-d457f52c1094.lovable.app',
    // cleartext: true,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    // Critic pentru apeluri: permite fundal & nu opri audio la blocare
    backgroundColor: '#0a0a1a',
  },
  android: {
    backgroundColor: '#0a0a1a',
  },
};

export default config;
