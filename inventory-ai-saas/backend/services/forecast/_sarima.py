import logging
import numpy as np
from typing import Any, Dict, List

import pmdarima as pm

from ._utils import clean_sales_history, widening_intervals
from ._ewm import compute_ewm

logger = logging.getLogger(__name__)

SARIMA_MIN_POINTS = 10
_SEASONAL_MIN_POINTS = 21  # need 3 full weekly cycles for seasonal component


def compute_sarima(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
) -> Dict[str, Any]:
    cleaned = clean_sales_history(sales_history)
    if len(cleaned) < SARIMA_MIN_POINTS:
        return compute_ewm(sales_history, item_id, days)

    series = np.array([x["sales"] for x in cleaned], dtype=float)
    n = len(series)
    use_seasonal = n >= _SEASONAL_MIN_POINTS

    try:
        model = pm.auto_arima(
            series,
            m=7 if use_seasonal else 1,
            seasonal=use_seasonal,
            stepwise=True,                # fast heuristic search instead of grid
            information_criterion="aic",
            suppress_warnings=True,
            error_action="ignore",
            max_p=3, max_q=3,
            max_P=2, max_Q=2,
            d=None,                       # auto-detect via ADF test
            D=None if use_seasonal else 0,
            with_oob_score=False,
        )

        fc, conf_int = model.predict(n_periods=days, return_conf_int=True, alpha=0.1)

        forecast_vals = [max(0, int(round(v))) for v in fc]
        lower = [max(0, int(round(v))) for v in conf_int[:, 0]]
        upper = [max(0, int(round(v))) for v in conf_int[:, 1]]

        order = model.order
        seasonal_order = model.seasonal_order if use_seasonal else None
        logger.info(
            "item_id=%s: SARIMA%s%s fitted on %d pts",
            item_id, order,
            seasonal_order if seasonal_order else "",
            n,
        )

        return {
            "item_id": item_id,
            "forecast": forecast_vals,
            "lower": lower,
            "upper": upper,
            "used_method": "sarima",
            "has_data": True,
        }
    except Exception as exc:
        logger.warning("item_id=%s: sarima failed (%s), falling back to ewm", item_id, exc)
        return compute_ewm(sales_history, item_id, days)
