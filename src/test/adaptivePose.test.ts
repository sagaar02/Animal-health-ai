import { describe, expect, it } from 'vitest';
import { computeTemporalMetrics, createPoseFrame, inferAnimalProfile } from '@/lib/adaptivePose';

describe('adaptive animal pose engine', () => {
  it('routes common animals to anatomy-specific models', () => {
    const dog = inferAnimalProfile('border-collie-gait.mp4', { width: 1280, height: 720, duration: 12 });
    const bird = inferAnimalProfile('wild-bird-wing-motion.webm', { width: 720, height: 960, duration: 8 });
    const snake = inferAnimalProfile('snake-lateral-motion.mov', { width: 1280, height: 720, duration: 6 });

    expect(dog.anatomyClass).toBe('quadruped');
    expect(bird.anatomyClass).toBe('avian-biped');
    expect(snake.anatomyClass).toBe('serpentine');
  });

  it('fuses consecutive pose frames into gait metrics and alerts', () => {
    const profile = inferAnimalProfile('horse-gait-review.mp4', { width: 1920, height: 1080, duration: 20 });
    const frames = Array.from({ length: 36 }, (_, index) => createPoseFrame(profile, index / 18, index, 'horse-gait-review.mp4'));
    const metrics = computeTemporalMetrics(frames, profile);

    expect(metrics.frames).toBe(36);
    expect(metrics.confidence).toBeGreaterThan(0.6);
    expect(metrics.trend.length).toBeGreaterThan(2);
    expect(metrics.alerts.length).toBeGreaterThan(0);
  });

  it('calibrates the main review videos into expected clinical ranges', () => {
    const samples = [
      { file: 'Dog.mp4', minHealth: 90, maxLameness: 10, species: 'Dog' },
      { file: 'Lion.mp4', maxHealth: 60, minLameness: 60, species: 'Lion' },
      { file: 'Rhiino.mp4', maxHealth: 42, minLameness: 80, species: 'Rhino' },
    ];

    for (const sample of samples) {
      const profile = inferAnimalProfile(sample.file, { width: 898, height: 506, duration: 8 });
      const frames = Array.from({ length: 48 }, (_, index) => createPoseFrame(profile, index / 18, index, sample.file));
      const metrics = computeTemporalMetrics(frames, profile);

      expect(profile.species).toBe(sample.species);
      if ('minHealth' in sample) expect(metrics.overallHealth).toBeGreaterThanOrEqual(sample.minHealth);
      if ('maxHealth' in sample) expect(metrics.overallHealth).toBeLessThanOrEqual(sample.maxHealth);
      if ('maxLameness' in sample) expect(metrics.lamenessRisk).toBeLessThanOrEqual(sample.maxLameness);
      if ('minLameness' in sample) expect(metrics.lamenessRisk).toBeGreaterThanOrEqual(sample.minLameness);
    }
  });
});
