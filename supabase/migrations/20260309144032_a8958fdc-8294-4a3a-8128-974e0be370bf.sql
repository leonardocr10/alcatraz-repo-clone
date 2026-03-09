
-- Equipment slot types
CREATE TYPE public.equipment_slot AS ENUM (
  'arma_1m', 'arma_2m', 'escudo', 'armadura', 'bota', 'luva', 'bracelete', 'anel_1', 'colar', 'anel_2'
);

-- Equipment rarity
CREATE TYPE public.equipment_rarity AS ENUM (
  'normal', 'raro', 'epico', 'lendario', 'boss'
);

-- Equipment categories (e.g., Espadas, Machados, Escudos)
CREATE TABLE public.equipment_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slot equipment_slot NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories" ON public.equipment_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON public.equipment_categories FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Equipment items catalog
CREATE TABLE public.equipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text NOT NULL,
  category_id uuid REFERENCES public.equipment_categories(id) ON DELETE CASCADE NOT NULL,
  slot equipment_slot NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view items" ON public.equipment_items FOR SELECT USING (true);
CREATE POLICY "Admins can manage items" ON public.equipment_items FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Player equipment (what each player has equipped)
CREATE TABLE public.player_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  slot equipment_slot NOT NULL,
  item_id uuid REFERENCES public.equipment_items(id) ON DELETE CASCADE NOT NULL,
  rarity equipment_rarity NOT NULL DEFAULT 'normal',
  plus_value integer DEFAULT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, slot)
);

ALTER TABLE public.player_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view equipment" ON public.player_equipment FOR SELECT USING (true);
CREATE POLICY "Users can manage own equipment" ON public.player_equipment FOR INSERT TO authenticated WITH CHECK (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users can update own equipment" ON public.player_equipment FOR UPDATE TO authenticated USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Users can delete own equipment" ON public.player_equipment FOR DELETE TO authenticated USING (user_id = get_user_id(auth.uid()));
CREATE POLICY "Admins can manage all equipment" ON public.player_equipment FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for equipment item images
INSERT INTO storage.buckets (id, name, public) VALUES ('equipment-images', 'equipment-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for equipment images" ON storage.objects FOR SELECT USING (bucket_id = 'equipment-images');
CREATE POLICY "Admins can upload equipment images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'equipment-images' AND has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete equipment images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'equipment-images' AND has_role(auth.uid(), 'admin'::app_role));
