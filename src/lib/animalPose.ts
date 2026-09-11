/**
 * Animal pose estimation module.
 *
 * Goal: provide a browser-inference path for quadruped / avian / serpentine
 * keypoint detection that replaces the current MediaPipe-Pose (human model)
 * + human→animal mapping hack in `adaptivePose.ts:463-528`.
 *
 * Status: skeleton. The actual ONNX model acquisition is an offline step
 * (see README of this file). Until the model is wired, the rest of the
 * pipeline continues to work via the MediaPipe fallback.
 *
 * Recommended model: `rtmpose-m_ap10k` from OpenMMLab converted to ONNX
 * (~27 MB fp16, 17-keypoint AP-10K layout). See:
 *   https://github.com/open-mmlab/mmpose  (config: rtmpose-m_8xb256-210e_ap10k-256x256.py)
 *
 * Until the model is acquired, `initAnimalPoseAI()` resolves to `null` and
 * the caller (`Index.tsx`) continues to use `PoseLandmarker` as the source
 * of truth for `poseLandmarkerRef.current`.
 *
 * AP-10K 17-keypoint order (when wired):
 *   0  left_eye      8  left_front_wrist  16 tail
 *   1  right_eye     9  right_front_wrist
 *   2  nose         10  left_hip
 *   3  neck         11  right_hip
 *   4  left_ear     12  left_hind_knee
 *   5  right_ear    13  right_hind_knee
 *   6  left_shoulder 14 left_hind_paw
 *   7  right_shoulder 15 right_hind_paw
 */

const AP10K_KEYPOINT_NAMES: readonly string[] = [
  'left_eye',
  'right_eye',
  'nose',
  'neck',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_front_wrist',
  'right_front_wrist',
  'left_hip',
  'right_hip',
  'left_hind_knee',
  'left_hind_paw',
  'right_hind_paw',
  'tail',
] as const;

const state: { session: unknown; initializing: boolean } = { session: null, initializing: false };

export interface AnimalKeypoint {
  id: string;
  x: number;
  y: number;
  score: number;
}

/**
 * Initialize the animal-pose ONNX session. Currently a no-op that resolves to
 * `null` until the ONNX model is acquired. To enable:
 *   1. Add `onnxruntime-web` to package.json (already transitively present).
 *   2. Convert rtmpose-m_ap10k .pth to .onnx (mmdeploy or torch.onnx.export).
 *   3. Quantize to int8 (~7 MB) and host on Supabase Storage / CDN.
 *   4. Replace the body of this function with:
 *        const { env, InferenceSession, Tensor } = await import('onnxruntime-web');
 *        env.wasm.wasmPaths = '<cdn-path>/';
 *        state.session = await InferenceSession.create('<model-url>', {
 *          executionProviders: ['webgpu', 'wasm'],
 *          graphOptimizationLevel: 'all',
 *        });
 *   5. Implement `runAnimalPose()` below to preprocess (resize to 256x256,
 *      mmpose mean/std normalize, NCHW) and call `session.run()`.
 */
export async function initAnimalPoseAI(): Promise<unknown | null> {
  if (state.session) return state.session;
  if (state.initializing) return null;
  state.initializing = true;
  try {
    // TODO: replace with ONNX session creation once model is available.
    console.info('[animalPose] ONNX model not yet acquired — using MediaPipe fallback.');
  } catch (e) {
    console.error('[animalPose] init failed:', e);
  } finally {
    state.initializing = false;
  }
  return state.session;
}

/**
 * Run animal-pose inference on a 256x256 crop of the animal ROI.
 * Returns the 17 AP-10K keypoints in image-normalized (0..1) coordinates,
 * or `null` until the model is wired.
 */
export async function runAnimalPose(_croppedDataUrl: string): Promise<AnimalKeypoint[] | null> {
  if (!state.session) {
    await initAnimalPoseAI();
  }
  if (!state.session) return null;
  // TODO: preprocess → session.run → SimCC decode → return keypoints.
  return null;
}

export const ANIMAL_KEYPOINT_NAMES = AP10K_KEYPOINT_NAMES;
