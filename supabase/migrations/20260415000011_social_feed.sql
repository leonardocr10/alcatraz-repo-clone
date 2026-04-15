-- Social feed: posts, likes and shares.

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  clan text NULL REFERENCES public.clans(name) ON DELETE SET NULL,
  content text NOT NULL DEFAULT '',
  media_url text NULL,
  media_type text NULL CHECK (media_type IN ('image', 'video')),
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  share_count integer NOT NULL DEFAULT 0,
  CONSTRAINT social_posts_content_or_media_chk CHECK (length(btrim(content)) > 0 OR media_url IS NOT NULL),
  CONSTRAINT social_posts_media_pair_chk CHECK (
    (media_url IS NULL AND media_type IS NULL)
    OR (media_url IS NOT NULL AND media_type IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.social_post_likes (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.social_post_shares (
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_social_posts_created_at
ON public.social_posts (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_id
ON public.social_posts (user_id);

CREATE INDEX IF NOT EXISTS idx_social_post_likes_post_id
ON public.social_post_likes (post_id);

CREATE INDEX IF NOT EXISTS idx_social_post_shares_post_id
ON public.social_post_shares (post_id);

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_post_shares ENABLE ROW LEVEL SECURITY;

-- Social posts visibility for approved authenticated users.
CREATE POLICY "Approved users can view social posts"
ON public.social_posts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can create own social posts"
ON public.social_posts
FOR INSERT
WITH CHECK (
  user_id = public.get_user_id(auth.uid())::uuid
  AND clan IS NOT DISTINCT FROM (
    SELECT me.clan
    FROM public.users me
    WHERE me.auth_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Users can update own social posts"
ON public.social_posts
FOR UPDATE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Users can delete own social posts"
ON public.social_posts
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Likes.
CREATE POLICY "Approved users can view social likes"
ON public.social_post_likes
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can like posts"
ON public.social_post_likes
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

CREATE POLICY "Users can remove own likes"
ON public.social_post_likes
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Shares.
CREATE POLICY "Approved users can view social shares"
ON public.social_post_shares
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can register shares"
ON public.social_post_shares
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

CREATE POLICY "Users can remove own shares"
ON public.social_post_shares
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- Storage bucket for feed media uploads.
INSERT INTO storage.buckets (id, name, public)
VALUES ('social-posts', 'social-posts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for social post media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'social-posts');

CREATE POLICY "Approved users can upload own social post media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'social-posts'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Users can update own social post media"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'social-posts'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'social-posts'
  AND (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
);

CREATE POLICY "Users can delete own social post media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'social-posts'
  AND (
    (storage.foldername(name))[1] = public.get_user_id(auth.uid())::text
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);
