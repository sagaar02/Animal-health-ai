import type { RefObject } from 'react';
import { Camera, RefreshCw, ScanLine, Upload } from 'lucide-react';
import { PanelHeader, StatusPill } from './shared/PanelParts';
import type { AnimalProfile, TemporalMetrics } from '@/lib/adaptivePose';
import VideoControlsScrubber, { type VideoControlsScrubberProps } from './VideoControlsScrubber';

export type MediaType = 'video' | 'image' | 'webcam' | null;

export interface VideoReviewPanelProps {
  videoRef: RefObject<HTMLVideoElement>;
  imageRef: RefObject<HTMLImageElement>;
  canvasRef: RefObject<HTMLCanvasElement>;
  videoUrl: string | null;
  mediaType: MediaType;
  profile: AnimalProfile | null;
  metrics: TemporalMetrics;
  isPlaying: boolean;
  isProcessing: boolean;
  webcamActive: boolean;
  currentTime: number;
  duration: number;
  estimatedFps: number;
  playbackRate: number;
  onLoadedMetadata: () => void;
  onPlayPause: () => void;
  onReset: () => void;
  onStartWebcam: () => void;
  onStopWebcam: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onSeekByTime: VideoControlsScrubberProps['onSeekByTime'];
  onStepFrame: VideoControlsScrubberProps['onStepFrame'];
}

export default function VideoReviewPanel(props: VideoReviewPanelProps) {
  const {
    videoRef,
    imageRef,
    canvasRef,
    videoUrl,
    mediaType,
    profile,
    metrics,
    isPlaying,
    isProcessing,
    webcamActive,
    currentTime,
    duration,
    estimatedFps,
    playbackRate,
    onLoadedMetadata,
    onPlayPause,
    onReset,
    onStartWebcam,
    onStopWebcam,
    onSetPlaybackRate,
    onSeekByTime,
    onStepFrame,
  } = props;

  const isImage = mediaType === 'image';
  const isWebcam = mediaType === 'webcam';
  const hasMedia = !!videoUrl || isWebcam;

  const statusLabel = isProcessing
    ? 'Analyzing...'
    : isImage
    ? 'Image Analyzed'
    : isWebcam
    ? webcamActive
      ? 'Live Webcam'
      : 'Webcam Ready'
    : isPlaying
    ? 'Analyzing'
    : 'Paused';
  const statusTone = isProcessing || isPlaying || isImage || webcamActive ? 'active' : 'neutral';

  return (
    <section className="panel-section">
      <PanelHeader
        icon={ScanLine}
        title="Real-Time Pose Overlay"
        meta={profile ? profile.modelName : 'Upload a video to start'}
      />
      <div className="space-y-2 p-2.5">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-border/40 bg-black/80">
          {!hasMedia && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-400">
                <Upload className="h-4 w-4" />
              </span>
              <p className="text-sm font-medium text-slate-200">No video loaded</p>
              <p className="mt-0.5 text-[11px] text-slate-500">Upload media or start webcam.</p>
            </div>
          )}

          {(videoUrl && !isWebcam && !isImage) && (
            <video
              ref={videoRef}
              src={videoUrl}
              className="h-full w-full object-contain"
              muted
              playsInline
              onLoadedMetadata={onLoadedMetadata}
            />
          )}

          {isWebcam && (
            <video
              ref={videoRef}
              className="h-full w-full object-contain"
              muted
              playsInline
              autoPlay
            />
          )}

          {isImage && videoUrl && (
            <img
              ref={imageRef}
              src={videoUrl}
              className="h-full w-full object-contain"
              alt="Uploaded animal"
            />
          )}

          {isProcessing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <RefreshCw className="h-7 w-7 animate-spin text-primary" />
                <p className="text-[11px] font-medium text-white">Analyzing...</p>
              </div>
            </div>
          )}

          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
            <StatusPill label={statusLabel} tone={statusTone} />
            {profile && <StatusPill label={profile.anatomyClass} tone="active" />}
            {metrics.cameraAngle && metrics.cameraAngle !== 'unknown' && (
              <StatusPill
                label={`${metrics.cameraAngle}${metrics.cameraAngleConfidence ? ` ${Math.round(metrics.cameraAngleConfidence * 100)}%` : ''}`}
                tone={metrics.cameraAngle === 'side' ? 'active' : 'watch'}
              />
            )}
            {estimatedFps > 50 && (
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-warning/20 bg-warning/8 px-2 text-[10px] font-medium text-warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                Slo-Mo {estimatedFps}fps
              </span>
            )}
            {playbackRate !== 1 && !webcamActive && (
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-primary/20 bg-primary/8 px-2 text-[10px] font-medium text-primary">
                {playbackRate}x
              </span>
            )}
            {isWebcam && webcamActive && (
              <span className="inline-flex h-6 items-center gap-1 rounded-md border border-destructive/20 bg-destructive/8 px-2 text-[10px] font-medium text-destructive">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" /> LIVE
              </span>
            )}
          </div>

          <div className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-lg border border-white/8 bg-black/60 px-2.5 py-1.5 text-right backdrop-blur-sm">
            <p className="font-mono text-sm font-bold text-white">{metrics.frames}</p>
            <p className="text-[10px] text-slate-400">frames</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={onStartWebcam}
              disabled={webcamActive}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 text-[11px] font-medium text-foreground transition-all hover:bg-muted hover:border-border disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Camera className="h-3.5 w-3.5" />
              {webcamActive ? 'Live' : 'Webcam'}
            </button>

            <button
              type="button"
              onClick={onReset}
              disabled={!hasMedia}
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2 text-[11px] font-medium text-foreground transition-all hover:bg-muted hover:border-border disabled:cursor-not-allowed disabled:opacity-40"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reset
            </button>

            {isWebcam && webcamActive && (
              <button
                type="button"
                onClick={onStopWebcam}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-destructive/20 bg-destructive/8 px-2 text-[11px] font-medium text-destructive transition-all hover:bg-destructive/15"
              >
                Stop
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill label="Pose" tone={metrics.confidence > 0.7 ? 'active' : 'neutral'} />
            <StatusPill label="Fusion" tone={metrics.frames > 20 ? 'active' : 'watch'} />
          </div>
        </div>

        <VideoControlsScrubber
          videoRef={videoRef}
          mediaType={mediaType}
          videoUrl={videoUrl}
          duration={duration}
          currentTime={currentTime}
          isPlaying={isPlaying}
          metrics={metrics}
          webcamActive={webcamActive}
          fps={estimatedFps}
          playbackRate={playbackRate}
          onSetPlaybackRate={onSetPlaybackRate}
          onTogglePlay={onPlayPause}
          onSeekByTime={onSeekByTime}
          onStepFrame={onStepFrame}
        />
      </div>
    </section>
  );
}
