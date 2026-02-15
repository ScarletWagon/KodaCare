"""
KodaCare – Flask Application Factory
=======================================
Creates and configures the Flask app. Registers blueprints, JWT,
CORS, and connects to MongoDB on startup.
"""

from datetime import timedelta

from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager

from backend.config import Config
from backend.controllers.auth_controller import auth_bp
from backend.controllers.aura_controller import aura_bp
from backend.controllers.checkin_controller import checkin_bp
from backend.controllers.condition_log_controller import logs_bp
from backend.controllers.health_condition_controller import conditions_bp
from backend.services.db_manager import DatabaseManager


def create_app() -> Flask:
    """Application factory – call this to spin up the Flask server."""

    app = Flask(__name__)

    # ── Flask / JWT config ───────────────────────────────────────
    app.config["JWT_SECRET_KEY"] = Config.JWT_SECRET
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(
        hours=Config.JWT_ACCESS_TOKEN_EXPIRES_HOURS
    )

    # ── Extensions ───────────────────────────────────────────────
    CORS(app)
    JWTManager(app)

    # ── Blueprints ───────────────────────────────────────────────
    app.register_blueprint(auth_bp)
    app.register_blueprint(aura_bp)
    app.register_blueprint(checkin_bp)
    app.register_blueprint(logs_bp)
    app.register_blueprint(conditions_bp)

    # ── Database connection ──────────────────────────────────────
    db_manager = DatabaseManager.get_instance()
    try:
        db_manager.connect()
    except Exception as exc:
        print(f"[app] ⚠️  Could not connect to MongoDB: {exc}")
        print("[app]    The server will start, but DB operations will fail.")

    # ── Health-check route ───────────────────────────────────────
    @app.route("/api/health", methods=["GET"])
    def health_check():
        """Quick liveness / readiness probe."""
        db_ok = db_manager.is_connected()
        status = "healthy" if db_ok else "degraded"
        return jsonify(
            {
                "status": status,
                "service": "KodaCare API",
                "database": "connected" if db_ok else "disconnected",
            }
        ), 200 if db_ok else 503

    # ── Teardown ─────────────────────────────────────────────────
    @app.teardown_appcontext
    def _shutdown_db(exception=None):
        """Close MongoDB when the app context tears down."""
        # In production behind gunicorn this is a no-op per-request;
        # it matters mainly for clean test teardowns.
        pass

    return app
