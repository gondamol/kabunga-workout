import { SESSION_SUMMARY_THEME } from '../src/lib/sessionDetailPresentation.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

export function validateSessionDetailPresentation(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    if (
        SESSION_SUMMARY_THEME.heroCard.includes('glass')
        && !SESSION_SUMMARY_THEME.heroCard.includes('bg-[#0b1120]')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Hero card theme still uses the old dark hardcoded background: ${SESSION_SUMMARY_THEME.heroCard}`);
    }

    if (
        SESSION_SUMMARY_THEME.previewMetric.includes('bg-bg-surface')
        && SESSION_SUMMARY_THEME.previewMetric.includes('border-border')
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Preview metric theme does not use readable light-shell surfaces: ${SESSION_SUMMARY_THEME.previewMetric}`);
    }

    if (
        SESSION_SUMMARY_THEME.primaryText === 'text-text-primary'
        && SESSION_SUMMARY_THEME.secondaryText === 'text-text-secondary'
    ) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Session summary text tokens are not mapped to readable shell colors: ${JSON.stringify(SESSION_SUMMARY_THEME)}`);
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateSessionDetailPresentation();
    console.log(`Session Detail Presentation Validation: ${result.passed} passed, ${result.failed} failed`);
    if (result.errors.length > 0) {
        console.error('Errors:');
        result.errors.forEach((error) => console.error(error));
    } else {
        console.log('✓ All validations passed!');
    }
    return result;
};

if (typeof process !== 'undefined' && typeof window === 'undefined') {
    const result = reportValidationResult();
    if (result.failed > 0) process.exitCode = 1;
}
