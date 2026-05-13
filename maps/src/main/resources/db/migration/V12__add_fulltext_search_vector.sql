-- Full-text search: add a generated tsvector column and GIN index for fast ranked search.
-- Replaces the LIKE '%q%' queries that can't use indexes.

ALTER TABLE spots ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(type, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(address, '')), 'C') ||
        setweight(to_tsvector('english', coalesce(tags, '')), 'D')
    ) STORED;

CREATE INDEX idx_spots_search_vector ON spots USING GIN (search_vector);
