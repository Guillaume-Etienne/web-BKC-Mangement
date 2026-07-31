import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches a page that fails to render — in practice, a code-split chunk that
 *  will not download.
 *
 *  The usual cause is a deploy: the browser is holding an index.html that names
 *  chunks Vercel has already replaced, so the request 404s. Without a boundary
 *  React unmounts the whole tree and the centre gets a white screen with no clue
 *  what to do. A reload fetches the new index.html and fixes it, so that is what
 *  this offers.
 *
 *  Deliberately a class: error boundaries have no hook equivalent. */
export default class ChunkBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('Page failed to load:', error)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <p className="text-4xl">🌬️</p>
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-200">This page didn't load</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Usually a new version was just deployed, or the connection dropped mid-load.
            Reloading picks up the latest version.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm"
          >
            Reload
          </button>
          <p className="text-xs text-gray-400 dark:text-gray-500 break-words">{this.state.error.message}</p>
        </div>
      </div>
    )
  }
}
