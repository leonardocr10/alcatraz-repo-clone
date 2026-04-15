-- Allow only one leader and one vice-leader per clan.

CREATE OR REPLACE FUNCTION public.enforce_unique_clan_leadership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflict_exists boolean;
BEGIN
  IF NEW.clan IS NULL OR NEW.clan_role IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.clan_role NOT IN ('lider', 'vice-lider') THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.clan = NEW.clan
      AND u.clan_role = NEW.clan_role
      AND u.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  INTO conflict_exists;

  IF conflict_exists THEN
    IF NEW.clan_role = 'lider' THEN
      RAISE EXCEPTION 'Este clã já possui um líder.';
    ELSE
      RAISE EXCEPTION 'Este clã já possui um vice-líder.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_unique_clan_leadership ON public.users;
CREATE TRIGGER trg_enforce_unique_clan_leadership
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_unique_clan_leadership();
