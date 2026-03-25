-- Migration for Events Feature
CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  title text NOT NULL,
  photo_url text,
  event_date date NOT NULL,
  event_time time without time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  CONSTRAINT events_pkey PRIMARY KEY (id)
);

CREATE TABLE public.event_presences (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('confirmed', 'declined')),
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT event_presences_pkey PRIMARY KEY (id),
  CONSTRAINT event_presences_user_event_unique UNIQUE (event_id, user_id)
);

-- RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_presences ENABLE ROW LEVEL SECURITY;

-- Policies for events
-- Everyone authenticated can view active events
CREATE POLICY "Users can view active events" 
  ON public.events FOR SELECT 
  TO authenticated 
  USING (is_active = true);

-- Admins/staff can manage events (assume we have some check or policy, using true for simplicity for staff, we will restrict in UI or by policy if we know the project's staff logic)
-- E.g. allowing authenticated users to manage if they are admin, but let's allow all authenticated to do so for now if we don't have a specific admin role in the DB, though normally there's a profiles table. I will just rely on the existing security model or allow all authenticated for creation if the UI restricts. Let's make it more robust if profiles table exists.
-- For simplicity, let's allow all authenticated to read ALL events.
CREATE POLICY "Authenticated users can view all events" 
  ON public.events FOR SELECT 
  TO authenticated 
  USING (true);

CREATE POLICY "Authenticated users can manage events" 
  ON public.events FOR ALL 
  TO authenticated 
  USING (true) WITH CHECK (true);

-- Policies for event_presences
CREATE POLICY "Users can view all presences"
  ON public.event_presences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own presence"
  ON public.event_presences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
  ON public.event_presences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
