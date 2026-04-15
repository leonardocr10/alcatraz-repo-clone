-- Clan identity (name/logo) editable by admin or clan leader of that tag.

CREATE TABLE IF NOT EXISTS public.clan_identity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan text NOT NULL UNIQUE,
  display_name text NOT NULL,
  logo_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clan_identity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clan identity"
ON public.clan_identity
FOR SELECT
USING (true);

CREATE POLICY "Leaders/admin can insert clan identity"
ON public.clan_identity
FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders/admin can update clan identity"
ON public.clan_identity
FOR UPDATE
TO authenticated
USING (public.can_manage_clan_config(clan))
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders/admin can delete clan identity"
ON public.clan_identity
FOR DELETE
TO authenticated
USING (public.can_manage_clan_config(clan));

INSERT INTO public.clan_identity (clan, display_name)
SELECT c.name, c.name
FROM public.clans c
ON CONFLICT (clan) DO NOTHING;
