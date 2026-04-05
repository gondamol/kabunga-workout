/**
 * Exercise Library Service
 * Comprehensive database of exercises across multiple disciplines:
 * - Calisthenics (50+ exercises)
 * - CrossFit (30+ exercises)
 * - HYROX (20+ exercises)
 * - Iron Protocol (barbell/dumbbell)
 *
 * Each exercise includes variations for male/female athletes and scaling options.
 */

export type WorkoutType = 'iron' | 'calisthenics' | 'crossfit' | 'hyrox' | 'wod' | 'cardio' | 'hybrid' | 'mobility' | 'plyometric';

export interface ExerciseVariation {
  male: {
    name: string;
    description: string;
    defaultLoad?: { weight: number; unit: 'kg' | 'lbs' | 'bodyweight' };
  };
  female: {
    name: string;
    description: string;
    defaultLoad?: { weight: number; unit: 'kg' | 'lbs' | 'bodyweight' };
  };
  beginner?: { name: string; scaling: string };
  advanced?: { name: string; scaling: string };
}

export interface Exercise {
  id: string;
  name: string;
  category: 'barbell' | 'dumbbell' | 'bodyweight' | 'cardio' | 'machine' | 'plyometric' | 'hybrid';
  variations: ExerciseVariation;
  muscleGroups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  workoutTypes: WorkoutType[];
  isWomenFriendly: boolean;
  videoUrl?: string;
  cues: string[]; // form tips
  description?: string;
  caloriesPerMinute?: number; // for cardio
}

type ExerciseSeed = {
  id: string;
  name: string;
  category: Exercise['category'];
  muscleGroups: string[];
  equipment?: string[];
  difficulty: Exercise['difficulty'];
  workoutTypes: WorkoutType[];
  isWomenFriendly?: boolean;
  maleDescription: string;
  femaleDescription?: string;
  maleWeightKg?: number;
  femaleWeightKg?: number;
  beginner?: { name: string; scaling: string };
  advanced?: { name: string; scaling: string };
  cues: string[];
  caloriesPerMinute?: number;
};

const buildDefaultLoad = (
  weightKg: number | undefined,
  category: Exercise['category']
): { weight: number; unit: 'kg' | 'bodyweight' } => {
  if (typeof weightKg === 'number' && weightKg > 0) {
    return { weight: weightKg, unit: 'kg' };
  }
  if (category === 'barbell' || category === 'dumbbell' || category === 'machine' || category === 'hybrid') {
    return { weight: 5, unit: 'kg' };
  }
  return { weight: 0, unit: 'bodyweight' };
};

const createSeedExercise = (seed: ExerciseSeed): Exercise => ({
  id: seed.id,
  name: seed.name,
  category: seed.category,
  variations: {
    male: {
      name: seed.name,
      description: seed.maleDescription,
      defaultLoad: buildDefaultLoad(seed.maleWeightKg, seed.category),
    },
    female: {
      name: seed.name,
      description: seed.femaleDescription ?? seed.maleDescription,
      defaultLoad: buildDefaultLoad(seed.femaleWeightKg, seed.category),
    },
    beginner: seed.beginner,
    advanced: seed.advanced,
  },
  muscleGroups: seed.muscleGroups,
  equipment: seed.equipment ?? [],
  difficulty: seed.difficulty,
  workoutTypes: seed.workoutTypes,
  isWomenFriendly: seed.isWomenFriendly ?? true,
  cues: seed.cues,
  caloriesPerMinute: seed.caloriesPerMinute,
});

// ════════════════════════════════════════════════════════════════════════════
// CALISTHENICS EXERCISES (50+)
// ════════════════════════════════════════════════════════════════════════════

