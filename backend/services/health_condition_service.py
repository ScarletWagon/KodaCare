"""
KodaCare – HealthConditionService
=====================================
Service layer for the Health Horizon — the set of Condition Cards
that represent a patient's tracked conditions.

The key method is ``find_or_create()``: given a user and a
condition name from Gemini, it either returns the existing card
or creates a brand-new one.  In both cases it increments the
``log_count`` and bumps ``last_reported``.

Usage
-----
>>> svc = HealthConditionService()
>>> card, is_new = svc.find_or_create(user_id, "Headache")
>>> print(card.log_count, is_new)
1 True
>>> card2, is_new2 = svc.find_or_create(user_id, "headache")
>>> print(card2.log_count, is_new2)
2 False
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional, Tuple

from bson import ObjectId

from backend.entities.health_condition import (
    ConditionStatus,
    HealthCondition,
)
from backend.services.db_manager import DatabaseManager


class HealthConditionService:
    """CRUD + upsert service for Health Horizon condition cards."""

    def __init__(self) -> None:
        self._collection = DatabaseManager.get_instance().get_collection(
            HealthCondition.COLLECTION
        )
        # Ensure a unique-ish index so the same user can't get two
        # cards with the same normalised name (race-condition guard).
        self._collection.create_index(
            [("user_id", 1), ("condition_name", 1)],
            unique=True,
            name="uq_user_condition",
        )

    # ── Core: find-or-create (★ Task 3 entry-point) ─────────────

    def find_or_create(
        self,
        user_id: str,
        condition_name: str,
    ) -> Tuple[HealthCondition, bool]:
        """Look up an existing condition card or create a new one.

        The condition name is **normalised to title-case** before
        querying, so ``"headache"``, ``"Headache"``, and ``"HEADACHE"``
        all map to the same card.

        Regardless of whether the card already existed:
        - ``log_count`` is incremented by 1.
        - ``last_reported`` is set to now.
        - If the card was previously *resolved*, it is automatically
          re-activated (a recurring condition).

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        condition_name : str
            The condition name returned by Gemini.

        Returns
        -------
        tuple[HealthCondition, bool]
            ``(card, is_new)`` — ``is_new`` is ``True`` when a brand-
            new card was just created; ``False`` when an existing
            card was found and updated.
        """
        normalised = condition_name.strip().title()
        now = datetime.now(timezone.utc)

        # Try to find an existing card
        doc = self._collection.find_one({
            "user_id": ObjectId(user_id),
            "condition_name": normalised,
        })

        if doc is not None:
            # ── Existing card → append (update) ──────────────────
            card = HealthCondition.from_dict(doc)
            card.record_new_log()

            # Auto-reactivate if it was resolved — the patient is
            # reporting this condition again.
            if card.status == ConditionStatus.RESOLVED:
                card.reactivate()
                print(
                    f"[HealthConditionService] 🔄 Reactivated "
                    f"'{card.condition_name}' for user {user_id}"
                )

            self._collection.update_one(
                {"_id": ObjectId(card.id)},
                {"$set": {
                    "log_count": card.log_count,
                    "last_reported": card.last_reported,
                    "status": card.status.value,
                    "updated_at": card.updated_at,
                }},
            )
            print(
                f"[HealthConditionService] 📎 Appended log #{card.log_count} "
                f"to existing card '{card.condition_name}' for user {user_id}"
            )
            return card, False

        # ── New condition → create card ──────────────────────────
        card = HealthCondition(
            user_id=user_id,
            condition_name=normalised,
            status=ConditionStatus.ACTIVE,
            log_count=1,
            first_reported=now,
            last_reported=now,
        )
        result = self._collection.insert_one(card.to_dict())
        card.id = str(result.inserted_id)
        print(
            f"[HealthConditionService] 🆕 Created new card "
            f"'{card.condition_name}' for user {user_id} "
            f"(id={card.id})"
        )
        return card, True

    # ── Read ─────────────────────────────────────────────────────

    def get_conditions_for_user(
        self,
        user_id: str,
        status: Optional[ConditionStatus] = None,
    ) -> List[HealthCondition]:
        """Fetch all condition cards for a patient.

        Sorted by ``last_reported`` descending (most recent first).

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        status : ConditionStatus, optional
            If provided, filter to only active or only resolved cards.
            If ``None``, return all.

        Returns
        -------
        list[HealthCondition]
        """
        query: dict = {"user_id": ObjectId(user_id)}
        if status is not None:
            query["status"] = status.value
        cursor = (
            self._collection
            .find(query)
            .sort("last_reported", -1)
        )
        return [HealthCondition.from_dict(doc) for doc in cursor]

    def get_condition_by_id(
        self, condition_id: str,
    ) -> Optional[HealthCondition]:
        """Fetch a single condition card by ``_id``."""
        doc = self._collection.find_one({"_id": ObjectId(condition_id)})
        if doc is None:
            return None
        return HealthCondition.from_dict(doc)

    def get_condition_by_name(
        self,
        user_id: str,
        condition_name: str,
    ) -> Optional[HealthCondition]:
        """Fetch a condition card by user + name (title-case normalised)."""
        normalised = condition_name.strip().title()
        doc = self._collection.find_one({
            "user_id": ObjectId(user_id),
            "condition_name": normalised,
        })
        if doc is None:
            return None
        return HealthCondition.from_dict(doc)

    def count_conditions_for_user(
        self,
        user_id: str,
        status: Optional[ConditionStatus] = None,
    ) -> int:
        """Count condition cards for a patient."""
        query: dict = {"user_id": ObjectId(user_id)}
        if status is not None:
            query["status"] = status.value
        return self._collection.count_documents(query)

    # ── Update ───────────────────────────────────────────────────

    def resolve_condition(self, condition_id: str) -> Optional[HealthCondition]:
        """Mark a condition as resolved.

        Returns the updated card, or ``None`` if not found.
        """
        card = self.get_condition_by_id(condition_id)
        if card is None:
            return None
        card.resolve()
        self._collection.update_one(
            {"_id": ObjectId(card.id)},
            {"$set": {
                "status": card.status.value,
                "updated_at": card.updated_at,
            }},
        )
        return card

    # ── Delete ───────────────────────────────────────────────────

    def delete_condition(self, condition_id: str) -> bool:
        """Delete a single condition card.  Returns ``True`` if removed."""
        result = self._collection.delete_one({"_id": ObjectId(condition_id)})
        return result.deleted_count > 0

    def delete_all_for_user(self, user_id: str) -> int:
        """Delete all condition cards for a patient.  Returns count."""
        result = self._collection.delete_many({"user_id": ObjectId(user_id)})
        return result.deleted_count

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return "<HealthConditionService>"
