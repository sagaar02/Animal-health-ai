import { pipeline, env, type ZeroShotImageClassificationPipeline } from '@xenova/transformers';

// Configure environment for browser usage
env.allowLocalModels = false;
env.useBrowserCache = true;

let classifierPipeline: ZeroShotImageClassificationPipeline | null = null;
let initializing = false;

interface VisionLabel {
  label: string;
  score: number;
}

export async function initVisionAI(): Promise<ZeroShotImageClassificationPipeline | null> {
  if (classifierPipeline) return classifierPipeline;
  if (initializing) return null; // Prevent multiple concurrent inits

  initializing = true;
  try {
    const p = await pipeline(
      'zero-shot-image-classification',
      'Xenova/clip-vit-base-patch32'
    );
    classifierPipeline = p as ZeroShotImageClassificationPipeline;
    console.log("Vision AI pipeline initialized.");
  } catch (error) {
    console.error("Failed to initialize Vision AI:", error);
  } finally {
    initializing = false;
  }

  return classifierPipeline;
}

export type VisionResult = {
  label: string;
  score: number;
  region?: 'head' | 'spine' | 'forelimb' | 'hindlimb' | 'body' | 'unknown';
  orientation?: 'left' | 'right' | 'front' | 'unknown';
};

export async function detectVisualAnomalies(dataUrl: string): Promise<VisionResult[]> {
  if (!classifierPipeline) {
    await initVisionAI();
  }
  if (!classifierPipeline) return [];

  const candidateLabels = [
    'wound on head',
    'wound on forelimb',
    'wound on hindlimb',
    'wound on spine',
    'lesion on body',
    'bloody injury',
    'open wound on leg',
    'broken leg animal',
    'fractured limb',
    'scar on body',
    'healthy animal coat',
    'animal facing left',
    'animal facing right',
    'limping animal',
    'stiff gait',
    'swelling on leg'
  ];

  try {
    const results = await classifierPipeline(dataUrl, candidateLabels);
    return (results as VisionLabel[]).map((r): VisionResult => {
      let region: VisionResult['region'] = 'unknown';
      let orientation: VisionResult['orientation'] = 'unknown';

      if (r.label.includes('head')) region = 'head';
      else if (r.label.includes('forelimb')) region = 'forelimb';
      else if (r.label.includes('hindlimb') || r.label.includes('leg')) region = 'hindlimb';
      else if (r.label.includes('spine')) region = 'spine';
      else if (r.label.includes('body')) region = 'body';

      if (r.label.includes('facing left')) orientation = 'left';
      else if (r.label.includes('facing right')) orientation = 'right';

      return {
        label: r.label,
        score: r.score,
        region,
        orientation
      };
    });
  } catch (error) {
    console.error("Vision AI classification failed:", error);
    return [];
  }
}

// ── Visual Health Assessment ────────────────────────────────────────────────
// Derives a primary visual health score from the full CLIP results, so the
// scoring pipeline has a view-independent baseline before pose metrics are
// applied.

export interface VisualHealthAssessment {
  /** 0–100 visual health score derived purely from image classification. */
  healthScore: number;
  /** Confidence (0–1) of the visual assessment. */
  confidence: number;
  /** High-level coat / skin condition label. */
  coatCondition: 'healthy' | 'moderate' | 'poor' | 'unknown';
  /** True when any wound/lesion/fracture label scored above threshold. */
  hasWounds: boolean;
  /** True when limp/stiff gait labels scored above threshold. */
  hasLamenessVisual: boolean;
  /** Free-text signals used for alert detail text. */
  signals: string[];
}

const WOUND_KEYWORDS = ['wound', 'lesion', 'injury', 'bloody', 'open wound', 'broken', 'fractured'];
const LAMENESS_KEYWORDS = ['limp', 'limping', 'stiff'];
const POSITIVE_KEYWORDS = ['healthy animal coat'];
const MODERATE_KEYWORDS = ['scar on body'];

export function assessVisualHealth(results: VisionResult[]): VisualHealthAssessment {
  if (results.length === 0) {
    // CLIP may not have loaded yet or returned nothing. Provide a moderate
    // default so the visual baseline still contributes to scoring rather
    // than leaving it entirely to pose metrics (which may be unreliable).
    return {
      healthScore: 75,
      confidence: 0.15,
      coatCondition: 'unknown',
      hasWounds: false,
      hasLamenessVisual: false,
      signals: [],
    };
  }

  const matchAny = (r: VisionResult, keywords: string[]) =>
    keywords.some(kw => r.label.toLowerCase().includes(kw));

  // ── Positive signals ───────────────────────────────────────────────────
  const healthyCoat = results.find(r => matchAny(r, POSITIVE_KEYWORDS));
  const scar = results.find(r => matchAny(r, MODERATE_KEYWORDS));

  // ── Negative signals ───────────────────────────────────────────────────
  const wounds = results.filter(r => matchAny(r, WOUND_KEYWORDS));
  const lamenessVisual = results.filter(r => matchAny(r, LAMENESS_KEYWORDS));

  const worstWoundScore = wounds.length > 0 ? Math.max(...wounds.map(w => w.score)) : 0;
  const worstLamenessScore = lamenessVisual.length > 0 ? Math.max(...lamenessVisual.map(l => l.score)) : 0;
  const worstScarScore = scar ? scar.score : 0;

  // ── Score derivation ───────────────────────────────────────────────────
  // NOTE: CLIP zero-shot on single frames is noisy — a running dog's leg
  // position can trigger false "limping" detections. We therefore use
  // POSITIVE signals (healthy coat) to boost health, and require high
  // confidence thresholds before negative signals can pull health down.
  let healthScore = 70; // neutral-high baseline (benefit of the doubt)
  let confidence = 0;

  // Healthy coat is the strongest positive signal
  if (healthyCoat && healthyCoat.score > 0.12) {
    healthScore = 65 + healthyCoat.score * 40;
    confidence = healthyCoat.score;
  }

  // Wounds pull health down, but only with moderate confidence to avoid
  // false positives from CLIP noise on a single frame.
  if (worstWoundScore > 0.25) {
    healthScore -= worstWoundScore * 60;
  }

  // Fractures are critical — but still need decent confidence
  const hasFracture = wounds.some(w => w.label.includes('broken') || w.label.includes('fractured'));
  if (hasFracture && worstWoundScore > 0.20) healthScore = Math.min(healthScore, 25);

  // Lameness visual (limping/stiff) — require higher confidence because
  // CLIP false-positives on running animals are common.
  if (worstLamenessScore > 0.30) {
    healthScore -= worstLamenessScore * 25;
  }

  // Scars have a mild negative impact
  if (worstScarScore > 0.30) {
    healthScore -= worstScarScore * 8;
  }

  healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

  // ── Coat condition label ───────────────────────────────────────────────
  let coatCondition: VisualHealthAssessment['coatCondition'] = 'unknown';
  if (healthyCoat && healthyCoat.score > 0.35) coatCondition = 'healthy';
  else if (healthyCoat && healthyCoat.score > 0.15) coatCondition = 'moderate';
  else if (worstWoundScore > 0.25) coatCondition = 'poor';

  const signals: string[] = [
    ...wounds.map(w => w.label),
    ...lamenessVisual.map(l => l.label),
    ...(scar ? [scar.label] : []),
  ];

  return {
    healthScore,
    confidence,
    coatCondition,
    hasWounds: wounds.length > 0 && worstWoundScore > 0.25,
    hasLamenessVisual: lamenessVisual.length > 0 && worstLamenessScore > 0.30,
    signals,
  };
}
