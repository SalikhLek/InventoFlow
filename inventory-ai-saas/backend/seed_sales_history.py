"""
Seed realistic, trending sales history for all items in the DB.
Run from the backend directory:
    python seed_sales_history.py
"""
import json
import math
import random
import sqlite3
from datetime import date, timedelta

random.seed(42)

DAYS = 60  # how many days of history to generate
END_DATE = date(2026, 5, 17)
START_DATE = END_DATE - timedelta(days=DAYS - 1)


def make_history(base: float, trend: float, amplitude: float, noise: float) -> list[dict]:
    """
    Generate daily sales:
      base      – average daily demand at the start
      trend     – daily linear growth (can be negative)
      amplitude – weekly seasonal swing (0 = no seasonality)
      noise     – random noise multiplier
    """
    records = []
    for i in range(DAYS):
        day = START_DATE + timedelta(days=i)
        weekday = day.weekday()  # 0=Mon … 6=Sun
        seasonal = amplitude * math.sin(2 * math.pi * weekday / 7)
        value = base + trend * i + seasonal + random.gauss(0, noise)
        records.append({"date": day.isoformat(), "sales": max(0, round(value))})
    return records


# Pattern per item index (cyclic if more items than patterns)
PATTERNS = [
    # (base, trend, amplitude, noise)  ← description
    (10.0,  0.25,  3.0,  1.5),   # growing trend + weekly seasonality
    (20.0, -0.20,  5.0,  2.0),   # declining trend + strong seasonality
    ( 5.0,  0.05,  0.0,  1.0),   # slow growth, no seasonality
    (15.0,  0.50,  4.0,  3.0),   # fast-growing, noisy
    (30.0,  0.00,  8.0,  2.5),   # flat mean, strong weekly pattern
    ( 8.0, -0.10,  2.0,  1.0),   # slight decline + mild seasonality
    (12.0,  0.30,  3.5,  2.0),   # moderate growth
    (25.0,  0.00,  0.0,  4.0),   # flat with high noise
]


def main():
    conn = sqlite3.connect("inventory.db")
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM items ORDER BY id")
    items = cur.fetchall()

    for idx, item in enumerate(items):
        pattern = PATTERNS[idx % len(PATTERNS)]
        history = make_history(*pattern)
        cur.execute(
            "UPDATE items SET sales_history=? WHERE id=?",
            (json.dumps(history), item["id"]),
        )
        print(f"  ✓ {item['name']} (id={item['id']}) — {len(history)} days seeded (pattern {idx % len(PATTERNS)})")

    conn.commit()
    conn.close()
    print(f"\nDone. Seeded {len(items)} items with {DAYS} days of history each.")


if __name__ == "__main__":
    main()
