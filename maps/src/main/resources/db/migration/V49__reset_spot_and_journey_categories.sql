-- Reset spot categories to the curated list
DELETE FROM spot_categories;

INSERT INTO spot_categories (name, icon_url) VALUES
('Activities', '/icons/material-symbols-light--attractions-outline-rounded.svg'),
('Bar', '/icons/guidance--bar.svg'),
('Beach', '/icons/fluent--beach-48-regular.svg'),
('Café', '/icons/carbon--cafe.svg'),
('Children', '/icons/material-symbols-light--child-hat-outline.svg'),
('Accommodations', '/icons/material-symbols-light--bed-outline-rounded.svg'),
('Market', '/icons/healthicons--market-stall-outline.svg'),
('Restaurant', '/icons/material-symbols-light--chef-hat-outline.svg'),
('Viewpoint', '/icons/material-symbols-light--mountain-flag-outline.svg'),
('Others', '/icons/stash--pin-location-light.svg');

-- Reset journey categories to the curated list
DELETE FROM journey_categories;

INSERT INTO journey_categories (name, icon_url) VALUES
('Culture & History', '/icons/proicons--museum.svg'),
('Food & Drink', '/icons/boxicons--food-menu.svg'),
('Local Experiences', '/icons/icon-park-solid--local.svg'),
('Scenic & Photography', '/icons/mdi--camera.svg'),
('Walks & Trails', '/icons/ph--person-simple-hike.svg');