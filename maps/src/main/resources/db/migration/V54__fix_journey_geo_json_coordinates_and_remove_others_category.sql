-- ============================================================
-- V54: Fix geo_json coordinates for journeys + remove "Others" category
-- ============================================================

-- Update geo_json for journeys that have latitude/longitude but empty coordinates array.
-- Build proper GeoJSON: {"type":"LineString","coordinates":[[lng, lat]]}
UPDATE journeys
SET geo_json = json_build_object(
    'type', 'LineString',
    'coordinates', json_build_array(
        json_build_array(longitude, latitude)
    )
)::text
WHERE latitude IS NOT NULL AND longitude IS NOT NULL
  AND (geo_json IS NULL OR geo_json = '{"type":"LineString","coordinates":[]}' OR geo_json = '');

-- Reassign journeys with "Others" category to "Walks & Trails"
UPDATE journeys
SET journey_category_id = (SELECT id FROM journey_categories WHERE name = 'Walks & Trails' LIMIT 1)
WHERE journey_category_id = (SELECT id FROM journey_categories WHERE name = 'Others' LIMIT 1);

-- Delete the "Others" journey category
DELETE FROM journey_categories WHERE name = 'Others';

-- Drop the latitude/longitude columns (no longer needed, data is in geo_json)
ALTER TABLE journeys DROP COLUMN IF EXISTS latitude;
ALTER TABLE journeys DROP COLUMN IF EXISTS longitude;