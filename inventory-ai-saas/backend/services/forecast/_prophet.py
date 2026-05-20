import logging
from typing import Any, Dict, List, Optional

from ._utils import clean_sales_history

logger = logging.getLogger(__name__)

# Require enough data for Prophet to learn weekly patterns + some trend
PROPHET_MIN_POINTS = 20

try:
    from prophet import Prophet
    import pandas as pd

    _PROPHET_AVAILABLE = True
except ImportError:
    _PROPHET_AVAILABLE = False


def prophet_available() -> bool:
    return _PROPHET_AVAILABLE


def compute_prophet(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
) -> Optional[Dict[str, Any]]:
    """
    Returns None when Prophet is unavailable or data is insufficient —
    caller is responsible for fallback.
    """
    if not _PROPHET_AVAILABLE:
        return None

    cleaned = clean_sales_history(sales_history)
    if len(cleaned) < PROPHET_MIN_POINTS:
        logger.info(
            "item_id=%s: %d pts < %d required for prophet",
            item_id, len(cleaned), PROPHET_MIN_POINTS,
        )
        return None

    try:
        df = pd.DataFrame(cleaned)
        df["ds"] = pd.to_datetime(df["date"])
        df["y"] = df["sales"].astype(float)
        prophet_df = df[["ds", "y"]].sort_values("ds").drop_duplicates("ds")

        # Scale y so Prophet's internal optimiser works on ~O(1) values
        y_scale = float(prophet_df["y"].mean()) or 1.0
        prophet_df = prophet_df.copy()
        prophet_df["y"] = prophet_df["y"] / y_scale

        n = len(prophet_df)
        m = Prophet(
            yearly_seasonality=(n >= 365),
            weekly_seasonality=(n >= 14),
            daily_seasonality=False,
            # Lower changepoint sensitivity — prevents overfitting on short series
            changepoint_prior_scale=0.1,
            # Softer seasonality prior — avoids wild swings on sparse data
            seasonality_prior_scale=5.0,
            interval_width=0.9,
        )
        m.add_country_holidays(country_name="KZ")
        m.fit(prophet_df)

        future = m.make_future_dataframe(periods=days, freq="D")
        future = future[future["ds"] > prophet_df["ds"].max()].head(days)
        forecast = m.predict(future)

        def _unscale(col: str) -> list:
            return [max(0, int(round(v * y_scale))) for v in forecast[col].values]

        return {
            "item_id": item_id,
            "forecast": _unscale("yhat"),
            "lower": _unscale("yhat_lower"),
            "upper": _unscale("yhat_upper"),
            "used_method": "prophet",
            "has_data": True,
        }
    except Exception as exc:
        logger.warning("item_id=%s: prophet failed (%s)", item_id, exc)
        return None
