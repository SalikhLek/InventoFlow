import logging
from typing import Any, Dict, List

import numpy as np
from statsmodels.tsa.arima.model import ARIMA

try:
    from prophet import Prophet
    import pandas as pd  # noqa: F401

    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

logger = logging.getLogger(__name__)

# Prophet needs at least this many points for a stable forecast
_PROPHET_MIN_POINTS = 14


def _clean_sales_history(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        x
        for x in raw
        if isinstance(x, dict) and "date" in x and "sales" in x and isinstance(x["sales"], (int, float))
    ]


def compute_forecast(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
    method: str,
) -> Dict[str, Any]:
    """sales_history must already be aggregated by day (one row per date)."""
    if not isinstance(sales_history, list):
        raise ValueError("sales_history should be a list")

    cleaned = _clean_sales_history(sales_history)
    if len(cleaned) == 0:
        return {
            "item_id": item_id,
            "forecast": [0] * days,
            "lower": [0] * days,
            "upper": [0] * days,
            "used_method": "mean",
            "has_data": False,
        }

    def mean_forecast() -> Dict[str, Any]:
        avg_sales = int(round(sum(x["sales"] for x in cleaned) / max(1, len(cleaned))))
        return {
            "item_id": item_id,
            "forecast": [avg_sales] * days,
            "lower": [max(0, int(avg_sales * 0.8))] * days,
            "upper": [int(avg_sales * 1.2)] * days,
            "used_method": "mean",
            "has_data": True,
        }

    selected = method
    if method == "auto":
        # Use Prophet only when there's enough data for it to be reliable
        if PROPHET_AVAILABLE and len(cleaned) >= _PROPHET_MIN_POINTS:
            selected = "prophet"
        else:
            selected = "arima"

    if selected == "prophet" and PROPHET_AVAILABLE:
        if len(cleaned) < 2:
            logger.warning("item_id=%s: not enough data for prophet (%d pts), falling back to mean", item_id, len(cleaned))
            return mean_forecast()
        try:
            import pandas as pd

            df = pd.DataFrame(cleaned)
            df["ds"] = pd.to_datetime(df["date"])
            df["y"] = df["sales"].astype(float)
            prophet_df = df[["ds", "y"]].sort_values("ds").drop_duplicates("ds")
            m = Prophet(
                yearly_seasonality=len(prophet_df) >= 730,
                weekly_seasonality=len(prophet_df) >= 14,
                daily_seasonality=False,
                interval_width=0.9,
            )
            m.fit(prophet_df)
            future = m.make_future_dataframe(periods=days, freq="D")
            future = future[future["ds"] > prophet_df["ds"].max()].head(days)
            forecast = m.predict(future)
            forecast_vals = [max(0, int(round(v))) for v in forecast["yhat"].values]
            lower = [max(0, int(round(v))) for v in forecast["yhat_lower"].values]
            upper = [max(0, int(round(v))) for v in forecast["yhat_upper"].values]
            return {
                "item_id": item_id,
                "forecast": forecast_vals,
                "lower": lower,
                "upper": upper,
                "used_method": "prophet",
                "has_data": True,
            }
        except Exception as exc:
            logger.warning("item_id=%s: prophet failed (%s), falling back to arima", item_id, exc)
            selected = "arima"

    if selected == "arima":
        series = np.array([x["sales"] for x in cleaned], dtype=float)
        if len(series) < 3:
            logger.info("item_id=%s: only %d pts, using mean instead of arima", item_id, len(series))
            return mean_forecast()
        try:
            model = ARIMA(series, order=(1, 1, 1))
            res = model.fit()
            fc = res.forecast(steps=days)
            pred = [max(0, int(round(v))) for v in fc]
            resid = res.resid if hasattr(res, "resid") else series - res.fittedvalues
            std = float(np.std(resid)) if resid is not None and len(resid) > 1 else 1.0
            z = 1.64
            lower = [max(0, int(round(v - z * std))) for v in fc]
            upper = [max(0, int(round(v + z * std))) for v in fc]
            return {
                "item_id": item_id,
                "forecast": pred,
                "lower": lower,
                "upper": upper,
                "used_method": "arima",
                "has_data": True,
            }
        except Exception as exc:
            logger.warning("item_id=%s: arima failed (%s), falling back to mean", item_id, exc)
            return mean_forecast()

    return mean_forecast()
