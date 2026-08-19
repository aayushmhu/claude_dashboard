# Claude Dashboard — Native Desktop App

## How it works

Claude Dashboard is a Next.js app wrapped in Tauri to create a native desktop application. Users install it like any other app — it appears in Spotlight (macOS) and app search (Ubuntu), runs in the background with a system tray icon, and auto-updates when you push new versions.

### Architecture

```
User codes with Claude Code (CLI or VS Code)
    ↓
Claude Code hooks fire on every event (7 event types)
    ↓
Python logger (~/.claude/log-to-db.py) captures events
    ↓
Writes to SQLite (~/.claude-dashboard/dashboard.db)
    ↓
Next.js server reads the database (runs on port 31388)
    ↓
Tauri native window displays the dashboard
    ↓
System tray icon keeps it running in background
```

### What the user sees

- A native app in their Applications folder / app menu
- Searchable in Spotlight (macOS) and Activities (Ubuntu)
- Dock icon when window is open
- System tray icon always running
- Auto-updates when new versions are released

### What happens behind the scenes

- Tauri launches a Next.js standalone server on port 31388
- Opens a native WebView window pointing to localhost:31388
- Python logger runs via Claude Code hooks (symlinked from the app bundle)
- SQLite database stores all events locally
- Everything stays on the user's machine — no cloud, no accounts

---

## For developers: how to build and publish

### Prerequisites

- Node.js 18+
- Rust (install via rustup)
- Python 3.8+
- Git
- GitHub account with the repo

### Step 1: Install Rust

```bash
# macOS / Linux
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Verify
rustc --version
cargo --version
```

### Step 2: Install Tauri CLI

```bash
cargo install tauri-cli
# or
npm install -D @tauri-apps/cli
```

### Step 3: Initialize Tauri in the project

```bash
cd dashboard_claude_code_events
npx tauri init
```

This creates the `src-tauri/` directory with Rust source code and configuration.

### Step 4: Add standalone output to Next.js

In `next.config.ts`:

```typescript
const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3'],
};
```

### Step 5: Build and test locally

```bash
# Build Next.js first
npm run build

# Run Tauri in development mode
npm run tauri:dev

# Build the native app
npm run tauri:build
```

Build outputs:
- macOS: `src-tauri/target/release/bundle/dmg/Claude Dashboard.dmg`
- Linux: `src-tauri/target/release/bundle/deb/claude-dashboard.deb`
- Linux: `src-tauri/target/release/bundle/appimage/claude-dashboard.AppImage`

### Step 6: Set up GitHub Actions for automatic builds

Create `.github/workflows/release.yml` in the repo. This workflow:

1. Triggers on tag push (v*)
2. Builds on macOS runner → produces .dmg
3. Builds on Ubuntu runner → produces .deb and .AppImage
4. Uploads all artifacts to GitHub Releases
5. Tauri's auto-updater reads from GitHub Releases

### Step 7: Create Homebrew tap

Create a separate repo: `github.com/aayushmhu/homebrew-claude-dashboard`

This repo contains one file — the Homebrew cask formula that points to the .dmg on GitHub Releases.

### Step 8: Publish a release

```bash
# Tag the version
git tag v0.2.0
git push origin v0.2.0

# GitHub Actions automatically:
# 1. Builds .dmg, .deb, .AppImage
# 2. Creates a GitHub Release
# 3. Uploads all artifacts
# 4. Generates update manifest for Tauri auto-updater
```

### Step 9: Update Homebrew formula

After the release is published, update the cask formula with the new version and SHA256 hash. This can be automated in the GitHub Actions workflow.

---

## How updates work

### You (the developer)

1. Make changes to the code
2. Commit and push
3. Tag a new version: `git tag v0.3.0 && git push origin v0.3.0`
4. GitHub Actions builds everything automatically
5. Done — users get notified

### Users

When they open the app and a new version is available:

```
┌──────────────────────────────────────┐
│                                      │
│  Update available: v0.3.0            │
│                                      │
│  What's new:                         │
│  • Thinking blocks in conversations  │
│  • Git branch tracking               │
│  • Performance improvements          │
│                                      │
│  [Update now]         [Later]        │
│                                      │
└──────────────────────────────────────┘
```

"Update now" → downloads, installs, restarts. Takes 10-30 seconds.
"Later" → asks again next launch.

Database migrations run automatically on restart — no user action needed.

Alternatively, Homebrew users can update via terminal:
```bash
brew update && brew upgrade --cask claude-dashboard
```

---

## For users: how to install

### macOS (Homebrew)

```bash
brew tap aayushmhu/claude-dashboard
brew install --cask claude-dashboard
```

