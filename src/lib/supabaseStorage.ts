import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only initialize if configured
const supabase = supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey)
    : null;

export const isSupabaseConfigured = (): boolean => !!supabase;

const BUCKET = 'workout-media';

export const uploadToSupabase = async (
    userId: string,
    file: Blob,
    filename: string
): Promise<string> => {
    if (!supabase) {
        throw new Error('Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env');
    }

    console.log('🗄️ Supabase URL:', supabaseUrl);
    console.log('🗄️ Bucket:', BUCKET);
    console.log('🗄️ File type:', file.type, 'size:', file.size);

    const path = `${userId}/${Date.now()}_${filename}`;

    const { data, error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
            contentType: file.type || 'image/webp',
            upsert: true, // overwrite if exists
        });

    if (error) {
        console.error('🗄️ Supabase upload error:', JSON.stringify(error));
        // Give a helpful message based on error type
        if (error.message?.includes('Bucket not found') || error.message?.includes('bucket')) {
            throw new Error(`Bucket "${BUCKET}" not found. Create it in Supabase → Storage → New bucket`);
        }
        if (error.message?.includes('row-level security') || error.message?.includes('policy') || error.message?.includes('403')) {
            throw new Error('Storage policy error — go to Supabase → Storage → Policies and add an INSERT policy for anon users');
        }
        throw error;
    }

    console.log('🗄️ Upload success, path:', data?.path);

    const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(path);

    return urlData.publicUrl;
};
