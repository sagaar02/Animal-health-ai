import { Activity, Clock3, Layers3, Route } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PanelHeader, MetricTile } from './shared/PanelParts';
import type { TemporalMetrics } from '@/lib/adaptivePose';

const scoreFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

export default function TemporalFusionPanel({ metrics }: { metrics: TemporalMetrics }) {
  return (
    <section className="panel-section">
      <PanelHeader icon={Route} title="Temporal Fusion" meta="Pose continuity, stride timing, and symmetry trends" />
      <div className="grid gap-2 p-2.5 lg:grid-cols-[1fr_200px]">
        <div className="min-h-[200px] rounded-lg border border-border/60 bg-background/50 p-2">
          {metrics.trend.length < 2 ? (
            <div className="flex h-full min-h-[180px] items-center justify-center text-xs text-muted-foreground">
              Waiting for pose frames…
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={metrics.trend} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="hsl(220 16% 18%)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="frame" hide />
                <YAxis domain={[0, 100]} width={24} tick={{ fontSize: 10, fill: 'hsl(215 12% 50%)' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid hsl(220 16% 20%)',
                    background: 'hsl(222 22% 13%)',
                    color: 'hsl(210 20% 92%)',
                    fontSize: 11,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                />
                <Line type="monotone" dataKey="health" name="Health" stroke="hsl(155 55% 45%)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="symmetry" name="Symmetry" stroke="hsl(217 76% 58%)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="rhythm" name="Rhythm" stroke="hsl(190 75% 50%)" strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="lameness" name="Lameness" stroke="hsl(0 68% 55%)" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5 lg:grid-cols-1">
          <MetricTile icon={Activity} label="Anomaly" value={scoreFormatter.format(metrics.anomalyScore)} suffix="/100" />
          <MetricTile icon={Route} label="Stride" value={metrics.strideRate.toFixed(1)} suffix="Hz" />
          <MetricTile icon={Layers3} label="Fit" value={scoreFormatter.format(metrics.modelFit)} suffix="%" />
          <MetricTile icon={Clock3} label="Window" value={Math.min(metrics.frames, 96)} suffix="f" />
        </div>
      </div>
    </section>
  );
}
