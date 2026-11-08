import { useState } from 'react'
import { DEFAULT_SETTINGS, DIFFICULTIES, GITHUB_URL, THEMES } from '../game/constants'
import type { Difficulty, ThemeId } from '../game/types'
import { useGame } from '../state/gameStore'
import { usePrefs } from '../state/prefsStore'
import { playSfx } from '../game/audio'
import { Icon } from '../components/Icon'
import { Toggle } from '../components/ui'

function WorldPreview() {
  return (
    <div className="world-preview" aria-hidden="true">
      <svg viewBox="0 0 560 470" className="world-preview-svg">
        <defs>
          <radialGradient id="preview-globe" cx="36%" cy="28%" r="80%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="55%" stopColor="var(--surface-3)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--surface)" />
          </radialGradient>
          <linearGradient id="preview-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent-2)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.24" />
          </linearGradient>
          <linearGradient id="preview-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
            <stop offset="50%" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--accent-2)" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        <circle
          cx="280"
          cy="235"
          r="174"
          fill="url(#preview-globe)"
          stroke="var(--border-strong)"
        />
        <circle
          cx="280"
          cy="235"
          r="174"
          fill="none"
          stroke="var(--border)"
          strokeDasharray="1 7"
        />
        <ellipse
          cx="280"
          cy="235"
          rx="174"
          ry="66"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.18"
        />
        <ellipse
          cx="280"
          cy="235"
          rx="88"
          ry="174"
          fill="none"
          stroke="var(--accent)"
          strokeOpacity="0.14"
        />
        <path
          d="M132 190c18-36 54-58 88-48 24 7 25 30 54 27 30-3 42-33 75-21 25 9 29 36 20 61-9 26-31 31-44 56-12 24-6 49-30 61-19 10-37 1-58-1-24-2-42 12-66 5-29-8-31-36-33-60-2-21-20-37-6-80Z"
          fill="url(#preview-land)"
          stroke="var(--accent)"
          strokeOpacity="0.32"
        />
        <path
          d="M169 328c13-18 36-18 49-8 12 10 11 28 1 39-9 10-27 13-40 5-12-8-19-24-10-36Z"
          fill="var(--accent-2)"
          fillOpacity="0.28"
          stroke="var(--accent-2)"
          strokeOpacity="0.35"
        />
        <path
          d="M330 117c21-16 55-9 65 12 8 17-1 36-19 43-20 8-45-3-51-21-5-14 0-26 5-34Z"
          fill="var(--accent)"
          fillOpacity="0.2"
          stroke="var(--accent)"
          strokeOpacity="0.3"
        />
        {[
          [202, 210],
          [361, 178],
          [253, 328],
          [424, 283],
          [343, 345],
          [189, 136],
        ].map(([x, y], index) => (
          <g
            key={`${x}-${y}`}
            className="preview-pin"
            style={{ animationDelay: `${index * 0.4}s` }}
          >
            <circle cx={x} cy={y} r="9" fill="var(--accent)" fillOpacity="0.15" />
            <circle
              cx={x}
              cy={y}
              r="3.5"
              fill={index === 3 ? 'var(--accent-2)' : 'var(--accent)'}
            />
          </g>
        ))}
        <path
          d="M192 228 C 250 110, 340 100, 381 178 S 430 302, 342 342"
          fill="none"
          stroke="url(#preview-arc)"
          strokeWidth="1.4"
          strokeDasharray="4 7"
          className="preview-route"
        />
        <path
          d="M228 350 C 270 270, 320 250, 424 283"
          fill="none"
          stroke="var(--accent-2)"
          strokeOpacity="0.22"
          strokeWidth="1.2"
          strokeDasharray="2 6"
        />
        <circle
          cx="280"
          cy="235"
          r="228"
          fill="none"
          stroke="var(--border)"
          strokeDasharray="1 10"
        />
        <circle
          cx="280"
          cy="235"
          r="242"
          fill="none"
          stroke="var(--border)"
          strokeOpacity="0.6"
          strokeDasharray="1 18"
        />
      </svg>
      <div className="preview-chip preview-chip-top">
        <span className="live-dot" />
        <span>World online</span>
      </div>
      <div className="preview-chip preview-chip-bottom">
        <span>10 actions</span>
        <span className="divider" />
        <span>1 turn</span>
        <span className="divider" />
        <span>1 world</span>
      </div>
    </div>
  )
}

