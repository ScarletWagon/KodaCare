"""
KodaCare – AuraMascotAgent Service  (``aura_agent``)
=======================================================
OOP service that manages the Barnaby Bear mascot persona, per-user
memory, and **all** interactions with the Google Gemini AI.

This is the single "Brain" of KodaCare.  It:

* owns the mascot's personality (6-section system prompt)
* remembers user context across sessions (``MascotMemory`` CRUD)
* defines the structured JSON schema Gemini must return
* processes multimodal input (text / voice / image) → structured
  health logs persisted as ``ConditionLog`` documents

Public API
----------
>>> agent = AuraMascotAgent()
>>> # Per-user memory
>>> memory = agent.get_or_create_memory(user_id)
>>> memory = agent.update_preferences(user_id, name_used="Saleem")
>>> # System instruction for Gemini
>>> instruction = agent.generate_system_instruction(user_id)
>>> # End-to-end processing (text only)
>>> result = agent.process_input(user_id, text="My head hurts…")
>>> # End-to-end processing (file objects from Flask request)
>>> result = agent.process_input(user_id, audio_file=request.files["audio"])
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import IO, Optional, Tuple

from bson import ObjectId
from google import genai
from google.genai import types

from backend.config import Config
from backend.entities.condition_log import ConditionLog, InputMode
from backend.entities.mascot_memory import MascotMemory, PersonaPreferences
from backend.services.db_manager import DatabaseManager
from backend.services.condition_log_service import ConditionLogService
from backend.services.health_condition_service import HealthConditionService


# ── MIME helpers ─────────────────────────────────────────────────
# Used when the caller passes a file-like object and we need to
# infer the MIME type from the filename or fall back to a default.

_AUDIO_EXT_MAP: dict[str, str] = {
    ".webm": "audio/webm",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".aac": "audio/aac",
}

_IMAGE_EXT_MAP: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
}


def _mime_from_filename(filename: Optional[str], ext_map: dict[str, str], default: str) -> str:
    """Guess MIME type from a filename extension, or return *default*."""
    if not filename:
        return default
    for ext, mime in ext_map.items():
        if filename.lower().endswith(ext):
            return mime
    return default


class AuraMascotAgent:
    """Central service for the KodaCare mascot AI.

    Responsibilities
    ----------------
    1. **Memory CRUD** — create / read / update / delete the per-user
       ``MascotMemory`` document in MongoDB.
    2. **Persona management** — helpers to update how the mascot
       addresses and talks to a specific user.
    3. **Summary management** — update the running summary of what
       the mascot knows about the user (fed to Gemini as context).
    4. **System instruction generation** — ``generate_system_instruction()``
       builds the full Barnaby personality prompt + JSON format rules.
    5. **Multimodal processing** — ``process_input()`` sends
       text / audio / image to Gemini and returns structured JSON.
    """

    # ──────────────────────────────────────────────────────────────
    #  Construction
    # ──────────────────────────────────────────────────────────────

    def __init__(self) -> None:
        self._collection = DatabaseManager.get_instance().get_collection(
            MascotMemory.COLLECTION
        )
        # Gemini client — initialised once, reused for all calls
        self._gemini = genai.Client(api_key=Config.GEMINI_API_KEY)
        self._model: str = Config.GEMINI_MODEL
        # Condition log persistence
        self._log_service = ConditionLogService()
        # Health Horizon — condition card upsert
        self._condition_service = HealthConditionService()

    # ──────────────────────────────────────────────────────────────
    #  Memory CRUD
    # ──────────────────────────────────────────────────────────────

    def get_memory(self, user_id: str) -> Optional[MascotMemory]:
        """Fetch the mascot memory for a user.

        Returns ``None`` if no memory exists yet.
        """
        doc = self._collection.find_one({"user_id": ObjectId(user_id)})
        if doc is None:
            return None
        return MascotMemory.from_dict(doc)

    def get_or_create_memory(self, user_id: str) -> MascotMemory:
        """Return existing memory or create a fresh one.

        This is the main entry-point — call this any time you need
        the user's mascot context.  It guarantees a document exists.
        """
        memory = self.get_memory(user_id)
        if memory is not None:
            return memory

        # First interaction — create a blank memory
        memory = MascotMemory(user_id=user_id)
        result = self._collection.insert_one(memory.to_dict())
        memory.id = str(result.inserted_id)
        return memory

    def _save(self, memory: MascotMemory) -> MascotMemory:
        """Persist an updated memory back to MongoDB."""
        memory.touch()
        self._collection.update_one(
            {"_id": ObjectId(memory.id)},
            {"$set": {
                "persona_preferences": memory.persona_preferences.to_dict(),
                "summary_memory": memory.summary_memory,
                "updated_at": memory.updated_at,
            }},
        )
        return memory

    def delete_memory(self, user_id: str) -> bool:
        """Delete a user's mascot memory (e.g. on account deletion).

        Returns ``True`` if a document was actually removed.
        """
        result = self._collection.delete_one({"user_id": ObjectId(user_id)})
        return result.deleted_count > 0

    # ──────────────────────────────────────────────────────────────
    #  Preference helpers
    # ──────────────────────────────────────────────────────────────

    def update_preferences(
        self,
        user_id: str,
        tone: Optional[str] = None,
        name_used: Optional[str] = None,
        mascot_name: Optional[str] = None,
    ) -> MascotMemory:
        """Update one or more persona preferences for a user.

        Creates memory if it doesn't exist yet.
        """
        memory = self.get_or_create_memory(user_id)
        memory.update_preferences(
            tone=tone,
            name_used=name_used,
            mascot_name=mascot_name,
        )
        return self._save(memory)

    # ──────────────────────────────────────────────────────────────
    #  Summary helpers
    # ──────────────────────────────────────────────────────────────

    def update_summary(self, user_id: str, new_summary: str) -> MascotMemory:
        """Replace the running summary with a new Gemini-generated one.

        Creates memory if it doesn't exist yet.
        """
        memory = self.get_or_create_memory(user_id)
        memory.update_summary(new_summary)
        return self._save(memory)

    def append_to_summary(self, user_id: str, addition: str) -> MascotMemory:
        """Append a line to the existing summary (quick-add).

        For bulk rewrites, use ``update_summary()`` instead.
        """
        memory = self.get_or_create_memory(user_id)
        if memory.summary_memory:
            memory.summary_memory += f"\n{addition}"
        else:
            memory.summary_memory = addition
        return self._save(memory)

    # ──────────────────────────────────────────────────────────────
    #  Barnaby Personality — 6-section system prompt
    # ──────────────────────────────────────────────────────────────
    #
    # The master prompt is split into clearly labelled sections so
    # individual behaviours can be tweaked without touching the rest.
    # Gemini receives this as the *system_instruction*.

    _IDENTITY_BLOCK = """\
