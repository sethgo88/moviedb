# Movie Collection App

A personal movie collection tracker built with Tauri, React, and TypeScript. Runs as a native Android app with local-first SQLite storage synced to Supabase.

## What it does

- Track movies you own (physical/digital, HD/4K) and movies you want
- Search TMDB for movie metadata — poster, rating, year auto-filled
- Works fully offline; syncs to Supabase when online
- Poster images cached locally for offline use

## Quick Start

### Prerequisites
See [docs/setup.md](docs/setup.md) for full environment setup (Rust, Android SDK, NDK, etc.).

### Run (desktop, fastest for UI work)
```bash
pnpm install
pnpm dev
```

### Run (Android device)
```bash
adb devices              # confirm device is connected
cargo tauri android dev  # build and deploy with hot reload
```

### Other commands
```bash
pnpm lint          # Biome lint check
pnpm format        # Biome auto-format
pnpm tsc --noEmit  # TypeScript type check
pnpm test          # Vitest unit tests
cargo tauri android build --debug    # debug APK
cargo tauri android build --release  # signed release APK
```

## Documentation

| Doc | Description |
|---|---|
| [docs/architecture.md](docs/architecture.md) | System overview, data flow, layer responsibilities |
| [docs/stack.md](docs/stack.md) | Each technology — why chosen, how used |
| [docs/patterns.md](docs/patterns.md) | Concrete code patterns with examples |
| [docs/database.md](docs/database.md) | SQLite schema, migrations, sync strategy |
| [docs/android.md](docs/android.md) | Android build, signing, troubleshooting |
| [docs/setup.md](docs/setup.md) | Full environment setup from scratch (Windows) |

## Tech Stack

Tauri 2 · React 19 · TypeScript · Tailwind CSS · Biome · SQLite · Supabase · TanStack Router · TanStack Query · Zustand · Zod

## IDE Setup

VS Code with these extensions (see `.vscode/extensions.json`):
- [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
- [Biome](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)
