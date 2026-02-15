# filepath: /Users/gurpreet/Downloads/projects/2026-Hackfax-PatriotHacks/backend/entities/condition_log.py
"""
KodaCare – ConditionLog Entity
==================================
Domain object that stores a single structured health log entry
created when Gemini processes patient input and returns an
``update_condition`` action.  Lives in the ``condition_logs``
MongoDB collection, many documents per patient.

Each log captures:
- What condition / symptom
- Pain level (1-10)
- Body location(s)
- Free-text details (AI-summarised)
- When the symptom occurred
- How the input was received (text / voice / image / combo)
- Mascot notes — bullet-point summaries of "messy" extra context
  that doesn't fit the structured fields (triggers, food, meds, etc.)
- A reference back to the parent ``HealthCondition`` card
  (``condition_id``), set when the log is linked to the Health Horizon.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from bson import ObjectId


class InputMode(str, Enum):
    """How the patient provided the data."""
    TEXT = "text"
    VOICE = "voice"
    IMAGE = "image"
    TEXT_IMAGE = "text_image"
    TEXT_VOICE = "text_voice"
    VOICE_IMAGE = "voice_image"
    ALL = "all"


class ConditionLog:
    """A single structured health log entry.

    Parameters
    ----------
    user_id : str
        The patient's ``_id`` hex string.
    condition_name : str
        Short label, e.g. "Headache", "Skin Rash".
    pain_level : int
        1-10 scale.  0 means not specified.
    location : list[str]
        Body area(s) affected, e.g. ["left forearm", "lower back"].
    details : str
        AI-summarised additional info.
    symptom_timestamp : str
        ISO-8601 string of when the symptom occurred (from Gemini).
    input_mode : InputMode
        How the data was received.
    mascot_response : str
        The in-character response Barnaby gave.
    mascot_notes : list[str]
        Bullet-point summaries of extra context that doesn't fit the
        structured fields — triggers, recent food, medications,
        activities, environmental factors, etc.  Populated by Gemini.
    condition_id : Optional[str]
        The ``_id`` of the parent ``HealthCondition`` card that this
        log belongs to.  Set by the service layer when the log is
        linked to the Health Horizon.  ``None`` for legacy logs.
    _id : Optional[str]
        MongoDB document id.  ``None`` until persisted.
    created_at : Optional[datetime]
        When this log was first created.
    """

    COLLECTION: str = "condition_logs"

    def __init__(
        self,
        user_id: str,
        condition_name: str,
        pain_level: int = 0,
        location: Optional[List[str]] = None,
        details: str = "",
        symptom_timestamp: str = "",
        input_mode: InputMode = InputMode.TEXT,
        mascot_response: str = "",
        mascot_notes: Optional[List[str]] = None,
        condition_id: Optional[str] = None,
        _id: Optional[str] = None,
        created_at: Optional[datetime] = None,
    ) -> None:
        self.id: Optional[str] = _id
        self.user_id: str = user_id
        self.condition_name: str = condition_name
        self.pain_level: int = pain_level
        self.location: List[str] = location or []
        self.details: str = details
        self.symptom_timestamp: str = symptom_timestamp
        self.input_mode: InputMode = (
            InputMode(input_mode) if isinstance(input_mode, str) else input_mode
        )
        self.mascot_response: str = mascot_response
        self.mascot_notes: List[str] = mascot_notes or []
        self.condition_id: Optional[str] = condition_id
        self.created_at: datetime = created_at or datetime.now(timezone.utc)

    # ── Serialisation ────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Convert to a MongoDB-ready dictionary."""
        doc: dict = {
            "user_id": ObjectId(self.user_id),
            "condition_name": self.condition_name,
            "pain_level": self.pain_level,
            "location": self.location,
            "details": self.details,
            "symptom_timestamp": self.symptom_timestamp,
            "input_mode": self.input_mode.value,
            "mascot_response": self.mascot_response,
            "mascot_notes": self.mascot_notes,
            "condition_id": ObjectId(self.condition_id) if self.condition_id else None,
            "created_at": self.created_at,
        }
        if self.id is not None:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_dict(cls, data: dict) -> "ConditionLog":
        """Hydrate a ``ConditionLog`` from a MongoDB document."""
        return cls(
            _id=str(data["_id"]) if data.get("_id") else None,
            user_id=str(data["user_id"]) if data.get("user_id") else "",
            condition_name=data.get("condition_name", ""),
            pain_level=data.get("pain_level", 0),
            location=data.get("location", []),
            details=data.get("details", ""),
            symptom_timestamp=data.get("symptom_timestamp", ""),
            input_mode=data.get("input_mode", "text"),
            mascot_response=data.get("mascot_response", ""),
            mascot_notes=data.get("mascot_notes", []),
            condition_id=str(data["condition_id"]) if data.get("condition_id") else None,
            created_at=data.get("created_at"),
        )

    def to_safe_dict(self) -> dict:
        """JSON-safe representation for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "condition_name": self.condition_name,
            "pain_level": self.pain_level,
            "location": self.location,
            "details": self.details,
            "symptom_timestamp": self.symptom_timestamp,
            "input_mode": self.input_mode.value,
            "mascot_response": self.mascot_response,
            "mascot_notes": self.mascot_notes,
            "condition_id": self.condition_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    # ── Helpers ──────────────────────────────────────────────────

    def add_note(self, note: str) -> None:
        """Append a single mascot note to the list."""
        if note and note.strip():
            self.mascot_notes.append(note.strip())

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"<ConditionLog user={self.user_id!r} "
            f"condition={self.condition_name!r} "
            f"pain={self.pain_level}/10>"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, ConditionLog):
            return NotImplemented
        return self.id == other.id and self.user_id == other.user_id
