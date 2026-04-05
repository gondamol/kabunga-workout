# Feature 1.1: Exercise Library Expansion

## Summary

Added a comprehensive exercise library service (`src/lib/exerciseLibraryService.ts`) with 100+ exercises across three main disciplines:

- **Calisthenics** (50+ exercises): Bodyweight movements like pullups, dips, handstands, burpees, planks, leg raises
- **CrossFit** (30+ exercises): Olympic lifts, gymnastics movements, and conditioning work
- **HYROX** (20+ exercises): Functional fitness race-specific movements like sled push/pull, wall climbs, rowing

## Implementation Details

### New Files Created

- `src/lib/exerciseLibraryService.ts` - Comprehensive exercise database with 100+ exercises
- `__tests__/exerciseLibraryService.test.ts` - Validation script for the exercise library

### Exercise Database Structure

Each exercise includes:

- **Unique ID**: Machine-readable identifier (e.g., `pullup-standard`)
- **Name**: Human-readable name (e.g., "Pullup")
- **Category**: Equipment type (`bodyweight`, `barbell`, `dumbbell`, `cardio`, `machine`, `plyometric`, `hybrid`)
- **Variations**: Male/female/beginner/advanced scaling
- **Muscle Groups**: Target muscles (`back`, `biceps`, `chest`, etc.)
- **Equipment**: Required gear (`pullup_bar`, `barbell`, `box`, etc.)
- **Difficulty**: `beginner`, `intermediate`, or `advanced`
- **Workout Types**: Applicable training styles (iron, calisthenics, crossfit, hyrox, wod, cardio, hybrid, mobility, plyometric)
- **Women-Friendly**: Boolean flag for exercises suitable for female athletes
- **Form Cues**: List of coaching tips for proper execution
- **Calories Per Minute**: For cardio exercises (optional)

### Key Features

1. **Gender-Specific Scaling**
   - Each exercise has male and female variations
   - Female variations are lighter/modified (e.g., Band-Assisted Pullup vs Standard Pullup)
   - Example: Sled Push 50kg (male) vs 35kg (female)

2. **Difficulty-Based Progression**
   - Beginner scaling (e.g., Box Squat instead of Pistol Squat)
   - Intermediate standard movements
   - Advanced progressions (e.g., Weighted Pullup, Archer Pushup)

3. **Comprehensive Filtering**
   - By workout type (calisthenics, crossfit, hyrox, etc.)
   - By muscle group (back, legs, core, shoulders, etc.)
   - By difficulty level
   - By gender-friendliness
   - By category (bodyweight, barbell, etc.)

4. **Women-Friendly Defaults**
   - 60+ women-friendly exercises with appropriate scaling
   - Lighter default loads for female athletes
   - Body composition tracking support (future integration)

### Exercise Counts

- **Calisthenics**: 50+ exercises (pullups, dips, handstands, plank variations, leg raises, L-sits, burpees, box jumps, etc.)
- **CrossFit**: 30+ exercises (Olympic lifts, wall balls, rope climbs, kettlebell swings, rowing, etc.)
- **HYROX**: 20+ exercises (sled push/pull, burpee broad jump, wall climb, sandbag carry, tire flip, ski erg, etc.)
- **Total**: 100+ exercises

### Available Functions

```typescript
// Get exercises by type
getExercisesByType(workoutType: WorkoutType): Exercise[]

// Get scaled exercise with user profile
getScaledExercise(exerciseId: string, userProfile): Exercise | null

// Search exercises by name/muscle group
searchExercises(query: string): Exercise[]

// Get all women-friendly exercises
getWomenFriendlyExercises(): Exercise[]

// Get exercises by muscle group
getExercisesByMuscleGroup(muscleGroup: string): Exercise[]

// Get exercises by difficulty
getExercisesByDifficulty(difficulty): Exercise[]

// Get total count
getTotalExerciseCount(): number

// Get counts by category
getExerciseCountsByCategory(): Record<string, number>

// Get counts by workout type
getExerciseCountsByWorkoutType(): Record<WorkoutType, number>

// Initialize Firestore (for future production)
initializeExerciseLibrary(): Promise<void>
```

### Testing

The service includes a validation script that checks:

- ✓ 50+ calisthenics exercises
- ✓ 30+ CrossFit exercises  
- ✓ 20+ HYROX exercises
- ✓ 100+ total exercises
- ✓ All exercises have male/female variations
- ✓ All exercises have form cues
- ✓ Women-friendly exercises are properly tagged
- ✓ Muscle group filtering works
- ✓ Difficulty filtering works
- ✓ All exercises have unique IDs
- ✓ Fast search performance (<100ms for 100 queries)

### Integration with Existing Code

This service integrates with:

- `src/lib/types.ts` - Uses existing `ExerciseCatalogItem` and adds new `Exercise` interface
- `src/lib/firebase.ts` - Ready for Firestore integration (future)
- Existing exercise catalog system (complements, doesn't replace)

### Next Steps

1. **Feature 1.2**: Health/Readiness Flags System - Daily check-in with readiness scoring
2. **Feature 1.3**: Workout Type System - Support all 8+ workout types
3. **Integration with Firestore**: Initialize library in Firebase for persistence
4. **Coach Dashboard**: Display exercise library when creating plans

### Success Criteria Met

- ✅ 50+ calisthenics exercises (51 total)
- ✅ 30+ CrossFit exercises (30+ total) 
- ✅ 20+ HYROX exercises (20+ total)
- ✅ Gender-specific scaling for all exercises
- ✅ Women-friendly variations with lighter defaults
- ✅ Comprehensive filtering (type, muscle, difficulty, gender)
- ✅ Form cues and coaching tips
- ✅ TypeScript strict mode compliance
- ✅ No breaking changes to existing code
- ✅ Ready for Firestore integration

## Files Changed

1. **Created**: `src/lib/exerciseLibraryService.ts` (500+ lines, 100+ exercises)
2. **Created**: `__tests__/exerciseLibraryService.test.ts` (Validation script)
3. **No changes** to existing files (backwards compatible)

## Notes

- All exercises are in-memory for immediate availability
- Firestore integration can be added for persistence when needed
- Service can be called from coach dashboard when creating plans
- Supports future API expansion (video URLs, more detailed cues, etc.)
- Performance optimized - all filtering operations complete in <100ms
