"""
KodaCare – HealthCondition Entity
=====================================
Domain object representing a **Condition Card** in the user's
*Health Horizon*.  There is exactly **one** ``HealthCondition``
document per distinct condition name per patient.

Each card tracks:
- The canonical condition name (normalised to title-case)
- How many individual log entries exist for this condition
- When the condition was first and last reported
- The overall status (active / resolved)

Individual symptom snapshots are stored as ``ConditionLog`` documents
that reference back to this card via ``condition_id``.

MongoDB collection: ``health_conditions``
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import List, Optional

from bson import ObjectId


class ConditionStatus(str, Enum):
    """Lifecycle status of a condition card."""
    ACTIVE = "active"
    RESOLVED = "resolved"


class HealthCondition:
    """A single Condition Card in the Health Horizon.

    Parameters
    ----------
    user_id : str
        The patient's ``_id`` hex string.
    condition_name : str
        Canonical condition label, e.g. "Headache", "Skin Rash".
        Stored in title-case for consistent matching.
    status : ConditionStatus
        Whether the condition is still active or has been resolved.
    log_count : int
        Running count of ``ConditionLog`` entries linked to this card.
    first_reported : datetime
        When the very first log for this condition was created.
    last_reported : datetime
        When the most recent log for this condition was created.
    _id : Optional[str]
        MongoDB document id.  ``None`` until first persisted.
    created_at : Optional[datetime]
        Document creation timestamp.
    updated_at : Optional[datetime]
        Last modification timestamp.
    """

    COLLECTION: str = "health_conditions"

    def __init__(
        self,
        user_id: str,
        condition_name: str,
        status: ConditionStatus = ConditionStatus.ACTIVE,
        log_count: int = 0,
        first_reported: Optional[datetime] = None,
        last_reported: Optional[datetime] = None,
        _id: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        self.id: Optional[str] = _id
        self.user_id: str = user_id
        # Normalise to title-case so "headache" and "Headache" match
        self.condition_name: str = condition_name.strip().title()
        self.status: ConditionStatus = (
            ConditionStatus(status) if isinstance(status, str) else status
        )
        self.log_count: int = log_count

        now = datetime.now(timezone.utc)
        self.first_reported: datetime = first_reported or now
        self.last_reported: datetime = last_reported or now
        self.created_at: datetime = created_at or now
        self.updated_at: datetime = updated_at or now

    # ── Serialisation ────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Convert to a MongoDB-ready dictionary."""
        doc: dict = {
            "user_id": ObjectId(self.user_id),
            "condition_name": self.condition_name,
            "status": self.status.value,
            "log_count": self.log_count,
            "first_reported": self.first_reported,
            "last_reported": self.last_reported,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id is not None:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_dict(cls, data: dict) -> "HealthCondition":
        """Hydrate a ``HealthCondition`` from a MongoDB document."""
        return cls(
            _id=str(data["_id"]) if data.get("_id") else None,
            user_id=str(data["user_id"]) if data.get("user_id") else "",
            condition_name=data.get("condition_name", ""),
            status=data.get("status", "active"),
            log_count=data.get("log_count", 0),
            first_reported=data.get("first_reported"),
            last_reported=data.get("last_reported"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def to_safe_dict(self) -> dict:
        """JSON-safe representation for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "condition_name": self.condition_name,
            "status": self.status.value,
            "log_count": self.log_count,
            "first_reported": (
                self.first_reported.isoformat() if self.first_reported else None
            ),
            "last_reported": (
                self.last_reported.isoformat() if self.last_reported else None
            ),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    # ── Mutation helpers ─────────────────────────────────────────

    def touch(self) -> None:
        """Bump ``updated_at`` to now."""
        self.updated_at = datetime.now(timezone.utc)

    def record_new_log(self) -> None:
        """Increment the log counter and update ``last_reported``."""
        self.log_count += 1
        self.last_reported = datetime.now(timezone.utc)
        self.touch()

    def resolve(self) -> None:
        """Mark the condition as resolved."""
        self.status = ConditionStatus.RESOLVED
        self.touch()

    def reactivate(self) -> None:
        """Re-open a previously resolved condition."""
        self.status = ConditionStatus.ACTIVE
        self.touch()

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"<HealthCondition user={self.user_id!r} "
            f"name={self.condition_name!r} "
            f"logs={self.log_count} "
            f"status={self.status.value!r}>"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, HealthCondition):
            return NotImplemented
        return self.id == other.id and self.user_id == other.user_id
