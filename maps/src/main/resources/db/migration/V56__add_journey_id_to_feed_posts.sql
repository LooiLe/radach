-- ============================================================
-- V56: Add journey_id column to feed_posts for attaching journeys to posts
-- ============================================================
ALTER TABLE feed_posts ADD COLUMN IF NOT EXISTS journey_id BIGINT;