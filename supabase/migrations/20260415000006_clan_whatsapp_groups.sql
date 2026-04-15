-- Per-clan WhatsApp group destination for clan communications.

CREATE TABLE IF NOT EXISTS public.clan_whatsapp_groups (
  clan text PRIMARY KEY REFERENCES public.clans(name) ON DELETE CASCADE,
  group_number text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clan_whatsapp_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view clan WhatsApp groups"
ON public.clan_whatsapp_groups
FOR SELECT
USING (true);

CREATE POLICY "Admins can insert clan WhatsApp groups"
ON public.clan_whatsapp_groups
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update clan WhatsApp groups"
ON public.clan_whatsapp_groups
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete clan WhatsApp groups"
ON public.clan_whatsapp_groups
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Initialize all existing clans with the provided default group.
INSERT INTO public.clan_whatsapp_groups (clan, group_number, updated_at)
SELECT c.name, '120363426587639763@g.us', now()
FROM public.clans c
ON CONFLICT (clan) DO NOTHING;
