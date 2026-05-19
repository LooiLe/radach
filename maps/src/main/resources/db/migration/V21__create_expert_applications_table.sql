CREATE TABLE expert_applications (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    professional_title VARCHAR(100) NOT NULL,
    organization VARCHAR(100),
    years_experience INTEGER NOT NULL,
    specializations VARCHAR(255),
    portfolio_url VARCHAR(255),
    justification VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by BIGINT REFERENCES users(id)
);
