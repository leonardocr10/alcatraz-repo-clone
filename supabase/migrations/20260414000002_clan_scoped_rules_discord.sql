-- Clan-scoped rules and discord settings with leader permissions.

ALTER TABLE public.clan_rules
ADD COLUMN IF NOT EXISTS clan text;

UPDATE public.clan_rules
SET clan = 'AZ'
WHERE clan IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS clan_rules_clan_unique_idx
ON public.clan_rules (clan);

CREATE TABLE IF NOT EXISTS public.clan_discord_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan text NOT NULL UNIQUE,
  discord_link text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clan_discord_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_manage_clan_config(_clan text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users me
    WHERE me.auth_id = auth.uid()
      AND (
        me.role = 'admin'::public.app_role
        OR (me.clan_role = 'lider' AND me.clan = _clan)
      )
  );
$$;

DROP POLICY IF EXISTS "Admins can update rules" ON public.clan_rules;
DROP POLICY IF EXISTS "Admins can insert rules" ON public.clan_rules;

CREATE POLICY "Leaders/admin can insert clan rules"
ON public.clan_rules
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders/admin can update clan rules"
ON public.clan_rules
FOR UPDATE
TO authenticated
USING (public.can_manage_clan_config(clan))
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Anyone can view clan discord links"
ON public.clan_discord_links
FOR SELECT
USING (true);

CREATE POLICY "Leaders/admin can insert clan discord links"
ON public.clan_discord_links
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders/admin can update clan discord links"
ON public.clan_discord_links
FOR UPDATE
TO authenticated
USING (public.can_manage_clan_config(clan))
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders/admin can delete clan discord links"
ON public.clan_discord_links
FOR DELETE
TO authenticated
USING (public.can_manage_clan_config(clan));
