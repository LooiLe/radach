ALTER TABLE itineraries ADD COLUMN share_token VARCHAR(36) UNIQUE;

-- Populate existing rows
UPDATE itineraries SET share_token = CAST(gen_random_uuid() AS VARCHAR(36)) WHERE share_token IS NULL;
