import { memo, useMemo, type CSSProperties, type MouseEvent } from 'react'
import { GOVERNMENT_BY_ID, MAP_HEIGHT } from '../game/constants'
import {
  countryFill,
  countryLabel,
  countryLabelSize,
  polygonPath,
  smoothPolygonPath,
  type MapColorContext,
  type MapColorMode,
  type MapRoute,
} from '../game/mapVisuals'
import { isHostile } from '../game/selectors'
import type { Country, GameState } from '../game/types'

interface WorldMapCanvasProps {
  game: GameState
  colorMode: MapColorMode
  colorContext: MapColorContext
  visibleIds: Set<string>
  routes: MapRoute[]
  hoveredId: string | null
  activeContinentId: string
  showLabels: boolean
  showRoutes: boolean
  narrow: boolean
  onSelectCountry: (country: Country) => void
  onHoverCountry: (country: Country, x: number, y: number) => void
  onHoverEnd: () => void
  onSelectContinent: (continentId: string) => void
}

function countryClass(country: Country, hoveredId: string | null, visibleIds: Set<string>): string {
  return [
    'country-cell',
    `status-${country.status}`,
    country.isPlayer ? 'is-player' : '',
    hoveredId === country.id ? 'is-hovered' : '',
    visibleIds.has(country.id) ? '' : 'is-dimmed',
  ]
    .filter(Boolean)
    .join(' ')
}

