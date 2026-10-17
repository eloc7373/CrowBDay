import { Map as MapIcon, Moon, ScrollText, Sun } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { ErrorBoundary } from './ErrorBoundary'
import { ThemeProvider, useTheme } from './theme'

// Each area is its own chunk so the board doesn't load Konva and vice versa.
const MapCreatorPage = lazy(() => import('../mapcreator/MapCreatorPage'))
const BoardPage = lazy(() => import('../board/BoardPage'))

function Nav() {
  const { theme, toggle } = useTheme()
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-1.5 rounded-md px-3 py-1 text-sm font-medium ${
      isActive
        ? 'bg-amber-500 text-zinc-950'
        : 'text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800'
    }`
  return (
    <header className="flex items-center gap-3 border-b border-zinc-200 bg-zinc-100 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950">
      <span className="font-bold tracking-tight text-amber-700 dark:text-amber-400">
        DM Toolkit
      </span>
      <nav aria-label="Main" className="flex gap-1">
        <NavLink to="/map" className={link}>
          <MapIcon size={15} aria-hidden /> Map Creator
        </NavLink>
        <NavLink to="/board" className={link}>
          <ScrollText size={15} aria-hidden /> DM Board
        </NavLink>
      </nav>
      <div className="flex-1" />
      <button
        type="button"
        onClick={toggle}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        className="rounded-md p-1.5 text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {theme === 'dark' ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      </button>
    </header>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      {/* Hash routing so the static build works from any folder with no server rewrites. */}
      <HashRouter>
        <div className="flex h-screen flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
          <Nav />
          <div className="min-h-0 flex-1">
            <Suspense fallback={<p className="p-6 text-sm text-zinc-500">Loading…</p>}>
              <Routes>
                <Route
                  path="/map"
                  element={
                    <ErrorBoundary name="Map Creator">
                      <MapCreatorPage />
                    </ErrorBoundary>
                  }
                />
                <Route
                  path="/board"
                  element={
                    <ErrorBoundary name="DM Board">
                      <BoardPage />
                    </ErrorBoundary>
                  }
                />
                <Route path="*" element={<Navigate to="/map" replace />} />
              </Routes>
            </Suspense>
          </div>
        </div>
      </HashRouter>
    </ThemeProvider>
  )
}
