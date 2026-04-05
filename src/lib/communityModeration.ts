import type {
    CommunityReport,
    CommunityReportReason,
    CommunityReportTargetType,
} from './types';

export const COMMUNITY_REPORT_REASONS: CommunityReportReason[] = [
    'spam',
    'harassment',
    'unsafe',
    'other',
];

const STATUS_WEIGHT = {
    open: 0,
    reviewed: 1,
    resolved: 2,
} as const;

export const getCommunityReportReasonLabel = (reason: CommunityReportReason): string => {
    if (reason === 'spam') return 'Spam';
    if (reason === 'harassment') return 'Harassment';
    if (reason === 'unsafe') return 'Unsafe';
    return 'Other';
};

const trimPreview = (preview: string): string => {
    const normalized = preview.trim().replace(/\s+/g, ' ');
    if (normalized.length <= 140) return normalized;
    return `${normalized.slice(0, 137).trimEnd()}...`;
};

export const buildCommunityReport = (input: {
    id: string;
    groupId: string;
    ownerId: string;
    reporterId: string;
    reporterName: string;
    targetType: CommunityReportTargetType;
    targetId: string;
    targetPreview: string;
    reason: CommunityReportReason;
    details?: string;
    now?: number;
}): CommunityReport => {
    const timestamp = input.now ?? Date.now();
    const details = (input.details || '').trim();

    return {
        id: input.id,
        groupId: input.groupId,
        ownerId: input.ownerId,
        reporterId: input.reporterId,
        reporterName: input.reporterName.trim() || 'Member',
        targetType: input.targetType,
        targetId: input.targetId,
        targetPreview: trimPreview(input.targetPreview),
        reason: input.reason,
        details: details.length > 0 ? details : null,
        status: 'open',
        createdAt: timestamp,
        updatedAt: timestamp,
    };
};

export const sortCommunityReports = (reports: CommunityReport[]): CommunityReport[] => {
    return [...reports].sort((left, right) => {
        const statusDelta = STATUS_WEIGHT[left.status] - STATUS_WEIGHT[right.status];
        if (statusDelta !== 0) return statusDelta;
        if (left.createdAt !== right.createdAt) return right.createdAt - left.createdAt;
        return left.reporterName.localeCompare(right.reporterName);
    });
};

export const countOpenCommunityReports = (reports: CommunityReport[]): number => {
    return reports.filter((report) => report.status === 'open').length;
};
