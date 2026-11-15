import { useCallback, useMemo, useState } from 'react'
import { GOVERNMENT_BY_ID, RESOURCE_IDS, RESOURCES, TRAIT_BY_ID, UNITS } from '../game/constants'
import type { Country, LogCategory } from '../game/types'
import { selectPlayer, useGame } from '../state/gameStore'
import { averageWorldApproval, totalWorldGdp, worldPopulation } from '../game/engine'
import { computeComposites, militaryPower, relationLabel } from '../game/selectors'
import {
  MAP_COLOR_MODES,
  MAP_FILTERS,
  buildMapColorContext,
  buildMapLegend,
  buildMapRoutes,
  filterMapCountries,
  type MapColorMode,
  type MapFilter,
} from '../game/mapVisuals'
import { formatDecimal, formatMoney, formatNumber, formatUsd, formatPercent } from '../game/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Flag } from '../components/Flag'
import { Icon } from '../components/Icon'
import { WorldMapCanvas } from '../components/WorldMapCanvas'
import { Badge, EmptyState, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'

const categoryTone: Record<
  LogCategory,
  'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | 'muted'
> = {
  economy: 'accent',
  industry: 'neutral',
  diplomacy: 'accent',
  military: 'negative',
  governance: 'warning',
  event: 'warning',
  world: 'muted',
}

function HoverCard({
  country,
  continent,
  x,
  y,
}: {
  country: Country
  continent: string
  x: number
  y: number
}) {
  const government = GOVERNMENT_BY_ID[country.government]
  const left = Math.max(12, Math.min(x + 16, window.innerWidth - 244))
  const top = Math.max(12, Math.min(y + 16, window.innerHeight - 218))
  return (
    <div className="map-hover-card" style={{ left, top }}>
      <div className="map-hover-head">
        <Flag seed={country.flagSeed} code={country.code} size="sm" />
        <div>
          <strong>{country.name}</strong>
          <span>
            {government?.name} · {country.code}
          </span>
        </div>
      </div>
      <div className="map-hover-rows">
        <span>
          Continent <strong>{continent || '—'}</strong>
        </span>
        <span>
          Alignment <strong>{relationLabel(country.relations)}</strong>
        </span>
        <span>
          Relations <strong>{Math.round(country.relations)}</strong>
        </span>
        <span>
          GDP <strong>{formatMoney(country.stats.gdp)}</strong>
        </span>
        <span>
          Military <strong>{formatDecimal(militaryPower(country), 0)}</strong>
        </span>
      </div>
      <div className="map-hover-foot">Click to open dossier</div>
    </div>
  )
}

export function WorldMap() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const openCountry = useGame((state) => state.openCountry)
  const setPage = useGame((state) => state.setPage)
  const [hover, setHover] = useState<{ country: Country; x: number; y: number } | null>(null)
  const [colorMode, setColorMode] = useState<MapColorMode>('terrain')
  const [statusFilter, setStatusFilter] = useState<MapFilter>('all')
  const [continentFilter, setContinentFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [showRoutes, setShowRoutes] = useState(true)
  const isNarrow = useMediaQuery('(max-width: 700px)')

  const composites = useMemo(() => (game ? computeComposites(game.countries) : new Map()), [game])
  const rivalCountries = useMemo(
    () =>
      game?.countries.filter((country) => country.status === 'alive' && !country.isPlayer) ?? [],
    [game],
  )
  const merged = game?.countries.filter((country) => country.status === 'merged').length ?? 0
  const destroyed = game?.countries.filter((country) => country.status === 'destroyed').length ?? 0
  const totalRivals = Math.max(1, (game?.countries.length ?? 1) - 1)
  const goalProgress = ((merged + destroyed) / totalRivals) * 100
  const topTargets = [...rivalCountries].sort((a, b) => b.relations - a.relations).slice(0, 4)
  const recentLogs = game ? [...game.logs].slice(-5).reverse() : []
  const continents = game?.continents ?? []

  const colorContext = useMemo(
    () => (game ? buildMapColorContext(game.countries, game.settings) : null),
    [game],
  )
  const visibleIds = useMemo(() => {
    if (!game) return new Set<string>()
    return filterMapCountries(
      game.countries,
      { filter: statusFilter, continentId: continentFilter, query },
      game.settings,
    )
  }, [game, statusFilter, continentFilter, query])
  const routes = useMemo(
    () =>
      game && player ? buildMapRoutes(game.countries, player, game.deals, isNarrow ? 8 : 20) : [],
    [game, player, isNarrow],
  )
  const legend = useMemo(
    () => (game && colorContext ? buildMapLegend(colorMode, game.countries, colorContext) : null),
    [game, colorContext, colorMode],
  )
  const handleCountryClick = useCallback(
    (country: Country) => openCountry(country.id),
    [openCountry],
  )
  const handleHoverCountry = useCallback(
    (country: Country, x: number, y: number) => setHover({ country, x, y }),
    [],
  )
  const handleHoverEnd = useCallback(() => setHover(null), [])
  const handleContinentClick = useCallback((continentId: string) => {
    setContinentFilter((current) => (current === continentId ? 'all' : continentId))
  }, [])

  if (!game || !player || !colorContext) return null

  const averageRelations =
    rivalCountries.length > 0
      ? rivalCountries.reduce((total, country) => total + country.relations, 0) /
        rivalCountries.length
      : 100
  const totalPower = game.countries
    .filter((country) => country.status === 'alive')
    .reduce((total, country) => total + militaryPower(country), 0)
  const worldApproval = averageWorldApproval(game)
  const colorModeHint = MAP_COLOR_MODES.find((mode) => mode.id === colorMode)?.hint ?? ''
  const hoveredContinent = hover
    ? (continents.find((continent) => continent.id === hover.country.continentId)?.name ?? '')
    : ''

  return (
    <div className="page map-page">
      <PageHeader page="map">
        <button type="button" className="btn" onClick={() => setPage('ranking')}>
          <Icon name="Trophy" size={16} /> World rankings
        </button>
        <button type="button" className="btn" onClick={() => setPage('logs')}>
          <Icon name="ScrollText" size={16} /> Global logs
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4 map-stat-row">
        <StatTile
          label="Treasury"
          value={formatMoney(player.stats.treasury)}
          hint={`Debt ${formatMoney(player.stats.debt)}`}
          icon="Banknote"
          tone="positive"
        />
        <StatTile
          label="Approval"
          value={formatPercent(player.stats.approval)}
          hint={`Security ${formatPercent(player.stats.security)}`}
          icon="Users"
        />
        <StatTile
          label="GDP"
          value={formatMoney(player.stats.gdp)}
          hint={`${formatUsd(player.stats.gdp / player.stats.population)} per capita`}
          icon="ChartLine"
        />
        <StatTile
          label="Diplomatic course"
          value={formatDecimal(averageRelations, 0)}
          hint={`${rivalCountries.length} active rival nations`}
          icon="Handshake"
          tone={averageRelations < 0 ? 'negative' : 'accent'}
        />
      </div>

      <div className="map-layout">
        <SectionCard
          className="map-card"
          title={
            <span className="map-card-title">
              <span className="live-dot" />
              The world in {game.turn} turn{game.turn === 1 ? '' : 's'}
            </span>
          }
          subtitle={`${visibleIds.size} of ${game.countries.length} states highlighted. Filter the world, switch palettes and trace active trade corridors.`}
          action={
            <div className="map-card-actions">
              <Badge tone="accent" icon="Globe">
                {game.countries.filter((country) => country.status === 'alive').length} sovereign
                states
              </Badge>
              <Badge tone="muted" icon="Layers">
                {continents.length} continent{continents.length === 1 ? '' : 's'}
              </Badge>
              <span className="map-legend-inline">
                <span className="legend-dot player-dot" /> You
              </span>
            </div>
          }
        >
          <div className="map-toolbar">
            <div className="search-field map-search-field">
              <Icon name="Search" size={15} />
              <input
                className="input input-small"
                placeholder="Find a nation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search nations by name, code or capital"
              />
              {query.length > 0 && (
                <button
                  type="button"
                  className="map-search-clear"
                  onClick={() => setQuery('')}
                  aria-label="Clear nation search"
                >
                  <Icon name="X" size={13} />
                </button>
              )}
            </div>
            <select
              className="select select-small map-filter-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as MapFilter)}
              aria-label="Filter nations by state status"
            >
              {MAP_FILTERS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              className="select select-small map-filter-select"
              value={continentFilter}
              onChange={(event) => setContinentFilter(event.target.value)}
              aria-label="Filter nations by continent"
            >
              <option value="all">All continents</option>
              {continents.map((continent) => (
                <option key={continent.id} value={continent.id}>
                  {continent.name}
                </option>
              ))}
            </select>
            <div className="map-toolbar-actions">
              <button
                type="button"
                className={`map-toggle ${showLabels ? 'is-active' : ''}`}
                onClick={() => setShowLabels((current) => !current)}
                aria-pressed={showLabels}
              >
                <Icon name="MapPin" size={14} /> Labels
              </button>
              <button
                type="button"
                className={`map-toggle ${showRoutes ? 'is-active' : ''}`}
                onClick={() => setShowRoutes((current) => !current)}
                aria-pressed={showRoutes}
                title={
                  routes.length > 0
                    ? 'Toggle active trade corridors'
                    : 'Sign a trade deal to open a corridor'
                }
              >
                <Icon name="Route" size={14} /> Trade routes
              </button>
            </div>
          </div>

          <div className="map-colorbar">
            <span className="map-colorbar-label">
              <Icon name="Palette" size={14} /> Map color
            </span>
            <div className="segmented segmented-small map-color-segmented">
              {MAP_COLOR_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  className={colorMode === mode.id ? 'is-active' : ''}
                  onClick={() => setColorMode(mode.id)}
                  aria-pressed={colorMode === mode.id}
                  title={mode.hint}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <span className="map-colorbar-hint">{colorModeHint}</span>
          </div>

          <div className="map-frame">
            <WorldMapCanvas
              game={game}
              colorMode={colorMode}
              colorContext={colorContext}
              visibleIds={visibleIds}
              routes={routes}
              hoveredId={hover?.country.id ?? null}
              activeContinentId={continentFilter}
              showLabels={showLabels}
              showRoutes={showRoutes}
              narrow={isNarrow}
              onSelectCountry={handleCountryClick}
              onHoverCountry={handleHoverCountry}
              onHoverEnd={handleHoverEnd}
              onSelectContinent={handleContinentClick}
            />
            {visibleIds.size === 0 && (
              <div className="map-filter-empty">
                <Icon name="Search" size={15} /> No nations match these filters.
              </div>
            )}
            {hover && (
              <HoverCard
                country={hover.country}
                continent={hoveredContinent}
                x={hover.x}
                y={hover.y}
              />
            )}
          </div>

          <div className="map-legend">
            {legend?.kind === 'gradient' ? (
              <span className="map-legend-gradient">
                <small>{legend.from}</small>
                <span className="legend-gradient" style={{ background: legend.gradient }} />
                <small>{legend.to}</small>
              </span>
            ) : (
              legend?.items.map((item) => (
                <span key={item.label}>
                  <span className="legend-swatch" style={{ background: item.color }} />
                  {item.label}
                </span>
              ))
            )}
            {colorMode !== 'alignment' && (
              <>
                <span>
                  <span className="legend-swatch merged-swatch" /> Integrated
                </span>
                <span>
                  <span className="legend-swatch destroyed-swatch" /> Fallen
                </span>
              </>
            )}
            {showRoutes && routes.length > 0 && (
              <>
                <span>
                  <span className="route-swatch route-swatch-import" /> Imports
                </span>
                <span>
                  <span className="route-swatch route-swatch-export" /> Exports
                </span>
                {routes.some((route) => route.kind === 'mixed') && (
                  <span>
                    <span className="route-swatch route-swatch-mixed" /> Both ways
                  </span>
                )}
              </>
            )}
            {showRoutes && routes.length === 0 && (
              <span className="map-legend-note">No active trade corridors</span>
            )}
            <span className="map-legend-hint">Select a nation for its dossier</span>
          </div>
        </SectionCard>

        <aside className="map-sidebar">
          <SectionCard className="player-mini-card">
            <div className="player-mini-head">
              <Flag seed={player.flagSeed} code={player.code} size="md" />
              <div className="player-mini-copy">
                <span className="mini-kicker">You govern</span>
                <h2>{player.name}</h2>
                <span>
                  {GOVERNMENT_BY_ID[player.government]?.name} · {player.code}
                </span>
              </div>
              <button
                type="button"
                className="icon-btn"
                onClick={() => openCountry(player.id)}
                aria-label="Open your country dossier"
              >
                <Icon name="ArrowUpRight" size={16} />
              </button>
            </div>
            <div className="player-mini-stats">
              <span>
                <small>Composite</small>
                <strong>{formatDecimal(composites.get(player.id)?.score ?? 0, 1)}</strong>
              </span>
              <span>
                <small>Approval</small>
                <strong>{formatPercent(player.stats.approval)}</strong>
              </span>
              <span>
                <small>Military</small>
                <strong>{formatDecimal(militaryPower(player), 0)}</strong>
              </span>
            </div>
            <div className="player-mini-traits">
              {[player.culture, player.biome, player.weather].map((id) => (
                <Badge key={id} tone="muted">
                  {TRAIT_BY_ID[id]?.name ?? id}
                </Badge>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="goal-card"
            title="The union agenda"
            subtitle="Merge or remove every rival to win."
            action={
              <span className="goal-count">
                {merged + destroyed}/{totalRivals}
              </span>
            }
          >
            <ProgressBar value={goalProgress} tone="positive" />
            <div className="goal-stats">
              <span>
                <Icon name="Handshake" size={14} /> {merged} merged
              </span>
              <span>
                <Icon name="Swords" size={14} /> {destroyed} destroyed
              </span>
              <span>
                <Icon name="Globe" size={14} /> {rivalCountries.length} remain
              </span>
            </div>
            <p className="helper-text">
              Reach 100 relations with a country to unlock its external approval. At 100 approval,
              merge it. War is always an option, never a cheap one.
            </p>
            <div className="target-list">
              {topTargets.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  className="target-row"
                  onClick={() => openCountry(country.id)}
                >
                  <Flag seed={country.flagSeed} code={country.code} size="sm" />
                  <span className="target-name">{country.name}</span>
                  <span
                    className={`target-relation ${country.relations >= 60 ? 'text-positive' : country.relations < 0 ? 'text-negative' : ''}`}
                  >
                    {relationLabel(country.relations)} {Math.round(country.relations)}
                  </span>
                  <Icon name="ChevronRight" size={14} />
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            className="world-pulse-card"
            title="World pulse"
            action={
              <button type="button" className="text-btn" onClick={() => setPage('logs')}>
                All logs
              </button>
            }
          >
            <div className="pulse-grid">
              <span>
                <small>World GDP</small>
                <strong>{formatMoney(totalWorldGdp(game))}</strong>
              </span>
              <span>
                <small>Population</small>
                <strong>{formatNumber(worldPopulation(game), 1)}M</strong>
              </span>
              <span>
                <small>Avg. approval</small>
                <strong>{formatPercent(worldApproval)}</strong>
              </span>
              <span>
                <small>Military power</small>
                <strong>{formatDecimal(totalPower, 0)}</strong>
              </span>
            </div>
            <div className="pulse-logs">
              {recentLogs.length === 0 ? (
                <EmptyState
                  icon="ScrollText"
                  title="No dispatches yet"
                  body="The world is quiet."
                />
              ) : (
                recentLogs.map((entry) => (
                  <div key={entry.id} className={`pulse-log tone-${entry.tone ?? 'neutral'}`}>
                    <span className="pulse-log-meta">
                      <Badge tone={categoryTone[entry.category]}>{entry.category}</Badge>
                      <span>T{entry.turn}</span>
                    </span>
                    <p>{entry.message}</p>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
        </aside>
      </div>

      <SectionCard className="map-insight-card">
        <div className="insight-grid">
          <div>
            <span className="mini-kicker">Resource map</span>
            <h3>Your resource posture</h3>
            <p className="text-muted">
              Every commodity has a market, every military unit an appetite. Keep the balance
              honest.
            </p>
            <div className="resource-dots">
              {RESOURCE_IDS.map((id) => {
                const def = RESOURCES.find((resource) => resource.id === id)
                const flow = player.resources[id]
                return (
                  <span key={id} style={{ color: `var(${def?.colorVar})` }} title={def?.name}>
                    <Icon name={def?.icon ?? 'Circle'} size={17} />
                    <small>{formatNumber(flow.stock, 0)}</small>
                  </span>
                )
              })}
            </div>
          </div>
          <div className="insight-divider" />
          <div>
            <span className="mini-kicker">Military posture</span>
            <h3>{formatDecimal(militaryPower(player), 0)} power</h3>
            <p className="text-muted">
              Power is a composite of platforms and warheads, not just headcount.
            </p>
            <div className="military-mini">
              {UNITS.map((unit) => (
                <span key={unit.id}>
                  <Icon name={unit.icon} size={14} />
                  {formatNumber(player.military[unit.id], 0)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
