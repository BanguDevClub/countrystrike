# AGENTS.md — Country Strike Agent Guidelines & Project Context

## Project Overview

**Country Strike** is a turn-based geopolitical strategy and simulation game built with **React 19**, **TypeScript**, **Vite**, and **Zustand**. Players lead a sovereign nation, balancing domestic budgets, managing industrial production, directing six cabinet ministries, negotiating international trade and alliances, and navigating crises through dice-driven decisions and multi-event turn briefings.

### Core Technology Stack

- **Framework**: React 19 (React DOM)
- **Language**: TypeScript (strict mode, ES2022 target)
- **State Management**: Zustand with `persist` middleware
- **Build Tool**: Vite & Rolldown
- **Visuals & Charts**: Recharts, Lucide Icons, KaTeX (math formulas), SVG flags/maps
- **Styling**: Vanilla CSS with comprehensive CSS custom property design tokens (`tokens.css`, `layout.css`, `modals.css`, `pages.css`)

---

## Architecture & Directory Structure

```
countrystrike/
├── src/
│   ├── game/                # Pure simulation engine and domain models
│   │   ├── audio.ts         # Procedural sound effects and master output bus
│   │   ├── music.ts         # Generative soundtracks and lookahead scheduler
│   │   ├── types.ts         # Central TypeScript interfaces, enums, domain types
│   │   ├── constants.ts     # Game constants, resource definitions, unit profiles
│   │   ├── engine.ts        # Turn advance loop, AI behaviors, price updates, GDP
│   │   ├── selectors.ts     # Pure derived state: budget, military power, tax curves
│   │   ├── events.ts        # Event registry, candidate matching, effect application
│   │   ├── ministryEvents.ts# 600+ ministry events and sovereign bailout requests
│   │   ├── worldgen.ts      # Seeded procedural world generation (Voronoi continents)
│   │   ├── format.ts        # Financial, numeric, percentage, and quantity formatting
│   │   └── rng.ts           # Mulberry32 seeded deterministic PRNG
│   ├── state/
│   │   ├── gameStore.ts     # Primary game store: turn flow, actions, modal router
│   │   └── prefsStore.ts    # User settings: theme, audio, soundtrack choice
│   ├── pages/               # Top-level screen views
│   │   ├── StartMenu.tsx    # World setup: counts, difficulty, economy modifiers
│   │   ├── CountryPicker.tsx # Post-generation nation selection and stat comparison
│   │   ├── WorldMap.tsx     # Interactive map, rival state dossiers, union agenda
│   │   ├── Governance.tsx   # Tax policies, Laffer curves, cabinet portfolios
│   │   ├── Budget.tsx       # Line-by-line revenue, expenses, debt limits
│   │   ├── Industry.tsx     # 8 resources, prospecting, extraction, refinement, R&D
│   │   ├── Commerce.tsx     # Household basket, prices, taxes/subsidies, FX parity
│   │   ├── Military.tsx     # Order of battle, unit procurement, power shares
│   │   ├── Trade.tsx        # Import/export contracts, bilateral agreements
│   │   ├── Ranking.tsx      # Global comparative rankings
│   │   ├── Logs.tsx         # Filterable event and diplomatic history
│   │   └── Methodology.tsx  # Interactive mathematical formulas and reference rules
│   ├── components/          # Reusable UI components
│   │   ├── modals.tsx       # Turn Briefing modal, dossier modals, check dialogs
│   │   ├── Layout.tsx       # Site header, turn meter, action points, navigation
│   │   ├── ui.tsx           # Badges, progress bars, section cards, stat tiles
│   │   ├── Flag.tsx         # Procedural SVG national flag renderer
│   │   └── Icon.tsx         # Lucide icon bridge
│   └── styles/              # Design tokens and stylesheets
```

---

## Core Domain Mechanics

### 1. Ministries & Cabinet Governance

There are six cabinet ministries:

1. **Finance** (`finance`): Controls tax efficiency and creditworthiness.
2. **Foreign Affairs** (`foreign`): Governs diplomatic relations and trade bonuses.
3. **Defense** (`defense`): Manages armed forces readiness, defense power, and upkeep.
4. **Industry** (`industry`): Coordinates resource extraction and refinement throughput.
5. **The Interior** (`interior`): Maintains national security and fights domestic corruption.
6. **Health** (`health`): Drives Human Development Index (HDI), population growth, and approval.

