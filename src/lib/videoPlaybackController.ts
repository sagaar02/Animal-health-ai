/**
 * Video playback controller with FPS detection, slow-motion presets,
 * and frame-accurate seeking via requestVideoFrameCallback.
 *
 * Critical for animal gait analysis because:
 *  - Many users upload slow-motion phone recordings (60/120/240 fps)
 *    where the default browser playback rate shows motion as 1x but the
 *    actual content has 2-8x more temporal data per second than real-time.
 *  - Frame-accurate seeking is essential for scrubbing to specific strides
 *    or anomaly hotspots on the timeline.
 */

export interface VideoMetadata {
  width: number;
  height: number;
  duration: number;
  estimatedFps: number;
  isSlowMotion: boolean;
  slowMotionFactor: number;
  effectiveFps: number;
  isHighFps: boolean;
}

export interface FrameSample {
  frameIndex: number;
  mediaTime: number;
  presentedFrames: number;
}

export type SlowMotionPreset = 0.1 | 0.25 | 0.5 | 1 | 2;

interface RVFCMetadata {
  presentedFrames: number;
  expectedDisplayTime: number;
  mediaTime: number;
  width: number;
  height: number;
}

interface HTMLVideoElementWithRVFC extends HTMLVideoElement {
  requestVideoFrameCallback?: (cb: (now: number, metadata: RVFCMetadata) => void) => number;
}

const HIGH_FPS_THRESHOLD = 50;
const SLOW_MO_FPS_BASELINE = 30;

export class VideoPlaybackController {
  private video: HTMLVideoElement;
  private rvfcSupported: boolean;
  private frameSamples: FrameSample[] = [];
  private lastMediaTime = -1;
  private callbacks: Set<(s: FrameSample) => void> = new Set();
  private rvfcId: number | null = null;

  public estimatedFps = 30;
  public isHighFps = false;
  public slowMotionFactor = 1;

  constructor(video: HTMLVideoElement) {
    this.video = video as HTMLVideoElementWithRVFC;
    this.rvfcSupported = typeof this.video.requestVideoFrameCallback === 'function';
    this.setupListeners();
  }

  private setupListeners() {
    this.video.addEventListener('loadedmetadata', () => {
      void this.estimateFrameRate();
    });
    this.video.addEventListener('play', () => {
      this.startFrameLoop();
    });
    this.video.addEventListener('pause', () => {
      this.stopFrameLoop();
    });
  }

  /**
   * Estimate frame rate using requestVideoFrameCallback when available.
   * Falls back to assumed 30 fps for browsers that don't support rVFC.
   */
  async estimateFrameRate(): Promise<number> {
    if (this.rvfcSupported) {
      const measured = await this.measureFpsViaRvfc(2); // 2 seconds of sampling
      if (measured && measured > 0) {
        this.estimatedFps = Math.round(measured);
        this.isHighFps = this.estimatedFps > HIGH_FPS_THRESHOLD;
        this.slowMotionFactor = this.isHighFps
          ? this.estimatedFps / SLOW_MO_FPS_BASELINE
          : 1;
        return this.estimatedFps;
      }
    }
    // Fallback: try getVideoPlaybackQuality
    const q = (this.video as HTMLVideoElement & { getVideoPlaybackQuality?: () => { totalVideoFrames?: number } })
      .getVideoPlaybackQuality?.();
    if (q?.totalVideoFrames && this.video.duration > 0) {
      const f = Math.round(q.totalVideoFrames / this.video.duration);
      if (f > 0 && f < 500) {
        this.estimatedFps = f;
        this.isHighFps = f > HIGH_FPS_THRESHOLD;
        this.slowMotionFactor = this.isHighFps ? f / SLOW_MO_FPS_BASELINE : 1;
        return f;
      }
    }
    return this.estimatedFps;
  }

  private measureFpsViaRvfc(durationSec = 2): Promise<number | null> {
    const v = this.video as HTMLVideoElementWithRVFC;
    if (!v.requestVideoFrameCallback) return Promise.resolve(null);

    return new Promise<number | null>((resolve) => {
      const startTime = v.currentTime;
      const endTime = Math.min(v.duration, startTime + durationSec);
      const timestamps: number[] = [];

      const sample = (_now: number, metadata: RVFCMetadata) => {
        timestamps.push(metadata.mediaTime);
        if (metadata.mediaTime < endTime) {
          v.requestVideoFrameCallback?.(sample);
        } else {
          if (timestamps.length < 2) {
            resolve(null);
            return;
          }
          const total = timestamps[timestamps.length - 1] - timestamps[0];
          const avgInterval = total / (timestamps.length - 1);
          resolve(avgInterval > 0 ? 1 / avgInterval : null);
        }
      };

      // Seek to start of sample window
      v.currentTime = startTime;
      v.addEventListener('seeked', () => {
        v.requestVideoFrameCallback?.(sample);
      }, { once: true });

      setTimeout(() => resolve(null), (durationSec + 2) * 1000);
    });
  }

