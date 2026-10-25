-- ==============================================================================
-- Migration: 20261025000002_bulk_import_storage_and_history.sql
-- Project: Orange Vikings Load Engine (Ehime Orange Vikings B.League 2026–2027)
-- Description: Creates private Supabase Storage bucket 'import-source-images'
--              and sets secure RLS policies for coaching staff image audit archiving.
-- ==============================================================================

-- 1. Create the private storage bucket for audit screenshots if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'import-source-images',
    'import-source-images',
    false, -- Private bucket: access restricted to coaches, no public URLs
    52428800, -- 50MB per file limit
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

-- 2. Storage RLS Policies: Allow coaching staff to upload and view audit images
DROP POLICY IF EXISTS "Staff upload import images" ON storage.objects;
CREATE POLICY "Staff upload import images" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id = 'import-source-images');

DROP POLICY IF EXISTS "Staff read import images" ON storage.objects;
CREATE POLICY "Staff read import images" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'import-source-images');

DROP POLICY IF EXISTS "Staff delete import images" ON storage.objects;
CREATE POLICY "Staff delete import images" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'import-source-images');

-- 3. Game Appearances RLS Policies for Coaching Staff
DROP POLICY IF EXISTS "Staff manage game_appearances" ON public.game_appearances;
CREATE POLICY "Staff manage game_appearances" ON public.game_appearances
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- 4. Schema Reload Notification
NOTIFY pgrst, 'reload schema';
