<p align="center">
  <img src="docs/screenshots/start-desktop.webp" alt="Country Strike start screen" width="100%" />
</p>

<h1 align="center">Country Strike</h1>

<p align="center">
  <strong>Ten actions. One country. A world to win.</strong><br />
  A turn-based geopolitical strategy game that runs entirely in the browser.
</p>

<p align="center">
  <a href="https://banguDevClub.github.io/countrystrike/">Play the game</a> ·
  <a href="https://github.com/BanguDevClub/countrystrike">Source</a> ·
  <a href="https://github.com/BanguDevClub/countrystrike/issues">Issues</a>
</p>

<p align="center">
  <img alt="React 19" src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white" />
  <img alt="TypeScript 6.0" src="https://img.shields.io/badge/TypeScript-6.0-3178c6?style=flat-square&logo=typescript&logoColor=white" />
  <img alt="Vite 8" src="https://img.shields.io/badge/Vite-8-646cff?style=flat-square&logo=vite&logoColor=white" />
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-a6e3a1?style=flat-square" />
</p>

---

Country Strike drops you into the cabinet of a procedurally generated nation. Run a budget,
prospect and refine eight resources, bargain with rival governments, keep a cabinet of flawed
ministers in line, and decide whether the world will be united by diplomacy or by force.

The game is a local-first SPA. There is no backend, no account and no network state: a seeded
world and its history are persisted in `localStorage` after every action.

## The game

- **A living procedural world** — 10–20 nations across 1–5 continents, each with a culture,
  biome, weather pattern and two additional national traits. Every trait gives a buff, a debuff
  or a mixed modifier.
- **Ten actions per turn** — every ministerial decision, industrial operation, recruitment,
  trade contract, diplomatic mission and war declaration is budgeted in actions.
- **A budget with teeth** — corporate and income taxes, import tariffs, resource royalties,
  six ministries, military upkeep, public services, debt service and trade contracts. The
  Laffer curve is modelled, not decorative.
- **Eight resource industries** — water, energy, agriculture, livestock, oil, metal, rare earth
  and uranium. Prospect, expand extraction, build refinement and research up to five major
  advancements per resource.
- **A composite world ranking** — treasure, debt, GDP, population, military power, approval,
  HDI, Gini, violence and depression become a weighted 0–100 score with historical charts.
- **Trade as foreign policy** — regional balances, supply-and-demand prices, 3-turn minimal
  auto-deals enhancing relations each turn with all countries in need, 5-turn manual contracts,
  price posture, and diplomatic consequences.
- **Two routes to the end** — reach 100 relations, unlock external approval, campaign it to 100
  and merge a country; or destroy every rival by war. Win by leaving one state standing.
- **Six themes** — Midnight, Daylight and the four official Catppuccin flavours, with accessible
  text tokens and a theme-aware chart palette.

<p align="center">
  <img src="docs/screenshots/world-desktop.webp" alt="The Country Strike world map" width="100%" />
</p>

## Quick start

Requires **Node.js 22.12+** (Node 24 recommended).

```bash
npm install
npm run dev
```

Open <http://localhost:5173/countrystrike/>.

The production build is served under the `/countrystrike/` base path:

```bash
npm run build
npm run preview
```

## Scripts

| Command                | What it does                                       |
| ---------------------- | -------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                  |
| `npm run build`        | Type-check and build the production bundle         |
| `npm run preview`      | Preview the production build                       |
| `npm run lint`         | Run ESLint                                         |
| `npm run lint:fix`     | Apply safe ESLint fixes                            |
| `npm run format`       | Format with Prettier                               |
| `npm run format:check` | Verify formatting                                  |
| `npm run typecheck`    | Run the TypeScript project build                   |
| `npm run validate`     | Typecheck + lint + format check + production build |
| `npm run audit`        | Audit production/dev dependencies                  |
| `npm run audit:fix`    | Apply non-breaking audit fixes                     |
| `npm run outdated`     | List outdated packages                             |
| `npm run update`       | Update dependencies within their ranges            |
| `npm run clean`        | Remove build and Vite cache output                 |
| `npm run reinstall`    | Reinstall from a clean `node_modules`              |
| `npm run fresh`        | Reinstall and validate                             |

