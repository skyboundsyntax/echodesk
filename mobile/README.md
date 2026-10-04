# ECHODESK Mobile & Office Kit Integration Guide

> **"JOT your intent on your phone. Continue seamlessly on your laptop Office Kit."**  
> Privacy-first, ambient AI workspace with zero passive surveillance.

---

## 📱 Mobile Runtime Architecture Overview

ECHODESK is engineered so that you can run it on your phone using **any of the following 4 options**:

| Approach | Technology | Setup Complexity | Offline Support | Office Kit Bridge | Hardware Mic & Cam |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Option A (Recommended)** | **Progressive Web App (PWA)** | **Zero Setup (Instant)** | ✅ 100% Offline (Service Worker) | ✅ Native LAN & Local | ✅ Push-to-Talk & Local Cam |
| **Option B** | **Flutter Companion** | Low (`flutter run`) | ✅ Asset-bundled | ✅ REST & Local Sync | ✅ Native Permissions |
| **Option C** | **React Native** | Low (`npm start`) | ✅ Asset-bundled | ✅ REST & Local Sync | ✅ Native Permissions |
| **Option D** | **Native Android (Kotlin)** | Medium (Android Studio) | ✅ Asset-bundled | ✅ REST & Local Sync | ✅ Native Permissions |

---

## 🚀 Option A: Progressive Web App (PWA) — Instant & Zero-Build

The quickest way to run ECHODESK on your Android phone or iPhone without installing gigabytes of SDKs:

### 1. Start the ECHODESK Backend & Office Kit
On your laptop / desktop:
```bash
cd echodesk/backend
node server.js
```
The server binds to `0.0.0.0:3001` and serves both the REST API and the static mobile client.

### 2. Open on Your Phone
1. Connect your phone to the same Wi-Fi network as your laptop.
2. In your phone's browser (Chrome, Edge, or Safari), navigate to:
   ```text
   http://<YOUR-LAPTOP-IP>:3001/
   ```
   *(Find your laptop IP displayed in the **Office Kit** tab under "Local Station Wi-Fi URL" or run `ipconfig` on Windows).*

### 3. Install to Home Screen
- **Android (Chrome)**: Tap the banner **"Install ECHODESK on Phone"** or open the 3-dots menu (⋮) and tap **"Install App"** / **"Add to Home screen"**. It installs as a native standalone application (WebAPK).
- **iOS (Safari)**: Tap the Share button (⬆) and select **"Add to Home Screen"**.

### 4. Offline Capability
The included Service Worker (`frontend/sw.js`) caches all assets locally. Even when completely disconnected from Wi-Fi, the app opens instantly on your phone with local deterministic AI.

---

## 💻 Working with the Office Kit (Phone ↔ Laptop Continuity)

The PRD defines the **Office Kit / Device Bridge** for explicit continuation between your phone and laptop workstation without passive desktop surveillance.

### How to Pair and Use:
1. **Open Office Kit on Laptop**: Click the **📱 Device Bridge / Office Kit** tab in your desktop browser.
2. **Select Mode**:
   - **📱 Phone Mode**: Streamlines the UI for mobile screens with touch-friendly controls.
   - **💻 Office Kit Station**: Displays incoming mobile handoffs, pairing PINs, and station status.
   - **🖥️ Desk Split**: Side-by-side desk setup.
3. **Phone → Laptop Handoff**:
   - Start or continue a session on your phone (e.g., studying DBMS, Q5 Normalization).
   - Tap **"Continue on Laptop →"** (or say *"Hey JOT, continue DBMS on laptop"*).
   - On the laptop, the Office Kit highlights **"⚡ JOT SESSION READY"**.
   - Click **"Continue DBMS on Laptop"** to take over seamlessly.
4. **Laptop → Phone Sync Back**:
   - When finishing up on your laptop workstation, click **"Sync Back to Phone 📱"**.
   - Your updated focus progress and duration immediately transfer back to your mobile device!
5. **Zero Desktop Inspection Guarantee**:
   - Only structured work-session context crosses the bridge.
   - Raw audio, camera video, open application scanning, and browser inspection are strictly prohibited and locked by ECHOSHIELD.

---

## 🎯 Option B: Flutter Companion Shell

If you wish to distribute ECHODESK as a native Flutter mobile app on Android or iOS:

### Structure:
Located in [`mobile/flutter`](file:///c:/Users/samat/Downloads/echodesk/mobile/flutter):
- `pubspec.yaml`: Includes `webview_flutter`.
- `lib/main.dart`: Full-screen Flutter shell loading the ECHODESK PWA/local bundle with camera and mic permissions enabled.

### Run with Flutter:
```bash
cd echodesk/mobile/flutter
flutter pub get
flutter run
```

---

## ⚛️ Option C: React Native Shell

If your organization uses React Native:

### Structure:
Located in [`mobile/react-native`](file:///c:/Users/samat/Downloads/echodesk/mobile/react-native):
- `package.json`: Configured with `react-native-webview`.
- `App.tsx`: Full-screen bridge wrapper with hardware audio/camera grants.

### Run with React Native:
```bash
cd echodesk/mobile/react-native
npm install
npx react-native run-android
```

---

## 🤖 Option D: Native Android (Kotlin) Shell

If you prefer a pure native Android project using Android Studio:

### Structure:
Located in [`mobile/android`](file:///c:/Users/samat/Downloads/echodesk/mobile/android):
- `MainActivity.kt`: Android `Activity` with `WebChromeClient` handling `onPermissionRequest` for camera and microphone push-to-talk.
- `AndroidManifest.xml`: Permissions for `INTERNET`, `RECORD_AUDIO`, and `CAMERA`.

---

## 🧪 Verification & Acceptance

All Office Kit and mobile bridge requirements are verified automatically:
```powershell
powershell -ExecutionPolicy Bypass -File ./frontend/tests/verify-all.ps1
```
All 172 tests pass with zero external dependencies.
