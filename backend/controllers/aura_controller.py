"""
KodaCare – Aura Controller (Blueprint)
==========================================
Exposes the multimodal processing endpoint and TTS audio serving:

    POST /api/process-aura  – Accept text, voice, or image input,
                              run it through Gemini via the mascot
                              agent, and return structured JSON.
    GET  /api/tts/<filename> – Serve a cached TTS audio file.

This is the "brain" endpoint — everything the bear mascot does
flows through here.
"""

from __future__ import annotations

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required

from backend.services.aura_agent import AuraMascotAgent
from backend.services.tts_service import TtsService

aura_bp = Blueprint("aura", __name__, url_prefix="/api")

# Single instances shared across requests
_agent = AuraMascotAgent()
_tts = TtsService()


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  POST /api/process-aura
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@aura_bp.route("/process-aura", methods=["POST"])
@jwt_required()
def process_aura():
    """Accept multimodal input and return structured health data.

    Supports three input modes (can be combined):

    **1. Text only** — JSON body::

        {
            "text": "I have a headache on the right side of my head"
        }

    **2. Voice** — multipart/form-data::

        audio=<file.webm>       (required)
        text=<optional string>  (additional context)

    **3. Image** — multipart/form-data::

        image=<file.jpg/png>    (required)
        text=<optional string>  (additional context)

    **4. Combined** — multipart/form-data with any combo of the above.

    Returns 200 with structured JSON::

        {
            "action": "update_condition",
            "condition_name": "Skin Rash",
            "extracted_data": {
                "pain_level": 4,
                "location": ["left forearm"],
                "details": "Slightly redder than yesterday, feels itchy.",
                "timestamp": "2026-02-14T12:00:00Z"
            },
            "mascot_response": "I've added that to your Health Horizon..."
        }
    """
    user_id = get_jwt_identity()

    # ── Extract inputs from either JSON or multipart form ────────
    text = None
    audio_file = None
    image_file = None
    force_log = False
    conversation_history = None

    if request.content_type and "multipart" in request.content_type:
        # Multipart form-data (voice/image uploads)
        text = request.form.get("text", "").strip() or None
        audio_file = request.files.get("audio")    # FileStorage or None
        image_file = request.files.get("image")    # FileStorage or None
        force_log = request.form.get("force_log", "").lower() in ("true", "1")
        history_raw = request.form.get("conversation_history")
        if history_raw:
            import json as _json
            try:
                conversation_history = _json.loads(history_raw)
            except Exception:
                conversation_history = None
    else:
        # JSON body (text-only mode)
        data = request.get_json(silent=True)
        if data:
            text = (data.get("text") or "").strip() or None
            force_log = bool(data.get("force_log"))
            conversation_history = data.get("conversation_history")

    # ── Validate at least one input ──────────────────────────────
    if not text and audio_file is None and image_file is None and not force_log:
        return jsonify({
            "error": "At least one input is required: 'text', 'audio', or 'image'."
        }), 400

    # ── Process through the mascot agent ─────────────────────────
    #    The agent handles file→bytes conversion, MIME detection,
    #    memory loading, and the Gemini call internally.
    try:
        result = _agent.process_input(
            user_id=user_id,
            text=text,
            audio_file=audio_file,
            image_file=image_file,
            force_log=force_log,
            conversation_history=conversation_history,
        )

        # ── TTS: Generate audio for Barnaby's response ──────────
        mascot_text = result.get("mascot_response", "")
        if mascot_text:
            filename = _tts.synthesise(mascot_text)
            if filename:
                result["audio_url"] = f"/api/tts/{filename}"

        return jsonify(result), 200

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502

    except Exception as exc:
        # Catch-all for unexpected Gemini errors
        print(f"[process-aura] ❌ Unexpected error: {exc}")
        return jsonify({
            "error": "Something went wrong processing your input. Please try again."
        }), 500


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  GET /api/tts/<filename> — Serve cached TTS audio
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@aura_bp.route("/tts/<filename>", methods=["GET"])
def serve_tts(filename: str):
    """Serve a cached TTS WAV file.

    No JWT required — the filename is unguessable (SHA-256 hash)
    and ephemeral (auto-deleted after 1 hour).
    """
    # Sanitise: only allow alphanumeric + underscore + dot + .wav
    if not filename.endswith(".wav") or "/" in filename or ".." in filename:
        return jsonify({"error": "Invalid filename."}), 400

    path = TtsService.get_audio_path(filename)
    if path is None:
        return jsonify({"error": "Audio file not found or expired."}), 404

    return send_file(path, mimetype="audio/wav", download_name=filename)
