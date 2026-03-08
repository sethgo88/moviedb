# Android

## Build Commands

```bash
cargo tauri android dev              # hot-reload dev on connected device/emulator
cargo tauri android build --debug    # debug APK
cargo tauri android build --release  # signed release APK
```

Install a built APK:
```bash
adb install path/to/app.apk
```

APK output paths:
- Debug: `src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk`
- Release: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`

---

## Environment Requirements

| Tool | Version | Notes |
|---|---|---|
| Android Studio | Latest | For SDK management |
| NDK | r26 (side by side) | Must be r26 — not latest |
| Android SDK Build-Tools | Latest | |
| Android SDK Command-line Tools | Latest | |
| Java | JBR from Android Studio | `JAVA_HOME` must point here |

### Required environment variables

```
ANDROID_HOME       = C:\Users\<you>\AppData\Local\Android\Sdk
ANDROID_NDK_HOME   = %ANDROID_HOME%\ndk\26.x.x
JAVA_HOME          = C:\Program Files\Android\Android Studio\jbr
PATH               += %ANDROID_HOME%\platform-tools
```

### Required Rust targets

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

Run `cargo tauri info` to verify the full environment.

---

## Project Structure (Android)

After `cargo tauri android init`:

```
src-tauri/gen/android/
  app/
    src/main/
      AndroidManifest.xml     ← permissions declared here
      java/                   ← generated Java/Kotlin bridge
    build.gradle.kts          ← signing config for release builds
  gradle/
  build.gradle.kts
```

Open `src-tauri/gen/android/` in Android Studio to index the project and catch SDK issues early.

---

## Permissions

In `src-tauri/gen/android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

`INTERNET` — required for PocketBase sync and TMDB API calls.
`ACCESS_NETWORK_STATE` — used by `isOnline()` in the sync service.

**Note:** `tauri-plugin-dialog` handles gallery/media access on Android via the system file picker — no additional `READ_MEDIA_IMAGES` manifest permission is needed because the picker uses Android's built-in content URI system.

## Safe Areas

The app runs edge-to-edge. All UI must respect device safe areas — the camera cutout at the top and the gesture navigation bar at the bottom.

- Use `env(safe-area-inset-top)` for top-anchored elements (headers, toasts, fixed overlays).
- Use `env(safe-area-inset-bottom) + 15px` for bottom-anchored elements (nav bar, sheets, fixed buttons).

See **`docs/patterns.md` → Safe Areas** for the full pattern with code examples.

---

## Back Button (Android)

`src/hooks/useAndroidBackButton.ts` uses `onBackButtonPress` from `@tauri-apps/api/app` (the correct Tauri 2 API — not a raw event listener). The handler navigates back in router history, or closes the app if already at the root route (`"/"`). Cleanup calls `listener.unregister()`.

---

## Tauri 2 Capabilities

Declared in `src-tauri/capabilities/default.json`. If an API call silently fails, check here first.

Current permissions:
```json
"core:default"        — invoke, window, app APIs
"opener:default"      — open URLs/files
"sql:default"         — SQLite plugin base
"sql:allow-execute"   — run SQL statements
"dialog:allow-open"   — file picker (used by PosterPicker)
"fs:allow-read-file"  — read picked files / Android content URIs
```

When adding a new Tauri plugin, add its permission identifier here and update `lib.rs` with `.plugin(tauri_plugin_xxx::init())`.

---

## Signing

### Development (debug)
Android Studio auto-generates a debug keystore at `~/.android/debug.keystore`. No setup needed.

### Production (release)
Generate a keystore once and store it securely outside the project directory:

```bash
keytool -genkey -v \
  -keystore release.keystore \
  -alias movie-app \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store credentials in `.env` (gitignored):
```
KEYSTORE_PATH=<absolute path — outside project>
KEYSTORE_PASSWORD=<password>
KEY_ALIAS=movie-app
KEY_PASSWORD=<key password>
```

Configure `src-tauri/gen/android/app/build.gradle.kts` to read from environment variables. Never hardcode keystore credentials.

---

## Emulator vs Physical Device

Physical device is strongly preferred. Emulator WebView performance can be misleading — frame rates and scroll smoothness will differ significantly from a real device.

If you must use an emulator:
- API level 33+
- x86_64 image (best performance on Windows)
- At least 2GB RAM, 8GB internal storage
- Enable hardware acceleration (HAXM or Hyper-V)

---

## Troubleshooting

**`adb devices` shows nothing**
```bash
adb kill-server
adb start-server
adb devices
```
Also check: USB Debugging enabled in Developer Options, try a different USB cable.

**Build fails — NDK errors**
- Confirm `ANDROID_NDK_HOME` points to the r26 NDK specifically
- NDK r27+ breaks compatibility — use r26 side-by-side install
- Run `cargo tauri info` and check NDK path

**Build fails — long path errors (Windows)**
Enable long path support in admin PowerShell:
```powershell
Set-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1
```
Then restart.

**WebView shows blank screen on device**
1. Check `INTERNET` permission in `AndroidManifest.xml`
2. Check Tauri capabilities file allows HTTP/network
3. Run `adb logcat | grep -i "webview\|chromium\|console"` and look for JS errors

**Gradle sync fails in Android Studio**
- Open `src-tauri/gen/android/` as the project root
- Accept all SDK license prompts (`sdkmanager --licenses`)
- Ensure `JAVA_HOME` points to Android Studio's JBR, not a system Java install

**Hot reload stops reflecting changes**
Kill and restart `cargo tauri android dev`. This occasionally happens after Rust-side changes.

**App crashes immediately on launch**
```bash
adb logcat -s AndroidRuntime:E
```
Look for the Java exception stack trace. Usually a missing permission or failed plugin initialization.
