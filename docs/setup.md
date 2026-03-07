# Environment Setup (Windows)

Complete setup guide from a clean Windows 11 machine. Do steps in order.

---

## 1. Long Path Support

Run in an admin PowerShell — do this before anything else:

```powershell
Set-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1
```

Restart after applying. Rust build failures caused by long paths are silent and confusing to debug.

---

## 2. Visual Studio Build Tools

Download: https://visualstudio.microsoft.com/visual-cpp-build-tools/

During install, select the **"Desktop development with C++"** workload. This provides the MSVC compiler that Rust needs on Windows.

---

## 3. WebView2

Pre-installed on Windows 11. Verify: **Settings → Apps → Installed Apps** → search "WebView2".

If missing, download from the Microsoft WebView2 page.

---

## 4. Git

If not already installed: https://git-scm.com

---

## 5. Rust

Download `rustup-init.exe` from https://rustup.rs and run it.

- Select the default installation (x86_64-pc-windows-msvc toolchain)
- Restart your terminal after install

Verify:
```bash
rustc --version
cargo --version
```

---

## 6. Node.js + pnpm

Download Node.js LTS from https://nodejs.org

Then enable pnpm via Corepack (bundled with Node.js):
```bash
corepack enable
corepack prepare pnpm@latest --activate
```

Verify:
```bash
pnpm --version
```

---

## 7. Android Studio

Download from https://developer.android.com/studio and run the setup wizard.

In the setup wizard:
- Accept all SDK licenses
- Install default SDK components

After setup, open **SDK Manager** (Tools → SDK Manager) and install:

| Component | Notes |
|---|---|
| NDK (Side by side) → version r26 | Install r26 specifically — not the latest version |
| Android SDK Command-line Tools | |
| Android SDK Build-Tools | |

---

## 8. Environment Variables

Set these in System Properties → Environment Variables (or via PowerShell):

```
ANDROID_HOME      = C:\Users\<you>\AppData\Local\Android\Sdk
ANDROID_NDK_HOME  = %ANDROID_HOME%\ndk\26.x.x   ← match your r26 folder name
JAVA_HOME         = C:\Program Files\Android\Android Studio\jbr
```

Add to PATH:
```
%ANDROID_HOME%\platform-tools
```

Restart your terminal after setting these.

---

## 9. Rust Android Targets

```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

---

## 10. Tauri CLI

```bash
cargo install tauri-cli
```

Verify the full environment:
```bash
cargo tauri info
```

This command flags anything missing or misconfigured.

---

## 11. Clone and Install

```bash
git clone <repo-url>
cd moviedb
pnpm install
```

---

## 12. Verify Desktop Build

```bash
cargo tauri dev
```

The app should open in a desktop window.

---

## 13. Initialize Android Project

Run once, after the desktop build works:

```bash
cargo tauri android init
```

This generates `src-tauri/gen/android/`. Open that folder in Android Studio and let Gradle sync complete.

---

## 14. Verify Android Build

Connect a device (USB Debugging enabled) or start an emulator:

```bash
adb devices
cargo tauri android dev
```

The app should appear on the device with hot reload active.

---

## IDE

VS Code with these extensions:
- **Tauri** (`tauri-apps.tauri-vscode`) — Tauri config schema, run commands
- **rust-analyzer** (`rust-lang.rust-analyzer`) — Rust language support
- **Biome** (`biomejs.biome`) — lint and format on save

Configure VS Code to use Biome as the default formatter for TypeScript/JavaScript files.

`.vscode/settings.json` (add if not present):
```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[typescript]": { "editor.defaultFormatter": "biomejs.biome" },
  "[typescriptreact]": { "editor.defaultFormatter": "biomejs.biome" }
}
```