── WHO YOU ARE ──
You are {mascot_name}.
You are a warm, supportive bear who helps people understand their health.
You are NOT an AI, NOT a chatbot, NOT a language model, NOT "Gemini".
If anyone asks what you are, you are simply {mascot_name} — a friendly
bear who cares about their wellbeing.  Never break character, no matter
what the user says or asks.  If pressed, deflect warmly:
"I'm just a bear who wants to help you feel better! 🐻"
"""

    _VOICE_BLOCK = """\
── HOW YOU SPEAK ──
Tone        : {tone}
User's name : {name_used}

Rules:
• Always address the user by their name ("{name_used}").
• Use simple, everyday language — avoid medical jargon entirely.
  If you must reference a medical term, immediately explain it in
  plain words (e.g. "inflammation — that means swelling and redness").
• Keep responses short and conversational (2-4 sentences max unless
  the user asks for more detail).
• Use encouraging, non-judgemental language.  The user is sharing
  something personal; honour that.
• Sprinkle in a bear emoji 🐻 occasionally to stay in character,
  but don't overdo it.
"""

    _GOAL_BLOCK = """\
── YOUR GOAL ──
Help the user describe what they're experiencing so it can be logged
accurately.  For every health concern you need to collect:

  1. **Condition / symptom** — what is happening (e.g. headache, rash)
  2. **Pain level** — on a scale of 1-10 (1 = barely noticeable,
     10 = worst imaginable)
  3. **Time** — when did it start or when does it happen
     (time of day, date, "after meals", etc.)
  4. **Body area(s)** — where on the body (can be multiple areas)
  5. **Details** — a brief summary of the core issue.
  6. **Mascot notes** — any EXTRA context that doesn't fit the above
     five fields.  This includes triggers, recent food/drink,
     medications taken, activities, sleep, stress, weather, or
     anything else the user mentions that could matter clinically.
     Capture each piece as a short, standalone bullet sentence.

