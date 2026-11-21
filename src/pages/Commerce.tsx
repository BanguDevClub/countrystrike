import { useEffect, useMemo, useState } from 'react'
import { COMMERCE_CATEGORIES, COMMERCE_GOODS, COMMERCE_GOOD_IDS } from '../game/constants'
import type { CommerceCategory, CommerceGoodId, Country } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import {
  computeBudget,
  computeCommerce,
  currencyGap,
  currencyStrength,
  gdpGrowthDrivers,
  inflationTarget,
  resourceFlows,
} from '../game/selectors'
import {
  formatDecimal,
  formatMoney,
  formatNumber,
  formatPercent,
  formatQuantity,
  formatSignedMoney,
  formatSignedNumber,
  formatSignedPercent,
} from '../game/format'
import { Badge, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'
import { Flag } from '../components/Flag'

type CommerceFilter = CommerceCategory | 'all'

const policyFrom = (country: Country): Record<CommerceGoodId, number> =>
  COMMERCE_GOOD_IDS.reduce(
    (policy, id) => {
      policy[id] = country.commercePolicy?.[id] ?? 0
      return policy
    },
    {} as Record<CommerceGoodId, number>,
  )

const formatLocalMoney = (value: number, symbol: string): string =>
  `${symbol}${value.toLocaleString('en-US', {
    maximumFractionDigits: Math.abs(value) < 10 ? 2 : 0,
  })}`

const categoryLabel = (id: CommerceCategory): string =>
  COMMERCE_CATEGORIES.find((category) => category.id === id)?.label ?? id

const policyLabel = (value: number): string => {
  if (value > 0) return `Tax ${value}%`
  if (value < 0) return `Subsidy ${Math.abs(value)}%`
  return 'No levy'
}

const balanceLabel = (coverage: number): string => {
  if (coverage > 1.03) return `Surplus ${formatPercent((coverage - 1) * 100)}`
  if (coverage < 0.97) return `Deficit ${formatPercent((1 - coverage) * 100)}`
  return 'Balanced'
}

export function Commerce() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const setCommercePolicy = useGame((state) => state.setCommercePolicy)
  const setPage = useGame((state) => state.setPage)
  const [filter, setFilter] = useState<CommerceFilter>('all')
  const [compareId, setCompareId] = useState('')
  const [draft, setDraft] = useState<Record<CommerceGoodId, number>>(() =>
    player ? policyFrom(player) : ({} as Record<CommerceGoodId, number>),
  )

  useEffect(() => {
    if (player) setDraft(policyFrom(player))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resync only when the player changes
  }, [player?.id])

  const flows = useMemo(
    () => (game && player ? resourceFlows(player, game.deals, game.prices) : null),
    [game, player],
  )
  const budget = useMemo(
    () => (game && player ? computeBudget(player, game.deals, game.prices) : null),
    [game, player],
  )
  const commerce = useMemo(
    () => (player && flows ? computeCommerce(player, flows) : null),
    [player, flows],
  )
  const draftCommerce = useMemo(
    () => (player && flows ? computeCommerce(player, flows, draft) : null),
    [player, flows, draft],
  )

  if (!game || !player || !flows || !budget || !commerce || !draftCommerce) return null

  const currency = player.currency
  const liveCountries = game.countries.filter((country) => country.status === 'alive')
  const worldInflation =
    liveCountries.reduce((total, country) => total + country.stats.inflation, 0) /
    Math.max(1, liveCountries.length)
  const expectedInflation = inflationTarget(player, commerce, budget)
  const exportValue = budget.revenue.find((line) => line.key === 'exports')?.amount ?? 0
  const importValue = budget.expenses.find((line) => line.key === 'imports')?.amount ?? 0
  const tradeBalance = exportValue - importValue + commerce.exportRevenue - commerce.importCost
  const misalignment = currency.fairRate > 0 ? (currency.rate / currency.fairRate - 1) * 100 : 0
  const visibleGoods =
    filter === 'all' ? COMMERCE_GOODS : COMMERCE_GOODS.filter((good) => good.category === filter)
  const drivers = gdpGrowthDrivers(player, flows, budget, commerce).filter((driver) =>
    ['commerce', 'costOfLiving', 'inflation'].includes(driver.key),
  )
  const parityRows = [...liveCountries].sort(
    (a, b) => currencyStrength(b) - currencyStrength(a) || a.name.localeCompare(b.name),
  )
  const compareCountry =
    liveCountries.find((country) => country.id === compareId && !country.isPlayer) ??
    liveCountries.find((country) => !country.isPlayer) ??
    player
  const crossRate =
    player.currency.rate > 0 ? compareCountry.currency.rate / player.currency.rate : 0
  const reverseCross =
    compareCountry.currency.rate > 0 ? player.currency.rate / compareCountry.currency.rate : 0
  const inflationDiff = player.stats.inflation - compareCountry.stats.inflation
  const playerGap = currencyGap(player)
  const compareGap = currencyGap(compareCountry)
  const gapDiff = playerGap - compareGap
  const playerCurrencyStrength = currencyStrength(player)
  const compareCurrencyStrength = currencyStrength(compareCountry)
  const strengthDiff = playerCurrencyStrength - compareCurrencyStrength

  return (
    <div className="page">
      <PageHeader page="commerce">
        <button type="button" className="btn" onClick={() => setPage('budget')}>
          <Icon name="ChartLine" size={16} /> Budget
        </button>
        <button type="button" className="btn" onClick={() => setPage('methodology')}>
          <Icon name="Sigma" size={16} /> Methodology
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Consumer basket"
          value={formatDecimal(commerce.basketIndex, 1)}
          hint={`100 = base prices · ${formatMoney(commerce.householdCost)} per 1M citizens`}
          icon="ShoppingBasket"
          tone={
            commerce.basketIndex > 120
              ? 'negative'
              : commerce.basketIndex > 105
                ? 'warning'
                : 'positive'
          }
        />
        <StatTile
          label="Inflation"
          value={`${formatDecimal(player.stats.inflation, 1)}%`}
          hint={`Settling toward ${formatDecimal(expectedInflation, 1)}%`}
          icon="TrendingUp"
          tone={
            player.stats.inflation > 12
              ? 'negative'
              : player.stats.inflation > 6
                ? 'warning'
                : 'positive'
          }
        />
        <StatTile
          label="Currency parity"
          value={`${formatNumber(currency.rate, currency.rate < 1 ? 3 : 2)} ${currency.code}`}
          hint={`1 credit · fair ${formatNumber(currency.fairRate, 2)} · ${formatSignedPercent(misalignment)} vs PPP`}
          icon="Coins"
          tone={Math.abs(misalignment) > 12 ? 'warning' : 'accent'}
        />
        <StatTile
          label="Commerce fiscal"
          value={formatSignedMoney(commerce.fiscalNet)}
          hint={`Levies ${formatMoney(commerce.taxRevenue)} · subsidies ${formatMoney(commerce.subsidyCost)}`}
          icon="Banknote"
          tone={commerce.fiscalNet >= 0 ? 'positive' : 'negative'}
        />
      </div>

      <div className="commerce-top-grid">
        <SectionCard
          title="Currency & parity"
          subtitle="Household prices are quoted in local currency. The market rate mean-reverts toward a purchasing-power-parity fair value."
          action={<Badge tone="accent">{currency.regime}</Badge>}
        >
          <div className="commerce-currency-hero">
            <div>
              <span className="mini-kicker">{currency.name}</span>
              <strong>
                {formatNumber(currency.rate, currency.rate < 1 ? 3 : 2)} {currency.code}
              </strong>
              <small>local units per 1 credit</small>
            </div>
            <Badge tone={currency.changePct >= 0 ? 'negative' : 'positive'} icon="TrendingUp">
              {formatSignedPercent(currency.changePct)} last turn
            </Badge>
          </div>
          <div className="commerce-currency-grid">
            <span>
              <small>Fair parity</small>
              <strong>{formatNumber(currency.fairRate, 3)}</strong>
              <small>PPP anchor</small>
            </span>
            <span>
              <small>Inflation</small>
              <strong>{formatDecimal(player.stats.inflation, 1)}%</strong>
              <small>target {formatDecimal(expectedInflation, 1)}%</small>
            </span>
            <span>
              <small>World inflation</small>
              <strong>{formatDecimal(worldInflation, 1)}%</strong>
              <small>{liveCountries.length} economies</small>
            </span>
            <span>
              <small>Trade balance</small>
              <strong className={tradeBalance >= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedMoney(tradeBalance)}
              </strong>
              <small>exports − imports</small>
            </span>
          </div>
          <p className="formula-note">
            Inflation above the world average depreciates the currency. Trade surpluses, approval
            and low debt support it. Pegged regimes move slowly; floating regimes absorb shocks
            faster.
          </p>
        </SectionCard>

        <SectionCard
          title="Basket & transmission"
          subtitle="Commerce feeds growth, approval, depression, HDI and inequality through the same snapshot used by the turn engine."
          action={
            <Badge tone={commerce.shortageShare > 0.25 ? 'negative' : 'positive'}>
              {formatPercent(commerce.shortageShare * 100)} unmet
            </Badge>
          }
        >
          <div className="commerce-bars">
            <ProgressBar
              value={commerce.availability * 100}
              tone={
                commerce.availability > 0.9
                  ? 'positive'
                  : commerce.availability > 0.75
                    ? 'warning'
                    : 'negative'
              }
              label="All household demand met"
              valueLabel={formatPercent(commerce.availability * 100)}
            />
            <ProgressBar
              value={commerce.essentialsAvailability * 100}
              tone={
                commerce.essentialsAvailability > 0.9
                  ? 'positive'
                  : commerce.essentialsAvailability > 0.75
                    ? 'warning'
                    : 'negative'
              }
              label="Essentials met"
              valueLabel={formatPercent(commerce.essentialsAvailability * 100)}
            />
            <ProgressBar
              value={Math.min(100, commerce.affordability * 40)}
              tone={
                commerce.affordability > 1.2
                  ? 'positive'
                  : commerce.affordability > 0.85
                    ? 'warning'
                    : 'negative'
              }
              label="Household affordability"
              valueLabel={`${formatDecimal(commerce.affordability, 2)}×`}
            />
          </div>
          <div className="commerce-transmission">
            {drivers.map((driver) => (
              <div key={driver.key}>
                <span>{driver.label}</span>
                <strong className={driver.value >= 0 ? 'text-positive' : 'text-negative'}>
                  {formatSignedPercent(driver.value * 100, 2)} GDP
                </strong>
              </div>
            ))}
            <div>
              <span>Approval pressure</span>
              <strong className={commerce.approvalDelta >= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedNumber(commerce.approvalDelta, 2)} / turn
              </strong>
            </div>
            <div>
              <span>Depression pressure</span>
              <strong className={commerce.depressionDelta > 1 ? 'text-negative' : 'text-muted'}>
                +{formatDecimal(commerce.depressionDelta, 1)} target
              </strong>
            </div>
            <div>
              <span>HDI target shift</span>
              <strong className={commerce.hdiDelta >= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedNumber(commerce.hdiDelta, 3)}
              </strong>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Citizen checkout"
        subtitle="Supply is the domestic input left after trade. Missing household goods are imported at a premium and paid by households; domestic surpluses are exported. Taxing raises the shelf price, subsidising lowers it."
        action={
          <Badge tone="accent" icon="Dices">
            {game.actionsLeft} actions left
          </Badge>
        }
      >
        <div className="commerce-filters">
          <div className="segmented segmented-small" role="group" aria-label="Commerce category">
            <button
              type="button"
              className={filter === 'all' ? 'is-active' : ''}
              onClick={() => setFilter('all')}
              aria-pressed={filter === 'all'}
            >
              All
            </button>
            {COMMERCE_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                className={filter === category.id ? 'is-active' : ''}
                onClick={() => setFilter(category.id)}
                aria-pressed={filter === category.id}
              >
                {category.label}
              </button>
            ))}
          </div>
          <span className="commerce-filters-note">
            Prices per good use local currency; policy changes cost one action.
          </span>
        </div>

        <div className="commerce-grid">
          {visibleGoods.map((definition) => {
            const snapshot = draftCommerce.goods[definition.id]
            const value = draft[definition.id] ?? 0
            const changed = value !== (player.commercePolicy[definition.id] ?? 0)
            const percent = ((value + 60) / 180) * 100
            const coverageTone =
              snapshot.coverage >= 0.97
                ? 'positive'
                : snapshot.coverage >= 0.8
                  ? 'warning'
                  : 'negative'
            return (
              <div key={definition.id} className={`commerce-card ${changed ? 'is-changed' : ''}`}>
                <div className="commerce-card-head">
                  <span className="commerce-icon">
                    <Icon name={definition.icon} size={18} />
                  </span>
                  <div>
                    <h3>{definition.name}</h3>
                    <span>
                      {categoryLabel(definition.category)} · per {definition.unit}
                    </span>
                  </div>
                  <Badge tone={coverageTone}>{balanceLabel(snapshot.coverage)}</Badge>
                </div>

                <div className="commerce-price-row">
                  <span>Checkout price</span>
                  <strong>{formatLocalMoney(snapshot.localPrice, currency.symbol)}</strong>
                  <small>
                    {formatMoney(snapshot.price)} / {definition.unit} after policy ·{' '}
                    {formatMoney(snapshot.marketPrice)} market
                  </small>
                </div>

                <ProgressBar
                  value={Math.min(100, snapshot.coverage * 100)}
                  tone={coverageTone}
                  thin
                  label={`Coverage · domestic ${formatPercent(snapshot.domesticCoverage * 100)}`}
                  valueLabel={formatPercent(snapshot.coverage * 100)}
                />
                <div className="commerce-balance-row">
                  <span>
                    Domestic <strong>{formatQuantity(snapshot.domesticSupply)}</strong>
                  </span>
                  <span>
                    Imports <strong>{formatQuantity(snapshot.imported)}</strong>
                  </span>
                  <span>
                    Demand <strong>{formatQuantity(snapshot.effectiveDemand)}</strong>
                  </span>
                </div>
                <div className="commerce-trade-line">
                  <span>
                    Import bill <strong>{formatMoney(snapshot.importCost)}</strong>
                  </span>
                  <span>
                    Export credit <strong>{formatMoney(snapshot.exportRevenue)}</strong>
                  </span>
                </div>

                <input
                  className="slider"
                  type="range"
                  min={-60}
                  max={120}
                  step={5}
                  value={value}
                  onChange={(event) =>
                    setDraft((previous) => ({
                      ...previous,
                      [definition.id]: Number(event.target.value),
                    }))
                  }
                  style={{ '--fill': `${percent}%` } as React.CSSProperties}
                  aria-label={`${definition.name} tax or subsidy`}
                />
                <div className="range-scale">
                  <span>60% subsidy</span>
                  <span>0</span>
                  <span>120% tax</span>
                </div>

                <div className="commerce-policy-row">
                  <span>{policyLabel(value)}</span>
                  <strong className={snapshot.fiscal >= 0 ? 'text-positive' : 'text-negative'}>
                    {formatSignedMoney(snapshot.fiscal)}
                    <small> / turn</small>
                  </strong>
                </div>

                <div className="commerce-card-actions">
                  <span className={changed ? 'text-warning' : 'text-muted'}>
                    {changed
                      ? `Draft ${policyLabel(value)} · current ${policyLabel(player.commercePolicy[definition.id] ?? 0)}`
                      : 'No pending change'}
                  </span>
                  <button
                    type="button"
                    className={`btn btn-sm ${changed ? 'btn-primary' : ''}`}
                    disabled={!changed || game.actionsLeft < 1}
                    onClick={() => setCommercePolicy(definition.id, value)}
                  >
                    <Icon name="Check" size={14} /> Apply
                  </button>
                </div>
                <p className="commerce-blurb">{definition.blurb}</p>
              </div>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Currency parity & strength ranking"
        subtitle="Compare your currency with any partner, then rank every living currency by stability."
      >
        <div className="currency-compare">
          <div className="currency-compare-head">
            <div className="currency-side">
              <span className="mini-kicker">Your currency</span>
              <strong>{player.currency.code}</strong>
              <small>
                {player.currency.name} · {player.currency.regime}
              </small>
            </div>
            <div className="currency-cross">
              <span>1 {player.currency.code} buys</span>
              <strong>
                {formatNumber(crossRate, 3)} {compareCountry.currency.code}
              </strong>
              <small>
                1 {compareCountry.currency.code} = {formatNumber(reverseCross, 3)}{' '}
                {player.currency.code}
              </small>
            </div>
            <div className="currency-side currency-side-compare">
              <span className="mini-kicker">Compare with</span>
              <select
                className="select select-small"
                value={compareCountry.id}
                onChange={(event) => setCompareId(event.target.value)}
                aria-label="Compare currency with"
              >
                {liveCountries
                  .filter((country) => !country.isPlayer)
                  .map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name} · {country.currency.code}
                    </option>
                  ))}
              </select>
              <small>
                {compareCountry.currency.name} · {compareCountry.currency.regime}
              </small>
            </div>
          </div>

          <div className="currency-compare-grid">
            <div className="currency-compare-row currency-compare-labels">
              <span>Metric</span>
              <strong>{player.currency.code}</strong>
              <strong>{compareCountry.currency.code}</strong>
              <strong>Edge</strong>
            </div>
            <div className="currency-compare-row">
              <span>Rate per credit</span>
              <strong>{formatNumber(player.currency.rate, 3)}</strong>
              <strong>{formatNumber(compareCountry.currency.rate, 3)}</strong>
              <strong className="text-muted">—</strong>
            </div>
            <div className="currency-compare-row">
              <span>Inflation</span>
              <strong>{formatDecimal(player.stats.inflation, 1)}%</strong>
              <strong>{formatDecimal(compareCountry.stats.inflation, 1)}%</strong>
              <strong className={inflationDiff <= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedNumber(inflationDiff, 1)} pts
              </strong>
            </div>
            <div className="currency-compare-row">
              <span>PPP gap</span>
              <strong>{formatDecimal(playerGap, 1)}%</strong>
              <strong>{formatDecimal(compareGap, 1)}%</strong>
              <strong className={gapDiff <= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedNumber(gapDiff, 1)} pts
              </strong>
            </div>
            <div className="currency-compare-row">
              <span>Strength score</span>
              <strong>{formatDecimal(playerCurrencyStrength, 1)}</strong>
              <strong>{formatDecimal(compareCurrencyStrength, 1)}</strong>
              <strong className={strengthDiff >= 0 ? 'text-positive' : 'text-negative'}>
                {formatSignedNumber(strengthDiff, 1)}
              </strong>
            </div>
          </div>
          <p className="formula-note">
            Strength score = 100 − 1.6 × inflation − 1.2 × PPP gap − 0.4 × depreciation. Cross rates
            use 1 {player.currency.code} = {formatNumber(crossRate, 3)}{' '}
            {compareCountry.currency.code}.
          </p>
        </div>

        <div className="table-wrap">
          <table className="commerce-parity-table">
            <thead>
              <tr>
                <th className="num">#</th>
                <th>Country</th>
                <th>Currency</th>
                <th className="num">Score</th>
                <th className="num">Rate / CR</th>
                <th className="num">Move</th>
                <th className="num">Inflation</th>
                <th className="num">Fair rate</th>
                <th className="num">Gap</th>
              </tr>
            </thead>
            <tbody>
              {parityRows.map((country, index) => {
                const rowCurrency = country.currency
                const gap = currencyGap(country)
                const strength = currencyStrength(country)
                return (
                  <tr key={country.id} className={country.isPlayer ? 'commerce-self-row' : ''}>
                    <td className="num">{index + 1}</td>
                    <td>
                      <span className="resource-inline">
                        <Flag seed={country.flagSeed} code={country.code} size="sm" />
                        {country.name}
                        {country.isPlayer ? ' · You' : ''}
                      </span>
                    </td>
                    <td>
                      <strong>{rowCurrency.code}</strong>
                      <span className="commerce-currency-name">{rowCurrency.name}</span>
                    </td>
                    <td className="num">
                      <Badge
                        tone={strength >= 75 ? 'positive' : strength >= 50 ? 'warning' : 'negative'}
                      >
                        {formatDecimal(strength, 1)}
                      </Badge>
                    </td>
                    <td className="num">
                      {formatNumber(rowCurrency.rate, rowCurrency.rate < 1 ? 3 : 2)}
                    </td>
                    <td
                      className={`num ${rowCurrency.changePct > 0 ? 'text-negative' : rowCurrency.changePct < 0 ? 'text-positive' : 'text-muted'}`}
                    >
                      {formatSignedPercent(rowCurrency.changePct)}
                    </td>
                    <td className="num">{formatDecimal(country.stats.inflation, 1)}%</td>
                    <td className="num">{formatNumber(rowCurrency.fairRate, 3)}</td>
                    <td
                      className={`num ${gap < 3 ? 'text-muted' : gap < 8 ? 'text-warning' : 'text-negative'}`}
                    >
                      {formatDecimal(gap, 1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="formula-note">
          Ranked by strength score. Rate is local units per credit; cross rates follow by dividing
          the two rates. A positive move means the local currency weakened. Floating rates converge
          in about four turns; pegged rates are capped at 1% per turn.
        </p>
      </SectionCard>
    </div>
  )
}
