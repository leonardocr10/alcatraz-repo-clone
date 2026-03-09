
-- Add unique constraint on category name for upsert
ALTER TABLE public.equipment_categories ADD CONSTRAINT equipment_categories_name_key UNIQUE (name);
