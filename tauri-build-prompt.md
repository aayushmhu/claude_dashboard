# Build Native Desktop App with Tauri

## Project context

This is the Claude Code Activity Dashboard — a Next.js 15 app that tracks every Claude Code session, tool call, token, and conversation. It uses SQLite (better-sqlite3) at ~/.claude-dashboard/dashboard.db, a Python logger at ~/.claude/log-to-db.py (symlinked), and hooks registered in ~/.claude/settings.json.

We're wrapping it in Tauri 2 to create a native desktop app for macOS and Ubuntu. The Next.js app stays exactly as-is — Tauri adds a native window, system tray, dock icon, and auto-updater around it.

The app runs the Next.js standalone server as a sidecar process on port 31388 (high port to avoid conflicts with dev servers on 3000-8080) and opens a native WebView window pointing to localhost:31388.

## Current project state

- Next.js 15 App Router with better-sqlite3
- package.json name: "claude-dashboard", version: "0.1.0"
- next.config.ts has serverExternalPackages: ['better-sqlite3']
- scripts/init.js handles setup (hooks, logger symlink, migrations)
- instrumentation.ts auto-runs migrations on server start
- Repo: github.com/aayushmhu/dashboard_claude_code_events

---

# Phase 1: Foundation

## 1.1 Add standalone output to Next.js

Update next.config.ts to add output: 'standalone'. This makes Next.js produce a self-contained server in .next/standalone/ that doesn't need node_modules at runtime.

Verify: run npm run build, then confirm .next/standalone/server.js exists. Test it works: PORT=31388 node .next/standalone/server.js — should serve the dashboard on localhost:31388.

Note: better-sqlite3 is a native module. The standalone build needs it copied into .next/standalone/node_modules/. Check if Next.js handles this automatically via serverExternalPackages, or if we need to copy it manually in the build step.

Also copy the public/ and .next/static/ folders — standalone builds need these alongside the server. Check the Next.js standalone docs for the exact copy commands needed.

## 1.2 Initialize Tauri 2

Install Tauri CLI if not present, then initialize:

```bash
npm install -D @tauri-apps/cli @tauri-apps/api
npx tauri init
```

When prompted:
- App name: Claude Dashboard
- Window title: Claude Dashboard
- Frontend dev URL: http://localhost:31388
- Frontend dist: ../.next/standalone

This creates src-tauri/ with tauri.conf.json, src/main.rs, Cargo.toml, and icons/.

## 1.3 Configure tauri.conf.json

Set these values:
- identifier: "com.claudedashboard.app"
- productName: "Claude Dashboard"
- version: read from package.json (0.1.0)
- bundle.targets: ["dmg", "deb", "appimage"] for macOS and Linux
- window: width 1280, height 800, minWidth 900, minHeight 600, center true, resizable true, title "Claude Dashboard"
- Do NOT set a frontend devUrl or distDir that conflicts — Tauri will connect to the sidecar server, not serve files directly

