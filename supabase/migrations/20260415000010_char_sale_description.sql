-- Optional description for char sale listing
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS char_sale_description text;
