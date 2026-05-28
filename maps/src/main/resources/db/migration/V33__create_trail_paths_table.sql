-- ============================================================
-- V33: Trail Paths — Community-submitted paths for trail spots
-- ============================================================

CREATE TABLE trail_paths (
    id                      BIGSERIAL       PRIMARY KEY,
    spot_id                 BIGINT          NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    submitted_by            BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    name                    VARCHAR(255)    NOT NULL,
    description             TEXT,
    difficulty              VARCHAR(20)     NOT NULL DEFAULT 'MODERATE',
    estimated_duration_min  INT,
    distance_meters         DOUBLE PRECISION,
    geo_json                TEXT            NOT NULL,
    photos                  TEXT,
    status                  VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    is_private              BOOLEAN         NOT NULL DEFAULT FALSE,
    upvote_count            INT             NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_trail_paths_spot_id ON trail_paths(spot_id);
CREATE INDEX idx_trail_paths_status ON trail_paths(status);
CREATE INDEX idx_trail_paths_submitted_by ON trail_paths(submitted_by);
CREATE INDEX idx_trail_paths_spot_status ON trail_paths(spot_id, status);
