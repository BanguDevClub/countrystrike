import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GOVERNMENT_BY_ID } from '../game/constants'
import type { CompositeMetricKey, Country, CountrySnapshot, GovernmentId } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import type { CompositeResult } from '../game/selectors'
import { computeComposites, debtToGdp, gdpPerCapita, militaryPower } from '../game/selectors'
import { formatDecimal, formatMoney, formatNumber, formatPercent, formatUsd } from '../game/format'
import { Badge, EmptyState, PageHeader, ProgressBar, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'
import { Flag } from '../components/Flag'

type RankingMetric =
  | 'composite'
  | 'treasury'
  | 'debt'
  | 'gdp'
  | 'population'
  | 'militaryPower'
  | 'approval'
  | 'hdi'
  | 'gini'
  | 'violence'
  | 'depression'

const METRIC_LABELS: Record<RankingMetric, string> = {
  composite: 'Composite',
  treasury: 'Treasure',
  debt: 'Debt',
  gdp: 'GDP',
  population: 'Population',
  militaryPower: 'Military power',
  approval: 'Approval',
  hdi: 'HDI',
  gini: 'Gini',
  violence: 'Violence',
  depression: 'Depression',
}

const LOW_IS_BETTER: RankingMetric[] = ['debt', 'gini', 'violence', 'depression']

interface RankingRow {
  country: Country
  composite: number
  parts?: Record<CompositeMetricKey, number>
  power: number
}

function valueForRow(row: RankingRow, metric: RankingMetric): number {
  switch (metric) {
    case 'composite':
      return row.composite
    case 'treasury':
      return row.country.stats.treasury
    case 'debt':
      return row.country.stats.debt
    case 'gdp':
      return row.country.stats.gdp
    case 'population':
      return row.country.stats.population
    case 'militaryPower':
      return row.power
    case 'approval':
      return row.country.stats.approval
    case 'hdi':
      return row.country.stats.hdi
    case 'gini':
      return row.country.stats.gini
    case 'violence':
      return row.country.stats.violence
    case 'depression':
      return row.country.stats.depression
  }
}

function valueForSnapshot(snapshot: CountrySnapshot, metric: RankingMetric): number {
  switch (metric) {
    case 'composite':
      return snapshot.composite
    case 'treasury':
      return snapshot.treasury
    case 'debt':
      return snapshot.debt
    case 'gdp':
      return snapshot.gdp
    case 'population':
      return snapshot.population
    case 'militaryPower':
      return snapshot.militaryPower
    case 'approval':
      return snapshot.approval
    case 'hdi':
      return snapshot.hdi
    case 'gini':
      return snapshot.gini
    case 'violence':
      return snapshot.violence
    case 'depression':
      return snapshot.depression
  }
}

function formatMetric(metric: RankingMetric, value: number): string {
  switch (metric) {
    case 'treasury':
    case 'debt':
    case 'gdp':
      return formatMoney(value)
    case 'population':
      return `${formatNumber(value, 1)}M`
    case 'militaryPower':
      return formatDecimal(value, 0)
    case 'approval':
      return `${formatDecimal(value, 1)}%`
    case 'hdi':
      return formatDecimal(value, 3)
    case 'gini':
    case 'violence':
    case 'depression':
      return formatDecimal(value, 1)
    case 'composite':
      return formatDecimal(value, 1)
  }
}

const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

export function Ranking() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const openCountry = useGame((state) => state.openCountry)
  const [query, setQuery] = useState('')
  const [government, setGovernment] = useState<GovernmentId | 'all'>('all')
  const [continent, setContinent] = useState<string>('all')
  const [sortKey, setSortKey] = useState<RankingMetric>('composite')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [historyMetric, setHistoryMetric] = useState<RankingMetric>('composite')
  const [historyRange, setHistoryRange] = useState(10)
  const [historyMode, setHistoryMode] = useState<'top' | 'player'>('top')

  const composites = useMemo<Map<string, CompositeResult>>(
    () => (game ? computeComposites(game.countries) : new Map()),
    [game],
  )
  const rows = useMemo<RankingRow[]>(() => {
    if (!game) return []
    return game.countries
      .filter((country) => country.status === 'alive')
      .map((country) => ({
        country,
        composite: composites.get(country.id)?.score ?? 0,
        parts: composites.get(country.id)?.parts,
        power: militaryPower(country),
      }))
  }, [game, composites])

  const compositeRanks = useMemo(() => {
    const ordered = [...rows].sort((a, b) => b.composite - a.composite)
    return new Map(ordered.map((row, index) => [row.country.id, index + 1]))
  }, [rows])

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter((row) => {
      if (needle && !`${row.country.name} ${row.country.capital}`.toLowerCase().includes(needle)) {
        return false
      }
      if (government !== 'all' && row.country.government !== government) return false
      if (continent !== 'all' && row.country.continentId !== continent) return false
      return true
    })
  }, [rows, query, government, continent])

  const sortedRows = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1
    return [...filteredRows].sort((a, b) => {
      const difference = valueForRow(a, sortKey) - valueForRow(b, sortKey)
      if (difference !== 0) return difference * direction
      return b.composite - a.composite
    })
  }, [filteredRows, sortKey, sortDirection])

  const history = game?.history ?? []
  const visibleHistory = historyRange === 0 ? history : history.slice(-historyRange)
  const chartSeries = useMemo(() => {
    if (historyMode === 'player' && player) return [player]
    const direction = LOW_IS_BETTER.includes(historyMetric) ? 1 : -1
    return [...filteredRows]
      .sort((a, b) => (valueForRow(a, historyMetric) - valueForRow(b, historyMetric)) * direction)
      .slice(0, 6)
      .map((row) => row.country)
  }, [filteredRows, historyMetric, historyMode, player])

  const chartData = useMemo(() => {
    return visibleHistory.map((point) => {
      const entry: Record<string, string | number | null> = { turn: point.turn }
      for (const country of chartSeries) {
        const snapshot = point.countries[country.id]
        entry[country.name] = snapshot ? valueForSnapshot(snapshot, historyMetric) : null
      }
      return entry
    })
  }, [visibleHistory, chartSeries, historyMetric])

  if (!game || !player) return null

  const playerRow = rows.find((row) => row.country.id === player.id)
  const topRow = [...rows].sort((a, b) => b.composite - a.composite)[0]
  const playerRank = compositeRanks.get(player.id) ?? 0
  const strongestPart = playerRow?.parts
    ? (Object.entries(playerRow.parts) as [CompositeMetricKey, number][]).sort(
        (a, b) => b[1] - a[1],
      )[0]
    : undefined
  const strongestLabel = strongestPart ? METRIC_LABELS[strongestPart[0] as RankingMetric] : '—'
  const chartValueLabel = METRIC_LABELS[historyMetric]
  const handleSort = (metric: RankingMetric) => {
    if (sortKey === metric) {
      setSortDirection((current) => (current === 'desc' ? 'asc' : 'desc'))
      return
    }
    setSortKey(metric)
    setSortDirection(LOW_IS_BETTER.includes(metric) ? 'asc' : 'desc')
  }

  const SortHeader = ({
    metric,
    children,
    numeric = false,
  }: {
    metric: RankingMetric
    children: React.ReactNode
    numeric?: boolean
  }) => (
    <th className={numeric ? 'num' : undefined}>
      <button
        type="button"
        className={`sort-button ${sortKey === metric ? 'is-active' : ''}`}
        onClick={() => handleSort(metric)}
      >
        {children}
        <Icon
          name={
            sortKey === metric
              ? sortDirection === 'asc'
                ? 'TrendingUp'
                : 'TrendingDown'
              : 'ArrowUpDown'
          }
          size={12}
        />
      </button>
    </th>
  )

  return (
    <div className="page">
      <PageHeader page="ranking">
        <Badge tone="accent" icon="Trophy">
          Composite score · 0–100
        </Badge>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Your rank"
          value={playerRank > 0 ? `#${playerRank}` : '—'}
          hint={`of ${rows.length} sovereign states`}
          icon="Trophy"
          tone="accent"
        />
        <StatTile
          label="Your composite"
          value={formatDecimal(playerRow?.composite ?? 0, 1)}
          hint={`Strongest normalized pillar: ${strongestLabel}`}
          icon="Gauge"
        />
        <StatTile
          label="World leader"
          value={topRow?.country.name ?? '—'}
          hint={`Composite ${formatDecimal(topRow?.composite ?? 0, 1)}`}
          icon="Crown"
        />
        <StatTile
          label="World output"
          value={formatMoney(rows.reduce((total, row) => total + row.country.stats.gdp, 0))}
          hint={`Avg. approval ${formatPercent(rows.reduce((total, row) => total + row.country.stats.approval, 0) / Math.max(1, rows.length))}`}
          icon="Globe"
        />
      </div>

      <SectionCard
        className="chart-card ranking-history-card"
        title="Historical standings"
        subtitle="Trace any ranking metric over time. The top six follow the table filters."
        action={
          <div className="chart-actions">
            <select
              className="select select-small"
              value={historyMetric}
              onChange={(event) => setHistoryMetric(event.target.value as RankingMetric)}
              aria-label="Historical metric"
            >
              {(Object.keys(METRIC_LABELS) as RankingMetric[]).map((metric) => (
                <option key={metric} value={metric}>
                  {METRIC_LABELS[metric]}
                </option>
              ))}
            </select>
            <div className="segmented segmented-small" role="group" aria-label="Chart scope">
              <button
                type="button"
                className={historyMode === 'top' ? 'is-active' : ''}
                onClick={() => setHistoryMode('top')}
                aria-pressed={historyMode === 'top'}
              >
                Top 6
              </button>
              <button
                type="button"
                className={historyMode === 'player' ? 'is-active' : ''}
                onClick={() => setHistoryMode('player')}
                aria-pressed={historyMode === 'player'}
              >
                Player
              </button>
            </div>
            <select
              className="select select-small"
              value={historyRange}
              onChange={(event) => setHistoryRange(Number(event.target.value))}
              aria-label="Historical range"
            >
              <option value={10}>Last 10 turns</option>
              <option value={25}>Last 25 turns</option>
              <option value={0}>All turns</option>
            </select>
          </div>
        }
      >
        {chartData.length === 0 ? (
          <EmptyState
            icon="ChartLine"
            title="No history to chart"
            body="End a turn to build a historical record. The chart tracks up to 80 turns."
          />
        ) : (
          <div className="chart-frame">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 12, right: 14, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false} />
                <XAxis
                  dataKey="turn"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => `T${value}`}
                />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value) => formatMetric(historyMetric, Number(value))}
                  width={68}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    color: 'var(--fg)',
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => `Turn ${label}`}
                  formatter={(value, name) => [
                    formatMetric(historyMetric, Number(value)),
                    String(name),
                  ]}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: 'var(--muted)' }} />
                {chartSeries.map((country, index) => (
                  <Line
                    key={country.id}
                    type="monotone"
                    dataKey={country.name}
                    stroke={CHART_COLORS[index % CHART_COLORS.length]}
                    strokeWidth={country.isPlayer ? 3 : 1.8}
                    dot={chartData.length <= 3}
                    connectNulls
                    name={country.name}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="chart-footnote">
          <Icon name="Info" size={13} /> {chartValueLabel} values. For low-is-good metrics, the top
          six are the lowest values in the filtered table. Composite includes all pillars.
        </div>
      </SectionCard>

      <SectionCard
        className="table-card ranking-table-card"
        title="The world table"
        subtitle={`${filteredRows.length} of ${rows.length} states match the filters. Click any row for its dossier.`}
        action={
          <div className="ranking-filters">
            <div className="search-field">
              <Icon name="Search" size={15} />
              <input
                className="input input-small"
                placeholder="Country or capital"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search countries"
              />
            </div>
            <select
              className="select select-small"
              value={government}
              onChange={(event) => setGovernment(event.target.value as GovernmentId | 'all')}
              aria-label="Filter by government"
            >
              <option value="all">All governments</option>
              {Object.values(GOVERNMENT_BY_ID).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
            <select
              className="select select-small"
              value={continent}
              onChange={(event) => setContinent(event.target.value)}
              aria-label="Filter by continent"
            >
              <option value="all">All continents</option>
              {game.continents.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="table-wrap">
          <table className="ranking-table">
            <thead>
              <tr>
                <th className="rank-col">#</th>
                <th>Country</th>
                <SortHeader metric="composite" numeric>
                  Composite
                </SortHeader>
                <SortHeader metric="treasury" numeric>
                  Treasure
                </SortHeader>
                <SortHeader metric="debt" numeric>
                  Debt
                </SortHeader>
                <SortHeader metric="gdp" numeric>
                  GDP
                </SortHeader>
                <SortHeader metric="population" numeric>
                  Population
                </SortHeader>
                <SortHeader metric="militaryPower" numeric>
                  Military
                </SortHeader>
                <SortHeader metric="approval" numeric>
                  Approval
                </SortHeader>
                <SortHeader metric="hdi" numeric>
                  HDI
                </SortHeader>
                <SortHeader metric="gini" numeric>
                  Gini
                </SortHeader>
                <SortHeader metric="violence" numeric>
                  Violence
                </SortHeader>
                <SortHeader metric="depression" numeric>
                  Depression
                </SortHeader>
              </tr>
            </thead>
            <tbody>
              {sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={13}>
                    <EmptyState
                      icon="Search"
                      title="No countries match"
                      body="Loosen a filter or clear the search."
                    />
                  </td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const country = row.country
                  const rank = compositeRanks.get(country.id) ?? 0
                  return (
                    <tr
                      key={country.id}
                      className={`ranking-row ${country.isPlayer ? 'is-player-row' : ''}`}
                      onClick={() => openCountry(country.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          openCountry(country.id)
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <td className="rank-col">
                        <span className={`rank-number rank-${Math.min(3, rank)}`}>{rank}</span>
                      </td>
                      <td>
                        <span className="country-cell-name">
                          <Flag seed={country.flagSeed} code={country.code} size="sm" />
                          <span>
                            <strong>
                              {country.name}
                              {country.isPlayer ? ' · You' : ''}
                            </strong>
                            <small>
                              {GOVERNMENT_BY_ID[country.government]?.name} ·{' '}
                              {formatUsd(gdpPerCapita(country))} / capita
                            </small>
                          </span>
                        </span>
                      </td>
                      <td className="num">
                        <div className="composite-cell">
                          <strong>{formatDecimal(row.composite, 1)}</strong>
                          <ProgressBar
                            value={row.composite}
                            tone={country.isPlayer ? 'accent' : 'positive'}
                            thin
                          />
                        </div>
                      </td>
                      <td className="num">{formatMoney(country.stats.treasury)}</td>
                      <td className="num">
                        {formatMoney(country.stats.debt)}
                        <small className="cell-sub">{formatPercent(debtToGdp(country))} GDP</small>
                      </td>
                      <td className="num">{formatMoney(country.stats.gdp)}</td>
                      <td className="num">{formatNumber(country.stats.population, 1)}M</td>
                      <td className="num">{formatDecimal(row.power, 0)}</td>
                      <td className="num">{formatPercent(country.stats.approval)}</td>
                      <td className="num">{formatDecimal(country.stats.hdi, 3)}</td>
                      <td className="num">{formatDecimal(country.stats.gini, 1)}</td>
                      <td className="num">{formatDecimal(country.stats.violence, 1)}</td>
                      <td className="num">{formatDecimal(country.stats.depression, 1)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Composite methodology"
        subtitle="The score is a weighted, normalized view of the same table. Hover or expand the Methodology page for the full formulas."
        action={
          <button
            type="button"
            className="text-btn"
            onClick={() => useGame.getState().setPage('methodology')}
          >
            Read the methodology
          </button>
        }
      >
        <div className="composite-breakdown">
          {playerRow?.parts ? (
            (Object.entries(playerRow.parts) as [RankingMetric, number][])
              .filter(([metric]) => metric in METRIC_LABELS)
              .sort((a, b) => b[1] - a[1])
              .map(([metric, normalized]) => (
                <div key={metric} className="composite-part">
                  <span>{METRIC_LABELS[metric]}</span>
                  <ProgressBar
                    value={normalized * 100}
                    tone={metric === 'debt' || metric === 'gini' ? 'warning' : 'accent'}
                    thin
                    valueLabel={`${formatDecimal(normalized * 100, 0)}%`}
                  />
                </div>
              ))
          ) : (
            <p className="text-muted">
              Composite parts are calculated from the living-state table.
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
