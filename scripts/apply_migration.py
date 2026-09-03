"""Apply /app/supabase/migration.sql to Supabase Postgres.

Usage:
    SUPABASE_DB_URL="postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres" \
      python3 scripts/apply_migration.py
"""
import os
import sys
import psycopg2

url = os.environ.get("SUPABASE_DB_URL")
if not url:
    sys.exit("Set SUPABASE_DB_URL (Supabase → Project Settings → Database → Connection string)")

sql = open("/app/supabase/migration.sql").read()
conn = psycopg2.connect(url)
conn.autocommit = True
with conn.cursor() as cur:
    cur.execute(sql)
print("Migration applied successfully.")