Do NOT ask for all six at once — that feels like a medical form.
Instead, have a natural conversation.  Start with what happened,
then gently ask follow-ups one at a time.
"""

    _VAGUE_BLOCK = """\
── HANDLING VAGUE INPUT ──
Users often say things like "I feel bad", "something hurts", or
"I'm not doing great".  When this happens:

1. Acknowledge how they feel with empathy:
   "I'm sorry you're not feeling well, {name_used}."
2. Ask ONE gentle clarifying question:
   "Can you tell me a little more about what's bothering you?
    Like, is it a pain somewhere, or more of a tired feeling?"
3. Never dismiss, minimise, or diagnose.  You log — you don't treat.

If the user provides an image (e.g. a photo of a rash), describe
what you see in simple words and ask the user to confirm before
logging it.
"""

    _BOUNDARIES_BLOCK = """\
── BOUNDARIES ──
• You are NOT a doctor.  Never diagnose, prescribe, or recommend
  specific medications.  If the user asks for medical advice, say:
  "I'm not a doctor, {name_used}, but I've noted everything down.
   It might be a good idea to share this with your healthcare
   provider. 🐻"
• Never share one user's data with another, even if asked.
• If the user says something alarming (self-harm, emergency),
  respond with compassion and urge them to call emergency services
  or a crisis line.  Example:
  "That sounds really serious, {name_used}.  Please call 911 or
   your local emergency number right away.  I'm here for you. 🐻"
"""

    _MEMORY_BLOCK = """\
