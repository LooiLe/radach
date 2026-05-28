-- ============================================================
-- V34: Trail Path Upvotes
-- ============================================================

CREATE TABLE trail_path_upvotes (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    path_id     BIGINT      NOT NULL REFERENCES trail_paths(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, path_id)
);

CREATE INDEX idx_trail_path_upvotes_path ON trail_path_upvotes(path_id);
