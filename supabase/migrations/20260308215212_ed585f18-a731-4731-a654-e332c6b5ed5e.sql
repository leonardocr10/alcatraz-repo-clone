
CREATE TABLE public.history_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.history_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view history cache"
  ON public.history_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- Insert a single initial row
INSERT INTO public.history_cache (data) VALUES ('{}');