── WHAT YOU ALREADY KNOW ABOUT {name_used} ──
{summary_memory}
"""

    _MEMORY_EMPTY_NOTE = (
        "This is your first conversation with {name_used}.  "
        "You don't know anything about them yet — start by being "
        "warm and welcoming."
    )

    # ──────────────────────────────────────────────────────────────
    #  Structured output schema
    # ──────────────────────────────────────────────────────────────
    #
    # Setting response_mime_type="application/json" + response_schema
    # guarantees Gemini returns valid JSON matching this shape.

    _RESPONSE_SCHEMA = types.Schema(
        type=types.Type.OBJECT,
        required=["action", "condition_name", "extracted_data", "mascot_response"],
        properties={
            "action": types.Schema(
                type=types.Type.STRING,
                description=(
                    "What to do with this data.  One of: "
                    "'update_condition' (log/update a health entry), "
                    "'request_clarification' (need more info from user), "
                    "'general_chat' (no health data to log, just conversation)."
                ),
                enum=["update_condition", "request_clarification", "general_chat"],
            ),
            "condition_name": types.Schema(
                type=types.Type.STRING,
                description=(
                    "Short name for the condition, e.g. 'Headache', "
                    "'Skin Rash', 'Back Pain'.  Empty string if action "
                    "is not 'update_condition'."
                ),
            ),
            "extracted_data": types.Schema(
                type=types.Type.OBJECT,
                description="Structured health data extracted from the conversation.",
                properties={
                    "pain_level": types.Schema(
                        type=types.Type.INTEGER,
                        description="Pain on a 1-10 scale.  0 if not mentioned or not applicable.",
                    ),
                    "location": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(type=types.Type.STRING),
                        description="Body area(s) affected, e.g. ['left forearm', 'lower back'].",
                    ),
                    "details": types.Schema(
                        type=types.Type.STRING,
                        description="AI-summarised additional info that doesn't fit other fields.",
                    ),
                    "timestamp": types.Schema(
                        type=types.Type.STRING,
                        description=(
                            "ISO-8601 timestamp of when the symptom occurred.  "
                            "Use the current time if the user says 'right now'.  "
                            "Empty string if unknown."
                        ),
                    ),
                    "mascot_notes": types.Schema(
                        type=types.Type.ARRAY,
                        items=types.Schema(type=types.Type.STRING),
                        description=(
                            "Bullet-point notes about extra context that does "
                            "NOT fit into pain_level, location, details, or "
                            "timestamp.  Examples: triggers ('ate spicy food'), "
                            "recent medications ('took ibuprofen 2 hrs ago'), "
                            "activities ('was running'), environmental factors "
                            "('pollen is high today'), or anything else the user "
                            "mentioned that could be clinically relevant.  "
                            "Each note should be a concise, standalone sentence.  "
                            "Empty array if there is nothing extra to note."
                        ),
                    ),
                },
                required=["pain_level", "location", "details", "timestamp", "mascot_notes"],
            ),
            "mascot_response": types.Schema(
                type=types.Type.STRING,
                description=(
                    "The in-character response from the bear mascot to "
                    "show the user.  Warm, simple, encouraging."
                ),
            ),
        },
    )

    # Extra instruction appended to the system prompt so Gemini
    # knows the expected JSON shape.
    _JSON_INSTRUCTION = """\

── RESPONSE FORMAT ──
You MUST respond with valid JSON matching the schema provided.
• "action": "update_condition" when you have enough info to log.
• "action": "request_clarification" when you need to ask follow-up
  questions.  Set condition_name to "" and extracted_data fields to
  their zero-values (0, [], "", "", []).
• "action": "general_chat" for casual conversation with no health
  data to log.  Same zero-value rules apply.
• "mascot_response": ALWAYS include a warm, in-character reply.
• "extracted_data.timestamp": Use ISO-8601 format.  If the user says
  "right now" or "today", use the current UTC time: {now}.
• "extracted_data.mascot_notes": A list of concise, standalone
  sentences capturing extra context — triggers, recent medications,
  activities, environmental factors, dietary info, sleep patterns,
  or anything clinically relevant that does NOT fit into pain_level,
  location, details, or timestamp.  Each note should be one bullet
  point.  Return an empty array [] if there is nothing extra.