export function StartMenu() {
  const startGame = useGame((state) => state.startGame)
  const { sound, music, theme, setSound, setMusic, setTheme } = usePrefs()
  const [countries, setCountries] = useState(DEFAULT_SETTINGS.countries)
  const [continents, setContinents] = useState(DEFAULT_SETTINGS.continents)
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_SETTINGS.difficulty)

  const handleStart = () => {
    playSfx('turn')
    startGame({ sound, music, countries, continents, difficulty })
  }

  return (
    <div className="start-shell">
      <section className="hero">
        <div className="hero-eyebrow">
          <span className="eyebrow-line" />
          Turn-based geopolitical strategy
        </div>
        <h1 className="hero-title">
          Country
          <br />
          <span>Strike</span>
        </h1>
        <p className="hero-lede">
          Run a nation. Balance a budget, feed an industry, keep a cabinet honest, and turn goodwill
          into a borderless world. Ten actions per turn. Every choice leaves a mark.
        </p>
        <div className="hero-tags">
          <span>
            <Icon name="Dices" size={14} /> Dice-driven decisions
          </span>
          <span>
            <Icon name="Factory" size={14} /> 8 living resources
          </span>
          <span>
            <Icon name="Globe" size={14} /> Procedural world
          </span>
          <span>
            <Icon name="Handshake" size={14} /> Merge or destroy
          </span>
        </div>
        <WorldPreview />
        <div className="hero-footer-note">
          <span className="live-dot" />
          Local-first. Autosaves in this browser.
          <a href={GITHUB_URL} target="_blank" rel="noreferrer">
            Source on GitHub <Icon name="ExternalLink" size={13} />
          </a>
        </div>
      </section>

      <section className="setup-card card">
        <div className="setup-head">
          <div>
            <span className="setup-kicker">New world</span>
            <h2>Set the board</h2>
            <p>
              Randomly generated continents, cultures, biomes and weather. Each trait shapes the
              economy.
            </p>
          </div>
          <span className="setup-mark">
            <Icon name="Globe" size={24} />
          </span>
        </div>

        <div className="setup-section">
          <div className="setup-label">
            <span>Number of countries</span>
            <strong>{countries}</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={10}
            max={20}
            step={1}
            value={countries}
            onChange={(event) => setCountries(Number(event.target.value))}
            style={{ '--fill': `${((countries - 10) / 10) * 100}%` } as React.CSSProperties}
            aria-label="Number of countries"
          />
          <div className="range-scale">
            <span>10</span>
            <span>20</span>
          </div>
        </div>

        <div className="setup-section">
          <div className="setup-label">
            <span>Number of continents</span>
            <strong>{continents}</strong>
          </div>
          <input
            className="slider"
            type="range"
            min={1}
            max={5}
            step={1}
            value={continents}
            onChange={(event) => setContinents(Number(event.target.value))}
            style={{ '--fill': `${((continents - 1) / 4) * 100}%` } as React.CSSProperties}
            aria-label="Number of continents"
          />
          <div className="range-scale">
            <span>1</span>
            <span>5</span>
          </div>
        </div>

        <div className="setup-section">
          <div className="setup-label">
            <span>Difficulty</span>
            <strong className="setup-difficulty-name">
              {DIFFICULTIES.find((entry) => entry.id === difficulty)?.name}
            </strong>
          </div>
          <div className="difficulty-grid">
            {DIFFICULTIES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`difficulty-card ${difficulty === entry.id ? 'is-active' : ''}`}
                onClick={() => {
                  setDifficulty(entry.id)
                  playSfx('click')
                }}
                aria-pressed={difficulty === entry.id}
              >
                <span className="difficulty-icon">
                  <Icon name={entry.icon} size={18} />
                </span>
                <span className="difficulty-name">{entry.name}</span>
                <span className="difficulty-tagline">{entry.tagline}</span>
              </button>
            ))}
          </div>
          <p className="difficulty-description">
            {DIFFICULTIES.find((entry) => entry.id === difficulty)?.description}
          </p>
        </div>

        <div className="setup-section setup-audio">
          <Toggle
            checked={sound}
            onChange={(next) => setSound(next)}
            label="Sound effects"
            description="Dice, coins and cabinet doors."
          />
          <Toggle
            checked={music}
            onChange={(next) => setMusic(next)}
            label="Background music"
            description="A quiet generative pulse for the situation room."
          />
        </div>

        <div className="setup-section">
          <div className="theme-strip-label">
            <span>Theme</span>
            <span className="theme-strip-current">
              {THEMES.find((entry) => entry.id === theme)?.name}
            </span>
          </div>
          <div className="theme-strip">
            {THEMES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`theme-swatch ${theme === entry.id ? 'is-active' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${entry.swatch} 0 48%, ${entry.bg} 48% 100%)`,
                }}
                onClick={() => setTheme(entry.id as ThemeId)}
                aria-label={`Use ${entry.name} theme`}
                aria-pressed={theme === entry.id}
                title={`${entry.name} · ${entry.family}`}
              />
            ))}
          </div>
        </div>

        <button type="button" className="btn btn-primary btn-start" onClick={handleStart}>
          Draw the world
          <Icon name="ArrowRight" size={18} />
        </button>
        <p className="setup-note">
          <Icon name="Info" size={13} />A world is generated once and saved locally. You can start
          over from the header at any time.
        </p>
      </section>
    </div>
  )
}
