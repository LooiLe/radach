-- Rename "Accommodations" to "Stay"
UPDATE spot_categories SET name = 'Stay' WHERE name = 'Accommodations';