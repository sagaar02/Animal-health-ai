import { AlertTriangle, Brain, Cpu, Eye, Loader2, RefreshCw, ScanLine } from 'lucide-react';

export type ModelLoadState = 'idle' | 'loading' | 'ready' | 'error';

export interface ModelStatus {
  mediapipe: ModelLoadState;
  yolo: ModelLoadState;
  clip: ModelLoadState;
  error?: string;
}

export function LoadingOverlay({ status, onRetry }: { status: ModelStatus; onRetry?: () => void }) {
  const anyLoading = status.mediapipe === 'loading' || status.yolo === 'loading' || status.clip === 'loading';
  const allReady = status.mediapipe === 'ready' && status.yolo === 'ready' && status.clip === 'ready';
  const anyError = status.mediapipe === 'error' || status.yolo === 'error' || status.clip === 'error';

  if (!anyLoading && allReady && !anyError) return null;

  const models: { key: keyof ModelStatus; label: string; icon: typeof Cpu; weight: number }[] = [
    { key: 'mediapipe', label: 'Pose Detector', icon: ScanLine, weight: 0.5 },
    { key: 'yolo', label: 'Animal Localizer', icon: Cpu, weight: 0.3 },
    { key: 'clip', label: 'Vision Anomaly AI', icon: Eye, weight: 0.2 },
  ];

  // Weighted progress: ready = full weight, loading = 0.5 * weight, error/idle = 0
  const totalWeight = models.reduce((s, m) => s + m.weight, 0);
  const progress = Math.min(100, Math.round(
    (models.reduce((s, m) => {
      const state = status[m.key];
      const factor = state === 'ready' ? 1 : state === 'loading' ? 0.5 : 0;
      return s + m.weight * factor;
    }, 0) / totalWeight) * 100
  ));

  const loadedCount = models.filter(m => status[m.key] === 'ready').length;
  const elapsedLabel = status.error ? status.error : '';
  const errorModel = models.find(m => status[m.key] === 'error');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {anyError ? (
              <AlertTriangle className="h-6 w-6" />
            ) : anyLoading ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Brain className="h-6 w-6" />
            )}
          </div>
          <div>
              <h2 className="text-base font-semibold text-foreground">
                {anyError ? 'AI model initialization issue' : anyLoading ? 'Loading AI models…' : 'Preparing workspace'}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {anyError
                  ? (errorModel ? `${errorModel.label} failed: ${elapsedLabel || 'unknown error'}. ` : 'Some models failed to load. ') +
                    'Retry or continue with offline features only.'
                  : anyLoading
                    ? `Loading pose detection, animal localization, and visual analysis (${progress}%).`
                    : 'AI models ready.'}
              </p>
            </div>
        </div>

        <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              anyError ? 'bg-destructive' : anyLoading ? 'bg-primary' : 'bg-success'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="space-y-3 mb-5">
          {models.map(({ key, label, icon: Icon }) => {
            const state = status[key];
            const colorClass =
              state === 'ready'
                ? 'text-success border-success/25 bg-success/10'
                : state === 'loading'
                ? 'text-primary border-primary/25 bg-primary/10'
                : state === 'error'
                ? 'text-destructive border-destructive/25 bg-destructive/10'
                : 'text-muted-foreground border-border bg-muted/30';
            const labelText =
              state === 'ready'
                ? 'Ready'
                : state === 'loading'
                ? 'Initializing…'
                : state === 'error'
                ? 'Failed'
                : 'Waiting';

            return (
              <div key={key} className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-md border ${colorClass}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-foreground">{label}</span>
                    <span className="text-[11px] font-mono text-muted-foreground">{labelText}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        state === 'ready'
                          ? 'bg-success'
                          : state === 'loading'
                          ? 'bg-primary'
                          : state === 'error'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground/30'
                      }`}
                      style={{
                        width:
                          state === 'ready'
                            ? '100%'
                            : state === 'loading'
                            ? '65%'
                            : state === 'error'
                            ? '100%'
                            : '5%',
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground mb-4">
          <span className="font-mono">
            {loadedCount} / {models.length} models
          </span>
          <span className="font-mono font-medium text-foreground">{progress}%</span>
        </div>

        {anyError && onRetry && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex flex-1 h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <RefreshCw className="h-4 w-4" />
              Retry loading models
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
