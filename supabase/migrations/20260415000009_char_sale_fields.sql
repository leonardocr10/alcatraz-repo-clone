-- Character sale fields on user profile
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS char_for_sale boolean NOT NULL DEFAULT false;

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS char_sale_price text;
