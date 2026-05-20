-- Add missing vibe tag definitions for food, view, and entertainment categories
-- These tags are used by the NLP vibe analysis service

INSERT INTO vibe_tag_definitions (name, emoji, description, category) VALUES
    -- Food & Drink tags
    ('brunch',            '', 'Great for brunch meals', 'food'),
    ('burgers',           '', 'Known for burgers', 'food'),
    ('pasta',             '', 'Known for pasta dishes', 'food'),
    ('coffee',            '', 'Great coffee offerings', 'food'),
    ('matcha',            '', 'Known for matcha items', 'food'),
    ('thai food',         '', 'Authentic Thai cuisine', 'food'),
    ('sushi',             '', 'Known for sushi', 'food'),
    ('pizza',             '', 'Known for pizza', 'food'),
    ('seafood',           '', 'Known for seafood', 'food'),
    ('desserts',          '', 'Great dessert options', 'food'),
    ('vegan friendly',    '', 'Good vegan options available', 'food'),
    -- View & Entertainment tags
    ('beautiful view',    '', 'Scenic or beautiful views', 'atmosphere'),
    ('live music',        '', 'Features live music performances', 'entertainment')
ON CONFLICT (name) DO NOTHING;