import io
import os
import re
import base64
import hashlib
import tempfile
import logging
import threading
import json
from pathlib import Path
from functools import lru_cache
import math
import time
import uuid
import secrets
import smtplib
from email.message import EmailMessage

import fitz
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from PIL import ImageOps
from datetime import datetime, date, timedelta
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.files import File
from django.http import JsonResponse
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.utils import timezone
from django.db import transaction
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

import pandas as pd

from .gpt_parser import (
    gpt_parse_subsections_from_image,
    gpt_belongs_to_current,
    gpt_detect_corner_marker,
)
from . import gpt_parser as _gptp
from .models import Document, SupportingDocument, UserSettings, PaymentProof
from .serializers import (
    DocumentSerializer,
    SupportingDocumentSerializer,
    UserSettingsSerializer,
    PaymentProofSerializer,
)
from .utils import generate_unique_item_ref_code, recalc_totals

logger = logging.getLogger(__name__)

PROGRESS_TTL = 60 * 60  # 1h
OCR_MARKER_BUDGET = int(os.environ.get("OCR_MARKER_BUDGET", "2"))

OTP_TTL_SECONDS = int(os.environ.get("OTP_TTL_SECONDS", "300"))  # 5 minutes
OTP_MAX_ATTEMPTS = int(os.environ.get("OTP_MAX_ATTEMPTS", "5"))
OTP_DEV_MODE = os.environ.get("OTP_DEV_MODE", "0") == "1"  # log OTP to server logs

OTP_DELIVERY = (os.environ.get("OTP_DELIVERY") or "whatsapp").strip().lower()

SMTP_HOST = (os.environ.get("SMTP_HOST") or "smtp.gmail.com").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT") or "587")
SMTP_USERNAME = (os.environ.get("SMTP_USERNAME") or "").strip()
SMTP_PASSWORD = (os.environ.get("SMTP_PASSWORD") or "").strip()
SMTP_USE_TLS = (os.environ.get("SMTP_USE_TLS") or "1") == "1"
SMTP_USE_SSL = (os.environ.get("SMTP_USE_SSL") or "0") == "1"

OTP_EMAIL_FROM = (os.environ.get("OTP_EMAIL_FROM") or SMTP_USERNAME).strip()
OTP_EMAIL_SUBJECT = (os.environ.get("OTP_EMAIL_SUBJECT") or "Kode OTP DMS").strip()
PASSWORD_RESET_TTL_SECONDS = int(os.environ.get("PASSWORD_RESET_TTL_SECONDS", "300"))  # 5 minutes
PASSWORD_RESET_MAX_ATTEMPTS = int(os.environ.get("PASSWORD_RESET_MAX_ATTEMPTS", "5"))
PASSWORD_RESET_EMAIL_SUBJECT = (os.environ.get("PASSWORD_RESET_EMAIL_SUBJECT") or "Reset Password DMS").strip()

# Optional override for the link domain (otherwise derived from request host)
PUBLIC_BASE_URL = (os.environ.get("PUBLIC_BASE_URL") or "").strip().rstrip("/")

# --- Map data root (filesystem) --------------------------------------------
# New location: backend/map/<estate_code>/...
# Map data root (filesystem)
# Location: backend/maps/<estate_code>/...
MAP_DATA_DIR = Path(settings.BASE_DIR) / "maps"

def _safe_estate_dir(estate_code: str) -> Path:
    """
    Resolve backend/map/<estate_code> safely (prevents path traversal).
    """
    code = (estate_code or "").strip().lower()
    if not code:
        raise FileNotFoundError("Missing estate_code")

    base = MAP_DATA_DIR.resolve()
    estate_dir = (base / code).resolve()

    # Ensure estate_dir is inside MAP_DATA_DIR
    try:
        estate_dir.relative_to(base)
    except ValueError:
        raise FileNotFoundError("Invalid estate_code")

    if not estate_dir.exists():
        raise FileNotFoundError(f"Unknown estate: {code}")

    return estate_dir

def _first_existing(*paths: Path) -> Path:
    for p in paths:
        if p.exists():
            return p
    raise FileNotFoundError("File not found: " + ", ".join(str(p) for p in paths))

# --- Estate composition (blocks meta) ---------------------------------------
# Map estate_code to relative Excel path under BASE_DIR / "maps"
# Adjust values to match your actual folder layout.
ESTATE_KOMPOSISI_FILES = {
    "bunut1": "bunut/komposisi.xlsx",
}

def _flatten_col(col_tuple):
    parts = []
    for p in (col_tuple if isinstance(col_tuple, tuple) else (col_tuple,)):
        if p is None:
            continue
        s = str(p).strip()
        if not s or s.startswith("Unnamed:"):
            continue
        parts.append(" ".join(s.split()))
    return " - ".join(parts) if parts else None

def _clean_value(v):
    if v is None:
        return None
    if isinstance(v, float) and math.isnan(v):
        return None
    return v

@lru_cache(maxsize=8)
def _load_komposisi_map(estate_code: str) -> dict:
    rel = ESTATE_KOMPOSISI_FILES.get(estate_code)
    if not rel:
        raise FileNotFoundError(f"unknown estate_code: {estate_code}")

    xlsx_path = Path(settings.BASE_DIR) / "maps" / rel
    if not xlsx_path.exists():
        raise FileNotFoundError(str(xlsx_path))

    # Try multi-row headers first (common for this sheet); fall back to single row
    try:
        df = pd.read_excel(xlsx_path, sheet_name=0, header=[1, 2, 3])
    except Exception:
        df = pd.read_excel(xlsx_path, sheet_name=0, header=0)

    # Identify the BLOCK column
    block_col = None
    for c in df.columns:
        top = c[0] if isinstance(c, tuple) and c else c
        if str(top).strip().upper() == "BLOCK":
            block_col = c
            break
    if block_col is None:
        # try relaxed search across flattened names
        flat_cols_tmp = []
        for c in df.columns:
            flat_cols_tmp.append(_flatten_col(c) or str(c))
        try:
            block_idx = [s.upper() for s in flat_cols_tmp].index("BLOCK")
            block_col = df.columns[block_idx]
        except ValueError:
            raise ValueError("Could not find BLOCK column in komposisi xlsx")

    # Drop empty BLOCK rows
    df = df[df[block_col].notna()].copy()

    # Flatten columns to strings
    flat_cols = []
    for c in df.columns:
        if isinstance(c, tuple):
            flat_cols.append(_flatten_col(c) or str(c))
        else:
            flat_cols.append(str(c))
    df.columns = flat_cols

    # Resolve actual BLOCK column name after flattening
    block_name_col = None
    for c in df.columns:
        if c and c.upper().startswith("BLOCK"):
            block_name_col = c
            break
    if not block_name_col:
        raise ValueError("BLOCK column not found after flattening")

    # Build mapping keyed by block code
    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        block = str(row.get(block_name_col, "")).strip()
        if not block or block.lower() == "nan":
            continue
        data = {k: _clean_value(row[k]) for k in df.columns if k and k != block_name_col}
        result[block.upper()] = data
    return result

def _load_komposisi_map_from_path(xlsx_path: Path) -> dict:
    # Try multi-row headers first; fall back to single-row
    try:
        df = pd.read_excel(xlsx_path, sheet_name=0, header=[1, 2, 3])
    except Exception:
        df = pd.read_excel(xlsx_path, sheet_name=0, header=0)

    # Identify the BLOCK column from either tuple or flattened
    block_col = None
    for c in df.columns:
        top = c[0] if isinstance(c, tuple) and c else c
        if str(top).strip().upper() == "BLOCK":
            block_col = c
            break
    if block_col is None:
        flat_cols_tmp = []
        for c in df.columns:
            flat_cols_tmp.append(_flatten_col(c) or str(c))
        try:
            block_idx = [s.upper() for s in flat_cols_tmp].index("BLOCK")
            block_col = df.columns[block_idx]
        except ValueError:
            raise ValueError("Could not find BLOCK column in komposisi xlsx")

    # Drop empty BLOCK rows
    df = df[df[block_col].notna()].copy()

    # Flatten columns
    flat_cols = []
    for c in df.columns:
        if isinstance(c, tuple):
            flat_cols.append(_flatten_col(c) or str(c))
        else:
            flat_cols.append(str(c))
    df.columns = flat_cols

    # Resolve actual block name column after flattening
    block_name_col = None
    for c in df.columns:
        if c and c.upper().startswith("BLOCK"):
            block_name_col = c
            break
    if not block_name_col:
        raise ValueError("BLOCK column not found after flattening")

    # Build mapping keyed by block code
    result: dict[str, dict] = {}
    for _, row in df.iterrows():
        block = str(row.get(block_name_col, "")).strip()
        if not block or block.lower() == "nan":
            continue
        data = {k: _clean_value(row[k]) for k in df.columns if k and k != block_name_col}
        result[block.upper()] = data
    return result

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kebun_blocks_meta_view(request, estate_code):
    try:
        estate_dir = _safe_estate_dir(estate_code)
        # Preferred: pre-generated JSON (fast)
        candidates = [
            estate_dir / "blocks_meta.json",
            estate_dir / f"{estate_code}_blocks_meta.json",
        ]
        json_path = next((p for p in candidates if p.exists()), None)
        if json_path:
            with json_path.open("r", encoding="utf-8") as f:
                return Response(json.load(f))

        # Optional fallback: parse XLSX directly if JSON isn't present
        xlsx_path = estate_dir / "komposisi.xlsx"
        if xlsx_path.exists():
            data = _load_komposisi_map_from_path(xlsx_path)
            return Response(data)

        return Response(
            {"detail": "blocks_meta.json / <estate>_blocks_meta.json not found (generate it) and komposisi.xlsx not found."},
            status=404,
        )
    except FileNotFoundError as e:
        return Response({"detail": str(e)}, status=404)
    except Exception as e:
        return Response({"detail": f"Failed to load blocks meta: {e}"}, status=500)

# --- Rekap configuration ----------------------------------------------------
REKAP_CONFIG = {
    "bbm": {
        "label": "Rekap BBM",
        # keywords in KETERANGAN / vendor text (lowercased comparisons)
        "keywords": [
            "po pembayaran solar",
            "pembayaran solar",
            "bbm",
        ],
        "doc_types": ["tagihan_pekerjaan"],  # QLOLA transaksi
    },
}

