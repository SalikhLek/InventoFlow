import logging
from concurrent.futures import ThreadPoolExecutor
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

_PROPHET_MIN_POINTS = 7


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


def _linear_trend(series: np.ndarray) -> float:
    """Return slope of OLS regression on [0,1,...,n-1] → series."""
    n = len(series)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    x -= x.mean()
    y = series - series.mean()
    denom = float(np.dot(x, x))
    return float(np.dot(x, y) / denom) if denom > 0 else 0.0


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
        vals = np.array([x["sales"] for x in cleaned], dtype=float)
        avg = float(vals.mean())
        std = float(vals.std()) if len(vals) > 1 else avg * 0.2

        # Apply linear trend only when we have enough data; cap it to avoid wild extrapolation
        slope = 0.0
        if len(vals) >= 5:
            raw_slope = _linear_trend(vals)
            max_slope = max(avg * 0.05, 0.1)
            slope = float(np.clip(raw_slope, -max_slope, max_slope))

        n = len(vals)
        # Last fitted value on the regression line (centered OLS)
        last_fitted = avg + slope * (n - 1 - (n - 1) / 2.0)
        fc = np.array([max(0.0, last_fitted + slope * (i + 1)) for i in range(days)])
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
                    weekly_seasonality=len(prophet_df) >= 7,
                    daily_seasonality=False,
                    changepoint_prior_scale=0.3,
                    seasonality_prior_scale=10.0,
                    interval_width=0.9,
                )
                m.add_country_holidays(country_name="KZ")
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
            fc = None
            resid = None

            # Holt-Winters with weekly seasonality (needs ≥14 pts and ≥2 full cycles)
            if len(series) >= 14:
                try:
                    model = ExponentialSmoothing(
                        series,
                        trend="add",
                        seasonal="add",
                        seasonal_periods=7,
                        damped_trend=False,
                    )
                    res = model.fit(optimized=True)
                    fc = res.forecast(steps=days)
                    resid = res.resid
                except Exception as exc:
                    logger.debug("item_id=%s: Holt-Winters seasonal failed (%s)", item_id, exc)

            # Holt's double exponential smoothing (trend only)
            if fc is None and len(series) >= 5:
                model = ExponentialSmoothing(series, trend="add", damped_trend=False)
                res = model.fit(optimized=True)
                fc = res.forecast(steps=days)
                resid = res.resid

            # Simple exponential smoothing + linear trend projection
            if fc is None:
                model = SimpleExpSmoothing(series)
                res = model.fit(optimized=True)
                base = res.forecast(steps=days)
                slope = _linear_trend(series)
                fc = np.array([max(0.0, base[i] + slope * (i + 1)) for i in range(days)])
                resid = res.resid

            pred = [max(0, int(round(v))) for v in fc]
            std = float(np.std(resid)) if resid is not None and len(resid) > 1 else float(np.std(series)) * 0.25
            if std == 0:
                std = float(np.std(series)) * 0.1 + 0.5
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


def compute_forecast_compare(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
) -> Dict[str, Any]:
    """Run Prophet and ARIMA concurrently and return both results for comparison."""
    if not isinstance(sales_history, list):
        raise ValueError("sales_history should be a list")

    cleaned = _clean_sales_history(sales_history)
    if len(cleaned) == 0:
        empty = {"forecast": [0] * days, "lower": [0] * days, "upper": [0] * days}
        return {
            "item_id": item_id,
            "has_data": False,
            "prophet": {**empty, "used_method": "mean"},
            "arima": {**empty, "used_method": "mean"},
        }

    def _run_prophet():
        return compute_forecast(sales_history, item_id, days, "prophet")

    def _run_arima():
        return compute_forecast(sales_history, item_id, days, "arima")

    with ThreadPoolExecutor(max_workers=2) as executor:
        future_prophet = executor.submit(_run_prophet)
        future_arima = executor.submit(_run_arima)
        prophet_result = future_prophet.result()
        arima_result = future_arima.result()

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
        "arima": _strip(arima_result),
    }
