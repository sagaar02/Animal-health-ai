import type { AnatomyClass } from './adaptivePose';

export interface GaitBaseline {
  normalStrideHz: [number, number];
  symmetryThreshold: number;
  lamenessThresholds: {
    mild: number;
    moderate: number;
    severe: number;
  };
  expectedAnatomy: AnatomyClass;
  notes?: string;
  typicalWeightKg?: [number, number];
}

export type GradingScaleKey = 'AAEP_EQUINE' | 'CANINE_VAS' | 'FELINE_MOS' | 'BOVINE_LS' | 'GENERIC';

export interface GradingLevel {
  grade: string;
  label: string;
  description: string;
  minRisk: number;
  maxRisk: number;
}

export interface GradingScale {
  key: GradingScaleKey;
  name: string;
  levels: GradingLevel[];
  speciesHint: string;
}

export const SPECIES_GAIT_BASELINES: Record<string, GaitBaseline> = {
  Dog: {
    normalStrideHz: [2.5, 4.5],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 25, moderate: 50, severe: 72 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [3, 70],
  },
  Cat: {
    normalStrideHz: [3.0, 5.2],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 22, moderate: 48, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [3, 9],
  },
  Horse: {
    normalStrideHz: [1.2, 3.0],
    symmetryThreshold: 0.93,
    lamenessThresholds: { mild: 20, moderate: 45, severe: 68 },
    expectedAnatomy: 'quadruped',
    notes: 'AAEP 0-5 grading scale applies at trot evaluation; stride rates < 1 Hz indicates pathology',
    typicalWeightKg: [380, 600],
  },
  Pony: {
    normalStrideHz: [1.5, 3.4],
    symmetryThreshold: 0.92,
    lamenessThresholds: { mild: 20, moderate: 45, severe: 68 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [100, 350],
  },
  Cow: {
    normalStrideHz: [0.6, 1.8],
    symmetryThreshold: 0.87,
    lamenessThresholds: { mild: 28, moderate: 52, severe: 75 },
    expectedAnatomy: 'quadruped',
    notes: 'Locomotion Score 1-5 (Sprecher scale); walk 3+ requires intervention',
    typicalWeightKg: [450, 1000],
  },
  Goat: {
    normalStrideHz: [1.4, 3.2],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 72 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [20, 140],
  },
  Sheep: {
    normalStrideHz: [1.2, 2.8],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 28, moderate: 52, severe: 75 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [25, 200],
  },
  Pig: {
    normalStrideHz: [0.9, 2.2],
    symmetryThreshold: 0.86,
    lamenessThresholds: { mild: 30, moderate: 55, severe: 75 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [50, 350],
  },
  Deer: {
    normalStrideHz: [1.8, 3.8],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 24, moderate: 48, severe: 70 },
    expectedAnatomy: 'quadruped',
  },
  Camel: {
    normalStrideHz: [0.7, 2.0],
    symmetryThreshold: 0.87,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 72 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [300, 1000],
  },
  Llama: {
    normalStrideHz: [1.2, 2.8],
    symmetryThreshold: 0.89,
    lamenessThresholds: { mild: 24, moderate: 48, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [80, 250],
  },
  Alpaca: {
    normalStrideHz: [1.3, 3.0],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 24, moderate: 48, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [45, 100],
  },
  Rabbit: {
    normalStrideHz: [3.5, 7.0],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 24, moderate: 48, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [1, 8],
  },
  Fox: {
    normalStrideHz: [2.2, 4.2],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 25, moderate: 50, severe: 72 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [3, 14],
  },
  Wolf: {
    normalStrideHz: [2.0, 4.0],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 22, moderate: 46, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [20, 80],
  },
  Lion: {
    normalStrideHz: [1.3, 2.8],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 22, moderate: 46, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [120, 250],
  },
  Tiger: {
    normalStrideHz: [1.2, 2.6],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 22, moderate: 46, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [90, 310],
  },
  Zebra: {
    normalStrideHz: [1.5, 3.6],
    symmetryThreshold: 0.91,
    lamenessThresholds: { mild: 22, moderate: 46, severe: 70 },
    expectedAnatomy: 'quadruped',
  },
  Elephant: {
    normalStrideHz: [0.2, 0.9],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 70 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [2500, 6000],
  },
  Rhinoceros: {
    normalStrideHz: [0.3, 1.2],
    symmetryThreshold: 0.89,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 72 },
    expectedAnatomy: 'quadruped',
    typicalWeightKg: [800, 3500],
  },
  Kangaroo: {
    normalStrideHz: [1.2, 2.8],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 72 },
    expectedAnatomy: 'biped',
  },
  Monkey: {
    normalStrideHz: [1.5, 3.2],
    symmetryThreshold: 0.87,
    lamenessThresholds: { mild: 26, moderate: 50, severe: 72 },
    expectedAnatomy: 'biped',
  },
  Bird: {
    normalStrideHz: [1.8, 4.5],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 25, moderate: 50, severe: 72 },
    expectedAnatomy: 'avian-biped',
  },
  Chicken: {
    normalStrideHz: [2.0, 4.8],
    symmetryThreshold: 0.89,
    lamenessThresholds: { mild: 28, moderate: 52, severe: 75 },
    expectedAnatomy: 'avian-biped',
    typicalWeightKg: [1, 6],
  },
  Duck: {
    normalStrideHz: [1.5, 3.5],
    symmetryThreshold: 0.88,
    lamenessThresholds: { mild: 28, moderate: 52, severe: 75 },
    expectedAnatomy: 'avian-biped',
    typicalWeightKg: [0.5, 5],
  },
  Eagle: {
    normalStrideHz: [1.2, 2.8],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 25, moderate: 50, severe: 72 },
    expectedAnatomy: 'avian-biped',
  },
  Parrot: {
    normalStrideHz: [2.2, 4.2],
    symmetryThreshold: 0.9,
    lamenessThresholds: { mild: 25, moderate: 50, severe: 72 },
    expectedAnatomy: 'avian-biped',
    typicalWeightKg: [0.03, 1.5],
  },
  Snake: {
    normalStrideHz: [0.5, 2.5],
    symmetryThreshold: 0.82,
    lamenessThresholds: { mild: 30, moderate: 55, severe: 75 },
    expectedAnatomy: 'serpentine',
  },
  Fish: {
    normalStrideHz: [0.8, 3.0],
    symmetryThreshold: 0.84,
    lamenessThresholds: { mild: 30, moderate: 55, severe: 75 },
    expectedAnatomy: 'aquatic',
  },
};

