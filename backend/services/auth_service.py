"""
KodaCare – Authentication Service
====================================
Encapsulates all authentication logic: password hashing / verification,
JWT token generation, and user look‑up helpers.

This is a **stateless service class** — every method is a ``@staticmethod``
or ``@classmethod`` so callers never need to instantiate it.
"""

from __future__ import annotations

import random
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from flask_jwt_extended import create_access_token

from backend.config import Config
from backend.models.user import User, UserRole
from backend.services.db_manager import DatabaseManager


class AuthService:
    """Handles password security and JWT token lifecycle.

    All methods are class‑ or static‑level — no instance state is
    needed because the ``DatabaseManager`` singleton provides the
    MongoDB connection.

    Usage
    -----
    >>> hashed = AuthService.hash_password("s3cur3!")
    >>> ok     = AuthService.verify_password("s3cur3!", hashed)
    >>> token  = AuthService.generate_token(user)
    """

    # ── Collection names (single source of truth) ────────────────
    COLLECTION: str = "users"
    LINK_CODES_COLLECTION: str = "partner_codes"

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  Password helpers
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @staticmethod
    def hash_password(plain_password: str) -> str:
        """Return a bcrypt hash of *plain_password*.

        Parameters
        ----------
        plain_password : str
            The raw password supplied by the user at registration.

        Returns
        -------
        str
            A UTF‑8 encoded bcrypt hash string safe for MongoDB storage.
        """
        salt = bcrypt.gensalt(rounds=12)
        hashed = bcrypt.hashpw(plain_password.encode("utf-8"), salt)
        return hashed.decode("utf-8")

    @staticmethod
    def verify_password(plain_password: str, password_hash: str) -> bool:
        """Check *plain_password* against a stored *password_hash*.

        Parameters
        ----------
        plain_password : str
            The password the user just typed.
        password_hash : str
            The bcrypt hash previously returned by ``hash_password``.

        Returns
        -------
        bool
            ``True`` if the password matches.
        """
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            password_hash.encode("utf-8"),
        )

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  JWT helpers
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @staticmethod
    def generate_token(user: User) -> str:
        """Create a JWT access token for *user*.

        The token's ``sub`` (subject) claim is the user's MongoDB
        ``_id`` as a hex string, and it carries extra claims for
        ``email`` and ``role`` so the front‑end doesn't need an
        extra round‑trip after login.

        Parameters
        ----------
        user : User
            A hydrated ``User`` entity (must have ``id`` set).

        Returns
        -------
        str
            An encoded JWT access token.
        """
        additional_claims = {
            "email": user.email,
            "role": user.role.value,
        }
        token = create_access_token(
            identity=user.id,
            additional_claims=additional_claims,
            expires_delta=timedelta(hours=Config.JWT_ACCESS_TOKEN_EXPIRES_HOURS),
        )
        return token

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  User persistence helpers
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @classmethod
    def _get_collection(cls):
        """Return the ``users`` MongoDB collection handle."""
        return DatabaseManager.get_instance().get_collection(cls.COLLECTION)

    @classmethod
    def find_user_by_email(cls, email: str) -> Optional[User]:
        """Look up a user by email address.

        Returns
        -------
        User or None
            A hydrated ``User`` entity, or ``None`` if no match.
        """
        doc = cls._get_collection().find_one({"email": email.strip().lower()})
        if doc is None:
            return None
        return User.from_dict(doc)

    @classmethod
    def find_user_by_id(cls, user_id: str) -> Optional[User]:
        """Look up a user by their MongoDB ``_id``.

        Parameters
        ----------
        user_id : str
            Hex string of the ObjectId.

        Returns
        -------
        User or None
        """
        from bson import ObjectId

        doc = cls._get_collection().find_one({"_id": ObjectId(user_id)})
        if doc is None:
            return None
        return User.from_dict(doc)

    @classmethod
    def create_user(
        cls,
        email: str,
        plain_password: str,
        role: UserRole = UserRole.PATIENT,
        security_answer: str = "",
        name: str = "",
    ) -> User:
        """Register a brand‑new user.

        1. Hashes the password with bcrypt.
        2. Hashes the security answer with bcrypt.
        3. Inserts the document into MongoDB.
        4. Returns the hydrated ``User`` with its new ``id``.

        Raises
        ------
        ValueError
            If the email is already taken.
        ValueError
            If no security answer is provided.
        """
        if cls.find_user_by_email(email):
            raise ValueError(f"A user with email '{email}' already exists.")
        if not security_answer.strip():
            raise ValueError("Security answer is required.")

        password_hash = cls.hash_password(plain_password)
        answer_hash = cls.hash_password(security_answer.strip().lower())

        user = User(
            email=email,
            password_hash=password_hash,
            role=role,
            name=name.strip() if name else None,
            security_answer_hash=answer_hash,
        )

        result = cls._get_collection().insert_one(user.to_dict())
        user.id = str(result.inserted_id)

        return user

    @classmethod
    def authenticate(cls, email: str, plain_password: str) -> Optional[User]:
        """Validate credentials and return the user if they match.

        Parameters
        ----------
        email : str
        plain_password : str

        Returns
        -------
        User or None
            The authenticated ``User``, or ``None`` if credentials
            are invalid.
        """
        user = cls.find_user_by_email(email)
        if user is None:
            return None
        if not cls.verify_password(plain_password, user.password_hash):
            return None
        return user

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  Password reset
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @classmethod
    def reset_password(
        cls,
        email: str,
        security_answer: str,
        new_password: str,
    ) -> User:
        """Reset a user's password after verifying their security answer.

        Parameters
        ----------
        email : str
            The email of the account to reset.
        security_answer : str
            The plaintext answer to "What is your mother's maiden name?"
        new_password : str
            The new plaintext password to set.

        Returns
        -------
        User
            The updated user entity.

        Raises
        ------
        ValueError
            If the email is not found, the security answer is wrong,
            or the new password is too short.
        """
        from bson import ObjectId

        if not new_password or len(new_password) < 6:
            raise ValueError("New password must be at least 6 characters.")

        user = cls.find_user_by_email(email)
        if user is None:
            raise ValueError("No account found with that email.")

        # Verify the security answer (stored lowercase, hashed)
        if not user.security_answer_hash:
            raise ValueError("No security answer on file for this account.")
        if not cls.verify_password(security_answer.strip().lower(), user.security_answer_hash):
            raise ValueError("Security answer is incorrect.")

        # Hash the new password and update in MongoDB
        new_hash = cls.hash_password(new_password)
        cls._get_collection().update_one(
            {"_id": ObjectId(user.id)},
            {"$set": {
                "password_hash": new_hash,
                "updated_at": datetime.now(timezone.utc),
            }},
        )

        user.password_hash = new_hash
        return user

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  Partner Link helpers
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @classmethod
    def _get_link_codes_collection(cls):
        """Return the ``partner_codes`` MongoDB collection handle."""
        return DatabaseManager.get_instance().get_collection(cls.LINK_CODES_COLLECTION)

    @classmethod
    def generate_partner_code(cls, patient_id: str) -> str:
        """Generate a 6-digit link code for a Patient.

        The code is stored in the ``partner_codes`` collection and
        does **not** expire.  Any previous code for this patient is
        replaced.

        Parameters
        ----------
        patient_id : str
            The ``_id`` (hex string) of the Patient user.

        Returns
        -------
        str
            A 6-digit numeric code the Partner will enter.

        Raises
        ------
        ValueError
            If the user is not found or is not a Patient.
        """
        from bson import ObjectId

        user = cls.find_user_by_id(patient_id)
        if user is None:
            raise ValueError("User not found.")
        if user.role != UserRole.PATIENT:
            raise ValueError("Only patients can generate a link code.")

        code = "".join(random.choices(string.digits, k=6))

        col = cls._get_link_codes_collection()

        # Upsert: one active code per patient at a time
        col.update_one(
            {"patient_id": ObjectId(patient_id)},
            {
                "$set": {
                    "patient_id": ObjectId(patient_id),
                    "code": code,
                    "created_at": datetime.now(timezone.utc),
                }
            },
            upsert=True,
        )

        return code

    @classmethod
    def get_active_code(cls, patient_id: str) -> Optional[str]:
        """Return the active partner code for a Patient, or None."""
        from bson import ObjectId

        col = cls._get_link_codes_collection()
        doc = col.find_one({"patient_id": ObjectId(patient_id)})
        if doc is None:
            return None
        return doc["code"]

    @classmethod
    def redeem_partner_code(cls, partner_id: str, code: str) -> dict:
        """Redeem a 6-digit code to link a Partner to a Patient.

        1. Looks up the code in ``partner_codes``.
        2. Sets ``linked_id`` on **both** the Patient and Partner
           documents so the link is bidirectional.
        3. Keeps the code so the partner can re-login later.

        Parameters
        ----------
        partner_id : str
            The ``_id`` (hex string) of the Partner user.
        code : str
            The 6-digit code the Patient shared.

        Returns
        -------
        dict
            ``{"patient": User, "partner": User}`` after linking.

        Raises
        ------
        ValueError
            On any validation failure.
        """
        from bson import ObjectId

        # -- Validate the partner --------------------------------
        partner = cls.find_user_by_id(partner_id)
        if partner is None:
            raise ValueError("Partner user not found.")
        if partner.role != UserRole.PARTNER:
            raise ValueError("Only partners can redeem a link code.")
        if partner.is_linked():
            raise ValueError("You are already linked to a patient.")

        # -- Look up the code ------------------------------------
        col = cls._get_link_codes_collection()
        doc = col.find_one({"code": code.strip()})
        if doc is None:
            raise ValueError("Invalid link code.")

        patient_id = str(doc["patient_id"])

        # -- Validate the patient --------------------------------
        patient = cls.find_user_by_id(patient_id)
        if patient is None:
            raise ValueError("Patient not found for this code.")
        if patient.is_linked():
            raise ValueError("That patient is already linked to another partner.")

        # -- Link both users bidirectionally ---------------------
        users_col = cls._get_collection()
        users_col.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": {
                "linked_id": ObjectId(partner_id),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        users_col.update_one(
            {"_id": ObjectId(partner_id)},
            {"$set": {
                "linked_id": ObjectId(patient_id),
                "updated_at": datetime.now(timezone.utc),
            }},
        )

        # -- Return fresh copies ---------------------------------
        patient = cls.find_user_by_id(patient_id)
        partner = cls.find_user_by_id(partner_id)
        return {"patient": patient, "partner": partner}

    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    #  Partner code-only login
    # ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    @classmethod
    def partner_login_with_code(cls, code: str) -> dict:
        """Authenticate a partner using only a 6-digit link code.

        1. Looks up the code in ``partner_codes``.
        2. Finds the patient who generated it.
        3. If the patient is already linked, returns the existing
           partner (allowing re-login).
        4. Otherwise creates a new Partner user account and links
           both users bidirectionally.
        5. The code is **kept** so the partner can log in again.

        Parameters
        ----------
        code : str
            The 6-digit code the Patient shared.

        Returns
        -------
        dict
            ``{"patient": User, "partner": User}`` after linking.

        Raises
        ------
        ValueError
            On any validation failure.
        """
        from bson import ObjectId

        # -- Look up the code ------------------------------------
        col = cls._get_link_codes_collection()
        doc = col.find_one({"code": code.strip()})
        if doc is None:
            raise ValueError("Invalid link code.")

        patient_id = str(doc["patient_id"])

        # -- Validate the patient --------------------------------
        patient = cls.find_user_by_id(patient_id)
        if patient is None:
            raise ValueError("Patient not found for this code.")

        # -- If already linked, return existing partner ----------
        if patient.is_linked():
            partner = cls.find_user_by_id(patient.linked_id)
            if partner is None:
                raise ValueError("Linked partner account not found.")
            return {"patient": patient, "partner": partner}

        # -- Create a partner account ----------------------------
        partner_email = f"partner_{patient.email}"
        random_password = "".join(random.choices(string.ascii_letters + string.digits, k=24))

        existing = cls.find_user_by_email(partner_email)
        if existing:
            partner = existing
        else:
            password_hash = cls.hash_password(random_password)
            answer_hash = cls.hash_password("partner")
            partner = User(
                email=partner_email,
                password_hash=password_hash,
                role=UserRole.PARTNER,
                security_answer_hash=answer_hash,
            )
            result = cls._get_collection().insert_one(partner.to_dict())
            partner.id = str(result.inserted_id)

        # -- Link both users bidirectionally ---------------------
        users_col = cls._get_collection()
        users_col.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": {
                "linked_id": ObjectId(partner.id),
                "updated_at": datetime.now(timezone.utc),
            }},
        )
        users_col.update_one(
            {"_id": ObjectId(partner.id)},
            {"$set": {
                "linked_id": ObjectId(patient_id),
                "updated_at": datetime.now(timezone.utc),
            }},
        )

        # -- Return fresh copies ---------------------------------
        patient = cls.find_user_by_id(patient_id)
        partner = cls.find_user_by_id(partner.id)
        return {"patient": patient, "partner": partner}

    @classmethod
    def unlink_partner(cls, patient_id: str) -> User:
        """Unlink a patient from their partner.

        Clears ``linked_id`` on both users and deletes the code.
        """
        from bson import ObjectId

        patient = cls.find_user_by_id(patient_id)
        if patient is None:
            raise ValueError("User not found.")
        if patient.role != UserRole.PATIENT:
            raise ValueError("Only patients can unlink.")
        if not patient.is_linked():
            raise ValueError("You are not linked to a partner.")

        partner_id = patient.linked_id
        users_col = cls._get_collection()
        now = datetime.now(timezone.utc)

        # Clear linked_id on both users
        users_col.update_one(
            {"_id": ObjectId(patient_id)},
            {"$set": {"linked_id": None, "updated_at": now}},
        )
        users_col.update_one(
            {"_id": ObjectId(partner_id)},
            {"$set": {"linked_id": None, "updated_at": now}},
        )

        # Delete the code so a new one can be generated
        cls._get_link_codes_collection().delete_many(
            {"patient_id": ObjectId(patient_id)}
        )

        return cls.find_user_by_id(patient_id)

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return "<AuthService>"
