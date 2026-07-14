import csv
import sys
import uuid
from collections import OrderedDict
from datetime import date, timedelta

import psycopg2
from psycopg2.extras import execute_values

if len(sys.argv) < 2:
    print("Usage: python scripts/seed_all_india_pincodes.py <postgres_url>")
    sys.exit(1)

DATABASE_URL = sys.argv[1]
CSV_PATH = "india_pincodes.csv"

print("Reading CSV...")
pincode_to_state = OrderedDict()
with open(CSV_PATH, encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        pincode = row["Pincode"].strip()
        state = row["StateName"].strip().title()
        if not pincode or len(pincode) != 6 or not pincode.isdigit():
            continue
        if pincode not in pincode_to_state:
            pincode_to_state[pincode] = state

print(f"Unique pincodes: {len(pincode_to_state)}")
states = sorted(set(pincode_to_state.values()))
print(f"Unique states/UTs: {len(states)}")

conn = psycopg2.connect(DATABASE_URL)
conn.autocommit = False
cur = conn.cursor()

state_to_zone_id = {}
for state in states:
    cur.execute("SELECT id FROM zones WHERE name = %s", (state,))
    row = cur.fetchone()
    if row:
        state_to_zone_id[state] = row[0]
    else:
        zone_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO zones (id, name, created_at) VALUES (%s, %s, now())",
            (zone_id, state),
        )
        state_to_zone_id[state] = zone_id
conn.commit()
print(f"Zones ready: {len(state_to_zone_id)}")

rows = [
    (str(uuid.uuid4()), str(state_to_zone_id[state]), pincode)
    for pincode, state in pincode_to_state.items()
]
print(f"Inserting {len(rows)} pincodes (this may take a minute)...")
execute_values(
    cur,
    "INSERT INTO zone_pincodes (id, zone_id, pincode, created_at) VALUES %s ON CONFLICT (pincode) DO NOTHING",
    rows,
    template="(%s, %s, %s, now())",
    page_size=2000,
)
conn.commit()
print("Pincodes inserted.")

today = date.today()
one_year = today + timedelta(days=365)
zone_ids = list(state_to_zone_id.values())

rc_rows = []
for from_id in zone_ids:
    for to_id in zone_ids:
        intra = from_id == to_id
        for order_type in ("B2C", "B2B"):
            if intra:
                base_fee, rate_per_kg = (30, 8) if order_type == "b2c" else (50, 12)
            else:
                base_fee, rate_per_kg = (60, 15) if order_type == "b2c" else (90, 20)
            rc_rows.append((
                str(uuid.uuid4()), str(from_id), str(to_id), order_type,
                base_fee, rate_per_kg, today, one_year,
            ))

print(f"Inserting {len(rc_rows)} rate cards (intra-state cheaper, inter-state pricier)...")
execute_values(
    cur,
    """INSERT INTO rate_cards
       (id, zone_from_id, zone_to_id, order_type, base_fee, rate_per_kg, effective_from, effective_to, created_at)
       VALUES %s""",
    rc_rows,
    template="(%s, %s, %s, %s, %s, %s, %s, %s, now())",
    page_size=2000,
)
conn.commit()
print(f"Rate cards inserted: {len(rc_rows)}")

cur.close()
conn.close()
print("Done.")
