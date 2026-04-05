import {
    COMMUNITY_REPORT_REASONS,
    buildCommunityReport,
    countOpenCommunityReports,
    getCommunityReportReasonLabel,
    sortCommunityReports,
} from '../src/lib/communityModeration.ts';
import type { CommunityReport } from '../src/lib/types.ts';

type ValidationResult = {
    passed: number;
    failed: number;
    errors: string[];
};

const buildReport = (overrides: Partial<CommunityReport> = {}): CommunityReport => ({
    id: 'report-1',
    groupId: 'group-1',
    ownerId: 'owner-1',
    reporterId: 'user-1',
    reporterName: 'Athlete One',
    targetType: 'message',
    targetId: 'message-1',
    targetPreview: 'Push harder today',
    reason: 'spam',
    details: null,
    status: 'open',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
});

export function validateCommunityModeration(): ValidationResult {
    const errors: string[] = [];
    let passed = 0;
    let failed = 0;

    const built = buildCommunityReport({
        id: 'report-2',
        groupId: 'group-1',
        ownerId: 'owner-1',
        reporterId: 'user-2',
        reporterName: '  Athlete Two  ',
        targetType: 'group',
        targetId: 'group-1',
        targetPreview: '   This group keeps posting the same promo link over and over again in every thread.   ',
        reason: 'unsafe',
        details: '  Repeated gambling links  ',
        now: 50,
    });
    if (
        built.status === 'open'
        && built.reporterName === 'Athlete Two'
        && built.details === 'Repeated gambling links'
        && built.targetPreview.endsWith('thread.')
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community report builder did not normalize the payload as expected');
    }

    const sorted = sortCommunityReports([
        buildReport({ id: 'resolved', status: 'resolved', createdAt: 40 }),
        buildReport({ id: 'reviewed', status: 'reviewed', createdAt: 30 }),
        buildReport({ id: 'open-new', status: 'open', createdAt: 60 }),
        buildReport({ id: 'open-old', status: 'open', createdAt: 20 }),
    ]);
    if (
        sorted[0]?.id === 'open-new'
        && sorted[1]?.id === 'open-old'
        && sorted[2]?.id === 'reviewed'
        && sorted[3]?.id === 'resolved'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community report sorting did not prioritize open and newer reports first');
    }

    const openCount = countOpenCommunityReports(sorted);
    if (openCount === 2) {
        passed++;
    } else {
        failed++;
        errors.push(`✗ Open report count returned ${openCount} instead of 2`);
    }

    if (
        COMMUNITY_REPORT_REASONS.length === 4
        && getCommunityReportReasonLabel('harassment') === 'Harassment'
        && getCommunityReportReasonLabel('other') === 'Other'
    ) {
        passed++;
    } else {
        failed++;
        errors.push('✗ Community report reason options or labels are incorrect');
    }

    return { passed, failed, errors };
}

const reportValidationResult = () => {
    const result = validateCommunityModeration();
    console.log(`Community Moderation Validation: ${result.passed} passed, ${result.failed} failed`);
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
