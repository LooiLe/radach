-- Add comprehensive vibe tag definitions for cuisines, atmospheres, practicalities, audiences, and activities
-- These tags are used by the NLP vibe analysis service

INSERT INTO vibe_tag_definitions (name, emoji, description, category) VALUES
    -- Food & Drink
    ('french food',       '', 'Great French cuisine, bistro or brasserie style', 'food'),
    ('italian food',      '', 'Authentic Italian dishes, pasta, and pizza', 'food'),
    ('mexican food',      '', 'Vibrant Mexican flavors, tacos, and burritos', 'food'),
    ('indian food',       '', 'Rich Indian spices, curries, and tandoori', 'food'),
    ('chinese food',      '', 'Traditional Chinese cuisine, dim sum, and noodles', 'food'),
    ('korean food',       '', 'Korean BBQ, kimchi, and street food classics', 'food'),
    ('spanish food',      '', 'Spanish tapas, paella, and sangria', 'food'),
    ('vietnamese food',   '', 'Vietnamese specialties, pho, and banh mi', 'food'),
    ('japanese food',     '', 'Authentic Japanese cuisine, ramen, and sushi', 'food'),
    ('middle eastern food', '', 'Middle Eastern dishes, hummus, and kebabs', 'food'),
    ('mediterranean food', '', 'Healthy Mediterranean ingredients and Greek dishes', 'food'),
    ('american food',     '', 'Classic American comfort food, burgers, and BBQ', 'food'),
    ('bakery',            '', 'Freshly baked bread, croissants, and pastries', 'food'),
    ('wine bar',          '', 'Great selection of wines and pairings', 'food'),
    -- Atmosphere
    ('fine dining',       '', 'Elegant, high-end dining experience', 'atmosphere'),
    ('casual dining',     '', 'Relaxed, informal, and easygoing atmosphere', 'atmosphere'),
    ('chic',              '', 'Modern, stylish, and fashionable design', 'atmosphere'),
    ('vintage',           '', 'Retro, nostalgic, or classic style', 'atmosphere'),
    ('rustic',            '', 'Charming, traditional, or old-world feel', 'atmosphere'),
    ('waterfront',        '', 'Beautiful views right by the water', 'atmosphere'),
    ('garden setting',    '', 'Lush greenery, plants, or courtyard seating', 'atmosphere'),
    -- Practical
    ('quick bite',        '', 'Ideal for a fast, grab-and-go meal', 'practical'),
    ('takeout friendly',  '', 'Convenient for takeout, delivery, or to-go', 'practical'),
    ('accessible',        '', 'Wheelchair friendly and step-free access', 'practical'),
    ('parking available',  '', 'On-site parking, garage, or valet options', 'practical'),
    -- Audience
    ('solo friendly',     '', 'Great for dining or exploring alone', 'audience'),
    ('business friendly', '', 'Suitable for professional meetings or work lunches', 'audience'),
    -- Activity
    ('sightseeing',       '', 'Must-visit landmark, monument, or historical spot', 'activity'),
    ('shopping',          '', 'Great area for shopping, boutiques, or local crafts', 'activity'),
    ('nature walk',       '', 'Scenic nature trails, walks, or park pathways', 'activity'),
    ('nightlife',         '', 'Vibrant bars, clubs, and late-night entertainment', 'activity'),
    ('wellness',          '', 'Relaxing spa, massage, or yoga experiences', 'activity')
ON CONFLICT (name) DO NOTHING;
