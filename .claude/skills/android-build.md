# Skill: android-build

Build and deploy the app to an Android device or emulator.

## What to do

Ask the user which mode they want:
- **dev** — hot-reload dev build on connected device/emulator
- **debug** — one-off debug APK
- **release** — signed release APK for sideloading

---

## Dev mode (hot reload)
```bash
adb devices                    # confirm device is listed
cargo tauri android dev        # builds and deploys with hot reload
```
Make a UI change in `src/` and it should reflect without a full rebuild.
If hot reload stops working, restart the command.

---

## Debug APK
```bash
cargo tauri android build --debug
```
Output: `src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk`

Install:
```bash
adb install src-tauri/gen/android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Release APK
Requires keystore credentials in environment or `.env`:
```
KEYSTORE_PATH=<absolute path to release.keystore — outside project dir>
KEYSTORE_PASSWORD=<password>
KEY_ALIAS=movie-app
KEY_PASSWORD=<key password>
```

```bash
cargo tauri android build --release
```
Output: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`

Install (device must have "Install unknown apps" enabled for your file manager or ADB):
```bash
adb install src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk
```

---

## Troubleshooting

**`adb devices` shows nothing**
- Enable USB Debugging in Developer Options on the device
- Try a different USB cable / port
- Run `adb kill-server && adb start-server`

**Build fails with NDK errors**
- Confirm `ANDROID_NDK_HOME` points to the r26 NDK specifically (not a later version)
- Run `cargo tauri info` to check environment configuration

**WebView shows blank screen**
- Check that `INTERNET` permission is in `AndroidManifest.xml`
- Check Tauri capabilities file in `src-tauri/capabilities/`
- Look at `adb logcat` for JS errors: `adb logcat | grep -i webview`

**Gradle sync fails in Android Studio**
- Open `src-tauri/gen/android/` in Android Studio and let it index
- Accept any SDK license prompts
- Check that `JAVA_HOME` points to Android Studio's bundled JBR

**Rust Android target missing**
```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```
