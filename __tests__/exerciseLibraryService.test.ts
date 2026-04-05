/**
 * Validation script for exerciseLibraryService.ts
 * Run this to verify the exercise library is properly populated
 */

import {
  getExercisesByType,
  searchExercises,
  getWomenFriendlyExercises,
  getExercisesByMuscleGroup,
  getExercisesByDifficulty,
  getTotalExerciseCount,
  getExerciseCountsByCategory,
  getExerciseCountsByWorkoutType,
} from '../src/lib/exerciseLibraryService.ts';

export function validateExerciseLibrary(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  // Test 1: Exercise counts
  const calisthenics = getExercisesByType('calisthenics');
  if (calisthenics.length >= 50) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Calisthenics count: ${calisthenics.length} (expected ≥50)`);
  }

  const crossfit = getExercisesByType('crossfit');
  if (crossfit.length >= 30) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ CrossFit count: ${crossfit.length} (expected ≥30)`);
  }

  const hyrox = getExercisesByType('hyrox');
  if (hyrox.length >= 20) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ HYROX count: ${hyrox.length} (expected ≥20)`);
  }

  const total = getTotalExerciseCount();
  if (total >= 100) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Total exercises: ${total} (expected ≥100)`);
  }

  // Test 2: Exercise retrieval
  const pullupResults = searchExercises('pullup');
  if (pullupResults.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Pullup not found in exercises');
  }

  const burpeeResults = searchExercises('burpee');
  if (burpeeResults.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Burpee not found in exercises');
  }

  const sledPushResults = searchExercises('sled push');
  if (sledPushResults.length > 0 && sledPushResults[0].workoutTypes.includes('hyrox')) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Sled Push (HYROX) not found');
  }

  // Test 3: Women-friendly exercises
  const womenFriendly = getWomenFriendlyExercises();
  if (womenFriendly.length > 0 && womenFriendly.every(e => e.isWomenFriendly)) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Women-friendly exercises invalid (count: ${womenFriendly.length})`);
  }

  // Test 4: Muscle group filtering
  const backExercises = getExercisesByMuscleGroup('back');
  if (backExercises.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ No back exercises found');
  }

  const legExercises = getExercisesByMuscleGroup('legs');
  if (legExercises.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ No leg exercises found');
  }

  const coreExercises = getExercisesByMuscleGroup('core');
  if (coreExercises.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ No core exercises found');
  }

  // Test 5: Difficulty filtering
  const beginnerExercises = getExercisesByDifficulty('beginner');
  if (beginnerExercises.length > 0 && beginnerExercises.every(e => e.difficulty === 'beginner')) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Beginner exercises invalid (count: ${beginnerExercises.length})`);
  }

  const intermediateExercises = getExercisesByDifficulty('intermediate');
  if (intermediateExercises.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ No intermediate exercises found');
  }

  const advancedExercises = getExercisesByDifficulty('advanced');
  if (advancedExercises.length > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ No advanced exercises found');
  }

  // Test 6: Category breakdown
  const categoryCounts = getExerciseCountsByCategory();
  if (categoryCounts['bodyweight'] && categoryCounts['bodyweight'] > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Missing bodyweight exercises');
  }

  if (categoryCounts['barbell'] && categoryCounts['barbell'] > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Missing barbell exercises');
  }

  if (categoryCounts['plyometric'] && categoryCounts['plyometric'] > 0) {
    passed++;
  } else {
    failed++;
    errors.push('✗ Missing plyometric exercises');
  }

  // Test 7: Workout type counts
  const typeCounts = getExerciseCountsByWorkoutType();
  if (typeCounts.calisthenics >= 50) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ Calisthenics workout type count: ${typeCounts.calisthenics}`);
  }

  if (typeCounts.crossfit >= 30) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ CrossFit workout type count: ${typeCounts.crossfit}`);
  }

  if (typeCounts.hyrox >= 20) {
    passed++;
  } else {
    failed++;
    errors.push(`✗ HYROX workout type count: ${typeCounts.hyrox}`);
  }

  return { passed, failed, errors };
}

const reportValidationResult = () => {
  const result = validateExerciseLibrary();
  console.log(
    `Exercise Library Validation: ${result.passed} passed, ${result.failed} failed`
  );
  if (result.errors.length > 0) {
    console.error('Errors:');
    result.errors.forEach(err => console.error(err));
  } else {
    console.log('✓ All validations passed!');
  }
  return result;
};

if (typeof window !== 'undefined') {
  reportValidationResult();
}

if (typeof process !== 'undefined' && typeof window === 'undefined') {
  const result = reportValidationResult();
  if (result.failed > 0) process.exitCode = 1;
}
