# Pricing Catalog + Model Coverage Update

| Field | Value |
|---|---|
| Status | shipped |
| Started | 2026-08-19 |
| Shipped | 2026-08-19 |
| Feature ID | pricing-update-002 |
| Test cases | TC-PU-01..18 |
| Prototype todo | — |

## 1. Requirement (as given)

> "we have the pricing we need to update the pricing and more models details"
> Followed by Anthropic's batch pricing table. CEO interpretation: standard API rates (2× batch figures), per-version resolver to replace family-based fallback, retire old model rates preserved.

## 2. Plan

### 2.1 Confirmed rate table (fetched 2026-08-19 from platform.claude.com/docs/en/about-claude/pricing)

All rates are **standard API** (not batch). `cache_write` is the **1h cache write rate** — codebase convention per project_pricing.md. 5m rate = 1.25× input; codebase does not model the two separately.

| Model | Status | Input $/M | Output $/M | Cache Write 1h $/M | Cache Read $/M |
|---|---|---|---|---|---|
| claude-fable-5 | Live | 10 | 50 | 20 | 1.00 |
| claude-mythos-5 | Limited avail. | 10 | 50 | 20 | 1.00 |
| claude-opus-5 | Live | 5 | 25 | 10 | 0.50 |
| claude-opus-4-8 | Live | 5 | 25 | 10 | 0.50 |
| claude-opus-4-7 | Live | 5 | 25 | 10 | 0.50 |
| claude-opus-4-6 | Live | 5 | 25 | 10 | 0.50 |
| claude-opus-4-5 | Live | 5 | 25 | 10 | 0.50 |
| claude-opus-4-1 | Retired | 15 | 75 | 30 | 1.50 |
| claude-opus-4 | Retired | 15 | 75 | 30 | 1.50 |
| claude-sonnet-5 | Live | 2 | 10 | 4 | 0.20 |
| claude-sonnet-4-6 | Live | 3 | 15 | 6 | 0.30 |
| claude-sonnet-4-5 | Live | 3 | 15 | 6 | 0.30 |
| claude-sonnet-4 | Retired | 3 | 15 | 6 | 0.30 |
| claude-haiku-4-5 | Live | 1 | 5 | 2 | 0.10 |
| claude-haiku-3-5 | Retired | 0.80 | 4 | 1.60 | 0.08 |

**Note:** Anthropic confirmed $2/$10 for Sonnet 5 is now the permanent standard price — the previously announced September 1, 2026 increase to $3/$15 has been cancelled.

**Fable 5 note:** Added to Anthropic's tier as a top-of-line model at $10/$50 — same input as Mythos 5, which is limited-availability (glasswing program).

### 2.2 Live DB model IDs (queried 2026-08-19)

```
claude-fable-5
claude-haiku-4-5-20251001      ← date suffix variant
claude-opus-4-7
claude-opus-4-7[1m]            ← 1M context window variant (standard pricing)
claude-opus-4-8
claude-opus-4-8[1m]
claude-opus-5
claude-sonnet-4-6
claude-sonnet-5
```

Patterns observed:
- `[1m]` suffix = 1M context window. Anthropic: "Claude 4.6+ includes full 1M context at standard pricing" → same rate as base model.
- `-YYYYMMDD` suffix = version pin (date-stamped). Strip for lookup.

### 2.3 Active data integrity issue

`claude-fable-5` has real sessions in the DB right now. All 6 COST_SQL locations match on `LIKE '%opus%'` / `LIKE '%haiku%'` / ELSE (sonnet). Fable 5 falls into the ELSE branch at $3/$15 — **should be $10/$50**. This is a 3.3× undercount on cost. Fix is high priority.

`claude-sonnet-5` also in DB, falls into ELSE at $3/$15 — **should be $2/$10**. This overcounts by 1.5× for sonnet 5. Less severe (wrong direction — overstates cost slightly).

### 2.4 Per-version resolver design (TypeScript)

Replace `getModelPricing()` in `lib/utils.ts` with `resolveModelPricing()`:

