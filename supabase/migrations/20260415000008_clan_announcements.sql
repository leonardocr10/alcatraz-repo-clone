-- Clan announcements with read acknowledgment tracking.

CREATE TABLE IF NOT EXISTS public.clan_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clan text NOT NULL REFERENCES public.clans(name) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  require_ack boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.clan_announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.clan_announcements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_clan_announcements_clan_created_at
ON public.clan_announcements (clan, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clan_announcement_reads_announcement
ON public.clan_announcement_reads (announcement_id, read_at DESC);

ALTER TABLE public.clan_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clan_announcement_reads ENABLE ROW LEVEL SECURITY;

-- Announcements visibility: admin sees all; users/leaders see their own clan announcements.
CREATE POLICY "Users can view clan announcements"
ON public.clan_announcements
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR clan IN (SELECT u.clan FROM public.users u WHERE u.auth_id = auth.uid())
);

-- Create/update/delete announcements: admin or leader of the same clan.
CREATE POLICY "Leaders and admins can insert clan announcements"
ON public.clan_announcements
FOR INSERT
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders and admins can update clan announcements"
ON public.clan_announcements
FOR UPDATE
USING (public.can_manage_clan_config(clan))
WITH CHECK (public.can_manage_clan_config(clan));

CREATE POLICY "Leaders and admins can delete clan announcements"
ON public.clan_announcements
FOR DELETE
USING (public.can_manage_clan_config(clan));

-- Reads visibility: admin sees all; leader can see reads from own clan announcements; users see own reads.
CREATE POLICY "Users can view announcement reads"
ON public.clan_announcement_reads
FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin')
  OR user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
  OR announcement_id IN (
    SELECT a.id
    FROM public.clan_announcements a
    JOIN public.users me ON me.auth_id = auth.uid()
    WHERE me.clan_role = 'lider' AND me.clan = a.clan
  )
);

-- Read acknowledgement can be inserted only for own profile.
CREATE POLICY "Users can acknowledge own announcement reads"
ON public.clan_announcement_reads
FOR INSERT
WITH CHECK (
  user_id IN (SELECT u.id FROM public.users u WHERE u.auth_id = auth.uid())
);
