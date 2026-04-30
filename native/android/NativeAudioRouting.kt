// ====================================================================
// NativeAudioRouting.kt
// ====================================================================
// COPIAZĂ acest fișier în:
//   android/app/src/main/java/app/lovable/safirhomecall/NativeAudioRouting.kt
// DUPĂ ce rulezi: npx cap add android
//
// Apoi în android/app/src/main/java/app/lovable/safirhomecall/MainActivity.java
// adaugă în onCreate (înainte de super):
//   registerPlugin(NativeAudioRouting.class);
// ====================================================================

package app.lovable.safirhomecall

import android.content.Context
import android.media.AudioManager
import android.media.AudioDeviceInfo
import android.os.Build
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin

@CapacitorPlugin(name = "NativeAudioRouting")
class NativeAudioRouting : Plugin() {

    private val audioManager: AudioManager
        get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    private var speakerOn = false
    private var previousMode = AudioManager.MODE_NORMAL

    @PluginMethod
    fun startCallSession(call: PluginCall) {
        try {
            val am = audioManager
            previousMode = am.mode
            // MODE_IN_COMMUNICATION = mod apel VoIP, audio routat la cască
            am.mode = AudioManager.MODE_IN_COMMUNICATION

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Android 12+ : API modern
                val earpiece = am.availableCommunicationDevices.firstOrNull {
                    it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                }
                if (earpiece != null) {
                    am.setCommunicationDevice(earpiece)
                }
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = false
            }
            speakerOn = false
            call.resolve()
        } catch (e: Exception) {
            call.reject("startCallSession failed: ${e.message}")
        }
    }

    @PluginMethod
    fun endCallSession(call: PluginCall) {
        try {
            val am = audioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = false
            }
            am.mode = previousMode
            speakerOn = false
            call.resolve()
        } catch (e: Exception) {
            call.reject("endCallSession failed: ${e.message}")
        }
    }

    @PluginMethod
    fun setSpeakerphone(call: PluginCall) {
        val enabled = call.getBoolean("enabled") ?: false
        try {
            val am = audioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val targetType = if (enabled)
                    AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
                else
                    AudioDeviceInfo.TYPE_BUILTIN_EARPIECE
                val device = am.availableCommunicationDevices.firstOrNull {
                    it.type == targetType
                }
                if (device != null) {
                    am.setCommunicationDevice(device)
                }
            } else {
                @Suppress("DEPRECATION")
                am.isSpeakerphoneOn = enabled
            }
            speakerOn = enabled
            val ret = JSObject()
            call.resolve(ret)
        } catch (e: Exception) {
            call.reject("setSpeakerphone failed: ${e.message}")
        }
    }

    @PluginMethod
    fun isSpeakerphoneOn(call: PluginCall) {
        val ret = JSObject()
        ret.put("enabled", speakerOn)
        call.resolve(ret)
    }
}
