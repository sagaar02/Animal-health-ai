import { Layers3, ShieldCheck } from 'lucide-react';
import { PanelHeader, MetricTile } from './shared/PanelParts';
import type { AnimalProfile, TemporalMetrics } from '@/lib/adaptivePose';
import type { AIHealthScores } from '@/components/AIAnalysisPanel';

export default function BCSPanel({ profile, metrics, aiScores }: { profile: AnimalProfile | null; metrics: TemporalMetrics; aiScores?: AIHealthScores }) {
  const bcs = aiScores?.bodyConditionScore ?? Math.round(metrics.confidence * 100 / 11); // estimate from confidence
  const vetNotes = aiScores?.vetNotes ?? '';

  return (
    <section className="panel-section">
      <PanelHeader icon={Layers3} title="Body Condition" meta="9-point BCS" />
      <div className="space-y-2 p-2.5">
        <div className="rounded-lg border border-border/60 bg-background/50 p-2.5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">BCS</p>
              <p className="mt-0.5 font-mono text-3xl font-bold text-primary">
                {bcs}<span className="text-base font-normal text-muted-foreground">/9</span>
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-base font-semibold text-foreground">{Math.round(metrics.confidence * 100)}%</p>
              <p className="text-[10px] text-muted-foreground">confidence</p>
            </div>
          </div>
        </div>

        <MetricTile icon={ShieldCheck} label="Vet Notes" value={vetNotes ? 'Entered' : '—'} suffix="" />

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Structure</p>
          <div className="flex flex-wrap gap-1">
            {(profile?.bodyStructure ?? ['Head', 'Body axis', 'Support points']).map(part => (
              <span key={part} className="rounded-md border border-border/60 bg-background/50 px-1.5 py-0.5 text-[10px] text-foreground">
                {part}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}