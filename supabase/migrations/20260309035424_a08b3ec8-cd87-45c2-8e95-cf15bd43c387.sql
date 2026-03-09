
-- Create clans table
CREATE TABLE public.clans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clans ENABLE ROW LEVEL SECURITY;

-- Anyone can view clans
CREATE POLICY "Anyone can view clans"
  ON public.clans FOR SELECT
  USING (true);

-- Admins can insert clans
CREATE POLICY "Admins can insert clans"
  ON public.clans FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update clans
CREATE POLICY "Admins can update clans"
  ON public.clans FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete clans
CREATE POLICY "Admins can delete clans"
  ON public.clans FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Seed with existing clans
INSERT INTO public.clans (name) VALUES ('AZ'), ('AZ2');
