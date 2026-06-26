-- Update event category icons to new SVGs
UPDATE event_categories SET icon_url = '/icons/mdi--food-outline.svg' WHERE name = 'Food';
UPDATE event_categories SET icon_url = '/icons/fluent-mdl2--more-sports.svg' WHERE name = 'Sports';
UPDATE event_categories SET icon_url = '/icons/bytesize--book.svg' WHERE name = 'Culture';