def _pkey(job_id: str) -> str:
    return f"progress:{job_id}"

def progress_update(job_id: str | None, percent: int, stage: str = "", **extra):
    if not job_id:
        return
    data = {
        "job_id": job_id,
        "percent": max(0, min(100, int(percent))),
        "stage": stage,
        "updated_at": timezone.now().isoformat(),
        **extra,
    }
    cache.set(_pkey(job_id), data, timeout=PROGRESS_TTL)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
@never_cache
def progress_view(request, job_id: str):
    data = cache.get(_pkey(job_id))
    if not data:
        return JsonResponse({"job_id": job_id, "percent": 0, "stage": "pending"})
    return JsonResponse(data)

def _otp_key(challenge_id: str) -> str:
    return f"otp:{challenge_id}"

def _mask_msisdn(msisdn: str | None) -> str:
    s = (msisdn or "").strip()
    if not s:
        return "—"
    if len(s) <= 7:
        return s[:2] + "***" + s[-2:]
    prefix = s[:4]
    tail = s[-3:]
    return prefix + ("*" * max(3, len(s) - 7)) + tail

def _mask_email(addr: str | None) -> str:
    s = (addr or "").strip()
    if not s or "@" not in s:
        return "—"
    local, domain = s.split("@", 1)
    if len(local) <= 2:
        masked_local = local[:1] + "*"
    else:
        masked_local = local[:1] + ("*" * (len(local) - 2)) + local[-1:]
    return f"{masked_local}@{domain}"

def _generate_otp_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"

def _send_whatsapp_otp(to_number: str, code: str, purpose: str) -> None:
    """
    - If DEBUG or OTP_DEV_MODE=1: log OTP (dev only)
    - Otherwise: fail closed until a real provider is wired
    """
    if getattr(settings, "DEBUG", False) or OTP_DEV_MODE:
        logger.warning("[DEV OTP] purpose=%s to=%s code=%s", purpose, to_number, code)
        return
    raise RuntimeError("WhatsApp OTP provider not configured")

def _send_email_otp(to_email: str, code: str, purpose: str) -> None:
        if getattr(settings, "DEBUG", False) or OTP_DEV_MODE:
                logger.warning("[DEV OTP] purpose=%s to=%s code=%s", purpose, to_email, code)
                return

        if not SMTP_USERNAME or not SMTP_PASSWORD:
                raise RuntimeError("SMTP not configured (missing SMTP_USERNAME/SMTP_PASSWORD).")

        minutes = max(1, math.ceil(int(OTP_TTL_SECONDS) / 60))

        purpose_label = "Login" if purpose == "login" else "Ganti Password" if purpose == "password_change" else purpose

        subject = OTP_EMAIL_SUBJECT or "Kode OTP"

        text_body = (
                f"Nors Nusa Lab\n\n"
                f"Kode OTP untuk {purpose_label}: {code}\n"
                f"Berlaku {minutes} menit.\n\n"
                "Jangan bagikan kode ini kepada siapa pun.\n"
                "Jika Anda tidak meminta kode ini, abaikan email ini."
        )

        html_body = f"""\
<!doctype html>
<html>
    <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
            <tr>
                <td align="center">
                    <table role="presentation" width="560" cellspacing="0" cellpadding="0"
                                 style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
                        <tr>
                            <td style="padding:18px 22px;background:#0f172a;color:#ffffff;">
                                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;">Nors Nusa Lab</div>
                                <div style="font-size:12px;opacity:0.9;">Document Management System</div>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:22px;color:#0f172a;">
                                <div style="font-size:14px;margin-bottom:10px;">
                                    Kode OTP untuk <b>{purpose_label}</b>:
                                </div>

                                <div style="text-align:center;padding:14px 0;margin:12px 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                                    <div style="font-size:34px;font-weight:800;letter-spacing:6px;color:#111827;">{code}</div>
                                </div>

                                <div style="font-size:13px;color:#475569;">
                                    Berlaku <b>{minutes} menit</b>. Jangan bagikan kode ini kepada siapa pun.
                                </div>

                                <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />

                                <div style="font-size:12px;color:#64748b;line-height:1.5;">
                                    Jika Anda tidak meminta kode ini, abaikan email ini.
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td style="padding:14px 22px;background:#f8fafc;font-size:11px;color:#94a3b8;">
                                © {datetime.now().year} Nors Nusa Lab
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>
"""

        msg = EmailMessage()
        msg["Subject"] = subject

        # IMPORTANT: ini yang mengubah "william" -> "Nors Nusa Lab" di inbox
        # (kalau OTP_EMAIL_FROM sudah "Nors Nusa Lab <...>", biarkan apa adanya)
        msg["From"] = OTP_EMAIL_FROM or SMTP_USERNAME

        msg["To"] = to_email
        msg.set_content(text_body)
        msg.add_alternative(html_body, subtype="html")

        if SMTP_USE_SSL or SMTP_PORT == 465:
                smtp = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20)
        else:
                smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)

        with smtp:
                smtp.ehlo()
                if SMTP_USE_TLS and not (SMTP_USE_SSL or SMTP_PORT == 465):
                        smtp.starttls()
                        smtp.ehlo()
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
                smtp.send_message(msg)

        logger.info("Email OTP sent purpose=%s to=%s", purpose, _mask_email(to_email))

def _create_otp_challenge(*, user_id: int, purpose: str, channel: str, destination: str) -> dict:
    challenge_id = uuid.uuid4().hex
    code = _generate_otp_code()
    now = int(time.time())
    exp = now + int(timedelta(seconds=OTP_TTL_SECONDS).total_seconds())

    payload = {
        "user_id": user_id,
        "purpose": purpose,
        "channel": channel,
        "to": destination,
        "code_hash": make_password(code),
        "attempts": 0,
        "max_attempts": OTP_MAX_ATTEMPTS,
        "created": now,
        "exp": exp,
    }

    key = _otp_key(challenge_id)
    try:
        cache.set(key, payload, timeout=OTP_TTL_SECONDS)
    except Exception as e:
        logger.exception("OTP cache write failed: %s", e)
        raise RuntimeError("OTP service sementara tidak tersedia. Coba lagi.") from e

    try:
        if channel == "email":
            _send_email_otp(destination, code, purpose)
        else:
            _send_whatsapp_otp(destination, code, purpose)
    except Exception:
        cache.delete(key)
        raise

    masked = _mask_email(destination) if channel == "email" else _mask_msisdn(destination)

    return {
        "challenge_id": challenge_id,
        "destination": masked,
        "expires_in": OTP_TTL_SECONDS,
        "channel": channel,
    }

def _verify_otp_challenge(*, challenge_id: str, code: str, purpose: str) -> tuple[dict, str | None]:
    key = _otp_key((challenge_id or "").strip())
    payload = cache.get(key)
    if not payload:
        return {}, "OTP tidak ditemukan / sudah kedaluwarsa."

    now = int(time.time())
    if payload.get("purpose") != purpose:
        return {}, "OTP tidak valid untuk aksi ini."
    if now > int(payload.get("exp") or 0):
        cache.delete(key)
        return {}, "OTP sudah kedaluwarsa."

    attempts = int(payload.get("attempts") or 0)
    max_attempts = int(payload.get("max_attempts") or OTP_MAX_ATTEMPTS)
    if attempts >= max_attempts:
        cache.delete(key)
        return {}, "Terlalu banyak percobaan OTP. Silakan minta OTP baru."

    ok = check_password(str(code or "").strip(), payload.get("code_hash") or "")
    if not ok:
        payload["attempts"] = attempts + 1
        ttl = max(1, int(payload.get("exp") or now) - now)
        cache.set(key, payload, timeout=ttl)
        return {}, "OTP salah."

    cache.delete(key)  # one-time use
    return payload, None

_User = get_user_model()

