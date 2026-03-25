-- Security fixes for users table

-- 1. Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- 2. Enforce NOT NULL on auth_id so every user MUST be linked to an auth account
-- Note: if there are still users with null auth_id this would fail, but we deleted them.
ALTER TABLE public.users ALTER COLUMN auth_id SET NOT NULL;

-- 3. Policy for Insert: Users can only insert their own row
CREATE POLICY "Users can insert their own row"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = auth_id);

-- 4. Policy for Select: Authenticated users can view all users (needed for Players menu)
CREATE POLICY "Users can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (true);

-- 5. Policy for Update: Users can update their own row
CREATE POLICY "Users can update their own row"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);
