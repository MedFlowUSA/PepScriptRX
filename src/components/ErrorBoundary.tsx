import { Component, type ErrorInfo, type ReactNode } from 'react';

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('Unhandled app render error', error, info);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#f6fbfd' }}>
          <div style={{ maxWidth: 520, border: '1px solid rgba(7,21,36,.14)', borderRadius: 8, padding: 28, background: '#fff', boxShadow: '0 18px 45px rgba(7,21,36,.08)' }}>
            <h1 style={{ margin: '0 0 10px', color: '#071524', fontSize: 26 }}>Something went wrong</h1>
            <p style={{ margin: '0 0 18px', color: '#486174', lineHeight: 1.6 }}>
              The page could not finish loading. Please refresh and try again.
            </p>
            <button className="btn btn-primary" type="button" onClick={() => window.location.reload()}>
              Refresh page
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
