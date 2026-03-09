-- Restrict overly-permissive player_rankings write policies to service_role
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='player_rankings'
      AND policyname='Service can insert rankings'
  ) THEN
    EXECUTE 'ALTER POLICY "Service can insert rankings" ON public.player_rankings TO service_role WITH CHECK (true)';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname='public'
      AND tablename='player_rankings'
      AND policyname='Service can update rankings'
  ) THEN
    EXECUTE 'ALTER POLICY "Service can update rankings" ON public.player_rankings TO service_role USING (true)';
  END IF;
END $$;