-- Ensure Info menu is available in app_config default visibility list.

UPDATE public.app_config
SET visible_menus = CASE
  WHEN visible_menus IS NULL THEN
    '["/inicio","/info","/char","/historico","/eventos","/roleta","/jogadores"]'::jsonb
  WHEN NOT (visible_menus::jsonb ? '/info') THEN
    (visible_menus::jsonb || '["/info"]'::jsonb)
  ELSE
    visible_menus::jsonb
END,
updated_at = now()
WHERE id = 'main';
