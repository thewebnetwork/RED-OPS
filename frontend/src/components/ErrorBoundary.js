import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0d0d0d', color: '#f0f0f0', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ textAlign: 'center', maxWidth: 420, padding: '0 20px' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 14, background: 'var(--accent-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 24,
            }}>
              ⚠️
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, letterSpacing: '-.03em' }}>
              Something went wrong
            </h1>
            <p style={{ fontSize: 14, color: '#888', marginBottom: 24, lineHeight: 1.5 }}>
              An unexpected error occurred. Try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: '#c92a3e', color: '#fff', fontSize: 13, fontWeight: 600,
              }}
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <pre style={{
                marginTop: 24, padding: 16, background: '#161616', borderRadius: 8,
                fontSize: 11, color: '#ef4444', textAlign: 'left', overflow: 'auto',
                maxHeight: 200, border: '1px solid #2a2a2a',
              }}>
                {this.state.error.toString()}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