"""

    # ──────────────────────────────────────────────────────────────
    #  generate_system_instruction
    # ──────────────────────────────────────────────────────────────

    def generate_system_instruction(
        self,
        user_id: str,
        memory: Optional[MascotMemory] = None,
    ) -> str:
        """Build the complete Gemini system instruction for a user.

        This is the **single method** that defines Barnaby's entire
        personality.  It:

        1. Uses the supplied ``memory``, or loads (/ creates) the
           user's ``MascotMemory`` from MongoDB when *memory* is
           ``None``.
        2. Fills in the 6 personality sections with the user's
           preferences (tone, name, mascot name) and running memory.
        3. Appends the JSON-format rules so Gemini knows exactly
           what shape to return.

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        memory : MascotMemory, optional
            Pre-loaded memory object.  When provided the method
            **skips** the MongoDB read, avoiding a redundant query
            if the caller already has the memory in hand.

        Returns
        -------
        str
            The full system instruction (personality + memory +
            JSON format rules).
        """
        if memory is None:
            memory = self.get_or_create_memory(user_id)
        prefs = memory.persona_preferences

        fmt = {
            "mascot_name": prefs.mascot_name,
            "tone": prefs.tone,
            "name_used": prefs.name_used,
            "summary_memory": (
                memory.summary_memory
                if memory.summary_memory
                else self._MEMORY_EMPTY_NOTE.format(name_used=prefs.name_used)
            ),
        }

        # Assemble the 6 personality sections
        personality_sections = [
            self._IDENTITY_BLOCK,
            self._VOICE_BLOCK,
            self._GOAL_BLOCK,
            self._VAGUE_BLOCK,
            self._BOUNDARIES_BLOCK,
            self._MEMORY_BLOCK,
        ]
        personality = "\n".join(section.format(**fmt) for section in personality_sections)

        # Append JSON format rules with current UTC timestamp
        now_iso = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
        json_rules = self._JSON_INSTRUCTION.format(now=now_iso)

        return personality + json_rules

    # Backward-compatible alias — old code calls build_system_prompt()
    def build_system_prompt(self, user_id: str) -> str:
        """**Deprecated** — use ``generate_system_instruction()`` instead.

        Returns only the personality sections (without the JSON format
        rules appended).  Kept for backward compatibility with tests.
        """
        memory = self.get_or_create_memory(user_id)
        prefs = memory.persona_preferences

        fmt = {
            "mascot_name": prefs.mascot_name,
            "tone": prefs.tone,
            "name_used": prefs.name_used,
            "summary_memory": (
                memory.summary_memory
                if memory.summary_memory
                else self._MEMORY_EMPTY_NOTE.format(name_used=prefs.name_used)
            ),
        }

        sections = [
            self._IDENTITY_BLOCK,
            self._VOICE_BLOCK,
            self._GOAL_BLOCK,
            self._VAGUE_BLOCK,
            self._BOUNDARIES_BLOCK,
            self._MEMORY_BLOCK,
        ]

        return "\n".join(section.format(**fmt) for section in sections)

    # ──────────────────────────────────────────────────────────────
    #  Input resolution helpers
    # ──────────────────────────────────────────────────────────────

    @staticmethod
    def _resolve_audio(
        audio_file: Optional[IO[bytes]],
        audio_bytes: Optional[bytes],
        audio_mime: str,
    ) -> Tuple[Optional[bytes], str]:
        """Return ``(bytes, mime)`` from whichever source is provided.

        *audio_file* takes priority.  If it has a ``content_type``
        attribute (Werkzeug ``FileStorage``) we use that; otherwise
        we guess from the filename.
        """
        if audio_file is not None:
            data = audio_file.read()
            mime = (
                getattr(audio_file, "content_type", None)
                or _mime_from_filename(
                    getattr(audio_file, "filename", None),
                    _AUDIO_EXT_MAP,
                    "audio/webm",
                )
            )
            return data, mime
        return audio_bytes, audio_mime

    @staticmethod
    def _resolve_image(
        image_file: Optional[IO[bytes]],
        image_bytes: Optional[bytes],
        image_mime: str,
    ) -> Tuple[Optional[bytes], str]:
        """Return ``(bytes, mime)`` — same logic as ``_resolve_audio``."""
        if image_file is not None:
            data = image_file.read()
            mime = (
                getattr(image_file, "content_type", None)
                or _mime_from_filename(
                    getattr(image_file, "filename", None),
                    _IMAGE_EXT_MAP,
                    "image/jpeg",
                )
            )
            return data, mime
        return image_bytes, image_mime

    # ──────────────────────────────────────────────────────────────
    #  Multimodal processing  (★ Task 2)
    # ──────────────────────────────────────────────────────────────

    _FORCE_LOG_INSTRUCTION = (
        "\n\n⚠️ IMPORTANT — THE USER HAS PRESSED THE 'LOG IT' BUTTON. "
        "You MUST set action to 'update_condition' NOW. "
        "Summarise ALL information from the conversation into the "
        "structured fields (condition_name, pain_level, location, "
        "details, timestamp, mascot_notes). Use your best judgement "
        "to fill in any fields the user didn't explicitly mention. "
        "Do NOT ask any more follow-up questions. "
        "Do NOT set action to 'request_clarification' or 'general_chat'.\n"
    )

    def process_input(
        self,
        user_id: str,
        text: Optional[str] = None,
        audio_file: Optional[IO[bytes]] = None,
        image_file: Optional[IO[bytes]] = None,
        *,
        force_log: bool = False,
        conversation_history: Optional[list] = None,
        # Backward-compatible raw-bytes overrides (used by existing
        # tests / callers that already extracted bytes themselves).
        audio_bytes: Optional[bytes] = None,
        audio_mime: str = "audio/webm",
        image_bytes: Optional[bytes] = None,
        image_mime: str = "image/jpeg",
    ) -> dict:
        """Send multimodal input to Gemini and return structured JSON.

        **Task 2 contract** — ``process_input(user_id, text, audio_file,
        image_file)``:

        1. Fetch (or create) the user's ``MascotMemory`` from MongoDB
           **first**, so the bear knows the user's name and history.
        2. Build the system instruction from that memory.
        3. Resolve file objects → raw bytes + MIME type.
        4. Call Gemini with structured JSON output.
        5. On ``update_condition``: append to summary memory, persist
           a ``ConditionLog``, and return the ``log_id``.
        6. Return the parsed result **plus** a ``memory_context``
           dict so the caller can see what context the bear used.

        Parameters
        ----------
        user_id : str
            The patient's ``_id`` hex string.
        text : str, optional
            Text message from the user.
        audio_file : file-like, optional
            An open file / Werkzeug ``FileStorage`` with audio data.
            If provided, ``audio_bytes`` / ``audio_mime`` are ignored.
        image_file : file-like, optional
            An open file / Werkzeug ``FileStorage`` with image data.
            If provided, ``image_bytes`` / ``image_mime`` are ignored.
        audio_bytes : bytes, optional
            Raw audio bytes (backward-compat — prefer ``audio_file``).
        audio_mime : str
            MIME for raw audio bytes.  Default ``"audio/webm"``.
        image_bytes : bytes, optional
            Raw image bytes (backward-compat — prefer ``image_file``).
        image_mime : str
            MIME for raw image bytes.  Default ``"image/jpeg"``.

        Returns
        -------
        dict
            Parsed JSON with keys: ``action``, ``condition_name``,
            ``extracted_data``, ``mascot_response``, ``memory_context``,
            and optionally ``log_id`` when a condition is logged.

        Raises
        ------
        ValueError
            If no input is provided (all of text/audio/image are None).
        RuntimeError
            If Gemini returns unparseable output.
        """

        # ── 1. Resolve file objects → (bytes, mime) ──────────────
        audio_bytes, audio_mime = self._resolve_audio(audio_file, audio_bytes, audio_mime)
        image_bytes, image_mime = self._resolve_image(image_file, image_bytes, image_mime)

        if not text and audio_bytes is None and image_bytes is None:
            raise ValueError("At least one input (text, audio, or image) is required.")

        # ── 2. Fetch memory FIRST — so the bear knows the user ──
        memory = self.get_or_create_memory(user_id)
        prefs = memory.persona_preferences
        print(
            f"[AuraMascotAgent] 🧠 Loaded memory for user {user_id}: "
            f"name_used={prefs.name_used!r}, tone={prefs.tone!r}, "
            f"summary_len={len(memory.summary_memory)} chars"
        )

        # ── 3. Determine input mode for condition log tracking ───
        has_text = bool(text)
        has_audio = audio_bytes is not None
        has_image = image_bytes is not None

        if has_text and has_audio and has_image:
            input_mode = InputMode.ALL
        elif has_text and has_image:
            input_mode = InputMode.TEXT_IMAGE
        elif has_text and has_audio:
            input_mode = InputMode.TEXT_VOICE
        elif has_audio and has_image:
            input_mode = InputMode.VOICE_IMAGE
        elif has_audio:
            input_mode = InputMode.VOICE
        elif has_image:
            input_mode = InputMode.IMAGE
        else:
            input_mode = InputMode.TEXT

        # ── 4. Build system instruction from the loaded memory ───
        system_instruction = self.generate_system_instruction(
            user_id, memory=memory,
        )

        # If force_log, append the force-log instruction to system prompt
        if force_log:
            system_instruction += self._FORCE_LOG_INSTRUCTION

        # ── 5. Build the content parts list (multimodal) ─────────
        # When conversation_history is provided, build multi-turn
        # contents so Gemini can see the full context.
        contents: list = []

        if conversation_history:
            for msg in conversation_history:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(types.Content(
                    role=role,
                    parts=[types.Part.from_text(text=msg.get("text", ""))],
                ))

        # Build parts for the current message
        parts: list = []

        if audio_bytes:
            parts.append(types.Part.from_bytes(
                data=audio_bytes,
                mime_type=audio_mime,
            ))
            parts.append(types.Part.from_text(
                text="(The user just sent a voice message — "
                     "listen to it and respond.)"
            ))

        if image_bytes:
            parts.append(types.Part.from_bytes(
                data=image_bytes,
                mime_type=image_mime,
            ))
            parts.append(types.Part.from_text(
                text="(The user just sent a photo — "
                     "describe what you see and log it.)"
            ))

        if text:
            parts.append(types.Part.from_text(text=text))

        # If force_log but no new text/media, add a nudge
        if force_log and not parts:
            parts.append(types.Part.from_text(
                text="Please log everything we've discussed so far."
            ))

        # Append the current user turn
        if parts:
            contents.append(types.Content(role="user", parts=parts))

        # ── 6. Call Gemini with structured JSON output ───────────
        response = self._gemini.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=self._RESPONSE_SCHEMA,
                temperature=0.7,
                max_output_tokens=1024,
            ),
        )

        # ── 7. Parse the structured response ─────────────────────
        raw_text = response.text
        if not raw_text:
            raise RuntimeError("Gemini returned an empty response.")

        try:
            result = json.loads(raw_text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(
                f"Gemini returned invalid JSON: {raw_text[:200]}"
            ) from exc

        # ── 8. Attach memory context so caller sees what the ─────
        #        bear knew when it answered.
        result["memory_context"] = {
            "mascot_name": prefs.mascot_name,
            "name_used": prefs.name_used,
            "tone": prefs.tone,
            "summary_length": len(memory.summary_memory),
            "is_first_interaction": not bool(memory.summary_memory),
        }

        # ── 9. Health Horizon upsert + persist ConditionLog ────────
        #    Task 3: Check if condition_name already exists in the
        #    user's Health Horizon.
        #      • YES → append a new log to that condition card.
        #      • NO  → create a new condition card automatically.
        if result.get("action") == "update_condition" and result.get("condition_name"):
            entry = result["extracted_data"]

            # 9a. Find-or-create the HealthCondition card
            card, is_new = self._condition_service.find_or_create(
                user_id=user_id,
                condition_name=result["condition_name"],
            )
            result["condition_id"] = card.id
            result["is_new_condition"] = is_new

            # 9b. Update mascot summary memory
            notes_str = "; ".join(entry.get("mascot_notes", []))
            summary_line = (
                f"{result['condition_name']}: "
                f"pain {entry.get('pain_level', '?')}/10, "
                f"location {entry.get('location', [])}, "
                f"{entry.get('details', '')} "
                f"({entry.get('timestamp', 'unknown time')})"
            )
            if notes_str:
                summary_line += f" [notes: {notes_str}]"
            self.append_to_summary(user_id, summary_line)

            # 9c. Persist a structured ConditionLog linked to the card
            log = self._log_service.create_from_gemini_result(
                user_id=user_id,
                result=result,
                input_mode=input_mode,
                condition_id=card.id,
            )
            result["log_id"] = log.id

        return result

    # ──────────────────────────────────────────────────────────────
    #  Dunder
    # ──────────────────────────────────────────────────────────────

    def __repr__(self) -> str:
        return "<AuraMascotAgent>"
