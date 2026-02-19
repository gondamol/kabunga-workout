import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { getUserChallenges, saveChallenge, updateChallenge, getRecentWorkouts } from '../lib/firestoreService';
import type { Challenge, ChallengePeriod } from '../lib/types';
import { CHALLENGE_TEMPLATES } from '../lib/constants';
import { formatDate } from '../lib/utils';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { Trophy, Plus, X, Flame, Target, CheckCircle2 } from 'lucide-react';

export default function ChallengesPage() {
    const { user } = useAuthStore();
    const [challenges, setChallenges] = useState<Challenge[]>([]);
    const [loading, setLoading] = useState(false);
    const [showCreate, setShowCreate] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPeriod, setNewPeriod] = useState<ChallengePeriod>('monthly');
    const [newTarget, setNewTarget] = useState(12);

    useEffect(() => {
        if (!user) return;
        loadChallenges();
    }, [user]);

    const loadChallenges = async () => {
        if (!user) return;
        try {
            // Run both queries in parallel — twice as fast
            const [c, workouts] = await Promise.all([
                getUserChallenges(user.uid),
                getRecentWorkouts(user.uid, 365),
            ]);
            const updated = c.map((ch) => {
                const inRange = workouts.filter(
                    (w) => w.startedAt >= ch.startDate && w.startedAt <= ch.endDate
                );
                return { ...ch, currentCount: inRange.length, completed: inRange.length >= ch.targetCount };
            });
            setChallenges(updated);
            // Sync updates back in background
            for (const ch of updated) {
                if (ch.currentCount !== c.find((x) => x.id === ch.id)?.currentCount) {
                    updateChallenge(ch.id, { currentCount: ch.currentCount, completed: ch.completed }).catch(() => { });
                }
            }
        } catch (err) {
            console.warn('Failed to load challenges', err);
        }
    };

    const handleCreate = async () => {
        if (!user || !newTitle.trim()) return;

        const now = dayjs();
        let startDate: number, endDate: number;
        switch (newPeriod) {
            case 'weekly':
                startDate = now.startOf('week').valueOf();
                endDate = now.endOf('week').valueOf();
                break;
            case 'monthly':
                startDate = now.startOf('month').valueOf();
                endDate = now.endOf('month').valueOf();
                break;
            case 'yearly':
                startDate = now.startOf('year').valueOf();
                endDate = now.endOf('year').valueOf();
                break;
        }

        const challenge: Challenge = {
            id: Math.random().toString(36).slice(2) + Date.now(),
            userId: user.uid,
            title: newTitle.trim(),
            description: '',
            period: newPeriod,
            targetCount: newTarget,
            currentCount: 0,
            startDate,
            endDate,
            completed: false,
            createdAt: Date.now(),
        };

        // ✅ Optimistic update — show immediately, save in background
        setChallenges((prev) => [challenge, ...prev]);
        setShowCreate(false);
        setNewTitle('');
        toast.success('Challenge created! 🎯');

        // Save to Firestore in background
        saveChallenge(challenge).catch((err: any) => {
            const code = err?.code || err?.message || 'unknown';
            console.error('Challenge save error:', err);
            // Rollback on failure
            setChallenges((prev) => prev.filter((c) => c.id !== challenge.id));
            if (code.includes('permission-denied')) {
                toast.error('Permission denied — check Firestore rules', { duration: 5000 });
            } else {
                toast.error(`Save failed: ${code}`, { duration: 5000 });
            }
        });
    };

    const applyTemplate = (template: typeof CHALLENGE_TEMPLATES[0]) => {
        setNewTitle(template.title);
        setNewPeriod(template.period);
        setNewTarget(template.targetCount);
    };

    const active = challenges.filter((c) => !c.completed && c.endDate >= Date.now());
    const completed = challenges.filter((c) => c.completed);
    const expired = challenges.filter((c) => !c.completed && c.endDate < Date.now());

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6">
            <div className="flex items-center justify-between animate-fade-in">
                <h1 className="text-2xl font-bold">Challenges</h1>
                <button
                    id="create-challenge-btn"
                    onClick={() => setShowCreate(true)}
                    className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center"
                >
                    <Plus size={20} className="text-white" />
                </button>
            </div>

            {/* Active challenges */}
            {active.length > 0 && (
                <Section title="Active" icon={<Flame size={16} className="text-amber" />}>
                    {active.map((c) => (
                        <ChallengeCard key={c.id} challenge={c} />
                    ))}
                </Section>
            )}

            {/* Completed */}
            {completed.length > 0 && (
                <Section title="Completed" icon={<CheckCircle2 size={16} className="text-green" />}>
                    {completed.map((c) => (
                        <ChallengeCard key={c.id} challenge={c} />
                    ))}
                </Section>
            )}

            {/* Expired */}
            {expired.length > 0 && (
                <Section title="Expired" icon={<Target size={16} className="text-red" />}>
                    {expired.map((c) => (
                        <ChallengeCard key={c.id} challenge={c} />
                    ))}
                </Section>
            )}

            {/* Empty state */}
            {!loading && challenges.length === 0 && (
                <div className="text-center py-16 animate-fade-in">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber/10 mb-4">
                        <Trophy size={32} className="text-amber" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">No challenges yet</h3>
                    <p className="text-text-secondary text-sm mb-6">Set goals and track your consistency</p>
                    <button
                        onClick={() => setShowCreate(true)}
                        className="px-6 py-3 rounded-xl gradient-primary text-white font-semibold"
                    >
                        Create First Challenge
                    </button>
                </div>
            )}

            {loading && (
                <div className="space-y-3">
                    {[1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-bg-card animate-pulse" />)}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-end" onClick={() => setShowCreate(false)}>
                    <div className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold">New Challenge</h3>
                            <button onClick={() => setShowCreate(false)} className="p-2 text-text-muted"><X size={20} /></button>
                        </div>

                        {/* Templates */}
                        <div className="mb-4">
                            <p className="text-xs text-text-muted mb-2 font-medium">Quick Templates</p>
                            <div className="flex flex-wrap gap-2">
                                {CHALLENGE_TEMPLATES.map((t) => (
                                    <button
                                        key={t.title}
                                        onClick={() => applyTemplate(t)}
                                        className="text-xs px-3 py-1.5 rounded-lg glass hover:bg-bg-card-hover transition-colors"
                                    >
                                        {t.title}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                                placeholder="Challenge title..."
                                className="w-full bg-bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50"
                            />

                            <div className="grid grid-cols-3 gap-2">
                                {(['weekly', 'monthly', 'yearly'] as const).map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => setNewPeriod(p)}
                                        className={`py-3 rounded-xl text-sm font-medium transition-all ${newPeriod === p ? 'gradient-primary text-white' : 'bg-bg-card text-text-secondary'
                                            }`}
                                    >
                                        {p.charAt(0).toUpperCase() + p.slice(1)}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="text-xs text-text-muted mb-1 block">Target workouts</label>
                                <input
                                    type="number"
                                    inputMode="numeric"
                                    value={newTarget}
                                    onChange={(e) => setNewTarget(parseInt(e.target.value) || 1)}
                                    min={1}
                                    className="w-full bg-bg-input border border-border rounded-xl py-3 px-4 text-sm text-center focus:outline-none focus:border-accent/50"
                                />
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={!newTitle.trim()}
                                className="w-full py-4 rounded-xl gradient-primary text-white font-bold disabled:opacity-30 active:scale-[0.98] transition-transform"
                            >
                                Create Challenge
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
                {icon}
                <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
            </div>
            <div className="space-y-3">{children}</div>
        </div>
    );
}

function ChallengeCard({ challenge: c }: { challenge: Challenge }) {
    const pct = Math.min(100, Math.round((c.currentCount / c.targetCount) * 100));
    const daysLeft = Math.max(0, dayjs(c.endDate).diff(dayjs(), 'day'));

    return (
        <div className={`glass rounded-2xl p-4 ${c.completed ? 'border-green/30' : ''}`}>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    {c.completed && <CheckCircle2 size={16} className="text-green" />}
                    <h4 className="font-semibold text-sm">{c.title}</h4>
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg ${c.completed ? 'bg-green/20 text-green' : 'bg-bg-card text-text-muted'
                    }`}>
                    {c.completed ? 'Completed!' : `${daysLeft}d left`}
                </span>
            </div>

            <div className="flex items-center gap-3">
                <div className="flex-1 h-3 bg-bg-input rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${c.completed ? 'bg-green' : 'gradient-primary'
                            }`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <span className="text-sm font-bold text-text-primary shrink-0">
                    {c.currentCount}/{c.targetCount}
                </span>
            </div>

            <p className="text-xs text-text-muted mt-2">
                {c.period} • {formatDate(c.startDate, 'MMM D')} – {formatDate(c.endDate, 'MMM D')}
            </p>
        </div>
    );
}
