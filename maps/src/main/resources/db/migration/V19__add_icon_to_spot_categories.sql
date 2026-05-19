ALTER TABLE spot_categories ADD COLUMN icon_url VARCHAR(255) DEFAULT '/icons/stash--pin-location-light.svg';

UPDATE spot_categories SET icon_url = '/icons/material-symbols-light--chef-hat-outline.svg' WHERE name = 'Restaurant';
UPDATE spot_categories SET icon_url = '/icons/material-symbols-light--chef-hat-outline.svg' WHERE name = 'Food Hall';
UPDATE spot_categories SET icon_url = '/icons/carbon--cafe.svg' WHERE name = 'Café';
UPDATE spot_categories SET icon_url = '/icons/guidance--bar.svg' WHERE name = 'Bar';
UPDATE spot_categories SET icon_url = '/icons/material-symbols-light--attractions-outline-rounded.svg' WHERE name = 'Market';
UPDATE spot_categories SET icon_url = '/icons/stash--pin-location-light.svg' WHERE name = 'Other';

INSERT INTO spot_categories (name, icon_url) VALUES 
('Hotel', '/icons/material-symbols-light--hotel-outline-rounded.svg'),
('Beach', '/icons/streamline-plump--beach.svg'),
('Viewpoint', '/icons/game-icons--hill-conquest.svg'),
('Activities', '/icons/material-symbols-light--attractions-outline-rounded.svg'),
('Dine & Play', '/icons/material-symbols-light--attractions-outline-rounded.svg'),
('Children', '/icons/material-symbols-light--attractions-outline-rounded.svg'),
('Sport', '/icons/streamline-plump--beach.svg'),
('Trail', '/icons/game-icons--hill-conquest.svg')
ON CONFLICT (name) DO UPDATE SET icon_url = EXCLUDED.icon_url;
