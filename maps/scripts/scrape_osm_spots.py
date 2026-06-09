import json
import os
import argparse
import re
import requests
import sys
import time
import urllib.parse

# Overpass API URL
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Default bounding box is Phuket.
DEFAULT_BBOX = (7.7, 98.15, 8.25, 98.5)
DEFAULT_CITY = "Phuket"
DEFAULT_COUNTRY = "Thailand"

def escape_overpass_string(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')

def build_query(bbox, area_name=None, area_iso=None):
    south, west, north, east = bbox
    bbox_text = f"{south},{west},{north},{east}"
    area_prefix = ""
    area_filter = ""
    if area_iso:
        escaped_area_iso = escape_overpass_string(area_iso)
        area_prefix = (
            f'area["ISO3166-1"="{escaped_area_iso}"]["boundary"="administrative"]["admin_level"="2"]->.searchArea;'
        )
        area_filter = "(area.searchArea)"
    elif area_name:
        escaped_area_name = escape_overpass_string(area_name)
        area_prefix = (
            f'area["name"="{escaped_area_name}"]["boundary"="administrative"]["admin_level"="2"]->.searchArea;'
        )
        area_filter = "(area.searchArea)"
    return f"""
[out:json][timeout:180];
{area_prefix}
(
  // Beach
  nwr["natural"="beach"]{area_filter}({bbox_text});
  
  // Viewpoint
  nwr["tourism"="viewpoint"]{area_filter}({bbox_text});
  
  // Market
  nwr["amenity"="marketplace"]{area_filter}({bbox_text});
  nwr["shop"="market"]{area_filter}({bbox_text});
  
  // Cafe
  nwr["amenity"="cafe"]{area_filter}({bbox_text});
  
  // Restaurant
  nwr["amenity"="restaurant"]{area_filter}({bbox_text});
  nwr["amenity"="food_court"]{area_filter}({bbox_text});
  
  // Bar
  nwr["amenity"="bar"]{area_filter}({bbox_text});
  nwr["amenity"="pub"]{area_filter}({bbox_text});
  nwr["amenity"="nightclub"]{area_filter}({bbox_text});
  
  // Hotel
  nwr["tourism"="hotel"]{area_filter}({bbox_text});
  nwr["tourism"="resort"]{area_filter}({bbox_text});
  nwr["tourism"="guest_house"]{area_filter}({bbox_text});
  nwr["tourism"="hostel"]{area_filter}({bbox_text});
  
  // Activities / Attractions
  nwr["tourism"="theme_park"]{area_filter}({bbox_text});
  nwr["tourism"="zoo"]{area_filter}({bbox_text});
  nwr["tourism"="aquarium"]{area_filter}({bbox_text});
  nwr["tourism"="museum"]{area_filter}({bbox_text});
  nwr["tourism"="gallery"]{area_filter}({bbox_text});
  nwr["tourism"="attraction"]{area_filter}({bbox_text});
  nwr["leisure"="water_park"]{area_filter}({bbox_text});
  nwr["leisure"="park"]{area_filter}({bbox_text});
  
  // Trailhead / Trail
  nwr["tourism"="trailhead"]{area_filter}({bbox_text});
  nwr["highway"="trailhead"]{area_filter}({bbox_text});
);
out center;
"""

def spot_key(name, lat, lon):
    return (name.strip().lower(), round(float(lat), 4), round(float(lon), 4))

def load_existing_spot_keys(migration_dir, exclude_path=None):
    if not migration_dir:
        return set()

    existing_keys = set()
    excluded_abs_path = os.path.abspath(exclude_path) if exclude_path else None
    if not os.path.isdir(migration_dir):
        print(f"Existing migration directory not found: {migration_dir}")
        return existing_keys

    row_pattern = re.compile(
        r"\('((?:''|[^'])*)',\s*'[^']*',\s*(?:'(?:(?:''|[^'])*)'|NULL),\s*"
        r"(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)",
        re.MULTILINE,
    )

    for filename in sorted(os.listdir(migration_dir)):
        if not filename.endswith(".sql"):
            continue
        path = os.path.join(migration_dir, filename)
        if excluded_abs_path and os.path.abspath(path) == excluded_abs_path:
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                contents = f.read()
        except UnicodeDecodeError:
            with open(path, "r", encoding="latin-1") as f:
                contents = f.read()

        for match in row_pattern.finditer(contents):
            name = match.group(1).replace("''", "'")
            existing_keys.add(spot_key(name, match.group(2), match.group(3)))

    print(f"Loaded {len(existing_keys)} existing spot keys from migrations.")
    return existing_keys

def tile_bbox(bbox, tile_degrees):
    if not tile_degrees or tile_degrees <= 0:
        return [bbox]

    south, west, north, east = bbox
    tiles = []
    tile_south = south
    while tile_south < north:
        tile_north = min(tile_south + tile_degrees, north)
        tile_west = west
        while tile_west < east:
            tile_east = min(tile_west + tile_degrees, east)
            tiles.append((tile_south, tile_west, tile_north, tile_east))
            tile_west = tile_east
        tile_south = tile_north
    return tiles

def fetch_bbox_tiles(bbox, tile_degrees, delay_seconds, area_name=None, area_iso=None):
    tiles = tile_bbox(bbox, tile_degrees)
    all_elements = []
    failed_tiles = []
    print(f"Fetching {len(tiles)} bbox tile(s).")
    for index, tile in enumerate(tiles, start=1):
        print(f"Fetching tile {index}/{len(tiles)}: {tile}")
        elements = fetch_osm_data(build_query(tile, area_name, area_iso))
        if elements is None:
            failed_tiles.append(tile)
            continue
        all_elements.extend(elements)
        if delay_seconds and index < len(tiles):
            time.sleep(delay_seconds)
    print(f"Fetched {len(all_elements)} raw elements across all tiles.")
    if failed_tiles:
        print(f"Failed to fetch {len(failed_tiles)} tile(s): {failed_tiles}")
    return all_elements, failed_tiles

# Curated high-quality category fallback images from Unsplash
CATEGORY_IMAGES = {
    'Beach': [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1473116763269-255ea7b2fdb2?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506929562872-bb421503ef21?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1520942702018-0862200e6873?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1510414842594-a61c69b5ae57?w=800&auto=format&fit=crop'
    ],
    'Hotel': [
        'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1529290130-4ca3753253ae?w=800&auto=format&fit=crop'
    ],
    'Cafe': [
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1511920170033-f8396924c348?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1447933601403-0c6688de566e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507133750040-4a8f57021571?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=800&auto=format&fit=crop'
    ],
    'Restaurant': [
        'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1537047902294-62a40c20a6ae?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop'
    ],
    'Bar': [
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1527661591475-527312dd65f5?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1574096079513-d8259312b785?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1485872224824-d18789c8abf5?w=800&auto=format&fit=crop'
    ],
    'Viewpoint': [
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1472396961693-142e6e269027?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&auto=format&fit=crop'
    ],
    'Market': [
        'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1488459718432-36af50f673ae?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506484381205-f7945653044d?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1464226184884-fa280b87c3a9?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1515023115689-589a33480967?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=800&auto=format&fit=crop'
    ],
    'Activities': [
        'https://images.unsplash.com/photo-1513829096969-e0e6e6e60b86?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1528127269322-539801943592?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&auto=format&fit=crop'
    ],
    'Trail': [
        'https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1475924156734-496f6cac6ec1?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=800&auto=format&fit=crop'
    ],
    'Other': [
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&fit=crop'
    ]
}

def fetch_osm_data(query, retries=4, retry_delay=15):
    print("Fetching data from Overpass API (this can take up to a minute)...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://github.com/LooiLe/radach'
    }
    for attempt in range(1, retries + 1):
        try:
            response = requests.post(OVERPASS_URL, data={'data': query}, headers=headers, timeout=200)
            response.raise_for_status()
            data = response.json()
            elements = data.get('elements', [])
            print(f"Successfully fetched {len(elements)} raw elements from OSM.")
            return elements
        except Exception as e:
            print(f"Error fetching data on attempt {attempt}/{retries}: {e}")
            if attempt < retries:
                time.sleep(retry_delay * attempt)
    return None

def map_osm_category(tags):
    # Determine the category based on OSM tags
    if tags.get('natural') == 'beach':
        return 'Beach'
    elif tags.get('tourism') == 'viewpoint':
        return 'Viewpoint'
    elif tags.get('amenity') == 'marketplace' or tags.get('shop') == 'market':
        return 'Market'
    elif tags.get('amenity') == 'cafe':
        return 'Cafe'
    elif tags.get('amenity') in ['restaurant', 'food_court']:
        return 'Restaurant'
    elif tags.get('amenity') in ['bar', 'pub', 'nightclub']:
        return 'Bar'
    elif tags.get('tourism') in ['hotel', 'resort', 'guest_house', 'hostel']:
        return 'Hotel'
    elif (tags.get('tourism') in ['theme_park', 'zoo', 'aquarium', 'museum', 'gallery', 'attraction'] or 
          tags.get('leisure') in ['water_park', 'park']):
        return 'Activities'
    elif tags.get('tourism') == 'trailhead' or tags.get('highway') == 'trailhead':
        return 'Trail'
    return 'Other'

def clean_address(tags, city=DEFAULT_CITY, country=DEFAULT_COUNTRY):
    def clean_part(value):
        if value is None:
            return None
        value = str(value).strip()
        if not value or value.lower() in {"none", "null", "nan"}:
            return None
        return value

    parts = []
    # Try to build a readable address from OSM tags
    housenumber = clean_part(tags.get('addr:housenumber'))
    street = clean_part(tags.get('addr:street'))
    suburb = clean_part(tags.get('addr:suburb'))
    tag_city = clean_part(tags.get('addr:city'))
    postcode = clean_part(tags.get('addr:postcode'))
    
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
        
    if suburb:
        parts.append(suburb)
    if tag_city:
        parts.append(tag_city)
    if postcode:
        parts.append(postcode)
        
    address = ", ".join([p.strip() for p in parts if p.strip()])
    
    # Fallback if no specific address parts found
    if not address:
        address = f"{city}, {country}"
    else:
        if city and city.lower() not in address.lower():
            address += f", {city}"
        if country and country.lower() not in address.lower():
            address += f", {country}"
            
    return address

def clean_website(tags):
    web = tags.get('website') or tags.get('contact:website') or tags.get('contact:facebook') or tags.get('facebook')
    if web:
        web = web.strip()
        if not web.startswith(('http://', 'https://')):
            web = 'https://' + web
        return web[:255] # varchar(255) limit
    return None

def get_photos_for_spot(spot_name, category):
    return []

def process_elements(elements, city=DEFAULT_CITY, country=DEFAULT_COUNTRY, max_spots=None, existing_keys=None):
    spots = []
    seen_keys = set() # (name.lower(), round(lat, 4), round(lon, 4)) to avoid exact duplicates
    existing_keys = existing_keys or set()
    skipped_existing = 0
    
    total_elements = len(elements)
    print("Processing and generating photos for elements...")
    
    for index, el in enumerate(elements):
        if index % 500 == 0 and index > 0:
            print(f"Processed {index}/{total_elements} elements...")
            
        tags = el.get('tags', {})
        
        # Name: English preferred, fallback to local name
        name = tags.get('name:en') or tags.get('name')
        if not name:
            continue
            
        name = name.strip()
        
        # Latitude / Longitude
        lat = el.get('lat') or el.get('center', {}).get('lat')
        lon = el.get('lon') or el.get('center', {}).get('lon')
        if lat is None or lon is None:
            continue
            
        category = map_osm_category(tags)
        address = clean_address(tags, city, country)
        website = clean_website(tags)
        photos = get_photos_for_spot(name, category)
        
        # Deduplication key (name + coords rounded to 4 decimals ~ 11m)
        dedup_key = spot_key(name, lat, lon)
        if dedup_key in seen_keys:
            continue
        if dedup_key in existing_keys:
            skipped_existing += 1
            continue
        seen_keys.add(dedup_key)
        
        spots.append({
            'name': name,
            'type': category,
            'address': address,
            'latitude': lat,
            'longitude': lon,
            'website_url': website,
            'photos': photos
        })

        if max_spots and len(spots) >= max_spots:
            break
        
    if skipped_existing:
        print(f"Skipped {skipped_existing} spots that already exist in previous migrations.")

    return spots

def escape_sql_string(s):
    if s is None:
        return "NULL"
    # Postgres escapes single quotes by doubling them
    escaped = s.replace("'", "''")
    return f"'{escaped}'"

def generate_migration_file(spots, output_path, city=DEFAULT_CITY):
    print(f"Generating migration file at {output_path} with {len(spots)} spots...")
    
    lines = [
        f"-- Migration to import scraped {city} locations from OpenStreetMap via Overpass API",
        "-- Total spots: " + str(len(spots)),
        ""
    ]
    
    # We write batch inserts to be clean and fast
    batch_size = 50
    for i in range(0, len(spots), batch_size):
        batch = spots[i:i+batch_size]
        
        insert_header = "INSERT INTO spots (name, type, address, latitude, longitude, tags, status, rank_score, photos, website_url, created_at)"
        value_rows = []
        
        for spot in batch:
            name_esc = escape_sql_string(spot['name'])
            type_esc = escape_sql_string(spot['type'])
            addr_esc = escape_sql_string(spot['address'])
            lat = spot['latitude']
            lon = spot['longitude']
            
            # tags column takes a JSON array of strings
            tags_json = json.dumps([city, spot['type']])
            tags_esc = escape_sql_string(tags_json)
            
            status_esc = "'ACTIVE'"
            rank_score = 0
            
            # photos column takes a JSON array of image URLs
            photos_json = json.dumps(spot['photos'])
            photos_esc = escape_sql_string(photos_json)
            
            web_esc = escape_sql_string(spot['website_url'])
            
            row = f"({name_esc}, {type_esc}, {addr_esc}, {lat}, {lon}, {tags_esc}, {status_esc}, {rank_score}, {photos_esc}, {web_esc}, NOW())"
            value_rows.append(row)
            
        statement = (
            insert_header
            + "\nSELECT v.name, v.type, v.address, v.latitude, v.longitude, v.tags, v.status, v.rank_score, v.photos, v.website_url, v.created_at\n"
            + "FROM (VALUES\n"
            + ",\n".join(value_rows)
            + "\n) AS v(name, type, address, latitude, longitude, tags, status, rank_score, photos, website_url, created_at)\n"
            + "WHERE NOT EXISTS (\n"
            + "    SELECT 1 FROM spots s\n"
            + "    WHERE lower(s.name) = lower(v.name)\n"
            + "      AND round(s.latitude::numeric, 4) = round(v.latitude::numeric, 4)\n"
            + "      AND round(s.longitude::numeric, 4) = round(v.longitude::numeric, 4)\n"
            + ");"
        )
        lines.append(statement)
        lines.append("")
        
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
        
    print("Migration file generated successfully.")

def parse_bbox(value):
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("bbox must be south,west,north,east")
    try:
        return tuple(float(p) for p in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("bbox values must be numbers") from exc

def main():
    parser = argparse.ArgumentParser(description="Scrape OSM spots into a Flyway migration.")
    parser.add_argument("--city", default=DEFAULT_CITY)
    parser.add_argument("--country", default=DEFAULT_COUNTRY)
    parser.add_argument("--bbox", type=parse_bbox, default=DEFAULT_BBOX, help="south,west,north,east")
    parser.add_argument("--output", default="src/main/resources/db/migration/V41__import_phuket_spots.sql")
    parser.add_argument("--max-spots", type=int, default=None)
    parser.add_argument("--tile-degrees", type=float, default=0, help="Split bbox into tiles of this size in degrees.")
    parser.add_argument("--tile-delay", type=float, default=1.0, help="Seconds to wait between tiled Overpass requests.")
    parser.add_argument("--area-name", default=None, help="Optional admin_level=2 Overpass area name to filter results to a country.")
    parser.add_argument("--area-iso", default=None, help="Optional ISO3166-1 country code to filter results to a country.")
    parser.add_argument(
        "--exclude-existing-migrations",
        default="src/main/resources/db/migration",
        help="Directory of existing SQL migrations to avoid re-scraping already imported spots. Use an empty string to disable.",
    )
    args = parser.parse_args()
    migration_path = os.path.abspath(args.output)

    existing_keys = load_existing_spot_keys(args.exclude_existing_migrations, migration_path)
    elements, failed_tiles = fetch_bbox_tiles(args.bbox, args.tile_degrees, args.tile_delay, args.area_name, args.area_iso)
    if failed_tiles:
        print("Some tiles could not be fetched after retries; no migration was written.")
        sys.exit(1)
    if not elements:
        print("No elements fetched. Exiting.")
        return
        
    spots = process_elements(elements, args.city, args.country, args.max_spots, existing_keys)
    print(f"Processed and cleaned down to {len(spots)} unique spots.")
    
    generate_migration_file(spots, migration_path, args.city)

if __name__ == "__main__":
    main()