```typescript
function normalizeModelId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\[.*?\]$/, '')       // strip [1m] and any future bracket suffixes
    .replace(/-\d{8}$/, '')        // strip date pin like -20251001
    .trim();
}

// Full per-version lookup (keyed by normalized model ID)
export const PER_VERSION_PRICING: Record<string, ModelPricing> = {
  'claude-fable-5':    { input: 10, output: 50, cache_write: 20, cache_read: 1.00 },
  'claude-mythos-5':   { input: 10, output: 50, cache_write: 20, cache_read: 1.00 },
  'claude-opus-5':     { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 },
  'claude-opus-4-8':   { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 },
  'claude-opus-4-7':   { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 },
  'claude-opus-4-6':   { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 },
  'claude-opus-4-5':   { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 },
  'claude-opus-4-1':   { input: 15, output: 75, cache_write: 30, cache_read: 1.50 },
  'claude-opus-4':     { input: 15, output: 75, cache_write: 30, cache_read: 1.50 },
  'claude-sonnet-5':   { input: 2,  output: 10, cache_write: 4,  cache_read: 0.20 },
  'claude-sonnet-4-6': { input: 3,  output: 15, cache_write: 6,  cache_read: 0.30 },
  'claude-sonnet-4-5': { input: 3,  output: 15, cache_write: 6,  cache_read: 0.30 },
  'claude-sonnet-4':   { input: 3,  output: 15, cache_write: 6,  cache_read: 0.30 },
  'claude-haiku-4-5':  { input: 1,  output: 5,  cache_write: 2,  cache_read: 0.10 },
  'claude-haiku-3-5':  { input: 0.80, output: 4, cache_write: 1.60, cache_read: 0.08 },
};

// Family fallback for future unknown versions
const FAMILY_FALLBACK: Array<[RegExp, ModelPricing]> = [
  [/fable|mythos/, { input: 10, output: 50, cache_write: 20, cache_read: 1.00 }],
  [/opus/,         { input: 5,  output: 25, cache_write: 10, cache_read: 0.50 }],
  [/haiku/,        { input: 1,  output: 5,  cache_write: 2,  cache_read: 0.10 }],
  [/sonnet/,       { input: 3,  output: 15, cache_write: 6,  cache_read: 0.30 }],
];

// Ultimate fallback: sonnet 4.6 rate — safe conservative choice
const DEFAULT_PRICING: ModelPricing = { input: 3, output: 15, cache_write: 6, cache_read: 0.30 };

export function resolveModelPricing(model: string | null | undefined): ModelPricing {
  if (!model) return DEFAULT_PRICING;
  const key = normalizeModelId(model);
  if (PER_VERSION_PRICING[key]) return PER_VERSION_PRICING[key];
  for (const [re, pricing] of FAMILY_FALLBACK) {
    if (re.test(key)) return pricing;
  }
  return DEFAULT_PRICING;
}
```

Keep `getModelPricing()` as a deprecated alias calling `resolveModelPricing()` to avoid breaking any callers outside this file.

### 2.5 SQL COST_EXPR update (all 6 locations)

Replace the 3-branch CASE with a 7-branch CASE. The table alias prefix (`e.` or none) varies by route — engineer must match per-file.

```sql
(CASE
  WHEN model LIKE '%fable%' OR model LIKE '%mythos%' THEN
    COALESCE(input_tokens,0)*10/1e6 + COALESCE(output_tokens,0)*50/1e6 +
    COALESCE(cache_creation_tokens,0)*20/1e6 + COALESCE(cache_read_tokens,0)*1.0/1e6
  WHEN model LIKE '%opus-4-1%' THEN
    COALESCE(input_tokens,0)*15/1e6 + COALESCE(output_tokens,0)*75/1e6 +
    COALESCE(cache_creation_tokens,0)*30/1e6 + COALESCE(cache_read_tokens,0)*1.5/1e6
  WHEN model LIKE '%haiku-3-5%' OR model LIKE '%haiku-3.5%' THEN
    COALESCE(input_tokens,0)*0.8/1e6 + COALESCE(output_tokens,0)*4/1e6 +
    COALESCE(cache_creation_tokens,0)*1.6/1e6 + COALESCE(cache_read_tokens,0)*0.08/1e6
  WHEN model LIKE '%sonnet-5%' THEN
    COALESCE(input_tokens,0)*2/1e6 + COALESCE(output_tokens,0)*10/1e6 +
    COALESCE(cache_creation_tokens,0)*4/1e6 + COALESCE(cache_read_tokens,0)*0.2/1e6
  WHEN model LIKE '%opus%' THEN
    COALESCE(input_tokens,0)*5/1e6 + COALESCE(output_tokens,0)*25/1e6 +
    COALESCE(cache_creation_tokens,0)*10/1e6 + COALESCE(cache_read_tokens,0)*0.5/1e6
  WHEN model LIKE '%haiku%' THEN
    COALESCE(input_tokens,0)*1/1e6 + COALESCE(output_tokens,0)*5/1e6 +
    COALESCE(cache_creation_tokens,0)*2/1e6 + COALESCE(cache_read_tokens,0)*0.1/1e6
  ELSE
    COALESCE(input_tokens,0)*3/1e6 + COALESCE(output_tokens,0)*15/1e6 +
    COALESCE(cache_creation_tokens,0)*6/1e6 + COALESCE(cache_read_tokens,0)*0.3/1e6
END)
```

