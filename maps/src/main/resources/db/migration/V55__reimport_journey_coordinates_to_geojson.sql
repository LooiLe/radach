-- ============================================================
-- V55: Fix geo_json coordinates for journeys that have empty coordinates
-- Hardcode coordinates from the original V53 data since lat/lng columns were dropped
-- ============================================================

UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.315200, 7.945800)))::text WHERE name = 'Khao Phra Thaeo National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.311900, 7.953100)))::text WHERE name = 'Gibbon Rehabilitation Project Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.227300, 8.064700)))::text WHERE name = 'Sirinat National Park Nature Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.498200, 8.276500)))::text WHERE name = 'Ao Phang Nga National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.356700, 8.124500)))::text WHERE name = 'Lam Ru National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.342100, 8.098200)))::text WHERE name = 'Khao Lak-Lam Ru Nature Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.448900, 8.105600)))::text WHERE name = 'Samet Nangshe Viewpoint Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.919800, 8.078300)))::text WHERE name = 'Tiger Cave Temple (Wat Tham Suea) Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.823400, 8.031200)))::text WHERE name = 'Khao Ngon Nak Viewpoint Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.778000, 7.740700)))::text WHERE name = 'Phi Phi Islands Viewpoint Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.817600, 8.032100)))::text WHERE name = 'Ao Nang Beach to Railay Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.784500, 8.062300)))::text WHERE name = 'Huai To Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.762300, 8.215600)))::text WHERE name = 'Khao Phanom Bencha National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(99.034500, 7.532400)))::text WHERE name = 'Mu Ko Lanta National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(99.012300, 7.652300)))::text WHERE name = 'Khao Mai Kaew Cave Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(100.023400, 9.632100)))::text WHERE name = 'Ang Thong National Marine Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.654300, 9.012300)))::text WHERE name = 'Khao Sok National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(100.056700, 9.523400)))::text WHERE name = 'Namtok Than Sadet Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.487800, 18.588900)))::text WHERE name = 'Doi Inthanon Nature Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.901200, 19.134500)))::text WHERE name = 'Mae Sa Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.945600, 18.812300)))::text WHERE name = 'Huay Kaew Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(98.894500, 18.807800)))::text WHERE name = 'Doi Suthep-Pui National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(101.368900, 14.445600)))::text WHERE name = 'Khao Yai National Park Main Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(101.372300, 14.401200)))::text WHERE name = 'Haew Suwat Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(101.345600, 14.456700)))::text WHERE name = 'Pha Kluai Mai Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(101.356700, 14.423400)))::text WHERE name = 'Km 33 Wildlife Watching Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(99.823400, 8.612300)))::text WHERE name = 'Siriphorn Waterfall Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(99.789000, 8.567800)))::text WHERE name = 'Khao Luang National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(99.856700, 9.023400)))::text WHERE name = 'Hat Khanom-Mu Ko Thale Tai Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(101.678900, 12.834500)))::text WHERE name = 'Khao Chamao-Khao Wong National Park Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(102.012300, 12.756700)))::text WHERE name = 'Namtok Khlong Kaew Nature Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(102.345600, 12.067800)))::text WHERE name = 'Khao Salak Phet Nature Trail';
UPDATE journeys SET geo_json = json_build_object('type', 'LineString', 'coordinates', json_build_array(json_build_array(102.323400, 12.089000)))::text WHERE name = 'Nam Tok Khiri Phet Trail';