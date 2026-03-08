
DROP POLICY IF EXISTS "Service can manage rankings" ON public.player_rankings;
CREATE POLICY "Service can insert rankings" ON public.player_rankings FOR INSERT WITH CHECK (true);
CREATE POLICY "Service can update rankings" ON public.player_rankings FOR UPDATE USING (true);
