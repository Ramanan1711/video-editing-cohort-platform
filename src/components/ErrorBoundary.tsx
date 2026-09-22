// src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { ShieldAlert, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';
import { errorTracker } from '../lib/observability/errorTracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    showDetails: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    // Report crash to error tracking engine
    errorTracker.captureException(error, {
      extra: {
        componentStack: errorInfo.componentStack,
      },
      tags: {
        source: 'react_error_boundary',
      },
      handled: true,
    });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  private toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
          <div className="w-full max-w-lg rounded-3xl border border-rose-500/20 bg-slate-900/90 p-8 shadow-2xl backdrop-blur-md text-center">
            <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400">
              <ShieldAlert size={28} />
            </div>

            <h2 className="mt-4 text-xl font-black text-white">Application Encountered a Problem</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              An unexpected user interface exception was caught. Our telemetry engine has recorded the diagnostics.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition"
              >
                <RefreshCw size={14} /> Reload Application
              </button>

              <button
                type="button"
                onClick={this.handleHome}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700 hover:text-white transition"
              >
                <Home size={14} /> Return to Home
              </button>
            </div>

            {/* Diagnostic Details Accordion */}
            <div className="mt-6 border-t border-slate-800 pt-4 text-left">
              <button
                type="button"
                onClick={this.toggleDetails}
                className="flex w-full items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-200"
              >
                <span>Diagnostic Stack Details</span>
                {this.state.showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {this.state.showDetails && (
                <div className="mt-3 max-h-48 overflow-y-auto rounded-xl bg-slate-950 p-3 font-mono text-[10px] text-rose-300 shadow-inner">
                  <p className="font-bold text-rose-400">{this.state.error?.name}: {this.state.error?.message}</p>
                  <pre className="mt-2 whitespace-pre-wrap text-slate-500">
                    {this.state.errorInfo?.componentStack || this.state.error?.stack || 'No stack trace available.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

