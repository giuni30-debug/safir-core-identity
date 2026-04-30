# 📱 APK DEBUG pentru TEST pe telefon Android

> **Scop**: Instalezi aplicația pe telefonul tău Android pentru testare reală.  
> **Timp total**: ~10 minute (prima dată), apoi 2 min/build.  
> **NU** este pentru Google Play — doar pentru tine, pe telefonul tău.

---

## ✅ Ce am pregătit pentru tine în Lovable

1. **`capacitor.config.ts`** configurat în mod **TEST**:
   - APK-ul încarcă direct preview-ul Lovable live (`https://id-preview--...lovable.app`)
   - **Avantaj**: orice modificare pe care o faci în Lovable apare **instant pe telefon**, fără să refaci APK-ul
   - **Necesită**: telefon cu internet (WiFi sau date mobile)
2. **Folder `capacitor-webdir/`** cu un `index.html` placeholder (cerut de Capacitor)
3. **Plugin nativ audio (cască)** rămâne activ — funcționează identic
4. **Permisiuni Android** corecte (microfon, audio settings, internet)

---

## 🟢 PAS 1 — Descarcă codul pe Windows

În Lovable, sus dreapta: **GitHub → Connect to GitHub** → creează repo (dacă n-ai deja).

Apoi pe Windows, deschide **PowerShell**:

```powershell
git clone https://github.com/USERNAME/safir-core-identity.git
cd safir-core-identity
npm install
```

> Dacă ai descărcat ZIP în loc, dezarhivează și deschide PowerShell în folderul respectiv.

---

## 🟢 PAS 2 — Instalează tool-urile (o singură dată)

| Tool | Link | Note |
|---|---|---|
| **Node.js LTS** | https://nodejs.org | Lasă opțiunile default |
| **Android Studio** | https://developer.android.com/studio | ⚠️ La instalare, lasă bifat **Android SDK + Platform Tools** |

După instalare Android Studio:
- Deschide-l o dată
- Acceptă licențele SDK (apare un popup)
- Așteaptă să descarce SDK (~5 min)

---

## 🟢 PAS 3 — Adaugă platforma Android (o singură dată)

În folderul proiectului, în PowerShell:

```powershell
npx cap add android
npx cap sync android
```

Asta creează folderul `android/`.

---

## 🟢 PAS 4 — Copiază plugin-ul nativ audio (CRITIC pentru cască)

1. Creează folderul (manual, în Explorer):
   ```
   android\app\src\main\java\app\lovable\safirhomecall\
   ```

2. Copiază fișierul:
   - **Din**: `native\android\NativeAudioRouting.kt`
   - **În**: `android\app\src\main\java\app\lovable\safirhomecall\NativeAudioRouting.kt`

3. Deschide cu Notepad (sau VS Code):
   ```
   android\app\src\main\java\app\lovable\safirhomecall\MainActivity.java
   ```

4. Înlocuiește **tot conținutul** cu:

   ```java
   package app.lovable.safirhomecall;

   import android.os.Bundle;
   import com.getcapacitor.BridgeActivity;

   public class MainActivity extends BridgeActivity {
       @Override
       public void onCreate(Bundle savedInstanceState) {
           registerPlugin(NativeAudioRouting.class);
           super.onCreate(savedInstanceState);
       }
   }
   ```

5. Deschide `android\app\src\main\AndroidManifest.xml` și adaugă (înainte de `<application>`):

   ```xml
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.INTERNET" />
   ```

---

## 🟢 PAS 5 — Generează APK DEBUG (acum vine partea ușoară!)

În PowerShell, în folderul proiectului:

```powershell
cd android
.\gradlew.bat assembleDebug
```

> ⏳ Prima dată durează **5-10 minute** (descarcă Gradle + dependencies).  
> A doua oară: **30 secunde**.

---

## 📍 UNDE GĂSEȘTI APK-UL

După ce comanda se termină cu **`BUILD SUCCESSFUL`**, APK-ul tău e aici:

```
safir-core-identity\android\app\build\outputs\apk\debug\app-debug.apk
```

📂 **Calea completă** (copy-paste în Explorer):
```
C:\Users\TINE\safir-core-identity\android\app\build\outputs\apk\debug\
```

---

## 📲 PAS 6 — Instalează APK-ul pe telefon

### Metoda A — prin USB (cea mai rapidă)

1. Pe telefon: **Setări → Despre telefon** → apasă de 7 ori pe **Build number** → activezi "Developer mode"
2. **Setări → Developer options** → activează **USB Debugging**
3. Conectează telefonul la PC cu cablu USB
4. Pe telefon apare popup "Allow USB debugging?" → **Allow**
5. În PowerShell:
   ```powershell
   adb install app\build\outputs\apk\debug\app-debug.apk
   ```
6. Aplicația **Safir Home Call** apare pe telefon. Gata. 🎉

### Metoda B — fără cablu (prin email/cloud)

1. Trimite-ți `app-debug.apk` pe email/Google Drive/WhatsApp
2. Pe telefon, deschide-l → **Install**
3. Dacă apare avertisment "Install from unknown sources":
   - **Setări → Apps → [browser/email folosit] → Install unknown apps → Allow**
   - Reapasă pe APK → **Install**

---

## 🔄 Cum testezi modificări fără să refaci APK-ul

Pentru că am setat `server.url` să încarce **preview-ul Lovable live**:

1. Faci modificări în Lovable (chat normal cu mine)
2. Deschizi aplicația pe telefon → **vezi modificările instant** 🚀

**Nu trebuie să faci alt APK pentru fiecare schimbare!**  
Doar dacă schimbi ceva în config Capacitor / plugin nativ → atunci refaci APK.

---

## 🔧 Probleme comune

| Eroare | Soluție |
|---|---|
| `gradlew.bat not recognized` | Ești în folderul greșit. Trebuie `cd android` întâi |
| `SDK location not found` | Deschide Android Studio o dată, lasă-l să descarce SDK |
| `JAVA_HOME not set` | Android Studio vine cu Java — în PowerShell rulează: `$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` |
| APK se instalează dar app crash la start | Verifică că ai copiat `NativeAudioRouting.kt` și ai modificat `MainActivity.java` (PAS 4) |
| Aplicația arată pagină albă | Verifică că telefonul are internet — încarcă preview live |
| `adb: command not found` | Adaugă în PATH: `C:\Users\TINE\AppData\Local\Android\Sdk\platform-tools` |

---

## ✅ Rezumat scurt

```powershell
# Prima dată (10 min):
git clone <repo>
cd safir-core-identity
npm install
npx cap add android
npx cap sync android
# → Copiază NativeAudioRouting.kt + modifică MainActivity.java + AndroidManifest.xml
cd android
.\gradlew.bat assembleDebug

# APK aici:
# android\app\build\outputs\apk\debug\app-debug.apk

# Build-uri ulterioare (30 sec):
cd android
.\gradlew.bat assembleDebug
```

---

**Spune-mi când ești la un pas concret și te ajut punctual** (capturi screenshot din Android Studio, erori Gradle, etc.).
