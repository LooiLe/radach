-- Create event_categories table
CREATE TABLE event_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    icon_url VARCHAR(255) DEFAULT '/icons/stash--pin-location-light.svg',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Seed default event categories
INSERT INTO event_categories (name, icon_url) VALUES 
('Music', '/icons/material-symbols-light--music-note-outline.svg'),
('Workshop', '/icons/material-symbols-light--build-outline.svg'),
('Food', '/icons/material-symbols-light--chef-hat-outline.svg'),
('Culture', '/icons/proicons--museum.svg'),
('Sports', '/icons/fluent--beach-48-regular.svg'),
('Other', '/icons/stash--pin-location-light.svg');

-- Add category column to events table
ALTER TABLE events ADD COLUMN category VARCHAR(255);
