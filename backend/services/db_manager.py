"""
KodaCare – Database Manager (Singleton)
==========================================
Thread-safe Singleton that wraps the PyMongo client.  Every part of
the application that needs the database should call:

    db = DatabaseManager.get_instance().get_database()

The first call lazily creates the connection; all subsequent calls
return the same ``DatabaseManager`` instance.
"""

from __future__ import annotations

import threading
from typing import Optional

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.errors import ConnectionFailure

from backend.config import Config


class DatabaseManager:
    """Singleton manager for the MongoDB connection.

    Usage
    -----
    >>> db_manager = DatabaseManager.get_instance()
    >>> db = db_manager.get_database()          # pymongo Database object
    >>> users = db["users"]                      # Collection handle
    """

    # ── Singleton plumbing ───────────────────────────────────────
    _instance: Optional["DatabaseManager"] = None
    _lock: threading.Lock = threading.Lock()

    def __new__(cls, *args, **kwargs) -> "DatabaseManager":
        """Ensure only one instance is ever created (double-check lock)."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    instance = super().__new__(cls)
                    instance._initialised = False
                    cls._instance = instance
        return cls._instance

    def __init__(self) -> None:
        """Lazily initialise the MongoDB client on first access."""
        if self._initialised:
            return

        self._mongo_uri: str = Config.MONGO_URI
        self._database_name: str = Config.DATABASE_NAME
        self._client: Optional[MongoClient] = None
        self._database: Optional[Database] = None
        self._initialised = True

    # ── Public API ───────────────────────────────────────────────

    @classmethod
    def get_instance(cls) -> "DatabaseManager":
        """Return the singleton ``DatabaseManager`` instance."""
        return cls()

    def connect(self) -> Database:
        """Open the MongoDB connection and return the Database handle.

        Raises ``ConnectionFailure`` if the server is unreachable.
        """
        if self._client is None:
            self._client = MongoClient(
                self._mongo_uri,
                serverSelectionTimeoutMS=5000,  # fail fast (5 s)
            )
            # Force a round-trip to verify the server is alive
            self._client.admin.command("ping")
            self._database = self._client[self._database_name]
            print(f"[DatabaseManager] ✅ Connected to MongoDB – db: {self._database_name}")
        return self._database

    def get_database(self) -> Database:
        """Return the active Database, connecting first if necessary."""
        if self._database is None:
            return self.connect()
        return self._database

    def get_collection(self, collection_name: str):
        """Shortcut to grab a collection handle.

        Parameters
        ----------
        collection_name : str
            Name of the MongoDB collection.

        Returns
        -------
        pymongo.collection.Collection
        """
        return self.get_database()[collection_name]

    def close(self) -> None:
        """Gracefully close the MongoDB connection."""
        if self._client:
            self._client.close()
            self._client = None
            self._database = None
            print("[DatabaseManager] 🔌 Connection closed.")

    def is_connected(self) -> bool:
        """Return ``True`` if the client can reach the server."""
        if self._client is None:
            return False
        try:
            self._client.admin.command("ping")
            return True
        except ConnectionFailure:
            return False

    # ── Testing helper ───────────────────────────────────────────

    @classmethod
    def _reset(cls) -> None:
        """Destroy the singleton (for unit-testing only)."""
        with cls._lock:
            if cls._instance and cls._instance._client:
                cls._instance._client.close()
            cls._instance = None

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        status = "connected" if self.is_connected() else "disconnected"
        return f"<DatabaseManager uri={self._mongo_uri!r} status={status}>"
