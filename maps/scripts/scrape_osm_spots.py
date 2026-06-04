import json
import os
import requests
import urllib.parse

# Overpass API URL
OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Overpass QL Query for Phuket spots inside bounding box
# Latitude: 7.7 to 8.25, Longitude: 98.15 to 98.5
QUERY = """
[out:json][timeout:180];
(
  // Beach
  nwr["natural"="beach"](7.7,98.15,8.25,98.5);
  
  // Viewpoint
  nwr["tourism"="viewpoint"](7.7,98.15,8.25,98.5);
  
  // Market
  nwr["amenity"="marketplace"](7.7,98.15,8.25,98.5);
  nwr["shop"="market"](7.7,98.15,8.25,98.5);
  
  // Cafe
  nwr["amenity"="cafe"](7.7,98.15,8.25,98.5);
  
  // Restaurant
  nwr["amenity"="restaurant"](7.7,98.15,8.25,98.5);
  nwr["amenity"="food_court"](7.7,98.15,8.25,98.5);
  
  // Bar
  nwr["amenity"="bar"](7.7,98.15,8.25,98.5);
  nwr["amenity"="pub"](7.7,98.15,8.25,98.5);
  nwr["amenity"="nightclub"](7.7,98.15,8.25,98.5);
  
  // Hotel
  nwr["tourism"="hotel"](7.7,98.15,8.25,98.5);
  nwr["tourism"="resort"](7.7,98.15,8.25,98.5);
  nwr["tourism"="guest_house"](7.7,98.15,8.25,98.5);
  nwr["tourism"="hostel"](7.7,98.15,8.25,98.5);
  
  // Activities / Attractions
  nwr["tourism"="theme_park"](7.7,98.15,8.25,98.5);
  nwr["tourism"="zoo"](7.7,98.15,8.25,98.5);
  nwr["tourism"="aquarium"](7.7,98.15,8.25,98.5);
  nwr["tourism"="museum"](7.7,98.15,8.25,98.5);
  nwr["tourism"="gallery"](7.7,98.15,8.25,98.5);
  nwr["tourism"="attraction"](7.7,98.15,8.25,98.5);
  nwr["leisure"="water_park"](7.7,98.15,8.25,98.5);
  nwr["leisure"="park"](7.7,98.15,8.25,98.5);
  
  // Trailhead / Trail
  nwr["tourism"="trailhead"](7.7,98.15,8.25,98.5);
  nwr["highway"="trailhead"](7.7,98.15,8.25,98.5);
);
out center;
"""

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
    'Café': [
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

def fetch_osm_data():
    print("Fetching data from Overpass API (this can take up to a minute)...")
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://github.com/LooiLe/radach'
    }
    try:
        response = requests.post(OVERPASS_URL, data={'data': QUERY}, headers=headers, timeout=200)
        response.raise_for_status()
        data = response.json()
        elements = data.get('elements', [])
        print(f"Successfully fetched {len(elements)} raw elements from OSM.")
        return elements
    except Exception as e:
        print(f"Error fetching data: {e}")
        return []

def map_osm_category(tags):
    # Determine the category based on OSM tags
    if tags.get('natural') == 'beach':
        return 'Beach'
    elif tags.get('tourism') == 'viewpoint':
        return 'Viewpoint'
    elif tags.get('amenity') == 'marketplace' or tags.get('shop') == 'market':
        return 'Market'
    elif tags.get('amenity') == 'cafe':
        return 'Café'
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

def clean_address(tags):
    parts = []
    # Try to build a readable address from OSM tags
    housenumber = tags.get('addr:housenumber')
    street = tags.get('addr:street')
    suburb = tags.get('addr:suburb')
    city = tags.get('addr:city')
    postcode = tags.get('addr:postcode')
    
    if housenumber and street:
        parts.append(f"{housenumber} {street}")
    elif street:
        parts.append(street)
        
    if suburb:
        parts.append(suburb)
    if city:
        parts.append(city)
    if postcode:
        parts.append(postcode)
        
    address = ", ".join([p.strip() for p in parts if p.strip()])
    
    # Fallback if no specific address parts found
    if not address:
        address = "Phuket, Thailand"
    else:
        # Append Phuket/Thailand if not already in there
        if "phuket" not in address.lower():
            address += ", Phuket"
        if "thailand" not in address.lower():
            address += ", Thailand"
            
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

def process_elements(elements):
    spots = []
    seen_keys = set() # (name.lower(), round(lat, 4), round(lon, 4)) to avoid exact duplicates
    
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
        address = clean_address(tags)
        website = clean_website(tags)
        photos = get_photos_for_spot(name, category)
        
        # Deduplication key (name + coords rounded to 4 decimals ~ 11m)
        dedup_key = (name.lower(), round(lat, 4), round(lon, 4))
        if dedup_key in seen_keys:
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
        
    return spots

def escape_sql_string(s):
    if s is None:
        return "NULL"
    # Postgres escapes single quotes by doubling them
    escaped = s.replace("'", "''")
    return f"'{escaped}'"

def generate_migration_file(spots, output_path):
    print(f"Generating migration file at {output_path} with {len(spots)} spots...")
    
    lines = [
        "-- Migration to import scraped Phuket locations from OpenStreetMap via Overpass API with pre-populated photos",
        "-- Total spots: " + str(len(spots)),
        ""
    ]
    
    # We write batch inserts to be clean and fast
    batch_size = 50
    for i in range(0, len(spots), batch_size):
        batch = spots[i:i+batch_size]
        
        insert_header = "INSERT INTO spots (name, type, address, latitude, longitude, tags, status, rank_score, photos, website_url, created_at) VALUES"
        value_rows = []
        
        for spot in batch:
            name_esc = escape_sql_string(spot['name'])
            type_esc = escape_sql_string(spot['type'])
            addr_esc = escape_sql_string(spot['address'])
            lat = spot['latitude']
            lon = spot['longitude']
            
            # tags column takes a JSON array of strings
            tags_json = json.dumps(["Phuket", spot['type']])
            tags_esc = escape_sql_string(tags_json)
            
            status_esc = "'ACTIVE'"
            rank_score = 0
            
            # photos column takes a JSON array of image URLs
            photos_json = json.dumps(spot['photos'])
            photos_esc = escape_sql_string(photos_json)
            
            web_esc = escape_sql_string(spot['website_url'])
            
            row = f"({name_esc}, {type_esc}, {addr_esc}, {lat}, {lon}, {tags_esc}, {status_esc}, {rank_score}, {photos_esc}, {web_esc}, NOW())"
            value_rows.append(row)
            
        statement = insert_header + "\n" + ",\n".join(value_rows) + ";"
        lines.append(statement)
        lines.append("")
        
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
        
    print("Migration file generated successfully.")

def main():
    elements = fetch_osm_data()
    if not elements:
        print("No elements fetched. Exiting.")
        return
        
    spots = process_elements(elements)
    print(f"Processed and cleaned down to {len(spots)} unique spots.")
    
    # Define migration output path
    migration_file = "src/main/resources/db/migration/V41__import_phuket_spots.sql"
    migration_path = os.path.abspath(migration_file)
    
    generate_migration_file(spots, migration_path)

if __name__ == "__main__":
    main()
