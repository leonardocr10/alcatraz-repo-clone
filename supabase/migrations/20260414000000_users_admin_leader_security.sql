-- Enforce a fixed general admin phone and tighten users update permissions.

-- Normalize existing phone values and promote the fixed phone as global admin.
UPDATE public.users
SET phone = NULLIF(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '');

UPDATE public.users
SET role = 'admin'::public.app_role,
    approved = true
WHERE phone = '34984043367';

-- Auto-normalize phone and auto-promote the fixed general admin phone.
CREATE OR REPLACE FUNCTION public.ensure_general_admin_phone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.phone := NULLIF(regexp_replace(COALESCE(NEW.phone, ''), '\D', '', 'g'), '');

  IF NEW.phone = '34984043367' THEN
    NEW.role := 'admin'::public.app_role;
    NEW.approved := true;
  END IF;

  IF NEW.clan_role IS NULL OR btrim(NEW.clan_role) = '' THEN
    NEW.clan_role := 'membro';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ensure_general_admin_phone ON public.users;
CREATE TRIGGER trg_ensure_general_admin_phone
BEFORE INSERT OR UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.ensure_general_admin_phone();

-- Helper to check if current user can manage a target user.
-- Admin can manage anyone.
-- Clan leader can manage only non-admin users from the same clan.
CREATE OR REPLACE FUNCTION public.can_manage_target_user(_target_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users me
    JOIN public.users target ON target.id = _target_user_id
    WHERE me.auth_id = auth.uid()
      AND (
        me.role = 'admin'::public.app_role
        OR (
          me.clan_role = 'lider'
          AND me.clan IS NOT NULL
          AND target.clan = me.clan
          AND target.role <> 'admin'::public.app_role
        )
      )
  );
$$;

-- Guardrail: leaders cannot promote/demote roles or change clan ownership.
-- Non-admin users cannot change role/approval/clan/clan_role on themselves.
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

  IF actor.role = 'admin'::public.app_role THEN
    RETURN NEW;
  END IF;

  -- Own row: allow profile/basic updates only.
  IF NEW.id = actor.id THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.approved IS DISTINCT FROM OLD.approved
       OR NEW.clan_role IS DISTINCT FROM OLD.clan_role
       OR NEW.clan IS DISTINCT FROM OLD.clan THEN
      RAISE EXCEPTION 'Sem permissao para alterar role/aprovacao/clan do proprio usuario';
    END IF;
    RETURN NEW;
  END IF;

  -- Clan leader can only operate within same clan and never on admin rows.
  IF actor.clan_role = 'lider'
     AND actor.clan IS NOT NULL
     AND OLD.clan = actor.clan
     AND OLD.role <> 'admin'::public.app_role THEN
    IF NEW.role IS DISTINCT FROM OLD.role
       OR NEW.clan_role IS DISTINCT FROM OLD.clan_role
       OR NEW.clan IS DISTINCT FROM OLD.clan THEN
      RAISE EXCEPTION 'Lider nao pode alterar role/cargo/clan';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sem permissao para atualizar este usuario';
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_users_update_guard ON public.users;
CREATE TRIGGER trg_enforce_users_update_guard
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.enforce_users_update_guard();

-- Replace users UPDATE policies with explicit scopes.
DROP POLICY IF EXISTS "Users can update their own row" ON public.users;
DROP POLICY IF EXISTS "Admins can update any user" ON public.users;

CREATE POLICY "Users can update own row (safe by trigger)"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = auth_id)
WITH CHECK (auth.uid() = auth_id);

CREATE POLICY "Leaders and admins can manage target users"
ON public.users
FOR UPDATE
TO authenticated
USING (public.can_manage_target_user(id))
WITH CHECK (public.can_manage_target_user(id));
