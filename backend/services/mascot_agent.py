"""
KodaCare – mascot_agent  (backward-compatibility shim)
=========================================================
The canonical implementation now lives in ``aura_agent.py``.
This module re-exports ``AuraMascotAgent`` so existing imports
such as ``from backend.services.mascot_agent import AuraMascotAgent``
continue to work unchanged.

**New code should import from** ``backend.services.aura_agent``.
"""

from backend.services.aura_agent import AuraMascotAgent  # noqa: F401

__all__ = ["AuraMascotAgent"]
