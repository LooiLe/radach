-- Create ar_annotations table for community-sourced explanation markers
CREATE TABLE ar_annotations (
    id BIGSERIAL PRIMARY KEY,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters DOUBLE PRECISION NOT NULL DEFAULT 30.0,
    bearing DOUBLE PRECISION,
    title VARCHAR(150) NOT NULL,
    description VARCHAR(2000) NOT NULL,
    photo_url VARCHAR(255),
    author_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    approved_by_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    admin_note VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ar_annotations_spatial ON ar_annotations(latitude, longitude);
CREATE INDEX idx_ar_annotations_status ON ar_annotations(status);
