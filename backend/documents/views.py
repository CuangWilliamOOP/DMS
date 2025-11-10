import io
import os
import re
import base64
import hashlib
import tempfile
import logging
import threading

import fitz
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from PIL import ImageOps
from django.contrib.auth import authenticate
from django.core.files import File
from django.http import JsonResponse
from django.core.cache import cache
from django.http import JsonResponse, HttpResponse
from django.shortcuts import get_object_or_404
from django.views.decorators.cache import never_cache
from django.utils import timezone
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

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

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().order_by("-created_at")
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def _all_items_have_payment_proof(self, doc: Document) -> bool:
        """Every meaningful table row must have a PaymentProof; blank rows & summary sections ignored."""
        proofs = set(doc.payment_proofs.values_list("section_index", "item_index"))
        for s_idx, sec in enumerate(doc.parsed_json or []):
            if isinstance(sec, dict) and "grand_total" in sec:
                continue  # skip summary/grand total blocks
            tbl = sec.get("table") or []
            if not tbl or len(tbl) < 2:
                continue
            hdr = tbl[0] or []
            ref_i = hdr.index("REF_CODE") if "REF_CODE" in hdr else None
            pay_i = hdr.index("PAY_REF") if "PAY_REF" in hdr else None
            for r_idx, row in enumerate(tbl[1:]):
                meaningful = any(
                    str(v or "").strip() for i, v in enumerate(row) if i not in (ref_i, pay_i)
                )
                if not meaningful:
                    continue
                if (s_idx, r_idx) not in proofs:
                    return False
        return True

    def _apply_status_transition(self, doc: Document, new_status: str, payload: dict):
        """Business‑rule enforcement for status field."""
        if new_status == "belum_disetujui":
            if not doc.supporting_docs.exists():
                return Response(
                    {"detail": "Minimal satu dokumen pendukung diperlukan."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            doc.finished_draft_at = timezone.now()

        elif new_status == "disetujui":
            # BLOCK approval if any supporting doc is not 'disetujui'
            unapproved = doc.supporting_docs.exclude(status="disetujui")
            if unapproved.exists():
                return Response(
                    {"detail": "Semua dokumen pendukung harus disetujui sebelum dokumen utama dapat disetujui."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            doc.approved_at = timezone.now()

        elif new_status == "rejected":
            comment = payload.get("reject_comment")
            if not comment:
                return Response(
                    {"detail": "Alasan penolakan harus diisi."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            doc.reject_comment = comment
            doc.rejected_at = timezone.now()

        elif new_status == "sudah_dibayar":
            # Require full PaymentProof coverage only
            if not self._all_items_have_payment_proof(doc):
                return Response(
                    {"detail": "Semua item harus punya bukti pembayaran sebelum menyelesaikan pembayaran."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            doc.paid_at = timezone.now()
            doc.archived = True
            doc.archived_at = timezone.now()

        doc.status = new_status
        return None

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()

        # Force recalc on every parsed_json update
        new_parsed = request.data.get("parsed_json", None)
        if new_parsed is not None:
            request.data["parsed_json"] = recalc_totals(new_parsed)

        item_pay_refs: dict | None = request.data.pop("item_payment_refs", None)
        serializer = self.get_serializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data.pop("status", None)
        instance = serializer.save()

        if item_pay_refs:
            changed = False
            all_refs = set()
            for section in instance.parsed_json or []:
                tbl = section.get("table")
                if not tbl:
                    continue
                headers = tbl[0]
                if "PAY_REF" not in headers:
                    headers.append("PAY_REF")
                ref_idx = headers.index("REF_CODE")
                pay_idx = headers.index("PAY_REF")

                for row in tbl[1:]:
                    if len(row) <= ref_idx:
                        continue
                    ref_code = row[ref_idx]
                    all_refs.add(ref_code)
                    if ref_code in item_pay_refs:
                        while len(row) <= pay_idx:
                            row.append("")
                        row[pay_idx] = item_pay_refs[ref_code]
                        changed = True

            unknown = set(item_pay_refs) - all_refs
            if unknown:
                return Response(
                    {"detail": f"Unknown REF_CODE(s): {', '.join(unknown)}"},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )
            if changed:
                instance.save(update_fields=["parsed_json"])

        if new_status and new_status != instance.status:
            err = self._apply_status_transition(instance, new_status, request.data)
            if err:
                return err
            instance.save()

        return Response(self.get_serializer(instance).data)

    update = partial_update

    @action(detail=False, url_path='by-code/(?P<code>[^/]+)', methods=['get'])
    def by_code(self, request, code=None):
        try:
            doc = Document.objects.get(document_code=code)
        except Document.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)
        serializer = self.get_serializer(doc)
        return Response(serializer.data)


class SupportingDocumentViewSet(viewsets.ModelViewSet):
    serializer_class = SupportingDocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = SupportingDocument.objects.all().order_by("supporting_doc_sequence")
        main_id = self.request.query_params.get("main_document")
        doc_type = self.request.query_params.get("doc_type")
        if main_id:
            qs = qs.filter(main_document_id=main_id)
        if doc_type:
            qs = qs.filter(doc_type=doc_type)
        return qs

    # 🔒 Block edits when main doc is archived / paid
    def _ensure_main_doc_is_editable(self, main_doc: Document):
        if main_doc.archived or main_doc.status == "sudah_dibayar":
            raise PermissionDenied("Dokumen di direktori; tidak bisa diubah.")

    def perform_create(self, serializer):
        item_ref_code = self.request.data.get("item_ref_code")
        if not item_ref_code:  # ← restore guard
            return Response(
                {"detail": "item_ref_code diperlukan."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        main_doc = serializer.validated_data["main_document"]
        self._ensure_main_doc_is_editable(main_doc)

        # Enforce only one proof_of_payment per item
        if serializer.validated_data.get("doc_type") == "proof_of_payment":
            existing = SupportingDocument.objects.filter(
                main_document=main_doc,
                item_ref_code=item_ref_code,
                doc_type="proof_of_payment",
            )
            if existing.exists():
                return Response(
                    {"detail": "Sudah ada bukti pembayaran untuk item ini."},
                    status=drf_status.HTTP_400_BAD_REQUEST,
                )

        latest = (
            SupportingDocument.objects.filter(
                main_document=main_doc, item_ref_code=item_ref_code
            )
            .order_by("-supporting_doc_sequence")
            .first()
        )
        next_seq = latest.supporting_doc_sequence + 1 if latest else 1
        sdoc = serializer.save(item_ref_code=item_ref_code, supporting_doc_sequence=next_seq)
        _ensure_preview_for_supporting_doc(sdoc)

    def partial_update(self, request, *args, **kwargs):
        instance: SupportingDocument = self.get_object()
        # 🔒 lock after archive/paid
        self._ensure_main_doc_is_editable(instance.main_document)

        if request.data.get("status") == "disetujui":
            instance.approved_at = timezone.now()
            instance.status = "disetujui"
            if instance.file:
                self._embed_stamp(instance)
            instance.save()
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance: SupportingDocument = self.get_object()
        # 🔒 lock after archive/paid
        self._ensure_main_doc_is_editable(instance.main_document)
        return super().destroy(request, *args, **kwargs)

    def _embed_stamp(self, instance: SupportingDocument):
        """Stamp file only once; skip if already stamped."""
        file_path = instance.file.path
        base, ext = os.path.splitext(os.path.basename(file_path))

        # Guard: avoid infinite re‑stamping loops
        if base.endswith("_APPROVED"):
            return

        timestamp = timezone.now().strftime("%d-%m-%Y %H:%M")
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            temp_path = tmp.name

        if ext == ".pdf":
            doc = fitz.open(file_path)
            page = doc[0]
            rect = fitz.Rect(50, 50, 300, 120)
            page.insert_textbox(
                rect,
                f"DISETUJUI\n{timestamp}",
                fontsize=18,
                color=(0, 0.6, 0),
                align=fitz.TEXT_ALIGN_CENTER,
            )
            doc.save(temp_path)
            doc.close()

            # replace file with stamped copy
            new_basename = f"{base}_APPROVED{ext}"
            with open(temp_path, "rb") as fp:
                instance.file.save(new_basename, File(fp), save=False)
            os.remove(temp_path)

            # regenerate preview from stamped PDF (first page)
            pdf = fitz.open(instance.file.path)
            pg = pdf[0]
            pix = pg.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            tmp_png = tempfile.mkstemp(suffix=".png")[1]
            with open(tmp_png, "wb") as f:
                f.write(pix.tobytes("png"))
            fileobj, ext_prev = _encode_preview(tmp_png, f"{base}_APPROVED_PREVIEW")
            instance.preview_image.save(f"{base}_APPROVED_PREVIEW{ext_prev}", fileobj, save=False)
            os.remove(tmp_png)
        else:
            img = Image.open(file_path).convert("RGBA")
            stamp_layer = Image.new("RGBA", img.size, (255, 255, 255, 0))
            draw = ImageDraw.Draw(stamp_layer)
            font_path = os.path.join(settings.BASE_DIR, "arial.ttf")
            try:
                font = ImageFont.truetype(font_path, 36)
            except OSError:
                font = ImageFont.load_default()
            draw.multiline_text(
                (50, 50),
                f"APPROVED{timestamp}",
                font=font,
                fill=(255, 0, 0, 180),
                spacing=5,
            )
            stamped = Image.alpha_composite(img, stamp_layer)
            format_to_use = "PNG" if ext == ".png" else "JPEG"
            stamped.convert("RGB").save(temp_path, format=format_to_use)

            new_basename = f"{base}_APPROVED{ext}"
            with open(temp_path, "rb") as fp:
                instance.file.save(new_basename, File(fp), save=False)

            os.remove(temp_path)


# -----------------------------------------------------------------------------
#                    GPT‑VISION PARSE ➜ CREATE DOCUMENT
# -----------------------------------------------------------------------------
# ---- Helpers for multi‑page table parsing (PDF) ----
def _save_page_image(pdf_doc, page_index: int, dpi: int = 160) -> str:
    page = pdf_doc.load_page(page_index)
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    pix = page.get_pixmap(matrix=mat, alpha=False)
    fd, path = tempfile.mkstemp(suffix=".png"); os.close(fd)
    try:
        pix.save(path)
        return path
    except Exception as e:
        try:
            os.remove(path)
        except Exception:
            pass
        fd2, path2 = tempfile.mkstemp(suffix=".jpg"); os.close(fd2)
        with open(path2, "wb") as f:
            f.write(pix.tobytes("jpeg"))
        logger.warning("PNG save failed on page %s, fell back to JPEG: %s", page_index, e)
        return path2

# Preview encoder
def _encode_preview(image_path, base_name):
    max_w = int(getattr(settings, "PREVIEW_IMAGE_MAX_WIDTH", 1600))
    quality = int(getattr(settings, "PREVIEW_IMAGE_QUALITY", 80))

    im = Image.open(image_path).convert("RGB")
    w, h = im.size
    if w > max_w:
        im = im.resize((max_w, int(h * (max_w / w))), Image.LANCZOS)

    buf = io.BytesIO()
    ext = ".webp"
    try:
        im.save(buf, "WEBP", quality=quality, method=6)
    except Exception:
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=85, optimize=True, progressive=True)
        ext = ".jpg"
    buf.seek(0)
    return File(buf), ext

# --- On-the-fly preview (no server-side persistence) ---
def _choose_fmt(accept: str):
    a = (accept or "").lower()
    if "image/webp" in a:
        return "WEBP", "image/webp"
    return "JPEG", "image/jpeg"

def _open_as_pil(path: str) -> Image.Image:
    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        doc = fitz.open(path)
        if doc.page_count == 0:
            raise ValueError("Empty PDF")
        pg = doc[0]
        pix = pg.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        return Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
    # auto-rotate based on EXIF
    return ImageOps.exif_transpose(Image.open(path))

@api_view(["GET"])
@permission_classes([AllowAny])
def sdoc_preview(request, pk: int):
    from .models import SupportingDocument
    sd = get_object_or_404(SupportingDocument, pk=pk)
    w = int(request.GET.get("w", 800))
    w = max(200, min(w, 1600))
    q = int(getattr(settings, "PREVIEW_IMAGE_QUALITY", 80))

    img = _open_as_pil(sd.file.path).convert("RGB")
    ow, oh = img.size
    if ow > w:
        img = img.resize((w, int(oh * (w / ow))), Image.LANCZOS)

    fmt_q = (request.GET.get("fmt") or "").lower()
    if fmt_q == "webp":
        fmt, ctype = "WEBP", "image/webp"
    elif fmt_q in ("jpg", "jpeg"):
        fmt, ctype = "JPEG", "image/jpeg"
    else:
        fmt, ctype = _choose_fmt(request.META.get("HTTP_ACCEPT"))
    buf = io.BytesIO()
    if fmt == "WEBP":
        img.save(buf, "WEBP", quality=q, method=6)
    else:
        img.save(buf, "JPEG", quality=q, optimize=True, progressive=True)
    buf.seek(0)

    stat = os.stat(sd.file.path)
    etag = hashlib.sha1(f"{stat.st_mtime_ns}:{stat.st_size}:{w}:{fmt}:{q}".encode()).hexdigest()
    if request.META.get("HTTP_IF_NONE_MATCH") == etag:
        return HttpResponse(status=304)
    resp = HttpResponse(buf.getvalue(), content_type=ctype)
    resp["Cache-Control"] = "public, max-age=31536000, immutable"
    resp["ETag"] = etag
    resp["Vary"] = "Accept"
    return resp

def _ensure_preview_for_supporting_doc(instance: SupportingDocument):
    """Create a resized WebP/JPEG preview if missing (idempotent)."""
    try:
        # Skip if preview already exists
        if instance.preview_image and getattr(instance.preview_image, 'name', '').strip():
            return
        src = instance.file.path
        base, ext = os.path.splitext(os.path.basename(src))
        if ext.lower() == '.pdf':
            pdf = fitz.open(src)
            pg = pdf[0]
            pix = pg.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
            tmp = tempfile.mkstemp(suffix='.png')[1]
            with open(tmp, 'wb') as f:
                f.write(pix.tobytes('png'))
            fileobj, ext_prev = _encode_preview(tmp, f"{base}_PREVIEW")
            instance.preview_image.save(f"{base}_PREVIEW{ext_prev}", fileobj, save=False)
            os.remove(tmp)
        else:
            fileobj, ext_prev = _encode_preview(src, f"{base}_PREVIEW")
            instance.preview_image.save(f"{base}_PREVIEW{ext_prev}", fileobj, save=False)
        instance.save(update_fields=['preview_image'])
    except Exception as e:
        logger.warning("preview generation failed for %s: %s", getattr(instance, 'id', '?'), e)

def _is_rekap_header(hdr) -> bool:
    expected = ["no", "keterangan", "dibayar ke", "bank", "pengiriman"]
    norm = [str(x).strip().lower() for x in (hdr or [])]
    return len(norm) >= 5 and norm[:5] == expected

# Detect and strip GRAND TOTAL entries

def _has_grand_total(sections):
    return any(isinstance(s, dict) and "grand_total" in s for s in (sections or []))


def _strip_grand_totals(sections):
    return [s for s in (sections or []) if not (isinstance(s, dict) and "grand_total" in s)]


def _looks_like_continuation(first_parsed, second_parsed) -> bool:
    if not second_parsed:
        return False
    for sec in (second_parsed or []):
        tbl = sec.get("table") or []
        if tbl and _is_rekap_header(tbl[0]) and len(tbl) >= 2:
            # require at least one non-empty data row
            if any(any(str(c).strip() for c in r) for r in tbl[1:]):
                return True
    return False


def _save_single_page_pdf(pdf_doc, page_index: int) -> str:
    single = fitz.open()  # create empty PDF doc
    single.insert_pdf(pdf_doc, from_page=page_index, to_page=page_index)
    fd, out = tempfile.mkstemp(suffix=".pdf"); os.close(fd)
    single.save(out)  # no compression to preserve quality
    single.close()
    return out

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
