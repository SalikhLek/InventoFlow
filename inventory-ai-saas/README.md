# Inventory AI SaaS

```
inventory-ai-saas/
├── backend/
│   ├── main.py                 # точка входа FastAPI, middleware, /metrics, подключение маршрутов
│   ├── app.py                  # re-export `app` → `uvicorn app:app`
│   ├── core/                   # конфиг, SQLite, пароли/JWT
│   │   ├── config.py           # env: INVENTORY_SECRET_KEY, INVENTORY_DB_PATH, CORS_ORIGINS, LOG_LEVEL
│   │   ├── database.py         # init_db, get_db(), transaction()
│   │   └── security.py
│   ├── observability/          # structlog, ASGI middleware, Prometheus-метрики
│   ├── schemas/                # Pydantic по доменам (auth, items, transactions, …)
│   ├── repositories/           # SQL-запросы (users, transactions)
│   ├── services/
│   │   ├── inventory/          # агрегация sales_history по дням
│   │   └── forecast/           # Prophet / ARIMA / mean
│   ├── api/
│   │   ├── deps.py             # get_current_user, require_role
│   │   └── routes/             # HTTP: auth, items, forecast, transactions, companies, api_keys, admin
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
