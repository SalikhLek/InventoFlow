import logging
import sys
import warnings

import structlog

from core.config import settings


def _silence_forecast_library_noise() -> None:
    """Prophet/CmdStanPy print MCMC progress and warnings to the root logger by default."""
    for name in ("cmdstanpy", "prophet", "stan"):
        logging.getLogger(name).setLevel(logging.WARNING)
    warnings.filterwarnings("ignore", message=r".*n_changepoints.*")


def setup_logging() -> None:
    level = getattr(logging, settings.log_level, logging.INFO)
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=False),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(level),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )
    _silence_forecast_library_noise()
