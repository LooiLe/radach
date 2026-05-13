CREATE TABLE user_spot_interactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    spot_id BIGINT NOT NULL,
    is_liked BOOLEAN NOT NULL DEFAULT FALSE,
    is_saved BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMP NOT NULL,
    CONSTRAINT uk_user_spot_interaction UNIQUE (user_id, spot_id)
);