@api_view(["POST"])
@permission_classes([AllowAny])
def otp_login_start(request):
    username = (request.data.get("username") or "").strip()
    password = request.data.get("password") or ""

    user = authenticate(username=username, password=password)
    if not user:
        return Response({"error": "Invalid credentials"}, status=drf_status.HTTP_401_UNAUTHORIZED)

    if OTP_DELIVERY == "email":
        to_email = (getattr(user, "email", "") or "").strip()
        if not to_email:
            return Response(
                {"error": "Email belum diatur untuk akun ini."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = _create_otp_challenge(
                user_id=user.id, purpose="login", channel="email", destination=to_email
            )
        except RuntimeError as e:
            return Response({"error": str(e)}, status=drf_status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.exception("OTP email send failed (login) user=%s: %s", user.id, e)
            return Response(
                {"error": "Gagal mengirim OTP via email. Coba lagi atau hubungi admin."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(data, status=drf_status.HTTP_200_OK)

    # fallback (old behavior)
    settings_obj, _ = UserSettings.objects.get_or_create(user=user)
    to_number = (settings_obj.whatsapp_number or "").strip()
    if not to_number:
        return Response(
            {"error": "Nomor WhatsApp belum diatur untuk akun ini."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    try:
        data = _create_otp_challenge(
            user_id=user.id, purpose="login", channel="whatsapp", destination=to_number
        )
    except RuntimeError as e:
        return Response({"error": str(e)}, status=drf_status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        logger.exception("OTP whatsapp failed (login) user=%s: %s", user.id, e)
        return Response(
            {"error": "Gagal mengirim OTP via WhatsApp. Coba lagi atau hubungi admin."},
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(data, status=drf_status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([AllowAny])
def otp_login_verify(request):
    challenge_id = (request.data.get("challenge_id") or "").strip()
    code = (request.data.get("otp") or "").strip()

    payload, err = _verify_otp_challenge(challenge_id=challenge_id, code=code, purpose="login")
    if err:
        return Response({"error": err}, status=drf_status.HTTP_400_BAD_REQUEST)

    user_id = payload.get("user_id")
    try:
        user = _User.objects.get(id=user_id)
    except _User.DoesNotExist:
        return Response({"error": "User tidak ditemukan."}, status=drf_status.HTTP_400_BAD_REQUEST)

    refresh = RefreshToken.for_user(user)
    access = refresh.access_token

    groups = list(user.groups.values_list("name", flat=True))
    if "owner" in groups:
        role = "owner"
    elif "boss" in groups:
        role = "higher-up"
    elif "admin" in groups:
        role = "employee"
    else:
        role = "employee"

    return Response(
        {
            "access": str(access),
            "refresh": str(refresh),
            "username": user.username,
            "groups": groups,
            "role": role,
        },
        status=drf_status.HTTP_200_OK,
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def otp_password_change_start(request):
    user = request.user

    if OTP_DELIVERY == "email":
        to_email = (getattr(user, "email", "") or "").strip()
        if not to_email:
            return Response(
                {"error": "Email belum diatur untuk akun ini."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        try:
            data = _create_otp_challenge(
                user_id=user.id, purpose="password_change", channel="email", destination=to_email
            )
        except RuntimeError as e:
            return Response({"error": str(e)}, status=drf_status.HTTP_503_SERVICE_UNAVAILABLE)
        except Exception as e:
            logger.exception("OTP email send failed (password_change) user=%s: %s", user.id, e)
            return Response(
                {"error": "Gagal mengirim OTP via email. Coba lagi atau hubungi admin."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(data, status=drf_status.HTTP_200_OK)

    # fallback (old behavior)
    settings_obj, _ = UserSettings.objects.get_or_create(user=user)
    to_number = (settings_obj.whatsapp_number or "").strip()
    if not to_number:
        return Response(
            {"error": "Nomor WhatsApp belum diatur untuk akun ini."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    try:
        data = _create_otp_challenge(
            user_id=user.id, purpose="password_change", channel="whatsapp", destination=to_number
        )
    except RuntimeError as e:
        return Response({"error": str(e)}, status=drf_status.HTTP_503_SERVICE_UNAVAILABLE)
    except Exception as e:
        logger.exception("OTP whatsapp failed (password_change) user=%s: %s", user.id, e)
        return Response(
            {"error": "Gagal mengirim OTP via WhatsApp. Coba lagi atau hubungi admin."},
            status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
        )

    return Response(data, status=drf_status.HTTP_200_OK)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def otp_password_change_confirm(request):
    """
    Confirm OTP and change the authenticated user's password.
    Body: { challenge_id, otp, new_password }
    """
    challenge_id = (request.data.get("challenge_id") or "").strip()
    code = (request.data.get("otp") or "").strip()
    new_password = request.data.get("new_password") or ""

    if not challenge_id:
        return Response({"error": "challenge_id wajib diisi."}, status=drf_status.HTTP_400_BAD_REQUEST)
    if len(code) != 6 or not code.isdigit():
        return Response({"error": "OTP harus 6 digit."}, status=drf_status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({"error": "Password baru wajib diisi."}, status=drf_status.HTTP_400_BAD_REQUEST)

    payload, err = _verify_otp_challenge(
        challenge_id=challenge_id,
        code=code,
        purpose="password_change",
    )
    if err:
        return Response({"error": err}, status=drf_status.HTTP_400_BAD_REQUEST)

    # OTP must belong to the currently authenticated user
    try:
        otp_user_id = int(payload.get("user_id") or 0)
    except Exception:
        otp_user_id = 0

    if otp_user_id != int(request.user.id):
        return Response({"error": "OTP tidak valid untuk user ini."}, status=drf_status.HTTP_403_FORBIDDEN)

    # Validate password using Django validators
    try:
        validate_password(new_password, user=request.user)
    except ValidationError as e:
        return Response(
            {"error": "Password tidak valid.", "details": list(e.messages)},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])

    return Response({"ok": True}, status=drf_status.HTTP_200_OK)


def _pwdreset_key(reset_id: str) -> str:
    return f"pwdreset:{reset_id}"


def _public_base_url(request) -> str:
    """
    Base URL for links in emails.
    - If PUBLIC_BASE_URL env is set, use it
    - Else derive from request (honors X-Forwarded-Proto from Nginx)
    """
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL
    proto = (request.META.get("HTTP_X_FORWARDED_PROTO") or request.scheme or "https").split(",")[0].strip()
    host = request.get_host()
    return f"{proto}://{host}"


def _send_password_reset_email(to_email: str, reset_link: str) -> None:
    """
    Sends a reset-password link to email.
    Reuses the SMTP configuration already used for OTP email.
    """
    if getattr(settings, "DEBUG", False) or OTP_DEV_MODE:
        logger.warning("[DEV RESET] to=%s link=%s", to_email, reset_link)
        return

    if not SMTP_USERNAME or not SMTP_PASSWORD:
        raise RuntimeError("SMTP not configured (missing SMTP_USERNAME/SMTP_PASSWORD).")

    minutes = max(1, math.ceil(int(PASSWORD_RESET_TTL_SECONDS) / 60))
    subject = PASSWORD_RESET_EMAIL_SUBJECT or "Reset Password"

    text_body = (
        "Nors Nusa Lab\n\n"
        "Kami menerima permintaan untuk mereset password akun DMS Anda.\n"
        f"Link ini berlaku {minutes} menit.\n\n"
        f"Reset password: {reset_link}\n\n"
        "Jika Anda tidak meminta reset password, abaikan email ini."
    )

    html_body = f"""\
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f5f7fb;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellspacing="0" cellpadding="0"
                 style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:18px 22px;background:#0f172a;color:#ffffff;">
                <div style="font-size:16px;font-weight:700;letter-spacing:0.3px;">Nors Nusa Lab</div>
                <div style="font-size:12px;opacity:0.9;">Document Management System</div>
              </td>
            </tr>

            <tr>
              <td style="padding:22px;color:#0f172a;">
                <div style="font-size:14px;margin-bottom:10px;">
                  Kami menerima permintaan untuk <b>reset password</b> akun DMS Anda.
                </div>

                <div style="font-size:13px;color:#475569;margin-bottom:14px;">
                  Link ini berlaku <b>{minutes} menit</b>.
                </div>

                <div style="text-align:center;margin:18px 0;">
                  <a href="{reset_link}"
                     style="display:inline-block;padding:12px 18px;border-radius:10px;
                            background:#2563eb;color:#ffffff;text-decoration:none;
                            font-weight:700;font-size:14px;">
                    Reset Password
                  </a>
                </div>

                <div style="font-size:12px;color:#64748b;line-height:1.5;">
                  Jika tombol tidak bekerja, salin dan buka link berikut:
                  <div style="word-break:break-all;margin-top:8px;color:#0f172a;">{reset_link}</div>
                </div>

                <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0;" />

                <div style="font-size:12px;color:#64748b;line-height:1.5;">
                  Jika Anda tidak meminta reset password, abaikan email ini.
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 22px;background:#f8fafc;font-size:11px;color:#94a3b8;">
                © {datetime.now().year} Nors Nusa Lab
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""

    msg = EmailMessage()
    msg["Subject"] = subject
    # same "From" behavior as OTP emails (set OTP_EMAIL_FROM to "Nors Nusa Lab <...>")
    msg["From"] = OTP_EMAIL_FROM or SMTP_USERNAME
    msg["To"] = to_email
    msg.set_content(text_body)
    msg.add_alternative(html_body, subtype="html")

    if SMTP_USE_SSL or SMTP_PORT == 465:
        smtp = smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=20)
    else:
        smtp = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20)

    with smtp:
        smtp.ehlo()
        if SMTP_USE_TLS and not (SMTP_USE_SSL or SMTP_PORT == 465):
            smtp.starttls()
            smtp.ehlo()
        smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(msg)

    logger.info("Password reset email sent to=%s", _mask_email(to_email))


def _create_password_reset(*, user_id: int) -> tuple[str, str]:
    reset_id = uuid.uuid4().hex
    token = secrets.token_hex(32)

    now = int(time.time())
    exp = now + int(PASSWORD_RESET_TTL_SECONDS)

    payload = {
        "user_id": int(user_id),
        "token_hash": make_password(token),
        "attempts": 0,
        "max_attempts": PASSWORD_RESET_MAX_ATTEMPTS,
        "created": now,
        "exp": exp,
    }

    key = _pwdreset_key(reset_id)
    cache.set(key, payload, timeout=PASSWORD_RESET_TTL_SECONDS)
    return reset_id, token


def _verify_password_reset(reset_id: str, token: str) -> tuple[dict, str | None]:
    key = _pwdreset_key((reset_id or "").strip())
    payload = cache.get(key)
    if not payload:
        return {}, "Link reset tidak ditemukan / sudah kedaluwarsa."

    now = int(time.time())
    if now > int(payload.get("exp") or 0):
        cache.delete(key)
        return {}, "Link reset sudah kedaluwarsa. Silakan minta link baru."

    attempts = int(payload.get("attempts") or 0)
    max_attempts = int(payload.get("max_attempts") or PASSWORD_RESET_MAX_ATTEMPTS)
    if attempts >= max_attempts:
        cache.delete(key)
        return {}, "Terlalu banyak percobaan. Silakan minta link baru."

    ok = check_password(token, payload.get("token_hash") or "")
    if not ok:
        payload["attempts"] = attempts + 1
        ttl = max(1, int(payload.get("exp") or now) - now)
        cache.set(key, payload, timeout=ttl)
        return {}, "Link reset tidak valid."
    return payload, None


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_start(request):
    """
    Body: { identifier: "<username or email>" }
    Always returns ok:true to avoid account enumeration.
    """
    identifier = (
        request.data.get("identifier")
        or request.data.get("username")
        or request.data.get("email")
        or ""
    ).strip()

    if not identifier:
        return Response({"error": "Username atau email wajib diisi."}, status=drf_status.HTTP_400_BAD_REQUEST)

    # If not dev mode and SMTP missing -> fail early
    if not (getattr(settings, "DEBUG", False) or OTP_DEV_MODE):
        if not SMTP_USERNAME or not SMTP_PASSWORD:
            return Response(
                {"error": "SMTP belum dikonfigurasi. Hubungi admin."},
                status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
            )

    user = None
    try:
        if "@" in identifier:
            user = _User.objects.filter(email__iexact=identifier).order_by("id").first()
        else:
            user = _User.objects.filter(username__iexact=identifier).order_by("id").first()
    except Exception:
        user = None

    # Only send if user exists AND has email
    if user:
        to_email = (getattr(user, "email", "") or "").strip()
        if to_email:
            reset_id, token = _create_password_reset(user_id=user.id)
            base = _public_base_url(request)
            reset_link = f"{base}/reset-password?rid={reset_id}&token={token}"

            try:
                _send_password_reset_email(to_email, reset_link)
            except Exception as e:
                logger.exception("Password reset email send failed user=%s: %s", user.id, e)
                return Response(
                    {"error": "Gagal mengirim email reset. Coba lagi atau hubungi admin."},
                    status=drf_status.HTTP_503_SERVICE_UNAVAILABLE,
                )

    return Response(
        {"ok": True, "message": "Jika akun terdaftar, link reset sudah dikirim ke email Anda."},
        status=drf_status.HTTP_200_OK,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def password_reset_confirm(request):
    """
    Body: { reset_id, token, new_password }
    """
    reset_id = (request.data.get("reset_id") or request.data.get("rid") or "").strip()
    token = (request.data.get("token") or "").strip()
    new_password = request.data.get("new_password") or ""

    if not reset_id or not token:
        return Response({"error": "Link reset tidak valid."}, status=drf_status.HTTP_400_BAD_REQUEST)
    if not new_password:
        return Response({"error": "Password baru wajib diisi."}, status=drf_status.HTTP_400_BAD_REQUEST)

    payload, err = _verify_password_reset(reset_id, token)
    if err:
        return Response({"error": err}, status=drf_status.HTTP_400_BAD_REQUEST)

    user_id = int(payload.get("user_id") or 0)
    try:
        user = _User.objects.get(id=user_id)
    except _User.DoesNotExist:
        return Response({"error": "User tidak ditemukan."}, status=drf_status.HTTP_400_BAD_REQUEST)

    try:
        validate_password(new_password, user=user)
    except ValidationError as e:
        return Response(
            {"error": "Password tidak valid.", "details": list(e.messages)},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    user.set_password(new_password)
    user.save(update_fields=["password"])

    # Invalidate link after successful reset
    cache.delete(_pwdreset_key(reset_id))

    return Response({"ok": True}, status=drf_status.HTTP_200_OK)

# --- Marker detection helpers (fast text + OCR fallback) ---
def _crop_top_right_b64(image_path: str, w_frac: float = 0.35, h_frac: float = 0.25) -> str:
    """Return base64 of a top-right crop of the image."""
    img = Image.open(image_path).convert("RGB")
    w, h = img.size
    cw, ch = max(1, int(w * w_frac)), max(1, int(h * h_frac))
    left = w - cw
    upper = 0
    right = w
    lower = ch
    crop = img.crop((left, upper, right, lower))
    buf = io.BytesIO()
    crop.save(buf, format="JPEG", quality=80)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _detect_marker_on_page(pdf_doc, page_index: int) -> tuple[str | None, int | None]:
    """Fast text-only detection of ALPHA[-x] or BETA on a page (search entire page text)."""
    try:
        page = pdf_doc.load_page(page_index)
        txt = (page.get_text("text") or "").lower()
    except Exception:
        txt = ""

    # Greek letters too
    # Prefer ALPHA-x capture
    m = re.search(r"\balpha\s*-\s*(\d+)\b|α\s*-\s*(\d+)\b", txt)
    if m:
        num = next((g for g in m.groups() if g), None)
        return "ALPHA", int(num) if num and num.isdigit() else None

    # Plain ALPHA without number
    if re.search(r"\balpha\b|\bα\b", txt):
        return "ALPHA", None

    # BETA
    if re.search(r"\bbeta\b|\bβ\b", txt):
        return "BETA", None

    return None, None


def _detect_marker_on_page_smart(pdf_doc, page_index: int) -> tuple[str | None, int | None]:
    """Fast detection first; if none, OCR the top-right crop via GPT vision."""
    tag, x = _detect_marker_on_page(pdf_doc, page_index)
    if tag:
        return tag, x
    # OCR fallback
    try:
        img_path = _save_page_image(pdf_doc, page_index, dpi=100)
        b64 = _crop_top_right_b64(img_path)
        try:
            os.remove(img_path)
        except Exception:
            pass
        data = gpt_detect_corner_marker(b64)
        return data.get("tag"), data.get("x")
    except Exception:
        return None, None


def _detect_from_existing_png(png_path: str) -> tuple[str | None, int | None]:
    """Try local OCR first (pytesseract), then GPT crop. Returns (tag, x)."""
    # local OCR (optional)
    try:
        import pytesseract  # type: ignore
        txt = pytesseract.image_to_string(Image.open(png_path), lang="eng").lower()
        if "beta" in txt or "β" in txt:
            return ("BETA", None)
        if "alpha" in txt or "α" in txt:
            m = re.search(r"alpha\s*[-–—]?\s*(\d+)", txt)
            return ("ALPHA", int(m.group(1)) if m else None)
    except Exception:
        pass
    # GPT fallback (crop only the top-right)
    try:
        b64 = _crop_top_right_b64(png_path, w_frac=0.28, h_frac=0.20)
        out = _gptp.gpt_detect_corner_marker(b64)
        if out.get("tag") in ("ALPHA", "BETA"):
            return out["tag"], out.get("x")
    except Exception:
        pass
    return (None, None)

def _row_ctx(parsed):
    ctx = []
    for s_idx, sec in enumerate(parsed or []):
        tbl = sec.get("table") or []
        if not tbl or len(tbl) < 2:
            continue
        headers = tbl[0]
        try:
            ref_i = headers.index("REF_CODE")
        except ValueError:
            ref_i = len(headers) - 1
        for r_idx, row in enumerate(tbl[1:]):
            if len(row) <= ref_i:
                continue
            ctx.append({
                "section_index": s_idx,
                "row_index": r_idx,
                "company": sec.get("company") or "",
                "headers": headers,
                "cells": row,
                "ref_code": row[ref_i],
            })
    return ctx


# ---------------------------------------------------------------------------
# Missing helpers (were referenced but not defined; caused 500 NameError)
# ---------------------------------------------------------------------------

def _parse_ymd(s: str | None):
    """Parse YYYY-MM-DD into datetime.date; return None on empty/invalid."""
    if not s:
        return None
    try:
        return datetime.strptime(s.strip(), "%Y-%m-%d").date()
    except Exception:
        return None


_ID_MONTHS = {
    1: "Januari",
    2: "Februari",
    3: "Maret",
    4: "April",
    5: "Mei",
    6: "Juni",
    7: "Juli",
    8: "Agustus",
    9: "September",
    10: "Oktober",
    11: "November",
    12: "Desember",
}


def _format_date_long_id(d):
    """Format date/datetime as '7 Januari 2026'. Returns '-' for None."""
    if not d:
        return "-"
    if isinstance(d, datetime):
        d = d.date()
    if isinstance(d, str):
        # best-effort: accept ISO strings
        try:
            d = datetime.fromisoformat(d).date()
        except Exception:
            return d
    try:
        return f"{d.day} {_ID_MONTHS.get(d.month, str(d.month))} {d.year}"
    except Exception:
        return str(d)


def _idr_to_int(value) -> int:
    """
    Parse Indonesian currency-ish strings to int.
    Examples: 'Rp 1.234.567' -> 1234567, '1.234,00' -> 1234.
    """
    if value is None:
        return 0
    s = str(value).strip()
    if not s:
        return 0

    neg = False
    if "(" in s and ")" in s:
        neg = True
    if s.startswith("-"):
        neg = True

    s = s.lower().replace("rp", "").replace("idr", "").strip()

    # Drop decimal part if it looks like ",00" / ",0" / ",12"
    if "," in s:
        left, right = s.rsplit(",", 1)
        if re.fullmatch(r"\s*\d{1,2}\s*", right or ""):
            s = left

    digits = re.findall(r"\d+", s)
    if not digits:
        return 0

    n = int("".join(digits))
    return -n if neg else n


_MONTH_NAME_MAP = {
    "jan": 1,
    "januari": 1,
    "feb": 2,
    "februari": 2,
    "mar": 3,
    "maret": 3,
    "apr": 4,
    "april": 4,
    "mei": 5,
    "jun": 6,
    "juni": 6,
    "jul": 7,
    "juli": 7,
    "agu": 8,
    "agustus": 8,
    "sep": 9,
    "september": 9,
    "okt": 10,
    "oktober": 10,
    "nov": 11,
    "november": 11,
    "des": 12,
    "desember": 12,
}


def _parse_tanggal_masuk_from_keterangan(text: str | None):
    """Best-effort extract a date from a BBM 'keterangan' string."""
    s = (text or "").strip()
    if not s:
        return None

    # dd/mm/yyyy or dd-mm-yy etc
    for m in re.finditer(r"(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})", s):
        dd, mm, yy = m.group(1), m.group(2), m.group(3)
        try:
            d = int(dd)
            mo = int(mm)
            y = int(yy)
            if y < 100:
                y += 2000
            return date(y, mo, d)
        except Exception:
            continue

    # dd <monthname> yyyy (Indonesian)
    m2 = re.search(r"(\d{1,2})\s*([A-Za-z]{3,10})\s*(\d{2,4})", s)
    if m2:
        try:
            d = int(m2.group(1))
            mon_raw = m2.group(2).lower()
            y = int(m2.group(3))
            if y < 100:
                y += 2000
            mo = _MONTH_NAME_MAP.get(mon_raw)
            if mo:
                return date(y, mo, d)
        except Exception:
            pass

    return None


def _parse_liter_from_keterangan(text: str | None) -> int:
    """Best-effort extract liters from keterangan, returns int (0 if not found)."""
    s = (text or "").lower()
    if not s:
        return 0

    # e.g. "200 l", "200 liter", "200ltr", "1.000 L"
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(l|liter|ltr)\b", s)
    if not m:
        return 0

    raw = m.group(1)

    # Normalize Indonesian numeric formatting
    # If "1.000" (thousands) and no comma, treat dots as thousands separators.
    if raw.count(".") >= 1 and raw.count(",") == 0:
        parts = raw.split(".")
        if all(len(p) == 3 for p in parts[1:]):
            raw = "".join(parts)

    # If "1.234,5" -> "1234.5"
    if raw.count(",") == 1 and raw.count(".") >= 1:
        raw = raw.replace(".", "").replace(",", ".")
    elif raw.count(",") == 1 and raw.count(".") == 0:
        raw = raw.replace(",", ".")

    try:
        return int(round(float(raw)))
    except Exception:
        return 0


def _shorten_keterangan_bbm(text: str | None, max_len: int = 90) -> str:
    """Compact whitespace + shorten for recap display."""
    s = re.sub(r"\s+", " ", (text or "")).strip()
    if not s:
        return ""
    # Light normalization (don't over-destroy info)
    s = re.sub(r"(?i)\b(po\s*)?pembayaran\s+solar\b", "Pembayaran Solar", s)
    if len(s) > max_len:
        return s[: max_len - 3].rstrip() + "..."
    return s


def _has_grand_total(parsed) -> bool:
    """True if any dict item contains 'grand_total'."""
    for x in parsed or []:
        if isinstance(x, dict) and "grand_total" in x:
            return True
    return False


def _strip_grand_totals(parsed):
    """Remove any {'grand_total': ...} objects from the list."""
    return [x for x in (parsed or []) if not (isinstance(x, dict) and "grand_total" in x)]


_EXPECTED_HDR = {"no", "keterangan", "dibayar ke", "bank", "pengiriman"}


def _looks_like_continuation(prev_sections, cur_sections) -> bool:
    """
    Heuristic: treat as recap-continuation if GPT returned at least one table-like
    section with expected headers (or row numbering).
    """
    if not cur_sections:
        return False
    if _has_grand_total(cur_sections):
        return True

    for sec in cur_sections:
        if not isinstance(sec, dict):
            continue
        tbl = sec.get("table")
        if not isinstance(tbl, list) or not tbl:
            continue
        hdr = tbl[0] if isinstance(tbl[0], list) else []
        hdr_lower = [str(h or "").strip().lower() for h in hdr]
        hits = sum(1 for h in hdr_lower if h in _EXPECTED_HDR)
        if "keterangan" in hdr_lower and hits >= 3:
            return True

        # fallback: if it has rows and first cell is numeric-ish
        if len(tbl) >= 2 and isinstance(tbl[1], list) and tbl[1]:
            if str(tbl[1][0]).strip().isdigit():
                return True

    return False


def _save_page_image(pdf: fitz.Document, page_index: int, dpi: int = 144) -> str:
    """Render a PDF page to a temporary PNG file; returns file path."""
    page = pdf.load_page(page_index)
    scale = float(dpi) / 72.0
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat, alpha=False)

    fd, out_path = tempfile.mkstemp(suffix=".png")
    os.close(fd)
    pix.save(out_path)
    return out_path


def _save_single_page_pdf(pdf: fitz.Document, page_index: int) -> str:
    """Extract one page into a temporary single-page PDF; returns file path."""
    out = fitz.open()
    out.insert_pdf(pdf, from_page=page_index, to_page=page_index)

    fd, out_path = tempfile.mkstemp(suffix=".pdf")
    os.close(fd)
    out.save(out_path)
    out.close()
    return out_path


def _encode_preview(image_path: str, stem: str, max_w: int = 1200):
    """
    Encode a preview image (prefer WEBP, fallback JPEG).
    Returns: (django.core.files.File, ext)
    """
    img = Image.open(image_path)
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "L"):
        img = img.convert("RGB")

    if max_w and img.width > max_w:
        new_h = max(1, int(img.height * (max_w / float(img.width))))
        img = img.resize((max_w, new_h), Image.LANCZOS)

    # Try WEBP first
    buf = io.BytesIO()
    try:
        img.save(buf, format="WEBP", quality=78, method=6)
        buf.seek(0)
        return File(buf, name=f"{stem}.webp"), ".webp"
    except Exception:
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=82, optimize=True)
        buf.seek(0)
        return File(buf, name=f"{stem}.jpg"), ".jpg"


@api_view(["POST"])
@permission_classes([IsAuthenticated])
# REPLACED: multi-page parse + auto attachment of remaining pages
def parse_and_store_view(request):
    global OCR_MARKER_BUDGET
    job_id = request.headers.get("X-Job-ID")  # client-generated UUID
    progress_update(job_id, 1, "Menyiapkan unggahan")
    up = request.FILES.get("file")
    if not up:
        progress_update(job_id, 100, "Gagal: tidak ada file")
        return JsonResponse({"error": "No file uploaded"}, status=400)

    title   = request.data.get("title", "Untitled Document")
    company = request.data.get("company", "ttu")
    doc_type= request.data.get("doc_type", "tagihan_pekerjaan")

    ext = os.path.splitext(up.name)[1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        for c in up.chunks():
            tmp.write(c)
        tmp_path = tmp.name
    progress_update(job_id, 2, "Unggahan diterima")

    parsed, table_pages = [], 1
    pdf = None

    if ext == ".pdf":
        pdf = fitz.open(tmp_path)
        progress_update(job_id, 5, "Membaca halaman 1")

        # --- parse recap block across N pages ---
        parsed = []
        table_pages = 0

        # page 0 is recap by definition in current format
        p0_png = _save_page_image(pdf, 0)
        _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
        p0 = gpt_parse_subsections_from_image(p0_png) or []
        _gptp.install_progress(None)
        os.remove(p0_png)
        parsed.extend(p0)
        table_pages = 1
        progress_update(job_id, 10, "Halaman 1 selesai")

        # keep reading recap pages until GRAND TOTAL is found
        for idx in range(1, pdf.page_count):
            if _has_grand_total(parsed):
                break
            page_text = (pdf.load_page(idx).get_text("text") or "").lower()

            png = _save_page_image(pdf, idx)
            try:
                # Parse first, then decide if this is a valid continuation or the closing page
                _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
                cur = gpt_parse_subsections_from_image(png) or []
                _gptp.install_progress(None)

                # valid if it looks like recap continuation or contains grand_total
                is_valid = _looks_like_continuation(parsed[-1:], cur) or _has_grand_total(cur)
                # also accept pages that show the closing sentence even if header is absent
                end_marker = ("total cek yang mau dibuka" in page_text) or ("total cek yang dibuka" in page_text)
                if not is_valid and not end_marker:
                    break

                if end_marker and not _has_grand_total(cur):
                    # ensure we record the closing marker even if the model returned no JSON
                    cur = cur + [{"grand_total": ""}]

                parsed.extend(cur)
                table_pages = idx + 1
                if _has_grand_total(cur):
                    break
            finally:
                try:
                    os.remove(png)
                except Exception:
                    pass

        progress_update(job_id, 15, "Ekstraksi tabel")
        parsed = _strip_grand_totals(parsed)
    else:
        progress_update(job_id, 5, "Membaca gambar")
        _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
        parsed = gpt_parse_subsections_from_image(tmp_path) or []
        _gptp.install_progress(None)
        table_pages = 1

    # Inject REF_CODE post-merge
    used_codes = set()
    for sec in parsed:
        tbl = sec.get("table")
        if not tbl:
            continue
        hdr = tbl[0]
        if "REF_CODE" not in hdr:
            hdr.append("REF_CODE")
        for row in tbl[1:]:
            if len(row) < len(hdr):
                ref = generate_unique_item_ref_code(used_codes)
                used_codes.add(ref)
                row.append(ref)

    # Detect mode and publish item counts (after items built)
    up = request.FILES.get("file")
    ext_name = (up.name.rsplit(".", 1)[-1].lower() if up and "." in up.name else "")
    TABLE_EXTS = {"csv", "tsv", "xlsx", "xls", "json"}
    mode = "table_only" if ext_name in TABLE_EXTS else "pdf"
    items_ctx = _row_ctx(parsed)
    total_items = len(items_ctx)
    progress_update(
        job_id,
        20,
        "Tabel selesai & items terbentuk",
        mode=mode,
        total_items=total_items,
        current_item=0,
    )

    doc = Document.objects.create(
        title=title,
        company=company,
        doc_type=doc_type,
        status="draft",
        file=up,
        parsed_json=recalc_totals(parsed) if parsed else parsed,
    )

    attached = 0
    # If table-only (no supporting docs phase), finish cleanly after saving items
    if mode == "table_only" or total_items == 0:
        os.remove(tmp_path)
        progress_update(
            job_id,
            96,
            "Menyimpan ke basis data",
            mode=mode,
            total_items=total_items,
            current_item=total_items,
        )
        progress_update(
            job_id,
            100,
            "Selesai (tanpa dokumen pendukung)",
            mode=mode,
            total_items=total_items,
            current_item=total_items,
        )
        return JsonResponse({
            "document_id": doc.id,
            "document_code": doc.document_code,
            "attached_pages": attached,
            "table_pages": table_pages,
        }, status=201)
    if pdf and pdf.page_count > table_pages:
        items_ctx = _row_ctx(parsed)
        if items_ctx:
            total_items = len(items_ctx)
            seq = {c["ref_code"]: 0 for c in items_ctx}

            # Probe for marker presence on the first supporting page (fast only)
            marker_present = False
            try:
                tag0, _x0 = _detect_marker_on_page(pdf, table_pages)
                marker_present = bool(tag0)
            except Exception:
                marker_present = False

            if marker_present:
                # === Marker mode (fast path): stop detecting while counting ===
                in_group = False
                expected = 1
                group_pages = 0
                item_idx = 0

                # Policy and OCR budget
                alpha_plain_policy = os.environ.get("ALPHA_PLAIN_POLICY", "one").lower()  # 'one' or 'until_beta'
                ocr_budget = int(os.environ.get("OCR_MARKER_BUDGET", "2"))

                p = table_pages
                while p < pdf.page_count and item_idx < total_items:
                    # Render once per page when needed; reuse PNG for OCR and preview
                    page_png = _save_page_image(pdf, p, dpi=144)

                    if not in_group:
                        # Fast text first; allow a tiny OCR probe window (first two supporting pages)
                        tag, x = _detect_marker_on_page(pdf, p)
                        if tag is None and (p - table_pages) < 2 and ocr_budget > 0:
                            tag, x = _detect_from_existing_png(page_png)
                            if tag:
                                ocr_budget -= 1

                        if tag == "ALPHA":
                            # Start a new group for the current item
                            ref = items_ctx[item_idx]["ref_code"] if item_idx < total_items else "UNASSIGNED"
                            progress_update(
                                job_id,
                                20 + int(80 * item_idx / max(1, total_items)),
                                f"Mulai isi dokumen pendukung: item {item_idx+1}/{total_items}",
                                mode=mode,
                                total_items=total_items,
                                current_item=item_idx + 1,
                            )

                            # expected pages based on ALPHA-x; plain ALPHA via policy
                            if isinstance(x, (int, str)) and str(x).isdigit():
                                expected = int(x)
                            else:
                                expected = None if alpha_plain_policy == "until_beta" else 1
                            in_group, group_pages = True, 0

                            # Attach ALPHA page (reuse page_png)
                            if ref not in seq:
                                seq[ref] = 0
                            seq[ref] += 1
                            page_pdf = _save_single_page_pdf(pdf, p)
                            title_i = f"Lampiran {ref} #{seq[ref]}"
                            with open(page_pdf, "rb") as fp:
                                sdoc = SupportingDocument(
                                    main_document=doc,
                                    item_ref_code=ref,
                                    supporting_doc_sequence=seq[ref],
                                    title=title_i,
                                    company_name=items_ctx[item_idx].get("company") or company,
                                    section_index=items_ctx[item_idx]["section_index"],
                                    row_index=items_ctx[item_idx]["row_index"],
                                    status="draft",
                                    ai_auto_attached=True,
                                    ai_confidence=1.0,
                                    ai_low_confidence=False,
                                )
                                sdoc.file.save(
                                    f"{doc.document_code}_S{items_ctx[item_idx]['section_index']+1}R{items_ctx[item_idx]['row_index']+1}_{seq[ref]}.pdf",
                                    File(fp),
                                    save=True,
                                )
                            try:
                                with open(page_png, "rb") as fp_img:
                                    fileobj_pg, ext_pg = _encode_preview(page_png, f"{doc.document_code}_{ref}_{seq[ref]}")
                                    sdoc.preview_image.save(
                                        f"{doc.document_code}_{ref}_{seq[ref]}{ext_pg}",
                                        fileobj_pg,
                                        save=True,
                                    )
                            finally:
                                try:
                                    os.remove(page_png)
                                except Exception:
                                    pass
                                try:
                                    os.remove(page_pdf)
                                except Exception:
                                    pass
                            attached += 1
                            group_pages += 1

                            # If only 1 page expected, close immediately
                            if expected == 1:
                                in_group = False
                                item_idx += 1
                                p += 1
                                continue

                            # Fast-path: attach the next (expected - 1) pages with no detection
                            end = min(pdf.page_count, p + expected)
                            q = p + 1
                            while q < end:
                                # render once, attach, reuse preview
                                ref = items_ctx[item_idx]["ref_code"] if item_idx < total_items else "UNASSIGNED"
                                if ref not in seq:
                                    seq[ref] = 0
                                seq[ref] += 1

                                page_pdf = _save_single_page_pdf(pdf, q)
                                page_png2 = _save_page_image(pdf, q, dpi=144)
                                title_i = f"Lampiran {ref} #{seq[ref]}"
                                with open(page_pdf, "rb") as fp:
                                    sdoc2 = SupportingDocument(
                                        main_document=doc,
                                        item_ref_code=ref,
                                        supporting_doc_sequence=seq[ref],
                                        title=title_i,
                                        company_name=items_ctx[item_idx].get("company") or company,
                                        section_index=items_ctx[item_idx]["section_index"],
                                        row_index=items_ctx[item_idx]["row_index"],
                                        status="draft",
                                        ai_auto_attached=True,
                                        ai_confidence=1.0,
                                        ai_low_confidence=False,
                                    )
                                    sdoc2.file.save(
                                        f"{doc.document_code}_S{items_ctx[item_idx]['section_index']+1}R{items_ctx[item_idx]['row_index']+1}_{seq[ref]}.pdf",
                                        File(fp),
                                        save=True,
                                    )
                                try:
                                    with open(page_png2, "rb") as fp_img:
                                        fileobj_pg2, ext_pg2 = _encode_preview(page_png2, f"{doc.document_code}_{ref}_{seq[ref]}")
                                        sdoc2.preview_image.save(
                                            f"{doc.document_code}_{ref}_{seq[ref]}{ext_pg2}",
                                            fileobj_pg2,
                                            save=True,
                                        )
                                finally:
                                    try:
                                        os.remove(page_png2)
                                    except Exception:
                                        pass
                                    try:
                                        os.remove(page_pdf)
                                    except Exception:
                                        pass
                                attached += 1
                                group_pages += 1
                                q += 1

                            # Close group and move to next item
                            in_group = False
                            item_idx += 1
                            p = end
                            continue

                        # Not ALPHA → skip until first ALPHA
                        p += 1
                        try:
                            os.remove(page_png)
                        except Exception:
                            pass
                        continue

                    # in_group without numeric x → only possible when policy == 'until_beta'
                    tag, _ = _detect_marker_on_page(pdf, p)
                    if tag is None and (group_pages in (5, 10)) and ocr_budget > 0:
                        t2, _x2 = _detect_from_existing_png(page_png)
                        if t2:
                            tag = t2
                            ocr_budget -= 1

                    # Attach page
                    ref = items_ctx[item_idx]["ref_code"] if item_idx < total_items else "UNASSIGNED"
                    if ref not in seq:
                        seq[ref] = 0
                    seq[ref] += 1
                    page_pdf = _save_single_page_pdf(pdf, p)
                    title_i = f"Lampiran {ref} #{seq[ref]}"
                    with open(page_pdf, "rb") as fp:
                        sdoc = SupportingDocument(
                            main_document=doc,
                            item_ref_code=ref,
                            supporting_doc_sequence=seq[ref],
                            title=title_i,
                            company_name=items_ctx[item_idx].get("company") or company,
                            section_index=items_ctx[item_idx]["section_index"],
                            row_index=items_ctx[item_idx]["row_index"],
                            status="draft",
                            ai_auto_attached=True,
                            ai_confidence=1.0,
                            ai_low_confidence=False,
                        )
                        sdoc.file.save(
                            f"{doc.document_code}_S{items_ctx[item_idx]['section_index']+1}R{items_ctx[item_idx]['row_index']+1}_{seq[ref]}.pdf",
                            File(fp),
                            save=True,
                        )
                    try:
                        with open(page_png, "rb") as fp_img:
                            fileobj_pg3, ext_pg3 = _encode_preview(page_png, f"{doc.document_code}_{ref}_{seq[ref]}")
                            sdoc.preview_image.save(
                                f"{doc.document_code}_{ref}_{seq[ref]}{ext_pg3}",
                                fileobj_pg3,
                                save=True,
                            )
                    finally:
                        try:
                            os.remove(page_png)
                        except Exception:
                            pass
                        try:
                            os.remove(page_pdf)
                        except Exception:
                            pass
                    attached += 1
                    group_pages += 1
                    if tag == "BETA":
                        in_group = False
                        item_idx += 1
                    p += 1
            else:
                # === Fallback: original GPT classification per page ===
                current_ref = None
                ptr = 0
                for i, p in enumerate(range(table_pages, pdf.page_count), 1):
                    page_pdf = _save_single_page_pdf(pdf, p)
                    page_png = _save_page_image(pdf, p)
                    decision = gpt_belongs_to_current(
                        page_png,
                        current_row=items_ctx[ptr],
                        next_row=items_ctx[ptr + 1] if ptr + 1 < len(items_ctx) else None,
                    )
                    stay = bool(decision.get("stay", True))
                    if not stay and ptr + 1 < len(items_ctx):
                        ptr += 1
                    cur = items_ctx[ptr]
                    ref = cur["ref_code"]

                    if ref != current_ref:
                        item_idx = ptr
                        pct = 20 + int(80 * item_idx / max(1, total_items))
                        progress_update(
                            job_id,
                            pct,
                            f"Mulai isi dokumen pendukung: item {item_idx+1}/{total_items}",
                            mode=mode,
                            total_items=total_items,
                            current_item=item_idx + 1,
                        )
                        current_ref = ref

                    seq[ref] += 1
                    conf = float(decision.get("confidence", 0.0))
                    LOW = 0.55
                    title_i = f"Lampiran {ref} #{seq[ref]}"
                    with open(page_pdf, "rb") as fp:
                        sdoc = SupportingDocument(
                            main_document=doc,
                            item_ref_code=ref,
                            supporting_doc_sequence=seq[ref],
                            title=title_i,
                            company_name=cur.get("company") or company,
                            section_index=cur["section_index"],
                            row_index=cur["row_index"],
                            status="draft",
                            ai_auto_attached=True,
                            ai_confidence=conf,
                            ai_low_confidence=(conf < LOW),
                        )
                        sdoc.file.save(
                            f"{doc.document_code}_S{cur['section_index']+1}R{cur['row_index']+1}_{seq[ref]}.pdf",
                            File(fp),
                            save=True,
                        )
                    try:
                        with open(page_png, "rb") as fp_img:
                            fileobj_pg4, ext_pg4 = _encode_preview(page_png, f"{doc.document_code}_{ref}_{seq[ref]}")
                            sdoc.preview_image.save(
                                f"{doc.document_code}_{ref}_{seq[ref]}{ext_pg4}",
                                fileobj_pg4,
                                save=True,
                            )
                    finally:
                        try:
                            os.remove(page_png)
                        except Exception:
                            pass
                        os.remove(page_pdf)
                    attached += 1
                    # no per-page progress updates
        pdf.close()

    os.remove(tmp_path)
    progress_update(job_id, 96, "Menyimpan ke basis data")
    progress_update(job_id, 100, "Selesai")
    return JsonResponse({
        "document_id": doc.id,
        "document_code": doc.document_code,
        "attached_pages": attached,
        "table_pages": table_pages,
    }, status=201)


@api_view(['POST'])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')

    user = authenticate(username=username, password=password)
    
    if user:
        group_names = list(user.groups.values_list('name', flat=True))
        # Explicitly set role per group
        if 'owner' in group_names:
            role = 'owner'
        elif 'boss' in group_names:
            role = 'higher-up'
        elif 'admin' in group_names:
            role = 'employee'
        else:
            role = 'employee'
        return Response({"role": role}, status=drf_status.HTTP_200_OK)

    return Response({"error": "Invalid credentials"}, status=drf_status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_info(request):
    user = request.user
    groups = list(user.groups.values_list('name', flat=True))
    return Response({
        "username": user.username,
        "groups": groups,
    })


class UserSettingsView(RetrieveUpdateAPIView):
    serializer_class = UserSettingsSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        # create row on-the-fly the first time
        obj, _ = UserSettings.objects.get_or_create(user=self.request.user)
        return obj


class PaymentProofViewSet(viewsets.ModelViewSet):
    queryset = PaymentProof.objects.all()
    serializer_class = PaymentProofSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PaymentProof.objects.all()
        main_document = self.request.query_params.get("main_document")
        if main_document:
            qs = qs.filter(main_document_id=main_document)
        return qs

    # 🔒 Block edits when main doc is archived / paid
    def _ensure_editable(self, main_doc: Document):
        if main_doc.archived or main_doc.status == "sudah_dibayar":
            raise PermissionDenied(
                "Dokumen sudah diarsipkan/dikirim ke direktori; bukti pembayaran tidak bisa diubah."
            )

    def perform_create(self, serializer):
        # Replace existing proof if one exists, BUT lock after archive/paid
        main_doc = serializer.validated_data["main_document"]
        self._ensure_editable(main_doc)
        PaymentProof.objects.filter(
            main_document=main_doc,
            section_index=serializer.validated_data["section_index"],
            item_index=serializer.validated_data["item_index"],
        ).delete()
        proof: PaymentProof = serializer.save()
        # Mirror proof.identifier into PAY_REF cell for matching row
        pj = main_doc.parsed_json or []
        if 0 <= proof.section_index < len(pj):
            tbl = pj[proof.section_index].get("table")
            if tbl and len(tbl) >= 2 and 0 <= proof.item_index < (len(tbl) - 1):
                headers = tbl[0]
                if "PAY_REF" not in headers:
                    headers.append("PAY_REF")
                pay_idx = headers.index("PAY_REF")
                row = tbl[proof.item_index + 1]
                if len(row) <= pay_idx:
                    row.extend([""] * (pay_idx + 1 - len(row)))
                row[pay_idx] = proof.identifier
                main_doc.parsed_json = pj
                main_doc.save(update_fields=["parsed_json"])

    def partial_update(self, request, *args, **kwargs):
        instance: PaymentProof = self.get_object()
        self._ensure_editable(instance.main_document)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance: PaymentProof = self.get_object()
        self._ensure_editable(instance.main_document)
        # Clear mirrored PAY_REF when deleting a proof
        doc = instance.main_document
        pj = doc.parsed_json or []
        if 0 <= instance.section_index < len(pj):
            tbl = pj[instance.section_index].get("table")
            if tbl and len(tbl) >= 2 and 0 <= instance.item_index < (len(tbl) - 1):
                headers = tbl[0]
                if "PAY_REF" in headers:
                    pay_idx = headers.index("PAY_REF")
                    row = tbl[instance.item_index + 1]
                    if len(row) > pay_idx:
                        row[pay_idx] = ""
                    doc.parsed_json = pj
                    doc.save(update_fields=["parsed_json"])
        return super().destroy(request, *args, **kwargs)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def rekap_view(request, company_code: str, rekap_key: str):
    """
    Return a recap table (e.g. Rekap BBM) built from archived QLOLA documents
    for a given company and date range.

    Path params:
      - company_code: 'ttu', 'asn', 'ols', 'olm'
      - rekap_key: 'bbm', ...

    Query params:
      - from: YYYY-MM-DD (inclusive)  → Tanggal Pengajuan (created_at)
      - to:   YYYY-MM-DD (inclusive)
    """
    config = REKAP_CONFIG.get(rekap_key)
    if not config:
        return Response(
            {"detail": f"Unknown rekap type: {rekap_key!r}"},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    from_str = request.query_params.get("from")
    to_str = request.query_params.get("to")
    date_from = _parse_ymd(from_str)
    date_to = _parse_ymd(to_str)

    if (from_str and not date_from) or (to_str and not date_to):
        return Response(
            {"detail": "Parameter tanggal harus format YYYY-MM-DD."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )
    if date_from and date_to and date_from > date_to:
        return Response(
            {"detail": "Parameter 'from' tidak boleh lebih besar dari 'to'."},
            status=drf_status.HTTP_400_BAD_REQUEST,
        )

    company_code = (company_code or "").lower().strip()

    # Base queryset: archived, sudah_dibayar, correct company + doc_type
    qs = (
        Document.objects.filter(
            archived=True,
            status="sudah_dibayar",
            company=company_code,
            doc_type__in=config["doc_types"],
        )
        .order_by("created_at")
    )

    rows: list[list] = []
    meta_rows: list[dict] = []
    total_amount = 0
    keywords = [k.lower() for k in config["keywords"]]

    for doc in qs:
        # Gunakan tanggal pengajuan tagihan = created_at sebagai dasar filter
        if not doc.created_at:
            continue
        tgl_pengajuan = doc.created_at.date()
        if date_from and tgl_pengajuan < date_from:
            continue
        if date_to and tgl_pengajuan > date_to:
            continue

        sections = doc.parsed_json or []
        for s_idx, sec in enumerate(sections):
            if not isinstance(sec, dict):
                continue
            tbl = sec.get("table") or []
            if not tbl or len(tbl) < 2:
                continue

            header = [str(h or "") for h in tbl[0]]
            header_lower = [h.strip().lower() for h in header]

            try:
                k_idx = header_lower.index("keterangan")
            except ValueError:
                # Without KETERANGAN we can't classify BBM, skip this section
                continue

            # Lookup REF_CODE column index if present
            try:
                ref_idx = header.index("REF_CODE")
            except ValueError:
                ref_idx = None

            dby_idx = header_lower.index("dibayar ke") if "dibayar ke" in header_lower else None
            bank_idx = header_lower.index("bank") if "bank" in header_lower else None
            ship_idx = header_lower.index("pengiriman") if "pengiriman" in header_lower else None

            for r_idx, row in enumerate(tbl[1:]):
                # skip rows that are completely empty
                if not any(str(c or "").strip() for c in row):
                    continue

                keterangan = str(row[k_idx]) if k_idx < len(row) else ""
                dibayar_ke = (
                    str(row[dby_idx]) if dby_idx is not None and dby_idx < len(row) else ""
                )
                bank = str(row[bank_idx]) if bank_idx is not None and bank_idx < len(row) else ""
                pengiriman = (
                    str(row[ship_idx]) if ship_idx is not None and ship_idx < len(row) else ""
                )

                haystack = " ".join([keterangan, dibayar_ke, bank]).lower()
                if not any(kw in haystack for kw in keywords):
                    continue  # not a BBM row

                nominal = _idr_to_int(pengiriman)
                total_amount += nominal

                tgl_masuk = _parse_tanggal_masuk_from_keterangan(keterangan)
                jumlah_liter = _parse_liter_from_keterangan(keterangan)
                ket_singkat = _shorten_keterangan_bbm(keterangan)

                rows.append(
                    [
                        _format_date_long_id(tgl_pengajuan),  # Tanggal Pembayaran (using created_at)
                        _format_date_long_id(tgl_masuk),      # Tanggal Masuk
                        doc.document_code,                    # Kode Dokumen
                        ket_singkat or keterangan,            # Keterangan singkat
                        dibayar_ke,                           # Dibayar ke
                        jumlah_liter,                         # Jumlah Liter (int)
                        nominal,                               # Nominal (Rp)
                    ]
                )

                # Grab REF_CODE if available so frontend can anchor precisely
                ref_code = None
                if ref_idx is not None and ref_idx < len(row):
                    ref_code = row[ref_idx]

                meta_rows.append(
                    {
                        "document_code": doc.document_code,
                        "section_index": s_idx,
                        "row_index": r_idx,
                        "ref_code": ref_code,
                    }
                )

    result = {
        "company_code": company_code,
        "rekap_key": rekap_key,
        "rekap_label": config["label"],
        "from": date_from.isoformat() if date_from else None,
        "to": date_to.isoformat() if date_to else None,
        "total_rows": len(rows),
        "total_amount": total_amount,
        "columns": [
            "Tanggal Pembayaran",
            "Tanggal Masuk",
            "Kode Dokumen",
            "Keterangan",
            "Dibayar ke",
            "Jumlah Liter",
            "Nominal",
        ],
        "rows": rows,
        "meta": meta_rows,
    }
    return Response(result)

# ---------------------------------------------------------------------------
# Missing exports required by backend/backend/urls.py
# ---------------------------------------------------------------------------

# NOTE: Imported here (end-of-file) so we don't need to touch the large import
# block above. Python resolves globals at call time, so this is safe.
from rest_framework_simplejwt.tokens import RefreshToken


class DocumentViewSet(viewsets.ModelViewSet):
    """CRUD for main documents + a by-code lookup used by DocumentPreviewPage."""

    queryset = Document.objects.all().order_by("-created_at")
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    @action(detail=False, methods=["get"], url_path=r"by-code/(?P<code>[^/.]+)")
    def by_code(self, request, code=None):
        doc = get_object_or_404(Document, document_code=code)
        self.check_object_permissions(request, doc)
        return Response(self.get_serializer(doc).data)

    def partial_update(self, request, *args, **kwargs):
        instance: Document = self.get_object()

        # Lock edits after paid/archive (but still allow flipping archived=True).
        if instance.archived or instance.status == "sudah_dibayar":
            allowed = {"archived"}
            if any(k not in allowed for k in request.data.keys()):
                raise PermissionDenied(
                    "Dokumen sudah diarsipkan/dibayar; tidak dapat diubah lagi."
                )

        # Special: update PAY_REF cells by REF_CODE (frontend sends item_payment_refs)
        if "item_payment_refs" in request.data:
            refs = request.data.get("item_payment_refs")
            if not isinstance(refs, dict):
                return Response(
                    {"error": "item_payment_refs harus berupa object."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )

            pj = instance.parsed_json or []

            for ref_code, pay_ref in refs.items():
                ref_code_s = str(ref_code)
                pay_ref_s = "" if pay_ref is None else str(pay_ref)

                for sec in pj:
                    tbl = sec.get("table")
                    if not tbl or len(tbl) < 2:
                        continue
                    headers = tbl[0] or []
                    if "PAY_REF" not in headers:
                        headers.append("PAY_REF")
                    pay_idx = headers.index("PAY_REF")

                    # Pad all rows so r[pay_idx] exists.
                    for r in tbl[1:]:
                        while len(r) <= pay_idx:
                            r.append("")

                    # REF_CODE is always the last cell.
                    for r in tbl[1:]:
                        if r and str(r[-1]) == ref_code_s:
                            r[pay_idx] = pay_ref_s

            instance.parsed_json = pj
            instance.save(update_fields=["parsed_json", "updated_at"])
            return Response(self.get_serializer(instance).data)

        return super().partial_update(request, *args, **kwargs)

    def perform_update(self, serializer):
        before: Document = serializer.instance
        prev_status = before.status
        prev_archived = before.archived

        obj: Document = serializer.save()
        now = timezone.now()
        fields: list[str] = []

        if obj.status != prev_status:
            if obj.status == "disetujui":
                obj.approved_at = now
                fields.append("approved_at")
            elif obj.status == "rejected":
                obj.rejected_at = now
                fields.append("rejected_at")
            elif obj.status == "belum_disetujui":
                obj.finished_draft_at = now
                fields.append("finished_draft_at")
            elif obj.status == "sudah_dibayar":
                obj.paid_at = now
                fields.append("paid_at")

        if obj.archived and not prev_archived and not obj.archived_at:
            obj.archived_at = now
            fields.append("archived_at")

        if fields:
            obj.save(update_fields=fields)


class SupportingDocumentViewSet(viewsets.ModelViewSet):
    queryset = SupportingDocument.objects.all().order_by("supporting_doc_sequence")
    serializer_class = SupportingDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        main_document = self.request.query_params.get("main_document")
        if main_document:
            qs = qs.filter(main_document_id=main_document)
        return qs

    def _ensure_editable(self, main_doc: Document):
        if main_doc.archived or main_doc.status == "sudah_dibayar":
            raise PermissionDenied(
                "Dokumen sudah diarsipkan/dibayar; dokumen pendukung tidak bisa diubah."
            )

    def perform_create(self, serializer):
        main_doc: Document = serializer.validated_data["main_document"]
        self._ensure_editable(main_doc)
        ref = serializer.validated_data.get("item_ref_code")

        last = (
            SupportingDocument.objects.filter(main_document=main_doc, item_ref_code=ref)
            .order_by("-supporting_doc_sequence")
            .values_list("supporting_doc_sequence", flat=True)
            .first()
            or 0
        )
        serializer.save(supporting_doc_sequence=int(last) + 1)

    def perform_update(self, serializer):
        instance: SupportingDocument = serializer.instance
        self._ensure_editable(instance.main_document)
        if instance.status == "disetujui":
            raise PermissionDenied("Dokumen pendukung sudah disetujui; tidak bisa diubah.")

        prev_status = instance.status
        with transaction.atomic():
            obj: SupportingDocument = serializer.save()

            # On transition -> approved: stamp file bytes, then set approved_at
            if prev_status != obj.status and obj.status == "disetujui":
                now = timezone.now()

                # Embed the approval stamp into the stored PDF/image
                _stamp_supporting_doc_file_in_place(obj, now)

                obj.approved_at = now
                obj.save(update_fields=["approved_at"])

    def destroy(self, request, *args, **kwargs):
        instance: SupportingDocument = self.get_object()
        self._ensure_editable(instance.main_document)
        if instance.status == "disetujui":
            raise PermissionDenied("Dokumen pendukung sudah disetujui; tidak bisa dihapus.")
        return super().destroy(request, *args, **kwargs)


# --- Supporting document stamping (embed stamp into stored PDF/image) -------

STAMP_TEXT = "DISETUJUI"
STAMP_COLOR_IMG = (0, 160, 0)  # RGB for Pillow
STAMP_COLOR_PDF = (0, 0.62, 0)  # RGB floats 0..1 for PyMuPDF

FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FONT_REG = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"


def _stamp_dt(dt):
    # dd-mm-YYYY HH:MM
    return timezone.localtime(dt).strftime("%d-%m-%Y %H:%M")


def _stamp_image_in_place(path: str, approved_at):
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)

        # work in RGB
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        elif im.mode == "L":
            im = im.convert("RGB")

        draw = ImageDraw.Draw(im)

        # scale font sizes with image width
        big = max(24, int(im.width * 0.06))
        small = max(14, int(big * 0.45))

        try:
            f_big = ImageFont.truetype(FONT_BOLD, big)
            f_small = ImageFont.truetype(FONT_REG, small)
        except Exception:
            f_big = ImageFont.load_default()
            f_small = ImageFont.load_default()

        x = max(12, im.width // 80)
        y = x

        draw.text((x, y), STAMP_TEXT, fill=STAMP_COLOR_IMG, font=f_big)
        draw.text(
            (x, y + big + (x // 2)),
            _stamp_dt(approved_at),
            fill=STAMP_COLOR_IMG,
            font=f_small,
        )

        ext = os.path.splitext(path)[1].lower()
        fd, tmp = tempfile.mkstemp(suffix=ext)
        os.close(fd)
        try:
            if ext == ".png":
                im.save(tmp, format="PNG", optimize=True)
            else:
                # .jpg/.jpeg fallback
                im.save(tmp, format="JPEG", quality=92, optimize=True)
            os.replace(tmp, path)
        finally:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass


def _stamp_pdf_in_place(path: str, approved_at):
    dt_str = _stamp_dt(approved_at)

    pdf = fitz.open(path)
    try:
        for page in pdf:
            w = float(page.rect.width)
            fs_big = max(18.0, w * 0.05)  # roughly scales with page size
            fs_small = max(10.0, fs_big * 0.45)

            x = 36
            y = 36
            page.insert_text((x, y), STAMP_TEXT, fontsize=fs_big, color=STAMP_COLOR_PDF)
            page.insert_text(
                (x, y + fs_big + 2),
                dt_str,
                fontsize=fs_small,
                color=STAMP_COLOR_PDF,
            )

        fd, tmp = tempfile.mkstemp(suffix=".pdf")
        os.close(fd)
        try:
            pdf.save(tmp, deflate=True, garbage=4)
            os.replace(tmp, path)
        finally:
            try:
                if os.path.exists(tmp):
                    os.remove(tmp)
            except Exception:
                pass
    finally:
        pdf.close()


def _stamp_supporting_doc_file_in_place(sdoc: SupportingDocument, approved_at):
    path = getattr(sdoc.file, "path", None)
    if not path or not os.path.exists(path):
        raise FileNotFoundError("Supporting document file not found on disk.")

    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        _stamp_pdf_in_place(path, approved_at)
        return True
    if ext in {".png", ".jpg", ".jpeg"}:
        _stamp_image_in_place(path, approved_at)
        return True

    # For doc/docx/xls/xlsx: not supported for "engraving" without conversion.
    # Allow approval, but no stamp will be embedded.
    return False


def _clamp_int(v, default: int, lo: int, hi: int) -> int:
    try:
        i = int(v)
    except Exception:
        return default
    return max(lo, min(hi, i))


@api_view(["GET"])
@permission_classes([AllowAny])
def sdoc_preview(request, pk: int):
    """Render a lightweight preview image for a supporting document.

    Used by the frontend in <img src="..."> tags, so this endpoint must not rely
    on Authorization headers.

    Query params:
      - w: target width (px), default 640
      - fmt: webp|jpeg (optional)
    """

    sdoc = get_object_or_404(SupportingDocument, pk=pk)
    path = getattr(sdoc.file, "path", None)
    if not path or not os.path.exists(path):
        return HttpResponse(status=404)

    w = _clamp_int(request.GET.get("w"), default=640, lo=120, hi=1600)
    fmt = (request.GET.get("fmt") or "").strip().lower()
    if fmt not in {"webp", "jpeg", "jpg"}:
        accept = (request.headers.get("Accept") or "").lower()
        fmt = "webp" if "image/webp" in accept else "jpeg"
    if fmt == "jpg":
        fmt = "jpeg"

    # Cheap ETag based on file stat + requested transform.
    st = os.stat(path)
    etag = hashlib.sha1(f"{st.st_mtime_ns}-{st.st_size}-{w}-{fmt}".encode()).hexdigest()
    if (request.headers.get("If-None-Match") or "") == etag:
        resp = HttpResponse(status=304)
        resp["ETag"] = etag
        return resp

    ext = os.path.splitext(path)[1].lower()
    try:
        if ext == ".pdf":
            pdf = fitz.open(path)
            page = pdf.load_page(0)
            zoom = w / max(1.0, float(page.rect.width))
            zoom = max(0.2, min(6.0, zoom))
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
            pdf.close()
        else:
            img = Image.open(path)
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            # Resize only if larger.
            if img.width > w:
                h = int(img.height * (w / img.width))
                img = img.resize((w, max(1, h)), Image.LANCZOS)

        buf = io.BytesIO()
        if fmt == "webp":
            try:
                img.save(buf, format="WEBP", quality=78, method=6)
                content_type = "image/webp"
            except Exception:
                buf = io.BytesIO()
                img.save(buf, format="JPEG", quality=80, optimize=True)
                content_type = "image/jpeg"
        else:
            img.save(buf, format="JPEG", quality=80, optimize=True)
            content_type = "image/jpeg"

        data = buf.getvalue()
        resp = HttpResponse(data, content_type=content_type)
        resp["ETag"] = etag
        resp["Cache-Control"] = "public, max-age=86400"
        return resp
    except Exception as e:
        logger.exception("sdoc_preview failed: %s", e)
        return HttpResponse(status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kebun_outline_view(request, estate_code):
    try:
        estate_dir = _safe_estate_dir(estate_code)
        path = _first_existing(
            estate_dir / "outline.geojson",
            estate_dir / "outline.json",
            estate_dir / f"{estate_code}_outline.geojson",
            estate_dir / f"{estate_code}_outline.json",
        )
        with path.open("r", encoding="utf-8") as f:
            return Response(json.load(f))
    except FileNotFoundError as e:
        return Response({"detail": str(e)}, status=404)
    except Exception as e:
        return Response({"detail": f"Failed to load outline: {e}"}, status=500)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def kebun_blocks_view(request, estate_code):
    try:
        estate_dir = _safe_estate_dir(estate_code)
        path = _first_existing(
            estate_dir / "blocks.geojson",
            estate_dir / "blocks.json",
            estate_dir / f"{estate_code}_blocks.geojson",
            estate_dir / f"{estate_code}_blocks.json",
        )
        with path.open("r", encoding="utf-8") as f:
            return Response(json.load(f))
    except FileNotFoundError as e:
        return Response({"detail": str(e)}, status=404)
    except Exception as e:
        return Response({"detail": f"Failed to load blocks: {e}"}, status=500)
