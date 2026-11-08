import { useMemo, useState, type MouseEvent } from 'react'
import { GOVERNMENT_BY_ID, RESOURCE_IDS, RESOURCES, TRAIT_BY_ID, UNITS } from '../game/constants'
import type { Country, LogCategory } from '../game/types'
import { selectPlayer, useGame } from '../state/gameStore'
import { averageWorldApproval, totalWorldGdp, worldPopulation } from '../game/engine'
import { computeComposites, isHostile, militaryPower, relationLabel } from '../game/selectors'
import {
  formatDecimal,
  formatMoney,
  formatNumber,
  formatUsd,
  formatPercent,
  truncate,
} from '../game/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Flag } from '../components/Flag'
import { Icon } from '../components/Icon'
import { Badge, EmptyState, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'

const polygonPath = (points: [number, number][]): string =>
  `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ')} Z`

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

function HoverCard({ country, x, y }: { country: Country; x: number; y: number }) {
  const government = GOVERNMENT_BY_ID[country.government]
  const left = Math.max(12, Math.min(x + 16, window.innerWidth - 244))
  const top = Math.max(12, Math.min(y + 16, window.innerHeight - 174))
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

  if (!game || !player) return null

  const averageRelations =
    rivalCountries.length > 0
      ? rivalCountries.reduce((total, country) => total + country.relations, 0) /
        rivalCountries.length
      : 100
  const totalPower = game.countries
    .filter((country) => country.status === 'alive')
    .reduce((total, country) => total + militaryPower(country), 0)
  const worldApproval = averageWorldApproval(game)

  const handleCountryClick = (country: Country) => {
    openCountry(country.id)
  }

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
          subtitle="Territory, biome and alignment. Select a country to open its dossier."
          action={
            <div className="map-card-actions">
              <Badge tone="accent" icon="Globe">
                {game.countries.filter((country) => country.status === 'alive').length} sovereign
                states
              </Badge>
              <span className="map-legend-inline">
                <span className="legend-dot player-dot" /> You
              </span>
            </div>
          }
        >
          <div className="map-frame">
            <svg
              viewBox="0 0 1000 560"
              className="world-map"
              preserveAspectRatio="xMidYMid meet"
              role="group"
              aria-label="World map"
            >
              <defs>
                <pattern id="ocean-dots" width="18" height="18" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="var(--map-dot)" />
                </pattern>
                <pattern
                  id="merged-hatch"
                  width="8"
                  height="8"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(35)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="8"
                    stroke="var(--accent-2)"
                    strokeWidth="2.2"
                    opacity="0.7"
                  />
                </pattern>
                <pattern
                  id="destroyed-hatch"
                  width="7"
                  height="7"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(-35)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="7"
                    stroke="var(--error)"
                    strokeWidth="1.6"
                    opacity="0.5"
                  />
                </pattern>
                <radialGradient id="ocean-glow" cx="50%" cy="45%" r="70%">
                  <stop offset="0%" stopColor="var(--map-ocean-light)" />
                  <stop offset="100%" stopColor="var(--map-ocean)" />
                </radialGradient>
              </defs>
              <rect width="1000" height="560" fill="url(#ocean-glow)" />
              <rect width="1000" height="560" fill="url(#ocean-dots)" />
              {Array.from({ length: 7 }).map((_, index) => (
                <line
                  key={`h-${index}`}
                  x1="0"
                  y1={index * 94}
                  x2="1000"
                  y2={index * 94}
                  className="map-graticule"
                />
              ))}
              {Array.from({ length: 11 }).map((_, index) => (
                <line
                  key={`v-${index}`}
                  x1={index * 100}
                  y1="0"
                  x2={index * 100}
                  y2="560"
                  className="map-graticule"
                />
              ))}

              {continents.map((continent) => (
                <g key={continent.id} className="continent-group">
                  <path d={polygonPath(continent.polygon)} className="continent-shape" />
                  <path d={polygonPath(continent.polygon)} className="continent-coast" />
                  <text
                    x={continent.label[0]}
                    y={continent.label[1]}
                    className="continent-label"
                    textAnchor="middle"
                  >
                    {continent.name}
                  </text>
                </g>
              ))}

              {game.countries.map((country) => {
                const isPlayer = country.isPlayer
                const isMerged = country.status === 'merged'
                const isDestroyed = country.status === 'destroyed'
                const label = isNarrow ? country.code : truncate(country.name, 13)
                return (
                  <g
                    key={country.id}
                    className={`country-cell status-${country.status} ${isPlayer ? 'is-player' : ''} ${hover?.country.id === country.id ? 'is-hovered' : ''}`}
                    onClick={() => handleCountryClick(country)}
                    onMouseEnter={(event: MouseEvent<SVGGElement>) => {
                      setHover({ country, x: event.clientX, y: event.clientY })
                    }}
                    onMouseMove={(event: MouseEvent<SVGGElement>) => {
                      setHover({ country, x: event.clientX, y: event.clientY })
                    }}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(null)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        handleCountryClick(country)
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`${country.name}, ${GOVERNMENT_BY_ID[country.government]?.name}. Open dossier.`}
                  >
                    <path
                      d={polygonPath(country.map.polygon)}
                      className="country-territory"
                      style={{ fill: country.map.color }}
                    />
                    {isMerged && (
                      <path
                        d={polygonPath(country.map.polygon)}
                        className="territory-overlay"
                        fill="url(#merged-hatch)"
                      />
                    )}
                    {isDestroyed && (
                      <path
                        d={polygonPath(country.map.polygon)}
                        className="territory-overlay"
                        fill="url(#destroyed-hatch)"
                      />
                    )}
                    <text
                      x={country.map.centroid[0]}
                      y={country.map.centroid[1] - (isPlayer ? 3 : 0)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="country-label"
                    >
                      {label}
                    </text>
                    {isPlayer && (
                      <text
                        x={country.map.centroid[0]}
                        y={country.map.centroid[1] + 11}
                        textAnchor="middle"
                        className="country-player-label"
                      >
                        YOUR NATION
                      </text>
                    )}
                    {country.status === 'alive' &&
                      !country.isPlayer &&
                      (country.relations >= 100 || isHostile(country, game.settings)) && (
                        <circle
                          cx={country.map.centroid[0]}
                          cy={country.map.centroid[1] - 18}
                          r="3"
                          className={
                            country.relations >= 100
                              ? 'map-marker allied-marker'
                              : 'map-marker hostile-marker'
                          }
                        />
                      )}
                  </g>
                )
              })}

              {continents.map((continent) => (
                <text
                  key={`label-${continent.id}`}
                  x={continent.label[0]}
                  y={continent.label[1]}
                  className="continent-label"
                  textAnchor="middle"
                >
                  {continent.name}
                </text>
              ))}

              <g className="map-compass" transform="translate(944 500)">
                <circle r="25" />
                <path d="M0-19 L5-4 L0 0 L-5-4 Z" />
                <text y="17" textAnchor="middle">
                  N
                </text>
              </g>
              <text x="28" y="536" className="map-ocean-caption">
                COUNTRY STRIKE · WORLD SURVEY
              </text>
            </svg>
            {hover && <HoverCard country={hover.country} x={hover.x} y={hover.y} />}
          </div>
          <div className="map-legend">
            <span>
              <span className="legend-dot player-dot" /> Player nation
            </span>
            <span>
              <span className="legend-swatch merged-swatch" /> Integrated territory
            </span>
            <span>
              <span className="legend-swatch destroyed-swatch" /> Destroyed state
            </span>
            <span>
              <span className="map-marker allied-marker" /> Full alignment
            </span>
            <span>
              <span className="map-marker hostile-marker" /> Hostile
            </span>
            <span className="map-legend-hint">Select any country for the dossier</span>
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
