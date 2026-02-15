"""
KodaCare – Auth Controller (Blueprint)
=========================================
Exposes the public authentication endpoints:

    POST /auth/register   – Create a new Patient or Partner account.
    POST /auth/login      – Verify credentials and return a JWT.
    GET  /auth/me         – Return the current user's profile (protected).

All request validation and HTTP‑level concerns live here; the actual
business logic is delegated to ``AuthService``.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from backend.models.user import UserRole
from backend.services.auth_service import AuthService

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/register
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/register", methods=["POST"])
def register():
    """Create a new user account.

    Expects JSON::

        {
            "email":           "user@example.com",
            "password":        "s3cur3P@ss!",
            "role":            "patient",              // optional – defaults to "patient"
            "security_answer": "Smith"                 // mother's maiden name
        }

    Returns 201 with the new user profile and a JWT on success.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    email = data.get("email", "").strip()
    password = data.get("password", "")
    role_str = data.get("role", "patient").strip().lower()
    security_answer = data.get("security_answer", "").strip()
    name = data.get("name", "").strip()

    # ── Validation ───────────────────────────────────────────────
    errors: list[str] = []
    if not email:
        errors.append("'email' is required.")
    if not password:
        errors.append("'password' is required.")
    elif len(password) < 6:
        errors.append("'password' must be at least 6 characters.")
    if role_str not in (UserRole.PATIENT.value, UserRole.PARTNER.value):
        errors.append(f"'role' must be '{UserRole.PATIENT.value}' or '{UserRole.PARTNER.value}'.")
    if not security_answer:
        errors.append("'security_answer' is required (mother's maiden name).")
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    # ── Create the user ──────────────────────────────────────────
    try:
        user = AuthService.create_user(
            email=email,
            plain_password=password,
            role=UserRole(role_str),
            security_answer=security_answer,
            name=name,
        )
    except ValueError as exc:
        # Duplicate email
        return jsonify({"error": str(exc)}), 409

    token = AuthService.generate_token(user)

    return jsonify({
        "message": "Account created successfully.",
        "user": user.to_safe_dict(),
        "access_token": token,
    }), 201


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/login
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate and return a JWT.

    Expects JSON::

        {
            "email":    "user@example.com",
            "password": "s3cur3P@ss!"
        }

    Returns 200 with the user profile and a JWT on success.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "'email' and 'password' are required."}), 400

    user = AuthService.authenticate(email, password)
    if user is None:
        return jsonify({"error": "Invalid email or password."}), 401

    token = AuthService.generate_token(user)

    return jsonify({
        "message": "Login successful.",
        "user": user.to_safe_dict(),
        "access_token": token,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /auth/me   (protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return the profile of the currently authenticated user.

    Requires a valid ``Authorization: Bearer <token>`` header.
    """
    user_id = get_jwt_identity()
    user = AuthService.find_user_by_id(user_id)
    if user is None:
        return jsonify({"error": "User not found."}), 404

    return jsonify({"user": user.to_safe_dict()}), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/reset-password   (public)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/reset-password", methods=["POST"])
def reset_password():
    """Reset a user's password using their security question.

    Expects JSON::

        {
            "email":           "user@example.com",
            "security_answer": "Smith",
            "new_password":    "N3wS3cur3P@ss!"
        }

    The security question for all accounts is:
    "What is your mother's maiden name?"

    Returns 200 on success with a fresh JWT so the user is
    immediately logged in.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    email = data.get("email", "").strip()
    security_answer = data.get("security_answer", "").strip()
    new_password = data.get("new_password", "")

    # ── Validation ───────────────────────────────────────────────
    errors: list[str] = []
    if not email:
        errors.append("'email' is required.")
    if not security_answer:
        errors.append("'security_answer' is required.")
    if not new_password:
        errors.append("'new_password' is required.")
    elif len(new_password) < 6:
        errors.append("'new_password' must be at least 6 characters.")
    if errors:
        return jsonify({"error": "Validation failed.", "details": errors}), 400

    try:
        user = AuthService.reset_password(
            email=email,
            security_answer=security_answer,
            new_password=new_password,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    token = AuthService.generate_token(user)

    return jsonify({
        "message": "Password reset successful.",
        "user": user.to_safe_dict(),
        "access_token": token,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/generate-link   (Patient only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/generate-link", methods=["POST"])
@jwt_required()
def generate_link():
    """Generate a 6-digit partner link code.

    **Patient only.**  The code is valid for 15 minutes.  A partner
    can redeem it via ``POST /auth/link-partner``.

    Returns 201 with ``{ "code": "123456" }`` on success.
    """
    claims = get_jwt()
    if claims.get("role") != UserRole.PATIENT.value:
        return jsonify({"error": "Only patients can generate a link code."}), 403

    user_id = get_jwt_identity()

    try:
        code = AuthService.generate_partner_code(user_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({
        "message": "Link code generated. Share it with your partner.",
        "code": code,
    }), 201


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /auth/my-code   (Patient only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/my-code", methods=["GET"])
@jwt_required()
def my_code():
    """Return the patient's current active partner code, or null."""
    claims = get_jwt()
    if claims.get("role") != UserRole.PATIENT.value:
        return jsonify({"error": "Only patients have link codes."}), 403

    user_id = get_jwt_identity()
    code = AuthService.get_active_code(user_id)

    return jsonify({"code": code}), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/unlink   (Patient only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/unlink", methods=["POST"])
@jwt_required()
def unlink():
    """Unlink the patient from their partner."""
    claims = get_jwt()
    if claims.get("role") != UserRole.PATIENT.value:
        return jsonify({"error": "Only patients can unlink."}), 403

    user_id = get_jwt_identity()

    try:
        user = AuthService.unlink_partner(user_id)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({
        "message": "Partner unlinked successfully.",
        "user": user.to_safe_dict(),
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/link-partner   (Partner only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/link-partner", methods=["POST"])
@jwt_required()
def link_partner():
    """Redeem a 6-digit code to link to a Patient.

    **Partner only.**  Expects JSON::

        { "code": "123456" }

    On success both the Patient and Partner documents are updated
    with each other's ``_id`` in ``linked_id``.
    """
    claims = get_jwt()
    if claims.get("role") != UserRole.PARTNER.value:
        return jsonify({"error": "Only partners can redeem a link code."}), 403

    data = request.get_json(silent=True)
    if not data or not data.get("code", "").strip():
        return jsonify({"error": "'code' is required."}), 400

    partner_id = get_jwt_identity()
    code = data["code"].strip()

    try:
        result = AuthService.redeem_partner_code(partner_id, code)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({
        "message": "Accounts linked successfully!",
        "patient": result["patient"].to_safe_dict(),
        "partner": result["partner"].to_safe_dict(),
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /auth/partner-login   (public – code-only partner access)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@auth_bp.route("/partner-login", methods=["POST"])
def partner_login():
    """Log a partner in using only a 6-digit link code.

    No account creation required — the system auto-creates a Partner
    account linked to the Patient who generated the code.

    Expects JSON::

        { "code": "123456" }

    Returns 200 with the partner profile and a JWT on success.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON."}), 400

    code = data.get("code", "").strip()
    if not code:
        return jsonify({"error": "'code' is required."}), 400

    try:
        result = AuthService.partner_login_with_code(code)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    partner = result["partner"]
    token = AuthService.generate_token(partner)

    return jsonify({
        "message": "Partner linked and logged in successfully!",
        "user": partner.to_safe_dict(),
        "access_token": token,
    }), 200
