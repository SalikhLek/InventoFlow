import logging
import sqlite3
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import get_current_user
from core.database import get_db
from observability.metrics import FORECAST_BATCH_ITEMS, FORECAST_REQUESTS
from schemas import BatchForecastRequest, User
from services.forecast.engine import compute_forecast, compute_forecast_compare

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["forecast"])


def _get_company_fallback_history(
    conn: sqlite3.Connection,
    company_id: int,
    exclude_item_id: int,
) -> List[Dict[str, Any]]:
    """Company-wide daily average sales (excluding the given item) for cold-start."""
    cur = conn.cursor()
    cur.execute(
        """
        SELECT DATE(transaction_date) as date, SUM(quantity) as sales, COUNT(DISTINCT item_id) as item_count
        FROM transactions
        WHERE company_id=? AND item_id != ? AND transaction_type='sell'
        GROUP BY DATE(transaction_date)
        ORDER BY DATE(transaction_date)
        """,
        (company_id, exclude_item_id),
    )
    rows = cur.fetchall()
    cur.close()

    if not rows:
        return []
    return [
        {"date": r["date"], "sales": round(r["sales"] / max(r["item_count"], 1), 2)}
        for r in rows
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
        cur.execute("SELECT company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute(
            "SELECT company_id FROM items WHERE id=? AND company_id=?",
            (item_id, current_user.company_id),
        )
    row = cur.fetchone()
    if not row:
        cur.close()
        raise HTTPException(status_code=404, detail="Item not found")

    company_id = row["company_id"]

    # Read sales from transactions table (sell transactions grouped by date)
    cur.execute(
        """
        SELECT DATE(transaction_date) as date, SUM(quantity) as sales
        FROM transactions
        WHERE item_id=? AND transaction_type='sell'
        GROUP BY DATE(transaction_date)
        ORDER BY DATE(transaction_date)
        """,
        (item_id,),
    )
    tx_rows = cur.fetchall()
    cur.close()

    by_day = [{"date": r["date"], "sales": r["sales"]} for r in tx_rows]

    if len(by_day) == 0 and company_id is not None:
        fallback = _get_company_fallback_history(conn, company_id, item_id)
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