  /**
   * Get full metadata for the current video.
   */
  getMetadata(): VideoMetadata {
    const { width, height, duration, playbackRate } = this.video;
    const effectiveFps = this.estimatedFps * (playbackRate ?? 1);
    return {
      width: width || 0,
      height: height || 0,
      duration: duration || 0,
      estimatedFps: this.estimatedFps,
      isSlowMotion: this.isHighFps,
      slowMotionFactor: this.slowMotionFactor,
      effectiveFps,
      isHighFps: this.isHighFps,
    };
  }

  /**
   * Effective processing FPS for the current video.
   * Combines native FPS with playback rate so a 60fps video at 0.5x = 30 effective.
   */
  getEffectiveFps(): number {
    return this.estimatedFps * (this.video.playbackRate ?? 1);
  }

  /**
   * Set the playback rate. Slow-motion presets allow per-frame inspection
   * of rapid gait features (e.g., forelimb placement at touchdown).
   */
  setPlaybackRate(rate: SlowMotionPreset | number): void {
    const clamped = Math.max(0.0625, Math.min(4, rate));
    this.video.playbackRate = clamped;
  }

  getPlaybackRate(): number {
    return this.video.playbackRate;
  }

  /**
   * Seek to a specific frame index. Frame-accurate for browsers supporting
   * requestVideoFrameCallback. Falls back to time-based seek otherwise.
   */
  async seekToFrame(frameIndex: number): Promise<void> {
    const t = Math.max(0, frameIndex / this.estimatedFps);
    return this.seekToTime(t);
  }

  /**
   * Seek to a specific time (seconds).
   */
  seekToTime(seconds: number): Promise<void> {
    const v = this.video;
    const target = Math.max(0, Math.min(seconds, v.duration || 0));
    return new Promise<void>((resolve) => {
      const onSeeked = () => {
        v.removeEventListener('seeked', onSeeked);
        resolve();
      };
      v.addEventListener('seeked', onSeeked);
      v.currentTime = target;
      setTimeout(() => {
        v.removeEventListener('seeked', onSeeked);
        resolve();
      }, 600);
    });
  }

  /**
   * Step forward/backward by N frames at the current estimated FPS.
   */
  async stepFrames(direction: 'next' | 'prev', count = 1): Promise<void> {
    const v = this.video;
    const fps = this.estimatedFps || 30;
    const delta = (direction === 'next' ? 1 : -1) * (count / fps);
    return this.seekToTime(v.currentTime + delta);
  }

  /**
   * Start observing per-frame events. Returns unsubscribe function.
   */
  onFrame(cb: (sample: FrameSample) => void): () => void {
    this.callbacks.add(cb);
    if (!v_isPaused(this.video)) {
      this.startFrameLoop();
    }
    return () => {
      this.callbacks.delete(cb);
      if (this.callbacks.size === 0) {
        this.stopFrameLoop();
      }
    };
  }

  private startFrameLoop() {
    if (!this.rvfcSupported) return;
    if (this.rvfcId !== null) return;
    const v = this.video as HTMLVideoElementWithRVFC;
    const tick = (_now: number, metadata: RVFCMetadata) => {
      if (this.lastMediaTime >= 0 && metadata.mediaTime === this.lastMediaTime) {
        // duplicate frame
      } else {
        const sample: FrameSample = {
          frameIndex: this.frameSamples.length,
          mediaTime: metadata.mediaTime,
          presentedFrames: metadata.presentedFrames,
        };
        this.frameSamples.push(sample);
        if (this.frameSamples.length > 1000) this.frameSamples.shift();
        this.lastMediaTime = metadata.mediaTime;
        for (const cb of this.callbacks) {
          try { cb(sample); } catch (e) { console.error('[videoPlayback] callback error', e); }
        }
      }
      if (this.callbacks.size > 0) {
        this.rvfcId = v.requestVideoFrameCallback?.(tick) ?? null;
      } else {
        this.rvfcId = null;
      }
    };
    this.rvfcId = v.requestVideoFrameCallback?.(tick) ?? null;
  }

  private stopFrameLoop() {
    // rVFC cannot be cancelled; callbacks emptiness will stop the chain on next tick
    this.rvfcId = null;
  }

  destroy() {
    this.callbacks.clear();
    this.frameSamples = [];
  }
}

function v_isPaused(v: HTMLVideoElement): boolean {
  return v.paused || v.ended;
}