export const WorldMapCanvas = memo(function WorldMapCanvas({
  game,
  colorMode,
  colorContext,
  visibleIds,
  routes,
  hoveredId,
  activeContinentId,
  showLabels,
  showRoutes,
  narrow,
  onSelectCountry,
  onHoverCountry,
  onHoverEnd,
  onSelectContinent,
}: WorldMapCanvasProps) {
  const continents = useMemo(
    () =>
      game.continents.map((continent) => ({
        ...continent,
        path: smoothPolygonPath(continent.polygon),
        count: game.countries.filter((country) => country.continentId === continent.id).length,
      })),
    [game.continents, game.countries],
  )
  const shapes = useMemo(
    () =>
      game.countries.map((country) => ({
        country,
        path: polygonPath(country.map.polygon),
        fill: countryFill(country, colorMode, colorContext),
        dimmed: !visibleIds.has(country.id),
      })),
    [game.countries, colorMode, colorContext, visibleIds],
  )

  return (
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
          <line x1="0" y1="0" x2="0" y2="7" stroke="var(--error)" strokeWidth="1.6" opacity="0.5" />
        </pattern>
        <pattern
          id="land-contours"
          width="96"
          height="96"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(-8)"
        >
          <path
            d="M0 26 C 22 13, 52 39, 96 22"
            fill="none"
            stroke="var(--map-border)"
            strokeWidth="0.7"
            opacity="0.45"
          />
          <path
            d="M0 64 C 26 49, 58 80, 96 60"
            fill="none"
            stroke="var(--map-border)"
            strokeWidth="0.7"
            opacity="0.35"
          />
        </pattern>
        <radialGradient id="ocean-glow" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stopColor="var(--map-ocean-light)" />
          <stop offset="100%" stopColor="var(--map-ocean)" />
        </radialGradient>
        <radialGradient id="ocean-vignette" cx="50%" cy="48%" r="72%">
          <stop offset="58%" stopColor="var(--map-ocean)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--map-ocean)" stopOpacity="0.8" />
        </radialGradient>
        <linearGradient id="land-sheen" x1="0" y1="0" x2="0.18" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
          <stop offset="46%" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
        <clipPath id="land-clip">
          {shapes.map(({ country, path }) => (
            <path key={`clip-${country.id}`} d={path} />
          ))}
        </clipPath>
        <filter id="shelf-blur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>

      <rect width="1000" height="560" fill="url(#ocean-glow)" />
      <rect width="1000" height="560" fill="url(#ocean-dots)" />
      <rect width="1000" height="560" fill="url(#ocean-vignette)" pointerEvents="none" />
      {Array.from({ length: 6 }).map((_, index) => (
        <line
          key={`h-${index}`}
          x1="0"
          y1={index * 112}
          x2="1000"
          y2={index * 112}
          className="map-graticule"
        />
      ))}
      {Array.from({ length: 9 }).map((_, index) => (
        <line
          key={`v-${index}`}
          x1={index * 125}
          y1="0"
          x2={index * 125}
          y2="560"
          className="map-graticule"
        />
      ))}

      <g className="map-continents">
        {continents.map((continent) => {
          const muted = activeContinentId !== 'all' && activeContinentId !== continent.id
          return (
            <g
              key={continent.id}
              className={`continent-group ${muted ? 'is-muted' : ''}`}
              style={{ '--continent-tint': continent.color } as CSSProperties}
            >
              <g filter="url(#shelf-blur)" className="continent-shelves">
                <path d={continent.path} className="continent-shelf-outer" />
                <path d={continent.path} className="continent-shelf" />
              </g>
              <path d={continent.path} className="continent-shape" />
              <path d={continent.path} className="continent-coast" />
            </g>
          )
        })}
      </g>

      <g className="map-countries">
        {shapes.map(({ country, path, fill }) => {
          const isMerged = country.status === 'merged'
          const isDestroyed = country.status === 'destroyed'
          return (
            <g
              key={country.id}
              className={countryClass(country, hoveredId, visibleIds)}
              onClick={() => onSelectCountry(country)}
              onMouseEnter={(event: MouseEvent<SVGGElement>) =>
                onHoverCountry(country, event.clientX, event.clientY)
              }
              onMouseMove={(event: MouseEvent<SVGGElement>) =>
                onHoverCountry(country, event.clientX, event.clientY)
              }
              onMouseLeave={onHoverEnd}
              onFocus={onHoverEnd}
              onBlur={onHoverEnd}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectCountry(country)
                }
              }}
              tabIndex={0}
              role="button"
              aria-label={`${country.name}, ${
                GOVERNMENT_BY_ID[country.government]?.name ?? 'state'
              }, ${country.status}. Open dossier.`}
            >
              <path d={path} className="country-territory" style={{ fill }} />
              {isMerged && (
                <path d={path} className="territory-overlay" fill="url(#merged-hatch)" />
              )}
              {isDestroyed && (
                <path d={path} className="territory-overlay" fill="url(#destroyed-hatch)" />
              )}
            </g>
          )
        })}
      </g>

      <rect
        width="1000"
        height="560"
        className="map-land-texture"
        fill="url(#land-contours)"
        clipPath="url(#land-clip)"
      />
      <rect
        width="1000"
        height="560"
        className="map-land-light"
        fill="url(#land-sheen)"
        clipPath="url(#land-clip)"
      />

      {showRoutes && (
        <g className="map-routes" aria-hidden="true">
          {routes.map((route) => {
            const routeIds = route.countryIds ?? [route.countryId]
            const dimmed = routeIds.every((id) => !visibleIds.has(id))
            const focused = hoveredId !== null && routeIds.includes(hoveredId)
            return (
              <g
                key={route.id}
                className={`map-route route-${route.kind} ${
                  dimmed ? 'is-dimmed' : ''
                } ${focused ? 'is-focused' : ''}`}
              >
                <path d={route.d} className="route-halo" />
                <path d={route.d} className="route-line" />
                <circle
                  r={route.kind === 'world' ? 2 : 2.6}
                  className="route-pulse"
                  style={{
                    offsetPath: `path("${route.d}")`,
                    animationDuration: `${route.duration}s`,
                    animationDelay: `${route.delay}s`,
                  }}
                />
                {route.kind === 'mixed' && (
                  <circle
                    r="2.6"
                    className="route-pulse route-pulse-reverse"
                    style={{
                      offsetPath: `path("${route.d}")`,
                      animationDuration: `${route.duration}s`,
                      animationDelay: `${route.delay - route.duration / 2}s`,
                    }}
                  />
                )}
              </g>
            )
          })}
        </g>
      )}

      <g className="map-label-layer">
        {showLabels &&
          shapes.map(({ country, dimmed }) => {
            const marker = country.status === 'alive' && !country.isPlayer
            const markerAllied = country.relations >= 100
            return (
              <g
                key={`label-${country.id}`}
                className={`country-label-group ${dimmed ? 'is-dimmed' : ''} ${
                  country.isPlayer ? 'is-player' : ''
                } ${hoveredId === country.id ? 'is-hovered' : ''}`}
                aria-hidden="true"
              >
                <text
                  x={country.map.centroid[0]}
                  y={country.map.centroid[1] - (country.isPlayer ? 3 : 0)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="country-label"
                  style={{ fontSize: narrow ? 9 : countryLabelSize(country) }}
                >
                  {countryLabel(country, narrow)}
                </text>
                {country.isPlayer && (
                  <text
                    x={country.map.centroid[0]}
                    y={country.map.centroid[1] + 11}
                    textAnchor="middle"
                    className="country-player-label"
                  >
                    YOUR NATION
                  </text>
                )}
                {marker && (markerAllied || isHostile(country, game.settings)) && (
                  <circle
                    cx={country.map.centroid[0]}
                    cy={country.map.centroid[1] - 18}
                    r="3"
                    className={`map-marker ${markerAllied ? 'allied-marker' : 'hostile-marker'}`}
                  />
                )}
              </g>
            )
          })}

        {continents.map((continent) => {
          const muted = activeContinentId !== 'all' && activeContinentId !== continent.id
          const active = activeContinentId === continent.id
          return (
            <g
              key={`continent-label-${continent.id}`}
              className={`continent-label-group ${muted ? 'is-muted' : ''} ${
                active ? 'is-active' : ''
              }`}
              style={{ '--continent-tint': continent.color } as CSSProperties}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              aria-label={`Filter the map to ${continent.name}`}
              onClick={() => onSelectContinent(continent.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  onSelectContinent(continent.id)
                }
              }}
            >
              <title>{`${continent.name} · ${continent.count} ${
                continent.count === 1 ? 'state' : 'states'
              }`}</title>
              <line
                x1={continent.label[0] - 18}
                y1={continent.label[1] - 11}
                x2={continent.label[0] + 18}
                y2={continent.label[1] - 11}
                className="continent-label-rule"
              />
              <text
                x={continent.label[0]}
                y={continent.label[1]}
                className="continent-label"
                textAnchor="middle"
              >
                {continent.name}
              </text>
              {continent.label[1] < MAP_HEIGHT - 26 && (
                <text
                  x={continent.label[0]}
                  y={continent.label[1] + 12}
                  className="continent-label-count"
                  textAnchor="middle"
                >
                  {continent.count} {continent.count === 1 ? 'state' : 'states'}
                </text>
              )}
            </g>
          )
        })}
      </g>

      <g className="map-compass" transform="translate(944 500)" aria-hidden="true">
        <circle r="25" />
        <circle r="17" className="map-compass-inner" />
        <path d="M0-19 L5-4 L0 0 L-5-4 Z" />
        <path d="M0 19 L4 7 L0 10 L-4 7 Z" className="map-compass-south" />
        <text y="31" textAnchor="middle">
          N
        </text>
      </g>
      <text x="28" y="536" className="map-ocean-caption">
        COUNTRY STRIKE · WORLD SURVEY
      </text>
    </svg>
  )
})
