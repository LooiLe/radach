-- Add lat/lng columns to journeys table
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE journeys ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Delete imported journeys (id >= 4) and re-import from V47 trail data with lat/lng
DELETE FROM journey_upvotes WHERE journey_id >= 4;
DELETE FROM journeys WHERE id >= 4;

-- Reset sequence
SELECT setval('trail_paths_id_seq', (SELECT COALESCE(MAX(id), 2) FROM journeys));

-- Re-import trails as journeys with lat/lng from V47 data
INSERT INTO journeys (name, description, difficulty, distance_meters, geo_json, photos, status, is_private, upvote_count, created_at, journey_category_id, latitude, longitude)
SELECT v.name, v.description, v.difficulty, v.distance_meters,
       json_build_object('type', 'LineString', 'coordinates', '[]')::text,
       '[]'::text, 'ACTIVE', false, 0, NOW(),
       (SELECT id FROM journey_categories WHERE name = 'Walks & Trails' LIMIT 1),
       v.latitude, v.longitude
FROM (VALUES
-- Phuket area trails
('Khao Phra Thaeo National Park Trail', 'National park trail through tropical rainforest in Phuket.', 'MODERATE', 4500, 7.945800, 98.315200),
('Gibbon Rehabilitation Project Trail', 'Trail to observe gibbons in their natural habitat.', 'EASY', 2000, 7.953100, 98.311900),
('Sirinat National Park Nature Trail', 'Coastal nature trail through national park.', 'EASY', 1500, 8.064700, 98.227300),
('Ao Phang Nga National Park Trail', 'Trail through mangrove forests and limestone karsts.', 'MODERATE', 3000, 8.276500, 98.498200),
('Lam Ru National Park Trail', 'Trail to waterfall in national park.', 'MODERATE', 3500, 8.124500, 98.356700),
('Khao Lak-Lam Ru Nature Trail', 'Coastal nature trail with ocean views.', 'EASY', 2500, 8.098200, 98.342100),
('Samet Nangshe Viewpoint Trail', 'Trail to spectacular viewpoint over Phang Nga Bay.', 'MODERATE', 2000, 8.105600, 98.448900),

-- Krabi area trails
('Tiger Cave Temple (Wat Tham Suea) Trail', 'Challenging climb of 1,237 steps to the summit.', 'HARD', 2000, 8.078300, 98.919800),
('Khao Ngon Nak Viewpoint Trail', 'Hilltop viewpoint trail with panoramic views.', 'MODERATE', 3500, 8.031200, 98.823400),
('Phi Phi Islands Viewpoint Trail', 'Trail to viewpoint overlooking Maya Bay.', 'MODERATE', 1800, 7.740700, 98.778000),
('Ao Nang Beach to Railay Trail', 'Coastal trail from Ao Nang to Railay Beach.', 'EASY', 3000, 8.032100, 98.817600),
('Huai To Waterfall Trail', 'Trail through jungle to waterfall.', 'MODERATE', 2500, 8.062300, 98.784500),
('Khao Phanom Bencha National Park Trail', 'Mountain trail through pristine rainforest.', 'HARD', 5000, 8.215600, 98.762300),

-- Koh Lanta trails
('Mu Ko Lanta National Park Trail', 'Coastal trail through island national park.', 'EASY', 2000, 7.532400, 99.034500),
('Khao Mai Kaew Cave Trail', 'Cave exploration trail on Koh Lanta.', 'MODERATE', 1500, 7.652300, 99.012300),

-- Koh Samui / Surat Thani trails
('Ang Thong National Marine Park Trail', 'Island hopping trail through marine park.', 'MODERATE', 4000, 9.632100, 100.023400),
('Khao Sok National Park Trail', 'Jungle trail through ancient rainforest.', 'HARD', 6000, 9.012300, 98.654300),
('Namtok Than Sadet Waterfall Trail', 'Trail to waterfall on Koh Phangan.', 'EASY', 2000, 9.523400, 100.056700),

-- Chiang Mai area trails
('Doi Inthanon Nature Trail', 'Trail through Thailand''s highest peak.', 'MODERATE', 3000, 18.588900, 98.487800),
('Mae Sa Waterfall Trail', 'Trail through multi-tiered waterfall.', 'EASY', 2500, 19.134500, 98.901200),
('Huay Kaew Waterfall Trail', 'Trail to waterfall near Chiang Mai city.', 'EASY', 1500, 18.812300, 98.945600),
('Doi Suthep-Pui National Park Trail', 'Mountain trail to famous temple.', 'MODERATE', 4000, 18.807800, 98.894500),

-- Khao Yai / Central Thailand trails
('Khao Yai National Park Main Trail', 'Main trail through UNESCO World Heritage park.', 'MODERATE', 8000, 14.445600, 101.368900),
('Haew Suwat Waterfall Trail', 'Trail to famous waterfall featured in The Beach.', 'EASY', 2000, 14.401200, 101.372300),
('Pha Kluai Mai Waterfall Trail', 'Trail through forest to waterfall.', 'MODERATE', 3000, 14.456700, 101.345600),
('Km 33 Wildlife Watching Trail', 'Wildlife observation trail in national park.', 'EASY', 1500, 14.423400, 101.356700),

-- Southern Thailand additional trails
('Siriphorn Waterfall Trail', 'Trail to waterfall in southern mountains.', 'MODERATE', 3500, 8.612300, 99.823400),
('Khao Luang National Park Trail', 'Mountain trail through national park.', 'HARD', 5000, 8.567800, 99.789000),
('Hat Khanom-Mu Ko Thale Tai Trail', 'Coastal trail with sea views.', 'EASY', 2500, 9.023400, 99.856700),

-- Eastern Thailand trails
('Khao Chamao-Khao Wong National Park Trail', 'Trail through waterfall national park.', 'MODERATE', 4000, 12.834500, 101.678900),
('Namtok Khlong Kaew Nature Trail', 'Nature trail to waterfall in Chanthaburi.', 'EASY', 2000, 12.756700, 102.012300),

-- Koh Chang trails
('Khao Salak Phet Nature Trail', 'Mountain trail on Koh Chang.', 'MODERATE', 3500, 12.067800, 102.345600),
('Nam Tok Khiri Phet Trail', 'Trail to waterfall on Koh Chang.', 'EASY', 2000, 12.089000, 102.323400)
) AS v(name, description, difficulty, distance_meters, latitude, longitude);