import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    // log if you like:   Sentry.captureException(error, { extra: errorInfo });
    console.error('PDF render failed:', error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback || <span style={{ color: 'red' }}>PDF gagal.</span>;
    }
    return this.props.children;
  }
}
