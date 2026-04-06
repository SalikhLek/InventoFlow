import json
import sqlite3
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Query

from database import get_db
from deps import get_current_user
from metrics import FORECAST_BATCH_ITEMS, FORECAST_REQUESTS
from schemas import BatchForecastRequest, User
from services.forecast_service import compute_forecast
from services.sales_history import aggregate_sales_by_day

router = APIRouter(prefix="/items", tags=["forecast"])


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
    return compute_forecast(by_day, item_id, days, method)


@router.get("/{item_id}/forecast")
def forecast_item_demand(
    item_id: int,
    days: int = Query(7, ge=1, le=30),
    method: str = Query("auto", pattern="^(auto|prophet|arima|mean)$"),
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
