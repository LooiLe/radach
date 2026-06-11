-- ============================================================
-- V47: Import Trail Spots — Phuket, Krabi, Phang Nga & popular Thai hiking areas
-- ============================================================

INSERT INTO spots (name, type, address, latitude, longitude, tags, status, rank_score, photos, website_url, created_at)
SELECT v.name, v.type, v.address, v.latitude, v.longitude, v.tags::jsonb, v.status, v.rank_score, v.photos::jsonb, v.website_url, v.created_at
FROM (VALUES
-- Phuket area trails
('Khao Phra Thaeo National Park Trail', 'Trail', 'Phuket, Thailand', 7.945800, 98.315200, '["Phuket", "Trail", "Nature", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Gibbon Rehabilitation Project Trail', 'Trail', 'Phuket, Thailand', 7.953100, 98.311900, '["Phuket", "Trail", "Wildlife", "Nature"]', 'ACTIVE', 0, '[]', 'https://www.gibbonproject.org/', NOW()),
('Sirinat National Park Nature Trail', 'Trail', 'Phuket, Thailand', 8.064700, 98.227300, '["Phuket", "Trail", "Nature", "Coastal"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Ao Phang Nga National Park Trail', 'Trail', 'Phang Nga, Thailand', 8.276500, 98.498200, '["Phang Nga", "Trail", "Nature", "Kayaking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Lam Ru National Park Trail', 'Trail', 'Phang Nga, Thailand', 8.124500, 98.356700, '["Phang Nga", "Trail", "Nature", "Waterfall"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Lak-Lam Ru Nature Trail', 'Trail', 'Phang Nga, Thailand', 8.098200, 98.342100, '["Phang Nga", "Trail", "Hiking", "Coastal"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Samet Nangshe Viewpoint Trail', 'Trail', 'Phang Nga, Thailand', 8.105600, 98.448900, '["Phang Nga", "Trail", "Viewpoint", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Krabi area trails
('Tiger Cave Temple (Wat Tham Suea) Trail', 'Trail', 'Krabi, Thailand', 8.078300, 98.919800, '["Krabi", "Trail", "Temple", "Hiking", "Challenging"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Ngon Nak Viewpoint Trail', 'Trail', 'Krabi, Thailand', 8.031200, 98.823400, '["Krabi", "Trail", "Viewpoint", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Phi Phi Islands Viewpoint Trail', 'Trail', 'Krabi, Thailand', 7.740700, 98.778000, '["Krabi", "Trail", "Island", "Viewpoint"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Ao Nang Beach to Railay Trail', 'Trail', 'Krabi, Thailand', 8.032100, 98.817600, '["Krabi", "Trail", "Beach", "Coastal"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Huai To Waterfall Trail', 'Trail', 'Krabi, Thailand', 8.062300, 98.784500, '["Krabi", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Phanom Bencha National Park Trail', 'Trail', 'Krabi, Thailand', 8.215600, 98.762300, '["Krabi", "Trail", "Nature", "Hiking", "Waterfall"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Koh Lanta trails
('Mu Ko Lanta National Park Trail', 'Trail', 'Krabi, Thailand', 7.532400, 99.034500, '["Koh Lanta", "Trail", "Nature", "Coastal"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Mai Kaew Cave Trail', 'Trail', 'Krabi, Thailand', 7.652300, 99.012300, '["Koh Lanta", "Trail", "Cave", "Adventure"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Koh Samui / Surat Thani trails
('Ang Thong National Marine Park Trail', 'Trail', 'Surat Thani, Thailand', 9.632100, 100.023400, '["Koh Samui", "Trail", "Nature", "Island"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Sok National Park Trail', 'Trail', 'Surat Thani, Thailand', 9.012300, 98.654300, '["Surat Thani", "Trail", "Nature", "Jungle"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Namtok Than Sadet Waterfall Trail', 'Trail', 'Surat Thani, Thailand', 9.523400, 100.056700, '["Koh Phangan", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Chiang Mai area trails (additional)
('Doi Inthanon Nature Trail', 'Trail', 'Chiang Mai, Thailand', 18.588900, 98.487800, '["Chiang Mai", "Trail", "Nature", "Mountain"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Mae Sa Waterfall Trail', 'Trail', 'Chiang Mai, Thailand', 19.134500, 98.901200, '["Chiang Mai", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Huay Kaew Waterfall Trail', 'Trail', 'Chiang Mai, Thailand', 18.812300, 98.945600, '["Chiang Mai", "Trail", "Waterfall", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Doi Suthep-Pui National Park Trail', 'Trail', 'Chiang Mai, Thailand', 18.807800, 98.894500, '["Chiang Mai", "Trail", "Mountain", "Temple"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Khao Yai / Central Thailand trails
('Khao Yai National Park Main Trail', 'Trail', 'Nakhon Ratchasima, Thailand', 14.445600, 101.368900, '["Khao Yai", "Trail", "Nature", "Hiking", "Wildlife"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Haew Suwat Waterfall Trail', 'Trail', 'Nakhon Ratchasima, Thailand', 14.401200, 101.372300, '["Khao Yai", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Pha Kluai Mai Waterfall Trail', 'Trail', 'Nakhon Ratchasima, Thailand', 14.456700, 101.345600, '["Khao Yai", "Trail", "Waterfall", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Km 33 Wildlife Watching Trail', 'Trail', 'Nakhon Ratchasima, Thailand', 14.423400, 101.356700, '["Khao Yai", "Trail", "Wildlife", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Southern Thailand additional trails
('Siriphorn Waterfall Trail', 'Trail', 'Nakhon Si Thammarat, Thailand', 8.612300, 99.823400, '["Nakhon Si Thammarat", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Khao Luang National Park Trail', 'Trail', 'Nakhon Si Thammarat, Thailand', 8.567800, 99.789000, '["Nakhon Si Thammarat", "Trail", "Mountain", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Hat Khanom-Mu Ko Thale Tai Trail', 'Trail', 'Nakhon Si Thammarat, Thailand', 9.023400, 99.856700, '["Nakhon Si Thammarat", "Trail", "Coastal", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Eastern Thailand trails
('Khao Chamao-Khao Wong National Park Trail', 'Trail', 'Rayong, Thailand', 12.834500, 101.678900, '["Rayong", "Trail", "Nature", "Waterfall"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Namtok Khlong Kaew Nature Trail', 'Trail', 'Chanthaburi, Thailand', 12.756700, 102.012300, '["Chanthaburi", "Trail", "Waterfall", "Nature"]', 'ACTIVE', 0, '[]', NULL, NOW()),

-- Koh Chang trails
('Khao Salak Phet Nature Trail', 'Trail', 'Trat, Thailand', 12.067800, 102.345600, '["Koh Chang", "Trail", "Nature", "Mountain"]', 'ACTIVE', 0, '[]', NULL, NOW()),
('Nam Tok Khiri Phet Trail', 'Trail', 'Trat, Thailand', 12.089000, 102.323400, '["Koh Chang", "Trail", "Waterfall", "Hiking"]', 'ACTIVE', 0, '[]', NULL, NOW())

) AS v(name, type, address, latitude, longitude, tags, status, rank_score, photos, website_url, created_at)
WHERE NOT EXISTS (
    SELECT 1 FROM spots s WHERE s.name = v.name AND s.latitude = v.latitude
);