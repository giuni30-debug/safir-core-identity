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

export const startNativeCallSession = async () => {
  if (!isNativePlatform()) return;
  try {
    await NativeAudioRouting.startCallSession();
  } catch (e) {
    console.warn('[NativeAudio] startCallSession failed', e);
  }
};

export const endNativeCallSession = async () => {
  if (!isNativePlatform()) return;
  try {
    await NativeAudioRouting.endCallSession();
  } catch (e) {
    console.warn('[NativeAudio] endCallSession failed', e);
  }
};

export const setNativeSpeakerphone = async (enabled: boolean) => {
  if (!isNativePlatform()) return;
  try {
    await NativeAudioRouting.setSpeakerphone({ enabled });
  } catch (e) {
    console.warn('[NativeAudio] setSpeakerphone failed', e);
  }
};

export const getNativeSpeakerphone = async (): Promise<boolean> => {
  if (!isNativePlatform()) return false;
  try {
    const { enabled } = await NativeAudioRouting.isSpeakerphoneOn();
    return enabled;
  } catch {
    return false;
  }
};
