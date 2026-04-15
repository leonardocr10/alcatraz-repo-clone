-- Allow clan leaders to manage clan roles (except leader role itself).
-- Only global admin can assign/remove the 'lider' clan role.

CREATE OR REPLACE FUNCTION public.enforce_users_update_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor public.users%ROWTYPE;
BEGIN
  SELECT * INTO actor
  FROM public.users
  WHERE auth_id = auth.uid();

  -- If actor is not resolved (service role or internal action), skip guard.
  IF actor.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Global admin can do everything.
  IF actor.role = 'admin'::public.app_role THEN
    RETURN NEW;
  END IF;

  -- Non-admin cannot escalate or change own clan identity/cargo.
  IF NEW.id = actor.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.clan IS DISTINCT FROM OLD.clan
       OR NEW.clan_role IS DISTINCT FROM OLD.clan_role THEN
      RAISE EXCEPTION 'Sem permissao para alterar role/aprovacao/clan/cargo do proprio usuario';
    END IF;
    RETURN NEW;
  END IF;

  -- Clan leader can manage users from same clan (non-admin), but cannot touch leader role.
  IF actor.clan_role = 'lider'
     AND actor.clan IS NOT NULL
     AND OLD.clan = actor.clan
     AND OLD.role <> 'admin'::public.app_role THEN
    -- Cannot change app role or clan ownership.
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.clan IS DISTINCT FROM OLD.clan THEN
      RAISE EXCEPTION 'Lider nao pode alterar role/clan';
    END IF;

    -- Only global admin can assign/remove leader clan role.
    IF OLD.clan_role = 'lider' OR NEW.clan_role = 'lider' THEN
      RAISE EXCEPTION 'Apenas o admin geral pode alterar o cargo de lider';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sem permissao para atualizar este usuario';
END;
$$;