## 1.4 Add Tauri scripts to package.json

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "init": "node scripts/init.js init"
  }
}
```

## 1.5 Test Phase 1

Run `npm run tauri:dev` — should open a native window showing the dashboard. If it works, Phase 1 is complete.

Stop here and confirm everything works before proceeding.

---

# Phase 2: Sidecar — Launch Next.js server from Tauri

## 2.1 The problem

Tauri opens a WebView, but something needs to START the Next.js server. In development, you run `npm run dev` separately. In the packaged app, Tauri must launch the server automatically.

## 2.2 Create a Node.js server launcher

Create a script that Tauri will bundle and execute as a sidecar: scripts/server.js

This script:
1. Finds an available port starting from 31388 (if 31388 is taken, try 31389, 31390, etc.)
2. Sets PORT environment variable
3. Sets DB_PATH to ~/.claude-dashboard/dashboard.db
4. Spawns the Next.js standalone server: node .next/standalone/server.js
5. Writes the active port to ~/.claude-dashboard/port (so Tauri can read it)
6. Writes PID to ~/.claude-dashboard/server.pid
7. Handles SIGTERM — kills the Next.js process cleanly
8. Stdout outputs the port number on first line so Tauri can capture it

Port detection logic:
```javascript
const net = require('net');
function findPort(start) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(start, '127.0.0.1', () => {
      server.close(() => resolve(start));
    });
    server.on('error', () => resolve(findPort(start + 1)));
  });
}
```

## 2.3 Update Tauri's Rust code (src/main.rs)

The Rust main function should:

1. On app launch: spawn scripts/server.js as a child process using Tauri's sidecar or shell command
2. Read the port from the first line of stdout (or from ~/.claude-dashboard/port file)
3. Wait for the server to be ready: poll http://localhost:{port} until it responds (with timeout of 30 seconds)
4. Create the WebView window pointing to http://localhost:{port}
5. Show a splash/loading screen while waiting for the server
6. On app quit: send SIGTERM to the server process, wait for clean shutdown

For Tauri 2, use the shell plugin or command API to spawn the node process. The node binary path: on macOS check /usr/local/bin/node, /opt/homebrew/bin/node, or use `which node`. On Linux: /usr/bin/node or `which node`.

## 2.4 First-launch init

On first launch (detect by checking if ~/.claude-dashboard/dashboard.db exists):
1. Before starting the server, run the init logic (same as scripts/init.js)
2. Show a setup screen in the native window: "Setting up Claude Dashboard..."
3. Steps: Creating database → Linking logger → Registering hooks → Done!
4. Then start the server normally

On subsequent launches: skip init, go straight to server startup.

## 2.5 Test Phase 2

Close all terminal instances of the dashboard. Run `npm run tauri:dev`. The app should:
1. Launch the native window
2. Show loading/splash briefly
3. Start the Next.js server automatically
4. Display the dashboard
5. Closing the window should NOT kill the server yet (we handle that in Phase 3)

Stop here and confirm.

---

# Phase 3: System Tray + Dock Behavior

## 3.1 System tray icon

Add a system tray icon that is ALWAYS visible when the app is running (even when the window is closed).

Tray icon: use a simple monochrome icon (template image on macOS for menu bar compatibility). Create a 22x22 PNG for macOS menu bar and a 32x32 PNG for Linux system tray.

## 3.2 Tray menu

Right-click (or left-click on Linux) on the tray icon shows a context menu:

```
Open Dashboard          ← shows/focuses the main window
─────────────────
Status: Running on :31388
─────────────────
Open in Browser         ← opens http://localhost:31388 in default browser
─────────────────
Start at Login    ☑     ← toggle auto-start (checked by default)
─────────────────
Quit Claude Dashboard   ← fully exits: kills server, removes tray, exits app
```

## 3.3 Window behavior

**macOS:**
- Clicking the red close button (X) hides the window but keeps the app running in the tray
- Clicking the dock icon reopens the window
- Clicking the tray icon toggles window visibility
- Cmd+Q or "Quit" from tray fully exits

**Linux:**
- Clicking the close button hides the window, app stays in tray
- Clicking the tray icon toggles window visibility
- "Quit" from tray fully exits

## 3.4 Dock icon

**macOS:** App shows in the dock when the window is visible. When window is hidden (closed to tray), the dock icon remains but the window is hidden. Standard macOS behavior — Tauri handles this via the activationPolicy setting.

**Linux:** App shows in the taskbar when window is visible.

## 3.5 Auto-start on login

**macOS:** Create/remove a Login Item. Tauri has a plugin for this: tauri-plugin-autostart. When enabled, the app launches on login, starts the server, and sits in the tray (window hidden). User clicks tray to open.

**Linux:** Create/remove ~/.config/autostart/claude-dashboard.desktop file.

Default: auto-start ON after first install.

## 3.6 Test Phase 3

Run `npm run tauri:dev`. Verify:
1. Tray icon appears in menu bar / system tray
2. Right-click shows the menu
3. Close window → app stays in tray
4. Click tray → window reappears
5. "Open in Browser" opens localhost:31388
6. "Quit" fully exits (check no orphan node processes)
7. Toggle "Start at Login" → verify login item is created/removed

Stop here and confirm.

---

# Phase 4: App Icon + Branding

## 4.1 Create app icon

Design a simple app icon for Claude Dashboard:
- Concept: a terminal/monitor shape with a small bar chart or activity graph inside
- Primary color: #3B82F6 (blue-500 from the dashboard theme)
- Clean, flat design — no gradients, no 3D effects
- Recognizable at small sizes (16x16 dock icon)

Generate these sizes:
- macOS: icon.icns (contains 16, 32, 64, 128, 256, 512, 1024px)
- Linux: 32x32.png, 128x128.png, 256x256.png
- Tray icon: 22x22 PNG (monochrome/template for macOS menu bar)

Place in src-tauri/icons/

## 4.2 App metadata

In tauri.conf.json:
- shortDescription: "Track every Claude Code session, tool call, and token"
- longDescription: "See everything Claude does for you — every conversation, tool call, token spent, and dollar saved — in a clean local dashboard."
- copyright: "2026"
- category: "DeveloperTool"

## 4.3 Loading/splash screen

While the Next.js server is starting (can take 2-5 seconds), show a simple loading screen in the native window:
- Centered app icon
- "Claude Dashboard" text below
- Subtle loading animation (spinning dots or progress bar)
- Dark background matching the dashboard's dark theme

Once the server responds, replace with the actual dashboard.

## 4.4 Test Phase 4

Build the app: `npm run tauri:build`. Check:
1. App icon appears correctly in dock, tray, and Applications folder
2. Loading screen shows briefly on launch
3. Spotlight search finds "Claude Dashboard" with the correct icon

Stop here and confirm.

---

# Phase 5: Auto-Updater

## 5.1 Configure Tauri updater

Tauri 2 has a built-in updater plugin. Configure it to check GitHub Releases for new versions.

In tauri.conf.json, add the updater config:
- endpoint: https://github.com/aayushmhu/dashboard_claude_code_events/releases/latest/download/latest.json
- dialog: true (shows a native update dialog)
- pubkey: generate a Tauri signing key pair for update verification

## 5.2 Update check behavior

On app launch:
1. Check GitHub Releases for a newer version (compare semantic versions)
2. If new version available, show a dialog:
   - "Update available: v0.3.0"
   - "What's new:" followed by release notes from GitHub
   - "Update now" button — downloads, installs, restarts
   - "Later" button — dismisses, checks again next launch
3. If no update, continue silently

Also check for updates every 6 hours while the app is running (for users who never restart).

## 5.3 Generate signing keys

Tauri updates must be signed. Generate a key pair:

```bash
npx tauri signer generate -w ~/.tauri/claude-dashboard.key
```

This creates a private key (keep secret, add to GitHub Secrets) and a public key (embed in tauri.conf.json).

## 5.4 Test Phase 5

1. Build v0.1.0 and install it
2. Bump version to v0.2.0 in package.json and tauri.conf.json
3. Build v0.2.0 and create a mock GitHub Release
4. Open v0.1.0 → should show update dialog
5. Click "Update now" → should download, install, and restart as v0.2.0

Stop here and confirm.

---

# Phase 6: GitHub Actions — Automated Builds + Release

## 6.1 Create release workflow

Create .github/workflows/release.yml:

Trigger: on push of tags matching v* (e.g., v0.2.0)

Jobs:

### macOS build job
- Runs on: macos-latest
- Steps:
  1. Checkout code
  2. Setup Node.js 18
  3. Setup Rust toolchain
  4. npm install
  5. npm run build (Next.js)
  6. Import signing key from GitHub Secrets
  7. npx tauri build --target universal-apple-darwin
  8. Upload .dmg to the GitHub Release

### Ubuntu build job
- Runs on: ubuntu-latest
- Steps:
  1. Checkout code
  2. Setup Node.js 18
  3. Setup Rust toolchain
  4. Install Linux dependencies: libwebkit2gtk-4.1-dev, libappindicator3-dev, librsvg2-dev, patchelf
  5. npm install
  6. npm run build (Next.js)
  7. Import signing key from GitHub Secrets
  8. npx tauri build
  9. Upload .deb and .AppImage to the GitHub Release

### Update manifest job
- Runs after both build jobs complete
- Generates the latest.json file for the auto-updater
- Uploads latest.json to the GitHub Release

## 6.2 GitHub Secrets to configure

Add these secrets to the repository settings:
- TAURI_SIGNING_PRIVATE_KEY — the private key from Phase 5
- TAURI_SIGNING_PRIVATE_KEY_PASSWORD — the password for the key

Optional (for macOS code signing — can add later):
- APPLE_CERTIFICATE — .p12 certificate
- APPLE_CERTIFICATE_PASSWORD
- APPLE_SIGNING_IDENTITY
- APPLE_ID — for notarization
- APPLE_PASSWORD — app-specific password for notarization

## 6.3 Test Phase 6

1. Set up the GitHub Secrets
2. Push a tag: git tag v0.1.0 && git push origin v0.1.0
3. Watch the GitHub Actions workflow run
4. Verify the GitHub Release has: .dmg, .deb, .AppImage, latest.json
5. Download the .dmg on a Mac and install — verify it works
6. Download the .deb on Ubuntu and install — verify it works

Stop here and confirm.

---

# Phase 7: Homebrew Cask

## 7.1 Create a Homebrew tap repository

Create a new GitHub repo: github.com/aayushmhu/homebrew-claude-dashboard

This repo contains one file:

Casks/claude-dashboard.rb:

```ruby
cask "claude-dashboard" do
  version "0.1.0"
  sha256 "SHA256_OF_DMG"

  url "https://github.com/aayushmhu/dashboard_claude_code_events/releases/download/v#{version}/Claude.Dashboard_#{version}_universal.dmg"
  name "Claude Dashboard"
  desc "Track every Claude Code session, tool call, and token"
  homepage "https://github.com/aayushmhu/dashboard_claude_code_events"

  livecheck do
    url :url
    strategy :github_latest
  end

  app "Claude Dashboard.app"

  zap trash: [
    "~/.claude-dashboard",
    "~/Library/LaunchAgents/com.claudedashboard.app.plist",
  ]
