import io
import os
import tempfile
import logging
import threading

import fitz
from PIL import Image, ImageDraw, ImageFont
from django.conf import settings
from django.contrib.auth import authenticate
from django.core.files import File
from django.http import JsonResponse
from django.utils import timezone
from rest_framework import status as drf_status, viewsets
from rest_framework.decorators import api_view, action, permission_classes
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import PermissionDenied

from .gpt_parser import gpt_parse_subsections_from_image, gpt_belongs_to_current
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

# === simple in-memory progress store ===
PROGRESS: dict[str, dict] = {}
PROGRESS_LOCK = threading.Lock()

def progress_update(job_id: str | None, percent: int, stage: str = "", detail: str | None = None):
    if not job_id:
        return
    p = max(0, min(100, int(percent)))
    with PROGRESS_LOCK:
        PROGRESS[job_id] = {
            "job_id": job_id,
            "percent": p,
            "stage": stage,
            "detail": detail,
            "updated_at": timezone.now().isoformat(),
        }

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def progress_view(request, job_id: str):
    with PROGRESS_LOCK:
        data = PROGRESS.get(job_id)
    if not data:
        return JsonResponse({"job_id": job_id, "percent": 0, "stage": "pending"})
    return JsonResponse(data)

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().order_by("-created_at")
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def _all_rows_have_pay_ref(self, parsed_json: list[dict]) -> bool:
        """Return False if any row lacks a PAY_REF value."""
        for section in parsed_json or []:
            tbl = section.get("table")
            if not tbl:
                continue
            headers = tbl[0]
            try:
                pay_idx = headers.index("PAY_REF")
            except ValueError:
                return False  # column missing entirely
            for row in tbl[1:]:
                if len(row) <= pay_idx or not str(row[pay_idx]).strip():
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
            # 🔒 ensure every row has PAY_REF
            if not self._all_rows_have_pay_ref(doc.parsed_json):
                return Response(
                    {"detail": "Semua item harus memiliki PAY_REF sebelum menyelesaikan pembayaran."},
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
        serializer.save(item_ref_code=item_ref_code, supporting_doc_sequence=next_seq)

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
            pix = pg.get_pixmap(matrix=fitz.Matrix(2, 2), alpha=False)
            fd, tmpjpg = tempfile.mkstemp(suffix=".jpg"); os.close(fd)
            with open(tmpjpg, "wb") as f:
                f.write(pix.tobytes("jpeg"))
            with open(tmpjpg, "rb") as fp:
                instance.preview_image.save(f"{base}_APPROVED_PREVIEW.jpg", File(fp), save=False)
            os.remove(tmpjpg)
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
# REPLACED: multi-page parse + auto attachment of remaining pages
def parse_and_store_view(request):
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
    progress_update(job_id, 10, "Unggahan diterima")

    parsed, table_pages = [], 1
    pdf = None

    if ext == ".pdf":
        pdf = fitz.open(tmp_path)
        progress_update(job_id, 20, "Membaca halaman 1")
        p1_png = _save_page_image(pdf, 0)
        _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
        p1 = gpt_parse_subsections_from_image(p1_png) or []
        _gptp.install_progress(None)
        os.remove(p1_png)
        progress_update(job_id, 30, "Halaman 1 selesai")
        # New strict handling for page-2
        p2 = []
        table_pages = 1
        if pdf.page_count >= 2:
            p2_png = _save_page_image(pdf, 1)
            try:
                # Do not continue table if page-1 already has GRAND TOTAL
                if not _has_grand_total(p1):
                    from .gpt_parser import gpt_is_rekap_table_page
                    dec = gpt_is_rekap_table_page(p2_png)
                    if dec.get("is_rekap", False):
                        _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
                        p2 = gpt_parse_subsections_from_image(p2_png) or []
                        _gptp.install_progress(None)
                        table_pages = 2
            finally:
                try:
                    os.remove(p2_png)
                except Exception:
                    pass
        progress_update(job_id, 40, "Ekstraksi tabel")
        parsed = p1 + p2 if table_pages == 2 else p1
        parsed = _strip_grand_totals(parsed)
        progress_update(job_id, 55, "Tabel siap")
    else:
        progress_update(job_id, 20, "Membaca gambar")
        _gptp.install_progress(lambda pct, stage: progress_update(job_id, pct, stage))
        parsed = gpt_parse_subsections_from_image(tmp_path) or []
        _gptp.install_progress(None)
        table_pages = 1
        progress_update(job_id, 55, "Tabel siap")

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

    progress_update(job_id, 96, "Menyimpan ke basis data")
    doc = Document.objects.create(
        title=title,
        company=company,
        doc_type=doc_type,
        status="draft",
        file=up,
        parsed_json=recalc_totals(parsed) if parsed else parsed,
    )

    attached = 0
    if pdf and pdf.page_count > table_pages:
        ctx = _row_ctx(parsed)
        if ctx:
            ptr = 0
            seq = {c["ref_code"]: 0 for c in ctx}
            total = max(pdf.page_count - table_pages, 0)
            for i, p in enumerate(range(table_pages, pdf.page_count), 1):
                page_pdf = _save_single_page_pdf(pdf, p)
                page_png = _save_page_image(pdf, p)
                decision = gpt_belongs_to_current(
                    page_png,
                    current_row=ctx[ptr],
                    next_row=ctx[ptr + 1] if ptr + 1 < len(ctx) else None,
                )
                stay = bool(decision.get("stay", True))
                conf = float(decision.get("confidence", 0.0))
                LOW = 0.55
                if not stay and ptr + 1 < len(ctx):
                    ptr += 1
                cur = ctx[ptr]
                ref = cur["ref_code"]; seq[ref] += 1
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
                # Save preview image from the rendered page before cleanup
                try:
                    with open(page_png, "rb") as fp_img:
                        sdoc.preview_image.save(
                            f"{doc.document_code}_{ref}_{seq[ref]}.jpg",
                            File(fp_img),
                            save=True,
                        )
                finally:
                    try:
                        os.remove(page_png)
                    except Exception:
                        pass
                os.remove(page_pdf)
                attached += 1
                if total:
                    progress_update(job_id, 55 + int(40 * i / total), f"Memecah dokumen ({i}/{total})")
        pdf.close()

    os.remove(tmp_path)
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

        serializer.save()

    def partial_update(self, request, *args, **kwargs):
        instance: PaymentProof = self.get_object()
        self._ensure_editable(instance.main_document)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance: PaymentProof = self.get_object()
        self._ensure_editable(instance.main_document)
        return super().destroy(request, *args, **kwargs)