export const GENERIC_BASELINE: GaitBaseline = {
  normalStrideHz: [1.0, 4.0],
  symmetryThreshold: 0.85,
  lamenessThresholds: { mild: 28, moderate: 52, severe: 75 },
  expectedAnatomy: 'universal',
};

export function getBaselineForSpecies(species: string): GaitBaseline {
  const exact = SPECIES_GAIT_BASELINES[species];
  if (exact) return exact;
  const keys = Object.keys(SPECIES_GAIT_BASELINES);
  for (const k of keys) {
    if (species.toLowerCase().includes(k.toLowerCase())) {
      return SPECIES_GAIT_BASELINES[k];
    }
  }
  return GENERIC_BASELINE;
}

export const GRADING_SCALES: Record<GradingScaleKey, GradingScale> = {
  AAEP_EQUINE: {
    key: 'AAEP_EQUINE',
    name: 'AAEP Equine Lameness Scale (0-5)',
    speciesHint: 'Horses, Ponies Equines',
    levels: [
      { grade: '0', label: 'Sound', description: 'Lameness not perceptible under any circumstances.', minRisk: 0, maxRisk: 10 },
      { grade: '1', label: 'Difficult to observe', description: 'Lameness difficult to observe; inconsistently, not consistently apparent.', minRisk: 10, maxRisk: 25 },
      { grade: '2', label: 'Mild / Difficult', description: 'Difficult to observe at walk or trot under normal circumstances, consistently apparent under specific circumstances (circling, slope, incline, etc.).', minRisk: 25, maxRisk: 45 },
      { grade: '3', label: 'Moderate / Obvious', description: 'Lameness consistently observable at trot under all circumstances.', minRisk: 45, maxRisk: 68 },
      { grade: '4', label: 'Severe / Marked', description: 'Marked lameness with obvious head nod or hip hike; minimal weight bearing on the affected limb at any gait.', minRisk: 68, maxRisk: 88 },
      { grade: '5', label: 'Non-weight bearing', description: 'Reluctance to move; inability to stand or load the limb; medical emergency.', minRisk: 88, maxRisk: 100 },
    ],
  },
  CANINE_VAS: {
    key: 'CANINE_VAS',
    name: 'Canine Visual Analog Score (0-10)',
    speciesHint: 'Dogs',
    levels: [
      { grade: '0', label: 'Sound', description: 'No signs of lameness observed.', minRisk: 0, maxRisk: 8 },
      { grade: '1-2', label: 'Very mild', description: 'Subtle stiffness; slight shortening of stride length on affected side.', minRisk: 8, maxRisk: 25 },
      { grade: '3-4', label: 'Mild lameness', description: 'Consistent mild lameness at walk or trot; head bobbing.', minRisk: 25, maxRisk: 48 },
      { grade: '5-6', label: 'Moderate lameness', description: 'Clear asymmetry; obvious head nod or hip drop observable at walk.', minRisk: 48, maxRisk: 70 },
      { grade: '7-8', label: 'Severe lameness', description: 'Partial or partial weight bearing; reluctant to trot.', minRisk: 70, maxRisk: 88 },
      { grade: '9-10', label: 'Non-weight bearing', description: 'Non-weight bearing on the limb; needs veterinary intervention.', minRisk: 88, maxRisk: 100 },
    ],
  },
  FELINE_MOS: {
    key: 'FELINE_MOS',
    name: 'Feline Mobility Outcome Score',
    speciesHint: 'Cats',
    levels: [
      { grade: 'Normal', label: 'Excellent', description: 'Jumping, running, playing normally.', minRisk: 0, maxRisk: 18 },
      { grade: 'A', label: 'Mild impairment', description: 'Slight hesitation before jumps; mild stiffness when rising.', minRisk: 18, maxRisk: 38 },
      { grade: 'B', label: 'Moderate', description: 'Reduced ability to climb stairs; slow rise time.', minRisk: 38, maxRisk: 58 },
      { grade: 'C', label: 'Severe', description: 'Avoids jumping entirely; limping clearly visible.', minRisk: 58, maxRisk: 78 },
      { grade: 'D', label: 'Profound', description: 'Difficulty standing; reluctance to move.', minRisk: 78, maxRisk: 100 },
    ],
  },
  BOVINE_LS: {
    key: 'BOVINE_LS',
    name: 'Sprecher Dairy Cow Locomotion Score (1-5)',
    speciesHint: 'Cows Cattle',
    levels: [
      { grade: '1', label: 'Normal / Sound', description: 'Stands and walks with flat back and long fluid strides.', minRisk: 0, maxRisk: 15 },
      { grade: '2', label: 'Mild / Imperfect', description: 'Slightly arched back; gait unaffected strides still fluid.', minRisk: 15, maxRisk: 35 },
      { grade: '3', label: 'Moderately lame', description: 'Arched back standing and walking; short steps, one or more limbs affected.', minRisk: 35, maxRisk: 58 },
      { grade: '4', label: 'Lame', description: 'Arched back; obvious shortened strides; head bob.', minRisk: 58, maxRisk: 82 },
      { grade: '5', label: 'Severely lame', description: 'Reluctance to walk; refusing to bear weight; needs treatment.', minRisk: 82, maxRisk: 100 },
    ],
  },
  GENERIC: {
    key: 'GENERIC',
    name: 'Universal Animal Health Lameness Tier',
    speciesHint: 'All species',
    levels: [
      { grade: 'Green', label: 'No lameness', description: 'Gait is symmetrical, balanced, and within species-typical.', minRisk: 0, maxRisk: 28 },
      { grade: 'Yellow', label: 'Watch / Mild', description: 'Mild asymmetry; may need monitoring or follow-up.', minRisk: 28, maxRisk: 52 },
      { grade: 'Orange', label: 'Moderate', description: 'Clear lameness; veterinary review is recommended.', minRisk: 52, maxRisk: 75 },
      { grade: 'Red', label: 'Severe', description: 'Marked or non-weight-bearing lameness; urgent veterinary care.', minRisk: 75, maxRisk: 100 },
    ],
  },
};

export function pickGradingScale(species: string): GradingScaleKey {
  const s = species.toLowerCase();
  if (s.includes('horse') || s.includes('pony') || s.includes('equine') || s.includes('zebra') || s.includes('donkey') || s.includes('mule')) return 'AAEP_EQUINE';
  if (s.includes('dog') || s.includes('canine') || s.includes('puppy')) return 'CANINE_VAS';
  if (s.includes('cat') || s.includes('feline') || s.includes('kitten')) return 'FELINE_MOS';
  if (s.includes('cow') || s.includes('cattle') || s.includes('bovine') || s.includes('heifer') || s.includes('dairy')) return 'BOVINE_LS';
  return 'GENERIC';
}

export function getLamenessGrade(species: string, riskValue: number): { scale: GradingScale; level: GradingLevel } {
  const scaleKey = pickGradingScale(species);
  const scale = GRADING_SCALES[scaleKey];
  const level = scale.levels.find(l => riskValue >= l.minRisk && riskValue < l.maxRisk) ?? scale.levels[scale.levels.length - 1];
  return { scale, level };
}
