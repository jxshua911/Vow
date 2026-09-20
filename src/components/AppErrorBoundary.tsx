import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VOW] Unhandled render error:', error, info);
  }

  handleRetry = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="min-h-screen bg-vow-bg flex items-center justify-center px-6 py-12">
        <section className="w-full max-w-md border border-vow-border p-6 text-center">
          <p className="text-sm font-medium text-vow-ink mb-2">VOW hit an unexpected error</p>
          <p className="text-sm text-vow-muted leading-relaxed mb-5">
            Nothing was intentionally changed. Reload VOW and try again.
          </p>
          <button type="button" onClick={this.handleRetry} className="vow-btn-primary">
            Reload VOW
          </button>
        </section>
      </main>
    );
  }
}
