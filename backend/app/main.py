"""
FastAPI Application Entry Point
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import time

from app.core.config import settings
from app.core.failure_middleware import FailureSimulationMiddleware
from app.api.v1.router import api_router
from app.core.logging import logger, log_request
from app.core.log_shipper import start_log_shipper_thread, stop_log_shipper_thread
from app.middleware.api_tracker import ApiTrackerMiddleware
from app.middleware.chaos_middleware import ChaosMiddleware
from app.middleware.observation import ObservationMiddleware
from app.db.base import Base, get_engine, init_db
import app.models  # noqa: F401 - ensure models are imported for metadata


# ── Lifespan (replaces deprecated @app.on_event) ─────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup / shutdown logic."""
    # Startup
    init_db()
    Base.metadata.create_all(bind=get_engine())

    # ── Reset all toggles to OFF and flush stale data on every startup ────
    # Redis volume and PostgreSQL persist across restarts, so we must
    # explicitly reset toggles and clear old observation data to ensure
    # the UI only shows current-session logs.
    try:
        import redis as _redis_sync
        _r = _redis_sync.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True,
            socket_connect_timeout=3,
        )
        # 1. Preserve RabbitMQ publishing state across restarts.
        #    Only initialise to OFF when no key exists yet (first-ever startup).
        #    This prevents the heal-triggered restart from turning off
        #    publishing that the user explicitly enabled.
        if _r.get("crave:rabbitmq:enabled") is None:
            import os
            initial_val = "1" if os.getenv("NIRAMAY_PUBLISH_ENABLED", "").lower() == "true" else "0"
            _r.set("crave:rabbitmq:enabled", initial_val)
        # 2. Flush stale observation logs from Redis
        _r.delete("observation:logs")
        logger.info("Startup reset: RabbitMQ publishing state preserved, observation logs flushed from Redis")
    except Exception:
        pass

    # 3. Flush stale observation logs from PostgreSQL
    try:
        from app.db.base import get_session_factory
        from app.models.api_call_log import ApiCallLog
        _sf = get_session_factory()
        _db = _sf()
        try:
            deleted = _db.query(ApiCallLog).delete()
            _db.commit()
            logger.info("Startup reset: cleared %d stale api_call_logs from PostgreSQL", deleted)
        except Exception as _exc:
            _db.rollback()
            logger.warning("Startup reset: failed to clear api_call_logs: %s", _exc)
        finally:
            _db.close()
    except Exception:
        pass

    # Start log shipper AFTER toggles are reset (prevents publishing race)
    start_log_shipper_thread()

    logger.info(
        "Application starting",
        app_name=settings.APP_NAME,
        version=settings.APP_VERSION,
        debug=settings.DEBUG,
    )
    yield
    # Shutdown
    stop_log_shipper_thread()
    logger.info("Application shutting down")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    description="""
    Food Delivery API with Failure Simulation
    
    This API demonstrates various types of API failures that can occur in production:
    - Rate limiting (429)
    - Timeouts (408/504)
    - Authentication failures (401)
    - Authorization failures (403)
    - Server errors (500)
    - Service unavailable (503)
    - Bad requests (400)
    - Dependency failures (502/503/504)
    - Configuration errors (500)
    
    Use the /failure-simulator endpoints to configure and control failure injection.
    """,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# ── Middleware (LIFO: last added = outermost = first on request) ─────────────
#
# Desired request flow:
#   ObservationMiddleware  →  ApiTrackerMiddleware  →  ChaosMiddleware  →  FailureSimulationMiddleware  →  route
#
# To achieve that in Starlette's LIFO ordering, add in REVERSE order:

# 1. Innermost — FailureSimulation fires closest to the route
app.add_middleware(FailureSimulationMiddleware)

# 2. ChaosMiddleware — intercepts request/response for 23 chaos experiments
app.add_middleware(ChaosMiddleware)

# 3. ApiTracker — records in-flight requests for the developer dashboard
app.add_middleware(ApiTrackerMiddleware)

# 4. ObservationMiddleware — outermost, captures full round-trip timing & logs
app.add_middleware(ObservationMiddleware)

# Add CORS middleware (always outermost of all)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ───────────────────────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all API requests"""
    start_time = time.time()
    response = await call_next(request)
    duration = (time.time() - start_time) * 1000
    log_request(
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        duration_ms=duration,
        client_ip=request.client.host if request.client else "unknown",
    )
    return response


# ── API routers ──────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


# ── Health / Root ────────────────────────────────────────────────────────────
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "debug": settings.DEBUG,
    }


@app.get("/health/detailed")
async def detailed_health():
    """
    Detailed health reflecting actual component state.
    Returns 200 only when all components are healthy.
    Returns 503 when any component is degraded.
    Used by Niramay verification worker.
    """
    from datetime import datetime, timezone
    import redis as redis_sync

    health = {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "components": {},
    }

    # Check database
    try:
        from app.db.base import get_session_factory
        sf = get_session_factory()
        db = sf()
        try:
            db.execute("SELECT 1")
            health["components"]["database"] = "healthy"
        except Exception as e:
            health["components"]["database"] = f"unhealthy: {type(e).__name__}"
            health["status"] = "degraded"
        finally:
            db.close()
    except Exception as e:
        health["components"]["database"] = f"unhealthy: {str(e)[:50]}"
        health["status"] = "degraded"

    # Check CRAVE Redis
    try:
        r = redis_sync.Redis(
            host=settings.REDIS_HOST, port=settings.REDIS_PORT,
            db=0, socket_connect_timeout=2,
        )
        r.ping()
        health["components"]["redis"] = "healthy"
    except Exception as e:
        health["components"]["redis"] = f"unhealthy: {str(e)[:50]}"
        health["status"] = "degraded"

    # Check RabbitMQ publisher
    try:
        from app.core.log_shipper import _is_publishing_enabled
        health["components"]["rabbitmq_publisher"] = (
            "enabled" if _is_publishing_enabled() else "disabled"
        )
    except Exception:
        health["components"]["rabbitmq_publisher"] = "unknown"

    status_code = 200 if health["status"] == "healthy" else 503
    return JSONResponse(content=health, status_code=status_code)


@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "documentation": "/docs" if settings.DEBUG else None,
        "failure_simulator": "/api/v1/failure-simulator",
        "health": "/health",
    }


# ── Exception handlers ───────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Handle uncaught exceptions"""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "InternalServerError",
            "message": "An unexpected error occurred",
            "path": request.url.path,
        },
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level="info",
    )
