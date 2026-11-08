import { useMemo, useState } from 'react'
import type { LogCategory } from '../game/types'
import { useGame, selectPlayer } from '../state/gameStore'
import { formatNumber } from '../game/format'
import { Badge, EmptyState, PageHeader, SectionCard, StatTile } from '../components/ui'
import { Icon } from '../components/Icon'

const CATEGORIES: { id: LogCategory; label: string; icon: string }[] = [
  { id: 'world', label: 'World', icon: 'Globe' },
  { id: 'economy', label: 'Economy', icon: 'Banknote' },
  { id: 'industry', label: 'Industry', icon: 'Factory' },
  { id: 'diplomacy', label: 'Diplomacy', icon: 'Handshake' },
  { id: 'military', label: 'Military', icon: 'Swords' },
  { id: 'governance', label: 'Governance', icon: 'Landmark' },
  { id: 'event', label: 'Event', icon: 'Sparkles' },
]

const CATEGORY_TONE: Record<
  LogCategory,
  'neutral' | 'positive' | 'negative' | 'warning' | 'accent' | 'muted'
> = {
  world: 'muted',
  economy: 'accent',
  industry: 'neutral',
  diplomacy: 'accent',
  military: 'negative',
  governance: 'warning',
  event: 'warning',
}

export function Logs() {
  const game = useGame((state) => state.game)
  const player = useGame(selectPlayer)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<LogCategory | 'all'>('all')
  const [countryId, setCountryId] = useState('all')
  const [turnFrom, setTurnFrom] = useState('')
  const [turnTo, setTurnTo] = useState('')
  const [tone, setTone] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all')

  const filtered = useMemo(() => {
    if (!game) return []
    const needle = query.trim().toLowerCase()
    const from = turnFrom ? Number(turnFrom) : null
    const to = turnTo ? Number(turnTo) : null
    return game.logs
      .filter((entry) => {
        if (category !== 'all' && entry.category !== category) return false
        if (countryId !== 'all') {
          if (
            countryId === 'player'
              ? !entry.countryId ||
                !game.countries.find((country) => country.id === entry.countryId)?.isPlayer
              : entry.countryId !== countryId
          )
            return false
        }
        if (tone !== 'all' && (entry.tone ?? 'neutral') !== tone) return false
        if (from !== null && entry.turn < from) return false
        if (to !== null && entry.turn > to) return false
        if (needle && !`${entry.message} ${entry.countryName ?? ''}`.toLowerCase().includes(needle))
          return false
        return true
      })
      .slice()
      .reverse()
  }, [game, query, category, countryId, tone, turnFrom, turnTo])

  if (!game || !player) return null

  const visible = filtered.slice(0, 300)
  const negative = filtered.filter((entry) => entry.tone === 'negative').length
  const activeFilters =
    query !== '' ||
    category !== 'all' ||
    countryId !== 'all' ||
    turnFrom !== '' ||
    turnTo !== '' ||
    tone !== 'all'

  const reset = () => {
    setQuery('')
    setCategory('all')
    setCountryId('all')
    setTone('all')
    setTurnFrom('')
    setTurnTo('')
  }

  return (
    <div className="page">
      <PageHeader page="logs">
        <Badge tone="muted" icon="ScrollText">
          {game.logs.length} recorded actions
        </Badge>
      </PageHeader>

      <div className="stat-grid stat-grid-4">
        <StatTile
          label="Filtered entries"
          value={formatNumber(filtered.length, 0)}
          hint={`${game.logs.length} total dispatches`}
          icon="ScrollText"
        />
        <StatTile
          label="Current turn"
          value={`T${game.turn}`}
          hint={`${game.logs.filter((entry) => entry.turn === game.turn).length} dispatches this turn`}
          icon="CalendarRange"
          tone="accent"
        />
        <StatTile
          label="Negative signals"
          value={formatNumber(negative, 0)}
          hint="Filtered warnings, losses and attacks"
          icon="Info"
          tone={negative > 0 ? 'negative' : 'positive'}
        />
        <StatTile
          label="Countries tracked"
          value={formatNumber(
            game.countries.filter((country) => country.status === 'alive').length,
            0,
          )}
          hint="Every living nation writes into this record"
          icon="Globe"
        />
      </div>

      <SectionCard
        title="Filter the record"
        subtitle="Search every action, narrow by domain, actor, tone and turn."
        action={
          <button type="button" className="btn btn-sm" onClick={reset} disabled={!activeFilters}>
            <Icon name="RotateCcw" size={14} /> Clear filters
          </button>
        }
      >
        <div className="log-filters">
          <div className="search-field search-field-wide">
            <Icon name="Search" size={15} />
            <input
              className="input input-small"
              placeholder="Search messages and countries"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search logs"
            />
          </div>
          <select
            className="select select-small"
            value={category}
            onChange={(event) => setCategory(event.target.value as LogCategory | 'all')}
            aria-label="Filter by category"
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            className="select select-small"
            value={countryId}
            onChange={(event) => setCountryId(event.target.value)}
            aria-label="Filter by country"
          >
            <option value="all">All actors</option>
            <option value="player">Your country</option>
            {game.countries
              .filter((country) => country.status === 'alive' && !country.isPlayer)
              .map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
          </select>
          <select
            className="select select-small"
            value={tone}
            onChange={(event) => setTone(event.target.value as typeof tone)}
            aria-label="Filter by tone"
          >
            <option value="all">All tones</option>
            <option value="positive">Positive</option>
            <option value="negative">Negative</option>
            <option value="neutral">Neutral</option>
          </select>
          <label className="turn-range-field">
            <span>Turn from</span>
            <input
              className="input input-small"
              type="number"
              min={1}
              placeholder="1"
              value={turnFrom}
              onChange={(event) => setTurnFrom(event.target.value)}
              aria-label="Turn from"
            />
          </label>
          <label className="turn-range-field">
            <span>Turn to</span>
            <input
              className="input input-small"
              type="number"
              min={1}
              placeholder={String(game.turn)}
              value={turnTo}
              onChange={(event) => setTurnTo(event.target.value)}
              aria-label="Turn to"
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        className="logs-card"
        title="Dispatch log"
        subtitle={
          visible.length < filtered.length
            ? `Showing the latest ${visible.length} of ${filtered.length} entries.`
            : 'Newest first.'
        }
        action={
          <Badge tone="accent" icon="ListFilter">
            {filtered.length} results
          </Badge>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon="ScrollText"
            title="No dispatches match"
            body="Clear a filter or widen the turn range. Actions are recorded after every turn and decision."
          />
        ) : (
          <div className="log-list">
            {visible.map((entry) => {
              const icon =
                CATEGORIES.find((item) => item.id === entry.category)?.icon ?? 'ScrollText'
              return (
                <article key={entry.id} className={`log-row log-${entry.tone ?? 'neutral'}`}>
                  <div className="log-turn">
                    <span>T{entry.turn}</span>
                    <small>{entry.countryName ?? 'World'}</small>
                  </div>
                  <span className="log-icon">
                    <Icon name={icon} size={17} />
                  </span>
                  <div className="log-copy">
                    <div className="log-meta">
                      <Badge tone={CATEGORY_TONE[entry.category]}>{entry.category}</Badge>
                      {entry.countryName && (
                        <span className="log-country">{entry.countryName}</span>
                      )}
                    </div>
                    <p>{entry.message}</p>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
