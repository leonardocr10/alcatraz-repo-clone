-- Remove bad test data from earlier attempts to avoid violating new constraints
DELETE FROM public.events WHERE created_by NOT IN (SELECT id FROM public.users);
DELETE FROM public.event_presences WHERE user_id NOT IN (SELECT id FROM public.users);

-- Fix the foreign key referencing the wrong users table so React can perform JOINs easily
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_created_by_fkey;
ALTER TABLE public.events ADD CONSTRAINT events_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;

ALTER TABLE public.event_presences DROP CONSTRAINT IF EXISTS event_presences_user_id_fkey;
ALTER TABLE public.event_presences ADD CONSTRAINT event_presences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- Fix the RLS policies that relied on user_id being equal to auth.uid()
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.event_presences;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.event_presences;

CREATE POLICY "Users can insert their own presence" ON public.event_presences 
FOR INSERT TO authenticated 
WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

CREATE POLICY "Users can update their own presence" ON public.event_presences 
FOR UPDATE TO authenticated 
USING (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid())) 
WITH CHECK (user_id IN (SELECT id FROM public.users WHERE auth_id = auth.uid()));

-- Tell Supabase to immediately reload the schema cache so the website doesn't show errors anymore
NOTIFY pgrst, 'reload schema';