end
```

## 7.2 Automate formula updates

Add a step to the GitHub Actions release workflow that:
1. After building and uploading the .dmg
2. Calculates the SHA256 of the .dmg
3. Opens a PR on the homebrew-claude-dashboard repo updating the version and SHA256

Or do it manually after each release — update the version and sha256 in the cask file.

## 7.3 Test Phase 7

```bash
brew tap aayushmhu/claude-dashboard
brew install --cask claude-dashboard
```

Verify: app appears in Applications, launches correctly, tray icon works.

---

# Phase 8: Polish + Edge Cases

## 8.1 Handle missing Node.js

If the packaged app can't find Node.js on the user's system:
- Show a clear error: "Node.js 18+ is required. Install it from https://nodejs.org"
- Or bundle Node.js inside the app (increases size by ~30MB but eliminates the dependency)

Decision: for now, require Node.js as a dependency. The target audience (Claude Code users) already has it installed because Claude Code requires it. Document it as a prerequisite.

## 8.2 Handle port conflict

If port 31388 is taken (unlikely but possible):
- The server launcher (scripts/server.js) auto-increments: try 31389, 31390, etc.
- Writes the active port to ~/.claude-dashboard/port
- Tauri reads this file and opens the correct URL
- Tray menu shows the actual port: "Status: Running on :31389"

## 8.3 Handle server crash

If the Next.js server crashes:
- Tauri detects the child process exit
- Shows a notification: "Dashboard server stopped. Restarting..."
- Automatically restarts the server
- If it crashes 3 times in 60 seconds, show an error dialog and stop retrying

## 8.4 Handle multiple instances

Prevent multiple instances of the app from running:
- On launch, check if ~/.claude-dashboard/server.pid exists and the process is alive
- If yes, just show/focus the existing window (don't start a second server)
- Tauri has a single-instance plugin for this

## 8.5 Graceful shutdown

When the user quits:
1. Send SIGTERM to the Next.js server process
2. Wait up to 5 seconds for clean shutdown
3. If still running, SIGKILL
4. Remove ~/.claude-dashboard/server.pid
5. Exit the Tauri app

## 8.6 Window state persistence

Remember the window position and size between launches:
- Save to ~/.claude-dashboard/window-state.json on window close
- Restore on next launch
- Tauri has a window-state plugin for this

## 8.7 Test Phase 8

Test each edge case:
1. Kill node process manually → app should restart it
2. Start two instances → second should focus first, not start a new server
3. Block port 31388 → app should use 31389
4. Move/resize window, restart → should remember position
5. Quit from tray → no orphan processes (check with: ps aux | grep node | grep 31388)

---

# Implementation order summary

Phase 1: standalone build + Tauri init + basic window → TEST
Phase 2: sidecar server launcher + first-launch init → TEST
Phase 3: system tray + dock + auto-start → TEST
Phase 4: app icon + splash screen → TEST
Phase 5: auto-updater → TEST
Phase 6: GitHub Actions CI/CD → TEST
Phase 7: Homebrew cask → TEST
Phase 8: polish + edge cases → TEST

Each phase builds on the previous one. Test each phase before moving to the next. Do not skip testing — native app bugs are much harder to debug than web app bugs.

Start with Phase 1 now.