**Branch ordering rationale:** Fable/Mythos must precede opus+haiku (no overlap). Opus-4-1 must precede the generic opus branch (retired rate differs). Haiku-3-5 must precede generic haiku. Sonnet-5 must precede the ELSE. `claude-opus-4` (without version number) is rare in DB — the generic `%opus%` branch covers it at $5/$25 (conservative direction — undercounts retired $15 rate, but opus-4 is not in the live DB).

### 2.6 Files to touch (all 6 known locations)

- `lib/utils.ts` — add `PER_VERSION_PRICING`, `resolveModelPricing()`, keep `getModelPricing()` as alias, update `MODEL_PRICING` to add new family entries for fable/mythos, update `TOKEN_PRICING` comment to reflect new default
- `app/api/stats/route.ts` — update `COST_SQL`
- `app/api/tokens/route.ts` — update `COST_SQL` and `COST_SQL_E`
- `app/api/tokens/timeline/route.ts` — update `COST_SQL`
- `app/api/insights/route.ts` — update `COST_SQL` (and `HAIKU_COST_SQL` stays as-is — it's the "what if haiku" baseline, not a pricing source)
- `app/api/sessions/[id]/export/route.ts` — update `getRates()` local helper to call `resolveModelPricing()`
- `app/api/model-pricing/route.ts` (likely exists or new) — serve the catalog for the `/model-pricing` page
- `app/model-pricing/page.tsx` — update display to show new tiers, retired badges, layout per ui-ux spec

**Grep verification before closing:** Engineer must run:
```bash
grep -rn "15/1e6\|18\.75\|15\.0\|25\.0\|75\b" app/api/ lib/
```
to catch any stale ELSE or opus branch that wasn't updated.

### 2.7 Sign-off decisions (pending)

**D1 — /model-pricing page layout**: Flat table (~15 rows) or grouped-by-family with expand-to-see-versions? ui-ux is speccing both options.

**D2 — Retired model display**: Surface retired models in a separate "Retired" section at bottom, or intermix with a badge? pm is deciding + writing copy.

**D3 — Fable 5 / Mythos 5 in catalog**: ANSWERED. Fable 5 already has live sessions in DB and is being mispriced — must be in catalog. Mythos 5: ship in catalog even without DB sessions (it's a documented tier). No CEO escalation needed on D3.

## 3. Test cases (designed up front)

| TC-ID | Title | Pre-condition | Steps | Expected Result | Priority |
|---|---|---|---|---|---|
| TC-PU-01 | Fable 5 resolves to $10/$50 | TypeScript | Call resolveModelPricing('claude-fable-5') | { input: 10, output: 50, cache_write: 20, cache_read: 1.00 } | H |
| TC-PU-02 | Fable 5 with [1m] suffix resolves correctly | TypeScript | Call resolveModelPricing('claude-fable-5[1m]') | Same as TC-PU-01 | H |
| TC-PU-03 | Sonnet 5 resolves to $2/$10 | TypeScript | Call resolveModelPricing('claude-sonnet-5') | { input: 2, output: 10, cache_write: 4, cache_read: 0.20 } | H |
| TC-PU-04 | Haiku 4.5 date-pin resolves correctly | TypeScript | Call resolveModelPricing('claude-haiku-4-5-20251001') | { input: 1, output: 5, cache_write: 2, cache_read: 0.10 } | H |
| TC-PU-05 | Opus 4.1 retired resolves to $15/$75 | TypeScript | Call resolveModelPricing('claude-opus-4-1') | { input: 15, output: 75, cache_write: 30, cache_read: 1.50 } | H |
| TC-PU-06 | Haiku 3.5 retired resolves to $0.80/$4 | TypeScript | Call resolveModelPricing('claude-haiku-3-5') | { input: 0.80, output: 4, cache_write: 1.60, cache_read: 0.08 } | M |
| TC-PU-07 | Unknown model falls back to sonnet 4.6 default | TypeScript | Call resolveModelPricing('claude-unknown-future-9') | { input: 3, output: 15, cache_write: 6, cache_read: 0.30 } | M |
| TC-PU-08 | Null model falls back to default | TypeScript | Call resolveModelPricing(null) | Default pricing (sonnet 4.6 rate) | H |
| TC-PU-09 | SQL COST_EXPR fable branch fires in live DB | SQLite on dashboard.db | SELECT SUM(COST_SQL_NEW) WHERE model LIKE '%fable%' vs old COST_SQL; compare totals | New total ≈ 3.3× old total (10/3 ratio) | H |
| TC-PU-10 | SQL COST_EXPR sonnet-5 branch fires in live DB | SQLite | SELECT SUM(COST_SQL_NEW) WHERE model LIKE '%sonnet-5%'; compare | New total ≈ 0.67× old total (2/3 ratio) | H |
| TC-PU-11 | /api/tokens returns updated totals without SQL error | Dev server running | curl /api/tokens | HTTP 200, no sql error in response | H |
| TC-PU-12 | /api/stats returns without SQL error | Dev server running | curl /api/stats | HTTP 200 | H |
| TC-PU-13 | /api/insights returns without SQL error | Dev server running | curl /api/insights | HTTP 200, active rules still fire | H |
| TC-PU-14 | /model-pricing page shows all 15 model tiers | Browser / Playwright | Navigate to /model-pricing | 15 rows visible (or grouped equivalently); Fable 5, Mythos 5, Sonnet 5 appear | H |
| TC-PU-15 | /model-pricing shows Retired badges on legacy models | Browser / Playwright | Navigate to /model-pricing | Opus 4.1, Opus 4, Sonnet 4, Haiku 3.5 each show "Retired" badge | H |
| TC-PU-16 | /model-pricing shows Limited availability on Mythos 5 | Browser / Playwright | Navigate to /model-pricing | Mythos 5 row has "Limited availability" badge | M |
| TC-PU-17 | TypeScript type-check passes | Repo root | npx tsc --noEmit | Exit 0, zero errors | H |
| TC-PU-18 | Dark + light mode parity on /model-pricing | Playwright | Screenshot in both themes | No invisible text, badges readable, layout intact | M |

## 4. Sign-off

**2026-08-19 — team-lead opens D1/D2 with specialists:**
- D1 (layout) dispatched to ui-ux. Awaiting spec for flat-table vs grouped-by-family options.
- D2 (retired model copy + badge text) dispatched to pm. Awaiting copy spec + "Limited availability" blurb for Mythos 5.
- D3 RESOLVED: Fable 5 already in live DB and actively mispriced — ship in catalog. Mythos 5 ships too per CEO lean.

**Pending: CEO sign-off on D1 choice and D2 copy before engineering dispatch.**

## 5. Execution log

**2026-08-19:**
- team-lead: fetched live pricing from platform.claude.com/docs/en/about-claude/pricing — full 15-model table confirmed.
- team-lead: queried live DB — found 9 distinct model IDs. Confirmed claude-fable-5 already present and mispriced.
- team-lead: planning file created. feature_list.json updated to `active`.
- team-lead: dispatched pm (D2 copy) and ui-ux (D1 layout) concurrently.
- pm: signed off D2 — Option A (separate Retired section), `Retired` + `Invite only` badges, Fable/Opus/Sonnet/etc. display-name convention, third blue callout re: standard-not-batch + retroactive recalc.
- ui-ux: signed off D1 (initial) — Option B, grouped-by-family cards with chevron disclosure; kept Option B tokens.
- CEO: reconciled pm's "Retired section at bottom" with ui-ux's "Retired inside family card behind chevron" — chose ui-ux's disclosure mechanism (family stays single organizing principle). pm's copy adapted for that mechanism.
- CEO: expanded scope with (a) `app/model-pricing/calculator.tsx` update, (b) rules 2/8/10 hardcoded saving-math fix in `app/api/insights/route.ts`, (c) JS `getRates()` / `costOf()` fallbacks in `sessions/[id]/export` and `sessions/[id]/summary`.
- CEO sweep discovered 2 extra COST_EXPR blocks not in original §2.6: `projects/detail/route.ts` and `sessions/[id]/summary/route.ts`. Flagged; engineer covered both.
- User: requested 2-column card grid on `/model-pricing` (page too long). ui-ux iteration 2/2 signed off `grid-cols-1 md:grid-cols-2 gap-6` + `max-h-72 overflow-y-auto scrollbar-thin` on versions list.
- Engineer: shipped all 11 files. L1 clean, L2 6/6 endpoints HTTP 200, L3 SQL dry-runs confirm Fable 5 3.333× (matches expected 3.33×) and Sonnet 5 0.667× (matches expected 0.67×). 4 Playwright screenshots captured — light-mode screenshot rendered in dark due to next-themes localStorage / Playwright colorScheme interaction; light-mode parity verified by code inspection.
- User: visual verification passed. Approved commit + push.

## 6. Files touched

- `lib/utils.ts` — `PER_VERSION_PRICING`, `FAMILY_FALLBACK`, `DEFAULT_PRICING`, `normalizeModelId`, `resolveModelPricing`, `MODEL_PRICING` extended, `getModelPricing` deprecated alias
- `app/api/stats/route.ts` — 7-branch `COST_SQL`
- `app/api/tokens/route.ts` — 7-branch `COST_SQL` + `COST_SQL_E`
- `app/api/tokens/timeline/route.ts` — 7-branch `COST_SQL`
- `app/api/insights/route.ts` — 7-branch `COST_SQL`, `resolveModelPricing` import, rules 2/8/10 hardcoded saving math replaced with resolver
- `app/api/sessions/[id]/export/route.ts` — `getRates()` per-version PV lookup + 7-branch `COST_EXPR_EXPORT`
- `app/api/sessions/[id]/summary/route.ts` — 7-branch `COST_EXPR` + `costOf()` JS helper via `resolveModelPricing()` **[not in original §2.6 — discovered by CEO sweep]**
- `app/api/projects/detail/route.ts` — 7-branch `COST_EXPR` **[not in original §2.6 — discovered by CEO sweep]**
- `app/model-pricing/page.tsx` — 5-family grouped layout, 2-column grid, 3 callout notes, `RATES_VERIFIED_AT` = 2026-08-19
- `app/model-pricing/family-card.tsx` — **NEW** — `FamilyCard` + `VersionRow` + `StatusBadge` client components
- `app/model-pricing/calculator.tsx` — rebuilt with 15-model picker, `resolveModelPricing()`-based math, live rate display
- `docs/product/insight-specs/opus-trivial-tools.md` — corrected stale Opus $15/$75 → $5/$25 in edge-case doc (on-scope; not the deferred hygiene rewrite)
- `docs/testing/_AUDIT_2026-05-16.md` — appended `2026-08-19 post-pricing-update verdict` section from insights-engineer

## 7. Post-deploy

- L3 light-mode screenshot gap: Playwright `colorScheme: 'light'` cannot override `next-themes` localStorage on mount. Both attempted light-mode screenshots rendered in dark. User visually confirmed light-mode parity in browser at ship time. Follow-up (deferred, not this PR): seed localStorage in the Playwright script for reliable dark/light captures.
- Stale rate references in other spec docs (`opus-verbose-output.md` "$75/M", `cache-write-without-read.md` "+25% premium") tracked as new feature `insight-specs-hygiene-001` — not shipped this PR.

## 8. Cross-references

- feature_list.json: pricing-update-002
- Memory: ~/.claude/projects/-Users-aayushsaini-projects-dashboard-claude-code-events/memory/project_pricing.md (update after ship)
- Spec docs to refresh after ship: docs/product/insight-specs/opus-trivial-tools.md (stale Opus $15/$75 references)
