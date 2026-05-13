-- Tags: promote from JSON text blob to first-class entities with a join table.

-- Dictionary of unique tags
CREATE TABLE tags (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

CREATE INDEX idx_tags_name ON tags (name);

-- Join table linking spots to tags
CREATE TABLE spot_tags (
    spot_id BIGINT NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    tag_id  BIGINT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (spot_id, tag_id)
);

CREATE INDEX idx_spot_tags_tag_id ON spot_tags (tag_id);

-- Migrate existing JSON tags into the new tables.
-- This extracts each JSON array element, inserts unique tags, then creates spot_tags rows.
INSERT INTO tags (name)
SELECT DISTINCT trim(both '"' from tag::text)
FROM spots, jsonb_array_elements(tags::jsonb) AS tag
WHERE tags IS NOT NULL AND tags != '[]' AND tags != ''
ON CONFLICT (name) DO NOTHING;

INSERT INTO spot_tags (spot_id, tag_id)
SELECT s.id, t.id
FROM spots s, jsonb_array_elements(s.tags::jsonb) AS raw_tag
JOIN tags t ON t.name = trim(both '"' from raw_tag::text)
WHERE s.tags IS NOT NULL AND s.tags != '[]' AND s.tags != ''
ON CONFLICT DO NOTHING;
