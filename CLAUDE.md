# Finance Health

A personal finance PWA for a single user, hosted on **GitHub Pages** and installed on an
iPhone via Safari's **Add to Home Screen**. Currency is **£ GBP** (`£1,250.50` formatting).

## Constraints — do not break these

- **No frameworks, no build step, no external requests.** The entire app lives in
  `index.html` (all CSS and JS inline). It must work fully offline with zero CDN/network
  dependencies.
- **GitHub Pages subpath hosting:** all URLs (manifest, icons, service worker) are
  *relative* (`./…`). Never use absolute `/` paths.
- **iOS PWA specifics:** `viewport-fit=cover`, `apple-mobile-web-app-capable`,
  `black-translucent` status bar, safe-area insets on header/tab bar, inputs ≥16px font
  so Safari doesn't zoom on focus.
- **Design language** (user-chosen, replaces the original Apple-blue look): dark-first
  fintech style with a **lime accent `#CDF656`** (black text on lime), near-black
  `#090909` background with `#161618` cards in dark mode, `#F4F4F6`/white in light mode
  (auto via CSS variables + `prefers-color-scheme`; light mode uses olive `#5C7A00` for
  accent-coloured *text* since lime fails contrast on white). **Outfit font embedded as a
  base64 data-URI `@font-face`** (latin subset — keep it inline, no network fetch).
  Pill-shaped buttons/chips (999px radius), 20px card radius, inverse-pill active states
  (black chip on light / white chip on dark), big figures with muted pence (`fmtRich`),
  frosted header/tab bar, hairlines, tabular numerals, 150–250ms ease-out transitions.
  Semantic red/amber kept; "green" IS the lime in dark mode.

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app — markup, CSS, JS |
| `manifest.json` | PWA manifest (standalone, relative paths) |
| `sw.js` | Cache-first service worker for offline (bump `CACHE` version when shipping changes) |
| `icon-180.png` / `icon-512.png` | App icons (black background, blue/white "FH" mark) |

## Data model

All data is one JSON blob in `localStorage` under the key **`financeHealth_v1`**.
Every mutation calls `save()` immediately. Shape (see `defaultState()` in `index.html`):

- `settings` — `spendingPlan`, `savingsTarget`, `expectedFreelance` (monthly £ figures).
- `months` — keyed `"YYYY-MM"`. Each: `expenses[]`, `savingsAdded`, and `plan` (a snapshot
  of settings taken when the month was created, so history survives settings changes;
  saving Settings re-syncs only the *current* month's snapshot).
- `recurring[]` — recurring-expense templates (`startMonth`, optional `endMonth` for
  installment expiry, plus `method`/`category`). Month generation instantiates active
  templates into each month.
- Every expense (and template) carries **`method`** (`"dd"` direct debit | `"manual"`)
  and **`category`** (`"Regular"` | `"Extra"` | free-text custom). `migrate()` in
  `load()` backfills them on old data. The Expenses tab has filter chips (All / Direct
  Debit / Manual / per-category), compact rows (lime `ddbar` = direct debit, checkbox on
  the right, 3-dot `actionSheet` menu per row) and a "Save & Add Another" bulk-add flow
  that remembers the last method/category.
- `loans[]` — with `appliedMonths[]`/`skippedMonths[]` for **idempotent** direct-debit
  auto-reduction, `originalTotal` for the payoff bar, `startMonth`.
- `income[]` — freelance entries (`status` pending/paid, `paidDate` set on toggle).
- `savings[]`, `investments[]` — simple name/value/note entries.
- `wishlist[]` — items with `type` outright/installments; buying creates expenses.

## Core engine (the part to be careful with)

`runEngine()` runs on load, on every render, and on `visibilitychange`:

1. **`ensureMonths()`** — walks from the earliest stored month to the current month,
   creating any missing months and instantiating recurring templates (respecting
   `startMonth`/`endMonth`). Handles the app not being opened for several months.
2. **`processLoans()`** — for each loan, for each month since `startMonth` whose DD day
   has passed, not already in `appliedMonths`/`skippedMonths` and not past the loan's end
   date, reduces the balance and records the month. Idempotent by construction.
   Creating a loan pre-marks the current month as applied if the DD day already passed
   (the user-entered balance already reflects that payment).

**Health score** (`healthScore(ym)`, computed per month from stored data, not cached):
starts at 100; −10 per bill unpaid past its due day (cap −30); overspend vs plan
proportional (1.5 pts per % over, 40 at ≥25% over); −20 if savings target unmet in the
last 5 days of the month. Late freelance income deliberately never deducts.

**Testing aid:** `?t=YYYY-MM-DD` on the URL overrides "today" (e.g.
`index.html?t=2026-10-05`) — used to verify month rollover, loan auto-reduction and
installment expiry without waiting.

## UI conventions

- 6 tabs (Home, Expenses, Loans, Income, Invest, Wishlist) rendered by `render*()`
  functions that rewrite each `<section class="view">`'s innerHTML; state lives in JS,
  re-render after every mutation.
- Add/edit uses the bottom-sheet (`openSheet`); deletes confirm via `confirmDialog`
  (iOS-style alert). Settings opens from the header gear.
- Past months are read-only in Expenses; Home can browse historical months' scores and
  Plan-vs-Actual.
- Escape all user strings with `esc()` when building HTML.

## Deployment

Push to the default branch and serve via GitHub Pages (root). After changing any cached
asset, bump the `CACHE` constant in `sw.js` or iOS will keep serving the old version.
