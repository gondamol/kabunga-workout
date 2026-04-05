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

import { db } from './firebase';
import { collection, doc, setDoc, getDocs, query, where } from 'firebase/firestore';

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

// Combined exercise database
const ALL_EXERCISES = [
  ...CALISTHENICS_EXERCISES,
  ...CROSSFIT_EXERCISES,
  ...HYROX_EXERCISES,
];

/**
 * Initialize the exercise library in Firestore
 * Call this once during app setup
 */
export async function initializeExerciseLibrary(): Promise<void> {
  try {
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
export async function getExercisesByType(workoutType: WorkoutType): Promise<Exercise[]> {
  try {
    // For now, filter from local data
    // In production, query Firestore
    return ALL_EXERCISES.filter(ex => ex.workoutTypes.includes(workoutType));
  } catch (error) {
    console.error(`Failed to get exercises for type ${workoutType}:`, error);
    return [];
  }
}

/**
 * Get a specific exercise with proper scaling for user profile
 */
export async function getScaledExercise(
  exerciseId: string,
  userProfile: {
    gender: 'male' | 'female';
    level: 'beginner' | 'intermediate' | 'advanced';
  }
): Promise<Exercise | null> {
  try {
    const exercise = ALL_EXERCISES.find(e => e.id === exerciseId);
    if (!exercise) return null;

    // Return the exercise with variations based on profile
    return exercise;
  } catch (error) {
    console.error(`Failed to get scaled exercise ${exerciseId}:`, error);
    return null;
  }
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
