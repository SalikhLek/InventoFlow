import numpy as np
from typing import Any, Dict, List

from ._utils import clean_sales_history, linear_trend, widening_intervals

# Minimum span for decay window — captures ~2 weeks of recent behaviour
_DECAY_SPAN = 14


def compute_ewm(
    sales_history: List[Dict[str, Any]],
    item_id: int,
    days: int,
) -> Dict[str, Any]:
    """
    Exponentially-weighted mean with linear trend.
    Recent points have higher weight (alpha = 2/(span+1)).
    Replaces the old flat-mean approach.
    """
    cleaned = clean_sales_history(sales_history)
    if not cleaned:
        return {
            "item_id": item_id,
            "forecast": [0] * days,
            "lower": [0] * days,
            "upper": [0] * days,
            "used_method": "mean",
            "has_data": False,
        }

    vals = np.array([x["sales"] for x in cleaned], dtype=float)
    n = len(vals)

    span = min(n, _DECAY_SPAN)
    alpha = 2.0 / (span + 1)
    # Weights: oldest = (1-alpha)^(n-1), newest = 1
    weights = np.array([(1 - alpha) ** (n - 1 - i) for i in range(n)])
    weights /= weights.sum()

    level = float(np.dot(weights, vals))

    # Trend from recent window (last span points) — capped to avoid extrapolation
    recent = vals[-span:]
    slope = linear_trend(recent) if len(recent) >= 5 else 0.0
    max_slope = max(level * 0.05, 0.1)
    slope = float(np.clip(slope, -max_slope, max_slope))

    fc = np.array([max(0.0, level + slope * (i + 1)) for i in range(days)])

    # Weighted standard deviation for confidence intervals
    weighted_var = float(np.dot(weights, (vals - level) ** 2))
    std = float(np.sqrt(weighted_var)) if weighted_var > 0 else float(np.std(vals)) * 0.2 + 0.5

    lower, upper = widening_intervals(fc, std)
    return {
        "item_id": item_id,
        "forecast": [max(0, int(round(v))) for v in fc],
        "lower": lower,
        "upper": upper,
        "used_method": "mean",
        "has_data": True,
    }