#### Ministry Structure & Metrics

- **Institutional Tiers (1–5)**: Each ministry has an upgrade tier (`level`). Higher tiers provide permanent capacity multipliers to that ministry's domain.
- **Minister Profile**:
  - `skill` (0–100): Determines operational efficiency and execution quality.
  - `loyalty` (0–100): Prevents ministerial betrayals, resignations, and coups.
  - `corruption` (0–100): High values leak revenue, degrade security, or trigger scandals.
- **Dynamic Turn Evolution**:
  - **Low Budget**: Minister loyalty drops (-1 to -3/turn); corruption rises (+0 to +2/turn).
  - **High Budget**: Minister loyalty increases (+1 to +2/turn); chance to improve skill (+1) and reduce corruption (-1).
- **Cabinet Actions**:
  - **Set Budget**: Toggles Low (0.4% GDP), Normal (0.8% GDP), or High (1.6% GDP).
  - **Audit Minister**: Costs money & 1 action; reduces minister corruption by 20.
  - **Upgrade Ministry**: Advances institutional tier (Tiers 1–5), grants +6 skill, permanently expands national GDP by +0.3%.
  - **Train Minister**: Leadership seminar; boosts minister skill by +12 and loyalty by +10.
  - **Replace Minister**: Dismisses incumbent and installs a fresh vetted head with low corruption.

### 2. Ministry Event Set & Sovereign Bailouts

The game features over 600 handcrafted, thematic events located in `src/game/ministryEvents.ts`:

- **100+ Events per Ministry**: Distributed across four thematic categories:
  - `corruption`: Embezzlement, bribery syndicates, procurement kickbacks, ghost payrolls.
  - `betrayal`: Leaked secrets, defection, unauthorized treaties, industrial sabotage, mutiny.
  - `improvement`: Algorithmic innovations, volunteer compliance, lean workflows, record yields.
  - `upgrade`: High-tech automation, quantum-secure comms, advanced R&D institutes.
- **Rarities**: Weighted as `common` (wt: 20), `rare` (wt: 10), `epic` (wt: 4), `legendary` (wt: 1).
- **Emergency Bailout Requests**: When a rival nation's treasury hits $0M, they send an emergency appeal naming their specific country. Players can grant relief (+35 relations, +5 approval), issue high-interest distress loans, or refuse (triggering heavy sovereign debt surcharges on the broke rival).
- **Ministry event gates** (`eventCandidates` in `events.ts`): a betrayal event for a ministry is suppressed while that minister's loyalty is above 70; a corruption event is suppressed while that minister's corruption is below 30.
- **Sovereign auction**: when player debt exceeds 1,000% of GDP, `generateEvents` queues `sovereign_auction` first. Choices clear the debt through receivership, auction state assets, or default, each with heavy social and diplomatic costs.
- **Misc events**: the core deck includes grey-market formalisation, emigration, a regional infrastructure fund and a digital corridor, alongside the existing core and ministry events.
- **Passive external approval**: once relations hit 100, external approval rises by 0.2–1.2 per turn depending on Foreign ministry capacity. Campaigns remain the faster route.

### 3. GDP Growth Engine

- **Decomposed Drivers** (`gdpGrowthDrivers` in `selectors.ts`): base expansion, industrial scale (capped at +1.5%/turn), technology advances, military demand, resource production share (`production value / GDP × 0.03`), positive resource surplus, stock buffers, shortages/deficits, reserve depletion, fiscal balance, debt burden, treasury reserve, tax burden, corporate tax competitiveness (`(20 − corporate) × 0.0008`, capped ±1%/turn), corruption and trait/cabinet effects.
- **Negative Pressure**:
  - Debt-to-GDP above 60%: `−0.008` per 100 points; above 120%: an additional `−0.012` per 100 points.
  - Zero treasury: `−0.005`/turn; treasury below 1% of GDP: `−0.002`/turn.
  - Each resource in shortage or under four turns of stock cover: share of a `−0.009` penalty.
  - Reserve depletion below 20 turns of runway: up to `−0.005`/turn.
