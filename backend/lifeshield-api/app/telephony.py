"""
Telephony layer for LifeShield.
Handles real outbound emergency voice calls and SMS via Twilio,
with transparent simulated mode when credentials are unconfigured.
"""
from __future__ import annotations
import html
import logging
from dataclasses import dataclass
from .config import get_settings

logger = logging.getLogger("lifeshield.telephony")


def _xml_escape(text: str) -> str:
    return html.escape(text, quote=True)


@dataclass
class DispatchResult:
    channel: str  # "call" | "sms"
    status: str   # "dispatched" | "simulated" | "failed"
    provider_sid: str | None = None
    error: str | None = None


class TelephonyService:
    def __init__(self):
        self.settings = get_settings()
        self._client = None
        if self.settings.telephony_configured:
            try:
                from twilio.rest import Client
                self._client = Client(
                    self.settings.twilio_account_sid,
                    self.settings.twilio_auth_token
                )
                logger.info("Twilio telephony client successfully initialized.")
            except Exception as exc:
                logger.exception("Failed to initialize Twilio client, falling back to simulated mode: %s", exc)
                self._client = None

    @property
    def live(self) -> bool:
        return self._client is not None

    def place_call(self, to_number: str, message: str) -> DispatchResult:
        """Place real or simulated outbound emergency voice call."""
        if not self.live:
            logger.info("[SIMULATED EMERGENCY CALL] to=%s message=%s", to_number, message)
            return DispatchResult(channel="call", status="simulated")

        twiml = f'<Response><Say voice="Polly.Joanna">{_xml_escape(message)}</Say></Response>'
        try:
            call = self._client.calls.create(
                to=to_number,
                from_=self.settings.twilio_from_number,
                twiml=twiml,
            )
            return DispatchResult(channel="call", status="dispatched", provider_sid=call.sid)
        except Exception as exc:
            logger.exception("Twilio call failed for %s: %s", to_number, exc)
            return DispatchResult(channel="call", status="failed", error=str(exc))

    def send_sms(self, to_number: str, message: str) -> DispatchResult:
        """Send real or simulated emergency SMS."""
        if not self.live:
            logger.info("[SIMULATED EMERGENCY SMS] to=%s message=%s", to_number, message)
            return DispatchResult(channel="sms", status="simulated")

        try:
            msg = self._client.messages.create(
                to=to_number,
                from_=self.settings.twilio_from_number,
                body=message,
            )
            return DispatchResult(channel="sms", status="dispatched", provider_sid=msg.sid)
        except Exception as exc:
            logger.exception("Twilio SMS failed for %s: %s", to_number, exc)
            return DispatchResult(channel="sms", status="failed", error=str(exc))


_telephony_singleton: TelephonyService | None = None


def get_telephony_service() -> TelephonyService:
    global _telephony_singleton
    if _telephony_singleton is None:
        _telephony_singleton = TelephonyService()
    return _telephony_singleton
