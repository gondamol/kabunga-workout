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

    // ─── Iron Protocol — Monday Push 1 (Primary) ───
    {
        id: 'tpl_iron_push1',
        userId: SYSTEM,
        title: 'Iron Protocol — Push 1 (Bench)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up (Set 0)',
                exercises: [
                    { name: 'Flat Bench Press', sets: 2, reps: 17, weight: 18, restSeconds: 60, isWarmup: true, cue: 'Bar or very light. Groove the pattern, warm shoulder joints. NOT counted in working sets.' },
                ],
            },
            {
                name: 'Working Sets (Sets 1-4)',
                exercises: [
                    { name: 'Flat Bench Press', sets: 4, reps: 10, weight: 50, restSeconds: 120, isWarmup: false, cue: 'Moderate load — 62% 1RM. 5-point contact. Scapula retracted and depressed. 2-3 sec eccentric. Bar to nipple line.' },
                ],
            },
            {
                name: 'Heavy Sets (Sets 5-6)',
                exercises: [
                    { name: 'Flat Bench Press', sets: 1, reps: 5, weight: 65, restSeconds: 180, isWarmup: false, cue: 'HEAVY — 81% 1RM. Full brace. Drive through feet. Chase this number.' },
                    { name: 'Flat Bench Press', sets: 1, reps: 4, weight: 68, restSeconds: 180, isWarmup: false, cue: 'HEAVY — 85% 1RM. This is where strength is built. Rest 3 min after.' },
                ],
            },
            {
                name: 'Back-Off Sets (Sets 7-10)',
                exercises: [
                    { name: 'Flat Bench Press', sets: 4, reps: 10, weight: 50, restSeconds: 120, isWarmup: false, cue: 'Back to working weight. Match or beat Sets 1-4 reps. Never drop reps because you are tired - give more rest instead.' },
                ],
            },
            {
                name: 'Secondary — Dips or Close-Grip Bench',
                exercises: [
                    { name: 'Dips (or Close-Grip Bench)', sets: 5, reps: 10, weight: 0, restSeconds: 90, isWarmup: false, cue: 'Bodyweight dips: lean 15° forward for chest. ALTERNATIVE if no dip rack: Close-Grip Bench at 35-38 kg, elbows tight to ribs.' },
                    { name: 'Triceps Finisher', sets: 3, reps: 12, weight: 15, restSeconds: 60, isWarmup: false, cue: 'Optional. Overhead DB extension or cable pushdown. Squeeze the lockout.' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Iron Protocol — Tuesday Pull 1 (Secondary) ───
    {
        id: 'tpl_iron_pull1',
        userId: SYSTEM,
        title: 'Iron Protocol — Pull 1 (Rows)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up (Set 0)',
                exercises: [
                    { name: 'Bent-Over BB Rows', sets: 2, reps: 17, weight: 22, restSeconds: 60, isWarmup: true, cue: 'Light hinge. Feel the lats engage - not the arms. Groove the movement pattern.' },
                ],
            },
            {
                name: 'Activation Sets (Sets 1-3)',
                exercises: [
                    { name: 'Bent-Over BB Rows', sets: 3, reps: 17, weight: 40, restSeconds: 90, isWarmup: false, cue: 'ACTIVATION PRIORITY — 67% 1RM, high reps. Row to lower sternum. PAUSE and squeeze shoulder blades at top. Think: pull elbows to hip pockets.' },
                ],
            },
            {
                name: 'Heavy Sets (Biweekly Only - Sets 4-6)',
                exercises: [
                    { name: 'Bent-Over BB Rows', sets: 3, reps: 9, weight: 50, restSeconds: 120, isWarmup: false, cue: 'HEAVY — do these EVERY OTHER WEEK only. 83% 1RM. Otherwise repeat activation sets here.' },
                ],
            },
            {
                name: 'Back-Off Sets (Sets 7-10)',
                exercises: [
                    { name: 'Bent-Over BB Rows', sets: 4, reps: 15, weight: 42, restSeconds: 90, isWarmup: false, cue: 'Back to moderate. Squeeze lats at top of every rep. Row to lower sternum every rep.' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Pull-Ups', sets: 3, reps: 8, weight: 0, restSeconds: 90, isWarmup: false, cue: 'Full dead hang. Chin over bar. 3-second controlled lower. Band-assisted if needed. This builds Friday.' },
                    { name: 'Biceps Finisher', sets: 3, reps: 12, weight: 14, restSeconds: 60, isWarmup: false, cue: 'Optional. DB curl or hammer curl. Full supination. Only if energy remains.' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Iron Protocol — Wednesday Legs 1 (Primary) ───
    {
        id: 'tpl_iron_legs1',
        userId: SYSTEM,
        title: 'Iron Protocol — Legs 1 (Squats)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up (Set 0)',
                exercises: [
                    { name: 'Back Squat', sets: 2, reps: 17, weight: 50, restSeconds: 60, isWarmup: true, cue: 'Groove the pattern. Warm ankles, knees, hips. Sit into the bottom, feel the stretch.' },
                ],
            },
            {
                name: 'Working Sets (Sets 1-4)',
                exercises: [
                    { name: 'Back Squat', sets: 4, reps: 10, weight: 84, restSeconds: 150, isWarmup: false, cue: '60% 1RM. 360-degree brace before EVERY descent. 2-3 sec eccentric. Drive knees out over pinky toes. Parallel depth - crease of hip at or below knee.' },
                ],
            },
            {
                name: 'Heavy Sets (Sets 5-6)',
                exercises: [
                    { name: 'Back Squat', sets: 1, reps: 5, weight: 112, restSeconds: 210, isWarmup: false, cue: 'HEAVY — 80% 1RM. Brace extra hard. Spotter recommended. Full depth.' },
                    { name: 'Back Squat', sets: 1, reps: 4, weight: 122, restSeconds: 210, isWarmup: false, cue: 'HEAVY — 87% 1RM. Chase a PR triple here every few weeks.' },
                ],
            },
            {
                name: 'Back-Off Sets (Sets 7-10)',
                exercises: [
                    { name: 'Back Squat', sets: 4, reps: 10, weight: 84, restSeconds: 150, isWarmup: false, cue: 'Drop back to 60% 1RM. Match or beat Sets 1-4 reps. Give extra rest if needed - do NOT drop reps target.' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Hamstring Curls', sets: 4, reps: 12, weight: 25, restSeconds: 75, isWarmup: false, cue: 'Machine. Full ROM. Squeeze hard at top. 2-3 sec controlled lower.' },
                    { name: 'Leg Raises (Core Daily)', sets: 10, reps: 1, weight: 0, restSeconds: 30, isWarmup: false, cue: '1 set per minute. 30 sec ON / 30 sec OFF. Legs FULLY extended. This is also your Fitness Daily - do it every single day.' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Iron Protocol — Thursday Push 2 (Secondary) ───
    {
        id: 'tpl_iron_push2',
        userId: SYSTEM,
        title: 'Iron Protocol — Push 2 (OHP)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up (Set 0)',
                exercises: [
                    { name: 'Overhead BB Press', sets: 2, reps: 17, weight: 12, restSeconds: 60, isWarmup: true, cue: 'Empty bar or very light. Shoulder circles then press. Groove the lockout.' },
                ],
            },
            {
                name: 'Working Sets (Sets 1-4)',
                exercises: [
                    { name: 'Overhead BB Press', sets: 4, reps: 10, weight: 24, restSeconds: 120, isWarmup: false, cue: '60% 1RM. Lock glutes and abs hard - prevents lower back arch. Elbows forward. Full lockout at top.' },
                ],
            },
            {
                name: 'Heavy Sets (Sets 5-6)',
                exercises: [
                    { name: 'Overhead BB Press', sets: 1, reps: 5, weight: 32, restSeconds: 180, isWarmup: false, cue: 'HEAVY — 80% 1RM. Rest fully before this.' },
                    { name: 'Overhead BB Press', sets: 1, reps: 4, weight: 36, restSeconds: 180, isWarmup: false, cue: 'HEAVY — 90% 1RM. Your ceiling attempt zone. Push it.' },
                ],
            },
            {
                name: 'Back-Off Sets (Sets 7-10)',
                exercises: [
                    { name: 'Overhead BB Press', sets: 4, reps: 10, weight: 24, restSeconds: 120, isWarmup: false, cue: 'Back to working weight. Longer rest between sets is fine. Maintain the lockout quality.' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Cable Chest Fly', sets: 3, reps: 13, weight: 10, restSeconds: 60, isWarmup: false, cue: 'Full stretch at open. Squeeze hard at close. Chest isolation finisher.' },
                    { name: 'Triceps Finisher', sets: 3, reps: 13, weight: 15, restSeconds: 60, isWarmup: false, cue: 'OH extension or cable pushdown. Full extension = full contraction.' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Iron Protocol — Friday Pull 2 (Primary) ───
    {
        id: 'tpl_iron_pull2',
        userId: SYSTEM,
        title: 'Iron Protocol — Pull 2 (Pull-Ups)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up',
                exercises: [
                    { name: 'Leg Raises', sets: 3, reps: 1, weight: 0, restSeconds: 30, isWarmup: true, cue: '30 sec ON / 30 sec OFF. Legs fully extended. Standard gym warm-up every day.' },
                    { name: 'Dead Hang', sets: 2, reps: 1, weight: 0, restSeconds: 30, isWarmup: true, cue: 'Hang 20-30 seconds. Feel the shoulder open. Practice scapular depression.' },
                ],
            },
            {
                name: 'Main — Wide-Grip Pull-Ups (10 Sets)',
                exercises: [
                    { name: 'Wide-Grip Pull-Ups', sets: 10, reps: 8, weight: 0, restSeconds: 120, isWarmup: false, cue: 'Full dead hang start. Chin FULLY over bar. 3-second controlled lower. Band-assisted if needed. Stage 1: assisted. Stage 2: BW to 10x10. Stage 3: add weight via dip belt.' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Meadows Rows (Left)', sets: 5, reps: 11, weight: 30, restSeconds: 75, isWarmup: false, cue: 'Single-arm landmine row. Drive elbow back and up. Great for lat thickness and width.' },
                    { name: 'Meadows Rows (Right)', sets: 5, reps: 11, weight: 30, restSeconds: 75, isWarmup: false, cue: 'Same as left. Keep torso stable. Do not rotate.' },
                    { name: 'Biceps Finisher', sets: 3, reps: 13, weight: 14, restSeconds: 60, isWarmup: false, cue: 'Barbell curl or incline DB curl. Full supination. Friday finisher - leave nothing.' },
                ],
            },
        ],
        progressionRule: 'linear',
        createdAt: ts,
        updatedAt: ts,
    },

    // ─── Iron Protocol — Saturday Legs 2 (Secondary) ───
    {
        id: 'tpl_iron_legs2',
        userId: SYSTEM,
        title: 'Iron Protocol — Legs 2 (RDL)',
        category: 'Iron Protocol PPL',
        goalFocus: 'hypertrophy',
        phases: [
            {
                name: 'Warm-Up',
                exercises: [
                    { name: 'Leg Raises', sets: 3, reps: 1, weight: 0, restSeconds: 30, isWarmup: true, cue: '30 sec ON / 30 sec OFF. Core warm-up standard.' },
                    { name: 'Romanian Deadlift', sets: 2, reps: 17, weight: 25, restSeconds: 60, isWarmup: true, cue: 'Hinge practice - feel hamstring stretch. Bar drags down legs. No floor reset.' },
                ],
            },
            {
                name: 'Activation Sets (Sets 1-3)',
                exercises: [
                    { name: 'Romanian Deadlift', sets: 3, reps: 17, weight: 45, restSeconds: 90, isWarmup: false, cue: 'ACTIVATION - high reps, build hamstring mind-muscle connection. Bar never touches floor. 3-sec eccentric. Feel the stretch at the bottom every rep.' },
                ],
            },
            {
                name: 'Heavy Sets (Biweekly — Sets 4-6)',
                exercises: [
                    { name: 'Romanian Deadlift', sets: 3, reps: 11, weight: 60, restSeconds: 120, isWarmup: false, cue: 'MODERATE-HEAVY - every other week only. Otherwise stay at activation weight.' },
                ],
            },
            {
                name: 'Back-Off Sets (Sets 7-10)',
                exercises: [
                    { name: 'Romanian Deadlift', sets: 4, reps: 15, weight: 47, restSeconds: 90, isWarmup: false, cue: 'Back-off - maintain TUT. 3-sec eccentric. Drive hips forward, hard glute squeeze at top.' },
                ],
            },
            {
                name: 'Accessories',
                exercises: [
                    { name: 'Leg Extensions', sets: 4, reps: 13, weight: 35, restSeconds: 60, isWarmup: false, cue: 'Quad isolation. Full extension + 1 sec hold at top. Controlled lower.' },
                    { name: 'Leg Raises (Finish)', sets: 7, reps: 1, weight: 0, restSeconds: 20, isWarmup: false, cue: '40 sec ON / 20 sec OFF. End week with more core. Progress the ON interval over time.' },
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
