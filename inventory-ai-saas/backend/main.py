import traceback

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from prometheus_fastapi_instrumentator import Instrumentator

from config import settings
from database import init_db
from logging_config import setup_logging
from middleware import RequestContextMiddleware
from routers import admin, api_keys, auth, companies, forecast, items, transactions

setup_logging()
init_db()

app = FastAPI(title="Inventory AI SaaS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestContextMiddleware)

Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": "Validation error",
            "details": exc.errors(),
            "status_code": 422,
        },
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    import structlog

    log = structlog.get_logger("app")
    log.exception("unhandled_error", path=request.url.path)
    traceback.print_exc()
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error. Please try again later.",
            "status_code": 500,
        },
    )


@app.get("/", include_in_schema=False)
def root():
    return {"status": "ok", "service": "Inventory AI SaaS", "docs": "/docs"}


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(items.router)
app.include_router(forecast.router)
app.include_router(transactions.router)
app.include_router(companies.router)
app.include_router(api_keys.router)
app.include_router(admin.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
