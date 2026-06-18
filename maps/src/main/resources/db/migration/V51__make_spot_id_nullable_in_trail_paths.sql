-- Make spot_id nullable in trail_paths table to allow journeys without a spot
ALTER TABLE trail_paths ALTER COLUMN spot_id DROP NOT NULL;