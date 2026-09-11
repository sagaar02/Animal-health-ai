/**
 * Multi-metric camera-angle ensemble detector.
 * Replaces the single-threshold `detectCameraAngle()` (adaptivePose.ts:1218)
 * with a scored hypothesis framework + temporal smoothing.
 */

import type { PoseFrame, AnimalProfile } from './adaptivePose';

export type CameraAngle = 'side' | 'front' | 'rear' | 'overhead' | 'oblique-front' | 'oblique-rear' | 'unknown';

export interface TrackingPoint {
  id: string;
  x: number;
  y: number;
  confidence: number;
  region?: string;
}

export interface AngleMetrics {
  lateralSpread: number;
  spineVerticality: number;
  noseLateralOffset: number;
  tailLateralOffset: number;
  aspectRatio: number;
  perspectiveDepth: number;
  limbVisibilityRatio: number;
}

export interface AngleClassification {
  angle: CameraAngle;
  confidence: number;
  metrics: AngleMetrics;
  warnings: string[];
}

function byIdSafe(frame: PoseFrame, id: string): TrackingPoint | undefined {
  return frame.keypoints.find(p => p.id === id) ?? undefined;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
}

function computeSpineVerticality(lm: {
  shoulder?: TrackingPoint; hip?: TrackingPoint;
}): number {
  if (!lm.shoulder || !lm.hip) return 0.5;
  const dx = lm.shoulder.x - lm.hip.x;
  const dy = lm.shoulder.y - lm.hip.y;
  const angle = Math.atan2(Math.abs(dx), dy); // 0 = vertical, PI/2 = horizontal
  return angle / (Math.PI / 2);
}

function computeTorsoCenter(lm: {
  leftShoulder?: TrackingPoint; rightShoulder?: TrackingPoint;
  leftHip?: TrackingPoint; rightHip?: TrackingPoint;
}): number {
  const points = [lm.leftShoulder, lm.rightShoulder, lm.leftHip, lm.rightHip].filter(Boolean) as TrackingPoint[];
  return points.length ? avg(points.map(p => p.x)) : 0.5;
}

function computeAspectRatio(frame: PoseFrame): number {
  const xs = frame.keypoints.map(p => p.x);
  const ys = frame.keypoints.map(p => p.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return width > 0 ? height / width : 1;
}

function computeAngleMetrics(frame: PoseFrame, profile?: import('./adaptivePose').AnimalProfile): AngleMetrics {
  const lm = {
    leftShoulder: byIdSafe(frame, 'left_shoulder'),
    rightShoulder: byIdSafe(frame, 'right_shoulder'),
    leftHip: byIdSafe(frame, 'left_hip'),
    rightHip: byIdSafe(frame, 'right_hip'),
    nose: byIdSafe(frame, 'nose'),
    tail: byIdSafe(frame, 'tail_base'),
    leftForePaw: byIdSafe(frame, 'left_fore_paw'),
    rightForePaw: byIdSafe(frame, 'right_fore_paw'),
    leftHindPaw: byIdSafe(frame, 'left_hind_paw'),
    rightHindPaw: byIdSafe(frame, 'right_hind_paw'),
  };

  const shoulderXDiff = (lm.leftShoulder && lm.rightShoulder) ? Math.abs(lm.leftShoulder.x - lm.rightShoulder.x) : 0;
  const hipXDiff = (lm.leftHip && lm.rightHip) ? Math.abs(lm.leftHip.x - lm.rightHip.x) : 0;
  const lateralSpread = (shoulderXDiff + hipXDiff) / 2;

  const spineVerticality = computeSpineVerticality({
    shoulder: lm.leftShoulder ?? lm.rightShoulder,
    hip: lm.leftHip ?? lm.rightHip,
  });

  const torsoCenter = computeTorsoCenter({
    leftShoulder: lm.leftShoulder,
    rightShoulder: lm.rightShoulder,
    leftHip: lm.leftHip,
    rightHip: lm.rightHip,
  });

  const noseLateralOffset = lm.nose ? lm.nose.x - torsoCenter : 0;
  const tailLateralOffset = lm.tail ? lm.tail.x - torsoCenter : 0;

  const aspectRatio = computeAspectRatio(frame);
  const perspectiveDepth = Math.abs(shoulderXDiff - hipXDiff);

  const visibleLimbs = [lm.leftForePaw, lm.rightForePaw, lm.leftHindPaw, lm.rightHindPaw].filter(
    p => p && p.confidence > 0.3
  ) as TrackingPoint[];
  const limbVisibilityRatio = visibleLimbs.length / 4;

  return {
    lateralSpread,
    spineVerticality,
    noseLateralOffset,
    tailLateralOffset,
    aspectRatio,
    perspectiveDepth,
    limbVisibilityRatio,
  };
}

export function detectCameraAngle(
  frame: PoseFrame,
  profile?: import('./adaptivePose').AnimalProfile,
  options?: { temporalSmoothing?: boolean; confidenceThreshold?: number }
): { angle: CameraAngle; confidence: number; metrics: AngleMetrics; warnings: string[] } {
  const { confidenceThreshold = 0.6 } = options ?? {};
  const metrics = computeAngleMetrics(frame, profile);

  const scores: { angle: CameraAngle; score: number }[] = [
    { angle: 'side', score: scoreSide(metrics) },
    { angle: 'front', score: scoreFront(metrics) },
    { angle: 'rear', score: scoreRear(metrics) },
    { angle: 'overhead', score: scoreOverhead(metrics) },
    { angle: 'oblique-front', score: scoreObliqueFront(metrics) },
    { angle: 'oblique-rear', score: scoreObliqueRear(metrics) },
    { angle: 'unknown', score: scoreUnknown(metrics) },
  ];

  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];

  const warnings: string[] = [];
  if (metrics.limbVisibilityRatio < 0.3) warnings.push('Fewer than 2 limbs visible — partial view or occlusion');
  if (metrics.lateralSpread < 0.05) warnings.push('Body highly compressed — likely frontal view with limited stride info');
  if (Math.abs(metrics.spineVerticality - 0.5) < 0.1) warnings.push('Spine axis ambiguous — consider 2+ frames for angle confidence');
  if (metrics.perspectiveDepth > 0.15) warnings.push('Significant perspective depth — may indicate oblique or overhead angle');

  return {
    angle: best.score >= confidenceThreshold ? best.angle : 'unknown',
    confidence: best.score,
    metrics,
    warnings,
  };
}

