import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkoutStore } from '../stores/workoutStore';
import { saveWorkout } from '../lib/firestoreService';
import { enqueueAction } from '../lib/offlineQueue';
import { formatDuration, generateWorkoutSummary, shareWorkout, compressImage } from '../lib/utils';
import { uploadMedia } from '../lib/firestoreService';
import { useAuthStore } from '../stores/authStore';
import { COMMON_EXERCISES } from '../lib/constants';
import toast from 'react-hot-toast';
import {
    Plus, X, Trash2, Check, Square, CheckSquare,
    Camera, Video, Share2, StopCircle, ChevronDown, ChevronUp,
    Pause, Play, Search,
} from 'lucide-react';
import Webcam from 'react-webcam';

export default function ActiveWorkoutPage() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const {
        activeSession, timerSeconds, isTimerRunning,
        addExercise, removeExercise, addSet, removeSet, updateSet, toggleSetComplete,
        endWorkout, cancelWorkout, tick, setTimerRunning, addMediaUrl,
    } = useWorkoutStore();

    const [showExercisePicker, setShowExercisePicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customExercise, setCustomExercise] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [showEndConfirm, setShowEndConfirm] = useState(false);
    const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);

    const webcamRef = useRef<Webcam>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);

    // Timer tick
    useEffect(() => {
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [tick]);

    // Redirect if no session
    useEffect(() => {
        if (!activeSession) navigate('/workout', { replace: true });
    }, [activeSession, navigate]);

    const filteredExercises = COMMON_EXERCISES.filter((e) =>
        e.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddExercise = (name: string) => {
        addExercise(name);
        setShowExercisePicker(false);
        setSearchQuery('');
        setCustomExercise('');
    };

    const handleAddCustom = () => {
        if (customExercise.trim()) {
            handleAddExercise(customExercise.trim());
        }
    };

    // Camera capture
    const capturePhoto = useCallback(async () => {
        if (!webcamRef.current || !user) return;
        const imageSrc = webcamRef.current.getScreenshot();
        if (!imageSrc) return;

        setUploading(true);
        try {
            const res = await fetch(imageSrc);
            const blob = await res.blob();
            console.log('📸 Captured blob:', blob.type, blob.size, 'bytes');
            const compressed = await compressImage(blob);
            console.log('📸 Compressed blob:', compressed.type, compressed.size, 'bytes');
            console.log('📸 Uploading to Supabase...');
            const url = await uploadMedia(user.uid, compressed, 'photo.webp');
            console.log('📸 Upload success! URL:', url);
            addMediaUrl(url);
            toast.success('Photo saved! 📸');
        } catch (err: any) {
            console.error('📸 Upload error full details:', err);
            console.error('📸 Error message:', err?.message);
            console.error('📸 Error code:', err?.statusCode || err?.code || err?.error);
            toast.error(`Upload failed: ${err?.message || err?.error || 'Unknown error'}`, { duration: 6000 });
        } finally {
            setUploading(false);
        }
    }, [user, addMediaUrl]);

    // Video recording
    const startRecording = useCallback(() => {
        if (!webcamRef.current?.stream) return;
        chunksRef.current = [];
        const mr = new MediaRecorder(webcamRef.current.stream, { mimeType: 'video/webm' });
        mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
        mr.onstop = async () => {
            if (!user) return;
            const blob = new Blob(chunksRef.current, { type: 'video/webm' });
            setUploading(true);
            try {
                const url = await uploadMedia(user.uid, blob, 'video.webm');
                addMediaUrl(url);
                toast.success('Video saved! 🎬');
            } catch { toast.error('Failed to upload video'); }
            finally { setUploading(false); }
        };
        mr.start();
        mediaRecorderRef.current = mr;
        setIsRecording(true);
        // Auto-stop after 30 seconds
        setTimeout(() => {
            if (mediaRecorderRef.current?.state === 'recording') {
                mediaRecorderRef.current.stop();
                setIsRecording(false);
            }
        }, 30000);
    }, [user, addMediaUrl]);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, []);

    // End workout
    const handleEnd = async () => {
        const completed = endWorkout();
        if (!completed) return;

        const totalSets = completed.exercises.reduce((s, e) => s + e.sets.length, 0);
        const summary = generateWorkoutSummary(
            completed.duration,
            completed.exercises.length,
            totalSets,
            completed.caloriesEstimate,
        );

        // ✅ Navigate immediately — don't wait for Firestore
        toast.success('Workout complete! 🎉', { duration: 4000 });
        navigate('/', { replace: true });

        // Save to Firestore in background
        saveWorkout(completed).catch(async () => {
            await enqueueAction({ type: 'workout', action: 'create', data: completed });
            toast('Saved offline — will sync when online', { icon: '📴' });
        });

        // Offer share after a short delay
        setTimeout(() => {
            if (confirm('Share your workout? 💪')) {
                shareWorkout(summary);
            }
        }, 800);
    };

    const handleCancel = () => {
        if (confirm('Cancel workout? All data will be lost.')) {
            cancelWorkout();
            navigate('/workout', { replace: true });
        }
    };

    if (!activeSession) return null;

    return (
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8 min-h-screen flex flex-col">
            {/* Timer header */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={handleCancel} className="text-text-muted text-sm font-medium px-3 py-2">
                    Cancel
                </button>
                <div className="text-center">
                    <p className="text-3xl font-black tracking-wider font-mono gradient-text">
                        {formatDuration(timerSeconds)}
                    </p>
                </div>
                <button
                    onClick={() => setTimerRunning(!isTimerRunning)}
                    className="w-10 h-10 rounded-xl bg-bg-card flex items-center justify-center"
                >
                    {isTimerRunning ? <Pause size={18} className="text-amber" /> : <Play size={18} className="text-green" />}
                </button>
            </div>

            {/* Camera toggle & media count */}
            {import.meta.env.VITE_SUPABASE_URL && (
                <div className="flex items-center gap-2 mb-4">
                    <button
                        id="toggle-camera"
                        onClick={() => setShowCamera(!showCamera)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${showCamera ? 'bg-accent text-white' : 'glass text-text-secondary'
                            }`}
                    >
                        <Camera size={16} />
                        Camera
                    </button>
                    {activeSession.mediaUrls.length > 0 && (
                        <span className="text-xs text-text-muted px-2 py-1 bg-bg-card rounded-lg">
                            {activeSession.mediaUrls.length} media
                        </span>
                    )}
                </div>
            )}

            {/* Camera panel */}
            {showCamera && (
                <div className="glass rounded-2xl p-3 mb-4 animate-slide-up">
                    <div className="rounded-xl overflow-hidden mb-3 aspect-[4/3] bg-bg-input">
                        <Webcam
                            ref={webcamRef}
                            audio={false}
                            screenshotFormat="image/jpeg"
                            videoConstraints={{ facingMode: 'environment', width: 640, height: 480 }}
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="flex items-center justify-center gap-4">
                        <button
                            onClick={capturePhoto}
                            disabled={uploading}
                            className="w-14 h-14 rounded-full bg-white flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                        >
                            <Camera size={24} className="text-bg-primary" />
                        </button>
                        {!isRecording ? (
                            <button
                                onClick={startRecording}
                                disabled={uploading}
                                className="w-14 h-14 rounded-full bg-red flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
                            >
                                <Video size={24} className="text-white" />
                            </button>
                        ) : (
                            <button
                                onClick={stopRecording}
                                className="w-14 h-14 rounded-full bg-red flex items-center justify-center animate-pulse active:scale-95 transition-transform"
                            >
                                <StopCircle size={24} className="text-white" />
                            </button>
                        )}
                    </div>
                    {uploading && (
                        <p className="text-xs text-text-muted text-center mt-2">Uploading...</p>
                    )}
                </div>
            )}

            {/* Exercise list */}
            <div className="flex-1 space-y-3">
                {activeSession.exercises.map((exercise) => {
                    const isExpanded = expandedExercise === exercise.id;
                    const completedSets = exercise.sets.filter((s) => s.completed).length;
                    return (
                        <div key={exercise.id} className="glass rounded-2xl overflow-hidden animate-fade-in">
                            <button
                                onClick={() => setExpandedExercise(isExpanded ? null : exercise.id)}
                                className="w-full flex items-center gap-3 p-4"
                            >
                                <div className="flex-1 text-left">
                                    <p className="font-semibold text-sm">{exercise.name}</p>
                                    <p className="text-xs text-text-muted">
                                        {completedSets}/{exercise.sets.length} sets
                                    </p>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); removeExercise(exercise.id); }}
                                    className="text-text-muted p-2"
                                >
                                    <Trash2 size={16} />
                                </button>
                                {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
                            </button>

                            {isExpanded && (
                                <div className="px-4 pb-4 space-y-2 animate-fade-in">
                                    {/* Sets header */}
                                    <div className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 text-xs text-text-muted font-medium px-1">
                                        <span>Set</span>
                                        <span>Weight (kg)</span>
                                        <span>Reps</span>
                                        <span></span>
                                    </div>

                                    {exercise.sets.map((set, idx) => (
                                        <div key={set.id} className="grid grid-cols-[40px_1fr_1fr_40px] gap-2 items-center">
                                            <button
                                                onClick={() => toggleSetComplete(exercise.id, set.id)}
                                                className="flex items-center justify-center"
                                            >
                                                {set.completed ? (
                                                    <CheckSquare size={20} className="text-green" />
                                                ) : (
                                                    <Square size={20} className="text-text-muted" />
                                                )}
                                            </button>
                                            <input
                                                type="number"
                                                inputMode="decimal"
                                                value={set.weight || ''}
                                                onChange={(e) =>
                                                    updateSet(exercise.id, set.id, { weight: parseFloat(e.target.value) || 0 })
                                                }
                                                placeholder="0"
                                                className="bg-bg-input border border-border rounded-xl py-3 px-3 text-sm text-center focus:outline-none focus:border-accent/50"
                                            />
                                            <input
                                                type="number"
                                                inputMode="numeric"
                                                value={set.reps || ''}
                                                onChange={(e) =>
                                                    updateSet(exercise.id, set.id, { reps: parseInt(e.target.value) || 0 })
                                                }
                                                placeholder="0"
                                                className="bg-bg-input border border-border rounded-xl py-3 px-3 text-sm text-center focus:outline-none focus:border-accent/50"
                                            />
                                            <button
                                                onClick={() => removeSet(exercise.id, set.id)}
                                                className="flex items-center justify-center text-text-muted"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        onClick={() => addSet(exercise.id)}
                                        className="w-full py-2.5 rounded-xl border border-dashed border-border text-text-muted text-xs font-medium hover:border-accent/50 hover:text-accent transition-colors"
                                    >
                                        + Add Set
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Add exercise button */}
                <button
                    id="add-exercise-btn"
                    onClick={() => setShowExercisePicker(true)}
                    className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-text-muted font-medium flex items-center justify-center gap-2 hover:border-accent/50 hover:text-accent transition-colors active:scale-[0.98]"
                >
                    <Plus size={20} />
                    Add Exercise
                </button>
            </div>

            {/* End workout */}
            <div className="mt-6 pt-4 border-t border-border">
                {!showEndConfirm ? (
                    <button
                        id="finish-workout-btn"
                        onClick={() => setShowEndConfirm(true)}
                        className="w-full py-4 rounded-2xl gradient-green text-white font-bold text-lg flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-green/20"
                    >
                        <Check size={22} />
                        Finish Workout
                    </button>
                ) : (
                    <div className="space-y-3 animate-fade-in">
                        <p className="text-center text-sm text-text-secondary">
                            End workout? ({activeSession.exercises.length} exercises, {formatDuration(timerSeconds)})
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowEndConfirm(false)}
                                className="flex-1 py-3 rounded-xl bg-bg-card text-text-secondary font-medium"
                            >
                                Keep Going
                            </button>
                            <button
                                onClick={handleEnd}
                                className="flex-1 py-3 rounded-xl gradient-green text-white font-bold"
                            >
                                End & Save
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Exercise Picker Modal */}
            {showExercisePicker && (
                <div
                    className="fixed inset-0 z-[100] bg-black/60 flex items-end"
                    onClick={() => setShowExercisePicker(false)}
                >
                    <div
                        className="w-full max-w-lg mx-auto bg-bg-surface rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto animate-slide-up"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-bold">Add Exercise</h3>
                            <button onClick={() => setShowExercisePicker(false)} className="p-2 text-text-muted">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="relative mb-4">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search exercises..."
                                autoFocus
                                className="w-full bg-bg-input border border-border rounded-xl py-3 px-10 text-sm focus:outline-none focus:border-accent/50"
                            />
                        </div>

                        {/* Custom */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                value={customExercise}
                                onChange={(e) => setCustomExercise(e.target.value)}
                                placeholder="Custom exercise..."
                                className="flex-1 bg-bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:border-accent/50"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddCustom()}
                            />
                            <button
                                onClick={handleAddCustom}
                                disabled={!customExercise.trim()}
                                className="px-4 rounded-xl gradient-primary text-white text-sm font-medium disabled:opacity-30"
                            >
                                Add
                            </button>
                        </div>

                        {/* List */}
                        <div className="space-y-1">
                            {filteredExercises.map((name) => (
                                <button
                                    key={name}
                                    onClick={() => handleAddExercise(name)}
                                    className="w-full text-left py-3 px-4 rounded-xl text-sm hover:bg-bg-card-hover transition-colors active:scale-[0.98]"
                                >
                                    {name}
                                </button>
                            ))}
                            {filteredExercises.length === 0 && searchQuery && (
                                <p className="text-center text-text-muted text-sm py-4">
                                    No matches. Use custom input above.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
