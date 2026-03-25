CREATE TABLE IF NOT EXISTS public.alcatraz_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    rank_position INTEGER NOT NULL,
    game_class TEXT NOT NULL,
    level INTEGER NOT NULL,
    xp TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.alcatraz_members ENABLE ROW LEVEL SECURITY;

-- Allow public read access to everyone
CREATE POLICY "Allow public read access on alcatraz_members" ON public.alcatraz_members FOR SELECT USING (true);

-- Allow authenticated users to insert/update (simplest policy for this sync feature)
CREATE POLICY "Allow authenticated full access on alcatraz_members" ON public.alcatraz_members FOR ALL USING (auth.role() = 'authenticated');
