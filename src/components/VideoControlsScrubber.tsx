import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { ChevronsLeft, ChevronsRight, FastForward, Pause, Play, Rewind, SkipBack, SkipForward, Activity, Gauge } from 'lucide-react';
import type { TemporalMetrics } from '@/lib/adaptivePose';
import type { MediaType } from './VideoReviewPanel';
import { StatusPill } from './shared/PanelParts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';

export interface VideoControlsScrubberProps {
  videoRef: { current: HTMLVideoElement | null };
  mediaType: MediaType;
  videoUrl: string | null;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  metrics: TemporalMetrics;
  webcamActive: boolean;
  fps?: number;
  playbackRate?: number;
  onSetPlaybackRate?: (rate: number) => void;
  onTogglePlay: () => void;
  onSeekByTime: (timeSeconds: number) => void;
  onStepFrame: (direction: 'prev' | 'next', frameCount?: number) => void;
}

const SLOW_MO_PRESETS: { rate: number; label: string; hint: string }[] = [
  { rate: 0.1, label: '0.1x', hint: 'Frame-by-frame stride inspection' },
  { rate: 0.25, label: '0.25x', hint: 'Detailed limb touchdown analysis' },
  { rate: 0.5, label: '0.5x', hint: 'Half-speed gait review' },
  { rate: 1, label: '1x', hint: 'Real-time playback' },
];

const angleTone: Record<string, string> = {
  side: 'active',
  front: 'watch',
  rear: 'watch',
  overhead: 'watch',
  unknown: 'neutral',
};

const angleHintMap: Record<string, string> = {
  side: 'Ideal side profile for gait analysis',
  front: 'Head-on view — lameness may be underestimated',
  rear: 'Rear view — lameness may be underestimated',
  overhead: 'Overhead — limb motion compressed',
  unknown: '',
};

