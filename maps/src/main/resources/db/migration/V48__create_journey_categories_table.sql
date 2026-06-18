-- Create journey_categories table
CREATE TABLE journey_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    icon_url VARCHAR(512) DEFAULT '/icons/stash--pin-location-light.svg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed default journey categories
INSERT INTO journey_categories (name, icon_url) VALUES 
('Walks & Trails', '/icons/game-icons--hill-conquest.svg'),
('Food & Drink', '/icons/material-symbols-light--chef-hat-outline.svg'),
('Scenic & Photography', '/icons/streamline-plump--beach.svg'),
('Culture & History', '/icons/material-symbols-light--attractions-outline-rounded.svg'),
('Local Experiences', '/icons/solar--global-broken.svg');