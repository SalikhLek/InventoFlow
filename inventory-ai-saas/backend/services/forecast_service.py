import logging
from typing import Any, Dict, List

import numpy as np
from statsmodels.tsa.holtwinters import ExponentialSmoothing, SimpleExpSmoothing

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


def _widening_intervals(fc: np.ndarray, std: float, z: float = 1.64) -> tuple[list, list]:
    """Confidence bands that widen with the forecast horizon."""
    lower, upper = [], []
    for i, v in enumerate(fc):
        horizon_factor = 1.0 + i * 0.12
        band = z * std * horizon_factor
        lower.append(max(0, int(round(v - band))))
        upper.append(max(0, int(round(v + band))))
    return lower, upper


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
        avg = float(sum(x["sales"] for x in cleaned)) / max(1, len(cleaned))
        std = float(np.std([x["sales"] for x in cleaned])) if len(cleaned) > 1 else avg * 0.2
        fc = np.full(days, avg)
        lower, upper = _widening_intervals(fc, std)
        return {
            "item_id": item_id,
            "forecast": [max(0, int(round(v))) for v in fc],
            "lower": lower,
            "upper": upper,
            "used_method": "mean",
            "has_data": True,
        }

    selected = method
    if method == "auto":
        if PROPHET_AVAILABLE and len(cleaned) >= _PROPHET_MIN_POINTS:
            selected = "prophet"
        elif len(cleaned) >= 3:
            selected = "arima"
        else:
            selected = "mean"

    if selected == "prophet" and PROPHET_AVAILABLE:
        if len(cleaned) < 2:
            logger.warning("item_id=%s: not enough data for prophet (%d pts), falling back to arima", item_id, len(cleaned))
            selected = "arima"
        else:
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
            logger.info("item_id=%s: only %d pts, using mean", item_id, len(series))
            return mean_forecast()
        try:
            # Holt's Exponential Smoothing captures trend better than ARIMA on sparse data.
            # Double exponential for 5+ points (no damping so trend extrapolates visibly);
            # simple exponential for 3-4 points.
            if len(series) >= 5:
                model = ExponentialSmoothing(series, trend="add", damped_trend=False)
            else:
                model = SimpleExpSmoothing(series)
            res = model.fit(smoothing_level=0.4, smoothing_trend=0.2, optimized=False)
            fc = res.forecast(steps=days)
            pred = [max(0, int(round(v))) for v in fc]
            resid = res.resid if hasattr(res, "resid") else np.zeros(1)
            std = float(np.std(resid)) if resid is not None and len(resid) > 1 else float(np.std(series)) * 0.25
            lower, upper = _widening_intervals(fc, std)
            return {
                "item_id": item_id,
                "forecast": pred,
                "lower": lower,
                "upper": upper,
                "used_method": "arima",
                "has_data": True,
            }
        except Exception as exc:
            logger.warning("item_id=%s: exponential smoothing failed (%s), falling back to mean", item_id, exc)
            return mean_forecast()

    return mean_forecast()
