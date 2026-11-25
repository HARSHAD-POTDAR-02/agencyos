"""
Email automation service for sending zero-login Client Magic Review Links.
Supports both Resend API (RESEND_API_KEY) and standard SMTP (SMTP_HOST/USER/PASSWORD).
"""
from __future__ import annotations

import asyncio
import html
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailSendResult:
    sent: bool
    configured: bool
    provider: str
    recipient_email: str
    error: str | None = None


def is_email_configured() -> bool:
    """Return True if either Resend or SMTP credentials are configured."""
    if settings.RESEND_API_KEY.strip():
        return True
    if settings.SMTP_HOST.strip() and settings.SMTP_USER.strip() and settings.SMTP_PASSWORD.strip():
        return True
    return False


def _build_magic_review_email_bodies(
    *,
    recipient_name: str,
    client_name: str,
    agency_name: str,
    deliverable_title: str,
    platform: str,
    deliverable_type: str,
    review_url: str,
    custom_note: str | None = None,
) -> tuple[str, str, str]:
    subject = f"[{agency_name}] Ready for Review: {deliverable_title}"
    note_plain = f"\nNote from {agency_name}: {custom_note.strip()}\n" if custom_note and custom_note.strip() else ""
    text_body = (
        f"Hi {recipient_name},\n\n"
        f"{agency_name} has shared a new {platform.upper()} {deliverable_type} for {client_name} "
        f"for your review and sign-off.\n\n"
        f"Deliverable: {deliverable_title}\n"
        f"{note_plain}\n"
        f"Open your zero-login Review Portal to inspect, leave feedback, approve, or request changes:\n"
        f"{review_url}\n\n"
        f"No login or password is required.\n"
    )

    safe_agency = html.escape(agency_name)
    safe_client = html.escape(client_name)
    safe_recipient = html.escape(recipient_name)
    safe_title = html.escape(deliverable_title)
    safe_platform = html.escape(platform.upper())
    safe_type = html.escape(deliverable_type.replace("_", " ").title())
    safe_url = html.escape(review_url, quote=True)
    safe_note_html = ""
    if custom_note and custom_note.strip():
        safe_note_html = (
            f'<div style="margin:16px 0;padding:12px 14px;background:#F7F6F3;border-left:3px solid #7C3AED;'
            f'border-radius:6px;font-size:13px;color:#37352F;">'
            f'<strong>Note from {safe_agency}:</strong><br/>{html.escape(custom_note.strip())}</div>'
        )

    html_body = f"""<!DOCTYPE html>
<html>
<body style="margin:0;padding:24px;background:#F7F6F3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#191919;">
  <div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;">
    <div style="padding:20px 24px;border-bottom:1px solid #EFEFED;background:#191919;color:#FFFFFF;">
      <div style="font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#A78BFA;font-weight:700;">
        {safe_agency} · Client Review Portal
      </div>
      <div style="font-size:18px;font-weight:700;margin-top:6px;">{safe_title}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 12px;font-size:14px;line-height:1.5;">Hi {safe_recipient},</p>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#37352F;">
        A new <strong>{safe_platform} · {safe_type}</strong> deliverable for <strong>{safe_client}</strong> is ready for your review.
        You can view the preview, leave timestamped feedback, approve for scheduling, or request changes with one click.
      </p>
      {safe_note_html}
      <div style="margin:24px 0;text-align:center;">
        <a href="{safe_url}"
           style="display:inline-block;padding:12px 24px;background:#7C3AED;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:14px;border-radius:10px;">
          Open Review Room &amp; Approve
        </a>
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#6B6A65;line-height:1.5;">
        No login required. Or paste this magic link in your browser:<br/>
        <a href="{safe_url}" style="color:#7C3AED;word-break:break-all;">{safe_url}</a>
      </p>
    </div>
  </div>
</body>
</html>"""
    return subject, text_body, html_body


def _send_via_smtp_sync(
    *,
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
) -> None:
    from_email = (settings.EMAIL_FROM or settings.SMTP_USER).strip()
    from_name = (settings.EMAIL_FROM_NAME or "AgencyOS").strip()

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    port = int(settings.SMTP_PORT or 587)
    host = settings.SMTP_HOST.strip()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15) as server:
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=15) as server:
            if settings.SMTP_USE_TLS:
                server.starttls()
            server.login(settings.SMTP_USER.strip(), settings.SMTP_PASSWORD)
            server.send_message(msg)


async def send_magic_review_email(
    *,
    recipient_email: str,
    recipient_name: str,
    client_name: str,
    agency_name: str,
    deliverable_title: str,
    platform: str,
    deliverable_type: str,
    review_url: str,
    custom_note: str | None = None,
) -> EmailSendResult:
    """Send a Client Review Magic Link email via Resend API or SMTP."""
    to_email = recipient_email.strip()
    subject, text_body, html_body = _build_magic_review_email_bodies(
        recipient_name=recipient_name or client_name,
        client_name=client_name,
        agency_name=agency_name,
        deliverable_title=deliverable_title,
        platform=platform,
        deliverable_type=deliverable_type,
        review_url=review_url,
        custom_note=custom_note,
    )

    # 1. Resend API (preferred if configured)
    if settings.RESEND_API_KEY.strip():
        from_email = (settings.EMAIL_FROM or "onboarding@resend.dev").strip()
        from_name = (settings.EMAIL_FROM_NAME or agency_name or "AgencyOS").strip()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                res = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {settings.RESEND_API_KEY.strip()}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": f"{from_name} <{from_email}>",
                        "to": [to_email],
                        "subject": subject,
                        "html": html_body,
                        "text": text_body,
                    },
                )
            if 200 <= res.status_code < 300:
                return EmailSendResult(sent=True, configured=True, provider="resend", recipient_email=to_email)
            err_detail = res.text[:300]
            logger.warning("Resend email delivery failed (%s): %s", res.status_code, err_detail)
            return EmailSendResult(
                sent=False,
                configured=True,
                provider="resend",
                recipient_email=to_email,
                error=f"Resend API error ({res.status_code}): {err_detail}",
            )
        except Exception as exc:
            logger.warning("Resend email exception: %s", exc)
            return EmailSendResult(
                sent=False,
                configured=True,
                provider="resend",
                recipient_email=to_email,
                error=str(exc),
            )

    # 2. SMTP fallback
    if settings.SMTP_HOST.strip() and settings.SMTP_USER.strip() and settings.SMTP_PASSWORD.strip():
        try:
            await asyncio.to_thread(
                _send_via_smtp_sync,
                to_email=to_email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
            )
            return EmailSendResult(sent=True, configured=True, provider="smtp", recipient_email=to_email)
        except Exception as exc:
            logger.warning("SMTP email delivery failed: %s", exc)
            return EmailSendResult(
                sent=False,
                configured=True,
                provider="smtp",
                recipient_email=to_email,
                error=str(exc),
            )

    # 3. Not configured — fail gracefully with clear instructions
    return EmailSendResult(
        sent=False,
        configured=False,
        provider="none",
        recipient_email=to_email,
        error="Email provider is not configured. Add SMTP_HOST, SMTP_USER, SMTP_PASSWORD (or RESEND_API_KEY) to backend .env.",
    )
