-- Add per-clan primary color for internal panel theme.

ALTER TABLE public.clan_identity
ADD COLUMN IF NOT EXISTS primary_color text;

UPDATE public.clan_identity
SET primary_color = '190 85% 48%'
WHERE primary_color IS NULL OR btrim(primary_color) = '';
