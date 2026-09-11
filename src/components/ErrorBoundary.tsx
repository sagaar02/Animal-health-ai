import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface State {
  hasError: boolean;
  error: Error | null;
}

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6">
        <div className="w-full max-w-md rounded-lg border border-destructive/20 bg-card p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                {this.props.fallbackTitle ?? 'Something went wrong'}
              </h2>
              <p className="text-xs text-muted-foreground">
                The app hit an unexpected error. You can retry without losing your session.
              </p>
            </div>
          </div>

          {this.state.error && (
            <pre className="mb-4 max-h-40 overflow-auto rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
              {this.state.error.message}
            </pre>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={this.handleReset}
              className="flex-1"
              size="sm"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={this.handleReload}
              className="flex-1"
              size="sm"
            >
              Reload page
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