Then:
1. Open "Claude Dashboard" from Applications or Spotlight
2. The app sets up everything automatically on first launch
3. Fully quit and reopen Claude Code to start logging
4. Start a new Claude Code session — data appears in the dashboard

### macOS (manual)

1. Download `Claude.Dashboard.dmg` from [GitHub Releases](https://github.com/aayushmhu/dashboard_claude_code_events/releases/latest)
2. Open the .dmg and drag "Claude Dashboard" to Applications
3. Open the app (if macOS warns about unidentified developer: right-click → Open)
4. The app sets up everything automatically on first launch
5. Fully quit and reopen Claude Code to start logging

### Ubuntu (snap)

```bash
sudo snap install claude-dashboard
```

### Ubuntu (deb)

```bash
curl -LO https://github.com/aayushmhu/dashboard_claude_code_events/releases/latest/download/claude-dashboard.deb
sudo dpkg -i claude-dashboard.deb
```

### Ubuntu (AppImage)

1. Download `claude-dashboard.AppImage` from [GitHub Releases](https://github.com/aayushmhu/dashboard_claude_code_events/releases/latest)
2. Make it executable: `chmod +x claude-dashboard.AppImage`
3. Run it: `./claude-dashboard.AppImage`

### From source (for contributors)

```bash
git clone https://github.com/aayushmhu/dashboard_claude_code_events.git
cd dashboard_claude_code_events
npm install
npm run init
npm run dev
```

Open http://localhost:3000

---

## What happens on first launch

When the user opens Claude Dashboard for the first time:

1. **Creates data directory** → `~/.claude-dashboard/`
2. **Creates SQLite database** → `~/.claude-dashboard/dashboard.db`
3. **Runs all database migrations** → creates tables (cc_events, cc_sessions, cc_transcript_records)
4. **Links the Python logger** → symlinks to `~/.claude/log-to-db.py`
5. **Registers Claude Code hooks** → updates `~/.claude/settings.json` with 7 event hooks
6. **Starts the dashboard server** → Next.js on port 31388
7. **Opens the native window** → shows the dashboard
8. **Adds system tray icon** → stays running in background

The user sees a brief "Setting up..." screen, then the dashboard. Total time: 5-10 seconds.

After setup, they need to **fully quit and reopen Claude Code** (Cmd+Q on VS Code, exit the CLI) so Claude Code loads the new hooks. Then every new session automatically logs to the dashboard.

---

## Uninstalling

### macOS (Homebrew)

```bash
brew uninstall --cask claude-dashboard
```

### macOS (manual)

1. Quit the app from the system tray
2. Delete "Claude Dashboard" from Applications
3. Optionally delete data: `rm -rf ~/.claude-dashboard`
4. Optionally remove hooks from `~/.claude/settings.json`

### Ubuntu

```bash
sudo dpkg -r claude-dashboard
# or
sudo snap remove claude-dashboard
```

The database at `~/.claude-dashboard/` is preserved on uninstall so users don't lose their history. They can delete it manually if they want.

---

## Port

The dashboard server runs on port **31388** — chosen because it's high enough to never conflict with development servers (React, Next.js, Express typically use 3000-8080).

If a user needs to check or access the dashboard in their browser directly: `http://localhost:31388`

---

## Security

- All data stays local — nothing is sent to any server
- The SQLite database contains full conversation history including prompts and responses
- The Python logger has file permissions set to owner-only (chmod 700)
- No accounts, no authentication, no cloud sync
- The app only listens on localhost — not accessible from the network

---

## Project structure (after Tauri is added)

```
dashboard_claude_code_events/
├── app/                      # Next.js pages (unchanged)
├── components/               # React components (unchanged)
├── lib/                      # Database, types, utils (unchanged)
├── scripts/                  # Python logger, init script (unchanged)
├── migrations/               # SQL migrations (unchanged)
├── public/                   # Static assets (unchanged)
├── src-tauri/                # NEW — Tauri native wrapper
│   ├── tauri.conf.json       # App config (window, tray, bundle)
│   ├── src/
│   │   └── main.rs           # Rust: launch server, manage tray
│   ├── icons/                # App icons (.icns, .png, .ico)
│   └── Cargo.toml            # Rust dependencies
├── .github/
│   └── workflows/
│       └── release.yml       # Automated build + publish
├── next.config.ts            # Added: output: 'standalone'
├── package.json              # Added: tauri scripts
└── README.md
```

Everything in `app/`, `components/`, `lib/`, `scripts/`, `migrations/` stays exactly the same. Tauri is purely additive — it wraps the existing app without modifying it. Running `npm run dev` still works for browser-based development.
