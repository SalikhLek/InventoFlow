# Inventory AI SaaS

```
inventory-ai-saas/
├── backend/
│   ├── main.py          # FastAPI app (routers, middleware, /metrics)
│   ├── app.py            # re-exports `app` for `uvicorn app:app`
│   ├── config.py         # env: INVENTORY_SECRET_KEY, INVENTORY_DB_PATH, CORS_ORIGINS, LOG_LEVEL
│   ├── database.py       # SQLite, get_db(), transaction()
│   ├── deps.py           # auth dependencies
│   ├── routers/          # auth, items, forecast, transactions, companies, api_keys, admin
│   ├── services/         # forecast_service, sales_history aggregation
│   ├── repositories/     # users, transactions_repo
│   └── requirements.txt
├── frontend/
│   └── src/
└── README.md
```

- backend: Python backend service
- frontend: frontend application (put source files in `frontend/src/`)


How start the project 

BACKEND:
In terminal: `cd /Users/salikh/InventoFlow/inventory-ai-saas/backend`
`uvicorn main:app --host 0.0.0.0 --port 8000`  
(alternative: `uvicorn app:app` — same app)

- OpenAPI: `/docs`
- Prometheus metrics: `/metrics`
- JSON request logs: stdout (structured logging)

FRONTEND:
`cd /Users/salikh/InventoFlow/inventory-ai-saas/frontend`
`npm install`
`npm start`