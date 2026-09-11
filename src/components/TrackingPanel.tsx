import { Bone, Layers3, ShieldCheck } from 'lucide-react';
import { PanelHeader, MetricTile } from './shared/PanelParts';
import type { AnimalProfile, PoseFrame } from '@/lib/adaptivePose';

export default function TrackingPanel({ profile, latestFrame }: { profile: AnimalProfile | null; latestFrame: PoseFrame | null }) {
  return (
    <section className="panel-section">
      <PanelHeader icon={Bone} title="Adaptive Skeleton" meta="Keypoint tracking" />
      <div className="space-y-2 p-2.5">
        <div className="rounded-lg border border-border/60 bg-muted/10 p-2">
          <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Active model</p>
          <p className="mt-0.5 text-xs font-semibold text-foreground">{profile?.modelName ?? 'Awaiting video'}</p>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <MetricTile icon={Layers3} label="Keypoints" value={latestFrame?.keypoints.length ?? 0} />
          <MetricTile icon={ShieldCheck} label="Quality" value={latestFrame ? Math.round(latestFrame.quality * 100) : 0} suffix="%" />
        </div>

        <div>
          <p className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Body structure</p>
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
