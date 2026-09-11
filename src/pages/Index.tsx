import { type ChangeEvent, type RefObject, useCallback, useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import { ThemeToggle } from "@/components/theme-toggle";
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { toast } from 'sonner';
import {
  ScanLine,
} from 'lucide-react';
import {
  AnimalProfile,
  DiagnosticAlert,
  PoseFrame,
  TemporalMetrics,
  computeTemporalMetrics,
  createPoseFrame,
  drawAdaptivePoseOverlay,
  emptyTemporalMetrics,
  getVideoRect,
  inferAnimalProfile,
  mapMediaPipeToAnimal,
  clearSmoothingBuffer,
  profileForSpecies,
} from '@/lib/adaptivePose';
import { detectVisualAnomalies, assessVisualHealth, VisionResult, VisualHealthAssessment, initVisionAI } from '@/lib/visionAI';
import { detectAnimalROI, cropImageToROI, DetectionResult, initYoloAI } from '@/lib/yoloAI';
import { initAnimalPoseAI } from '@/lib/animalPose';
import { supabase } from '@/integrations/supabase/client';
import UploadPanel from '@/components/UploadPanel';
import VideoReviewPanel, { type MediaType } from '@/components/VideoReviewPanel';
import HealthPanel from '@/components/HealthPanel';
import TrackingPanel from '@/components/TrackingPanel';
import BCSPanel from '@/components/BCSPanel';
import TemporalFusionPanel from '@/components/TemporalFusionPanel';
import AlertsPanel from '@/components/AlertsPanel';
import EnvironmentPanel from '@/components/EnvironmentPanel';
import { StatusPill } from '@/components/shared/PanelParts';
import AIAnalysisPanel, { type AIHealthScores } from '@/components/AIAnalysisPanel';
import { LoadingOverlay, type ModelLoadState, type ModelStatus } from '@/components/LoadingOverlay';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Image as ImageIcon, Sparkles, AlertCircle, RefreshCw as RefreshCwIcon, Save, Loader2 as Loader2Icon } from 'lucide-react';
import { canvasToBlob, canvasToDataUrl } from '@/lib/canvasUtils';
import { loadLocalAnalyses, setLocalAnalyses } from '@/lib/savedAnalyses';
import type { SavedAnalysis } from '@/lib/savedAnalyses';
import { VideoPlaybackController } from '@/lib/videoPlaybackController';

const HistoryPanel = lazy(() => import('@/components/HistoryPanel'));

function computeStableMetrics(frames: PoseFrame[], profile: AnimalProfile, prev: TemporalMetrics, visionResults: VisionResult[], visualHealth?: VisualHealthAssessment): TemporalMetrics {
  const visionAnomalies = visionResults
    .filter(r => r.score > 0.38 && (
      r.label.includes('wound') ||
      r.label.includes('lesion') ||
      r.label.includes('injury') ||
      r.label.includes('limp') ||
      r.label.includes('stiff') ||
      r.label.includes('scar') ||
      r.label.includes('swelling')
    ))
    .map(r => ({ region: r.region || 'unknown', score: r.score, label: r.label }));

  const raw = computeTemporalMetrics(frames, profile, visionAnomalies, visualHealth);
  raw.visionAnomalies = visionAnomalies;
  raw.visualHealth = visualHealth;

  if (prev.frames === 0 || frames.length < 5) return raw;

  const isDeclining = raw.overallHealth < prev.overallHealth - 5;
  const alpha = isDeclining ? 0.35 : 0.12;

  return {
    ...raw,
    overallHealth: Math.round(prev.overallHealth * (1 - alpha) + raw.overallHealth * alpha),
    symmetry: Math.round(prev.symmetry * (1 - alpha) + raw.symmetry * alpha),
    strideRhythm: Math.round(prev.strideRhythm * (1 - alpha) + raw.strideRhythm * alpha),
    strideConsistency: Math.round(prev.strideConsistency * (1 - alpha) + raw.strideConsistency * alpha),
    postureBalance: Math.round(prev.postureBalance * (1 - alpha) + raw.postureBalance * alpha),
    lamenessRisk: Math.round(prev.lamenessRisk * (1 - alpha) + raw.lamenessRisk * alpha),
    instabilityRisk: Math.round(prev.instabilityRisk * (1 - alpha) + raw.instabilityRisk * alpha),
    anomalyScore: Math.round(prev.anomalyScore * (1 - alpha) + raw.anomalyScore * alpha),
  };
}

