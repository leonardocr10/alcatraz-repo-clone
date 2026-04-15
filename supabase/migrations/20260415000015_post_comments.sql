-- Comments on social feed posts.

CREATE TABLE IF NOT EXISTS public.social_post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.social_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_social_post_comments_post
ON public.social_post_comments (post_id, created_at DESC);

ALTER TABLE public.social_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view post comments"
ON public.social_post_comments
FOR SELECT
USING (
  is_active = true
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can comment on posts"
ON public.social_post_comments
FOR INSERT
WITH CHECK (
  user_id = public.get_user_id(auth.uid())::uuid
  AND length(btrim(comment)) > 0
  AND EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Users can edit own post comments"
ON public.social_post_comments
FOR UPDATE
USING (user_id = public.get_user_id(auth.uid())::uuid)
WITH CHECK (user_id = public.get_user_id(auth.uid())::uuid);

CREATE POLICY "Users can delete own post comments"
ON public.social_post_comments
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
