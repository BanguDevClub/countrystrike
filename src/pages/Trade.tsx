import { useEffect, useMemo, useState } from 'react'
import { AUTO_DEAL_MODES, GOVERNMENT_BY_ID, RESOURCES, TRADE_PRICING } from '../game/constants'
import type {
  AutoDealMode,
  Country,
  ResourceFlow,
  ResourceId,
  TradeDeal,
  TradePricing,
} from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import { computeMarket, resourceFlows } from '../game/selectors'
import { formatMoney, formatPercent, formatQuantity, formatTurnRunway } from '../game/format'
import { Badge, EmptyState, PageHeader, StatTile, SectionCard } from '../components/ui'
import { Icon } from '../components/Icon'
import { Flag } from '../components/Flag'
import { ModalShell } from '../components/modals'
import { playSfx } from '../game/audio'

type TradeDirection = 'import' | 'export'

interface SelectedTrade {
  countryId: string
  resourceId: ResourceId
  direction: TradeDirection
}

const PRICING_ORDER: TradePricing[] = ['below', 'market', 'above']

const dealPartnerId = (deal: TradeDeal, playerId: string): string =>
  deal.buyerId === playerId ? deal.sellerId : deal.buyerId

const dealDirection = (deal: TradeDeal, playerId: string): TradeDirection =>
  deal.buyerId === playerId ? 'import' : 'export'

function TradeDealModal({ selected, onClose }: { selected: SelectedTrade; onClose: () => void }) {
  const game = useGame((state) => state.game)
  const signDeal = useGame((state) => state.signDeal)
  const [pricing, setPricing] = useState<TradePricing>('market')
  const [quantity, setQuantity] = useState(10)

  useEffect(() => {
    setPricing('market')
    setQuantity(10)
  }, [selected])

  const partner = game?.countries.find((country) => country.id === selected.countryId)
  if (!game || !partner) return null
  const player = game.countries.find((entry) => entry.isPlayer) ?? game.countries[0]!
  const playerFlow = resourceFlows(player, game.deals, game.prices)[selected.resourceId]
  const partnerFlow = resourceFlows(partner, game.deals, game.prices)[selected.resourceId]
  const resource = RESOURCES.find((entry) => entry.id === selected.resourceId)!
  const market = game.prices[selected.resourceId]
  const price = market * TRADE_PRICING[pricing].multiplier
  const relationshipGain = TRADE_PRICING[pricing].relation
  const projectedRelations = Math.min(100, partner.relations + relationshipGain)
  const available =
    selected.direction === 'import'
      ? Math.max(0, Math.floor(partnerFlow.finalBalance + partnerFlow.stock * 0.2))
      : Math.max(0, Math.floor(Math.max(0, playerFlow.finalBalance) + playerFlow.stock * 0.2))
  const canSign =
    game.actionsLeft > 0 &&
    quantity > 0 &&
    quantity <= available &&
    (selected.direction === 'export' || player.stats.treasury >= price * quantity)
  const total = price * quantity

  return (
    <ModalShell
      onClose={onClose}
      icon="HandCoins"
      eyebrow={
        <>
          <Badge tone="accent">{selected.direction === 'import' ? 'Import' : 'Export'}</Badge>
          <span>{partner.name}</span>
        </>
      }
      title={`${resource.name} contract`}
      subtitle={`Market reference: ${formatMoney(market)} per ${resource.unit}. Contracts run for 5 turns and are paid or received each turn.`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSign}
            onClick={() => {
              playSfx('coin')
              signDeal(partner.id, selected.resourceId, selected.direction, pricing, quantity)
              onClose()
            }}
          >
            <Icon name="Handshake" size={16} /> Sign contract
          </button>
        </>
      }
    >
      <div className="deal-partner">
        <Flag seed={partner.flagSeed} code={partner.code} size="md" />
        <div>
          <strong>{partner.name}</strong>
          <span>
            {GOVERNMENT_BY_ID[partner.government]?.name} · relations {Math.round(partner.relations)}
          </span>
        </div>
        <Badge
          tone={partner.relations >= 60 ? 'positive' : partner.relations < 0 ? 'negative' : 'muted'}
        >
          {selected.direction === 'import' ? 'They export' : 'They import'}{' '}
          {formatQuantity(
            selected.direction === 'import' ? partnerFlow.finalBalance : -partnerFlow.finalBalance,
          )}
        </Badge>
      </div>

      <div className="deal-grid">
        <label className="field">
          <span>Quantity per turn</span>
          <input
            className="input"
            type="number"
            min={1}
            max={available}
            value={quantity}
            onChange={(event) => setQuantity(Math.max(0, Number(event.target.value) || 0))}
          />
          <small>
            Available: {formatQuantity(available)} {resource.unit}
          </small>
        </label>
        <div className="deal-summary-box">
          <span>Cash flow per turn</span>
          <strong className={selected.direction === 'export' ? 'text-positive' : 'text-negative'}>
            {selected.direction === 'export' ? '+' : '−'}
            {formatMoney(total)}
          </strong>
          <small>
            {selected.direction === 'export' ? 'Revenue' : 'Cost'} at {formatMoney(price)}/unit
          </small>
        </div>
      </div>

      <div className="pricing-options">
        {PRICING_ORDER.map((option) => (
          <button
            key={option}
            type="button"
            className={`pricing-option ${pricing === option ? 'is-active' : ''} pricing-${option}`}
            onClick={() => setPricing(option)}
            aria-pressed={pricing === option}
          >
            <span className="pricing-option-top">
              <strong>{TRADE_PRICING[option].label}</strong>
              <span>{Math.round(TRADE_PRICING[option].multiplier * 100)}%</span>
            </span>
            <span className="pricing-price">
              {formatMoney(market * TRADE_PRICING[option].multiplier)} / {resource.unit}
            </span>
            <span className="pricing-hint">{TRADE_PRICING[option].hint}</span>
            <Badge tone={TRADE_PRICING[option].relation > 0 ? 'positive' : 'muted'}>
              Relations +{TRADE_PRICING[option].relation}
            </Badge>
          </button>
        ))}
      </div>

      <div className="deal-relation-preview">
        <div>
          <span>Relations after signing</span>
          <strong>{Math.round(projectedRelations)} / 100</strong>
        </div>
        <div className="relation-mini-track">
          <span style={{ width: `${Math.max(0, Math.min(100, projectedRelations))}%` }} />
        </div>
        <p>
          {selected.direction === 'import'
            ? 'You buy from their surplus. Below-market purchases create the strongest goodwill.'
            : 'You sell from your surplus. Below-market sales create goodwill; above-market sales are neutral.'}
        </p>
      </div>
      {selected.direction === 'import' && player.stats.treasury < total && (
        <div className="notice notice-negative compact-notice">
          <Icon name="Info" size={16} />
          <span>The first payment exceeds the current treasury. The deal cannot be signed.</span>
        </div>
      )}
      {game.actionsLeft < 1 && (
        <div className="notice notice-negative compact-notice">
          <Icon name="Info" size={16} />
          <span>No actions remain this turn.</span>
        </div>
      )}
    </ModalShell>
  )
}

