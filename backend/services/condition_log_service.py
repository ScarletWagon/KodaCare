# filepath: /Users/gurpreet/Downloads/projects/2026-Hackfax-PatriotHacks/backend/services/condition_log_service.py
"""
KodaCare – ConditionLogService
==================================
CRUD service for ConditionLog entities.  Handles creating logs from
Gemini output, fetching logs for a patient, and fetching logs for
a partner's linked patient.
"""

from __future__ import annotations

from typing import List, Optional

from bson import ObjectId

from backend.entities.condition_log import ConditionLog, InputMode
from backend.services.db_manager import DatabaseManager


class ConditionLogService:
    """Service layer for condition log persistence and retrieval."""

    def __init__(self) -> None:
        self._collection = DatabaseManager.get_instance().get_collection(
            ConditionLog.COLLECTION
        )

    # ── Create ───────────────────────────────────────────────────

    def create_from_gemini_result(
        self,
        user_id: str,
        result: dict,
        input_mode: InputMode = InputMode.TEXT,
        condition_id: Optional[str] = None,
    ) -> ConditionLog:
        """Persist a new condition log from Gemini's structured output.

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        result : dict
            The parsed JSON from Gemini, containing ``condition_name``,
            ``extracted_data``, and ``mascot_response``.
        input_mode : InputMode
            How the data was received.
        condition_id : str, optional
            The ``_id`` of the parent ``HealthCondition`` card.
            When provided the log is linked to the Health Horizon.

        Returns
        -------
        ConditionLog
            The newly created and persisted log entry.
        """
        extracted = result.get("extracted_data", {})
        log = ConditionLog(
            user_id=user_id,
            condition_name=result.get("condition_name", ""),
            pain_level=extracted.get("pain_level", 0),
            location=extracted.get("location", []),
            details=extracted.get("details", ""),
            symptom_timestamp=extracted.get("timestamp", ""),
            input_mode=input_mode,
            mascot_response=result.get("mascot_response", ""),
            mascot_notes=extracted.get("mascot_notes", []),
            condition_id=condition_id,
        )
        insert_result = self._collection.insert_one(log.to_dict())
        log.id = str(insert_result.inserted_id)
        return log

    # ── Read ─────────────────────────────────────────────────────

    def get_logs_for_user(
        self,
        user_id: str,
        limit: int = 50,
        skip: int = 0,
    ) -> List[ConditionLog]:
        """Fetch condition logs for a patient, newest first.

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        limit : int
            Max results to return.  Default 50.
        skip : int
            Number of results to skip (for pagination).

        Returns
        -------
        list[ConditionLog]
        """
        cursor = (
            self._collection
            .find({"user_id": ObjectId(user_id)})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [ConditionLog.from_dict(doc) for doc in cursor]

    def count_logs_for_user(self, user_id: str) -> int:
        """Count total logs for a patient."""
        return self._collection.count_documents({"user_id": ObjectId(user_id)})

    def get_log_by_id(self, log_id: str) -> Optional[ConditionLog]:
        """Fetch a single log by its ``_id``."""
        doc = self._collection.find_one({"_id": ObjectId(log_id)})
        if doc is None:
            return None
        return ConditionLog.from_dict(doc)

    def get_logs_for_condition(
        self,
        condition_id: str,
        limit: int = 50,
        skip: int = 0,
    ) -> List[ConditionLog]:
        """Fetch logs linked to a specific HealthCondition card.

        Returns newest first.
        """
        cursor = (
            self._collection
            .find({"condition_id": ObjectId(condition_id)})
            .sort("created_at", -1)
            .skip(skip)
            .limit(limit)
        )
        return [ConditionLog.from_dict(doc) for doc in cursor]

    # ── Delete ───────────────────────────────────────────────────

    def delete_log(self, log_id: str) -> bool:
        """Delete a single condition log.  Returns ``True`` if removed."""
        result = self._collection.delete_one({"_id": ObjectId(log_id)})
        return result.deleted_count > 0

    def delete_all_for_user(self, user_id: str) -> int:
        """Delete all logs for a patient.  Returns count deleted."""
        result = self._collection.delete_many({"user_id": ObjectId(user_id)})
        return result.deleted_count

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return "<ConditionLogService>"
