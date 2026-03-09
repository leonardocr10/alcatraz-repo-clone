
-- Create category for anel_2
INSERT INTO equipment_categories (name, slot, sort_order) VALUES ('Anéis', 'anel_2', 1);

-- Clone items from anel_1 to anel_2 using the new category
INSERT INTO equipment_items (name, image_url, slot, category_id, level, level_sort)
SELECT ei.name, ei.image_url, 'anel_2', ec2.id, ei.level, ei.level_sort
FROM equipment_items ei
JOIN equipment_categories ec2 ON ec2.slot = 'anel_2' AND ec2.name = 'Anéis'
WHERE ei.slot = 'anel_1';
