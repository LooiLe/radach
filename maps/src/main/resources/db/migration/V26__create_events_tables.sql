-- ============================================================
-- V26: Events, Event Likes, and Calendar Entries
-- ============================================================

CREATE TABLE events (
    id              BIGSERIAL       PRIMARY KEY,
    spot_id         BIGINT          NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    title           VARCHAR(255)    NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ     NOT NULL,
    end_time        TIMESTAMPTZ,
    recurrence_rule VARCHAR(500),
    image_url       VARCHAR(500),
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    submitted_by    BIGINT          REFERENCES users(id) ON DELETE SET NULL,
    like_count      INT             NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_spot_id ON events(spot_id);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_status_start ON events(status, start_time);

-- ----

CREATE TABLE event_likes (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    BIGINT      NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, event_id)
);

CREATE INDEX idx_event_likes_event ON event_likes(event_id);

-- ----

CREATE TABLE calendar_entries (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         BIGINT          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id        BIGINT          REFERENCES events(id) ON DELETE SET NULL,
    title           VARCHAR(255)    NOT NULL,
    description     TEXT,
    start_time      TIMESTAMPTZ     NOT NULL,
    end_time        TIMESTAMPTZ,
    recurrence_rule VARCHAR(500),
    color           VARCHAR(20)     DEFAULT '#4f8cff',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_entries_user ON calendar_entries(user_id);
CREATE INDEX idx_calendar_entries_user_time ON calendar_entries(user_id, start_time);