export function Trade() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const cancelDeal = useGame((state) => state.cancelDeal)
  const setAutoDeal = useGame((state) => state.setAutoDeal)
  const setPage = useGame((state) => state.setPage)
  const [query, setQuery] = useState('')
  const [focusResource, setFocusResource] = useState<ResourceId | 'all'>('all')
  const [selected, setSelected] = useState<SelectedTrade | null>(null)

  const flowsByCountry = useMemo(() => {
    if (!game) return new Map<string, Record<ResourceId, ResourceFlow>>()
    return new Map(
      game.countries
        .filter((country) => country.status === 'alive')
        .map((country) => [country.id, resourceFlows(country, game.deals, game.prices)]),
    )
  }, [game])

  const market = useMemo(() => {
    if (!game) return null
    const countries = game.countries.filter((country) => country.status === 'alive')
    return computeMarket(
      countries,
      flowsByCountry,
      game.deals,
      game.prices,
      game.settings.resourcePrices,
    )
  }, [game, flowsByCountry])

  if (!game || !player || !market) return null

  const previousPoint = game.history.at(-1)
  const previousPrevious = game.history.at(-2)
  const deals = game.deals
  const playerDeals = deals.filter(
    (deal) => deal.buyerId === player.id || deal.sellerId === player.id,
  )
  const worldDeals = deals.filter(
    (deal) => deal.buyerId !== player.id && deal.sellerId !== player.id,
  )
  const countryById = new Map(game.countries.map((country) => [country.id, country]))
  const sortedWorldDeals = [...worldDeals].sort(
    (a, b) => b.quantity * b.unitPrice - a.quantity * a.unitPrice,
  )
  const worldTradeValue = worldDeals.reduce(
    (total, deal) => total + deal.quantity * deal.unitPrice,
    0,
  )
  const importCost = playerDeals
    .filter((deal) => deal.buyerId === player.id)
    .reduce((total, deal) => total + deal.quantity * deal.unitPrice, 0)
  const exportRevenue = playerDeals
    .filter((deal) => deal.sellerId === player.id)
    .reduce((total, deal) => total + deal.quantity * deal.unitPrice, 0)
  const activeCountries = game.countries
    .filter((country) => country.status === 'alive')
    .sort((a, b) => Number(b.isPlayer) - Number(a.isPlayer) || a.name.localeCompare(b.name))
    .filter((country) => {
      if (!query.trim()) return true
      const needle = query.trim().toLowerCase()
      return (
        country.name.toLowerCase().includes(needle) ||
        country.capital.toLowerCase().includes(needle)
      )
    })
  const columns =
    focusResource === 'all'
      ? RESOURCES
      : RESOURCES.filter((resource) => resource.id === focusResource)

  const openDeal = (country: Country, resourceId: ResourceId, direction: TradeDirection) => {
    playSfx('click')
    setSelected({ countryId: country.id, resourceId, direction })
  }

  return (
    <div className="page">
      <PageHeader page="trade">
        <button type="button" className="btn" onClick={() => setPage('industry')}>
          <Icon name="Factory" size={16} /> Industry
        </button>
        <button type="button" className="btn" onClick={() => setPage('budget')}>
          <Icon name="Banknote" size={16} /> Trade ledger
        </button>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Your contracts"
          value={playerDeals.length}
          hint={`${playerDeals.filter((deal) => deal.auto).length} automated · ${worldDeals.length} world deals`}
          icon="Handshake"
          tone="accent"
        />
        <StatTile
          label="Import cost"
          value={formatMoney(importCost)}
          hint="Per turn, across active contracts"
          icon="TrendingDown"
          tone="negative"
        />
        <StatTile
          label="Export revenue"
          value={formatMoney(exportRevenue)}
          hint="Per turn, across active contracts"
          icon="TrendingUp"
          tone="positive"
        />
        <StatTile
          label="Trade balance"
          value={formatMoney(exportRevenue - importCost)}
          hint="Current contract mix"
          icon="HandCoins"
          tone={exportRevenue - importCost >= 0 ? 'positive' : 'warning'}
        />
      </div>

      <SectionCard
        title="World prices"
        subtitle="Supply and demand move the reference price. Click a resource to focus the balance matrix."
        action={
          <Badge tone="muted" icon="Dices">
            Prices update each turn
          </Badge>
        }
      >
        <div className="price-strip">
          {RESOURCES.map((resource) => {
            const price = game.prices[resource.id]
            const snapshot = market[resource.id]
            const oldPrice =
              previousPoint && previousPrevious
                ? previousPrevious.prices[resource.id]
                : previousPoint?.prices[resource.id]
            const delta = oldPrice ? ((price - oldPrice) / oldPrice) * 100 : 0
            const coverage =
              snapshot.deficit > 0 ? (snapshot.coveredDeficit / snapshot.deficit) * 100 : 100
            return (
              <button
                key={resource.id}
                type="button"
                className={`price-card ${focusResource === resource.id ? 'is-active' : ''}`}
                onClick={() =>
                  setFocusResource((current) => (current === resource.id ? 'all' : resource.id))
                }
                aria-pressed={focusResource === resource.id}
                title={`Deficit ${formatQuantity(snapshot.deficit)} · exports covering ${formatPercent(coverage, 0)}`}
              >
                <span className="price-card-top">
                  <span style={{ color: `var(${resource.colorVar})` }}>
                    <Icon name={resource.icon} size={18} />
                  </span>
                  <strong>{resource.name}</strong>
                  <span
                    className={`price-delta ${delta > 0.05 ? 'text-negative' : delta < -0.05 ? 'text-positive' : 'text-muted'}`}
                  >
                    <Icon name={delta >= 0 ? 'TrendingUp' : 'TrendingDown'} size={12} />
                    {formatPercent(Math.abs(delta), 1)}
                  </span>
                </span>
                <span className="price-value">
                  {formatMoney(price)}
                  <small> / {resource.unit}</small>
                </span>
                <span className="price-supply">
                  <span>S {formatQuantity(snapshot.supply)}</span>
                  <span>D {formatQuantity(snapshot.demand)}</span>
                  <span
                    className={snapshot.uncoveredDeficit > 0 ? 'text-negative' : 'text-positive'}
                  >
                    Def {formatQuantity(snapshot.uncoveredDeficit)}
                  </span>
                  <span className="text-muted">X {formatQuantity(snapshot.exports)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="World market clearing"
        subtitle="Deficits push prices up. Export contracts that actually reach deficit nations relieve the pressure; dwindling reserves and thin stockpiles add scarcity."
        action={
          <Badge tone="accent" icon="Coins">
            {worldDeals.length} inter-state contracts
          </Badge>
        }
      >
        <div className="table-wrap trade-table-wrap">
          <table className="trade-table market-table">
            <thead>
              <tr>
                <th className="sticky-col">Resource</th>
                <th className="num">Reference</th>
                <th className="num">Supply</th>
                <th className="num">Demand</th>
                <th className="num">Deficit</th>
                <th className="num">Exported</th>
                <th className="num">Coverage</th>
                <th className="num">Reserve cover</th>
                <th className="num">Pressure</th>
              </tr>
            </thead>
            <tbody>
              {RESOURCES.map((resource) => {
                const snapshot = market[resource.id]
                const coverage =
                  snapshot.deficit > 0 ? (snapshot.coveredDeficit / snapshot.deficit) * 100 : 100
                return (
                  <tr key={resource.id}>
                    <td className="sticky-col">
                      <span className="country-cell-name">
                        <span style={{ color: `var(${resource.colorVar})` }}>
                          <Icon name={resource.icon} size={15} />
                        </span>
                        <span>
                          <strong>{resource.name}</strong>
                          <small>{resource.category}</small>
                        </span>
                      </span>
                    </td>
                    <td className="num">{formatMoney(snapshot.price)}</td>
                    <td className="num">{formatQuantity(snapshot.supply)}</td>
                    <td className="num">{formatQuantity(snapshot.demand)}</td>
                    <td className="num text-negative">{formatQuantity(snapshot.deficit)}</td>
                    <td className="num">{formatQuantity(snapshot.exports)}</td>
                    <td className="num">
                      <Badge
                        tone={coverage >= 80 ? 'positive' : coverage >= 40 ? 'warning' : 'negative'}
                      >
                        {formatPercent(coverage, 0)}
                      </Badge>
                    </td>
                    <td className="num">{formatTurnRunway(snapshot.reserveTurns)}</td>
                    <td className="num">{snapshot.pressure.toFixed(2)}×</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="trade-legend-row">
          <span>
            <span className="balance-cell positive" /> Coverage: share of the global deficit
            supplied by real export contracts
          </span>
          <span className="text-muted">
            Pressure above 1.00× indicates upward price force from deficits and scarcity.
          </span>
        </div>
      </SectionCard>

      <SectionCard
        title="Global balance matrix"
        subtitle="Each cell is a country's final resource balance this turn. Surplus cells can be bought; deficits can be supplied."
        action={
          <div className="trade-filters">
            <div className="search-field">
              <Icon name="Search" size={15} />
              <input
                className="input input-small"
                placeholder="Country or capital"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Filter countries"
              />
            </div>
            <select
              className="select select-small"
              value={focusResource}
              onChange={(event) => setFocusResource(event.target.value as ResourceId | 'all')}
              aria-label="Filter resource"
            >
              <option value="all">All resources</option>
              {RESOURCES.map((resource) => (
                <option key={resource.id} value={resource.id}>
                  {resource.name}
                </option>
              ))}
            </select>
            <Badge tone="accent" icon="Dices">
              {game.actionsLeft} actions
            </Badge>
          </div>
        }
      >
        <div className="table-wrap trade-table-wrap">
          <table className="trade-table">
            <thead>
              <tr>
                <th className="sticky-col">Country</th>
                {columns.map((resource) => (
                  <th key={resource.id} className="num">
                    <span style={{ color: `var(${resource.colorVar})` }}>
                      <Icon name={resource.icon} size={13} />
                    </span>{' '}
                    {resource.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeCountries.map((country) => {
                const countryFlows = flowsByCountry.get(country.id)
                return (
                  <tr key={country.id} className={country.isPlayer ? 'is-player-row' : ''}>
                    <td className="sticky-col">
                      <span className="country-cell-name">
                        <Flag seed={country.flagSeed} code={country.code} size="sm" />
                        <span>
                          <strong>{country.name}</strong>
                          <small>
                            {country.isPlayer ? 'You' : GOVERNMENT_BY_ID[country.government]?.name}
                          </small>
                        </span>
                      </span>
                    </td>
                    {columns.map((resource) => {
                      const flow = countryFlows?.[resource.id]
                      if (!flow)
                        return (
                          <td key={resource.id} className="num">
                            —
                          </td>
                        )
                      const balance = flow.finalBalance
                      const direction: TradeDirection = balance >= 0 ? 'import' : 'export'
                      const clickable = !country.isPlayer && Math.abs(balance) > 0.5
                      return (
                        <td
                          key={resource.id}
                          className={`num ${balance >= 0 ? 'is-surplus' : 'is-deficit'}`}
                        >
                          {clickable ? (
                            <button
                              type="button"
                              className="trade-cell-button"
                              onClick={() => openDeal(country, resource.id, direction)}
                              title={
                                direction === 'import'
                                  ? `Buy ${resource.name.toLowerCase()} from ${country.name}`
                                  : `Sell ${resource.name.toLowerCase()} to ${country.name}`
                              }
                            >
                              {balance > 0 ? '+' : ''}
                              {formatQuantity(balance)}
                            </button>
                          ) : (
                            <span className="trade-cell-static">
                              {balance > 0 ? '+' : ''}
                              {formatQuantity(balance)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="trade-legend-row">
          <span>
            <span className="balance-cell positive" /> Surplus: available to import
          </span>
          <span>
            <span className="balance-cell negative" /> Deficit: an export market
          </span>
          <span className="text-muted">Click a non-player cell to draft a contract.</span>
        </div>
      </SectionCard>

      <div className="trade-bottom-grid">
        <SectionCard
          title="Your contracts"
          subtitle="Contracts settle each turn until they expire or are cancelled."
          action={
            <Badge tone={playerDeals.length > 0 ? 'accent' : 'muted'}>
              {playerDeals.length} active
            </Badge>
          }
        >
          {playerDeals.length === 0 ? (
            <EmptyState
              icon="HandCoins"
              title="No trade contracts"
              body="Pick a surplus or deficit in the matrix to open a deal."
            />
          ) : (
            <div className="deal-list">
              {playerDeals.map((deal) => {
                const partner = game.countries.find(
                  (country) => country.id === dealPartnerId(deal, player.id),
                )
                const direction = dealDirection(deal, player.id)
                const def = RESOURCES.find((resource) => resource.id === deal.resource)!
                return (
                  <div key={deal.id} className="deal-row">
                    <span className="deal-direction">
                      <Icon
                        name={direction === 'import' ? 'ArrowDownRight' : 'ArrowUpRight'}
                        size={17}
                      />
                    </span>
                    <div className="deal-copy">
                      <strong>
                        {direction === 'import' ? 'Buy' : 'Sell'} {def.name.toLowerCase()}
                        {partner ? ` · ${partner.name}` : ''}
                      </strong>
                      <span>
                        {formatQuantity(deal.quantity)} {def.unit} · {formatMoney(deal.unitPrice)}
                        /unit · {deal.remainingTurns} turn{deal.remainingTurns === 1 ? '' : 's'}{' '}
                        left{deal.auto && ` · +${deal.pricing === 'below' ? 2 : 1} rel/turn`}
                      </span>
                    </div>
                    <div className="deal-net">
                      <strong
                        className={direction === 'export' ? 'text-positive' : 'text-negative'}
                      >
                        {direction === 'export' ? '+' : '−'}
                        {formatMoney(deal.quantity * deal.unitPrice)}
                      </strong>
                      {deal.auto && <Badge tone="accent">auto</Badge>}
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => cancelDeal(deal.id)}
                      aria-label="Cancel trade contract"
                      title="Cancel contract"
                    >
                      <Icon name="X" size={15} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Auto-deal policy"
          subtitle="Export the minimal amount (1 unit) to all countries in need for 3 turns, enhancing relations each turn."
          action={
            <Badge tone="muted" icon="Handshake">
              No action cost
            </Badge>
          }
        >
          <div className="auto-deal-list">
            {RESOURCES.map((resource) => {
              const flow = flowsByCountry.get(player.id)?.[resource.id]
              const surplus = flow ? Math.max(0, flow.finalBalance) : 0
              return (
                <div key={resource.id} className="auto-deal-row">
                  <span className="auto-deal-name" style={{ color: `var(${resource.colorVar})` }}>
                    <Icon name={resource.icon} size={15} />
                    <span>{resource.name}</span>
                    <small>surplus {formatQuantity(surplus)}</small>
                  </span>
                  <select
                    className="select select-small"
                    value={player.autoDeal[resource.id]}
                    onChange={(event) =>
                      setAutoDeal(resource.id, event.target.value as AutoDealMode)
                    }
                    aria-label={`Auto-deal policy for ${resource.name}`}
                  >
                    {AUTO_DEAL_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {mode === 'off'
                          ? 'Off'
                          : `${mode[0]?.toUpperCase()}${mode.slice(1)} market`}
                      </option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
          <div className="auto-deal-note">
            <Icon name="Info" size={15} />
            <div>
              <strong>How auto-deals work</strong>
              <p>
                When a resource has auto-deal enabled, the government automatically exports the
                minimal amount (1 unit) to all countries in need under 3-turn contracts. Each turn
                the contract runs, it steadily enhances diplomatic relations (+2/turn below market,
                +1/turn at/above market). Auto-deals do not cost actions.
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="World contracts"
        subtitle="Every active deal between rival governments. These settlements move their resources, budgets and the world market."
        action={
          <div className="trade-filters">
            <Badge tone={worldDeals.length > 0 ? 'accent' : 'muted'} icon="Globe">
              {worldDeals.length} deals
            </Badge>
            <Badge tone="neutral" icon="Coins">
              {formatMoney(worldTradeValue)} / turn
            </Badge>
          </div>
        }
      >
        {worldDeals.length === 0 ? (
          <EmptyState
            icon="Globe"
            title="No inter-state contracts"
            body="Rival governments sign world-market deals when one has a surplus and another is in deficit."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="trade-table world-contracts-table">
                <thead>
                  <tr>
                    <th>Buyer</th>
                    <th>Seller</th>
                    <th>Resource</th>
                    <th className="num">Quantity / turn</th>
                    <th className="num">Unit price</th>
                    <th className="num">Value / turn</th>
                    <th className="num">Turns left</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedWorldDeals.map((deal) => {
                    const buyer = countryById.get(deal.buyerId)
                    const seller = countryById.get(deal.sellerId)
                    const definition = RESOURCES.find((resource) => resource.id === deal.resource)
                    if (!buyer || !seller || !definition) return null
                    return (
                      <tr key={deal.id}>
                        <td>
                          <span className="country-cell-name">
                            <Flag seed={buyer.flagSeed} code={buyer.code} size="sm" />
                            <span>
                              <strong>{buyer.name}</strong>
                              <small>{buyer.code}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span className="country-cell-name">
                            <Flag seed={seller.flagSeed} code={seller.code} size="sm" />
                            <span>
                              <strong>{seller.name}</strong>
                              <small>{seller.code}</small>
                            </span>
                          </span>
                        </td>
                        <td>
                          <span
                            className="resource-inline"
                            style={{ color: `var(${definition.colorVar})` }}
                          >
                            <Icon name={definition.icon} size={14} /> {definition.name}
                          </span>
                        </td>
                        <td className="num">
                          {formatQuantity(deal.quantity)} {definition.unit}
                        </td>
                        <td className="num">{formatMoney(deal.unitPrice)}</td>
                        <td className="num">{formatMoney(deal.quantity * deal.unitPrice)}</td>
                        <td className="num">{deal.remainingTurns}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="table-note">
              These contracts are signed by the world market pass, not by you. Their export volume
              is what covers part of the global deficit shown above.
            </p>
          </>
        )}
      </SectionCard>

      <SectionCard
        title="Trade terms & diplomacy"
        subtitle="Price posture is a foreign policy instrument."
      >
        <div className="trade-terms-grid">
          {PRICING_ORDER.map((pricing) => (
            <div key={pricing} className={`trade-term pricing-${pricing}`}>
              <div className="trade-term-head">
                <strong>{TRADE_PRICING[pricing].label}</strong>
                <Badge tone={TRADE_PRICING[pricing].relation > 0 ? 'positive' : 'muted'}>
                  +{TRADE_PRICING[pricing].relation} relations
                </Badge>
              </div>
              <p>{TRADE_PRICING[pricing].hint}</p>
              <span className="trade-term-price">
                {Math.round(TRADE_PRICING[pricing].multiplier * 100)}% of market
              </span>
            </div>
          ))}
        </div>
        <p className="table-note">
          Tariffs are applied to the value of imports and reduce relations over time. Deals at or
          below market prices improve the partner's view of your country immediately. The full price
          and relations model is in{' '}
          <button type="button" className="text-btn" onClick={() => setPage('methodology')}>
            Methodology
          </button>
          .
        </p>
      </SectionCard>

      {selected && <TradeDealModal selected={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
