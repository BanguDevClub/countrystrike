import { lazy, Suspense, useEffect } from 'react'
import { PAGES } from './game/constants'
import type { PageId } from './game/types'
import { useGame } from './state/gameStore'
import { usePrefs } from './state/prefsStore'
import { unlockAudio } from './game/audio'
import { SiteFooter, SiteHeader } from './components/Layout'
import { ModalHost, Toaster } from './components/modals'
import { Icon } from './components/Icon'
const StartMenu = lazy(() =>
  import('./pages/StartMenu').then((module) => ({ default: module.StartMenu })),
)
const WorldMap = lazy(() =>
  import('./pages/WorldMap').then((module) => ({ default: module.WorldMap })),
)
const Budget = lazy(() => import('./pages/Budget').then((module) => ({ default: module.Budget })))
const Governance = lazy(() =>
  import('./pages/Governance').then((module) => ({ default: module.Governance })),
)
const Industry = lazy(() =>
  import('./pages/Industry').then((module) => ({ default: module.Industry })),
)
const Military = lazy(() =>
  import('./pages/Military').then((module) => ({ default: module.Military })),
)
const Trade = lazy(() => import('./pages/Trade').then((module) => ({ default: module.Trade })))
const Ranking = lazy(() =>
  import('./pages/Ranking').then((module) => ({ default: module.Ranking })),
)
const Logs = lazy(() => import('./pages/Logs').then((module) => ({ default: module.Logs })))
const Methodology = lazy(() =>
  import('./pages/Methodology').then((module) => ({ default: module.Methodology })),
)

function PageLoading() {
  return (
    <div className="page-container container">
      <div className="page-loader">
        <span className="page-loader-mark">
          <Icon name="Globe" size={22} />
        </span>
        <span>Opening the situation room…</span>
      </div>
    </div>
  )
}

function isPageId(value: string): value is PageId {
  return PAGES.some((page) => page.id === value)
}

function VictoryBanner() {
  const openNewGame = useGame((state) => state.openNewGame)
  return (
    <div className="victory-banner">
      <span className="victory-icon">
        <Icon name="Trophy" size={24} />
      </span>
      <div className="victory-copy">
        <strong>The world is united.</strong>
        <span>
          Every rival nation is merged or destroyed. Open the Global Ranking to see the final order.
        </span>
      </div>
      <button type="button" className="btn" onClick={openNewGame}>
        <Icon name="RotateCcw" size={16} /> Draw a new world
      </button>
    </div>
  )
}

function GameView() {
  const page = useGame((state) => state.page)
  const status = useGame((state) => state.game?.status ?? 'menu')

  return (
    <div className="page-container container">
      {status === 'won' && <VictoryBanner />}
      {page === 'map' && <WorldMap />}
      {page === 'budget' && <Budget />}
      {page === 'governance' && <Governance />}
      {page === 'industry' && <Industry />}
      {page === 'military' && <Military />}
      {page === 'trade' && <Trade />}
      {page === 'ranking' && <Ranking />}
      {page === 'logs' && <Logs />}
      {page === 'methodology' && <Methodology />}
    </div>
  )
}

export default function App() {
  const game = useGame((state) => state.game)
  const page = useGame((state) => state.page)
  const theme = usePrefs((state) => state.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    if (!game) return
    const hashPage = window.location.hash.replace(/^#\/?/, '')
    if (hashPage && isPageId(hashPage) && hashPage !== page) {
      useGame.getState().setPage(hashPage)
    }
    // Run only when the game becomes available or changes identity, not on every page change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(game)])

  useEffect(() => {
    if (!game) return
    const target = `#/${page}`
    if (window.location.hash !== target) {
      window.history.replaceState(null, '', target)
    }
  }, [page, game])

  return (
    <div className="app">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content" className="site-main">
        {game ? (
          <Suspense fallback={<PageLoading />}>
            <GameView />
          </Suspense>
        ) : (
          <Suspense fallback={<PageLoading />}>
            <StartMenu />
          </Suspense>
        )}
      </main>
      <SiteFooter />
      <ModalHost />
      <Toaster />
    </div>
  )
}
