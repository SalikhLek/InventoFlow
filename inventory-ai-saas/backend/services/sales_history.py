from collections import defaultdict
from typing import Any, Dict, List


def aggregate_sales_by_day(entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sum sales for duplicate calendar dates; output sorted by date ascending."""
    totals: dict[str, float] = defaultdict(float)
    for x in entries:
        if not isinstance(x, dict) or "date" not in x or "sales" not in x:
            continue
        try:
            sales = float(x["sales"])
        except (TypeError, ValueError):
            continue
        date_key = str(x["date"]).strip()
        if not date_key:
            continue
        totals[date_key] += sales
    return [{"date": d, "sales": int(round(totals[d]))} for d in sorted(totals.keys())]
