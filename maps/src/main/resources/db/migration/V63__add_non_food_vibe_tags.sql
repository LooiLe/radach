-- Add new vibe tag definitions for activities, accommodation, viewpoints, markets and nightlife
-- These tags are used by the NLP vibe analysis service

INSERT INTO vibe_tag_definitions (name, emoji, description, category) VALUES
    ('snorkeling',        '', 'Great for snorkeling', 'activity'),
    ('diving',            '', 'Great for scuba diving', 'activity'),
    ('surfing',           '', 'Good spot for surfing', 'activity'),
    ('swimming',          '', 'Ideal for swimming', 'activity'),
    ('pool',              '', 'Has a swimming pool', 'practical'),
    ('boutique hotel',    '', 'Charming boutique accommodation', 'atmosphere'),
    ('resort',            '', 'Resort style stay', 'atmosphere'),
    ('cocktails',         '', 'Excellent cocktail menu', 'food'),
    ('craft beer',        '', 'Features craft beers', 'food'),
    ('rooftop',           '', 'Rooftop setting or terrace', 'atmosphere'),
    ('happy hour',        '', 'Offers happy hour discounts', 'practical'),
    ('night market',      '', 'Vibrant night market experience', 'atmosphere'),
    ('street food',       '', 'Great variety of local street food', 'food'),
    ('adventure',         '', 'Perfect for adventure seekers', 'activity'),
    ('cultural',          '', 'Rich in culture or history', 'atmosphere')
ON CONFLICT (name) DO NOTHING;
