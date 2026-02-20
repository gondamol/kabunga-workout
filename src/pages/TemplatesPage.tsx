import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useWorkoutStore } from '../stores/workoutStore';
import { BUILT_IN_TEMPLATES, getTemplateCategories } from '../lib/templates';
import type { WorkoutTemplate } from '../lib/types';
import { getOneRepMaxes } from '../lib/firestoreService';
import { isIronTemplateId, normalizeOneRepMaxes, scaleTemplateForOneRepMaxes } from '../lib/ironProtocol';
import { Dumbbell, Play, ChevronRight, Zap, Target, Heart, Clock, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const GOAL_ICONS: Record<string, React.ReactNode> = {
    strength: <Zap size={14} className="text-amber" />,
    hypertrophy: <Target size={14} className="text-accent" />,
    endurance: <Heart size={14} className="text-red" />,
    general: <Dumbbell size={14} className="text-cyan" />,
};

const GOAL_COLORS: Record<string, string> = {
    strength: 'bg-amber/10 text-amber border-amber/20',
    hypertrophy: 'bg-accent/10 text-accent border-accent/20',
    endurance: 'bg-red/10 text-red border-red/20',
    general: 'bg-cyan/10 text-cyan border-cyan/20',
};

export default function TemplatesPage() {
    const { user } = useAuthStore();
    const { startFromTemplate, activeSession } = useWorkoutStore();
    const navigate = useNavigate();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    const categories = useMemo(() => ['All', ...getTemplateCategories(BUILT_IN_TEMPLATES)], []);

    const filtered = useMemo(() => {
        if (selectedCategory === 'All') return BUILT_IN_TEMPLATES;
        return BUILT_IN_TEMPLATES.filter(t => t.category === selectedCategory);
    }, [selectedCategory]);

    const handleStart = async (template: WorkoutTemplate) => {
        if (!user) return;
        if (activeSession) {
            if (!confirm('You have an active workout. Start a new one?')) return;
        }
        let selectedTemplate = template;
        if (isIronTemplateId(template.id)) {
            try {
                const maxes = await getOneRepMaxes(user.uid);
                selectedTemplate = scaleTemplateForOneRepMaxes(
                    template,
                    normalizeOneRepMaxes(user.uid, maxes)
                );
            } catch (error) {
                console.warn('Failed to load 1RMs. Starting with default iron template:', error);
            }
        }
        startFromTemplate(user.uid, selectedTemplate);
        toast.success(`Starting ${selectedTemplate.title}! 💪`);
        navigate('/active-workout');
    };

    const getTotalExercises = (t: WorkoutTemplate) =>
        t.phases.reduce((sum, p) => sum + p.exercises.length, 0);

    const getEstimatedTime = (t: WorkoutTemplate) => {
        let totalSets = 0;
        let totalRest = 0;
        for (const p of t.phases) {
            if (p.duration) {
                totalRest += p.duration;
            }
            for (const ex of p.exercises) {
                totalSets += ex.sets;
                totalRest += ex.sets * ex.restSeconds;
            }
        }
        // ~30 sec per set + rest time
        return Math.round((totalSets * 30 + totalRest) / 60);
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-5">
            <div className="animate-fade-in">
                <h1 className="text-2xl font-bold">Templates</h1>
                <p className="text-sm text-text-secondary mt-1">Choose a guided workout plan</p>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide animate-fade-in stagger-1">
                {categories.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedCategory === cat
                            ? 'gradient-primary text-white shadow-md shadow-accent/20'
                            : 'glass text-text-secondary hover:text-text-primary'
                            }`}
                    >
                        {cat === 'All' && <Filter size={12} className="inline mr-1" />}
                        {cat}
                    </button>
                ))}
            </div>

            {/* Template cards */}
            <div className="space-y-3 animate-fade-in stagger-2">
                {filtered.map((template) => (
                    <div key={template.id} className="glass rounded-2xl overflow-hidden">
                        <div className="p-4">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-bold text-base">{template.title}</h3>
                                    <div className="flex items-center gap-3 mt-1.5">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium border ${GOAL_COLORS[template.goalFocus]}`}>
                                            {GOAL_ICONS[template.goalFocus]}
                                            {template.goalFocus}
                                        </span>
                                        <span className="text-xs text-text-muted flex items-center gap-1">
                                            <Dumbbell size={12} /> {getTotalExercises(template)} exercises
                                        </span>
                                        <span className="text-xs text-text-muted flex items-center gap-1">
                                            <Clock size={12} /> ~{getEstimatedTime(template)}m
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleStart(template)}
                                    className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-white shadow-lg shadow-accent/20 active:scale-95 transition-transform shrink-0"
                                >
                                    <Play size={20} fill="white" />
                                </button>
                            </div>

                            {/* Phases preview */}
                            <div className="flex gap-1.5">
                                {template.phases.map((phase, i) => (
                                    <div
                                        key={i}
                                        className="flex-1 bg-bg-input rounded-lg px-2 py-1.5 min-w-0"
                                    >
                                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider truncate">
                                            {phase.name}
                                        </p>
                                        <p className="text-xs text-text-secondary truncate mt-0.5">
                                            {phase.exercises.length} ex
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Exercise list preview */}
                        <div className="border-t border-border px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                                {template.phases
                                    .flatMap(p => p.exercises)
                                    .filter(e => !e.isWarmup)
                                    .slice(0, 6)
                                    .map((ex, i) => (
                                        <span
                                            key={i}
                                            className="text-[11px] px-2 py-1 rounded-lg bg-bg-card text-text-secondary"
                                        >
                                            {ex.name}
                                        </span>
                                    ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
