import io
import os
import tempfile

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

from .gpt_parser import gpt_parse_subsections_from_image
from .models import Document, SupportingDocument, UserSettings
from .serializers import DocumentSerializer, SupportingDocumentSerializer, UserSettingsSerializer
from .utils import generate_unique_item_ref_code, recalc_totals


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
        if main_id:
            qs = qs.filter(main_document_id=main_id)
        return qs

    def perform_create(self, serializer):
        item_ref_code = self.request.data.get("item_ref_code")
        if not item_ref_code:                       # ← restore guard
            return Response(
                {"detail": "item_ref_code diperlukan."},
                status=drf_status.HTTP_400_BAD_REQUEST,
            )
        main_doc = serializer.validated_data["main_document"]

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
        if request.data.get("status") == "disetujui":
            instance.approved_at = timezone.now()
            instance.status = "disetujui"
            if instance.file:
                self._embed_stamp(instance)
            instance.save()
        return super().partial_update(request, *args, **kwargs)

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
            page = doc.load_page(0)
            rect = fitz.Rect(50, 50, 300, 110)
            page.insert_textbox(
                rect,
                f"APPROVED{timestamp}",
                fontsize=20,
                color=(1, 0, 0),
                align=fitz.TEXT_ALIGN_CENTER,
            )
            doc.save(temp_path)
            doc.close()
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
@api_view(["POST"])
def parse_and_store_view(request):
    uploaded_file = request.FILES.get("file")
    if not uploaded_file:
        return JsonResponse({"error": "No file uploaded"}, status=400)

    title = request.data.get("title", "Untitled Document")
    company = request.data.get("company", "ttu")
    doc_type = request.data.get("doc_type", "tagihan_pekerjaan")

    ext = os.path.splitext(uploaded_file.name)[1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        for chunk in uploaded_file.chunks():
            tmp.write(chunk)
        temp_path = tmp.name

    parsed = gpt_parse_subsections_from_image(temp_path)

    # -------- inject REF_CODE column & codes --------
    used_codes = set()
    for section in parsed:
        tbl = section.get("table")
        if not tbl:
            continue

        headers = tbl[0]
        if "REF_CODE" not in headers:
            headers.append("REF_CODE")

        for row in tbl[1:]:
            if len(row) < len(headers):
                ref = generate_unique_item_ref_code(used_codes)
                used_codes.add(ref)
                row.append(ref)

    doc = Document.objects.create(
        title=title,
        company=company,
        doc_type=doc_type,
        status="draft",
        file=uploaded_file,
        parsed_json=parsed,
    )

    os.remove(temp_path)

    return JsonResponse({"document_id": doc.id, "document_code": doc.document_code})


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
