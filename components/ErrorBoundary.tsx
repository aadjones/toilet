'use client';

import React, { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary to catch Three.js/WebGL errors and prevent white screen.
 * Particularly important for:
 * - GPU driver crashes
 * - WebGL context limit exceeded (50+ tabs)
 * - Safari on old iPhones
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 flex items-center justify-center bg-[#2a2a2a] text-white p-6">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-bold mb-4">3D Rendering Unavailable</h1>
            <p className="text-[#aaa] text-sm mb-6">
              The 3D view couldn't load. This might happen if your device doesn't support WebGL or if you have too many tabs open.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#555] hover:bg-[#666] rounded text-sm transition-colors"
            >
              Reload Page
            </button>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-xs text-[#666] cursor-pointer hover:text-[#888]">
                  Technical details
                </summary>
                <pre className="mt-2 text-[10px] text-[#888] overflow-auto bg-black/30 p-2 rounded">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
