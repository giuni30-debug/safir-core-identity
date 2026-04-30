# 📱 Ghid Build Safir Home Call — pentru Windows

Acest ghid te duce de la cod la aplicație live în **Google Play** și **App Store**.

---

## 🟢 PARTEA 1 — Pregătire pe Windows (o singură dată, ~30 min)

### 1.1 Instalează tool-urile necesare

| Tool | Link descărcare | Pentru ce |
|---|---|---|
| **Node.js LTS** | https://nodejs.org | Rulează Capacitor |
| **Git** | https://git-scm.com/download/win | Descarcă codul |
| **Android Studio** | https://developer.android.com/studio | Build Android |
| **Java JDK 21** | Vine cu Android Studio ✅ | — |

> ⚠️ La instalarea Android Studio, lasă bifate toate opțiunile default (SDK, Emulator, Platform Tools).

### 1.2 Clonează proiectul tău Lovable

În Lovable: butonul **GitHub** (sus dreapta) → **Connect to GitHub** → creează repo.

Apoi pe Windows, deschide **PowerShell** sau **CMD**:

```powershell
git clone https://github.com/USERNAME/safir-core-identity.git
cd safir-core-identity
npm install
```

### 1.3 Adaugă platformele native (o singură dată)

```powershell
npm run build
npx cap add android
npx cap add ios
npx cap sync
```

> 📝 `npx cap add ios` îți creează folderul `ios/` chiar dacă pe Windows nu poți face build iOS — îl trimitem la Codemagic (vezi Partea 3).

---

## 🟢 PARTEA 2 — Copiază plugin-urile native (o singură dată)

În proiect, am pregătit fișierele native în folderul `native/`. Trebuie copiate în folderele generate de Capacitor.

### 2.1 Android — copiază plugin-ul Kotlin

**Copiază**:  
`native/android/NativeAudioRouting.kt`

**În**:  
`android/app/src/main/java/app/lovable/safirhomecall/NativeAudioRouting.kt`

> 💡 Folderul `app/lovable/safirhomecall/` poate să nu existe — creează-l manual conform `appId` din `capacitor.config.ts`.

**Apoi** deschide `android/app/src/main/java/app/lovable/safirhomecall/MainActivity.java` și adaugă:

```java
import app.lovable.safirhomecall.NativeAudioRouting;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        registerPlugin(NativeAudioRouting.class);
        super.onCreate(savedInstanceState);
    }
}
```

**Permisiuni** — în `android/app/src/main/AndroidManifest.xml`, în `<manifest>` adaugă:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.INTERNET" />
```

### 2.2 iOS — copiază plugin-ul Swift

**Copiază**:  
`native/ios/NativeAudioRouting.swift`

**În**:  
`ios/App/App/NativeAudioRouting.swift`

**Permisiuni** — în `ios/App/App/Info.plist` adaugă (înainte de `</dict>` final):

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Safir Home Call needs microphone access for voice calls.</string>
<key>NSCameraUsageDescription</key>
<string>Safir Home Call needs camera access for video calls.</string>
<key>UIBackgroundModes</key>
<array>
    <string>audio</string>
    <string>voip</string>
</array>
```

### 2.3 Sincronizează

```powershell
npx cap sync
```

---

## 🟢 PARTEA 3 — Build & Upload în magazine

### 🤖 Android → Google Play (FACI LOCAL pe Windows)

```powershell
npm run build
npx cap sync android
npx cap open android
```

În **Android Studio**:
1. Așteaptă să termine indexing (~5 min prima oară)
2. Sus în meniu: **Build → Generate Signed App Bundle / APK**
3. Alege **Android App Bundle** → Next
4. **Create new keystore** (prima oară):
   - Path: `C:\Users\TINE\safir.keystore`
   - Parolă: ALEGE UNA și **SALVEAZĂ-O** (n-o pierzi NICIODATĂ)
   - Alias: `safir`
   - Validity: 25 ani
   - Completează nume/oraș/țară
5. **Build** → produce `app-release.aab`
6. Mergi la **https://play.google.com/console** → **Create app**
7. Production → Create new release → Upload `app-release.aab`
8. Completează: descriere, 2-8 screenshot-uri, icon (1024x1024 — `resources/icon.png`), policy URL
9. **Submit for review** — 2-7 zile

### 🍎 iOS → App Store (FACI ÎN CLOUD prin Codemagic)

Pe Windows nu poți face build iOS → folosim **Codemagic** (gratuit pentru proiecte mici).

1. **Push proiectul pe GitHub** (deja făcut prin Lovable):
   ```powershell
   git add .
   git commit -m "Add Capacitor native"
   git push
   ```

2. Mergi la **https://codemagic.io** → **Sign up cu GitHub**

3. **Add application** → selectează repo-ul `safir-core-identity` → **Capacitor App**

4. La **Build for platforms** → bifează doar **iOS**

5. La **Distribution**:
   - Conectează **App Store Connect** cu contul tău Apple Developer
   - Generează **API Key** din https://appstoreconnect.apple.com/access/api → upload în Codemagic
   - Selectează automat upload la TestFlight

6. **Start build** — durează ~20 min

7. După build, aplicația apare automat în **TestFlight** → testezi pe iPhone-ul tău

8. În **App Store Connect**:
   - Completează metadata (descriere, screenshot-uri 6.7" iPhone, icon)
   - **Submit for Review** — 1-3 zile

---

## 🔄 Cum faci UPDATE-uri ulterior

De fiecare dată când modifici ceva în Lovable:

```powershell
git pull
npm install        # doar dacă au apărut dependencies noi
npm run build
npx cap sync
```

Pentru Android: redeschide Android Studio → Generate Signed Bundle → upload nouă versiune  
Pentru iOS: doar `git push` → Codemagic face build automat

> ⚠️ La fiecare update incrementează `versionCode` și `versionName` în:
> - Android: `android/app/build.gradle`
> - iOS: `ios/App/App/Info.plist` (CFBundleVersion)

---

## ❓ Probleme comune

| Eroare | Soluție |
|---|---|
| `npx cap add ios` fail pe Windows | Normal — folderul se creează, build-ul iOS merge prin Codemagic |
| Android Studio: Gradle sync failed | Așteaptă, prima dată durează 10+ min |
| App crashes la startup pe Android | Verifică că ai adăugat `registerPlugin` în MainActivity |
| Audio merge tot pe difuzor | Verifică că ai copiat `NativeAudioRouting.kt`/`.swift` în folderele corecte |

---

## 💰 Costuri totale

- Google Play Developer: **$25** (o dată) ✅ ai deja
- Apple Developer: **$99/an** ✅ ai deja
- Codemagic: **gratuit** până la 500 min/lună
- Capacitor + plugins: **gratuit**

**Total în plus de plătit acum: $0** 🎉