// === Scoring heuristics ===

function scoreSide(m: AngleMetrics): number {
  let s = 0;
  if (m.lateralSpread > 0.35) s += 0.5;
  else if (m.lateralSpread > 0.20) s += 0.3;
  else if (m.lateralSpread > 0.10) s += 0.1;

  const spineScore = 1 - Math.abs(m.spineVerticality - 0.1);
  s += spineScore * 0.2;

  const noseTail = Math.abs(m.noseLateralOffset) + Math.abs(m.tailLateralOffset);
  if (noseTail > 0.25) s += 0.2;

  if (m.perspectiveDepth < 0.05) s += 0.1;
  return Math.min(1, s);
}

function scoreFront(m: AngleMetrics): number {
  let s = 0;
  if (m.lateralSpread < 0.15) s += 0.4;
  else if (m.lateralSpread < 0.25) s += 0.2;

  if (Math.abs(m.noseLateralOffset) > 0.20) s += 0.3;

  const spineScore = 1 - Math.abs(m.spineVerticality - 0.85);
  s += spineScore * 0.2;

  if (m.aspectRatio > 1.5) s += 0.1;
  return Math.min(1, s);
}

function scoreRear(m: AngleMetrics): number {
  let s = 0;
  if (m.lateralSpread < 0.15) s += 0.4;
  else if (m.lateralSpread < 0.25) s += 0.2;
  if (Math.abs(m.tailLateralOffset) > 0.20) s += 0.3;
  const spineScore = 1 - Math.abs(m.spineVerticality - 0.85);
  s += spineScore * 0.2;
  return Math.min(1, s);
}

function scoreOverhead(m: AngleMetrics): number {
  let s = 0;
  const centerSpread = Math.sqrt(m.lateralSpread ** 2 + (m.aspectRatio - 1) ** 2);
  if (centerSpread < 0.2) s += 0.3;
  if (m.perspectiveDepth > 0.15) s += 0.3;
  if (m.aspectRatio < 0.7) s += 0.2;
  if (m.limbVisibilityRatio > 0.75) s += 0.2;
  return Math.min(1, s);
}

function scoreObliqueFront(m: AngleMetrics): number {
  let s = 0;
  if (m.lateralSpread >= 0.15 && m.lateralSpread <= 0.35) s += 0.4;
  if (Math.abs(m.noseLateralOffset) > 0.10 && Math.abs(m.noseLateralOffset) < 0.25) s += 0.3;
  if (m.perspectiveDepth >= 0.05 && m.perspectiveDepth <= 0.20) s += 0.2;
  if (m.spineVerticality > 0.2 && m.spineVerticality < 0.7) s += 0.1;
  return Math.min(1, s);
}

function scoreObliqueRear(m: AngleMetrics): number {
  let s = 0;
  if (m.lateralSpread >= 0.15 && m.lateralSpread <= 0.35) s += 0.4;
  if (Math.abs(m.tailLateralOffset) > 0.10 && Math.abs(m.tailLateralOffset) < 0.25) s += 0.3;
  if (m.perspectiveDepth >= 0.05 && m.perspectiveDepth <= 0.20) s += 0.2;
  if (m.spineVerticality > 0.2 && m.spineVerticality < 0.7) s += 0.1;
  return Math.min(1, s);
}

function scoreUnknown(m: AngleMetrics): number {
  const max = Math.max(m.lateralSpread, Math.abs(m.noseLateralOffset), Math.abs(m.tailLateralOffset));
  return 1 - Math.min(1, max * 1.5);
}