- **Positive Pressure**: resource production share, positive resource balances, global stock cover, funded treasury (>20% of GDP) and a positive fiscal balance.
- **Immediate Action Growth**: Industrial upgrades, breakthrough discoveries (+0.8%), and military recruitment stimulate the economy and immediately increase GDP base value.
- **Normalisation**: `updateCountryStats` clamps the final turn growth to `[-0.50, +0.50]`. Individual drivers stay small; the debt burden driver is capped at `-0.25`.
- **Commerce drivers**: consumer availability/affordability, cost of living and inflation add `commerce`, `costOfLiving` and `inflation` drivers.
- **Income tax and depression**: the depression target adds `(income tax − 20) × 0.18`, so income tax below 20% eases depression and above 20% deepens it.
- The Budget page renders every driver, and the Methodology page documents the equations.

### 4. Resource Market & Prices

- **Global market pass** (`runWorldMarket` in `engine.ts`): each turn rival exporters with a surplus are matched to rival importers with a deficit. Contracts last 2–4 turns and move real quantities, money and price coverage.
- **Price drivers** (`computeMarket` in `selectors.ts`): aggregate supply/demand, per-country deficits, active export volume covering those deficits, global stock cover and reserve depletion.
- **Reference price**: `basePrice × settings.resourcePrices × pressure`, clamped to 0.35–3.6 pressure. Prices blend toward the target each turn using `settings.marketVolatility` for noise and convergence speed.
- **Starting scarcity** (`makeResources` in `worldgen.ts`): every country gets one commodity endowment; 65% also get a strategic endowment. Non-endowed commodity production starts at 42–90% of consumption and non-endowed strategic production at 15–55%. Thirty percent of non-endowed strategic deposits are barren. Most starting flows are therefore in deficit.
- **Royalty revenue**: `min(production value × royalty rate × 0.35, 15% of GDP)`. The cap prevents micro-economies with large deposits from generating runaway income.
- **Trade screen**: shows the world market clearing table (supply, demand, deficit, exports, coverage, reserve cover, pressure), live player contracts and world contracts.

### 5. Consumer Commerce, Inflation & Currencies

- **Consumer goods** (`COMMERCE_GOODS` in `constants.ts`): rice, eggs, chicken, beef, fuel, electricity, cars, housing, healthcare, education, transport and telecom. Each has an input resource, resource share, input-per-unit, base price, household demand per million and price elasticity.
- **Commerce snapshot** (`computeCommerce` in `selectors.ts`):
  - Domestic supply = `(production + resource imports − resource exports) × share ÷ inputPerUnit × service capacity`.
  - Demand = `population × demandPerMillion`.
  - Consumer imports cover `85%` of the domestic gap up to a class cap (80% food/energy, 60% manufactured, 40% services); domestic surpluses are exported.
  - Price pressure = `clamp((demand ÷ supply)^elasticity × (1 + 0.2 × import share), 0.4, 3)`.
  - Consumer price = `basePrice × pressure × (1 + policy/100)`; policy runs from −60% subsidy to +120% tax.
  - Fiscal balance = levies − subsidies. Consumer trade = export credit − import bill; households pay it, so it affects the current account and FX but not the state budget.
  - The basket feeds GDP (`commerce`, `costOfLiving`, `inflation` drivers), approval, depression, HDI and Gini.
- **Actions**: `setCommercePolicy` changes one good per action and logs the decision.
- **Currency tools**: the Commerce page has a two-country comparison (cross rate, inflation, PPP gap, strength edge) and a currency strength ranking. Strength = `100 − 1.6×inflation − 1.2×PPP gap − 0.4×depreciation`.
- **Inflation**: `stats.inflation` is annualised percent per turn. `inflationTarget` combines monetised deficit, shortage share, basket pressure, demand-pull growth, FX pass-through, credibility and a stabilisation term above 8%.
- **Currencies**: every country has a `CurrencyState` (`rate`, `fairRate`, `changePct`, `regime`). `updateCurrencies` drifts the PPP fair rate with the damped relative-inflation differential, then mean-reverts the market rate toward fair value with debt/approval/shortage risk premiums and a trade-flow push. Floating/managed/pegged regimes move at different speeds and caps.
- **Save migration**: `normalizeGameState` fills `stats.inflation`, `stats.pppPerCapita`, `stats.averageRelations`, `stats.worldApproval`, `commercePolicy` and `currency` for older saves; `SAVE_VERSION` is 5.

### 6. Composite Score

