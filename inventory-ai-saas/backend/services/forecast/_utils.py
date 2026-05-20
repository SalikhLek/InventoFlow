import numpy as np
from typing import Any, Dict, List, Tuple


def clean_sales_history(raw: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        x for x in raw
        if isinstance(x, dict)
        and "date" in x
        and "sales" in x
        and isinstance(x["sales"], (int, float))
    ]


def widening_intervals(fc: np.ndarray, std: float, z: float = 1.64) -> Tuple[list, list]:
    """Confidence bands that widen with forecast horizon."""
    lower, upper = [], []
    for i, v in enumerate(fc):
        band = z * std * (1.0 + i * 0.12)
        lower.append(max(0, int(round(v - band))))
        upper.append(max(0, int(round(v + band))))
    return lower, upper


def linear_trend(series: np.ndarray) -> float:
    n = len(series)
    if n < 2:
        return 0.0
    x = np.arange(n, dtype=float)
    x -= x.mean()
    y = series - series.mean()
    denom = float(np.dot(x, x))
    return float(np.dot(x, y) / denom) if denom > 0 else 0.0
