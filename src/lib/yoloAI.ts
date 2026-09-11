import { pipeline, env, type ObjectDetectionPipeline } from '@xenova/transformers';

env.allowLocalModels = false;
env.useBrowserCache = true;

let detectorPipeline: ObjectDetectionPipeline | null = null;
let activeModelId: string | null = null;
let initializing = false;

interface YoloDetection {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
}

export type BoundingBox = {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
};

export type DetectionResult = {
  label: string;
  canonicalSpecies: string;
  anatomyClass: 'quadruped' | 'avian-biped' | 'biped' | 'serpentine' | 'aquatic' | 'universal';
  score: number;
  quality: number;
  box: BoundingBox;
  modelUsed: string;
};

const PRIMARY_MODEL = 'Xenova/yolov8s';
const FALLBACK_MODEL = 'Xenova/yolov8n';
const PIPELINE_DEFAULTS = {
  dtype: 'fp16' as const,
};

const COCO_ANIMAL_CANONICAL: Record<string, { canonical: string; anatomy: DetectionResult['anatomyClass'] }> = {
  dog:       { canonical: 'Dog',       anatomy: 'quadruped'   },
  cat:       { canonical: 'Cat',       anatomy: 'quadruped'   },
  horse:     { canonical: 'Horse',     anatomy: 'quadruped'   },
  sheep:     { canonical: 'Sheep',     anatomy: 'quadruped'   },
  cow:       { canonical: 'Cow',       anatomy: 'quadruped'   },
  elephant:  { canonical: 'Elephant',  anatomy: 'quadruped'   },
  bear:      { canonical: 'Bear',      anatomy: 'quadruped'   },
  zebra:     { canonical: 'Horse',     anatomy: 'quadruped'   },
  giraffe:   { canonical: 'Giraffe',   anatomy: 'quadruped'   },
  bird:      { canonical: 'Bird',      anatomy: 'avian-biped' },
};

const COCO_ANIMAL_CLASSES = Object.keys(COCO_ANIMAL_CANONICAL);

function iou(a: BoundingBox, b: BoundingBox): number {
  const xA = Math.max(a.xmin, b.xmin);
  const yA = Math.max(a.ymin, b.ymin);
  const xB = Math.min(a.xmax, b.xmax);
  const yB = Math.min(a.ymax, b.ymax);
  const interW = Math.max(0, xB - xA);
  const interH = Math.max(0, yB - yA);
  const inter = interW * interH;
  if (inter <= 0) return 0;
  const areaA = (a.xmax - a.xmin) * (a.ymax - a.ymin);
  const areaB = (b.xmax - b.xmin) * (b.ymax - b.ymin);
  return inter / Math.max(1e-6, areaA + areaB - inter);
}

function softNMS(detections: YoloDetection[], iouThreshold = 0.45): YoloDetection[] {
  const sorted = [...detections].sort((a, b) => b.score - a.score);
  const kept: YoloDetection[] = [];
  while (sorted.length > 0) {
    const top = sorted.shift()!;
    kept.push(top);
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i].label !== top.label) continue;
      if (iou(top.box, sorted[i].box) > iouThreshold) {
        sorted.splice(i, 1);
      }
    }
  }
  return kept;
}

function scoreRoiQuality(box: BoundingBox, score: number): number {
  const w = Math.max(0, box.xmax - box.xmin);
  const h = Math.max(0, box.ymax - box.ymin);
  const area = w * h;
  const areaPenalty = area < 0.04 ? area / 0.04 : area > 0.92 ? Math.max(0.4, 1 - (area - 0.92) * 3) : 1;
  const ratio = h > 0 ? w / h : 1;
  const ratioPenalty = ratio > 2.5 || ratio < 0.4 ? 0.55 : 1 - (Math.abs(1 - ratio) * 0.25);
  return Math.max(0, Math.min(1, score * 0.55 + areaPenalty * 0.3 + ratioPenalty * 0.15));
}

function loadWithFallback(order: string[], idx: number): Promise<ObjectDetectionPipeline | null> {
  if (idx >= order.length) return Promise.resolve(null);
  const modelId = order[idx];
  return pipeline('object-detection', modelId, PIPELINE_DEFAULTS)
    .then(p => {
      console.log(`[YOLO] Loaded ${modelId}`);
      activeModelId = modelId;
      return p as ObjectDetectionPipeline;
    })
    .catch(err => {
      console.warn(`[YOLO] Failed to load ${modelId} (${err instanceof Error ? err.message : err}); trying next in chain`);
      return loadWithFallback(order, idx + 1);
    });
}

export async function initYoloAI(): Promise<ObjectDetectionPipeline | null> {
  if (detectorPipeline) return detectorPipeline;
  if (initializing) return null;
  initializing = true;
  try {
    const p = await loadWithFallback([PRIMARY_MODEL, FALLBACK_MODEL], 0);
    detectorPipeline = p;
  } catch (error) {
    console.error('Failed to initialize YOLO AI:', error);
  } finally {
    initializing = false;
  }
  return detectorPipeline;
}

export async function detectAnimalROI(dataUrl: string): Promise<DetectionResult | null> {
  if (!detectorPipeline) {
    await initYoloAI();
  }
  if (!detectorPipeline) return null;

  try {
    const raw = (await detectorPipeline(dataUrl, {
      threshold: 0.22,
    })) as YoloDetection[];

    if (!Array.isArray(raw) || raw.length === 0) return null;

    const animalOnly = raw.filter(
      r => COCO_ANIMAL_CLASSES.includes(r.label) && r.score > 0.2
    );

    if (animalOnly.length === 0) return null;

    const deduped = softNMS(animalOnly, 0.4);
    const scored = deduped.map(r => {
      const mapping = COCO_ANIMAL_CANONICAL[r.label] ?? {
        canonical: r.label.charAt(0).toUpperCase() + r.label.slice(1),
        anatomy: 'universal' as const,
      };
      return {
        label: r.label,
        canonicalSpecies: mapping.canonical,
        anatomyClass: mapping.anatomy,
        score: r.score,
        quality: scoreRoiQuality(r.box, r.score),
        box: r.box,
        modelUsed: activeModelId ?? PRIMARY_MODEL,
      };
    });

    const byTopAnimal = scored
      .sort((a, b) => b.quality - a.quality || b.score - a.score);

    return byTopAnimal[0] ?? null;
  } catch (error) {
    console.error('YOLO AI detection failed:', error);
    return null;
  }
}

export async function cropImageToROI(dataUrl: string, box: BoundingBox): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const paddingX = (box.xmax - box.xmin) * 0.08;
      const paddingY = (box.ymax - box.ymin) * 0.08;
      const xmin = Math.max(0, box.xmin - paddingX);
      const ymin = Math.max(0, box.ymin - paddingY);
      const xmax = Math.min(1, box.xmax + paddingX);
      const ymax = Math.min(1, box.ymax + paddingY);

      const width = (xmax - xmin) * img.width;
      const height = (ymax - ymin) * img.height;
      const x = xmin * img.width;
      const y = ymin * img.height;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, x, y, width, height, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}
