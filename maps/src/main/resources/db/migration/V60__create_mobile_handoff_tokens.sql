CREATE TABLE mobile_handoff_tokens (
    id BIGSERIAL PRIMARY KEY,
    token VARCHAR(64) NOT NULL UNIQUE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_path TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mobile_handoff_tokens_token ON mobile_handoff_tokens(token);
CREATE INDEX idx_mobile_handoff_tokens_expires_at ON mobile_handoff_tokens(expires_at);
