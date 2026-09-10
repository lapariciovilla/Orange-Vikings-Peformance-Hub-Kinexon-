import React, { ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
  onBackToProfiles?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.handleRetry = this.handleRetry.bind(this);
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unexpected error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  public handleRetry() {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-4xl mx-auto my-8 bg-zinc-900 border-2 border-rose-500/50 rounded-2xl shadow-2xl text-zinc-100">
          <div className="flex items-center space-x-3 border-b border-zinc-800 pb-4 mb-4">
            <div className="p-3 bg-rose-950/80 border border-rose-800 rounded-xl text-rose-400">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">
                {this.props.fallbackTitle || 'Unable to load this player profile'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                {this.props.fallbackDescription || 'A rendering error occurred in this view. The rest of the application remains fully operational.'}
              </p>
            </div>
          </div>

          <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 text-xs font-mono text-rose-300 space-y-2 mb-6 overflow-x-auto max-h-48">
            <div className="font-extrabold text-orange-400 uppercase font-sans text-[10px]">Diagnostic Technical Log:</div>
            <div>{this.state.error?.toString() || 'Unknown Runtime Exception'}</div>
            {this.state.errorInfo?.componentStack && (
              <pre className="text-[10px] text-zinc-500 whitespace-pre-wrap">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={this.handleRetry}
              className="px-4 py-2.5 bg-orange-600 hover:bg-orange-500 text-zinc-950 font-black rounded-lg text-xs flex items-center space-x-2 transition-all shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Retry / Reload View</span>
            </button>

            {this.props.onBackToProfiles && (
              <button
                onClick={() => {
                  this.handleRetry();
                  this.props.onBackToProfiles?.();
                }}
                className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg text-xs flex items-center space-x-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Player Profiles</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
