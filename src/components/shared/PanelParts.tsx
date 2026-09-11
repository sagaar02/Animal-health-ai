import type { ChangeEvent, ElementType } from 'react';

const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export function PanelHeader({
  icon: Icon,
  title,
  meta,
}: {
  icon: ElementType;
  title: string;
  meta?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-xs font-semibold text-foreground">{title}</h2>
          {meta && <p className="truncate text-[10px] text-muted-foreground leading-tight">{meta}</p>}
        </div>
      </div>
    </div>
  );
}

export function ScoreBar({ label, value, invert = false }: { label: string; value: number; invert?: boolean }) {
  const displayValue = invert ? 100 - value : value;
  const colorClass = displayValue >= 80 ? 'bg-success' : displayValue >= 60 ? 'bg-warning' : 'bg-destructive';

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium text-foreground">{scoreFormatter.format(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted/60">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${colorClass}`}
          style={{ width: `${Math.max(0, Math.min(100, displayValue))}%` }}
        />
      </div>
    </div>
  );
}

export function MetricTile({
  icon: Icon,
  label,
  value,
  suffix,
}: {
  icon: ElementType;
  label: string;
  value: string | number;
  suffix?: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-2 transition-colors hover:bg-muted/30">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Icon className="h-3 w-3" />
        <span>{label}</span>
      </div>
      <div className="font-mono text-lg font-semibold text-foreground leading-tight">
        {value}
        {suffix && <span className="ml-1 text-[10px] font-normal text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'active' | 'watch' }) {
  const toneClass = {
    neutral: 'border-border/60 bg-muted/40 text-muted-foreground',
    active: 'border-success/20 bg-success/8 text-success',
    watch: 'border-warning/20 bg-warning/8 text-warning',
  }[tone];

  return (
    <span className={`inline-flex h-5 items-center rounded-md border px-1.5 text-[10px] font-medium ${toneClass}`}>
      {tone === 'active' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
      {tone === 'watch' && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-warning" />}
      {label}
    </span>
  );
}

export function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '--';
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remaining}`;
}

export type UploadPanelProps = {
  fileName: string;
  videoUrl: string | null;
  profile: import('@/lib/adaptivePose').AnimalProfile | null;
  videoInfo: { width: number; height: number; duration: number } | null;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onSpeciesOverride?: (species: string) => void;
};
