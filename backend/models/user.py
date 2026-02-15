"""
KodaCare – User Entity
========================
Domain object that represents a user in the system.  Supports two
roles: **Patient** (logs symptoms) and **Partner** (views insights
and offers support).  The ``linked_id`` field implements the
Partner-Link system by pointing one user at the other.

The class knows how to serialise itself *to* a MongoDB document and
hydrate itself *from* one, keeping the rest of the codebase free of
raw-dict manipulation.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Optional

from bson import ObjectId


# ── Role enum ────────────────────────────────────────────────────

class UserRole(str, Enum):
    """Allowed roles within the KodaCare platform."""
    PATIENT = "patient"
    PARTNER = "partner"


# ── User entity ─────────────────────────────────────────────────

class User:
    """Core user domain model.

    Parameters
    ----------
    email : str
        Unique email address (used as the login identifier).
    password_hash : str
        bcrypt hash of the user's password.
    role : UserRole
        Either ``UserRole.PATIENT`` or ``UserRole.PARTNER``.
    linked_id : Optional[str]
        The ``_id`` (as a hex string) of the partner/patient this
        user is linked to.  ``None`` when no link exists yet.
    _id : Optional[str]
        MongoDB document id (hex string).  ``None`` for objects that
        have not been persisted yet.
    created_at : Optional[datetime]
        Timestamp of account creation.
    updated_at : Optional[datetime]
        Timestamp of the last profile update.
    """

    # The security question is fixed for all users.
    SECURITY_QUESTION: str = "What is your mother's maiden name?"

    def __init__(
        self,
        email: str,
        password_hash: str,
        role: UserRole = UserRole.PATIENT,
        linked_id: Optional[str] = None,
        _id: Optional[str] = None,
        name: Optional[str] = None,
        security_answer_hash: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        self.id: Optional[str] = _id
        self.name: Optional[str] = name
        self.email: str = email.strip().lower()
        self.password_hash: str = password_hash
        self.role: UserRole = UserRole(role) if isinstance(role, str) else role
        self.linked_id: Optional[str] = linked_id
        self.security_answer_hash: Optional[str] = security_answer_hash
        self.created_at: datetime = created_at or datetime.now(timezone.utc)
        self.updated_at: datetime = updated_at or datetime.now(timezone.utc)

    # ── Serialisation ────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Convert to a MongoDB-ready dictionary.

        Includes ``_id`` only if it has been set (i.e. the document
        has been persisted at least once).
        """
        doc: dict = {
            "name": self.name,
            "email": self.email,
            "password_hash": self.password_hash,
            "role": self.role.value,
            "linked_id": ObjectId(self.linked_id) if self.linked_id else None,
            "security_answer_hash": self.security_answer_hash,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id is not None:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_dict(cls, data: dict) -> "User":
        """Hydrate a ``User`` from a MongoDB document (dict).

        Handles both ``ObjectId`` and plain-string ``_id`` fields
        gracefully.
        """
        return cls(
            _id=str(data["_id"]) if data.get("_id") else None,
            name=data.get("name"),
            email=data["email"],
            password_hash=data["password_hash"],
            role=data.get("role", UserRole.PATIENT.value),
            linked_id=str(data["linked_id"]) if data.get("linked_id") else None,
            security_answer_hash=data.get("security_answer_hash"),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    # ── Public helpers ───────────────────────────────────────────

    def to_safe_dict(self) -> dict:
        """Return a JSON-safe representation **without** the
        password hash - suitable for API responses."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role.value,
            "linked_id": self.linked_id,
            "security_question": self.SECURITY_QUESTION,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def is_linked(self) -> bool:
        """Return ``True`` if this user has an active partner link."""
        return self.linked_id is not None

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return (
            f"<User id={self.id!r} email={self.email!r} "
            f"role={self.role.value!r} linked={self.is_linked()}>"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, User):
            return NotImplemented
        return self.id == other.id and self.email == other.email
