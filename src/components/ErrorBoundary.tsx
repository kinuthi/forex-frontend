import React from 'react';

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: any }
> {
  state = { hasError: false, error: undefined as any };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      const msg =
        typeof this.state.error?.message === 'string'
          ? this.state.error.message
          : String(this.state.error ?? 'Unknown error');

      return (
        <div
          style={{
            minHeight: '60vh',
            padding: 20,
            background: '#0a0a0a',
            color: '#ff4466',
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            letterSpacing: 1,
            whiteSpace: 'pre-wrap',
          }}
        >
          UI crashed while rendering this route.
          {'\n\n'}
          {msg}
          {'\n\n'}
          Open DevTools Console for full stack trace.
        </div>
      );
    }

    return this.props.children;
  }
}
