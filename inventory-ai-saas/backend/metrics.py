from prometheus_client import Counter, Histogram

FORECAST_REQUESTS = Counter(
    "inventory_forecast_requests_total",
    "Number of forecast API invocations (single or batch endpoint)",
)

FORECAST_BATCH_ITEMS = Histogram(
    "inventory_forecast_batch_item_count",
    "Number of item_ids in a batch forecast request",
    buckets=(1, 2, 5, 10, 25, 50, 100, 200),
)
