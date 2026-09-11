/**
 * Catches a render error in any view so one bad screen does not take the whole
 * dashboard white. An operator getting a blank page mid-shift has no way to tell
 * whether the plant is fine and the UI broke, or the other way round, so this
 * says which it is.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // No error reporting service is wired up, so the console is the only record.
    console.error('[dashboard] render failed', error, info.componentStack);
  }

  private handleReset = (): void => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen bg-[#f7f9fc] flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-xl border border-[#e0e3e6] shadow-[0px_4px_20px_rgba(30,42,94,0.04)] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#BA1A1A]/10 text-[#BA1A1A] flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold text-[#061449]">This screen failed to load</h1>
          </div>

          <p className="text-xs text-[#45464f] leading-relaxed">
            Something in the dashboard threw an error while rendering. This is a fault in
            the interface, not a reading from your plant. Nothing has been sent anywhere
            and no setting has been changed.
          </p>

          <pre className="text-[11px] font-mono text-[#BA1A1A] bg-[#BA1A1A]/5 border border-[#BA1A1A]/20 rounded-lg p-3 whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#0f6e8c] hover:bg-[#0b5670] text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 border border-[#c6c5d1] text-[#45464f] hover:bg-[#eceef1] rounded-lg text-xs font-bold transition-colors cursor-pointer"
            >
              Reload the page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
