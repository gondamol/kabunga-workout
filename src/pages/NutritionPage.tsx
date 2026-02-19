import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { saveMeal, deleteMeal, getMealsByDate } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import { getTodayKey } from '../lib/utils';
import { MEAL_PRESETS } from '../lib/constants';
import type { Meal } from '../lib/types';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Apple, Plus, X, Trash2, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function NutritionPage() {
    const { user } = useAuthStore();
    const [date, setDate] = useState(getTodayKey());
    const [meals, setMeals] = useState<Meal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Manual entry state
    const [mealName, setMealName] = useState('');
    const [mealType, setMealType] = useState<Meal['mealType']>('lunch');
    const [calories, setCalories] = useState(0);
    const [protein, setProtein] = useState(0);
    const [carbs, setCarbs] = useState(0);
    const [fat, setFat] = useState(0);

    useEffect(() => {
        if (!user) return;
        setLoading(true);
        getMealsByDate(user.uid, date)
            .then(setMeals)
            .catch(console.warn)
            .finally(() => setLoading(false));
    }, [user, date]);

    const totals = {
        calories: meals.reduce((s, m) => s + m.calories, 0),
        protein: meals.reduce((s, m) => s + m.protein, 0),
        carbs: meals.reduce((s, m) => s + m.carbs, 0),
        fat: meals.reduce((s, m) => s + m.fat, 0),
    };

    const macroData = [
        { name: 'Protein', value: totals.protein * 4, color: '#06b6d4' },
        { name: 'Carbs', value: totals.carbs * 4, color: '#f59e0b' },
        { name: 'Fat', value: totals.fat * 9, color: '#ef4444' },
    ].filter((d) => d.value > 0);

    const handleAddMeal = async () => {
        if (!user || !mealName.trim()) return;

        const meal: Meal = {
            id: Math.random().toString(36).slice(2) + Date.now(),
            userId: user.uid,
            name: mealName.trim(),
            calories,
            protein,
            carbs,
            fat,
            date,
            mealType,
            createdAt: Date.now(),
        };

        try {
            await saveMeal(meal);
        } catch {
            await enqueueAction({ type: 'meal', action: 'create', data: meal });
        }

        setMeals((prev) => [...prev, meal]);
        resetForm();
        setShowAdd(false);
        toast.success('Meal logged! 🍽️');
    };

    const handlePreset = (preset: typeof MEAL_PRESETS[0]) => {
        setMealName(preset.name);
        setCalories(preset.calories);
        setProtein(preset.protein);
        setCarbs(preset.carbs);
        setFat(preset.fat);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteMeal(id);
        } catch { }
        setMeals((prev) => prev.filter((m) => m.id !== id));
        toast.success('Removed');
    };

    const resetForm = () => {
        setMealName('');
        setCalories(0);
        setProtein(0);
        setCarbs(0);
        setFat(0);
        setSearchQuery('');
    };

    const isToday = date === getTodayKey();

    const filteredPresets = MEAL_PRESETS.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const mealsByType = {
        breakfast: meals.filter((m) => m.mealType === 'breakfast'),
        lunch: meals.filter((m) => m.mealType === 'lunch'),
        dinner: meals.filter((m) => m.mealType === 'dinner'),
        snack: meals.filter((m) => m.mealType === 'snack'),
    };

    return (
        <div className="max-w-lg mx-auto px-4 pt-6 pb-4 space-y-6">
            <h1 className="text-2xl font-bold animate-fade-in">Nutrition</h1>

            {/* Date picker */}
            <div className="flex items-center justify-between glass rounded-2xl px-4 py-3 animate-fade-in">
                <button
                    onClick={() => setDate(dayjs(date).subtract(1, 'day').format('YYYY-MM-DD'))}
                    className="p-2 text-text-muted"
                >
                    <ChevronLeft size={20} />
                </button>
                <span className="text-sm font-semibold">
                    {isToday ? 'Today' : dayjs(date).format('ddd, MMM D')}
                </span>
                <button
                    onClick={() => {
                        const next = dayjs(date).add(1, 'day');
                        if (next.isBefore(dayjs().add(1, 'day'))) setDate(next.format('YYYY-MM-DD'));
                    }}
                    className="p-2 text-text-muted"
                    disabled={isToday}
                >
                    <ChevronRight size={20} />
                </button>
            </div>

            {/* Summary */}
            <div className="glass rounded-2xl p-4 animate-fade-in stagger-1">
                <div className="flex items-center gap-4">
                    {/* Pie chart */}
                    <div className="w-24 h-24 shrink-0">
                        {macroData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={macroData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={25}
                                        outerRadius={40}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {macroData.map((d, i) => (
                                            <Cell key={i} fill={d.color} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center rounded-full border-4 border-dashed border-border">
                                <Apple size={24} className="text-text-muted" />
                            </div>
                        )}
                    </div>

                    <div className="flex-1">
                        <div className="flex items-baseline gap-1 mb-3">
                            <span className="text-3xl font-bold">{totals.calories}</span>
                            <span className="text-text-muted text-sm">kcal</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                            <MacroBlock label="Protein" value={totals.protein} color="bg-cyan" />
                            <MacroBlock label="Carbs" value={totals.carbs} color="bg-amber" />
                            <MacroBlock label="Fat" value={totals.fat} color="bg-red" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Meals by type */}
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => {
                const typeMeals = mealsByType[type];
                if (typeMeals.length === 0) return null;
                return (
                    <div key={type} className="animate-fade-in">
                        <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2 capitalize">{type}</h3>
                        <div className="space-y-2">
                            {typeMeals.map((m) => (
                                <div key={m.id} className="glass rounded-xl p-3 flex items-center gap-3">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{m.name}</p>
                                        <p className="text-xs text-text-muted">
                                            {m.calories} kcal • P:{m.protein}g C:{m.carbs}g F:{m.fat}g
                                        </p>
                                    </div>
                                    <button onClick={() => handleDelete(m.id)} className="p-2 text-text-muted hover:text-red">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}

            {/* Add button */}
            <button
                id="add-meal-btn"
                onClick={() => { setShowAdd(true); resetForm(); }}
                className="w-full py-4 rounded-2xl gradient-primary text-white font-bold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-accent/25"
            >
                <Plus size={20} />
                Log Meal
            </button>

            {/* Empty state */}
            {!loading && meals.length === 0 && (
                <div className="text-center py-8">
                    <p className="text-text-secondary text-sm">No meals logged {isToday ? 'today' : 'for this day'}</p>
                </div>
            )}

            {/* Add meal modal */}
            {showAdd && (
                <div className="fixed inset-0 z-[100] bg-black/60 flex items-end" onClick={() => setShowAdd(false)}>
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Log Meal</h3>
                            <button onClick={() => setShowAdd(false)} className="p-2 text-text-muted"><X size={20} /></button>
                        </div>

                        {/* Presets */}
                        <div className="mb-4">
                            <div className="relative mb-2">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search presets..."
                                    className="w-full bg-bg-input border border-border rounded-xl py-2.5 px-9 text-sm focus:outline-none focus:border-accent/50"
                                />
                            </div>
                            <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto no-scrollbar">
                                {filteredPresets.map((p) => (
                                    <button
                                        key={p.name}
                                        onClick={() => handlePreset(p)}
                                        className="text-xs px-3 py-1.5 rounded-lg glass hover:bg-bg-card-hover transition-colors"
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Form */}
                        <div className="space-y-3">
                            <input
                                type="text"
                                value={mealName}
                                onChange={(e) => setMealName(e.target.value)}
                                placeholder="Meal name..."
                                className="w-full bg-bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50"
                            />

                            <div className="grid grid-cols-4 gap-2">
                                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((t) => (
                                    <button
                                        key={t}
                                        onClick={() => setMealType(t)}
                                        className={`py-2.5 rounded-xl text-xs font-medium transition-all capitalize ${mealType === t ? 'gradient-primary text-white' : 'bg-bg-card text-text-secondary'
                                            }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <NumberField label="Calories" value={calories} onChange={setCalories} />
                                <NumberField label="Protein (g)" value={protein} onChange={setProtein} />
                                <NumberField label="Carbs (g)" value={carbs} onChange={setCarbs} />
                                <NumberField label="Fat (g)" value={fat} onChange={setFat} />
                            </div>

                            <button
                                onClick={handleAddMeal}
                                disabled={!mealName.trim()}
                                className="w-full py-4 rounded-xl gradient-primary text-white font-bold disabled:opacity-30 active:scale-[0.98] transition-transform"
                            >
                                Save Meal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function MacroBlock({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div>
            <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${color}`} />
                <span className="text-xs text-text-muted">{label}</span>
            </div>
            <span className="text-sm font-bold">{Math.round(value)}g</span>
        </div>
    );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
    return (
        <div>
            <label className="text-xs text-text-muted mb-1 block">{label}</label>
            <input
                type="number"
                inputMode="numeric"
                value={value || ''}
                onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
                className="w-full bg-bg-input border border-border rounded-xl py-3 px-3 text-sm text-center focus:outline-none focus:border-accent/50"
            />
        </div>
    );
}
