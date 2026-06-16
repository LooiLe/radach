-- Rename trail_path_upvotes table
ALTER TABLE trail_path_upvotes RENAME TO journey_upvotes;
ALTER TABLE journey_upvotes RENAME COLUMN path_id TO journey_id;

-- Add "Others" category to journey_categories
INSERT INTO journey_categories (name, icon_url) 
SELECT 'Others', '/icons/stash--ellipsis-v-light.svg'
WHERE NOT EXISTS (SELECT 1 FROM journey_categories WHERE name = 'Others');

-- Rename trail_paths to journeys
ALTER TABLE trail_paths RENAME TO journeys;

-- Add journey_category_id column
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS journey_category_id BIGINT;
ALTER TABLE journeys ADD CONSTRAINT fk_journey_category FOREIGN KEY (journey_category_id) REFERENCES journey_categories(id);

-- Set default category for existing journeys to "Walks & Trails"
UPDATE journeys 
SET journey_category_id = (SELECT id FROM journey_categories WHERE name = 'Walks & Trails')
WHERE journey_category_id IS NULL;

-- Make journey_category_id NOT NULL
ALTER TABLE journeys ALTER COLUMN journey_category_id SET NOT NULL;

-- Import trail spots from V47 as journeys under "Walks & Trails" category
DO $$
DECLARE
    walks_trails_id BIGINT;
BEGIN
    SELECT id INTO walks_trails_id FROM journey_categories WHERE name = 'Walks & Trails';

    INSERT INTO journeys (spot_id, submitted_by, name, description, difficulty, estimated_duration_min, distance_meters, geo_json, photos, status, is_private, upvote_count, created_at, journey_category_id)
    SELECT 
        NULL,
        NULL,
        s.name,
        s.address,
        'MODERATE',
        NULL,
        NULL,
        '{"type":"LineString","coordinates":[]}',
        s.photos,
        'ACTIVE',
        false,
        0,
        s.created_at,
        walks_trails_id
    FROM spots s
    WHERE s.type = 'Trail'
    AND NOT EXISTS (SELECT 1 FROM journeys j WHERE j.name = s.name);
END $$;

-- Delete trail spots from spots table (type = 'Trail')
DELETE FROM spots WHERE type = 'Trail';