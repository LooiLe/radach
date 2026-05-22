ALTER TABLE feed_posts ADD COLUMN spot_id BIGINT;
ALTER TABLE feed_posts ADD COLUMN event_id BIGINT;
ALTER TABLE feed_posts ADD CONSTRAINT fk_feed_post_spot FOREIGN KEY (spot_id) REFERENCES spots (id) ON DELETE SET NULL;
ALTER TABLE feed_posts ADD CONSTRAINT fk_feed_post_event FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE SET NULL;