- **Pillars**: Treasure (13), Debt (11), GDP (9), GDP per capita (8), PPP per capita (8), Inflation (4), Currency gap (4), Average relations (5), External approval (4), Population (8), Military power (7), Approval (5), HDI (5), Gini (4), Violence (2), Depression (3). Weights total 100.
- **Normalization**: min–max across living states; low-is-better pillars are inverted. Treasury, GDP, GDP per capita, PPP per capita and population are log-scaled.
- **PPP per capita**: `(GDP / population) ÷ (consumer basket index / 100)`. It is stored in `CountryStats`, updated each turn from `computeCommerce`, and captured in every `CountrySnapshot` for history.
- **Currency gap**: `|FX / fair FX − 1| × 100`, stored in snapshots for the ranking and macro history charts.
- **World standing**: `refreshWorldStanding` computes `stats.averageRelations` and `stats.worldApproval` for every living state each turn. Pairwise alignment is the mean of the two alignment baselines; the player's baseline is the mean rival alignment. External approval uses the same smoothing over integration approval.

### 7. Action Costs & Tax Levers

- **No GDP scaling for purchases**: industry operations, cabinet actions, diplomacy, approval campaigns, mergers and war mobilisation use fixed base costs scaled by resource/ministry level.
- **Industry cost**: `action base × (1 + 0.12 × extraction+refinement levels + 0.25 × advances) × category factor × industry budget factor`. Strategic resources use a 3.0× category factor.
- **Cabinet cost**: `action base × (1 + 0.4 × (tier − 1))`, using `ministryActionCost`, `diplomaticMissionCost`, `approvalCampaignCost`, `mergerCost` and `warMobilizationCost` from `engine.ts`.
- **Recurring ministry budgets** remain a share of GDP because they are policy rates, not one-off purchases.
- **Corporate tax**: below 20% adds GDP growth, above 20% subtracts it (capped ±1%/turn).
- **Income tax**: below 20% lowers the depression target, above 20% raises it.

### 8. Turn Briefing & Event Modal Architecture

- **Once-Per-Turn Execution**: At the start of every turn, the briefing modal opens automatically.
- **Turn Event Pagination**: When multiple events occur in a turn (e.g. sovereign bailout request + ministry event + national crisis), the modal provides full pagination:
  - Numbered event pills (`1. Country Bailout`, `2. Ministry Upgrade`, `3. Corruption Crisis`).
  - `Prev` and `Next` navigation controls.
  - Active event status badges (`Pending`, `Resolved`).
- **All Turns Event History**:
  - The modal preserves every resolved event permanently across all turns in `game.eventHistory`.
  - Filterable by turn (`All Turns`, `Turn 1`, `Turn 2`, etc.).
  - Detailed **Before & After Stat Diffs**: Shows exact before, after, and delta values for Approval, GDP, Treasury, Debt, HDI, Security, and Corruption.

---

## Best Practices & Development Guidelines

### 1. State Immutability & Cloning

- All game mutations in `gameStore.ts` must use `cloneGame(current)` which utilizes `structuredClone(game)`.
- Never mutate state in pure selectors (`selectors.ts`) or event candidate filters (`events.ts`).

### 2. TypeScript Standards

- Zero `any` policy. All state shapes, checks, and parameters must be explicitly typed using definitions from `src/game/types.ts`.
- When adding event effects, extend `EventEffects` and handle the corresponding execution in `applyEventEffects` in `src/game/events.ts`.

### 3. UI & Styling

- Always use CSS variables from `src/styles/tokens.css` (`var(--surface)`, `var(--accent)`, `var(--border)`, `var(--fg)`, etc.).
- Never hardcode light/dark backgrounds; respect the user's active theme (`Midnight`, `Daylight`, `Latte`, `Frappé`, `Macchiato`, `Mocha`).
- Modals must be responsive and adapt on mobile (`max-width: 768px`) using CSS grid/flex fallbacks.

### 4. Testing & Verification Rules

- **Do Not Play The Game for Testing**: Per project instructions, testing must not involve prolonged manual gameplay.
- **Minimal Action Verification**: Open the app using a headless browser or automated script with the absolute minimum number of clicks (e.g. click "Draw the world" to initialize, verify the modal opens, click one tab, inspect element state, and exit).
- **Mandatory Checks**:
  ```bash
  npm run typecheck    # Verifies TypeScript compilation
  npm run lint         # Verifies ESLint compliance
  npm run build        # Verifies production asset bundling
  ```
