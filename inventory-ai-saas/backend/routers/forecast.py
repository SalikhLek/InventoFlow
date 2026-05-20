import json
import logging
import sqlite3
from collections import defaultdict
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db
from deps import get_current_user
from metrics import FORECAST_BATCH_ITEMS, FORECAST_REQUESTS
from schemas import BatchForecastRequest, User
from services.forecast import compute_forecast, compute_forecast_compare
from services.sales_history import aggregate_sales_by_day

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["forecast"])


def _get_company_fallback_history(
    conn: sqlite3.Connection,
    company_id: int,
    exclude_item_id: int,
) -> List[Dict[str, Any]]:
    """Return synthetic sales history representing company-wide daily average, excluding the given item."""
    cur = conn.cursor()
    cur.execute(
        "SELECT sales_history FROM items WHERE company_id=? AND id != ?",
        (company_id, exclude_item_id),
    )
    rows = cur.fetchall()
    cur.close()

    date_totals: Dict[str, float] = defaultdict(float)
    date_counts: Dict[str, int] = defaultdict(int)
    for row in rows:
        raw = json.loads(row["sales_history"]) if row["sales_history"] else []
        if not isinstance(raw, list):
            continue
        for entry in raw:
            if not isinstance(entry, dict) or "date" not in entry or "sales" not in entry:
                continue
            try:
                sales = float(entry["sales"])
            except (TypeError, ValueError):
                continue
            d = str(entry["date"]).strip()
            if d:
                date_totals[d] += sales
                date_counts[d] += 1

    if not date_totals:
        return []
    return [
        {"date": d, "sales": round(date_totals[d] / date_counts[d], 2)}
        for d in sorted(date_totals)
    ]


def _load_sales_and_forecast(
    conn: sqlite3.Connection,
    item_id: int,
    current_user: User,
    days: int,
    method: str,
) -> Dict[str, Any]:
    cur = conn.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute(
            "SELECT sales_history, company_id FROM items WHERE id=? AND company_id=?",
            (item_id, current_user.company_id),
        )
    row = cur.fetchone()
    cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")

    raw_sales_history = json.loads(row["sales_history"]) if row["sales_history"] else []
    if not isinstance(raw_sales_history, list):
        raise HTTPException(status_code=400, detail="sales_history should be a list of {'date','sales'} dicts")

    cleaned = [
        x
        for x in raw_sales_history
        if isinstance(x, dict) and "date" in x and "sales" in x and isinstance(x["sales"], (int, float))
    ]
    by_day = aggregate_sales_by_day(cleaned)

    if len(by_day) == 0 and row["company_id"] is not None:
        fallback = _get_company_fallback_history(conn, row["company_id"], item_id)
        if fallback:
            logger.info("item_id=%s: cold-start, using %d company-avg points", item_id, len(fallback))
            by_day = fallback

    if method == "compare":
        return compute_forecast_compare(by_day, item_id, days)

    return compute_forecast(by_day, item_id, days, method)


@router.get("/{item_id}/forecast")
def forecast_item_demand(
    item_id: int,
    days: int = Query(7, ge=1, le=30),
    method: str = Query("auto", pattern="^(auto|prophet|sarima|mean|compare)$"),
    current_user: User = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    FORECAST_REQUESTS.inc()
    return _load_sales_and_forecast(conn, item_id, current_user, days, method)


@router.post("/forecasts/batch")
def forecast_batch(
    body: BatchForecastRequest,
    current_user: User = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    FORECAST_REQUESTS.inc()
    FORECAST_BATCH_ITEMS.observe(len(body.item_ids))
    results: Dict[str, Any] = {}
    for iid in body.item_ids:
        try:
            results[str(iid)] = _load_sales_and_forecast(conn, iid, current_user, body.days, body.method)
        except HTTPException as e:
            results[str(iid)] = {"error": e.detail, "status_code": e.status_code}
    return {"results": results}
