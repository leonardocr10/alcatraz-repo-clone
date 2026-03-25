-- 1. Create the Storage Bucket for event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('event_images', 'event_images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for event images
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id = 'event_images');
CREATE POLICY "Authenticated users can upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'event_images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can update" ON storage.objects FOR UPDATE USING (bucket_id = 'event_images' AND auth.role() = 'authenticated');
CREATE POLICY "Authenticated users can delete" ON storage.objects FOR DELETE USING (bucket_id = 'event_images' AND auth.role() = 'authenticated');

-- 3. Ensure 'events' and 'event_presences' tables exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.events (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  photo_url text,
  event_date date NOT NULL,
  event_time time without time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT events_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.event_presences (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('confirmed', 'declined')),
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_presences_pkey PRIMARY KEY (id),
  CONSTRAINT event_presences_user_event_unique UNIQUE (event_id, user_id)
);

-- Policies for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_presences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view all events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can manage events" ON public.events;

CREATE POLICY "Authenticated users can view all events" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage events" ON public.events FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view all presences" ON public.event_presences;
DROP POLICY IF EXISTS "Users can insert their own presence" ON public.event_presences;
DROP POLICY IF EXISTS "Users can update their own presence" ON public.event_presences;

CREATE POLICY "Users can view all presences" ON public.event_presences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert their own presence" ON public.event_presences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own presence" ON public.event_presences FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Ensure Alcatraz Members table exists
CREATE TABLE IF NOT EXISTS public.alcatraz_members (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    rank_position INTEGER NOT NULL,
    game_class TEXT NOT NULL,
    level INTEGER NOT NULL,
    xp TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.alcatraz_members ENABLE ROW LEVEL SECURITY;

-- 5. Fix Alcatraz Members RLS issue
DROP POLICY IF EXISTS "Allow authenticated full access on alcatraz_members" ON public.alcatraz_members;
DROP POLICY IF EXISTS "Allow public read access on alcatraz_members" ON public.alcatraz_members;

CREATE POLICY "Allow public read access on alcatraz_members" 
ON public.alcatraz_members FOR SELECT USING (true);

CREATE POLICY "Allow authenticated full access on alcatraz_members" 
ON public.alcatraz_members FOR ALL 
USING (auth.role() = 'authenticated') 
WITH CHECK (auth.role() = 'authenticated');
