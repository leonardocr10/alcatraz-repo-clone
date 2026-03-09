
-- Add audio_url column to bosses
ALTER TABLE public.bosses ADD COLUMN IF NOT EXISTS audio_url text DEFAULT NULL;

-- Create boss-audio storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('boss-audio', 'boss-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to boss-audio bucket
CREATE POLICY "Public read access for boss audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'boss-audio');

-- Allow authenticated admins to upload boss audio
CREATE POLICY "Admins can upload boss audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'boss-audio' AND has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete boss audio
CREATE POLICY "Admins can delete boss audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'boss-audio' AND has_role(auth.uid(), 'admin'::app_role));
