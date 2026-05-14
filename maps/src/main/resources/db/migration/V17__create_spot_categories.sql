-- Create spot_categories table
CREATE TABLE spot_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed default categories
INSERT INTO spot_categories (name) VALUES 
('Restaurant'),
('Food Hall'),
('Café'),
('Bar'),
('Market'),
('Other');
