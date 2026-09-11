import { Activity } from 'lucide-react';
import { PanelHeader, ScoreBar } from './shared/PanelParts';
import type { TemporalMetrics } from '@/lib/adaptivePose';

const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function HealthPanel({ metrics }: { metrics: TemporalMetrics }) {
  const scoreTone = metrics.overallHealth >= 80 ? 'text-success' : metrics.overallHealth >= 60 ? 'text-warning' : 'text-destructive';

  return (
    <section className="panel-section">
      <PanelHeader icon={Activity} title="Health Summary" meta="Motion-derived diagnostics" />
      <div className="space-y-2 p-2.5">
        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
          <div className="flex items-end justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Overall score</p>
              <p className={`mt-0.5 font-mono text-3xl font-bold ${scoreTone}`}>
                {scoreFormatter.format(metrics.overallHealth)}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-semibold text-foreground">{Math.round(metrics.confidence * 100)}%</p>
              <p className="text-[10px] text-muted-foreground">confidence</p>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <ScoreBar label="Gait symmetry" value={metrics.symmetry} />
          <ScoreBar label="Stride rhythm" value={metrics.strideRhythm} />
          <ScoreBar label="Stride consistency" value={metrics.strideConsistency} />
          <ScoreBar label="Posture balance" value={metrics.postureBalance} />
          <ScoreBar label="Lameness risk" value={metrics.lamenessRisk} invert />
          <ScoreBar label="Instability risk" value={metrics.instabilityRisk} invert />
        </div>
      </div>
    </section>
  );
}
