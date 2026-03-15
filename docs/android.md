# Android

## Application IDs

| Build type | Application ID | Launcher name |
|---|---|---|
| Debug / dev | `io.moviedb.app.dev` | MovieDB Dev |
| Release | `io.moviedb.app` | MovieDB |

The base ID (`io.moviedb.app`) is set in `src-tauri/tauri.conf.json`. The `.dev` suffix is appended via `applicationIdSuffix` in `build.gradle.kts`.

**Why separate IDs?** Different application IDs allow both builds to be installed on the same device simultaneously. Use the dev build for day-to-day development and the release build to verify production behaviour without uninstalling.

---

## Build Commands

```bash
cargo tauri android dev              # hot-reload dev on connected device/emulator
cargo tauri android build --debug    # debug APK  →  application ID: io.moviedb.app.dev
cargo tauri android build --release  # signed release APK  →  application ID: io.moviedb.app
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

**Cleartext HTTP:** `AndroidManifest.xml` uses `android:usesCleartextTraffic="${usesCleartextTraffic}"`. This placeholder is set to `true` for both debug and release in `build.gradle.kts`. Required for HTTP (non-HTTPS) connections to self-hosted PocketBase.

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

Both debug and release builds are signed with the **same keystore**. This lets the two builds coexist on a device (different application IDs) and avoids `INSTALL_FAILED_UPDATE_INCOMPATIBLE` when switching between them.

### One-time setup

1. Generate the keystore (run once, keep the file safe):
```bash
keytool -genkey -v -keystore moviedb.keystore -alias moviedb -keyalg RSA -keysize 2048 -validity 10000
```

2. Place the keystore at `src-tauri/gen/android/app/moviedb.keystore` (gitignored).

3. Add credentials to `src-tauri/gen/android/local.properties` (gitignored — already contains `sdk.dir`):
```
signing.storePassword=<your password>
signing.keyPassword=<your password>
```

4. `build.gradle.kts` reads from `local.properties` and applies the signing config to **both** debug and release build types. Never hardcode credentials in `build.gradle.kts`.

> **If you re-run `cargo tauri android init`:** `build.gradle.kts` is regenerated — re-apply the `applicationIdSuffix`, `resValue`, and signing blocks. `local.properties` is not touched.

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

**Network calls work in dev but fail in release (e.g. PocketBase login)**
Three layers must all be configured — missing any one causes failures:

1. **OS cleartext traffic** — `build.gradle.kts` must set `manifestPlaceholders["usesCleartextTraffic"] = "true"` inside `getByName("release")`. The debug block already sets this; the release block must set it explicitly or it inherits `false` from `defaultConfig`.

2. **WebView mixed content** — Release builds serve the app from `https://tauri.localhost`. Any `fetch()` to an HTTP URL is blocked as mixed content by default. `MainActivity.kt` overrides `onWebViewCreate` to set `WebSettings.MIXED_CONTENT_ALWAYS_ALLOW`, which permits HTTP requests from the HTTPS WebView origin.

3. **Tauri CSP** — Even with `connect-src http://*` in the CSP, Tauri internally appends `upgrade-insecure-requests`, which silently rewrites `http://` URLs to `https://` before the request is made. This breaks HTTP PocketBase connections regardless of connect-src rules. The fix is `"csp": null` in `tauri.conf.json`, which disables CSP entirely. This is acceptable for a local-first Android app with no web-facing surface.
