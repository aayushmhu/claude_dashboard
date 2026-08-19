# Session Handoff

> Compact handoff document. Updated at the end of every session; the next session reads this first.

## Verified Now

- **`dashboard-perf-001` shipped** (2026-08-19, later same day as pricing). Three query-shape fixes on `/` dashboard: (1) `/api/tokens` WHERE clause corrected to `event_type IN ('Stop','SubagentStop')` — was matching every row because `input_tokens` has `DEFAULT 0`, a bug that pretended to filter; (2) `/api/sessions` no-filter path now scopes `LIMIT` inside a subquery before JOIN; (3) new composite index `idx_events_type_time` on `cc_events(event_type, timestamp)` via `migrations/003_perf_index.sql`. Result: `/api/tokens` median 234ms → 28ms (~8.4×), `/api/sessions?limit=10` 258ms → 20ms (~13×). Byte-identical token sums and session ID ordering verified before/after. User visual: "performance is improved."
- **`pricing-update-002` shipped** (2026-08-19). Per-version pricing catalog replaces family-based fallback. `/model-pricing` rebuilt as a 2-column family-card grid (`grid-cols-1 md:grid-cols-2 gap-6`) with chevron disclosure for older/retired versions, `Retired` badges, `Invite only` badge on Mythos 5, third callout re: standard-not-batch + retroactive recalc. Cost calculator rebuilt with 15-model picker + live rate display. All 7 SQL `COST_EXPR` blocks + 2 JS helpers now derive from `resolveModelPricing(modelId)` in `lib/utils.ts` (per-version key → family-fallback regex → Sonnet 4.6 default). Fable 5 mispricing bug fixed (was 3.3× undercount at Sonnet fallback → now correct $10/$50); Sonnet 5 overcount fixed (was 1.5× overcount → now correct $2/$10).
- **`local-files-001` shipped** (2026-05-21/22). Project Detail Local Files section + dedicated page + memory-preview modal + `/chat?root=` extension.
- **Phase 1.2 bidirectional scroll + focus-event shipped** (2026-05-21). Click ↗ on Session Summary prompt → conversation centered with amber highlight.
- **Harness-engineering methodology in place** (2026-05-20). AGENTS.md is the entry point (15 rules in 7 categories).
- **8-agent team** in `.claude/agents/`: ceo, team-lead, engineer, insights-engineer, ui-ux, pm, new-user (Haiku), claude-dev-guest (Sonnet).
- **Live DB**: `~/.claude-dashboard/dashboard.db`. Type-check `npx tsc --noEmit` exit 0. Production runs under PM2 on port 3010.

## Changed This Session (2026-08-19)

### dashboard-perf-001 (5 files)

- `app/api/tokens/route.ts` — WHERE clause fix (2 locations)
- `app/api/sessions/route.ts` — no-filter branch: scope subquery + `SELECT COUNT(*) FROM cc_sessions`
- `migrations/003_perf_index.sql` (new) — composite index
- `CLAUDE.md` — Database section notes the new index
- Planning file at `docs/planning/features/2026-08-19-dashboard-perf-001.md`
- Data-volume note: `cc_events` at 114K rows (was 21K in May 2026-05-16). 5× growth in ~3 months. Query-shape bugs that were invisible at 21K are biting now.

### pricing-update-002 (11 files)

- **11 files touched** for pricing-update-002 (5 more than originally scoped; all in pricing-truth blast radius). Full list in `docs/planning/features/2026-08-19-pricing-update.md` §6.
- New per-version resolver `resolveModelPricing()` in `lib/utils.ts` + `PER_VERSION_PRICING` catalog covering 15 models.
- 7-branch SQL `COST_EXPR` replaced 3-branch family CASE across all pricing routes.
- `/model-pricing` rebuilt with `app/model-pricing/family-card.tsx` new component.
- Cost calculator supports all 15 model tiers with normalized ID handling (`[1m]`, date pins).
- Insights rules 2/8/10 hardcoded saving-math replaced with resolver call.
- `docs/product/insight-specs/opus-trivial-tools.md` stale $15/$75 corrected to $5/$25.
- Insights-engineer audit appended to `docs/testing/_AUDIT_2026-05-16.md`: all 15 rules still fire correctly; 30-day total shift $6,018 → $6,676 (+10.9%) as expected.
- 30-day cost recomputation impact: Fable 5 $482 → $1,607 (correction of undercount); Sonnet 5 $1,404 → $936 (correction of overcount); all other model families unchanged.
- **Native app planning docs** (`native-desktop-app-guide.md`, `tauri-build-prompt.md`) committed separately as planning artifacts.

## Broken Or Unverified

- **Perf-audit measurement discrepancy**: initial `/` audit reported `/api/tokens` at ~5100ms; fix-engineer's baseline was ~234ms (20× gap). Attributed to system noise. Fix is correct regardless. Future audits should include a control measurement of a known-fast endpoint to isolate noise.
- **Playwright light-mode capture gap**: `colorScheme:'light'` doesn't override `next-themes` localStorage on mount, so light-mode screenshots render in dark. User visually confirmed light-mode parity in browser at ship time. Follow-up: seed localStorage in `scripts/audit-page.mjs` for reliable light-mode captures.
- **`insight-specs-hygiene-001` deferred**: Remaining stale rate references in `opus-verbose-output.md` ("$75/M"), `cache-write-without-read.md` ("+25% premium"), etc. Not runtime code; tracked as a separate hygiene feature.
- **Subagent dispatch tooling gap** (persistent): team-lead's subagent context can't spawn engineer directly. CEO has been direct-dispatching engineer + insights-engineer via SendMessage. Needs proper fix.
- **CLAUDE.md line-cap**: Slightly reduced this session by trimming the 3-row pricing table to a pointer. Still needs the Architecture/Pages/API split into `docs/product/architecture.md` + `docs/product/components.md` that user has planned.
- **`TOOL_COLORS` duplication** between `lib/utils.ts` and `lib/colors.ts`. Not breaking.
- **Dev server stability**: `npm rebuild better-sqlite3` if `NODE_MODULE_VERSION` mismatch; `lsof -i :3010` + kill for stale process.

## Next Best Step

Pick one from `feature_list.json`:

1. **`insight-specs-hygiene-001`** (new, `not_started`) — refresh stale rate references in remaining `docs/product/insight-specs/*.md` files. Small, cosmetic, ~30 min. Good "warm-up" task next session.
2. **`summary-003`** (existing, `not_started`) — render `<task-notification>` XML as readable rows in Session Summary. ~30-45 min. Planning file needed per AGENTS.md Rule 5.
3. **Feedback channel infrastructure** — no ticket yet. Per memory `project_audience_and_signal.md`: the precondition for sharper future strategic calls. Higher-leverage than either of the above but needs scoping.

## Commands

- Entry-point read: `AGENTS.md`
- Install: `npm install`
- Rebuild native modules if Node version changed: `npm rebuild better-sqlite3`
- Setup: `npm run init` (one-time)
- Dev (local): `PORT=3010 npm run dev` — **NOTE**: PM2 is running the dashboard on 3010 in this environment; check `pm2 list` before starting a second dev server
- Type-check (L1): `npx tsc --noEmit`
- Production build: `npm run build`
- Lint: `npm run lint`
- Visual audit (L3): `node scripts/audit-page.mjs <url> $TMPDIR/<out-dir>`
- Live DB for dry-runs: `~/.claude-dashboard/dashboard.db`
- Try the new pricing page: `http://localhost:3010/model-pricing`
