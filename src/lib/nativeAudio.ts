/**
 * Native Audio Routing pentru apeluri WebRTC
 *
 * Pe mobil (Capacitor): folosește API-uri native pentru a forța routing-ul
 *   - iOS: AVAudioSession cu mode .voiceChat → cască implicit
 *   - Android: AudioManager cu MODE_IN_COMMUNICATION → cască implicit
 *
 * Pe web: no-op, browserul gestionează (limitat)
 */

import { registerPlugin, Capacitor } from '@capacitor/core';

export interface NativeAudioRoutingPlugin {
  /** Pornește sesiunea de apel (cască implicit) */
  startCallSession(): Promise<void>;
  /** Oprește sesiunea de apel, eliberează audio */
  endCallSession(): Promise<void>;
  /** Comută între cască (false) și difuzor (true) */
  setSpeakerphone(options: { enabled: boolean }): Promise<void>;
  /** Citește starea curentă */
  isSpeakerphoneOn(): Promise<{ enabled: boolean }>;
}

// Plugin-ul nativ — implementarea Swift/Kotlin se află în
// ios/App/App/NativeAudioRouting.swift și
// android/app/src/main/java/.../NativeAudioRouting.kt
const NativeAudioRouting = registerPlugin<NativeAudioRoutingPlugin>(
  'NativeAudioRouting',
  {
    web: {
      // Fallback pe web: no-op (nu există control real)
      async startCallSession() {
        console.log('[NativeAudio] web fallback: startCallSession');
      },
      async endCallSession() {
        console.log('[NativeAudio] web fallback: endCallSession');
      },
      async setSpeakerphone({ enabled }: { enabled: boolean }) {
        console.log('[NativeAudio] web fallback: setSpeakerphone', enabled);
      },
      async isSpeakerphoneOn() {
        return { enabled: false };
      },
    },
  }
);

export const isNativePlatform = () => Capacitor.isNativePlatform();

// Verifică dacă plugin-ul nativ NativeAudioRouting e efectiv înregistrat.
// (APK-ul de test încarcă preview-ul live → plugin-ul Kotlin/Swift poate
// lipsi chiar dacă isNativePlatform() returnează true.)
export const isNativeAudioRoutingAvailable = (): boolean => {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return Capacitor.isPluginAvailable?.('NativeAudioRouting') ?? false;
  } catch {
    return false;
  }
};

// Detectează dacă putem comuta efectiv outputul audio (cască vs difuzor).
// - Native cu plugin instalat → da
// - Web cu HTMLMediaElement.setSinkId → da (Chrome desktop)
// - În rest (WebView Android/iOS fără plugin, Safari mobile) → nu
export const canControlAudioOutput = (): boolean => {
  if (isNativeAudioRoutingAvailable()) return true;
  if (typeof document === 'undefined') return false;
  try {
    const el = document.createElement('audio') as HTMLAudioElement & {
      setSinkId?: (id: string) => Promise<void>;
    };
    return typeof el.setSinkId === 'function';
  } catch {
    return false;
  }
};

export const startNativeCallSession = async () => {
  if (!isNativeAudioRoutingAvailable()) return;
  try {
    await NativeAudioRouting.startCallSession();
  } catch (e) {
    console.warn('[NativeAudio] startCallSession failed', e);
  }
};

export const endNativeCallSession = async () => {
  if (!isNativeAudioRoutingAvailable()) return;
  try {
    await NativeAudioRouting.endCallSession();
  } catch (e) {
    console.warn('[NativeAudio] endCallSession failed', e);
  }
};

export const setNativeSpeakerphone = async (enabled: boolean): Promise<boolean> => {
  if (!isNativeAudioRoutingAvailable()) return false;
  try {
    await NativeAudioRouting.setSpeakerphone({ enabled });
    return true;
  } catch (e) {
    console.warn('[NativeAudio] setSpeakerphone failed', e);
    return false;
  }
};

export const getNativeSpeakerphone = async (): Promise<boolean> => {
  if (!isNativeAudioRoutingAvailable()) return false;
  try {
    const { enabled } = await NativeAudioRouting.isSpeakerphoneOn();
    return enabled;
  } catch {
    return false;
  }
};