export default function VideoControlsScrubber({
  videoRef,
  mediaType,
  videoUrl,
  duration,
  currentTime,
  isPlaying,
  metrics,
  webcamActive,
  fps = 29.97,
  playbackRate = 1,
  onSetPlaybackRate,
  onTogglePlay,
  onSeekByTime,
  onStepFrame,
}: VideoControlsScrubberProps) {
  const isImage = mediaType === 'image';
  const disabled = isImage || (!videoUrl && !webcamActive);
  const cameraAngle = metrics.cameraAngle ?? 'unknown';

  const hotspots = useMemo(() => {
    if (!duration || duration <= 0 || !metrics.anomalyHotspots?.length) return [];
    const maxFrame = Math.max(...metrics.anomalyHotspots.map(h => h.frameIndex), 1);
    return metrics.anomalyHotspots.map(h => ({
      ...h,
      pct: Math.min(100, Math.max(0, (h.frameIndex / Math.max(1, maxFrame)) * 100)),
      seekTime: Math.min(duration, (h.frameIndex / fps)),
    }));
  }, [duration, metrics.anomalyHotspots, fps]);

  const [openHotspotIdx, setOpenHotspotIdx] = useState<number | null>(null);

  const handleHotspotClick = useCallback((seekTime: number, idx: number) => {
    if (isImage || webcamActive) return;
    onSeekByTime(seekTime);
    setOpenHotspotIdx(idx);
  }, [isImage, webcamActive, onSeekByTime]);

  const seekBarRef = useRef<HTMLDivElement>(null);

  const handleSeekClick = useCallback((clientX: number) => {
    if (!seekBarRef.current || !duration || duration <= 0 || isImage || webcamActive) return;
    const rect = seekBarRef.current.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    onSeekByTime(pct * duration);
  }, [duration, isImage, webcamActive, onSeekByTime]);

  const handleKeyDown = useCallback((e: globalThis.KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag && ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;

    switch (e.key) {
      case ' ':
      case 'k':
        if (!disabled) {
          e.preventDefault();
          onTogglePlay();
        }
        break;
      case 'ArrowRight':
        if (!disabled) {
          e.preventDefault();
          if (e.shiftKey) onStepFrame('next', 5);
          else onStepFrame('next', 1);
        }
        break;
      case 'ArrowLeft':
        if (!disabled) {
          e.preventDefault();
          if (e.shiftKey) onStepFrame('prev', 5);
          else onStepFrame('prev', 1);
        }
        break;
      case 'ArrowUp':
        if (!disabled) {
          e.preventDefault();
          onSeekByTime(Math.min(duration, currentTime + 5));
        }
        break;
      case 'ArrowDown':
        if (!disabled) {
          e.preventDefault();
          onSeekByTime(Math.max(0, currentTime - 5));
        }
        break;
      case '.':
        if (!disabled) {
          e.preventDefault();
          onStepFrame('next', 1);
        }
        break;
      case ',':
        if (!disabled) {
          e.preventDefault();
          onStepFrame('prev', 1);
        }
        break;
      default:
        break;
    }
  }, [currentTime, disabled, duration, onSeekByTime, onStepFrame, onTogglePlay]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;
  const showSeekBar = duration > 0 && !webcamActive;

  return (
    <div className="space-y-2">
      {showSeekBar && (
        <div className="space-y-2">
          <div
            ref={seekBarRef}
            role="slider"
            tabIndex={0}
            aria-label={`Video timeline ${Math.round(progressPct)}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressPct)}
            className={`relative h-3 w-full cursor-pointer rounded-md bg-muted transition hover:h-4 hover:bg-muted/80 ${isImage || webcamActive ? 'cursor-default opacity-60' : ''}`}
            onClick={(e) => handleSeekClick(e.clientX)}
            onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'ArrowRight') onSeekByTime(Math.min(duration, currentTime + 1));
              else if (e.key === 'ArrowLeft') onSeekByTime(Math.max(0, currentTime - 1));
            }}
          >
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-md">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/80 via-primary/60 to-accent/40" style={{ width: `${progressPct}%` }} />
            </div>
            {hotspots.map((h, idx) => {
              const colorClass = h.severity === 'high'
                ? 'bg-destructive/90 shadow-[0_0_6px_hsl(var(--destructive))]'
                : h.severity === 'medium'
                ? 'bg-warning/80'
                : 'bg-accent/70';
              return (
                <Popover key={`${h.frameIndex}-${idx}`} open={openHotspotIdx === idx} onOpenChange={(open) => setOpenHotspotIdx(open ? idx : null)}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleHotspotClick(h.seekTime, idx); }}
                      disabled={isImage || webcamActive}
                      className={`absolute top-0 bottom-0 w-0.5 cursor-pointer transition-all hover:w-1 hover:shadow-sm ${colorClass}`}
                      style={{ left: `${h.pct}%` }}
                      title={`${h.severity} anomaly @ frame ${h.frameIndex}`}
                      aria-label={`Anomaly hotspot: ${h.severity} severity at frame ${h.frameIndex}`}
                    />
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    align="center"
                    sideOffset={8}
                    className="w-64 p-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="px-3 py-2 border-b border-border">
                      <div className="flex items-center gap-2">
                        <Activity className={`h-4 w-4 ${h.severity === 'high' ? 'text-destructive' : h.severity === 'medium' ? 'text-warning' : 'text-accent'}`} />
                        <span className="text-xs font-semibold capitalize">{h.severity} Anomaly</span>
                        <span className="ml-auto text-[10px] font-mono text-muted-foreground">#{h.frameIndex}</span>
                      </div>
                    </div>
                    <div className="space-y-2 px-3 py-2.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Symmetry</p>
                          <p className={`font-mono text-sm font-semibold ${(h.symmetryScore ?? 0) < 70 ? 'text-warning' : 'text-foreground'}`}>
                            {h.symmetryScore ?? '—'}%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Lameness Risk</p>
                          <p className={`font-mono text-sm font-semibold ${(h.lamenessRisk ?? 0) >= 60 ? 'text-destructive' : (h.lamenessRisk ?? 0) >= 40 ? 'text-warning' : 'text-foreground'}`}>
                            {h.lamenessRisk ?? '—'}
                          </p>
                        </div>
                      </div>
                      {duration > 0 && (
                        <button
                          type="button"
                          onClick={() => { onSeekByTime(h.seekTime); setOpenHotspotIdx(null); }}
                          className="w-full h-7 rounded text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          Jump to this frame
                        </button>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              );
            })}
            <div
              className="pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-card border-2 border-primary shadow-md transition"
              style={{ left: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
            <span>{formatSeconds(currentTime)}</span>
            <div className="flex items-center gap-3">
              {hotspots.length > 0 && (
                <div className="hidden sm:flex items-center gap-1.5">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent/70" />
                  <span>low</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-warning" />
                  <span>medium</span>
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                  <span>high</span>
                  <span className="ml-1">anomaly hotspots ({hotspots.length})</span>
                </div>
              )}
            </div>
            <span>{formatSeconds(duration)}</span>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StepButton
            disabled={disabled}
            title="Jump back 5 seconds (Shift + ←)"
            onClick={() => onSeekByTime(Math.max(0, currentTime - 5))}
            icon={Rewind}
            label="-5s"
          />
          <StepButton
            disabled={disabled}
            title="Previous 5 frames (Shift + ←)"
            onClick={() => onStepFrame('prev', 5)}
            icon={ChevronsLeft}
          />
          <StepButton
            disabled={disabled}
            title="Previous frame (← or ,)"
            onClick={() => onStepFrame('prev', 1)}
            icon={SkipBack}
          />
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={disabled}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
            title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <StepButton
            disabled={disabled}
            title="Next frame (→ or .)"
            onClick={() => onStepFrame('next', 1)}
            icon={SkipForward}
          />
          <StepButton
            disabled={disabled}
            title="Next 5 frames (Shift + →)"
            onClick={() => onStepFrame('next', 5)}
            icon={ChevronsRight}
          />
          <StepButton
            disabled={disabled}
            title="Jump forward 5 seconds (Shift + →)"
            onClick={() => onSeekByTime(Math.min(duration, currentTime + 5))}
            icon={FastForward}
            label="+5s"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {cameraAngle !== 'unknown' && !isImage && (
            <div className="flex items-center gap-2">
              <StatusPill
                label={`View: ${cameraAngle}`}
                tone={angleTone[cameraAngle] as 'neutral' | 'active' | 'watch'}
              />
              {angleHintMap[cameraAngle] && (
                <span className="hidden md:inline text-[11px] text-muted-foreground max-w-[280px] truncate">
                  {angleHintMap[cameraAngle]}
                </span>
              )}
            </div>
          )}
          {metrics.lamenessGrade && (
            <StatusPill
              label={`${metrics.lamenessGrade.scaleKey.split('_')[0]} G${metrics.lamenessGrade.grade} — ${metrics.lamenessGrade.label}`}
              tone={metrics.lamenessRisk >= 60 ? 'watch' : 'neutral'}
            />
          )}
        </div>
      </div>

      {!webcamActive && onSetPlaybackRate && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-border bg-muted/20 p-1.5">
          <Gauge className="h-3.5 w-3.5 text-muted-foreground ml-1" />
          <span className="text-[11px] font-medium text-muted-foreground mr-1">Playback</span>
          {SLOW_MO_PRESETS.map(preset => {
            const isActive = Math.abs(playbackRate - preset.rate) < 0.01;
            return (
              <Button
                key={preset.rate}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => onSetPlaybackRate(preset.rate)}
                className="h-7 px-2.5 text-[11px]"
                title={preset.hint}
                disabled={!duration || duration <= 0}
              >
                {preset.label}
              </Button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
            <span>{Math.round(fps)}fps</span>
            {fps > 50 && <span className="text-warning">· slow-mo source</span>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 text-[11px] font-mono">
        <MetricCell label="Stride rate" value={`${metrics.strideRate.toFixed(1)} Hz`} hint={metrics.strideDeviation ? `${metrics.strideDeviation}% vs baseline` : 'baseline OK'} />
        <MetricCell label="Symmetry" value={`${Math.round(metrics.symmetry)}`} hint={metrics.symmetryBias && metrics.symmetryBias !== 'none' ? `${metrics.symmetryBias} side bias` : 'balanced'} />
        <MetricCell
          label="Phase coord."
          value={metrics.phaseCoordination && metrics.phaseCoordination > 0 ? `${Math.round(metrics.phaseCoordination)}` : '—'}
          hint={metrics.phaseCoordination && metrics.phaseCoordination > 0 ? metrics.phaseCoordination < 55 ? 'fore/hind desync' : 'good phasing' : 'needs more frames'}
        />
        <MetricCell
          label="Quality"
          value={`${Math.round(metrics.confidence * 100)}%`}
          hint={metrics.frames >= 96 ? 'temporal window full' : `${metrics.frames} frames`}
        />
      </div>

      {((metrics.cameraAngle === 'front' || metrics.cameraAngle === 'oblique-front') && (metrics.headBob !== undefined || metrics.weightBearingBias !== undefined)) && (
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <MetricCell
            label="Head bob"
            value={metrics.headBob !== undefined ? `${Math.round(metrics.headBob)}/100` : '—'}
            hint={metrics.headBob !== undefined && metrics.headBob >= 25 ? 'elevated — possible forelimb lameness' : 'normal range'}
          />
          <MetricCell
            label="Weight bias"
            value={metrics.weightBearingBias !== undefined ? `${Math.abs(Math.round(metrics.weightBearingBias))}% ${metrics.weightBearingBias < 0 ? 'right' : metrics.weightBearingBias > 0 ? 'left' : ''}` : '—'}
            hint={metrics.weightBearingBias !== undefined && Math.abs(metrics.weightBearingBias) >= 30 ? 'asymmetric loading' : 'balanced'}
          />
        </div>
      )}

      {((metrics.cameraAngle === 'rear' || metrics.cameraAngle === 'oblique-rear') && (metrics.hipHike !== undefined || metrics.weightBearingBias !== undefined)) && (
        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
          <MetricCell
            label="Hip hike"
            value={metrics.hipHike !== undefined ? `${Math.round(metrics.hipHike)}/100` : '—'}
            hint={metrics.hipHike !== undefined && metrics.hipHike >= 25 ? 'elevated — possible hindlimb lameness' : 'normal range'}
          />
          <MetricCell
            label="Weight bias"
            value={metrics.weightBearingBias !== undefined ? `${Math.abs(Math.round(metrics.weightBearingBias))}% ${metrics.weightBearingBias < 0 ? 'right' : metrics.weightBearingBias > 0 ? 'left' : ''}` : '—'}
            hint={metrics.weightBearingBias !== undefined && Math.abs(metrics.weightBearingBias) >= 30 ? 'asymmetric loading' : 'balanced'}
          />
        </div>
      )}
    </div>
  );
}

function StepButton({
  icon: Icon,
  onClick,
  disabled,
  title,
  label,
}: {
  icon: typeof SkipBack;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-border bg-card px-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
    >
      <Icon className="h-3.5 w-3.5" />
      {label && <span>{label}</span>}
    </button>
  );
}

function MetricCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground truncate">{hint}</p>}
    </div>
  );
}

function formatSeconds(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${s}`;
}
