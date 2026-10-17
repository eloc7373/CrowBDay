import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  name: string
  children: ReactNode
}

/** Contains a crash to one panel so the rest of the app keeps working. */
export class ErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[${this.props.name}] crashed`, error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="m-4 rounded-lg border border-red-400 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-100"
      >
        <p className="font-semibold">{this.props.name} hit an error.</p>
        <pre className="mt-2 text-xs whitespace-pre-wrap">{this.state.error.message}</pre>
        <button
          type="button"
          className="mt-3 rounded border border-red-400 px-2 py-1"
          onClick={() => this.setState({ error: null })}
        >
          Try again
        </button>
      </div>
    )
  }
}
