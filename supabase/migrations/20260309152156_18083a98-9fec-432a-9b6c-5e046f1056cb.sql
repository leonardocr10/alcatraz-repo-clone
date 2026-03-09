ALTER TABLE equipment_categories DROP CONSTRAINT IF EXISTS equipment_categories_name_key;

INSERT INTO equipment_categories (name, slot, sort_order) VALUES
  ('Foices', 'arma_2m', 3),
  ('Espadas', 'arma_2m', 4),
  ('Machados', 'arma_2m', 5),
  ('Martelos', 'arma_2m', 6);