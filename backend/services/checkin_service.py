"""
KodaCare – Check-In Service
==============================
Handles storing and retrieving daily patient check-ins.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId

from backend.services.db_manager import DatabaseManager


class CheckInService:
    """Business logic for patient check-ins."""

    COLLECTION = "checkins"

    # ── Helpers ──────────────────────────────────────────────────

    @classmethod
    def _col(cls):
        return DatabaseManager.get_instance().get_collection(cls.COLLECTION)

    # ── Public API ───────────────────────────────────────────────

    @classmethod
    def submit(cls, patient_id: str, data: dict) -> dict:
        """Store a new check-in for *patient_id*.

        Parameters
        ----------
        patient_id : str
            Hex string of the patient's ``_id``.
        data : dict
            Fields from the check-in form.

        Returns
        -------
        dict
            The inserted document (with ``_id`` as string).
        """
        doc = {
            "patient_id": ObjectId(patient_id),
            "current_feeling": data.get("currentFeeling", ""),
            "overall_health": data.get("overallHealth", ""),
            "has_rash": bool(data.get("hasRash", False)),
            "rash_details": data.get("rashDetails", ""),
            "skin_concerns": data.get("skinConcerns", ""),
            "other_symptoms": data.get("otherSymptoms", []),
            "additional_concerns": data.get("additionalConcerns", ""),
            "created_at": datetime.now(timezone.utc),
        }
        result = cls._col().insert_one(doc)
        doc["_id"] = str(result.inserted_id)
        doc["patient_id"] = patient_id
        doc["created_at"] = doc["created_at"].isoformat()
        return doc

    @classmethod
    def get_latest(cls, patient_id: str) -> Optional[dict]:
        """Return the most recent check-in for *patient_id*, or ``None``."""
        doc = cls._col().find_one(
            {"patient_id": ObjectId(patient_id)},
            sort=[("created_at", -1)],
        )
        if doc is None:
            return None
        doc["_id"] = str(doc["_id"])
        doc["patient_id"] = str(doc["patient_id"])
        doc["created_at"] = doc["created_at"].isoformat()
        return doc
