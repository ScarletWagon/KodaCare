"""
KodaCare – Application Configuration
=======================================
OO Config class that loads all environment variables once and exposes
them as class-level attributes. Uses python-dotenv so a .env file at
the project root is picked up automatically.
"""

import os
from dotenv import load_dotenv

# Load .env from the project root (two levels up from this file)
load_dotenv()


class Config:
    """Centralised, immutable application configuration.

    All values are read from environment variables at import time.
    Downstream code should access them as ``Config.MONGO_URI``, etc.
    """

    # ── MongoDB ──────────────────────────────────────────────────
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/kodacare")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "kodacare")

    # ── JWT Authentication ───────────────────────────────────────
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-me")
    JWT_ACCESS_TOKEN_EXPIRES_HOURS: int = 24

    # ── Google Gemini AI ─────────────────────────────────────────
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-pro")

    # ── Flask ────────────────────────────────────────────────────
    FLASK_ENV: str = os.getenv("FLASK_ENV", "development")
    DEBUG: bool = os.getenv("FLASK_DEBUG", "False").lower() in ("1", "true")

    # Prevent instantiation – this is a pure namespace.
    def __init__(self) -> None:
        raise RuntimeError("Config is a static namespace and should not be instantiated.")

    @classmethod
    def validate(cls) -> None:
        """Raise early if critical variables are missing."""
        missing: list[str] = []

        if not cls.MONGO_URI:
            missing.append("MONGO_URI")
        if cls.JWT_SECRET in ("", "change-me"):
            # Warn, but don't block in dev
            import warnings
            warnings.warn("JWT_SECRET is not set or still default – do NOT ship this to prod.")
        if not cls.GEMINI_API_KEY:
            missing.append("GEMINI_API_KEY")

        if missing:
            raise EnvironmentError(
                f"Missing required environment variables: {', '.join(missing)}"
            )

    def __repr__(self) -> str:
        return (
            f"<Config MONGO_URI={self.MONGO_URI!r} "
            f"FLASK_ENV={self.FLASK_ENV!r}>"
        )