function applyAIFusion(baseMetrics: TemporalMetrics, aiScores: AIHealthScores | undefined): TemporalMetrics {
  if (!aiScores) return baseMetrics;
  const aiWeight = 0.35;
  const poseWeight = 0.65;

  return {
    ...baseMetrics,
    overallHealth: Math.round(baseMetrics.overallHealth * poseWeight + aiScores.overallHealth * aiWeight),
    symmetry: Math.round(baseMetrics.symmetry * poseWeight + aiScores.stepSymmetry * aiWeight),
    strideConsistency: Math.round(baseMetrics.strideConsistency * poseWeight + aiScores.strideConsistency * aiWeight),
    lamenessRisk: Math.round(baseMetrics.lamenessRisk * poseWeight + aiScores.lamenessScore * aiWeight),
    anomalyScore: Math.round(baseMetrics.anomalyScore * poseWeight + aiScores.movementAnomaly * aiWeight),
  };
}

export default function Index() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(-1);
  const framesRef = useRef<PoseFrame[]>([]);
  const latestFrameRef = useRef<PoseFrame | null>(null);
  const frameIndexRef = useRef(0);
  const lastProcessedTimeRef = useRef(-1);
  const metricsRef = useRef<TemporalMetrics>(emptyTemporalMetrics());
  const visionResultsRef = useRef<VisionResult[]>([]);
  const visualHealthRef = useRef<VisualHealthAssessment | undefined>(undefined);
  const lastVisionSampleRef = useRef<number>(-1);
  const lastYoloSampleRef = useRef<number>(-1);
  const currentRoiRef = useRef<DetectionResult | null>(null);
  const visualSpeciesRef = useRef<string | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const poseFailedRef = useRef(false);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const displayMetricsRef = useRef<TemporalMetrics>(emptyTemporalMetrics());
  const bcsRef = useRef<number | null>(null);
  const renderOverlayOnceRef = useRef<(direction: 'prev' | 'next', frameCount: number) => void>(() => {});
  const renderOverlayInternalRef = useRef<() => void>(() => {});
  const playbackControllerRef = useRef<VideoPlaybackController | null>(null);

  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<MediaType>(null);
  const [fileName, setFileName] = useState('');
  const [videoInfo, setVideoInfo] = useState<{ width: number; height: number; duration: number } | null>(null);
  const [profile, setProfile] = useState<AnimalProfile | null>(null);
  const [latestFrame, setLatestFrame] = useState<PoseFrame | null>(null);
  const [metrics, setMetrics] = useState<TemporalMetrics>(() => emptyTemporalMetrics());
  const [isPlaying, setIsPlaying] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);

  const [captureDataUrl, setCaptureDataUrl] = useState<string | null>(null);
  const [capturePoseData, setCapturePoseData] = useState<unknown>(null);
  const [aiScores, setAiScores] = useState<AIHealthScores | undefined>(undefined);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [estimatedFps, setEstimatedFps] = useState<number>(30);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [vetNotes, setVetNotes] = useState('');
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>(() => loadLocalAnalyses());
  const [persistenceStatus, setPersistenceStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [modelStatus, setModelStatus] = useState<ModelStatus>({
    mediapipe: 'idle',
    yolo: 'idle',
    clip: 'idle',
  });

  const poseAvailable = modelStatus.mediapipe === 'ready';

  useEffect(() => {
    metricsRef.current = metrics;
  }, [metrics]);

  useEffect(() => {
    bcsRef.current = aiScores?.bodyConditionScore ?? null;
  }, [aiScores]);

  const setModelState = useCallback((key: keyof ModelStatus, state: ModelLoadState, errorMsg?: string) => {
    setModelStatus(prev => {
      const next: ModelStatus = { ...prev, [key]: state };
      if (errorMsg) next.error = errorMsg;
      else if (prev.error && state === 'ready') {
        if (next.mediapipe !== 'error' && next.yolo !== 'error' && next.clip !== 'error') {
          delete next.error;
        }
      }
      return next;
    });
  }, []);

  const loadModels = useCallback(async () => {
    let cancelled = false;
    const startMediapipe = async () => {
      setModelState('mediapipe', 'loading');
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        if (cancelled) return;
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
        });
        if (cancelled) return;
        poseLandmarkerRef.current = landmarker;
        poseFailedRef.current = false;
        setModelState('mediapipe', 'ready');
      } catch (e) {
        console.error('Failed to load pose model:', e);
        poseFailedRef.current = true;
        setModelState('mediapipe', 'error', e instanceof Error ? e.message : 'Pose model failed');
      }
    };
    const startYolo = async () => {
      setModelState('yolo', 'loading');
      try {
        await initYoloAI();
        if (cancelled) return;
        setModelState('yolo', 'ready');
      } catch (e) {
        console.error('Failed to load YOLO:', e);
        setModelState('yolo', 'error', e instanceof Error ? e.message : 'YOLO model failed');
      }
    };
    const startClip = async () => {
      setModelState('clip', 'loading');
      try {
        await initVisionAI();
        if (cancelled) return;
        setModelState('clip', 'ready');
      } catch (e) {
        console.error('Failed to load CLIP:', e);
        setModelState('clip', 'error', e instanceof Error ? e.message : 'CLIP model failed');
      }
    };
    void startMediapipe();
    void startYolo();
    void startClip();
    void initAnimalPoseAI();
    return () => { cancelled = true; };
  }, [setModelState]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  const clearAnalysis = useCallback(() => {
    framesRef.current = [];
    latestFrameRef.current = null;
    frameIndexRef.current = 0;
    lastProcessedTimeRef.current = -1;
    const empty = emptyTemporalMetrics();
    setLatestFrame(null);
    setMetrics(empty);
    metricsRef.current = empty;
    visionResultsRef.current = [];
    visualHealthRef.current = undefined;
    lastVisionSampleRef.current = -1;
    lastYoloSampleRef.current = -1;
    currentRoiRef.current = null;
    visualSpeciesRef.current = null;
    clearSmoothingBuffer();
  }, []);

  const stopWebcamCleanup = useCallback(() => {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(t => t.stop());
      webcamStreamRef.current = null;
    }
    const v = videoRef.current;
    if (v) {
      v.srcObject = null;
    }
    setWebcamActive(false);
  }, []);

  const startWebcam = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      webcamStreamRef.current = stream;
      const v = videoRef.current;
      if (v) {
        v.srcObject = stream;
        await new Promise(resolve => {
          if (!v) return resolve(null);
          v.onloadeddata = () => resolve(null);
        });
        void v.play();
        const meta = { width: v.videoWidth || 640, height: v.videoHeight || 480, duration: 60 };
        setVideoInfo(meta);
        const guessed = inferAnimalProfile('webcam_live.mp4', meta, visualSpeciesRef.current);
        setProfile(guessed);
        clearAnalysis();
        setMediaType('webcam');
        setVideoUrl('__webcam__');
        setFileName('Live webcam feed');
        setWebcamActive(true);
        setIsPlaying(true);
      }
    } catch (e) {
      console.error('Webcam error:', e);
      toast.error(e instanceof Error ? e.message : 'Could not access webcam');
    }
  }, [clearAnalysis]);

  const stopWebcam = useCallback(() => {
    stopWebcamCleanup();
    setMediaType(prev => (prev === 'webcam' ? null : prev));
    setVideoUrl(prev => (prev === '__webcam__' ? null : prev));
    setIsPlaying(false);
  }, [stopWebcamCleanup]);

  const captureFrameForAI = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.85);
      if (!blob) {
        const fallback = canvas.toDataURL('image/jpeg', 0.85);
        setCaptureDataUrl(fallback);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') setCaptureDataUrl(reader.result);
        };
        reader.readAsDataURL(blob);
      }
      const kps = latestFrameRef.current?.keypoints ?? null;
      setCapturePoseData(kps);
    } catch (e) {
      console.warn('Frame capture failed:', e);
    }
  }, []);

  const processImage = useCallback(async (url: string, name: string) => {
    console.log('Starting image analysis for:', name);
    setIsProcessing(true);

    const img = new Image();
    img.src = url;
    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image element'));
      });

      const metadata = { width: img.width, height: img.height, duration: 0 };
      const inferredProfile = inferAnimalProfile(name, metadata, visualSpeciesRef.current);
      setVideoInfo(metadata);
      setProfile(inferredProfile);
      console.log('Profile inferred:', inferredProfile.species);

      if (!poseLandmarkerRef.current) {
        if (poseFailedRef.current) {
          toast.warning('Pose model unavailable — running vision-only analysis.');
        } else {
          toast.info('Initializing AI models…');
          let attempts = 0;
          while (!poseLandmarkerRef.current && !poseFailedRef.current && attempts < 50) {
            await new Promise(r => setTimeout(r, 200));
            attempts++;
          }
          if (!poseLandmarkerRef.current && poseFailedRef.current) {
            toast.warning('Pose model unavailable — running vision-only analysis.');
          } else if (!poseLandmarkerRef.current) {
            throw new Error('AI Pose model failed to load in time.');
          }
        }
      }

      toast.info('Detecting animal…');
      try {
        const roi = await detectAnimalROI(url);
        currentRoiRef.current = roi;
        if (roi?.label) {
          const inferredCanonical = roi.canonicalSpecies ?? roi.label;
          visualSpeciesRef.current = inferredCanonical;
          const visualProfile = inferAnimalProfile(name, metadata, inferredCanonical, roi.anatomyClass);
          if (visualProfile.species !== inferredProfile.species) {
            setProfile(visualProfile);
            toast.info(`Identified: ${visualProfile.species}`);
          }
        }
      } catch (roiErr) {
        console.warn('YOLO localization skipped:', roiErr);
      }

      toast.info('Analyzing animal pose…');
      const timestamp = Date.now();
      const landmarker = poseLandmarkerRef.current;
      let finalLandmarks: { x: number; y: number; z?: number; visibility?: number }[] = [];
      if (landmarker) {
        try {
          const poseResult = landmarker.detectForVideo(img, timestamp);
          finalLandmarks = poseResult.landmarks[0] || [];
        } catch (err) {
          console.warn('Pose detection failed, continuing with vision-only:', err);
          finalLandmarks = [];
        }
      }

      if (currentRoiRef.current && landmarker) {
        toast.info('Calibrating joint alignment…');
        try {
          const croppedUrl = await cropImageToROI(url, currentRoiRef.current.box);
          const croppedImg = new Image();
          croppedImg.src = croppedUrl;
          await new Promise(r => (croppedImg.onload = r));

          const croppedResult = landmarker.detectForVideo(croppedImg, timestamp + 1);
          const rawLandmarks = croppedResult.landmarks[0];

          if (rawLandmarks && rawLandmarks.length > 0) {
            const boxWidth = currentRoiRef.current.box.xmax - currentRoiRef.current.box.xmin;
            const boxHeight = currentRoiRef.current.box.ymax - currentRoiRef.current.box.ymin;

            finalLandmarks = rawLandmarks.map(kp => ({
              ...kp,
              x: currentRoiRef.current!.box.xmin + kp.x * boxWidth,
              y: currentRoiRef.current!.box.ymin + kp.y * boxHeight,
            }));
          }
        } catch (err) {
          console.warn('ROI-cropped pose detection failed:', err);
        }
      }

      const activeProfile = profile ?? inferredProfile;
      const finalKeypoints = finalLandmarks.length > 0 ? mapMediaPipeToAnimal(finalLandmarks, activeProfile) : undefined;
      const frame = createPoseFrame(activeProfile, timestamp, 0, name, finalKeypoints);

      latestFrameRef.current = frame;
      framesRef.current = [frame];
      setLatestFrame(frame);

      const initialMetrics = computeStableMetrics([frame], activeProfile, emptyTemporalMetrics(), []);
      setMetrics(initialMetrics);
      metricsRef.current = initialMetrics;

      const anomalies = currentRoiRef.current
        ? await cropImageToROI(url, currentRoiRef.current.box).then(detectVisualAnomalies)
        : await detectVisualAnomalies(url);

      visionResultsRef.current = anomalies;
      const vha = assessVisualHealth(anomalies);
      visualHealthRef.current = vha;

      const finalMetrics = computeStableMetrics([frame], activeProfile, initialMetrics, anomalies, vha);
      setMetrics(finalMetrics);
      metricsRef.current = finalMetrics;

      try {
        const canvas2 = document.createElement('canvas');
        canvas2.width = img.width;
        canvas2.height = img.height;
        const c = canvas2.getContext('2d');
        if (c) {
          c.drawImage(img, 0, 0);
          const dataUrl = await canvasToDataUrl(canvas2, 'image/jpeg', 0.85);
          if (dataUrl) setCaptureDataUrl(dataUrl);
          setCapturePoseData(finalKeypoints ?? null);
        }
      } catch { /* ignore */ }

      toast.success('Analysis complete');
    } catch (err) {
      console.error('Image processing failed:', err);
      toast.error(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsProcessing(false);
    }
  }, [profile]);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const metadata = {
      width: video.videoWidth || 0,
      height: video.videoHeight || 0,
      duration: video.duration || 0,
    };
    setVideoInfo(metadata);
    setDuration(metadata.duration || 0);
    setCurrentTime(0);
    setProfile(inferAnimalProfile(fileName, metadata, visualSpeciesRef.current));
    clearAnalysis();

    // Set up playback controller for FPS detection + slow-motion control
    if (playbackControllerRef.current) playbackControllerRef.current.destroy();
    const controller = new VideoPlaybackController(video);
    playbackControllerRef.current = controller;
    void controller.estimateFrameRate().then(fps => {
      if (fps > 0) setEstimatedFps(fps);
    });

    void video.play();
  }, [clearAnalysis, fileName]);

  const handleSeekByTime = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    const wasPlaying = !video.paused;
    try {
      video.currentTime = time;
      setCurrentTime(time);
    } catch (e) {
      console.warn('seek failed:', e);
    }
    if (wasPlaying && !webcamActive) {
      void video.play();
    }
  }, [webcamActive]);

  const handleStepFrame = useCallback((direction: 'prev' | 'next', frameCount = 1) => {
    const video = videoRef.current;
    if (!video || webcamActive || (mediaType !== 'video' && mediaType !== 'webcam')) return;
    const fpsFallback = estimatedFps > 0 ? estimatedFps : 29.97;
    const delta = (1 / fpsFallback) * frameCount;
    const target = direction === 'next'
      ? Math.min(duration, video.currentTime + delta)
      : Math.max(0, video.currentTime - delta);
    if (!video.paused) {
      video.pause();
    }
    video.currentTime = target;
    setCurrentTime(target);
    queueMicrotask(() => renderOverlayOnceRef.current(direction, frameCount));
  }, [webcamActive, mediaType, duration, estimatedFps]);

  const renderOverlayOnce = useCallback((direction: 'prev' | 'next', frameCount: number) => {
    frameIndexRef.current += direction === 'next' ? frameCount : -frameCount;
    renderOverlayInternalRef.current();
  }, []);

  const syncCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return false;

    const width = Math.max(1, Math.round(container.clientWidth));
    const height = Math.max(1, Math.round(container.clientHeight));

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    return true;
  }, []);

  const renderOverlayInternal = useCallback(() => {
    const video = videoRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !profile || !syncCanvas()) return;
    const media = (mediaType === 'video' || mediaType === 'webcam') ? video : image;
    if (!media) return;
    const mediaIsLiveVideo = (mediaType === 'video' && video && !video.paused && !video.ended) || mediaType === 'webcam';
    if (!mediaIsLiveVideo) {
      let detectedKeypoints = undefined;
      const landmarker = poseLandmarkerRef.current;
      if (landmarker && (mediaType === 'video' ? video : null) || landmarker && mediaType === 'webcam') {
        const v = video;
        if (v) {
          try {
            const result = landmarker.detectForVideo(v, performance.now());
            if (result.landmarks && result.landmarks.length > 0) {
              detectedKeypoints = mapMediaPipeToAnimal(result.landmarks[0], profile);
            }
          } catch {
            /* skip */
          }
        }
      }
      const frame = createPoseFrame(
        profile,
        video ? video.currentTime : Date.now(),
        frameIndexRef.current,
        fileName,
        detectedKeypoints,
      );
      latestFrameRef.current = frame;
      framesRef.current = [...framesRef.current.slice(-143), frame];
      const nextMetrics = computeStableMetrics(framesRef.current, profile, metricsRef.current, visionResultsRef.current, visualHealthRef.current);
      metricsRef.current = nextMetrics;
      setMetrics(nextMetrics);
      setLatestFrame(frame);
    }
    const rect = getVideoRect(media, canvas);
    const visionAnomalies = visionResultsRef.current
      .filter(r => r.score > 0.38 && (
        r.label.includes('wound') ||
        r.label.includes('lesion') ||
        r.label.includes('injury') ||
        r.label.includes('limp') ||
        r.label.includes('stiff') ||
        r.label.includes('swelling')
      ))
      .map(r => ({ region: r.region || 'unknown', score: r.score, label: r.label }));
    drawAdaptivePoseOverlay(
      ctx,
      latestFrameRef.current,
      profile,
      rect,
      metricsRef.current.lamenessRisk,
      visionAnomalies,
      currentRoiRef.current?.box,
    );
  }, [profile, syncCanvas, mediaType, fileName]);

  const persistAnalysis = useCallback(async () => {
    if (!profile || metrics.frames === 0) {
      toast.error('No analysis to save yet');
      return;
    }
    setPersistenceStatus('saving');
    try {
      const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const now = new Date();
      const snapshot = {
        id,
        created_at: now.toISOString(),
        species: profile.species,
        anatomy_class: profile.anatomyClass,
        model_name: profile.modelName,
        file_name: fileName,
        overall_health: displayMetricsRef.current.overallHealth,
        symmetry: displayMetricsRef.current.symmetry,
        lameness_risk: displayMetricsRef.current.lamenessRisk,
        bcs: bcsRef.current,
        vet_notes: vetNotes,
        ai_scores: aiScores as never,
        alerts: displayMetricsRef.current.alerts.map(a => ({ type: a.type, title: a.title, detail: a.detail })) as never,
        hotspots: (displayMetricsRef.current.anomalyHotspots ?? []) as never,
        frame_count: displayMetricsRef.current.frames,
      };

      let persistedToSupabase = false;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        const { error: insertErr } = await supabase
          .from('analyses')
          .insert({ ...snapshot, user_id: user?.id ?? null })
          .select('id')
          .single();
        if (insertErr) {
          console.warn('Supabase insert rejected:', insertErr.message);
        } else {
          persistedToSupabase = true;
        }
      } catch (supabaseErr) {
        console.warn('Supabase persistence unavailable, falling back to localStorage:', supabaseErr);
      }

      const localRecord = {
        id,
        createdAt: now,
        species: profile.species,
        health: displayMetricsRef.current.overallHealth,
        notes: vetNotes,
      };
      setSavedAnalyses(prev => {
        const next = [localRecord, ...prev].slice(0, 20);
        setLocalAnalyses(next);
        return next;
      });

      if (persistedToSupabase) {
        setPersistenceStatus('saved');
        toast.success('Analysis saved to cloud');
      } else {
        setPersistenceStatus('saved');
        toast.success('Analysis saved locally (cloud unavailable)');
      }
      window.setTimeout(() => setPersistenceStatus('idle'), 2500);
    } catch (e) {
      console.error('Save failed:', e);
      setPersistenceStatus('error');
      toast.error(e instanceof Error ? e.message : 'Failed to save analysis');
      window.setTimeout(() => setPersistenceStatus('idle'), 2500);
    }
  }, [profile, metrics.frames, fileName, vetNotes, aiScores]);

  const handleUpload = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    stopWebcamCleanup();

    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;

    const type: MediaType = file.type.startsWith('image/') ? 'image' : 'video';
    setMediaType(type);
    setVideoUrl(nextUrl);
    setFileName(file.name);
    setVideoInfo(null);
    setProfile(null);
    setIsPlaying(false);
    clearAnalysis();
    setAiScores(undefined);
    setCaptureDataUrl(null);
    setCapturePoseData(null);

    if (type === 'image') {
      void processImage(nextUrl, file.name);
    }

    event.target.value = '';
  }, [clearAnalysis, processImage, stopWebcamCleanup]);

  const handleSpeciesOverride = useCallback((species: string) => {
    if (!species) return;
    const newProfile = profileForSpecies(species, videoInfo ?? undefined);
    setProfile(newProfile);
    toast.info(`Analysis model switched to ${newProfile.species}`);
  }, [videoInfo]);

  const renderOverlay = useCallback(() => {
    const video = videoRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!canvas || !ctx || !profile || !syncCanvas()) return;

    const media = (mediaType === 'video' || mediaType === 'webcam') ? video : image;
    if (!media) return;

    const mediaIsLiveVideo = (mediaType === 'video' && video && !video.paused && !video.ended) || mediaType === 'webcam';

    if (mediaIsLiveVideo && video) {
      // Target ~18fps analysis regardless of source: for 120fps slow-motion we
      // sample every 6-7 frames, for 30fps we sample every other frame. The
      // effective interval is the source frame interval multiplied by a small
      // integer so we always process the same wall-clock analysis rate.
      const targetAnalysisFps = 18;
      const sourceFps = estimatedFps > 0 ? estimatedFps : 30;
      const playbackRateNow = video.playbackRate || 1;
      const effectiveFps = sourceFps * playbackRateNow;
      const minFrameInterval = effectiveFps > 0 ? 1 / Math.min(effectiveFps, targetAnalysisFps) : 1 / targetAnalysisFps;
      const shouldProcess = lastProcessedTimeRef.current < 0 || video.currentTime - lastProcessedTimeRef.current >= minFrameInterval;

      if (shouldProcess) {
        let detectedKeypoints = undefined;
        const landmarker = poseLandmarkerRef.current;

        if (landmarker) {
          try {
            const result = landmarker.detectForVideo(video, performance.now());
            if (result.landmarks && result.landmarks.length > 0) {
              detectedKeypoints = mapMediaPipeToAnimal(result.landmarks[0], profile);
            }
          } catch (err) {
            console.warn('Pose detection skipped for frame:', err);
          }
        }

        const frame = createPoseFrame(profile, video.currentTime, frameIndexRef.current, fileName, detectedKeypoints);
        frameIndexRef.current += 1;
        lastProcessedTimeRef.current = video.currentTime;
        latestFrameRef.current = frame;
        framesRef.current = [...framesRef.current.slice(-143), frame];

        // Trigger vision assessment on the first video frame so the visual
        // health baseline is available for subsequent metrics computations.
        if (frame.frameIndex === 0 && !visualHealthRef.current) {
          void canvasToDataUrl(canvas, 'image/jpeg', 0.8).then(dataUrl => {
            if (!dataUrl) return;
            const task = currentRoiRef.current
              ? cropImageToROI(dataUrl, currentRoiRef.current.box).then(detectVisualAnomalies)
              : detectVisualAnomalies(dataUrl);
            return task.then(results => {
              visionResultsRef.current = results;
              visualHealthRef.current = assessVisualHealth(results);
            });
          }).catch(() => {});
        }

        // Skip metrics on frame 0 to give the vision assessment time to
        // complete; compute on frame 1+ when visualHealth is ready.
        if (frame.frameIndex > 0 && frame.frameIndex % 3 === 0) {
      const nextMetrics = computeStableMetrics(framesRef.current, profile, metricsRef.current, visionResultsRef.current, visualHealthRef.current);
          metricsRef.current = nextMetrics;
          setMetrics(nextMetrics);
        }

        if (frame.frameIndex - lastYoloSampleRef.current >= 60) {
          lastYoloSampleRef.current = frame.frameIndex;
          void canvasToDataUrl(canvas, 'image/jpeg', 0.7).then(dataUrl => {
            if (!dataUrl) return;
            return detectAnimalROI(dataUrl).then(roi => {
              currentRoiRef.current = roi;
              if (roi?.label && !visualSpeciesRef.current) {
                const inferredCanonical = roi.canonicalSpecies ?? roi.label;
                visualSpeciesRef.current = inferredCanonical;
                const vp = inferAnimalProfile(fileName, videoInfo ?? { width: 0, height: 0, duration: 0 }, inferredCanonical, roi.anatomyClass);
                if (vp.species !== profile.species) {
                  setProfile(prev => prev ?? vp);
                }
              }
            });
          }).catch(err => {
            console.warn('YOLO localization failed:', err);
          });
        }

        if (frame.frameIndex - lastVisionSampleRef.current >= 45) {
          lastVisionSampleRef.current = frame.frameIndex;
          void canvasToDataUrl(canvas, 'image/jpeg', 0.8).then(dataUrl => {
            if (!dataUrl) return;
            const analysisTask = currentRoiRef.current
              ? cropImageToROI(dataUrl, currentRoiRef.current.box).then(detectVisualAnomalies)
              : detectVisualAnomalies(dataUrl);
            return analysisTask.then(results => {
              visionResultsRef.current = results;
              visualHealthRef.current = assessVisualHealth(results);
            });
          }).catch(err => {
            console.warn('Vision sampling failed:', err);
          });
        }
      }
    }

    const rect = getVideoRect(media, canvas);
    const visionAnomalies = visionResultsRef.current
      .filter(r => r.score > 0.38 && (
        r.label.includes('wound') ||
        r.label.includes('lesion') ||
        r.label.includes('injury') ||
        r.label.includes('limp') ||
        r.label.includes('stiff') ||
        r.label.includes('swelling')
      ))
      .map(r => ({ region: r.region || 'unknown', score: r.score, label: r.label }));

    drawAdaptivePoseOverlay(
      ctx,
      latestFrameRef.current,
      profile,
      rect,
      metricsRef.current.lamenessRisk,
      visionAnomalies,
      currentRoiRef.current?.box
    );
  }, [fileName, profile, syncCanvas, mediaType, videoInfo, estimatedFps]);

  useEffect(() => {
    renderOverlayOnceRef.current = renderOverlayOnce;
    renderOverlayInternalRef.current = renderOverlayInternal;
  });

  useEffect(() => {
    if (!profile) return undefined;
    const hasMedia = mediaType === 'webcam' || (!!videoUrl && mediaType);
    if (!hasMedia) return undefined;

    const tick = () => {
      renderOverlay();
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [profile, renderOverlay, videoUrl, mediaType]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [videoUrl, mediaType]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      cancelAnimationFrame(rafRef.current);
      if (webcamStreamRef.current) {
        webcamStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video || (!videoUrl || videoUrl === '__webcam__') && mediaType !== 'webcam') return;

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, [videoUrl, mediaType]);


  useEffect(() => {
    const video = videoRef.current;
    if (!video || mediaType !== 'video') return undefined;
    const interval = window.setInterval(() => {
      if (video.paused) return;
      setCurrentTime(video.currentTime);
    }, 100);
    return () => window.clearInterval(interval);
  }, [mediaType, videoUrl]);

  const handleSetPlaybackRate = useCallback((rate: number) => {
    const video = videoRef.current;
    if (!video) return;
    const clamped = Math.max(0.0625, Math.min(4, rate));
    video.playbackRate = clamped;
    setPlaybackRate(clamped);
  }, []);

  const handleReset = useCallback(() => {
    const video = videoRef.current;
    if (mediaType === 'webcam') {
      frameIndexRef.current = 0;
      clearAnalysis();
      return;
    }
    if (!video) return;
    video.pause();
    video.currentTime = 0;
    setIsPlaying(false);
    clearAnalysis();
    renderOverlay();
  }, [clearAnalysis, renderOverlay, mediaType]);

  const handleRetryModels = useCallback(() => {
    poseLandmarkerRef.current = null;
    poseFailedRef.current = false;
    void loadModels();
  }, [loadModels]);

  const handleRetryPoseOnly = useCallback(() => {
    void loadModels();
  }, [loadModels]);

  const headerStatus = useMemo(() => {
    if (mediaType === 'webcam') return webcamActive ? 'Live analysis' : 'Webcam idle';
    if (!videoUrl) return 'Awaiting upload';
    if (isPlaying) return 'Analyzing video';
    return 'Ready for review';
  }, [isPlaying, videoUrl, webcamActive, mediaType]);

  const displayMetrics = useMemo(() => {
    const fused = applyAIFusion(metrics, aiScores);
    displayMetricsRef.current = fused;
    return fused;
  }, [metrics, aiScores]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <LoadingOverlay status={modelStatus} onRetry={handleRetryModels} />

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-card/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-lg shadow-primary/20">
              <ScanLine className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold tracking-tight text-foreground">Animal Health AI</h1>
              <p className="truncate text-[11px] text-muted-foreground">Adaptive pose · Temporal fusion · Vision AI</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusPill label={headerStatus} tone={isPlaying || webcamActive ? 'active' : 'neutral'} />
            <StatusPill label="All-animal router" tone="active" />
            <StatusPill label="Temporal fusion" tone={metrics.frames > 20 ? 'active' : 'watch'} />
            <ThemeToggle className="ml-1" />
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="mx-auto max-w-[1680px] space-y-2 px-4 py-2 md:px-6 md:py-3">
        {!poseAvailable && modelStatus.mediapipe === 'error' && (
          <div
            role="status"
            className="flex flex-wrap items-center gap-3 rounded-lg border border-warning/20 bg-warning/5 px-4 py-2 text-xs text-warning"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1 leading-relaxed">
              Pose model unavailable — analysis will run in vision-only mode (YOLO + visual anomaly AI).
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetryPoseOnly}
              className="h-7 px-2.5 text-[11px] border-warning/30 text-warning hover:bg-warning/10"
            >
              <RefreshCwIcon className="h-3 w-3" />
              Retry pose
            </Button>
          </div>
        )}

        <ErrorBoundary fallbackTitle="Dashboard error">

        {/* ── Row 1: Upload + Video + Health sidebar ── */}
        <div className="grid gap-2 xl:grid-cols-[260px_minmax(0,1fr)_320px]">

          {/* Left sidebar: Upload + AI Analysis stacked */}
          <div className="space-y-2">
            <UploadPanel
              fileName={fileName}
              videoUrl={videoUrl}
              profile={profile}
              videoInfo={videoInfo}
              onUpload={handleUpload}
              onSpeciesOverride={handleSpeciesOverride}
            />
            <Card className="panel-section">
              <CardHeader className="px-2.5 py-2 border-b border-border">
                <CardTitle className="text-xs font-semibold flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Deep AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2.5 space-y-2">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={captureFrameForAI}
                    disabled={!profile}
                    className="flex-1 h-8 text-[11px]"
                  >
                    <ImageIcon className="h-3 w-3" />
                    Capture Frame
                  </Button>
                  <div className="flex items-center text-[10px] text-muted-foreground font-mono">
                    {captureDataUrl ? '✓ Ready' : '—'}
                  </div>
                </div>
                <AIAnalysisPanel
                  imageDataUrl={captureDataUrl}
                  poseData={capturePoseData}
                  onHealthScores={(scores) => {
                    setAiScores(scores);
                    toast.success('AI scores fused with pose metrics');
                  }}
                />
                {aiScores && (
                  <div className="p-2 rounded-lg border border-primary/15 bg-primary/5">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-primary font-semibold mb-0.5">
                      AI-assisted scoring active
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Pose metrics + Gemini visual assessment fused.
                    </p>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={persistAnalysis}
                  disabled={persistenceStatus === 'saving' || metrics.frames === 0}
                  className="w-full h-8 text-[11px]"
                  variant="secondary"
                >
                  {persistenceStatus === 'saving' ? (
                    <>
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Save className="h-3 w-3" />
                      Save Analysis
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Center: Video + Environment */}
          <div className="space-y-2">
            <VideoReviewPanel
              videoRef={videoRef as RefObject<HTMLVideoElement>}
              imageRef={imageRef as RefObject<HTMLImageElement>}
              canvasRef={canvasRef as RefObject<HTMLCanvasElement>}
              videoUrl={videoUrl}
              mediaType={mediaType}
              profile={profile}
              metrics={displayMetrics}
              isPlaying={isPlaying}
              isProcessing={isProcessing}
              webcamActive={webcamActive}
              currentTime={currentTime}
              duration={duration}
              estimatedFps={estimatedFps}
              playbackRate={playbackRate}
              onLoadedMetadata={handleLoadedMetadata}
              onPlayPause={handlePlayPause}
              onReset={handleReset}
              onStartWebcam={startWebcam}
              onStopWebcam={stopWebcam}
              onSetPlaybackRate={handleSetPlaybackRate}
              onSeekByTime={handleSeekByTime}
              onStepFrame={handleStepFrame}
            />
            <EnvironmentPanel profile={profile} />
          </div>

          {/* Right sidebar: Health + Tracking + BCS */}
          <div className="space-y-2">
            <HealthPanel metrics={displayMetrics} />
            <TrackingPanel profile={profile} latestFrame={latestFrame} />
            <BCSPanel profile={profile} metrics={displayMetrics} aiScores={aiScores} />
          </div>
        </div>

        {/* ── Row 2: Temporal + Alerts side-by-side ── */}
        <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
          <TemporalFusionPanel metrics={displayMetrics} />
          <AlertsPanel alerts={displayMetrics.alerts as DiagnosticAlert[]} />
        </div>

        {/* ── Row 3: History ── */}
        <Suspense fallback={<div className="h-20 rounded-lg border border-border bg-card animate-pulse" />}>
          <HistoryPanel
            local={savedAnalyses}
            onClear={() => setSavedAnalyses([])}
            onSavedChange={(next) => setSavedAnalyses(next)}
            onRestore={(a: SavedAnalysis) => {
              if (a.notes) setVetNotes(a.notes);
              toast.info(`Restored notes for ${a.species} (${a.id.slice(0, 6)})`);
            }}
          />
        </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}
