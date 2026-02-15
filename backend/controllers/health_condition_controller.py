"""
KodaCare – Health Condition Controller (Blueprint)
=====================================================
Exposes endpoints for viewing and managing the Health Horizon
(condition cards):

    GET    /api/conditions              – Patient's condition cards
    GET    /api/conditions/partner      – Partner views linked patient's cards
    GET    /api/conditions/<id>         – Single card detail (with logs)
    PATCH  /api/conditions/<id>/resolve – Mark condition as resolved
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.entities.health_condition import ConditionStatus
from backend.models.user import User
from backend.services.condition_log_service import ConditionLogService
from backend.services.health_condition_service import HealthConditionService
from backend.services.db_manager import DatabaseManager

conditions_bp = Blueprint("conditions", __name__, url_prefix="/api/conditions")

_condition_service = HealthConditionService()
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
#  GET /api/conditions – Patient's condition cards
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@conditions_bp.route("", methods=["GET"])
@jwt_required()
def get_my_conditions():
    """Return the current patient's Health Horizon.

    Query params:
        status (str): "active" or "resolved" — filter cards.
                      Omit to return all.
    """
    user_id = get_jwt_identity()
    status_filter = request.args.get("status")

    status = None
    if status_filter in ("active", "resolved"):
        status = ConditionStatus(status_filter)

    cards = _condition_service.get_conditions_for_user(
        user_id, status=status,
    )
    total = _condition_service.count_conditions_for_user(
        user_id, status=status,
    )

    return jsonify({
        "conditions": [c.to_safe_dict() for c in cards],
        "total": total,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/conditions/partner – Partner views linked patient's cards
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@conditions_bp.route("/partner", methods=["GET"])
@jwt_required()
def get_partner_conditions():
    """Return the linked patient's condition cards for a partner."""
    partner_id = get_jwt_identity()
    partner = _get_user(partner_id)

    if partner is None:
        return jsonify({"error": "User not found."}), 404
    if partner.role.value != "partner":
        return jsonify({"error": "Only partner accounts can use this endpoint."}), 403
    if not partner.linked_id:
        return jsonify({"error": "No patient linked to this partner account."}), 400

    patient_id = partner.linked_id
    status_filter = request.args.get("status")

    status = None
    if status_filter in ("active", "resolved"):
        status = ConditionStatus(status_filter)

    cards = _condition_service.get_conditions_for_user(
        patient_id, status=status,
    )
    total = _condition_service.count_conditions_for_user(
        patient_id, status=status,
    )

    patient = _get_user(patient_id)
    patient_email = patient.email if patient else "Unknown"

    return jsonify({
        "patient_email": patient_email,
        "conditions": [c.to_safe_dict() for c in cards],
        "total": total,
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/conditions/<id> – Single card with its logs
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@conditions_bp.route("/<condition_id>", methods=["GET"])
@jwt_required()
def get_condition_detail(condition_id: str):
    """Return a single condition card and its linked logs."""
    user_id = get_jwt_identity()
    card = _condition_service.get_condition_by_id(condition_id)

    if card is None:
        return jsonify({"error": "Condition not found."}), 404

    # Access check: owner or linked partner
    if card.user_id != user_id:
        user = _get_user(user_id)
        if not user or user.linked_id != card.user_id:
            return jsonify({"error": "Access denied."}), 403

    limit = request.args.get("limit", 50, type=int)
    skip = request.args.get("skip", 0, type=int)
    logs = _log_service.get_logs_for_condition(
        condition_id, limit=limit, skip=skip,
    )

    return jsonify({
        "condition": card.to_safe_dict(),
        "logs": [log.to_safe_dict() for log in logs],
    }), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PATCH /api/conditions/<id>/resolve – Mark as resolved
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@conditions_bp.route("/<condition_id>/resolve", methods=["PATCH"])
@jwt_required()
def resolve_condition(condition_id: str):
    """Mark a condition card as resolved (only by the owning patient)."""
    user_id = get_jwt_identity()
    card = _condition_service.get_condition_by_id(condition_id)

    if card is None:
        return jsonify({"error": "Condition not found."}), 404
    if card.user_id != user_id:
        return jsonify({"error": "You can only resolve your own conditions."}), 403

    updated = _condition_service.resolve_condition(condition_id)
    return jsonify({
        "message": f"'{updated.condition_name}' marked as resolved.",
        "condition": updated.to_safe_dict(),
    }), 200
