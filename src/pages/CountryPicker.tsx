import { useMemo, useState } from 'react'
import {
  GOVERNMENT_BY_ID,
  RESOURCES,
  RESOURCE_IDS,
  TRAIT_BY_ID,
  DIFFICULTIES,
} from '../game/constants'
import type { Country } from '../game/types'
import { useGame } from '../state/gameStore'
import { buildMapColorContext, type MapColorMode } from '../game/mapVisuals'
import {
  computeComposites,
  militaryPower,
  resourceFlows,
  resourceValuation,
} from '../game/selectors'
import { formatDecimal, formatMoney, formatNumber, formatPercent } from '../game/format'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { Flag } from '../components/Flag'
import { Icon } from '../components/Icon'
import { WorldMapCanvas } from '../components/WorldMapCanvas'
import { playSfx } from '../game/audio'

const COLOR_MODE: MapColorMode = 'terrain'

function countryTraits(country: Country): { id: string; name: string; effect: string }[] {
  return [country.culture, country.biome, country.weather, ...country.traits]
    .map((id) => TRAIT_BY_ID[id])
    .filter((trait): trait is NonNullable<typeof trait> => Boolean(trait))
    .map((trait) => ({ id: trait.id, name: trait.name, effect: trait.effectText }))
}

export function CountryPicker() {
  const game = useGame((state) => state.game)
  const chooseCountry = useGame((state) => state.chooseCountry)
  const startGame = useGame((state) => state.startGame)
  const abandonGame = useGame((state) => state.abandonGame)
  const [selectedId, setSelectedId] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [continentId, setContinentId] = useState('all')
  const [query, setQuery] = useState('')
  const isNarrow = useMediaQuery('(max-width: 900px)')

  const countries = useMemo(() => game?.countries ?? [], [game])
  const countryList = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return countries
      .filter((country) => country.status === 'alive')
      .filter((country) => continentId === 'all' || country.continentId === continentId)
      .filter((country) => {
        if (!needle) return true
        return (
          country.name.toLowerCase().includes(needle) ||
          country.capital.toLowerCase().includes(needle) ||
          country.code.toLowerCase().includes(needle)
        )
      })
      .sort((a, b) => b.stats.gdp - a.stats.gdp)
  }, [countries, continentId, query])

  const recommendedId = useMemo(() => {
    const sorted = [...countries].sort((a, b) => a.stats.gdp - b.stats.gdp)
    return sorted[Math.floor(sorted.length / 2)]?.id ?? ''
  }, [countries])

  const composites = useMemo(() => computeComposites(countries), [countries])
  const ranked = useMemo(
    () =>
      [...countries]
        .filter((country) => country.status === 'alive')
        .sort((a, b) => (composites.get(b.id)?.score ?? 0) - (composites.get(a.id)?.score ?? 0)),
    [countries, composites],
  )

  if (!game) return null

  const selected = countries.find((country) => country.id === selectedId) ?? null
  const visibleIds = new Set(countries.map((country) => country.id))
  const colorContext = buildMapColorContext(countries, game.settings)
  const selectedFlows = selected ? resourceFlows(selected, game.deals, game.prices) : null
  const valuation = selectedFlows ? resourceValuation(selectedFlows) : null
  const topResources = selected
    ? RESOURCE_IDS.map((id) => ({
        definition: RESOURCES.find((resource) => resource.id === id)!,
        value: selected.resources[id].reserves * game.prices[id],
      }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3)
    : []
  const shareOfGdp =
    selected && valuation ? (valuation.productionValue / Math.max(1, selected.stats.gdp)) * 100 : 0
  const rank = selected ? ranked.findIndex((country) => country.id === selected.id) + 1 : 0
  const difficulty = DIFFICULTIES.find((entry) => entry.id === game.settings.difficulty)

  const select = (countryId: string) => {
    playSfx('click')
    setSelectedId(countryId)
  }

  const begin = (countryId: string) => {
    playSfx('turn')
    chooseCountry(countryId)
  }

  return (
    <div className="picker-shell">
      <header className="picker-head">
        <div>
          <div className="picker-eyebrow">
            <span className="eyebrow-line" />
            World generated · choose your nation
          </div>
          <h1>Who takes office?</h1>
          <p>
            Every state was drawn with its own economy, resources and politics. Pick the country you
            want to lead. The rest become your rivals.
          </p>
        </div>
        <div className="picker-head-actions">
          <button
            type="button"
            className="btn"
            onClick={() => {
              playSfx('click')
              startGame(game.settings)
            }}
          >
            <Icon name="RotateCcw" size={16} /> Redraw world
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              playSfx('click')
              abandonGame()
            }}
          >
            Back to setup
          </button>
        </div>
      </header>

      <div className="picker-badges">
        <span>
          <Icon name="Globe" size={14} /> {game.countries.length} nations · {game.continents.length}{' '}
          continents
        </span>
        <span>
          <Icon name="Flame" size={14} /> {difficulty?.name ?? game.settings.difficulty}
        </span>
        <span>
          <Icon name="Coins" size={14} /> Resource prices{' '}
          {Math.round(game.settings.resourcePrices * 100)}%
        </span>
        <span>
          <Icon name="Gem" size={14} /> Scarcity {game.settings.resourceScarcity.toFixed(1)}×
        </span>
      </div>

      <div className="picker-layout">
        <div className="picker-map-card">
          <div className="map-frame">
            <WorldMapCanvas
              game={game}
              colorMode={COLOR_MODE}
              colorContext={colorContext}
              visibleIds={visibleIds}
              routes={[]}
              hoveredId={hoveredId ?? selectedId}
              activeContinentId={continentId}
              showLabels
              showRoutes={false}
              narrow={isNarrow}
              onSelectCountry={(country) => select(country.id)}
              onHoverCountry={(country) => setHoveredId(country.id)}
              onHoverEnd={() => setHoveredId(null)}
              onSelectContinent={(id) => setContinentId((current) => (current === id ? 'all' : id))}
            />
          </div>
          <div className="picker-map-foot">
            <span>Click a territory to inspect it.</span>
            <div className="picker-continent-strip">
              <button
                type="button"
                className={continentId === 'all' ? 'is-active' : ''}
                onClick={() => setContinentId('all')}
              >
                All
              </button>
              {game.continents.map((continent) => (
                <button
                  key={continent.id}
                  type="button"
                  className={continentId === continent.id ? 'is-active' : ''}
                  onClick={() =>
                    setContinentId((current) => (current === continent.id ? 'all' : continent.id))
                  }
                >
                  {continent.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <aside className="picker-detail card">
          {!selected ? (
            <div className="picker-detail-empty">
              <span className="picker-detail-mark">
                <Icon name="MapPin" size={26} />
              </span>
              <h2>Select a nation</h2>
              <p>
                Compare GDP, resource wealth, debt and military power before you commit. Your pick
                starts with a modest treasury and a defensive garrison.
              </p>
            </div>
          ) : (
            <>
              <div className="picker-detail-head">
                <Flag seed={selected.flagSeed} code={selected.code} size="lg" />
                <div>
                  <span className="picker-detail-kicker">
                    {selected.id === recommendedId ? 'Recommended start' : `Rank #${rank}`}
                  </span>
                  <h2>{selected.name}</h2>
                  <p>
                    {GOVERNMENT_BY_ID[selected.government]?.name} · capital {selected.capital}
                  </p>
                </div>
              </div>

              <div className="picker-stat-grid">
                <span>
                  <small>GDP</small>
                  <strong>{formatMoney(selected.stats.gdp)}</strong>
                </span>
                <span>
                  <small>Population</small>
                  <strong>{formatDecimal(selected.stats.population, 1)}M</strong>
                </span>
                <span>
                  <small>Treasury</small>
                  <strong>{formatMoney(selected.stats.treasury)}</strong>
                </span>
                <span>
                  <small>Debt</small>
                  <strong>{formatMoney(selected.stats.debt)}</strong>
                </span>
                <span>
                  <small>Military</small>
                  <strong>{formatNumber(militaryPower(selected))}</strong>
                </span>
                <span>
                  <small>Approval</small>
                  <strong>{Math.round(selected.stats.approval)}%</strong>
                </span>
              </div>

              <div className="picker-resource-block">
                <div className="picker-resource-head">
                  <span>Resource wealth</span>
                  <strong>{formatMoney(valuation?.reserveValue ?? 0)}</strong>
                </div>
                <div className="picker-resource-bars">
                  <div>
                    <span>Production value</span>
                    <strong>{formatMoney(valuation?.productionValue ?? 0)}/turn</strong>
                  </div>
                  <div>
                    <span>Production vs GDP</span>
                    <strong>{formatPercent(shareOfGdp, 1)}</strong>
                  </div>
                  <div>
                    <span>Stockpile value</span>
                    <strong>{formatMoney(valuation?.stockValue ?? 0)}</strong>
                  </div>
                </div>
                <div className="picker-top-resources">
                  {topResources.map(({ definition, value }) => (
                    <span key={definition.id}>
                      <span style={{ color: `var(${definition.colorVar})` }}>
                        <Icon name={definition.icon} size={13} />
                      </span>
                      {definition.name}
                      <small>{formatMoney(value)}</small>
                    </span>
                  ))}
                </div>
              </div>

              <div className="picker-traits">
                {countryTraits(selected).map((trait) => (
                  <span key={trait.id} title={trait.effect}>
                    {trait.name}
                  </span>
                ))}
              </div>

              <button
                type="button"
                className="btn btn-primary picker-start"
                onClick={() => begin(selected.id)}
              >
                Lead {selected.name} <Icon name="ArrowRight" size={17} />
              </button>
            </>
          )}
        </aside>
      </div>

      <div className="picker-list-head">
        <div>
          <h2>Nations of the world</h2>
          <p>Sorted by economic size. The highlighted card is the median-sized start.</p>
        </div>
        <label className="search-field">
          <Icon name="Search" size={15} />
          <input
            className="input input-small"
            placeholder="Country, capital or code"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Filter countries"
          />
        </label>
      </div>

      <div className="picker-country-grid">
        {countryList.map((country) => (
          <button
            key={country.id}
            type="button"
            className={`picker-country-card ${
              selectedId === country.id ? 'is-selected' : ''
            } ${country.id === recommendedId ? 'is-recommended' : ''}`}
            onClick={() => select(country.id)}
            onDoubleClick={() => begin(country.id)}
            aria-pressed={selectedId === country.id}
          >
            <span className="picker-card-head">
              <Flag seed={country.flagSeed} code={country.code} size="sm" />
              <span>
                <strong>{country.name}</strong>
                <small>
                  {country.code} · {GOVERNMENT_BY_ID[country.government]?.name}
                </small>
              </span>
              {country.id === recommendedId && (
                <span className="picker-recommended-dot" title="Recommended start" />
              )}
            </span>
            <span className="picker-card-stats">
              <span>
                GDP <strong>{formatMoney(country.stats.gdp)}</strong>
              </span>
              <span>
                Pop <strong>{formatDecimal(country.stats.population, 1)}M</strong>
              </span>
              <span>
                Debt <strong>{formatMoney(country.stats.debt)}</strong>
              </span>
            </span>
            <span className="picker-card-traits">
              {countryTraits(country)
                .slice(0, 3)
                .map((trait) => (
                  <span key={trait.id}>{trait.name}</span>
                ))}
            </span>
          </button>
        ))}
      </div>
      {countryList.length === 0 && (
        <div className="picker-empty">
          <Icon name="Search" size={18} /> No nation matches that filter.
        </div>
      )}
    </div>
  )
}
