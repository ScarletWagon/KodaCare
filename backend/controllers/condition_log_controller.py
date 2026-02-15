# filepath: /Users/gurpreet/Downloads/projects/2026-Hackfax-PatriotHacks/backend/controllers/condition_log_controller.py
"""
KodaCare – Condition Log Controller (Blueprint)
===================================================
Exposes endpoints for viewing and managing condition logs:

    GET /api/logs           – Patient's own logs (paginated)
    GET /api/logs/partner   – Partner views linked patient's logs
    GET /api/logs/<id>      – Single log detail
    DELETE /api/logs/<id>   – Delete a single log
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.models.user import User
from backend.services.condition_log_service import ConditionLogService
from backend.services.db_manager import DatabaseManager

logs_bp = Blueprint("logs", __name__, url_prefix="/api/logs")

_log_service = ConditionLogService()


def _get_user(user_id: str):
    """Fetch user from the users collection."""
    from bson import ObjectId
    col = DatabaseManager.get_instance().get_collection("users")
    doc = col.find_one({"_id": ObjectId(user_id)})
    if doc is None:
        return None
    return User.from_dict(doc)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/logs – Patient's own logs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@logs_bp.route("", methods=["GET"])
@jwt_required()
def get_my_logs():
    """Return the current patient's condition logs (newest first).

    Query params:
        limit (int): max results, default 50
        skip  (int): pagination offset, default 0
    """
    user_id = get_jwt_identity()
    limit = request.args.get("limit", 50, type=int)
    skip = request.args.get("skip", 0, type=int)

    logs = _log_service.get_logs_for_user(user_id, limit=limit, skip=skip)
    total = _log_service.count_logs_for_user(user_id)

    return jsonify({
        "logs": [log.to_safe_dict() for log in logs],
        "total": total,
        "limit": limit,
        "skip": skip,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/logs/partner – Partner views linked patient's logs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@logs_bp.route("/partner", methods=["GET"])
@jwt_required()
def get_partner_logs():
    """Return the linked patient's condition logs for a partner user.

    Query params:
        limit (int): max results, default 50
        skip  (int): pagination offset, default 0
    """
    partner_id = get_jwt_identity()
    partner = _get_user(partner_id)

    if partner is None:
        return jsonify({"error": "User not found."}), 404

    if partner.role.value != "partner":
        return jsonify({"error": "Only partner accounts can use this endpoint."}), 403

    if not partner.linked_id:
        return jsonify({"error": "No patient linked to this partner account."}), 400

    patient_id = partner.linked_id
    limit = request.args.get("limit", 50, type=int)
    skip = request.args.get("skip", 0, type=int)

    logs = _log_service.get_logs_for_user(patient_id, limit=limit, skip=skip)
    total = _log_service.count_logs_for_user(patient_id)

    # Also fetch the patient's email for display
    patient = _get_user(patient_id)
    patient_email = patient.email if patient else "Unknown"

    return jsonify({
        "patient_email": patient_email,
        "logs": [log.to_safe_dict() for log in logs],
        "total": total,
        "limit": limit,
        "skip": skip,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/logs/<id> – Single log detail
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@logs_bp.route("/<log_id>", methods=["GET"])
@jwt_required()
def get_log_detail(log_id: str):
    """Return a single condition log by ID."""
    user_id = get_jwt_identity()
    log = _log_service.get_log_by_id(log_id)

    if log is None:
        return jsonify({"error": "Log not found."}), 404

    # Ensure the requesting user owns this log or is linked to the owner
    if log.user_id != user_id:
        user = _get_user(user_id)
        if not user or user.linked_id != log.user_id:
            return jsonify({"error": "Access denied."}), 403

    return jsonify({"log": log.to_safe_dict()}), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  DELETE /api/logs/<id> – Delete a single log
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@logs_bp.route("/<log_id>", methods=["DELETE"])
@jwt_required()
def delete_log(log_id: str):
    """Delete a single condition log (only by the owning patient)."""
    user_id = get_jwt_identity()
    log = _log_service.get_log_by_id(log_id)

    if log is None:
        return jsonify({"error": "Log not found."}), 404

    if log.user_id != user_id:
        return jsonify({"error": "You can only delete your own logs."}), 403

    _log_service.delete_log(log_id)
    return jsonify({"message": "Log deleted."}), 200
