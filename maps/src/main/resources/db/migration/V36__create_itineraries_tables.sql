-- Itinerary Planning Feature: core tables + payment/subscription tables

CREATE TABLE itineraries (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    source VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    generation_preferences TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE itinerary_stops (
    id BIGSERIAL PRIMARY KEY,
    itinerary_id BIGINT NOT NULL REFERENCES itineraries(id) ON DELETE CASCADE,
    spot_id BIGINT NOT NULL REFERENCES spots(id),
    stop_order INT NOT NULL,
    start_time TIME,
    end_time TIME,
    duration_minutes INT,
    notes TEXT,
    UNIQUE(itinerary_id, stop_order)
);

CREATE TABLE itinerary_generations (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    itinerary_id BIGINT REFERENCES itineraries(id),
    stripe_session_id VARCHAR(255),
    stripe_payment_intent_id VARCHAR(255),
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING_PAYMENT',
    preferences TEXT NOT NULL,
    amount_cents INT NOT NULL,
    payment_method VARCHAR(20) NOT NULL DEFAULT 'ONE_TIME',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE user_credits (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id),
    balance INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255),
    tier VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    generations_used_this_month INT NOT NULL DEFAULT 0,
    generations_limit INT NOT NULL DEFAULT 5,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_itineraries_user_id ON itineraries(user_id);
CREATE INDEX idx_itinerary_stops_itinerary_id ON itinerary_stops(itinerary_id);
CREATE INDEX idx_itinerary_generations_user_id ON itinerary_generations(user_id);
CREATE INDEX idx_itinerary_generations_stripe_session ON itinerary_generations(stripe_session_id);
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_stripe_sub_id ON user_subscriptions(stripe_subscription_id);
