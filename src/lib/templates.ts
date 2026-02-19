import type { WorkoutTemplate } from './types';

/**
 * Built-in workout templates — these are available to all users
 * Users can also create their own custom templates
 */

const SYSTEM = 'SYSTEM';
const ts = Date.now();

export const BUILT_IN_TEMPLATES: WorkoutTemplate[] = [
    // ─── Push Day ───
    {
        id: 'tpl_push_day',
        userId: SYSTEM,
        title: 'Push Day',
        category: 'Push/Pull/Legs',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Arm Circles', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Slow controlled circles, both directions' },
                    { name: 'Band Pull-Aparts', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Squeeze shoulder blades together' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Bench Press', sets: 4, reps: 8, weight: 60, restSeconds: 120, isWarmup: false, cue: 'Arch back, retract scapula, control the descent' },
                    { name: 'Overhead Press', sets: 3, reps: 10, weight: 40, restSeconds: 90, isWarmup: false, cue: 'Brace core, press overhead, squeeze at top' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Incline Press', sets: 3, reps: 12, weight: 50, restSeconds: 75, isWarmup: false, cue: 'Bench at 30-45°, full range of motion' },
                    { name: 'Lateral Raises', sets: 3, reps: 15, weight: 10, restSeconds: 60, isWarmup: false, cue: 'Slight bend in elbows, control the negative' },
                    { name: 'Tricep Pushdown', sets: 3, reps: 12, weight: 25, restSeconds: 60, isWarmup: false, cue: 'Elbows pinned to sides, full lockout' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Chest Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Hold 30 seconds each side against a doorframe' },
                    { name: 'Shoulder Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Cross-body stretch, 30 seconds each arm' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Pull Day ───
    {
        id: 'tpl_pull_day',
        userId: SYSTEM,
        title: 'Pull Day',
        category: 'Push/Pull/Legs',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Band Pull-Aparts', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Focus on squeezing rear delts' },
                    { name: 'Dead Hangs', sets: 2, reps: 1, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Hang 20-30 seconds, decompress spine' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Deadlift', sets: 4, reps: 5, weight: 100, restSeconds: 180, isWarmup: false, cue: 'Hinge at hips, flat back, drive through heels' },
                    { name: 'Barbell Row', sets: 4, reps: 8, weight: 60, restSeconds: 90, isWarmup: false, cue: 'Torso at 45°, pull to lower chest' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Pull-ups', sets: 3, reps: 8, weight: 0, restSeconds: 90, isWarmup: false, cue: 'Full dead hang at bottom, chin over bar' },
                    { name: 'Face Pulls', sets: 3, reps: 15, weight: 15, restSeconds: 60, isWarmup: false, cue: 'External rotate at the top, squeeze rear delts' },
                    { name: 'Bicep Curls', sets: 3, reps: 12, weight: 12, restSeconds: 60, isWarmup: false, cue: 'Control the negative, no swinging' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Lat Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Hang from bar or stretch arms overhead, 30 sec' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Leg Day ───
    {
        id: 'tpl_leg_day',
        userId: SYSTEM,
        title: 'Leg Day',
        category: 'Push/Pull/Legs',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Bodyweight Squats', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Full depth, knees track over toes' },
                    { name: 'Leg Swings', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Forward/back + side-to-side, each leg' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Squat', sets: 4, reps: 6, weight: 80, restSeconds: 180, isWarmup: false, cue: 'Brace core, break at hips and knees together, hit parallel' },
                    { name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 60, restSeconds: 90, isWarmup: false, cue: 'Soft knees, hinge at hips, feel hamstring stretch' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Leg Press', sets: 3, reps: 12, weight: 120, restSeconds: 90, isWarmup: false, cue: 'Feet shoulder-width, full range of motion' },
                    { name: 'Leg Curl', sets: 3, reps: 12, weight: 30, restSeconds: 60, isWarmup: false, cue: 'Squeeze at top, slow negative' },
                    { name: 'Calf Raises', sets: 4, reps: 15, weight: 40, restSeconds: 45, isWarmup: false, cue: 'Full stretch at bottom, pause at top' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Quad Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Standing or lying, 30 sec each leg' },
                    { name: 'Hamstring Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Seated or standing, 30 sec each leg' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Full Body ───
    {
        id: 'tpl_full_body',
        userId: SYSTEM,
        title: 'Full Body',
        category: 'Full Body',
        goalFocus: 'strength',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Jumping Jacks', sets: 1, reps: 30, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Get heart rate up, light sweat' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Squat', sets: 4, reps: 5, weight: 80, restSeconds: 180, isWarmup: false, cue: 'Heavy compound — focus on form' },
                    { name: 'Bench Press', sets: 4, reps: 5, weight: 60, restSeconds: 150, isWarmup: false, cue: 'Tight setup, controlled descent' },
                    { name: 'Barbell Row', sets: 4, reps: 5, weight: 60, restSeconds: 120, isWarmup: false, cue: 'Strict form, no body english' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Overhead Press', sets: 3, reps: 8, weight: 35, restSeconds: 90, isWarmup: false, cue: 'Brace core, full lockout' },
                    { name: 'Pull-ups', sets: 3, reps: 8, weight: 0, restSeconds: 90, isWarmup: false, cue: 'Full range, chin over bar' },
                    { name: 'Lunges', sets: 3, reps: 10, weight: 20, restSeconds: 60, isWarmup: false, cue: 'Step forward, knee tracks over toe' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Full Body Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: '5 min total: quads, hamstrings, chest, shoulders, back' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Upper Body ───
    {
        id: 'tpl_upper_body',
        userId: SYSTEM,
        title: 'Upper Body',
        category: 'Upper/Lower',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Arm Circles', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Small to large circles' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Bench Press', sets: 4, reps: 8, weight: 60, restSeconds: 120, isWarmup: false, cue: 'Control the eccentric' },
                    { name: 'Barbell Row', sets: 4, reps: 8, weight: 55, restSeconds: 90, isWarmup: false, cue: 'Pull to sternum, squeeze back' },
                    { name: 'Overhead Press', sets: 3, reps: 10, weight: 35, restSeconds: 90, isWarmup: false, cue: 'Strict press, no leg drive' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Lat Pulldown', sets: 3, reps: 12, weight: 50, restSeconds: 60, isWarmup: false, cue: 'Wide grip, pull to upper chest' },
                    { name: 'Lateral Raises', sets: 3, reps: 15, weight: 8, restSeconds: 45, isWarmup: false, cue: 'Light weight, high reps, feel the burn' },
                    { name: 'Bicep Curls', sets: 3, reps: 12, weight: 12, restSeconds: 45, isWarmup: false, cue: 'Full range, squeeze at top' },
                    { name: 'Tricep Pushdown', sets: 3, reps: 12, weight: 20, restSeconds: 45, isWarmup: false, cue: 'Elbows locked in place' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Chest Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Doorframe stretch, 30 sec' },
                    { name: 'Shoulder Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: 'Cross-body and overhead' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Lower Body ───
    {
        id: 'tpl_lower_body',
        userId: SYSTEM,
        title: 'Lower Body',
        category: 'Upper/Lower',
        goalFocus: 'strength',
        phases: [
            {
                name: 'Warmup',
                duration: 300,
                exercises: [
                    { name: 'Bodyweight Squats', sets: 2, reps: 15, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Full ROM, wake up the knees' },
                    { name: 'Hip Circles', sets: 2, reps: 10, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Both directions, open up the hips' },
                ],
            },
            {
                name: 'Main Lifts',
                exercises: [
                    { name: 'Squat', sets: 5, reps: 5, weight: 90, restSeconds: 180, isWarmup: false, cue: 'Heavy set — brace hard, hit depth' },
                    { name: 'Deadlift', sets: 3, reps: 5, weight: 110, restSeconds: 180, isWarmup: false, cue: 'Reset each rep, flat back' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Hip Thrust', sets: 3, reps: 12, weight: 80, restSeconds: 75, isWarmup: false, cue: 'Squeeze glutes at top, chin tucked' },
                    { name: 'Leg Extension', sets: 3, reps: 15, weight: 35, restSeconds: 60, isWarmup: false, cue: 'Slow and controlled, pause at top' },
                    { name: 'Calf Raises', sets: 4, reps: 15, weight: 40, restSeconds: 45, isWarmup: false, cue: 'Full stretch, hold at top 2 sec' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 300,
                exercises: [
                    { name: 'Pigeon Stretch', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: '30 sec each side, deep hip opener' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Quick HIIT ───
    {
        id: 'tpl_quick_hiit',
        userId: SYSTEM,
        title: 'Quick HIIT (20 min)',
        category: 'Cardio',
        goalFocus: 'endurance',
        phases: [
            {
                name: 'Warmup',
                duration: 180,
                exercises: [
                    { name: 'Jumping Jacks', sets: 1, reps: 30, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Get heart rate up gradually' },
                ],
            },
            {
                name: 'Main Circuit',
                exercises: [
                    { name: 'Burpees', sets: 4, reps: 10, weight: 0, restSeconds: 30, isWarmup: false, cue: '30 sec work, 30 sec rest' },
                    { name: 'Mountain Climbers', sets: 4, reps: 20, weight: 0, restSeconds: 30, isWarmup: false, cue: 'Fast pace, core tight' },
                    { name: 'Push-ups', sets: 4, reps: 15, weight: 0, restSeconds: 30, isWarmup: false, cue: 'Chest to floor each rep' },
                    { name: 'Squat Jumps', sets: 4, reps: 12, weight: 0, restSeconds: 30, isWarmup: false, cue: 'Explode up, land soft' },
                ],
            },
            {
                name: 'Cooldown',
                duration: 180,
                exercises: [
                    { name: 'Walking in Place', sets: 1, reps: 1, weight: 0, restSeconds: 0, isWarmup: false, cue: '2 min easy walking, bring heart rate down' },
                ],
            },
        ],
        progressionRule: 'maintenance',
        createdAt: ts,
        updatedAt: ts,
    },
];

/** Get all templates (built-in + user custom) */
export const getAllTemplates = (userTemplates: WorkoutTemplate[] = []): WorkoutTemplate[] => {
    return [...BUILT_IN_TEMPLATES, ...userTemplates];
};

/** Get unique categories from all templates */
export const getTemplateCategories = (templates: WorkoutTemplate[]): string[] => {
    return [...new Set(templates.map(t => t.category))];
};
