ALTER TABLE events RENAME COLUMN image_url TO image_urls;

-- Convert existing string URLs to a JSON array format so the StringListConverter can parse it.
UPDATE events
SET image_urls = '["' || image_urls || '"]'
WHERE image_urls IS NOT NULL 
  AND image_urls <> '' 
  AND image_urls NOT LIKE '[%';

ALTER TABLE events ALTER COLUMN image_urls TYPE TEXT;
