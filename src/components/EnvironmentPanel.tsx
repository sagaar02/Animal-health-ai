import { CheckCircle2, Trees, XCircle } from 'lucide-react';
import { PanelHeader } from './shared/PanelParts';
import type { AnimalProfile } from '@/lib/adaptivePose';

export default function EnvironmentPanel({ profile }: { profile: AnimalProfile | null }) {
  if (!profile) return null;

  return (
    <section className="panel-section">
      <PanelHeader icon={Trees} title="Environmental Needs" meta="Species-specific habitat guidelines" />
      <div className="grid grid-cols-2 gap-1.5 p-2.5">
        <div className="rounded-lg border border-success/20 bg-success/5 p-2">
          <div className="flex items-center gap-1.5 text-success mb-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <h3 className="text-[11px] font-semibold">Ideal Environment</h3>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{profile.idealEnvironment}</p>
        </div>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-2">
          <div className="flex items-center gap-1.5 text-destructive mb-1.5">
            <XCircle className="h-3.5 w-3.5" />
            <h3 className="text-[11px] font-semibold">Unsuitable Environment</h3>
          </div>
          <p className="text-[10px] leading-relaxed text-muted-foreground">{profile.unsuitableEnvironment}</p>
        </div>
      </div>
    </section>
  );
}
