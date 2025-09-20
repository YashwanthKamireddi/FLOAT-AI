import type { ReactNode } from "react";
import { Component } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallback?: ReactNode;
  title?: string;
  description?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
    error: undefined,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
  console.error("FloatAI UI error boundary caught an error", error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const title = this.props.title ?? "Interface hiccup";
      const description =
        this.props.description ??
        "Something in the chat module crashed. You can reset the panel or refresh the page.";

      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-4 rounded-[32px] border border-white/20 bg-white/80 p-8 text-center text-slate-700 shadow-[0_35px_70px_-45px_rgba(15,23,42,0.5)] backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-200">
          <div className="space-y-2">
            <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
            <p className="text-sm text-subtle">{description}</p>
            {this.state.error?.message && (
              <p className="text-xs text-slate-500 dark:text-slate-400">{this.state.error.message}</p>
            )}
          </div>
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-white shadow-lg shadow-slate-900/30 transition hover:-translate-y-0.5 dark:bg-white/85 dark:text-slate-900"
          >
            Reset interface
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
