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
│   │   └── prefsStore.ts    # User settings: theme, audio, sound volume
│   ├── pages/               # Top-level screen views
│   │   ├── WorldMap.tsx     # Interactive map, rival state dossiers, union agenda
│   │   ├── Governance.tsx   # Tax policies, Laffer curves, cabinet portfolios
│   │   ├── Budget.tsx       # Line-by-line revenue, expenses, debt limits
│   │   ├── Industry.tsx     # 8 resources, prospecting, extraction, refinement, R&D
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

### 3. GDP Scaling Engine
- **Turn Growth Factors**:
  - `industryGdpBoost = totalIndustryLevel * 0.0004` (sum of extraction & refinement across 8 resources).
  - `advancesGdpBoost = totalAdvances * 0.0008` (sum of technological breakthrough advancements).
  - `militaryGdpBoost = min(0.015, log10(militaryPower) * 0.0015)`.
- **Immediate Action Growth**: Industrial upgrades, breakthrough discoveries (+0.8%), and military recruitment stimulate the economy and immediately increase GDP base value.

### 4. Turn Briefing & Event Modal Architecture
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
