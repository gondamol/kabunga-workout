import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/DashboardPage.tsx', import.meta.url), 'utf8');
const onboarding = readFileSync(new URL('../src/pages/OnboardingPage.tsx', import.meta.url), 'utf8');

const requiredCssClasses = [
    '.shell-aurora',
    '.premium-hero-card',
    '.athlete-spotlight',
    '.floating-stat-chip',
    '.soft-panel',
];

for (const className of requiredCssClasses) {
    if (!css.includes(className)) {
        throw new Error(`Missing visual class ${className}`);
    }
}

if (!dashboard.includes('premium-hero-card')) {
    throw new Error('Dashboard should use premium-hero-card');
}

if (!onboarding.includes('athlete-spotlight')) {
    throw new Error('Onboarding should use athlete-spotlight');
}

console.log('Shell Visual Direction Validation: 7 passed, 0 failed');
