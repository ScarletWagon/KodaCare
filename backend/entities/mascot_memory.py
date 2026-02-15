"""
KodaCare – MascotMemory Entity
=================================
Domain object that stores per-user preferences and running memory
for the AuraMascot AI persona.  Lives in the ``mascot_memory``
MongoDB collection, one document per patient.

This is what lets the mascot feel "personalised" — it remembers the
user's name, preferred tone, known conditions, allergies, and
anything else Gemini has summarised from past conversations.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId


class PersonaPreferences:
    """User-facing persona settings.

    Parameters
    ----------
    tone : str
        The conversational tone the mascot should use.
        Examples: ``"gentle"``, ``"casual"``, ``"encouraging"``.
    name_used : str
        The name the mascot calls the user (e.g. their first name).
    mascot_name : str
        What the mascot calls itself.  Default is Barnaby.
    """

    DEFAULT_TONE: str = "gentle"
    DEFAULT_MASCOT_NAME: str = "Barnaby the Bear"

    def __init__(
        self,
        tone: str = DEFAULT_TONE,
        name_used: str = "friend",
        mascot_name: str = DEFAULT_MASCOT_NAME,
    ) -> None:
        self.tone: str = tone
        self.name_used: str = name_used
        self.mascot_name: str = mascot_name

    # ── Serialisation ────────────────────────────────────────────

    def to_dict(self) -> dict:
        return {
            "tone": self.tone,
            "name_used": self.name_used,
            "mascot_name": self.mascot_name,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PersonaPreferences":
        return cls(
            tone=data.get("tone", cls.DEFAULT_TONE),
            name_used=data.get("name_used", "friend"),
            mascot_name=data.get("mascot_name", cls.DEFAULT_MASCOT_NAME),
        )

    def __repr__(self) -> str:
        return (
            f"<PersonaPreferences tone={self.tone!r} "
            f"name={self.name_used!r} mascot={self.mascot_name!r}>"
        )


class MascotMemory:
    """Per-user memory document for the AuraMascot AI.

    Parameters
    ----------
    user_id : str
        The ``_id`` (hex string) of the patient this memory belongs to.
    persona_preferences : PersonaPreferences
        How the mascot should address and interact with this user.
    summary_memory : str
        A running Gemini-generated summary of everything the mascot
        knows about this user — conditions, preferences, allergies,
        context from past conversations.  Updated after every
        meaningful interaction.
    _id : Optional[str]
        MongoDB document id.  ``None`` until first persisted.
    created_at : Optional[datetime]
        When this memory was first created.
    updated_at : Optional[datetime]
        When this memory was last modified.
    """

    # MongoDB collection name
    COLLECTION: str = "mascot_memory"

    def __init__(
        self,
        user_id: str,
        persona_preferences: Optional[PersonaPreferences] = None,
        summary_memory: str = "",
        _id: Optional[str] = None,
        created_at: Optional[datetime] = None,
        updated_at: Optional[datetime] = None,
    ) -> None:
        self.id: Optional[str] = _id
        self.user_id: str = user_id
        self.persona_preferences: PersonaPreferences = (
            persona_preferences or PersonaPreferences()
        )
        self.summary_memory: str = summary_memory
        self.created_at: datetime = created_at or datetime.now(timezone.utc)
        self.updated_at: datetime = updated_at or datetime.now(timezone.utc)

    # ── Serialisation ────────────────────────────────────────────

    def to_dict(self) -> dict:
        """Convert to a MongoDB-ready dictionary."""
        doc: dict = {
            "user_id": ObjectId(self.user_id),
            "persona_preferences": self.persona_preferences.to_dict(),
            "summary_memory": self.summary_memory,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }
        if self.id is not None:
            doc["_id"] = ObjectId(self.id)
        return doc

    @classmethod
    def from_dict(cls, data: dict) -> "MascotMemory":
        """Hydrate a ``MascotMemory`` from a MongoDB document."""
        return cls(
            _id=str(data["_id"]) if data.get("_id") else None,
            user_id=str(data["user_id"]) if data.get("user_id") else "",
            persona_preferences=PersonaPreferences.from_dict(
                data.get("persona_preferences", {})
            ),
            summary_memory=data.get("summary_memory", ""),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
        )

    def to_safe_dict(self) -> dict:
        """JSON-safe representation for API responses."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "persona_preferences": self.persona_preferences.to_dict(),
            "summary_memory": self.summary_memory,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    # ── Helpers ──────────────────────────────────────────────────

    def touch(self) -> None:
        """Bump the ``updated_at`` timestamp to now."""
        self.updated_at = datetime.now(timezone.utc)

    def update_summary(self, new_summary: str) -> None:
        """Replace the summary memory and bump the timestamp."""
        self.summary_memory = new_summary
        self.touch()

    def update_preferences(
        self,
        tone: Optional[str] = None,
        name_used: Optional[str] = None,
        mascot_name: Optional[str] = None,
    ) -> None:
        """Selectively update persona preferences."""
        if tone is not None:
            self.persona_preferences.tone = tone
        if name_used is not None:
            self.persona_preferences.name_used = name_used
        if mascot_name is not None:
            self.persona_preferences.mascot_name = mascot_name
        self.touch()

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        summary_preview = (
            self.summary_memory[:50] + "…"
            if len(self.summary_memory) > 50
            else self.summary_memory
        )
        return (
            f"<MascotMemory user_id={self.user_id!r} "
            f"summary={summary_preview!r}>"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, MascotMemory):
            return NotImplemented
        return self.id == other.id and self.user_id == other.user_id
