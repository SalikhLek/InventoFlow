import time
import uuid

import structlog

log = structlog.get_logger("http")


def _get_header(scope: dict, name: bytes) -> str | None:
    for k, v in scope.get("headers") or []:
        if k.lower() == name.lower():
            return v.decode("latin-1")
    return None


class RequestContextMiddleware:
    """Pure ASGI middleware — avoids BaseHTTPMiddleware thread pool (fixes sqlite3 thread errors)."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = _get_header(scope, b"x-request-id") or str(uuid.uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(request_id=request_id)
        start = time.perf_counter()
        path = scope.get("path", "")
        method = scope.get("method", "")
        status_holder: dict[str, int | None] = {"code": None}

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                status_holder["code"] = message["status"]
                headers = list(message.get("headers") or [])
                headers.append([b"x-request-id", request_id.encode("latin-1")])
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception:
            duration_ms = (time.perf_counter() - start) * 1000
            log.error("request_failed", path=path, method=method, duration_ms=round(duration_ms, 2))
            raise
        else:
            duration_ms = (time.perf_counter() - start) * 1000
            code = status_holder["code"]
            if code is not None:
                log.info(
                    "request",
                    path=path,
                    method=method,
                    status_code=code,
                    duration_ms=round(duration_ms, 2),
                )
        finally:
            structlog.contextvars.clear_contextvars()
