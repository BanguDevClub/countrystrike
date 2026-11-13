import { useEffect, useRef, useState } from 'react'
import { GITHUB_URL, PAGES, THEMES } from '../game/constants'
import type { PageId } from '../game/types'
import { useGame } from '../state/gameStore'
import { usePrefs } from '../state/prefsStore'
import { playSfx, unlockAudio } from '../game/audio'
import { formatMoney } from '../game/format'
import { selectPlayer } from '../state/gameStore'
import { Icon } from './Icon'
import { Flag } from './Flag'

function Brand({ onClick }: { onClick?: () => void }) {
  const content = (
    <>
      <span className="brand-mark">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <defs>
            <linearGradient id="brand-gradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="var(--accent)" />
              <stop offset="100%" stopColor="var(--accent-2)" />
            </linearGradient>
          </defs>
          <circle
            cx="24"
            cy="24"
            r="16"
            fill="none"
            stroke="url(#brand-gradient)"
            strokeWidth="2.4"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="7"
            ry="16"
            fill="none"
            stroke="url(#brand-gradient)"
            strokeWidth="1.5"
            opacity=".7"
          />
          <path
            d="M8 24h32"
            fill="none"
            stroke="url(#brand-gradient)"
            strokeWidth="1.5"
            opacity=".7"
          />
          <path
            d="M11 16h26M11 32h26"
            fill="none"
            stroke="url(#brand-gradient)"
            strokeWidth="1"
            opacity=".4"
          />
          <circle cx="35" cy="12" r="3.2" fill="var(--accent-2)" />
        </svg>
      </span>
      <span className="brand-copy">
        <span className="brand-name">Country Strike</span>
        <span className="brand-tagline">Ten actions. One world.</span>
      </span>
    </>
  )
  if (!onClick) return <div className="brand">{content}</div>
  return (
    <button
      type="button"
      className="brand brand-button"
      onClick={onClick}
      aria-label="Open world map"
    >
      {content}
    </button>
  )
}

function ThemeMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { theme, setTheme } = usePrefs()

  useEffect(() => {
    if (!open) return
    const handlePointer = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div className="theme-menu" ref={ref}>
      <button
        type="button"
        className="icon-btn"
        onClick={() => setOpen((value) => !value)}
        aria-label="Change theme"
        aria-expanded={open}
        title="Theme"
      >
        <Icon name="Palette" size={17} />
      </button>
      {open && (
        <div className="menu-popover theme-popover">
          <div className="menu-heading">
            <span>Appearance</span>
            <small>6 themes</small>
          </div>
          {THEMES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`theme-option ${entry.id === theme ? 'is-active' : ''}`}
              onClick={() => {
                setTheme(entry.id)
                setOpen(false)
              }}
            >
              <span
                className="theme-option-swatch"
                style={{
                  background: `linear-gradient(135deg, ${entry.swatch} 0 48%, ${entry.bg} 48% 100%)`,
                }}
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{entry.family}</small>
              </span>
              {entry.id === theme && <Icon name="Check" size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function SiteHeader() {
  const game = useGame((state) => state.game)
  const page = useGame((state) => state.page)
  const modal = useGame((state) => state.modal)
  const setPage = useGame((state) => state.setPage)
  const endTurn = useGame((state) => state.endTurn)
  const openNewGame = useGame((state) => state.openNewGame)
  const player = useGame(selectPlayer)
  const openTurnBriefing = useGame((state) => state.openTurnBriefing)
  const { sound, music, setSound, setMusic } = usePrefs()

  const endTurnDisabled = Boolean(
    !game ||
    game.status !== 'playing' ||
    game.eventQueue.length > 0 ||
    modal ||
    game.actionsLeft < 0,
  )

  const handleEndTurn = () => {
    playSfx('turn')
    endTurn()
  }

  const goTo = (next: PageId) => {
    playSfx('click')
    setPage(next)
  }

  return (
    <header className="site-header">
      <div className="container header-main">
        <Brand onClick={game ? () => goTo('map') : undefined} />
        {game && player ? (
          <div className="header-status">
            <div className="turn-cluster">
              <span className="turn-chip">
                Turn <strong>{game.turn}</strong>
              </span>
              <div className="action-meter" aria-label={`${game.actionsLeft} of 10 actions left`}>
                {Array.from({ length: 10 }).map((_, index) => (
                  <span
                    key={index}
                    className={`action-pip ${index < game.actionsLeft ? 'is-filled' : ''}`}
                  />
                ))}
              </div>
              <span className="action-count">{game.actionsLeft}/10</span>
            </div>
            <div className="header-treasury" title="Treasury">
              <span className="flag-mini">
                <Flag seed={player.flagSeed} size="sm" code={player.code} />
              </span>
              <span>{formatMoney(player.stats.treasury)}</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-sm header-cabinet-btn"
              onClick={() => openTurnBriefing()}
              title="Open Cabinet & Turn Briefing"
            >
              <Icon name="Landmark" size={14} />
              Cabinet
            </button>
            <button
              type="button"
              className="btn btn-primary btn-end-turn"
              onClick={handleEndTurn}
              disabled={endTurnDisabled}
              title={
                game.eventQueue.length > 0
                  ? 'Resolve the event first'
                  : modal
                    ? 'Close the open brief first'
                    : 'End turn'
              }
            >
              End turn
              <Icon name="ArrowRight" size={16} />
            </button>
          </div>
        ) : (
          <div className="header-status header-status-landing">
            <span className="landing-chip">
              <span className="live-dot" /> A world simulator
            </span>
          </div>
        )}
        <div className="header-actions">
          <button
            type="button"
            className={`icon-btn ${sound ? 'is-active-soft' : ''}`}
            onClick={() => {
              unlockAudio()
              setSound(!sound)
            }}
            aria-label={sound ? 'Disable sound effects' : 'Enable sound effects'}
            aria-pressed={sound}
            title={sound ? 'Sound effects on' : 'Sound effects off'}
          >
            <Icon name={sound ? 'Volume2' : 'VolumeX'} size={17} />
          </button>
          <button
            type="button"
            className={`icon-btn ${music ? 'is-active-soft' : ''}`}
            onClick={() => setMusic(!music)}
            aria-label={music ? 'Disable background music' : 'Enable background music'}
            aria-pressed={music}
            title={music ? 'Music on' : 'Music off'}
          >
            <Icon name="AudioLines" size={17} />
          </button>
          <ThemeMenu />
          {game && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => {
                playSfx('click')
                openNewGame()
              }}
              aria-label="New game"
              title="New game"
            >
              <Icon name="RotateCcw" size={17} />
            </button>
          )}
          <a
            className="icon-btn hide-sm"
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="Country Strike on GitHub"
            title="Source on GitHub"
          >
            <Icon name="ExternalLink" size={17} />
          </a>
        </div>
      </div>
      {game && (
        <nav className="container nav-tabs" aria-label="Game sections">
          {PAGES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`tab ${page === entry.id ? 'is-active' : ''}`}
              onClick={() => goTo(entry.id)}
              aria-current={page === entry.id ? 'page' : undefined}
              title={entry.label}
            >
              <Icon name={entry.icon} size={16} />
              <span className="tab-label-full">{entry.label}</span>
              <span className="tab-label-short">{entry.short}</span>
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}

export function SiteFooter() {
  const game = useGame((state) => state.game)
  const setPage = useGame((state) => state.setPage)
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <span className="footer-mark">
            <Icon name="Globe" size={16} />
          </span>
          <span>
            <strong>Country Strike</strong>
            <small>Ten actions. One country. A world to win.</small>
          </span>
        </div>
        <div className="footer-links">
          {game && (
            <button type="button" className="footer-link" onClick={() => setPage('methodology')}>
              Methodology
            </button>
          )}
          <a className="footer-link" href={GITHUB_URL} target="_blank" rel="noreferrer">
            GitHub <Icon name="ExternalLink" size={12} />
          </a>
          <span className="footer-separator" />
          <span className="footer-note">
            <span className="live-dot" /> Autosaved locally
          </span>
          <span className="footer-copy">© {new Date().getFullYear()} BanguDevClub</span>
        </div>
      </div>
    </footer>
  )
}
