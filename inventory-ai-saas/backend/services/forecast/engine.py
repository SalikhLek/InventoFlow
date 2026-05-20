import logging
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

from ._utils import clean_sales_history
from ._prophet import PROPHET_MIN_POINTS, compute_prophet
from ._sarima import SARIMA_MIN_POINTS, compute_sarima
from ._ewm import compute_ewm

logger = logging.getLogger(__name__)

_AUTO_PROPHET_MIN = PROPHET_MIN_POINTS   # 20
_AUTO_SARIMA_MIN = 10


def _no_data(item_id: int, days: int) -> Dict[str, Any]:
    return {
        "item_id": item_id,
        "forecast": [0] * days,
        "lower": [0] * days,
        "upper": [0] * days,
        "used_method": "mean",
        "has_data": False,
    }


def compute_forecast(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
    method: str,
) -> Dict[str, Any]:
    cleaned = clean_sales_history(sales_history)
    if not cleaned:
        return _no_data(item_id, days)

    n = len(cleaned)

    if method == "auto":
        if n >= _AUTO_PROPHET_MIN:
            result = compute_prophet(sales_history, item_id, days)
            if result:
                return result
            logger.info("item_id=%s: auto falling back from prophet to sarima (%d pts)", item_id, n)
        if n >= _AUTO_SARIMA_MIN:
            return compute_sarima(sales_history, item_id, days)
        return compute_ewm(sales_history, item_id, days)

    if method == "prophet":
        result = compute_prophet(sales_history, item_id, days)
        if result:
            return result
        logger.warning("item_id=%s: prophet unavailable/insufficient, falling back to sarima", item_id)
        return compute_sarima(sales_history, item_id, days)

    if method == "sarima":
        return compute_sarima(sales_history, item_id, days)

    # method == "mean"
    return compute_ewm(sales_history, item_id, days)


def compute_forecast_compare(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
) -> Dict[str, Any]:
    cleaned = clean_sales_history(sales_history)
    if not cleaned:
        empty = {"forecast": [0] * days, "lower": [0] * days, "upper": [0] * days}
        return {
            "item_id": item_id,
            "has_data": False,
            "prophet": {**empty, "used_method": "mean"},
            "sarima": {**empty, "used_method": "mean"},
        }

    def _run_prophet():
        result = compute_prophet(sales_history, item_id, days)
        return result if result else compute_ewm(sales_history, item_id, days)

    def _run_sarima():
        return compute_sarima(sales_history, item_id, days)

    with ThreadPoolExecutor(max_workers=2) as executor:
        f_prophet = executor.submit(_run_prophet)
        f_sarima = executor.submit(_run_sarima)
        prophet_result = f_prophet.result()
        sarima_result = f_sarima.result()

    def _strip(r: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "forecast": r["forecast"],
            "lower": r["lower"],
            "upper": r["upper"],
            "used_method": r["used_method"],
        }

    return {
        "item_id": item_id,
        "has_data": True,
        "prophet": _strip(prophet_result),
        "sarima": _strip(sarima_result),
    }