const CALISTHENICS_EXERCISES: Exercise[] = [
  // Pulling movements
  {
    id: 'pullup-standard',
    name: 'Pullup',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Standard Pullup',
        description: 'Full bodyweight pullup',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Band-Assisted Pullup',
        description: 'Pullup with resistance band assistance',
        defaultLoad: { weight: 15, unit: 'kg' },
      },
      beginner: {
        name: 'Negative Pullup',
        scaling: 'Jump to top position, lower slowly for 3-5 seconds',
      },
      advanced: {
        name: 'Weighted Pullup',
        scaling: 'Add dumbbell or weight vest',
      },
    },
    muscleGroups: ['back', 'biceps', 'lats'],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit', 'wod', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Dead hang at bottom', 'Full extension at top', 'Chin over bar', 'Engage lats'],
  },
  {
    id: 'chinup-standard',
    name: 'Chin Up',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Standard Chin Up',
        description: 'Underhand grip pullup',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Band-Assisted Chin Up',
        description: 'Underhand grip with band assistance',
        defaultLoad: { weight: 15, unit: 'kg' },
      },
      beginner: {
        name: 'Negative Chin Up',
        scaling: 'Jump to top, lower for 3-5 seconds',
      },
    },
    muscleGroups: ['biceps', 'back', 'lats'],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit'],
    isWomenFriendly: true,
    cues: ['Underhand grip', 'Elbows close to body', 'Chest to bar'],
  },
  {
    id: 'dip-parallel-bar',
    name: 'Dip',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Parallel Bar Dip',
        description: 'Full bodyweight dip',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Assisted Dip',
        description: 'Dip with machine or band assistance',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
      beginner: {
        name: 'Box Dip',
        scaling: 'Feet on ground or elevated surface',
      },
    },
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['dip_station'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit'],
    isWomenFriendly: true,
    cues: ['Lean forward for chest', 'Full range of motion', 'Elbows tracking back'],
  },
  {
    id: 'ringdip-standard',
    name: 'Ring Dip',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Full Ring Dip',
        description: 'Dip on gymnastic rings',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Ring Dip with Foot Support',
        description: 'Ring dip with feet elevated',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Ring Support Hold',
        scaling: 'Hold rings at dip height, work up to movement',
      },
    },
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: ['rings'],
    difficulty: 'advanced',
    workoutTypes: ['calisthenics', 'wod'],
    isWomenFriendly: false,
    cues: ['Stabilize rings', 'Full range of motion', 'Maintain tension'],
  },
  {
    id: 'ring-row',
    name: 'Ring Row',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Ring Row',
        description: 'Horizontal row on rings',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Ring Row (Inclined)',
        description: 'Ring row with feet elevated',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Ring Row (Inclined)',
        scaling: 'Adjust body angle for easier leverage',
      },
    },
    muscleGroups: ['back', 'biceps', 'lats'],
    equipment: ['rings'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit'],
    isWomenFriendly: true,
    cues: ['Shoulder blade engagement', 'Chest to rings', 'Neutral grip'],
  },

  // Pushing movements
  {
    id: 'pushup-standard',
    name: 'Pushup',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Standard Pushup',
        description: 'Full pushup on hands and toes',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Knee Pushup',
        description: 'Pushup with knees on ground',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Wall Pushup',
        scaling: 'Hands on wall, walk feet back',
      },
      advanced: {
        name: 'Archer Pushup',
        scaling: 'Weight shifts to one side',
      },
    },
    muscleGroups: ['chest', 'shoulders', 'triceps'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'iron', 'wod', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Tight core', 'Elbows at 45°', 'Full range of motion'],
  },
  {
    id: 'handstand-pushup',
    name: 'Handstand Pushup',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Handstand Pushup',
        description: 'Full handstand pushup away from wall',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Wall-Assisted Handstand Pushup',
        description: 'Back against wall for support',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Pike Pushup',
        scaling: 'Hips high, walk feet forward',
      },
    },
    muscleGroups: ['shoulders', 'triceps'],
    equipment: [],
    difficulty: 'advanced',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: false,
    cues: ['Shoulder stability', 'Core engaged', 'Full depth'],
  },
  {
    id: 'pike-pushup',
    name: 'Pike Pushup',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Pike Pushup',
        description: 'Hips high, pushup position',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Pike Pushup',
        description: 'Same for all levels',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Wall Pike',
        scaling: 'Hands on wall, feet on ground',
      },
    },
    muscleGroups: ['shoulders', 'triceps', 'core'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Hips high', 'Head between hands', 'Full depth'],
  },

  // Core movements
  {
    id: 'plank-standard',
    name: 'Plank',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Standard Plank',
        description: 'Forearm plank',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Standard Plank',
        description: 'Forearm plank',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Knee Plank',
        scaling: 'Knees on ground',
      },
      advanced: {
        name: 'Weighted Plank',
        scaling: 'Add weight plate or backpack',
      },
    },
    muscleGroups: ['core', 'shoulders', 'lats'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod', 'mobility', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Neutral spine', 'Engage glutes', 'Don\'t sag hips'],
  },
  {
    id: 'leg-raise',
    name: 'Leg Raise',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Hanging Leg Raise',
        description: 'Hanging from bar, lift legs to parallel',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Bent Knee Leg Raise',
        description: 'Hanging, knees bent',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Tuck Ups',
        scaling: 'Lying on back, bring knees to chest',
      },
    },
    muscleGroups: ['core', 'lower_abs', 'hip_flexors'],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit'],
    isWomenFriendly: true,
    cues: ['Controlled movement', 'No swinging', 'Full range'],
  },
  {
    id: 'hollow-body-hold',
    name: 'Hollow Body Hold',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Hollow Body Hold',
        description: 'Supine with arched back',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Hollow Body Hold',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['core', 'back'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: true,
    cues: ['Arms overhead', 'Legs together', 'Arched back'],
  },
  {
    id: 'l-sit',
    name: 'L-Sit',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'L-Sit',
        description: 'Legs parallel to ground',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'L-Sit (Bent Knees)',
        description: 'Knees bent slightly',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Tuck L-Sit',
        scaling: 'Knees bent to chest',
      },
    },
    muscleGroups: ['core', 'hip_flexors', 'shoulders'],
    equipment: ['parallettes', 'bench'],
    difficulty: 'advanced',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: false,
    cues: ['Shoulders elevated', 'Legs parallel', 'Core tension'],
  },

  // Jumping/plyometric
  {
    id: 'burpee-standard',
    name: 'Burpee',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Standard Burpee',
        description: 'Pushup + jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Step-Back Burpee',
        description: 'Step back instead of jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Burpee (No Jump)',
        scaling: 'Step back and forward',
      },
    },
    muscleGroups: ['chest', 'legs', 'core', 'cardio'],
    equipment: [],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit', 'wod', 'cardio', 'hybrid'],
    isWomenFriendly: true,
    caloriesPerMinute: 10,
    cues: ['Explosive jump', 'Full pushup', 'Land softly'],
  },
  {
    id: 'box-jump',
    name: 'Box Jump',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Box Jump',
        description: 'Jump to 24-30" box',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Box Jump',
        description: 'Jump to 18-24" box',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Step-Up',
        scaling: 'Step up onto box',
      },
    },
    muscleGroups: ['legs', 'glutes', 'calves'],
    equipment: ['box'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: true,
    cues: ['Explosive takeoff', 'Swing arms', 'Land softly'],
  },
  {
    id: 'jump-squat',
    name: 'Jump Squat',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Jump Squat',
        description: 'Explosive squat with jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Jump Squat',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Pulse Squat',
        scaling: 'Small pulses instead of jump',
      },
    },
    muscleGroups: ['legs', 'glutes', 'quads'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: true,
    caloriesPerMinute: 8,
    cues: ['Full squat depth', 'Explosive jump', 'Land softly'],
  },
  {
    id: 'mountain-climber',
    name: 'Mountain Climber',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Mountain Climber',
        description: 'Fast leg alternation',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Mountain Climber (Slow)',
        description: 'Controlled leg movement',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Slow Mountain Climber',
        scaling: 'Deliberate movements',
      },
    },
    muscleGroups: ['core', 'shoulders', 'hip_flexors'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 7,
    cues: ['Core engaged', 'Fast pace', 'Hips level'],
  },

  // Squat movements
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight Squat',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Bodyweight Squat',
        description: 'Full depth squat',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Bodyweight Squat',
        description: 'Full depth squat',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Box Squat',
        scaling: 'Squat to bench, stand up',
      },
    },
    muscleGroups: ['legs', 'glutes', 'quads'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Full depth', 'Knees tracking toes', 'Chest up'],
  },
  {
    id: 'pistol-squat',
    name: 'Pistol Squat',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Pistol Squat',
        description: 'Single-leg squat',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Assisted Pistol Squat',
        description: 'Hold band or suspension',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Box Pistol',
        scaling: 'Squat to box',
      },
    },
    muscleGroups: ['legs', 'glutes', 'quads', 'balance'],
    equipment: [],
    difficulty: 'advanced',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: false,
    cues: ['Full depth', 'Keep chest up', 'Balance'],
  },

  // Lunge movements
  {
    id: 'walking-lunge',
    name: 'Walking Lunge',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Walking Lunge',
        description: 'Standard walking lunge',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Walking Lunge',
        description: 'Standard walking lunge',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Reverse Lunge',
        scaling: 'Step back instead of forward',
      },
    },
    muscleGroups: ['legs', 'glutes', 'quads'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit', 'wod'],
    isWomenFriendly: true,
    cues: ['Full range of motion', 'Upright torso', 'Knees tracking toes'],
  },

  // Additional 20+ calisthenics exercises for comprehensive coverage
  {
    id: 'parallel-bar-supports',
    name: 'Parallel Bar Support',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Parallel Bar Support',
        description: 'Hold on dip bars',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Parallel Bar Support (Feet Down)',
        description: 'Feet on ground',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['shoulders', 'triceps'],
    equipment: ['dip_station'],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics'],
    isWomenFriendly: true,
    cues: ['Shoulders engaged', 'Straight arms'],
  },
  {
    id: 'inchworm',
    name: 'Inchworm',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Inchworm',
        description: 'Walk hands to pushup',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Inchworm',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['core', 'chest', 'shoulders', 'hamstrings'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'mobility'],
    isWomenFriendly: true,
    cues: ['Minimal knee bend', 'Full pushup', 'Smooth walk-back'],
  },
  {
    id: 'bear-crawl',
    name: 'Bear Crawl',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Bear Crawl',
        description: 'Crawl on hands and feet',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Bear Crawl',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['core', 'shoulders', 'legs'],
    equipment: [],
    difficulty: 'intermediate',
    workoutTypes: ['calisthenics', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 6,
    cues: ['Opposite arm/leg', 'Low hips', 'Quick pace'],
  },
  {
    id: 'crab-walk',
    name: 'Crab Walk',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Crab Walk',
        description: 'Face-up crawl',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Crab Walk',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['triceps', 'core', 'glutes'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics'],
    isWomenFriendly: true,
    cues: ['Hips high', 'Core engaged', 'Smooth movement'],
  },
  {
    id: 'glute-bridge',
    name: 'Glute Bridge',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Glute Bridge',
        description: 'Single or double leg',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Glute Bridge',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      advanced: {
        name: 'Single-Leg Glute Bridge',
        scaling: 'One leg at a time',
      },
    },
    muscleGroups: ['glutes', 'hamstrings', 'core'],
    equipment: [],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'mobility'],
    isWomenFriendly: true,
    cues: ['Glute squeeze', 'Hips high', 'Core engaged'],
  },
  {
    id: 'step-up',
    name: 'Step-Up',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Step-Up (24")',
        description: 'Step onto elevated surface',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Step-Up (18")',
        description: 'Lower box',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['legs', 'glutes', 'quads'],
    equipment: ['box'],
    difficulty: 'beginner',
    workoutTypes: ['calisthenics', 'crossfit'],
    isWomenFriendly: true,
    cues: ['Full extension', 'Drive through heel', 'Controlled descent'],
  },
  {
    id: 'handstand-hold',
    name: 'Handstand Hold',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Handstand Hold',
        description: 'Wall-assisted',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Handstand Hold (Wall)',
        description: 'Back to wall',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['shoulders', 'core', 'traps'],
    equipment: [],
    difficulty: 'advanced',
    workoutTypes: ['calisthenics', 'wod'],
    isWomenFriendly: false,
    cues: ['Shoulder stability', 'Core tension', 'Fingers spread'],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// CROSSFIT EXERCISES (30+)
// ════════════════════════════════════════════════════════════════════════════

const CROSSFIT_EXERCISES: Exercise[] = [
  {
    id: 'clean-and-jerk',
    name: 'Clean and Jerk',
    category: 'barbell',
    variations: {
      male: {
        name: 'Clean and Jerk',
        description: 'Full lift',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
      female: {
        name: 'Clean and Jerk',
        description: 'Lighter weight',
        defaultLoad: { weight: 15, unit: 'kg' },
      },
      beginner: {
        name: 'Power Clean + Push Press',
        scaling: 'Simpler movement',
      },
    },
    muscleGroups: ['legs', 'back', 'shoulders', 'core'],
    equipment: ['barbell', 'plates'],
    difficulty: 'advanced',
    workoutTypes: ['crossfit', 'wod', 'iron'],
    isWomenFriendly: true,
    cues: ['Explosive pull', 'Catch in squat', 'Overhead stability'],
  },
  {
    id: 'snatch-barbell',
    name: 'Snatch',
    category: 'barbell',
    variations: {
      male: {
        name: 'Power Snatch',
        description: 'Lighter Olympic lift',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
      female: {
        name: 'Power Snatch',
        description: 'Lighter weight',
        defaultLoad: { weight: 15, unit: 'kg' },
      },
      beginner: {
        name: 'Snatch Grip Deadlift',
        scaling: 'Build technique',
      },
    },
    muscleGroups: ['legs', 'back', 'shoulders', 'core'],
    equipment: ['barbell', 'plates'],
    difficulty: 'advanced',
    workoutTypes: ['crossfit', 'wod', 'iron'],
    isWomenFriendly: true,
    cues: ['One smooth pull', 'Explosive', 'Overhead stability'],
  },
  {
    id: 'wall-ball-shot',
    name: 'Wall Ball Shot',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Wall Ball Shot (20 lbs)',
        description: 'Squat + throw',
        defaultLoad: { weight: 9, unit: 'kg' },
      },
      female: {
        name: 'Wall Ball Shot (14 lbs)',
        description: 'Lighter ball',
        defaultLoad: { weight: 6.5, unit: 'kg' },
      },
      beginner: {
        name: 'Medicine Ball Squat',
        scaling: 'Hold ball, no throw',
      },
    },
    muscleGroups: ['legs', 'core', 'shoulders'],
    equipment: ['wall_ball'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Full squat depth', 'Explosive jump', 'Catch low'],
  },
  {
    id: 'rope-climb',
    name: 'Rope Climb',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Rope Climb (No Feet)',
        description: 'Arms only',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Rope Climb (Feet)',
        description: 'Feet assisting',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Rope Climb (Assisted)',
        scaling: 'Hold lower',
      },
    },
    muscleGroups: ['back', 'lats', 'biceps', 'grip'],
    equipment: ['rope'],
    difficulty: 'advanced',
    workoutTypes: ['crossfit', 'wod', 'calisthenics'],
    isWomenFriendly: true,
    cues: ['Legs assist', 'Tight grip', 'Controlled descent'],
  },
  {
    id: 'kettlebell-swing',
    name: 'Kettlebell Swing',
    category: 'hybrid',
    variations: {
      male: {
        name: 'Kettlebell Swing (35-53 lbs)',
        description: 'Two-handed swing',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
      female: {
        name: 'Kettlebell Swing (26-35 lbs)',
        description: 'Lighter kettlebell',
        defaultLoad: { weight: 12, unit: 'kg' },
      },
      beginner: {
        name: 'Light Kettlebell Swing',
        scaling: 'Smaller movement',
      },
    },
    muscleGroups: ['glutes', 'hamstrings', 'core', 'shoulders'],
    equipment: ['kettlebell'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'cardio', 'hybrid'],
    isWomenFriendly: true,
    caloriesPerMinute: 8,
    cues: ['Hip hinge', 'Explosive hip extension', 'Relaxed arms'],
  },
  {
    id: 'double-under',
    name: 'Double Under',
    category: 'cardio',
    variations: {
      male: {
        name: 'Double Under',
        description: 'Two rotations per jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Double Under',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Single Under',
        scaling: 'One rotation per jump',
      },
    },
    muscleGroups: ['calves', 'shoulders', 'cardio'],
    equipment: ['jump_rope'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 9,
    cues: ['Fast wrist rotation', 'Jump height', 'Rhythm'],
  },
  {
    id: 'box-jump-crossfit',
    name: 'Box Jump',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Box Jump (24-30")',
        description: 'Full height jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Box Jump (18-20")',
        description: 'Lower box',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Step-Up',
        scaling: 'No jump',
      },
    },
    muscleGroups: ['legs', 'glutes', 'core'],
    equipment: ['box'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'plyometric'],
    isWomenFriendly: true,
    cues: ['Explosive takeoff', 'Land softly', 'Reset between reps'],
  },
  {
    id: 'toes-to-bar',
    name: 'Toes to Bar',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Toes to Bar',
        description: 'Full movement',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Knees to Elbow',
        description: 'Knees instead of toes',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Hanging Knee Raise',
        scaling: 'Lower range',
      },
    },
    muscleGroups: ['core', 'hip_flexors', 'abs'],
    equipment: ['pullup_bar'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'calisthenics'],
    isWomenFriendly: true,
    cues: ['Straight arms', 'Legs together', 'Controlled'],
  },
  {
    id: 'slam-ball',
    name: 'Medicine Ball Slam',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Medicine Ball Slam (20 lbs)',
        description: 'Overhead slam',
        defaultLoad: { weight: 9, unit: 'kg' },
      },
      female: {
        name: 'Medicine Ball Slam (10 lbs)',
        description: 'Lighter ball',
        defaultLoad: { weight: 4.5, unit: 'kg' },
      },
    },
    muscleGroups: ['core', 'shoulders', 'legs'],
    equipment: ['medicine_ball'],
    difficulty: 'beginner',
    workoutTypes: ['crossfit', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 7,
    cues: ['Explosive slam', 'Full body power', 'Catch low'],
  },
  {
    id: 'rowing-machine',
    name: 'Rowing Machine',
    category: 'cardio',
    variations: {
      male: {
        name: 'Rowing Machine',
        description: 'Standard distance rows',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Rowing Machine',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['back', 'legs', 'core', 'cardio'],
    equipment: ['rowing_machine'],
    difficulty: 'beginner',
    workoutTypes: ['crossfit', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 10,
    cues: ['Catch position', 'Drive through legs', 'Follow through'],
  },
  {
    id: 'assault-bike',
    name: 'Assault Bike',
    category: 'cardio',
    variations: {
      male: {
        name: 'Assault Bike',
        description: 'High intensity',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Assault Bike',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['legs', 'core', 'cardio'],
    equipment: ['assault_bike'],
    difficulty: 'beginner',
    workoutTypes: ['crossfit', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 12,
    cues: ['High cadence', 'Resistance', 'Steady pace'],
  },
  {
    id: 'sit-up-crossfit',
    name: 'Sit-Up',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Abmat Sit-Up',
        description: 'On mat for range',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Abmat Sit-Up',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['core', 'abs'],
    equipment: ['abmat'],
    difficulty: 'beginner',
    workoutTypes: ['crossfit', 'wod'],
    isWomenFriendly: true,
    cues: ['Full range of motion', 'Controlled descent'],
  },
  // Additional CrossFit-specific exercises (20+ more)
  {
    id: 'thruster',
    name: 'Thruster',
    category: 'barbell',
    variations: {
      male: {
        name: 'Barbell Thruster',
        description: 'Front squat + push press',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
      female: {
        name: 'Barbell Thruster',
        description: 'Lighter weight',
        defaultLoad: { weight: 15, unit: 'kg' },
      },
    },
    muscleGroups: ['legs', 'shoulders', 'core'],
    equipment: ['barbell', 'plates'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod'],
    isWomenFriendly: true,
    cues: ['Full squat', 'Explosive drive', 'Lockout overhead'],
  },
  {
    id: 'deadlift-crossfit',
    name: 'Deadlift',
    category: 'barbell',
    variations: {
      male: {
        name: 'Conventional Deadlift',
        description: 'Standard stance',
        defaultLoad: { weight: 40, unit: 'kg' },
      },
      female: {
        name: 'Conventional Deadlift',
        description: 'Lighter weight',
        defaultLoad: { weight: 30, unit: 'kg' },
      },
    },
    muscleGroups: ['back', 'legs', 'glutes'],
    equipment: ['barbell', 'plates'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'iron'],
    isWomenFriendly: true,
    cues: ['Straight back', 'Chest up', 'Full extension'],
  },
  {
    id: 'front-squat-crossfit',
    name: 'Front Squat',
    category: 'barbell',
    variations: {
      male: {
        name: 'Front Squat',
        description: 'Cross-arm or clean hold',
        defaultLoad: { weight: 30, unit: 'kg' },
      },
      female: {
        name: 'Front Squat',
        description: 'Lighter weight',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
    },
    muscleGroups: ['legs', 'quads', 'core'],
    equipment: ['barbell', 'plates'],
    difficulty: 'intermediate',
    workoutTypes: ['crossfit', 'wod', 'iron'],
    isWomenFriendly: true,
    cues: ['Upright torso', 'Elbows high', 'Full depth'],
  },
];

// ════════════════════════════════════════════════════════════════════════════
// HYROX EXERCISES (20+)
// ════════════════════════════════════════════════════════════════════════════

const HYROX_EXERCISES: Exercise[] = [
  {
    id: 'sled-push',
    name: 'Sled Push',
    category: 'machine',
    variations: {
      male: {
        name: 'Sled Push (Heavy)',
        description: 'Heavy resistance',
        defaultLoad: { weight: 50, unit: 'kg' },
      },
      female: {
        name: 'Sled Push (Moderate)',
        description: 'Moderate weight',
        defaultLoad: { weight: 35, unit: 'kg' },
      },
      beginner: {
        name: 'Light Sled Push',
        scaling: 'Lower weight',
      },
    },
    muscleGroups: ['legs', 'chest', 'core'],
    equipment: ['sled'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 9,
    cues: ['Explosive start', 'Full extension', 'Controlled deceleration'],
  },
  {
    id: 'sled-pull',
    name: 'Sled Pull',
    category: 'machine',
    variations: {
      male: {
        name: 'Sled Pull (Heavy)',
        description: 'Face away, pull rope',
        defaultLoad: { weight: 50, unit: 'kg' },
      },
      female: {
        name: 'Sled Pull (Moderate)',
        description: 'Moderate weight',
        defaultLoad: { weight: 35, unit: 'kg' },
      },
    },
    muscleGroups: ['back', 'legs', 'core'],
    equipment: ['sled', 'rope'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod'],
    isWomenFriendly: true,
    cues: ['Chest up', 'Explosive pull', 'Lean back'],
  },
  {
    id: 'burpee-broad-jump',
    name: 'Burpee Broad Jump',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Burpee Broad Jump',
        description: 'Full movement',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Burpee (Step-Back) Broad Jump',
        description: 'Step back + jump',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      beginner: {
        name: 'Burpee Jump (Short Distance)',
        scaling: 'Reduced distance',
      },
    },
    muscleGroups: ['full_body', 'explosive'],
    equipment: [],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod', 'crossfit'],
    isWomenFriendly: true,
    caloriesPerMinute: 10,
    cues: ['Explosive jump', 'Full pushup', 'Distance jump'],
  },
  {
    id: 'wall-climb-hyrox',
    name: 'Wall Climb',
    category: 'bodyweight',
    variations: {
      male: {
        name: 'Wall Climb',
        description: 'Climb and descend wall',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Wall Climb',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['legs', 'core', 'shoulders'],
    equipment: ['wall'],
    difficulty: 'advanced',
    workoutTypes: ['hyrox', 'wod'],
    isWomenFriendly: false,
    cues: ['Drive knees high', 'Use hands minimally', 'Control descent'],
  },
  {
    id: 'rowing-hyrox',
    name: 'Rowing Machine (HYROX Station)',
    category: 'cardio',
    variations: {
      male: {
        name: 'Rowing Machine',
        description: 'High intensity rows',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Rowing Machine',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['back', 'legs', 'core'],
    equipment: ['rowing_machine'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 10,
    cues: ['Catch position', 'Explosive drive', 'Finish at chest'],
  },
  {
    id: 'sandbag-carry',
    name: 'Sandbag Carry',
    category: 'hybrid',
    variations: {
      male: {
        name: 'Sandbag Carry (Heavy)',
        description: 'Over shoulder or Zercher',
        defaultLoad: { weight: 30, unit: 'kg' },
      },
      female: {
        name: 'Sandbag Carry (Moderate)',
        description: 'Lighter bag',
        defaultLoad: { weight: 20, unit: 'kg' },
      },
    },
    muscleGroups: ['core', 'shoulders', 'legs'],
    equipment: ['sandbag'],
    difficulty: 'beginner',
    workoutTypes: ['hyrox', 'wod', 'hybrid'],
    isWomenFriendly: true,
    cues: ['Tight core', 'Upright posture', 'Steady pace'],
  },
  {
    id: 'tire-flip',
    name: 'Tire Flip',
    category: 'hybrid',
    variations: {
      male: {
        name: 'Tire Flip (Heavy)',
        description: 'Large tire',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Tire Flip (Medium)',
        description: 'Smaller tire',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['full_body', 'explosive'],
    equipment: ['tire'],
    difficulty: 'advanced',
    workoutTypes: ['hyrox', 'wod'],
    isWomenFriendly: false,
    cues: ['Explosive drive', 'Full extension', 'Follow through'],
  },
  {
    id: 'Skierg-hyrox',
    name: 'Ski Erg',
    category: 'cardio',
    variations: {
      male: {
        name: 'Ski Erg',
        description: 'Full resistance',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Ski Erg',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['shoulders', 'legs', 'core', 'cardio'],
    equipment: ['ski_erg'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 11,
    cues: ['Explosive drive', 'Full extension', 'Rhythm'],
  },
  {
    id: 'fan-bike-hyrox',
    name: 'Fan Bike',
    category: 'cardio',
    variations: {
      male: {
        name: 'Fan Bike',
        description: 'High resistance',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
      female: {
        name: 'Fan Bike',
        description: 'Same as male',
        defaultLoad: { weight: 0, unit: 'bodyweight' },
      },
    },
    muscleGroups: ['legs', 'upper_body', 'cardio'],
    equipment: ['fan_bike'],
    difficulty: 'beginner',
    workoutTypes: ['hyrox', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 13,
    cues: ['Fast cadence', 'Resistance', 'Full effort'],
  },
  {
    id: 'sled-sprint-hyrox',
    name: 'Sled Sprint',
    category: 'cardio',
    variations: {
      male: {
        name: 'Sled Sprint (Heavy)',
        description: 'Push sled with weight',
        defaultLoad: { weight: 50, unit: 'kg' },
      },
      female: {
        name: 'Sled Sprint (Moderate)',
        description: 'Moderate weight',
        defaultLoad: { weight: 35, unit: 'kg' },
      },
    },
    muscleGroups: ['legs', 'core', 'cardio'],
    equipment: ['sled'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod', 'cardio'],
    isWomenFriendly: true,
    caloriesPerMinute: 9,
    cues: ['Explosive start', 'High knees', 'Full distance'],
  },
  {
    id: 'medicine-ball-over-shoulder',
    name: 'Medicine Ball Over Shoulder',
    category: 'plyometric',
    variations: {
      male: {
        name: 'Medicine Ball Over Shoulder (20 lbs)',
        description: 'Heavy ball',
        defaultLoad: { weight: 9, unit: 'kg' },
      },
      female: {
        name: 'Medicine Ball Over Shoulder (10 lbs)',
        description: 'Lighter ball',
        defaultLoad: { weight: 4.5, unit: 'kg' },
      },
    },
    muscleGroups: ['core', 'shoulders', 'legs'],
    equipment: ['medicine_ball'],
    difficulty: 'intermediate',
    workoutTypes: ['hyrox', 'wod'],
    isWomenFriendly: true,
    cues: ['Explosive throw', 'Core engaged', 'Catch low'],
  },
];

const EXTRA_CALISTHENICS_SEEDS: ExerciseSeed[] = [
    {
      id: 'australian-pullup',
      name: 'Australian Pullup',
      category: 'bodyweight',
      muscleGroups: ['back', 'lats', 'biceps'],
      equipment: ['low_bar', 'rings'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'crossfit'],
      maleDescription: 'Horizontal pulling from low bar',
      femaleDescription: 'Horizontal pulling from low bar',
      beginner: { name: 'Incline Ring Row', scaling: 'Raise the bar or rings for easier leverage' },
      advanced: { name: 'Feet-Elevated Australian Pullup', scaling: 'Elevate feet and pause at the top' },
      cues: ['Keep body rigid', 'Pull chest to bar', 'Squeeze shoulder blades'],
    },
    ...([
    {
      id: 'scap-pullup',
      name: 'Scap Pullup',
      category: 'bodyweight',
      muscleGroups: ['back', 'lats', 'shoulders'],
      equipment: ['pullup_bar'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Shoulder blade activation from a dead hang',
      beginner: { name: 'Band Scap Pullup', scaling: 'Use a light band to control the range' },
      cues: ['Stay long through the elbows', 'Pull shoulders down', 'Control each rep'],
    },
    {
      id: 'archer-pullup',
      name: 'Archer Pullup',
      category: 'bodyweight',
      muscleGroups: ['back', 'lats', 'biceps'],
      equipment: ['pullup_bar'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics'],
      maleDescription: 'Shift bodyweight to one arm through each pull',
      femaleDescription: 'Use band assistance while biasing one arm',
      beginner: { name: 'Typewriter Pullup', scaling: 'Move side to side at the top with both arms assisting' },
      cues: ['Keep one arm straighter', 'Drive elbow down', 'Stay controlled'],
    },
    {
      id: 'muscle-up',
      name: 'Muscle-Up',
      category: 'bodyweight',
      muscleGroups: ['back', 'chest', 'shoulders', 'triceps'],
      equipment: ['pullup_bar', 'rings'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics', 'crossfit', 'wod'],
      maleDescription: 'Explosive pull transitioning into a dip',
      femaleDescription: 'Band-assisted transition over the bar or rings',
      beginner: { name: 'Jumping Muscle-Up', scaling: 'Use a box for the transition pattern' },
      cues: ['Explode through the hips', 'Stay close to the bar', 'Punch over aggressively'],
    },
    {
      id: 'jumping-pullup',
      name: 'Jumping Pullup',
      category: 'bodyweight',
      muscleGroups: ['back', 'lats', 'biceps'],
      equipment: ['pullup_bar', 'box'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'crossfit'],
      maleDescription: 'Use leg drive to assist the top of the pull',
      beginner: { name: 'Box-Assisted Pullup', scaling: 'Keep one foot lightly on the box' },
      cues: ['Use a small jump', 'Lower slowly', 'Finish with chin over bar'],
    },
    {
      id: 'commando-pullup',
      name: 'Commando Pullup',
      category: 'bodyweight',
      muscleGroups: ['back', 'biceps', 'forearms'],
      equipment: ['pullup_bar'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics'],
      maleDescription: 'Neutral-grip side-to-side pullup',
      femaleDescription: 'Band-assisted neutral-grip side-to-side pullup',
      beginner: { name: 'Assisted Commando Pullup', scaling: 'Use a band or jump into position' },
      cues: ['Switch sides evenly', 'Pull shoulder away from ear', 'Avoid twisting hard'],
    },
    {
      id: 'diamond-pushup',
      name: 'Diamond Pushup',
      category: 'bodyweight',
      muscleGroups: ['chest', 'triceps', 'shoulders'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Close-grip pushup emphasizing triceps',
      femaleDescription: 'Knee diamond pushup for reduced load',
      beginner: { name: 'Close-Grip Pushup', scaling: 'Hands close but not touching' },
      cues: ['Keep elbows tucked', 'Brace the core', 'Touch chest low'],
    },
    {
      id: 'decline-pushup',
      name: 'Decline Pushup',
      category: 'bodyweight',
      muscleGroups: ['chest', 'shoulders', 'triceps'],
      equipment: ['bench', 'box'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Feet-elevated pushup for upper chest and shoulders',
      femaleDescription: 'Low-box decline pushup',
      beginner: { name: 'Incline Pushup', scaling: 'Hands elevated on bench' },
      cues: ['Keep hips level', 'Lower under control', 'Press through the floor'],
    },
    {
      id: 'hindu-pushup',
      name: 'Hindu Pushup',
      category: 'bodyweight',
      muscleGroups: ['chest', 'shoulders', 'triceps', 'core'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Flowing pushup with shoulder extension',
      femaleDescription: 'Reduced-range flowing pushup',
      beginner: { name: 'Dive Bomber Pushup', scaling: 'Move slower and shorten the range' },
      cues: ['Lead with the chest', 'Sweep through smoothly', 'Finish tall'],
    },
    {
      id: 'archer-pushup',
      name: 'Archer Pushup',
      category: 'bodyweight',
      muscleGroups: ['chest', 'shoulders', 'triceps'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics'],
      maleDescription: 'Wide pushup shifting load to one arm',
      femaleDescription: 'Elevated archer pushup with reduced load',
      beginner: { name: 'Offset Pushup', scaling: 'Shift one hand slightly forward instead of full archer' },
      cues: ['Keep hips square', 'Reach the straight arm long', 'Descend with control'],
    },
    {
      id: 'pseudo-planche-pushup',
      name: 'Pseudo Planche Pushup',
      category: 'bodyweight',
      muscleGroups: ['shoulders', 'chest', 'triceps', 'core'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics'],
      maleDescription: 'Hands set near hips to increase shoulder load',
      femaleDescription: 'Hands slightly behind shoulders with shorter range',
      beginner: { name: 'Planche Lean', scaling: 'Hold the lean without bending the elbows' },
      cues: ['Lean shoulders forward', 'Keep elbows close', 'Maintain hollow body'],
    },
    {
      id: 'bench-dip',
      name: 'Bench Dip',
      category: 'bodyweight',
      muscleGroups: ['triceps', 'shoulders', 'chest'],
      equipment: ['bench'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Bodyweight dip between benches or on one bench',
      femaleDescription: 'Feet closer to reduce load',
      beginner: { name: 'Bent-Knee Bench Dip', scaling: 'Keep knees bent and range shorter' },
      cues: ['Keep shoulders down', 'Drive through palms', 'Avoid collapsing forward'],
    },
    {
      id: 'bulgarian-split-squat',
      name: 'Bulgarian Split Squat',
      category: 'bodyweight',
      muscleGroups: ['legs', 'glutes', 'quads'],
      equipment: ['bench'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Rear-foot elevated split squat',
      femaleDescription: 'Rear-foot elevated split squat with shorter range',
      beginner: { name: 'Static Split Squat', scaling: 'Keep both feet on the floor' },
      cues: ['Stay tall', 'Track front knee over toes', 'Drive through full foot'],
    },
    {
      id: 'cossack-squat',
      name: 'Cossack Squat',
      category: 'bodyweight',
      muscleGroups: ['legs', 'adductors', 'glutes'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Lateral squat into full hip mobility',
      femaleDescription: 'Supported lateral squat using a rack or post',
      beginner: { name: 'Supported Cossack Squat', scaling: 'Hold on for balance' },
      cues: ['Keep heel down', 'Sit into the hip', 'Open the chest'],
    },
    {
      id: 'shrimp-squat',
      name: 'Shrimp Squat',
      category: 'bodyweight',
      muscleGroups: ['legs', 'quads', 'glutes', 'balance'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics'],
      maleDescription: 'Single-leg squat with rear foot held behind',
      femaleDescription: 'Assisted shrimp squat with rack support',
      beginner: { name: 'Assisted Shrimp Squat', scaling: 'Hold a post or ring for balance' },
      cues: ['Stay upright', 'Control the descent', 'Drive straight up'],
    },
    {
      id: 'nordic-curl',
      name: 'Nordic Curl',
      category: 'bodyweight',
      muscleGroups: ['hamstrings', 'glutes', 'core'],
      equipment: ['nordic_station', 'partner'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Hamstring-dominant lowering from kneeling',
      femaleDescription: 'Band-assisted Nordic curl',
      beginner: { name: 'Eccentric Nordic Curl', scaling: 'Lower slowly and push back up' },
      cues: ['Keep hips extended', 'Move as one line', 'Fight the lowering'],
    },
    {
      id: 'single-leg-calf-raise',
      name: 'Single-Leg Calf Raise',
      category: 'bodyweight',
      muscleGroups: ['calves', 'ankles', 'balance'],
      equipment: ['step'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Full range calf raise on one leg',
      femaleDescription: 'Assisted single-leg calf raise',
      beginner: { name: 'Double-Leg Calf Raise', scaling: 'Use both feet first' },
      cues: ['Pause at the top', 'Lower below the step', 'Keep weight on the big toe'],
    },
    {
      id: 'side-plank',
      name: 'Side Plank',
      category: 'bodyweight',
      muscleGroups: ['core', 'obliques', 'shoulders'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Forearm side plank with stacked feet',
      femaleDescription: 'Forearm side plank with staggered feet if needed',
      beginner: { name: 'Knee Side Plank', scaling: 'Bottom knee on the floor' },
      advanced: { name: 'Star Side Plank', scaling: 'Lift the top leg for more challenge' },
      cues: ['Stack shoulders', 'Lift hips high', 'Reach long through the crown'],
    },
    {
      id: 'reverse-plank',
      name: 'Reverse Plank',
      category: 'bodyweight',
      muscleGroups: ['posterior_chain', 'core', 'shoulders'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Posterior-chain plank facing upward',
      femaleDescription: 'Reverse plank with bent knees if needed',
      beginner: { name: 'Tabletop Hold', scaling: 'Bend the knees to reduce leverage' },
      cues: ['Drive hips up', 'Open the chest', 'Press through heels'],
    },
    {
      id: 'v-up',
      name: 'V-Up',
      category: 'bodyweight',
      muscleGroups: ['core', 'abs', 'hip_flexors'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'crossfit'],
      maleDescription: 'Explosive simultaneous leg and torso lift',
      femaleDescription: 'Alternating V-up',
      beginner: { name: 'Tuck-Up', scaling: 'Bring knees in rather than straight legs' },
      cues: ['Reach for toes', 'Keep lower back braced', 'Control the return'],
    },
    {
      id: 'russian-twist',
      name: 'Russian Twist',
      category: 'bodyweight',
      muscleGroups: ['core', 'obliques'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'hybrid'],
      maleDescription: 'Seated rotational core work',
      femaleDescription: 'Feet down seated rotational core work',
      beginner: { name: 'Heel-Tap Twist', scaling: 'Keep both heels planted' },
      cues: ['Rotate through the ribs', 'Stay tall', 'Move smoothly'],
    },
    {
      id: 'superman-hold',
      name: 'Superman Hold',
      category: 'bodyweight',
      muscleGroups: ['lower_back', 'glutes', 'shoulders'],
      difficulty: 'beginner',
      workoutTypes: ['calisthenics', 'mobility'],
      maleDescription: 'Prone posterior-chain hold',
      femaleDescription: 'Prone posterior-chain hold',
      beginner: { name: 'Alternating Superman', scaling: 'Lift one arm and the opposite leg' },
      cues: ['Lift from the glutes', 'Reach long', 'Avoid cranking the neck'],
    },
    {
      id: 'hollow-rock',
      name: 'Hollow Rock',
      category: 'bodyweight',
      muscleGroups: ['core', 'abs'],
      difficulty: 'intermediate',
      workoutTypes: ['calisthenics', 'crossfit'],
      maleDescription: 'Hollow hold rocked gently end to end',
      femaleDescription: 'Bent-knee hollow rock',
      beginner: { name: 'Hollow Hold', scaling: 'Pause instead of rocking' },
      cues: ['Stay rounded', 'Keep ribs tucked', 'Use a small rock'],
    },
    {
      id: 'dragon-flag',
      name: 'Dragon Flag',
      category: 'bodyweight',
      muscleGroups: ['core', 'lats', 'hip_flexors'],
      equipment: ['bench'],
      difficulty: 'advanced',
      workoutTypes: ['calisthenics'],
      isWomenFriendly: false,
      maleDescription: 'Full-body anti-extension lower from bench',
      femaleDescription: 'Tuck dragon flag with partial range',
      beginner: { name: 'Negative Dragon Flag', scaling: 'Lower as far as control allows' },
      cues: ['Brace hard', 'Keep body straight', 'Move slowly'],
    },
  ] as ExerciseSeed[]),
];

const EXTRA_CALISTHENICS_EXERCISES: Exercise[] = EXTRA_CALISTHENICS_SEEDS.map(createSeedExercise);

const EXTRA_CROSSFIT_SEEDS: ExerciseSeed[] = [
  ...([
    {
      id: 'push-press',
      name: 'Push Press',
      category: 'barbell',
      muscleGroups: ['shoulders', 'triceps', 'legs'],
      equipment: ['barbell', 'plates'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod', 'iron'],
      maleDescription: 'Dip and drive overhead press',
      femaleDescription: 'Dip and drive overhead press with lighter load',
      maleWeightKg: 25,
      femaleWeightKg: 15,
      cues: ['Short dip', 'Drive through legs', 'Finish locked out'],
    },
    {
      id: 'push-jerk',
      name: 'Push Jerk',
      category: 'barbell',
      muscleGroups: ['shoulders', 'triceps', 'legs', 'core'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Aggressive drive then rebend under the bar',
      femaleDescription: 'Aggressive drive then rebend under the bar with lighter load',
      maleWeightKg: 25,
      femaleWeightKg: 15,
      beginner: { name: 'Push Press', scaling: 'Remove the catch under the bar' },
      cues: ['Dip vertical', 'Punch under fast', 'Stand tall to finish'],
    },
    {
      id: 'overhead-squat',
      name: 'Overhead Squat',
      category: 'barbell',
      muscleGroups: ['legs', 'shoulders', 'core'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Bar locked out overhead through a full squat',
      femaleDescription: 'Bar locked out overhead with lighter load',
      maleWeightKg: 20,
      femaleWeightKg: 15,
      beginner: { name: 'PVC Overhead Squat', scaling: 'Use a pipe or empty bar for mobility and balance' },
      cues: ['Spread the floor', 'Arms active', 'Stay tall through the chest'],
    },
    {
      id: 'power-clean',
      name: 'Power Clean',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'traps'],
      equipment: ['barbell', 'plates'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Receive the clean above parallel',
      femaleDescription: 'Receive the clean above parallel with lighter load',
      maleWeightKg: 25,
      femaleWeightKg: 15,
      beginner: { name: 'Hang Power Clean', scaling: 'Start from above the knees' },
      cues: ['Push through the floor', 'Fast elbows', 'Land balanced'],
    },
    {
      id: 'squat-clean',
      name: 'Squat Clean',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'core'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Clean received into a full front squat',
      femaleDescription: 'Clean received into a full front squat with lighter load',
      maleWeightKg: 30,
      femaleWeightKg: 20,
      beginner: { name: 'Power Clean', scaling: 'Catch high before building to a full squat' },
      cues: ['Stay close', 'Rip elbows through', 'Stand hard out of the squat'],
    },
    {
      id: 'hang-clean',
      name: 'Hang Clean',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'traps'],
      equipment: ['barbell', 'plates'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Clean started from the hang position',
      femaleDescription: 'Clean started from the hang position with lighter load',
      maleWeightKg: 25,
      femaleWeightKg: 15,
      beginner: { name: 'High-Hang Clean', scaling: 'Start from the hip crease for simpler timing' },
      cues: ['Stay over the bar', 'Jump and shrug', 'Fast elbows'],
    },
    {
      id: 'power-snatch',
      name: 'Power Snatch',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'shoulders'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Receive the snatch above parallel',
      femaleDescription: 'Receive the snatch above parallel with lighter load',
      maleWeightKg: 20,
      femaleWeightKg: 15,
      beginner: { name: 'Hang Power Snatch', scaling: 'Start from the hang for simpler positions' },
      cues: ['Stay long off the floor', 'Punch up hard', 'Land stable'],
    },
    {
      id: 'hang-snatch',
      name: 'Hang Snatch',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'shoulders'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Snatch started from the hang position',
      femaleDescription: 'Snatch started from the hang position with lighter load',
      maleWeightKg: 20,
      femaleWeightKg: 15,
      beginner: { name: 'High-Hang Snatch', scaling: 'Start from the hip and keep the movement compact' },
      cues: ['Brush the hips', 'Stay close overhead', 'Catch with active shoulders'],
    },
    {
      id: 'devil-press',
      name: 'Devil Press',
      category: 'dumbbell',
      muscleGroups: ['full_body', 'shoulders', 'legs', 'core'],
      equipment: ['dumbbells'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod', 'hybrid'],
      maleDescription: 'Burpee into double-dumbbell snatch',
      femaleDescription: 'Burpee into double-dumbbell snatch with lighter load',
      maleWeightKg: 15,
      femaleWeightKg: 10,
      beginner: { name: 'Burpee + Dumbbell Clean', scaling: 'Break the movement into two parts' },
      cues: ['Keep dumbbells close', 'Use hips', 'Finish tall overhead'],
    },
    {
      id: 'dumbbell-snatch',
      name: 'Dumbbell Snatch',
      category: 'dumbbell',
      muscleGroups: ['legs', 'back', 'shoulders'],
      equipment: ['dumbbell'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod', 'hybrid'],
      maleDescription: 'Single-arm ground-to-overhead dumbbell snatch',
      femaleDescription: 'Single-arm ground-to-overhead dumbbell snatch with lighter load',
      maleWeightKg: 22.5,
      femaleWeightKg: 15,
      beginner: { name: 'Hang Dumbbell Snatch', scaling: 'Start from mid-thigh' },
      cues: ['Keep the bell close', 'Snap hips through', 'Lock out overhead'],
    },
    {
      id: 'dumbbell-clean-and-jerk',
      name: 'Dumbbell Clean and Jerk',
      category: 'dumbbell',
      muscleGroups: ['legs', 'shoulders', 'core'],
      equipment: ['dumbbells'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod', 'hybrid'],
      maleDescription: 'Ground-to-overhead with dumbbells',
      femaleDescription: 'Ground-to-overhead with dumbbells and lighter load',
      maleWeightKg: 20,
      femaleWeightKg: 12.5,
      beginner: { name: 'Dumbbell Clean + Push Press', scaling: 'Press out instead of jerking under' },
      cues: ['Drive from the legs', 'Keep front rack stable', 'Rebend fast'],
    },
    {
      id: 'hand-release-pushup',
      name: 'Hand-Release Pushup',
      category: 'bodyweight',
      muscleGroups: ['chest', 'shoulders', 'triceps'],
      difficulty: 'beginner',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Pushup with hands fully released at the bottom',
      femaleDescription: 'Knee hand-release pushup',
      beginner: { name: 'Incline Hand-Release Pushup', scaling: 'Hands on a box or bench' },
      cues: ['Touch chest to floor', 'Lift hands cleanly', 'Drive up as one piece'],
    },
    {
      id: 'ghd-situp',
      name: 'GHD Sit-Up',
      category: 'bodyweight',
      muscleGroups: ['core', 'hip_flexors'],
      equipment: ['ghd'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Full-extension sit-up on GHD',
      femaleDescription: 'Short-range GHD sit-up',
      beginner: { name: 'Abmat Sit-Up', scaling: 'Use the floor before progressing to full GHD range' },
      cues: ['Control the extension', 'Reach through the toes', 'Avoid over-speeding the descent'],
    },
    {
      id: 'overhead-walking-lunge',
      name: 'Overhead Walking Lunge',
      category: 'barbell',
      muscleGroups: ['legs', 'shoulders', 'core'],
      equipment: ['barbell', 'plates'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Walking lunge with bar overhead',
      femaleDescription: 'Walking lunge with lighter overhead bar',
      maleWeightKg: 20,
      femaleWeightKg: 15,
      beginner: { name: 'Front Rack Walking Lunge', scaling: 'Carry the bar in front rack instead of overhead' },
      cues: ['Ribs down', 'Stack the bar overhead', 'Step long and stable'],
    },
    {
      id: 'shuttle-run',
      name: 'Shuttle Run',
      category: 'cardio',
      muscleGroups: ['legs', 'cardio', 'agility'],
      difficulty: 'beginner',
      workoutTypes: ['crossfit', 'wod', 'cardio'],
      maleDescription: 'Short repeated accelerations with turnarounds',
      femaleDescription: 'Short repeated accelerations with turnarounds',
      cues: ['Stay low into the turn', 'Push hard off each line', 'Keep cadence high'],
      caloriesPerMinute: 11,
    },
    {
      id: 'handstand-walk',
      name: 'Handstand Walk',
      category: 'bodyweight',
      muscleGroups: ['shoulders', 'core', 'traps'],
      difficulty: 'advanced',
      workoutTypes: ['crossfit', 'wod', 'calisthenics'],
      maleDescription: 'Freestanding handstand locomotion',
      femaleDescription: 'Wall-assisted handstand walk drill',
      beginner: { name: 'Wall Walk', scaling: 'Build shoulder capacity against a wall first' },
      cues: ['Push tall', 'Small hand steps', 'Stack hips over shoulders'],
    },
    {
      id: 'echo-bike',
      name: 'Echo Bike',
      category: 'cardio',
      muscleGroups: ['legs', 'upper_body', 'cardio'],
      equipment: ['echo_bike'],
      difficulty: 'beginner',
      workoutTypes: ['crossfit', 'wod', 'cardio'],
      maleDescription: 'Hard intervals on the echo bike',
      femaleDescription: 'Hard intervals on the echo bike',
      cues: ['Drive with legs first', 'Stay smooth', 'Breathe rhythmically'],
      caloriesPerMinute: 12,
    },
    {
      id: 'farmers-carry-crossfit',
      name: 'Farmers Carry',
      category: 'hybrid',
      muscleGroups: ['grip', 'core', 'shoulders'],
      equipment: ['dumbbells', 'kettlebells'],
      difficulty: 'beginner',
      workoutTypes: ['crossfit', 'wod', 'hybrid'],
      maleDescription: 'Loaded carry for distance or time',
      femaleDescription: 'Loaded carry with moderate implements',
      maleWeightKg: 24,
      femaleWeightKg: 16,
      beginner: { name: 'Suitcase Carry', scaling: 'Carry one implement at a time' },
      cues: ['Stand tall', 'Walk under control', 'Crush the handles'],
    },
    {
      id: 'sumo-deadlift-high-pull',
      name: 'Sumo Deadlift High Pull',
      category: 'barbell',
      muscleGroups: ['legs', 'back', 'traps'],
      equipment: ['barbell', 'plates'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod'],
      maleDescription: 'Wide-stance pull finishing at the collarbone',
      femaleDescription: 'Wide-stance pull finishing at the collarbone with lighter load',
      maleWeightKg: 25,
      femaleWeightKg: 15,
      beginner: { name: 'Kettlebell High Pull', scaling: 'Use a lighter implement with simpler setup' },
      cues: ['Keep chest up', 'Drive knees out', 'Lead elbows high'],
    },
    {
      id: 'bar-facing-burpee',
      name: 'Bar-Facing Burpee',
      category: 'plyometric',
      muscleGroups: ['full_body', 'cardio', 'legs'],
      equipment: ['barbell'],
      difficulty: 'intermediate',
      workoutTypes: ['crossfit', 'wod', 'cardio'],
      maleDescription: 'Burpee then jump laterally over the bar',
      femaleDescription: 'Step-back burpee then hop over the bar',
      beginner: { name: 'Burpee Step-Over', scaling: 'Step over the bar instead of jumping' },
      cues: ['Stay tight to the bar', 'Land balanced', 'Keep transitions quick'],
      caloriesPerMinute: 10,
    },
  ] as ExerciseSeed[]),
];

const EXTRA_CROSSFIT_EXERCISES: Exercise[] = EXTRA_CROSSFIT_SEEDS.map(createSeedExercise);

const EXTRA_HYROX_SEEDS: ExerciseSeed[] = [
  ...([
    {
      id: 'wall-ball-hyrox',
      name: 'Wall Ball (HYROX)',
      category: 'plyometric',
      muscleGroups: ['legs', 'shoulders', 'core'],
      equipment: ['wall_ball'],
      difficulty: 'intermediate',
      workoutTypes: ['hyrox', 'wod', 'crossfit'],
      maleDescription: 'HYROX station wall balls with race standards',
      femaleDescription: 'HYROX station wall balls with lighter implement',
      maleWeightKg: 9,
      femaleWeightKg: 6,
      beginner: { name: 'Medicine Ball Thruster', scaling: 'Practice squat-to-press rhythm before full targets' },
      cues: ['Hit depth each rep', 'Throw to a consistent target', 'Receive the ball low'],
    },
    {
      id: 'farmers-carry-hyrox',
      name: 'Farmers Carry (HYROX)',
      category: 'hybrid',
      muscleGroups: ['grip', 'core', 'legs'],
      equipment: ['kettlebells'],
      difficulty: 'intermediate',
      workoutTypes: ['hyrox', 'hybrid'],
      maleDescription: 'Heavy kettlebell carry for race distance',
      femaleDescription: 'Moderate kettlebell carry for race distance',
      maleWeightKg: 24,
      femaleWeightKg: 16,
      beginner: { name: 'Short Farmers Carry', scaling: 'Shorten the distance and reset as needed' },
      cues: ['Breathe behind the brace', 'Walk tall', 'Keep shoulders packed'],
    },
    {
      id: 'run-1k-hyrox',
      name: '1K Run',
      category: 'cardio',
      muscleGroups: ['legs', 'cardio'],
      difficulty: 'beginner',
      workoutTypes: ['hyrox', 'cardio'],
      maleDescription: 'Race-pace 1 kilometer run',
      femaleDescription: 'Race-pace 1 kilometer run',
      cues: ['Relax shoulders', 'Hold a sustainable pace', 'Finish ready for the next station'],
      caloriesPerMinute: 12,
    },
    {
      id: 'walking-lunge-sandbag',
      name: 'Sandbag Walking Lunge',
      category: 'hybrid',
      muscleGroups: ['legs', 'glutes', 'core'],
      equipment: ['sandbag'],
      difficulty: 'intermediate',
      workoutTypes: ['hyrox', 'hybrid'],
      maleDescription: 'Walking lunge with sandbag carried high',
      femaleDescription: 'Walking lunge with moderate sandbag load',
      maleWeightKg: 20,
      femaleWeightKg: 10,
      beginner: { name: 'Bodyweight Walking Lunge', scaling: 'Remove the load before building distance' },
      cues: ['Stay tall', 'Touch rear knee lightly', 'Keep each step even'],
    },
    {
      id: 'ski-erg-interval',
      name: 'Ski Erg Interval',
      category: 'cardio',
      muscleGroups: ['shoulders', 'core', 'legs', 'cardio'],
      equipment: ['ski_erg'],
      difficulty: 'beginner',
      workoutTypes: ['hyrox', 'cardio'],
      maleDescription: 'Repeat hard intervals on the ski erg',
      femaleDescription: 'Repeat hard intervals on the ski erg',
      cues: ['Hinge at the hips', 'Finish through the triceps', 'Recover smoothly'],
      caloriesPerMinute: 11,
    },
    {
      id: 'row-interval-hyrox',
      name: 'Row Interval',
      category: 'cardio',
      muscleGroups: ['back', 'legs', 'core', 'cardio'],
      equipment: ['rowing_machine'],
      difficulty: 'beginner',
      workoutTypes: ['hyrox', 'cardio'],
      maleDescription: 'Race-pace row interval',
      femaleDescription: 'Race-pace row interval',
      cues: ['Legs then hips then arms', 'Stay long at the catch', 'Hold a strong split'],
      caloriesPerMinute: 10,
    },
    {
      id: 'burpee-jump-over',
      name: 'Burpee Jump Over',
      category: 'plyometric',
      muscleGroups: ['full_body', 'cardio', 'legs'],
      equipment: ['line', 'hurdle'],
      difficulty: 'intermediate',
      workoutTypes: ['hyrox', 'wod', 'crossfit'],
      maleDescription: 'Burpee then lateral jump over marker',
      femaleDescription: 'Step-back burpee and quick hop over marker',
      beginner: { name: 'Burpee Step-Over', scaling: 'Step over the marker after each burpee' },
      cues: ['Stay compact', 'Land softly', 'Keep transitions crisp'],
      caloriesPerMinute: 10,
    },
    {
      id: 'backward-sled-drag',
      name: 'Backward Sled Drag',
      category: 'machine',
      muscleGroups: ['quads', 'legs', 'cardio'],
      equipment: ['sled', 'strap'],
      difficulty: 'intermediate',
      workoutTypes: ['hyrox', 'hybrid'],
      maleDescription: 'Backward sled drag for quad-dominant capacity',
      femaleDescription: 'Backward sled drag with moderate load',
      maleWeightKg: 45,
      femaleWeightKg: 30,
      beginner: { name: 'Light Backward Drag', scaling: 'Reduce load and distance' },
      cues: ['Lean back slightly', 'Take quick steps', 'Keep tension on the strap'],
    },
    {
      id: 'weighted-step-up-hyrox',
      name: 'Weighted Step-Up',
      category: 'hybrid',
      muscleGroups: ['legs', 'glutes', 'cardio'],
      equipment: ['box', 'dumbbells'],
      difficulty: 'beginner',
      workoutTypes: ['hyrox', 'hybrid'],
      maleDescription: 'Race-style step-ups holding dumbbells',
      femaleDescription: 'Race-style step-ups with lighter dumbbells',
      maleWeightKg: 15,
      femaleWeightKg: 10,
      beginner: { name: 'Bodyweight Step-Up', scaling: 'Drop the external load' },
      cues: ['Drive through the whole foot', 'Stand fully on top', 'Control the descent'],
      caloriesPerMinute: 8,
    },
    {
      id: 'battle-rope-slams',
      name: 'Battle Rope Slams',
      category: 'cardio',
      muscleGroups: ['shoulders', 'core', 'cardio'],
      equipment: ['battle_ropes'],
      difficulty: 'beginner',
      workoutTypes: ['hyrox', 'cardio', 'hybrid'],
      maleDescription: 'Repeated powerful rope slams',
      femaleDescription: 'Repeated powerful rope slams',
      cues: ['Move from the hips', 'Snap the ropes hard', 'Stay athletic'],
      caloriesPerMinute: 9,
    },
  ] as ExerciseSeed[]),
];

const EXTRA_HYROX_EXERCISES: Exercise[] = EXTRA_HYROX_SEEDS.map(createSeedExercise);

// Combined exercise database
const ALL_EXERCISES = [
  ...CALISTHENICS_EXERCISES,
  ...EXTRA_CALISTHENICS_EXERCISES,
  ...CROSSFIT_EXERCISES,
  ...EXTRA_CROSSFIT_EXERCISES,
  ...HYROX_EXERCISES,
  ...EXTRA_HYROX_EXERCISES,
];

/**
 * Initialize the exercise library in Firestore
 * Call this once during app setup
 */
export async function initializeExerciseLibrary(): Promise<void> {
  try {
    const [{ db }, { collection, doc, setDoc }] = await Promise.all([
      import('./firebase'),
      import('firebase/firestore'),
    ]);
    const exerciseRef = collection(db, 'exerciseLibrary');
    for (const exercise of ALL_EXERCISES) {
      await setDoc(doc(exerciseRef, exercise.id), exercise);
    }
    console.log(`✓ Initialized ${ALL_EXERCISES.length} exercises in Firestore`);
  } catch (error) {
    console.error('Failed to initialize exercise library:', error);
    throw error;
  }
}

/**
 * Get all exercises of a specific workout type
 */
export function getExercisesByType(workoutType: WorkoutType): Exercise[] {
  return ALL_EXERCISES.filter(ex => ex.workoutTypes.includes(workoutType));
}

/**
 * Get a specific exercise with proper scaling for user profile
 */
export function getScaledExercise(
  exerciseId: string,
  userProfile: {
    gender: 'male' | 'female';
    level: 'beginner' | 'intermediate' | 'advanced';
  }
): Exercise | null {
  const exercise = ALL_EXERCISES.find(e => e.id === exerciseId);
  if (!exercise) return null;

  const genderVariation = exercise.variations[userProfile.gender];
  const levelVariation = userProfile.level === 'beginner'
    ? exercise.variations.beginner
    : userProfile.level === 'advanced'
      ? exercise.variations.advanced
      : undefined;

  const scaledName = levelVariation?.name ?? genderVariation.name ?? exercise.name;
  const scaledDescription = [genderVariation.description, levelVariation?.scaling]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ');

  return {
    ...exercise,
    name: scaledName,
    difficulty: userProfile.level === 'intermediate' ? exercise.difficulty : userProfile.level,
    description: scaledDescription || exercise.description,
  };
}

/**
 * Search exercises by name or muscle group
 */
export function searchExercises(query: string): Exercise[] {
  const lowercaseQuery = query.toLowerCase();
  return ALL_EXERCISES.filter(
    exercise =>
      exercise.name.toLowerCase().includes(lowercaseQuery) ||
      exercise.muscleGroups.some(mg => mg.toLowerCase().includes(lowercaseQuery)) ||
      exercise.category.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get all women-friendly exercises
 */
export function getWomenFriendlyExercises(): Exercise[] {
  return ALL_EXERCISES.filter(e => e.isWomenFriendly);
}

/**
 * Get exercises by muscle group
 */
export function getExercisesByMuscleGroup(muscleGroup: string): Exercise[] {
  return ALL_EXERCISES.filter(e =>
    e.muscleGroups.map(m => m.toLowerCase()).includes(muscleGroup.toLowerCase())
  );
}

/**
 * Get exercises by difficulty
 */
export function getExercisesByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): Exercise[] {
  return ALL_EXERCISES.filter(e => e.difficulty === difficulty);
}

/**
 * Get total count of exercises
 */
export function getTotalExerciseCount(): number {
  return ALL_EXERCISES.length;
}

/**
 * Get exercise counts by category
 */
export function getExerciseCountsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};
  ALL_EXERCISES.forEach(exercise => {
    counts[exercise.category] = (counts[exercise.category] || 0) + 1;
  });
  return counts;
}

/**
 * Get exercise counts by workout type
 */
export function getExerciseCountsByWorkoutType(): Record<WorkoutType, number> {
  const counts: Record<WorkoutType, number> = {
    iron: 0,
    calisthenics: 0,
    crossfit: 0,
    hyrox: 0,
    wod: 0,
    cardio: 0,
    hybrid: 0,
    mobility: 0,
    plyometric: 0,
  };

  ALL_EXERCISES.forEach(exercise => {
    exercise.workoutTypes.forEach(type => {
      counts[type]++;
    });
  });

  return counts;
}
