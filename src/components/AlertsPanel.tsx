import type { ElementType } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { PanelHeader } from './shared/PanelParts';
import type { DiagnosticAlert } from '@/lib/adaptivePose';

export default function AlertsPanel({ alerts }: { alerts: DiagnosticAlert[] }) {
  const iconMap: Record<DiagnosticAlert['type'], ElementType> = {
    normal: CheckCircle2,
    watch: AlertTriangle,
    critical: AlertTriangle,
  };

  const styleMap: Record<DiagnosticAlert['type'], string> = {
    normal: 'border-success/20 bg-success/5 text-success',
    watch: 'border-warning/20 bg-warning/5 text-warning',
    critical: 'border-destructive/20 bg-destructive/5 text-destructive',
  };

  return (
    <section className="panel-section h-full flex flex-col">
      <PanelHeader icon={AlertTriangle} title="Clinical Alerts" meta="Concise anomaly flags" />
      <div className="space-y-1.5 p-2.5">
        {alerts.length === 0 && (
          <div className="flex h-full min-h-[80px] items-center justify-center rounded-lg border border-border/60 bg-muted/10 p-3 text-[11px] text-muted-foreground text-center">
            No clinical alerts triggered.
          </div>
        )}

        {alerts.map(alert => {
          const Icon = iconMap[alert.type];
          return (
            <div key={alert.id} className={`rounded-lg border p-2.5 ${styleMap[alert.type]}`}>
              <div className="flex items-start gap-2">
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div>
                  <p className="text-[11px] font-semibold leading-none">{alert.title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed opacity-80">{alert.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