## Themes

| Theme     | Family         | Description                                       |
| --------- | -------------- | ------------------------------------------------- |
| Midnight  | Country Strike | A deep navy dark theme with blue and mint accents |
| Daylight  | Country Strike | A high-contrast light theme                       |
| Latte     | Catppuccin     | The official light Catppuccin palette             |
| Frappé    | Catppuccin     | The official mid-dark Catppuccin palette          |
| Macchiato | Catppuccin     | The official dark Catppuccin palette              |
| Mocha     | Catppuccin     | The official darkest Catppuccin palette           |

Themes are CSS-variable driven. Charts read the theme palette through the same tokens, so
switching themes updates the entire interface and every visualisation immediately.

## Architecture

```mermaid
graph TD
  UI[React pages and modals] --> Store[Zustand game store]
  Store --> Engine[Turn engine]
  Engine --> Economy[Budget, resources, prices]
  Engine --> Events[Event deck and conditions]
  Engine --> AI[Rival AI and hostility]
  Worldgen[Seeded world generator] --> Store
  Store --> Save[(localStorage save)]
  Store --> History[(Turn snapshots)]
  History --> Charts[Recharts views]
  Theming[CSS themes] --> UI
  Theming --> Charts
```

```
src/
├── components/       Shared UI, layout, icon registry, flag renderer, modals
├── game/
│   ├── audio.ts      Procedural sound effects and ambient music
│   ├── constants.ts  Resources, units, governments, ministries, traits, scoring
│   ├── engine.ts     Turn settlement, AI, history, event scheduling
│   ├── events.ts     Event deck, conditions and effect application
│   ├── format.ts     Money, quantity and percentage formatting
│   ├── rng.ts        Deterministic mulberry32 PRNG
│   ├── selectors.ts  Resource flows, budget, composite score and derived stats
│   ├── types.ts      Domain types
│   └── worldgen.ts   Seeded map, countries and initial state
├── hooks/            Small UI hooks
├── pages/            One route per game section
├── state/            Game store and persisted preferences
└── styles/           Theme tokens and responsive styles
```

## Design notes

### Deterministic worlds

Every random draw advances a stored 32-bit mulberry32 state. A reload never rerolls an
industrial check, an event or a price movement. The seed and current RNG state live with the
save.

### Resource flow

```
Extraction = level × capacity × (1 + extraction modifiers) × industry budget
Refinement = level × capacity × (1 + 0.55 × extraction modifiers) × industry budget
Production = min(Extraction, Refinement) × (1 + 0.02 × research + 0.15 × advances)
Consumption = population × civil factor + Σ(unit count × unit resource use)
Balance = production + imports − consumption − exports
Stock' = max(0, stock + balance)
```

The full equations — including the budget, Laffer curve, market maker, military power, trade
relations and composite score — are rendered inside the game on the **Methodology** page with
KaTeX.

### Saving

The game state, current page and visual preferences are stored locally:

- `countrystrike-save` — the world, turn history and current screen
- `countrystrike-prefs` — theme, sound effects and music preference

Starting a new world replaces the save after an explicit confirmation.

## Quality checks

The project is developed against a narrow verification set:

- `npm run validate` covers type safety, linting, formatting and the production build.
- `npm audit` currently reports **0 vulnerabilities** (with a `minimatch` override for the
  development toolchain).
- TypeScript is held at **6.0.3** because `typescript-eslint` 8.x supports TypeScript `< 6.1`;
  TypeScript 7 is available but would break the current lint contract.
- UI verification was performed on desktop and mobile viewports, across the light and dark
  theme families, with interaction checks for the world map, budget, governance, industry,
  military, trade, ranking, logs and methodology screens.

## Deployment

The included **GitHub Pages** workflow builds and publishes the site on every push to `main`.
Enable Pages with **GitHub Actions** as the source. The Vite `base` is already set to
`/countrystrike/` to match the project URL:

<https://banguDevClub.github.io/countrystrike/>

## License

Released under the [MIT License](LICENSE).  
Built by [BanguDevClub](https://github.com/BanguDevClub).
