-- Vibe tags: auto-generated from review NLP analysis, separate from user-assigned tags

-- Predefined vibe dictionary (can be extended via admin API later)
CREATE TABLE vibe_tag_definitions (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    emoji       VARCHAR(10)  DEFAULT '',
    description VARCHAR(500) DEFAULT '',
    category    VARCHAR(50)  DEFAULT ''  -- e.g. 'atmosphere', 'practical', 'social', 'time_of_day'
);

-- Join table: which vibe tags apply to which spot, with confidence score
CREATE TABLE spot_vibe_tags (
    id              BIGSERIAL PRIMARY KEY,
    spot_id         BIGINT       NOT NULL REFERENCES spots(id) ON DELETE CASCADE,
    vibe_tag_id     BIGINT       NOT NULL REFERENCES vibe_tag_definitions(id) ON DELETE CASCADE,
    confidence      REAL         NOT NULL DEFAULT 0.0 CHECK (confidence >= 0 AND confidence <= 1),
    source          VARCHAR(20)  NOT NULL DEFAULT 'keyword',  -- 'keyword', 'embedding', 'ai_api', 'manual'
    last_updated    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (spot_id, vibe_tag_id)
);

CREATE INDEX idx_spot_vibe_tags_spot ON spot_vibe_tags (spot_id);
CREATE INDEX idx_spot_vibe_tags_tag  ON spot_vibe_tags (vibe_tag_id);

-- Seed the initial vibe dictionary (categories: atmosphere, practical, social, time_of_day, budget, audience)
INSERT INTO vibe_tag_definitions (name, emoji, description, category) VALUES
    ('cozy',              '', 'Warm, intimate, comfortable atmosphere', 'atmosphere'),
    ('romantic',          '', 'Great for dates and couples', 'atmosphere'),
    ('lively',            '', 'Energetic, busy, vibrant atmosphere', 'atmosphere'),
    ('chill',             '', 'Relaxed, laid-back vibe', 'atmosphere'),
    ('aesthetic',         '', 'Beautiful decor, Instagram-worthy', 'atmosphere'),
    ('sunset views',      '', 'Great sunset or scenic views', 'atmosphere'),
    ('outdoor seating',   '', 'Has outdoor or terrace seating', 'practical'),
    ('good for studying', '', 'Quiet, has WiFi, good workspace', 'practical'),
    ('good for groups',   '', 'Large tables, group-friendly', 'practical'),
    ('late night spot',   '', 'Open late, night owl friendly', 'time_of_day'),
    ('breakfast spot',    '', 'Great for breakfast or brunch', 'time_of_day'),
    ('budget friendly',   '', 'Affordable prices, good value', 'budget'),
    ('pricey',            '', 'Upscale, premium pricing', 'budget'),
    ('digital nomad friendly', '', 'Good WiFi, power outlets, work-friendly', 'audience'),
    ('touristy',          '', 'Popular with tourists', 'audience'),
    ('local favorite',    '', 'Loved by locals, authentic', 'audience'),
    ('family friendly',   '', 'Suitable for kids and families', 'audience'),
    ('pet friendly',      '', 'Dogs and pets welcome', 'audience'),
    ('hidden gem',        '', 'Off the beaten path, undiscovered', 'atmosphere'),
    ('trendy',            '', 'Hip, modern, fashion-forward', 'atmosphere'),
    ('quiet',             '', 'Peaceful, minimal noise', 'atmosphere'),
    ('spacious',          '', 'Lots of room, not cramped', 'practical'),
    ('fast service',      '', 'Quick service, minimal wait', 'practical'),
    ('instagrammable',    '', 'Visually striking, photo-worthy', 'atmosphere');