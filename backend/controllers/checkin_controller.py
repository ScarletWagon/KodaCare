"""
KodaCare – Check-In Controller
==================================
REST endpoints for submitting and retrieving patient check-ins.
"""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required

from backend.models.user import UserRole
from backend.services.checkin_service import CheckInService
from backend.services.auth_service import AuthService

checkin_bp = Blueprint("checkins", __name__, url_prefix="/checkins")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /checkins   (Patient only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@checkin_bp.route("", methods=["POST"])
@jwt_required()
def submit_checkin():
    """Patient submits a daily check-in."""
    claims = get_jwt()
    if claims.get("role") != UserRole.PATIENT.value:
        return jsonify({"error": "Only patients can submit check-ins."}), 403

    user_id = get_jwt_identity()
    body = request.get_json(silent=True) or {}

    try:
        doc = CheckInService.submit(user_id, body)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400

    return jsonify({"message": "Check-in submitted.", "checkin": doc}), 201


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /checkins/latest   (Partner only, protected)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@checkin_bp.route("/latest", methods=["GET"])
@jwt_required()
def get_latest_checkin():
    """Partner fetches the latest check-in from their linked patient."""
    claims = get_jwt()
    if claims.get("role") != UserRole.PARTNER.value:
        return jsonify({"error": "Only partners can view check-ins."}), 403

    user_id = get_jwt_identity()
    partner = AuthService.find_user_by_id(user_id)
    if partner is None or not partner.is_linked():
        return jsonify({"error": "You are not linked to a patient."}), 400

    patient_id = partner.linked_id
    checkin = CheckInService.get_latest(patient_id)

    return jsonify({"checkin": checkin}), 200


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /checkins/my-latest   (Patient – own latest check-in)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@checkin_bp.route("/my-latest", methods=["GET"])
@jwt_required()
def get_my_latest_checkin():
    """Patient fetches their own latest check-in (for welcome-screen tips)."""
    claims = get_jwt()
    if claims.get("role") != UserRole.PATIENT.value:
        return jsonify({"error": "Only patients can access this."}), 403

    user_id = get_jwt_identity()
    checkin = CheckInService.get_latest(user_id)

    return jsonify({"checkin": checkin}), 200
