-- Friend activity feed: add user_id to spot_events so we can track who performed each event.
-- Also add more event types for the feed.

ALTER TABLE spot_events ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX idx_spot_events_user_id ON spot_events (user_id);
CREATE INDEX idx_spot_events_created_at ON spot_events (created_at DESC);
