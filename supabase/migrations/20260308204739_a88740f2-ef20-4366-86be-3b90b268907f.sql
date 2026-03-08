UPDATE public.users SET clan_role = 'lider' WHERE LOWER(nickname) = 'zeus';
UPDATE public.users SET clan_role = 'vice-lider' WHERE LOWER(nickname) = 'mangaverde';
UPDATE public.users SET clan_role = 'conselho' WHERE LOWER(nickname) IN ('fsprime', 'nutella', 'brasileiro');
UPDATE public.users SET clan_role = 'recrutador' WHERE LOWER(nickname) = 'danadinha';
UPDATE public.users SET clan_role = 'veterano' WHERE LOWER(nickname) IN ('encrenca', 'liang');