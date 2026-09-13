import { Component, type ErrorInfo, type ReactNode } from 'react';
import { BrandLogo } from './BrandLogo';

type Props = { children: ReactNode };
type State = { hasError: boolean; errorId: string };

export class VowErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorId: '' };

  static getDerivedStateFromError(error: unknown): State {
    const errorId = error instanceof Error && error.name ? error.name : 'runtime';
    return { hasError: true, errorId };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[VOW] Unhandled application error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-vow-bg text-vow-ink flex items-center justify-center px-6 py-10">
        <main className="w-full max-w-md text-center space-y-5" role="alert">
          <BrandLogo className="mx-auto h-10 w-auto" />
          <div className="space-y-2">
            <p className="vow-label">VOW needs a reset</p>
            <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
            <p className="text-sm leading-6 text-vow-muted">
              VOW hit an unexpected problem while loading this screen. Your device is okay — this is an app error, and we have a recovery screen here so you are not left with a blank page.
            </p>
          </div>
          <button type="button" onClick={this.handleReload} className="vow-btn-primary w-full">
            Restart VOW
          </button>
          <p className="text-xs text-vow-muted">Error reference: {this.state.errorId}</p>
        </main>
      </div>
    );
  }
}
