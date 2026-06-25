-- Drop old single-ID columns and add new list columns as text (JSON array)
ALTER TABLE feed_posts DROP COLUMN IF EXISTS spot_id;
ALTER TABLE feed_posts DROP COLUMN IF EXISTS event_id;
ALTER TABLE feed_posts DROP COLUMN IF EXISTS journey_id;

ALTER TABLE feed_posts ADD COLUMN spot_ids text DEFAULT '[]';
ALTER TABLE feed_posts ADD COLUMN event_ids text DEFAULT '[]';
ALTER TABLE feed_posts ADD COLUMN journey_ids text DEFAULT '[]';