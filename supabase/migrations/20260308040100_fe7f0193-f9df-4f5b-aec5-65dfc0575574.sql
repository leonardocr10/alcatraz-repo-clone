
CREATE TABLE public.player_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  nickname text NOT NULL,
  game_class text,
  clan text,
  level integer,
  xp text,
  rank_position integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.player_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rankings" ON public.player_rankings FOR SELECT USING (true);
CREATE POLICY "Service can manage rankings" ON public.player_rankings FOR ALL USING (true) WITH CHECK (true);
