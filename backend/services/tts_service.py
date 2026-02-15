"""
KodaCare – TtsService
========================
Text-to-Speech service that converts Barnaby's mascot_response
into playable audio using the Gemini TTS model.

Flow:
    1. Accept a text string (the mascot_response).
    2. Call ``gemini-2.5-flash-preview-tts`` with a warm bear-like voice.
    3. Convert the raw PCM response to a WAV file.
    4. Cache the WAV in ``backend/tts_cache/`` with a unique filename.
    5. Return the filename so the controller can build a URL.

The cache directory is cleaned lazily — files older than 1 hour are
deleted on each new generation to prevent unbounded disk growth.
"""

from __future__ import annotations

import hashlib
import io
import os
import struct
import time
import wave
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types

from backend.config import Config

# ── Constants ────────────────────────────────────────────────────

# Warm, friendly male-ish voice — good fit for a bear mascot.
# Available voices: Aoede, Charon, Fenrir, Kore, Puck, etc.
_TTS_VOICE = "Puck"
_TTS_MODEL = "gemini-2.5-flash-preview-tts"

# PCM format returned by the TTS API
_PCM_SAMPLE_RATE = 24000
_PCM_CHANNELS = 1
_PCM_SAMPLE_WIDTH = 2  # 16-bit = 2 bytes

# Cache settings
_CACHE_DIR = Path(__file__).resolve().parent.parent / "tts_cache"
_CACHE_MAX_AGE_SECS = 3600  # 1 hour


class TtsService:
    """Converts text to speech via the Gemini TTS preview model."""

    def __init__(self) -> None:
        self._client = genai.Client(api_key=Config.GEMINI_API_KEY)
        # Ensure cache dir exists
        _CACHE_DIR.mkdir(parents=True, exist_ok=True)

    # ── Public API ───────────────────────────────────────────────

    def synthesise(self, text: str) -> Optional[str]:
        """Generate a WAV file from *text* and return the filename.

        Returns ``None`` if TTS fails (caller should still return
        the text response — TTS is best-effort, never blocks the
        main response).

        Parameters
        ----------
        text : str
            The mascot_response string to speak aloud.

        Returns
        -------
        str or None
            The filename (e.g. ``"ab12cd34.wav"``) inside ``tts_cache/``.
        """
        if not text or not text.strip():
            return None

        # Truncate very long responses — TTS has token limits and
        # nobody wants a 2-minute monologue.
        text = text[:500]

        try:
            response = self._client.models.generate_content(
                model=_TTS_MODEL,
                contents=text,
                config=types.GenerateContentConfig(
                    response_modalities=["AUDIO"],
                    speech_config=types.SpeechConfig(
                        voice_config=types.VoiceConfig(
                            prebuilt_voice_config=types.PrebuiltVoiceConfig(
                                voice_name=_TTS_VOICE,
                            )
                        )
                    ),
                ),
            )

            # Extract PCM bytes from the response
            part = response.candidates[0].content.parts[0]
            if not part.inline_data or not part.inline_data.data:
                print("[TtsService] ⚠️  TTS returned empty audio data.")
                return None

            pcm_bytes: bytes = part.inline_data.data

            # Convert raw PCM → WAV
            wav_bytes = self._pcm_to_wav(pcm_bytes)

            # Generate a short unique filename from a hash of the text
            text_hash = hashlib.sha256(text.encode()).hexdigest()[:12]
            ts = int(time.time() * 1000) % 1_000_000
            filename = f"{text_hash}_{ts}.wav"

            filepath = _CACHE_DIR / filename
            filepath.write_bytes(wav_bytes)

            print(f"[TtsService] 🔊 Generated {filename} "
                  f"({len(wav_bytes):,} bytes, {len(text)} chars)")

            # Lazy cleanup of old cache files
            self._cleanup_cache()

            return filename

        except Exception as exc:
            # TTS is best-effort — log and move on
            print(f"[TtsService] ⚠️  TTS failed (non-fatal): {exc}")
            return None

    # ── Static helpers ───────────────────────────────────────────

    @staticmethod
    def get_audio_path(filename: str) -> Optional[Path]:
        """Resolve a filename to its full path, or None if missing."""
        path = _CACHE_DIR / filename
        if path.exists() and path.is_file():
            return path
        return None

    @staticmethod
    def _pcm_to_wav(pcm_data: bytes) -> bytes:
        """Wrap raw PCM (16-bit LE, 24 kHz, mono) in a WAV header."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(_PCM_CHANNELS)
            wf.setsampwidth(_PCM_SAMPLE_WIDTH)
            wf.setframerate(_PCM_SAMPLE_RATE)
            wf.writeframes(pcm_data)
        return buf.getvalue()

    @staticmethod
    def _cleanup_cache() -> None:
        """Delete cached WAV files older than ``_CACHE_MAX_AGE_SECS``."""
        try:
            now = time.time()
            for f in _CACHE_DIR.iterdir():
                if f.suffix == ".wav" and (now - f.stat().st_mtime) > _CACHE_MAX_AGE_SECS:
                    f.unlink(missing_ok=True)
        except Exception:
            pass  # Cleanup is best-effort

    # ── Dunder ───────────────────────────────────────────────────

    def __repr__(self) -> str:
        return f"<TtsService voice={_TTS_VOICE!r} model={_TTS_MODEL!r}>"
