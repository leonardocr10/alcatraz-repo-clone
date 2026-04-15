-- Story reactions and comments (global social mode).

CREATE TABLE IF NOT EXISTS public.social_story_reactions (
  story_id uuid NOT NULL REFERENCES public.social_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (story_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.social_story_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.social_stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  comment text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS idx_story_reactions_story ON public.social_story_reactions (story_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_comments_story ON public.social_story_comments (story_id, created_at DESC);

ALTER TABLE public.social_story_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_story_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view story reactions"
ON public.social_story_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND me.approved = true
  )
);

CREATE POLICY "Approved users can react to story"
ON public.social_story_reactions
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

CREATE POLICY "Users can update own story reaction"
ON public.social_story_reactions
FOR UPDATE
USING (user_id = public.get_user_id(auth.uid())::uuid)
WITH CHECK (user_id = public.get_user_id(auth.uid())::uuid);

CREATE POLICY "Users can delete own story reaction"
ON public.social_story_reactions
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Approved users can view story comments"
ON public.social_story_comments
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

CREATE POLICY "Approved users can comment on story"
ON public.social_story_comments
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

CREATE POLICY "Users can edit own story comment"
ON public.social_story_comments
FOR UPDATE
USING (user_id = public.get_user_id(auth.uid())::uuid)
WITH CHECK (user_id = public.get_user_id(auth.uid())::uuid);

CREATE POLICY "Users can delete own story comment"
ON public.social_story_comments
FOR DELETE
USING (
  user_id = public.get_user_id(auth.uid())::uuid
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);
