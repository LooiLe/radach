import os
import psycopg2

def load_env():
    env_vars = {}
    if os.path.exists(".env"):
        with open(".env", "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                parts = line.split("=", 1)
                if len(parts) == 2:
                    env_vars[parts[0].strip()] = parts[1].strip()
    return env_vars

def main():
    env = load_env()
    db_url = env.get("DATABASE_URL")
    
    # Parse JDBC PostgreSQL URL
    # Format: jdbc:postgresql://127.0.0.1:5432/mapsdb
    if not db_url or not db_url.startswith("jdbc:postgresql://"):
        print("DATABASE_URL in .env is not a local postgres url or not found.")
        return
        
    url_part = db_url[len("jdbc:postgresql://"):]
    # Split host/port and database
    host_port, dbname = url_part.split("/", 1)
    if ":" in host_port:
        host, port = host_port.split(":", 1)
    else:
        host = host_port
        port = "5432"
        
    username = env.get("DATABASE_USERNAME", "mapsuser")
    password = env.get("DATABASE_PASSWORD", "localdevpassword")
    
    print(f"Connecting to database '{dbname}' at {host}:{port} as user '{username}'...")
    try:
        conn = psycopg2.connect(
            host=host,
            port=port,
            database=dbname,
            user=username,
            password=password
        )
        cursor = conn.cursor()
        
        # Query total spots
        cursor.execute("SELECT COUNT(*) FROM spots;")
        total_spots = cursor.fetchone()[0]
        print(f"Total spots in database: {total_spots}")
        
        # Query spots with tag "Phuket"
        cursor.execute("SELECT COUNT(*) FROM spots WHERE tags LIKE '%Phuket%';")
        phuket_spots = cursor.fetchone()[0]
        print(f"Total Phuket spots in database: {phuket_spots}")
        
        # Query counts by type
        cursor.execute("""
            SELECT type, COUNT(*) 
            FROM spots 
            WHERE tags LIKE '%Phuket%' 
            GROUP BY type 
            ORDER BY count DESC;
        """)
        print("\nPhuket spots by category:")
        for row in cursor.fetchall():
            print(f" - {row[0]}: {row[1]}")
            
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Database query error: {e}")

if __name__ == "__main__":
    main()
