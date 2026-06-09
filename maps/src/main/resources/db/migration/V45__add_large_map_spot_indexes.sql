-- Indexes for production map viewport loading on large spot datasets.
-- Partial indexes stay smaller by only covering spots that can appear publicly.

CREATE INDEX IF NOT EXISTS idx_spots_active_lat_lng
    ON spots (latitude, longitude)
    WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_spots_active_rank_id
    ON spots (rank_score DESC, id DESC)
    WHERE status = 'ACTIVE';
