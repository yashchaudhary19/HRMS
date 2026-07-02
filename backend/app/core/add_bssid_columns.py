import sys
import os

# Adjust path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.database import engine

def migrate():
    with engine.connect() as conn:
        print("Running migrations for BSSID integration...")
        try:
            db_type = engine.name
            print(f"Database dialect: {db_type}")
            
            if db_type == "sqlite":
                # Check companies table
                res = conn.execute(text("PRAGMA table_info(companies)"))
                columns = [r[1] for r in res.fetchall()]
                if "allowed_wifi_bssids" not in columns:
                    conn.execute(text("ALTER TABLE companies ADD COLUMN allowed_wifi_bssids VARCHAR(1000) DEFAULT ''"))
                    print("SQLite: Added allowed_wifi_bssids to companies table.")
                else:
                    print("SQLite: allowed_wifi_bssids already exists in companies table.")
                
                # Check attendance table
                res = conn.execute(text("PRAGMA table_info(attendance)"))
                columns = [r[1] for r in res.fetchall()]
                if "wifi_bssid" not in columns:
                    conn.execute(text("ALTER TABLE attendance ADD COLUMN wifi_bssid VARCHAR(100)"))
                    print("SQLite: Added wifi_bssid to attendance table.")
                else:
                    print("SQLite: wifi_bssid already exists in attendance table.")
            else:
                # For PostgreSQL (Supabase)
                conn.execute(text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS allowed_wifi_bssids VARCHAR(1000) DEFAULT ''"))
                conn.execute(text("ALTER TABLE attendance ADD COLUMN IF NOT EXISTS wifi_bssid VARCHAR(100)"))
                print("PostgreSQL: Migrated BSSID columns successfully.")
            
            # Commit the transaction
            conn.execute(text("COMMIT"))
            print("Migration completed successfully.")
        except Exception as e:
            print(f"Migration error: {e}")

if __name__ == "__main__":
    migrate()
