from typing import Any, Dict, List

import numpy as np
from statsmodels.tsa.arima.model import ARIMA

try:
    from prophet import Prophet
    import pandas as pd  # noqa: F401

    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False


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
    """
    sales_history must already be aggregated by day (one row per date).
    """
    if not isinstance(sales_history, list):
        raise ValueError("sales_history should be a list")

    cleaned = _clean_sales_history(sales_history)
    if len(cleaned) == 0:
        return {
            "item_id": item_id,
            "forecast": [0 for _ in range(days)],
            "lower": [0] * days,
            "upper": [0] * days,
            "used_method": "mean",
        }

    def mean_forecast() -> Dict[str, Any]:
        avg_sales = int(round(sum(x["sales"] for x in cleaned) / max(1, len(cleaned))))
        return {
            "item_id": item_id,
            "forecast": [avg_sales for _ in range(days)],
            "lower": [max(0, int(avg_sales * 0.8)) for _ in range(days)],
            "upper": [int(avg_sales * 1.2) for _ in range(days)],
            "used_method": "mean",
        }

    selected = method
    if method == "auto":
        selected = "prophet" if PROPHET_AVAILABLE else "arima"

    if selected == "prophet" and PROPHET_AVAILABLE:
        try:
            import pandas as pd

            df = pd.DataFrame(cleaned)
            df["ds"] = pd.to_datetime(df["date"])
            df["y"] = df["sales"]
            prophet_df = df[["ds", "y"]].sort_values("ds")
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
            }
        except Exception:
            return mean_forecast()

    if selected == "arima":
        try:
            series = np.array([x["sales"] for x in cleaned], dtype=float)
            if len(series) < 3:
                return mean_forecast()
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
            }
        except Exception:
            return mean_forecast()

    return mean_forecast()
