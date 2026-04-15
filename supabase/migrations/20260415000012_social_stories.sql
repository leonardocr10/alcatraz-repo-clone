-- Stories for social feed (global visibility, 24h expiration by default).

CREATE TABLE IF NOT EXISTS public.social_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clan text NULL REFERENCES public.clans(name) ON DELETE SET NULL,
  media_url text NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  caption text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_social_stories_active_expires
ON public.social_stories (is_active, expires_at DESC);

ALTER TABLE public.social_stories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view active stories"
ON public.social_stories
FOR SELECT
USING (
  is_active = true
  AND expires_at > now()
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can create own stories"
ON public.social_stories
FOR INSERT
WITH CHECK (
  user_id = public.get_user_id(auth.uid())::uuid
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Users can update own stories"
ON public.social_stories
FOR UPDATE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can delete own stories"
ON public.social_stories
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

INSERT INTO storage.buckets (id, name, public)
VALUES ('social-stories', 'social-stories', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for story media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'social-stories');

CREATE POLICY "Approved users can upload own story media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-stories'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Users can update own story media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'social-stories'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'social-stories'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
);

CREATE POLICY "Users can delete own story media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-stories'
  AND (
    (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
