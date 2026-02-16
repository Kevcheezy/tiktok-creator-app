'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="rounded-xl border border-magenta/20 bg-magenta/5 p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-surface-raised">
            <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6 text-magenta" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7v6" />
              <circle cx="12" cy="16" r="0.5" fill="currentColor" />
            </svg>
          </div>
          <p className="mt-4 font-[family-name:var(--font-display)] text-sm font-medium text-text-primary">
            Something went wrong
          </p>
          {this.state.error?.message && (
            <p className="mt-1 font-[family-name:var(--font-mono)] text-xs text-text-muted">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 rounded-lg border border-electric/30 bg-electric/10 px-4 py-2 font-[family-name:var(--font-display)] text-sm font-medium text-electric transition-colors hover:bg-electric/20"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
