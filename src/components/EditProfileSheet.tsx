import { useEffect, useState } from 'react';
import { updateProfile } from 'firebase/auth';
import { Check, Pencil, X } from 'lucide-react';
import toast from 'react-hot-toast';
import type { UserProfile } from '../lib/types';
import { updateUserProfile } from '../lib/firestoreService';
import { useAuthStore } from '../stores/authStore';
import { auth } from '../lib/firebase';
import { buildProfileUpdatePatch, ProfileEditValidationError, type ProfileUpdatePatch } from '../lib/profileEditing';

type EditProfileSheetProps = {
    open: boolean;
    profile: UserProfile | null;
    onClose: () => void;
};

export function EditProfileSheet({ open, profile, onClose }: EditProfileSheetProps) {
    const { user } = useAuthStore();
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [bodyWeightKg, setBodyWeightKg] = useState<number | ''>('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open || !profile) return;
        setDisplayName(profile.displayName ?? '');
        setBio(profile.bio ?? '');
        setBodyWeightKg(typeof profile.bodyWeightKg === 'number' ? profile.bodyWeightKg : '');
    }, [open, profile]);

    if (!open) return null;

    const handleSave = async () => {
        if (!profile) {
            toast.error('Profile not loaded yet');
            return;
        }
        let patch: ProfileUpdatePatch;
        try {
            patch = buildProfileUpdatePatch({ displayName, bio, bodyWeightKg });
        } catch (error) {
            toast.error(error instanceof ProfileEditValidationError ? error.message : 'Check your profile details');
            return;
        }

        setSaving(true);
        try {
            await updateUserProfile(profile.uid, patch);
            if (
                user?.uid === profile.uid
                && auth.currentUser?.uid === profile.uid
                && auth.currentUser.displayName !== patch.displayName
            ) {
                await updateProfile(auth.currentUser, { displayName: patch.displayName });
            }
            useAuthStore.setState((state) => {
                if (!state.profile) return state;
                return {
                    ...state,
                    profile: {
                        ...state.profile,
                        displayName: patch.displayName,
                        bio: patch.bio,
                        bodyWeightKg: patch.bodyWeightKg,
                        updatedAt: Date.now(),
                    },
                };
            });
            toast.success('Profile updated');
            onClose();
        } catch (error) {
            console.warn('Failed to update profile:', error);
            toast.error('Could not save. Try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[120] bg-black/55 flex items-end animate-fade-in" onClick={onClose}>
            <div
                className="w-full max-w-lg mx-auto bg-bg-card rounded-t-[2rem] px-5 pt-4 pb-7 max-h-[88vh] overflow-y-auto shadow-lifted"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="w-12 h-1.5 rounded-full bg-border mx-auto mb-4" />
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-xl bg-primary-container flex items-center justify-center">
                            <Pencil size={15} className="text-primary" />
                        </span>
                        <h3 className="font-display text-xl font-extrabold text-text-primary">Edit profile</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full bg-bg-surface text-text-muted">
                        <X size={18} />
                    </button>
                </div>

                <label className="block mb-4">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Display name</span>
                    <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={60}
                        autoComplete="name"
                        className="mt-2 w-full rounded-2xl border border-border bg-bg-input px-4 py-3 text-base font-semibold text-text-primary"
                        placeholder="What should we call you?"
                    />
                </label>

                <label className="block mb-4">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Bio</span>
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        maxLength={240}
                        className="mt-2 w-full rounded-2xl border border-border bg-bg-input px-4 py-3 text-sm text-text-primary resize-none"
                        placeholder="Optional - a sentence about your training"
                    />
                    <span className="mt-1 block text-[11px] text-text-muted">{bio.length}/240</span>
                </label>

                <label className="block mb-5">
                    <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Body weight (kg)</span>
                    <input
                        type="number"
                        min={0}
                        max={400}
                        step={0.5}
                        value={bodyWeightKg}
                        onChange={(e) => setBodyWeightKg(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))}
                        className="mt-2 w-full rounded-2xl border border-border bg-bg-input px-4 py-3 text-base font-semibold text-text-primary"
                        placeholder="Optional - used to estimate calories"
                    />
                </label>

                <div className="flex gap-2">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3.5 rounded-2xl border border-border bg-bg-surface text-sm font-bold text-text-secondary"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex-[2] py-3.5 rounded-2xl bg-primary text-white font-bold flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        <Check size={18} strokeWidth={2.6} />
                        {saving ? 'Saving...' : 'Save changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
