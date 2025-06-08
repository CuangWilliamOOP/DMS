from rest_framework import viewsets
from rest_framework.permissions import AllowAny
from .models import Document, SupportingDocument
from .serializers import DocumentSerializer, SupportingDocumentSerializer
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.decorators import api_view
from django.http import JsonResponse
import tempfile
import os

from .gpt_parser import gpt_parse_subsections_from_image

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all().order_by('-created_at')
    serializer_class = DocumentSerializer
    permission_classes = [AllowAny]

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')

        # Cek untuk perubahan status ke 'belum_disetujui'
        if new_status == 'belum_disetujui':
            if not instance.supporting_docs.exists():
                return Response(
                    {"detail": "Minimal satu dokumen pendukung diperlukan."},
                    status=400
                )


        # Tambahan: Logika khusus untuk status 'rejected'
        if new_status == 'rejected':
            reject_comment = request.data.get('reject_comment', '')
            if not reject_comment:
                return Response(
                    {"detail": "Alasan penolakan harus diisi."},
                    status=400
                )
            instance.reject_comment = reject_comment
            instance.rejected_at = timezone.now()
            instance.save()

        if new_status == 'sudah_dibayar':
            payment_reference = request.data.get('payment_reference')
            if not payment_reference:
                return Response(
                    {"detail": "Referensi pembayaran harus diisi."},
                    status=400
                )
            instance.payment_reference = payment_reference
            instance.paid_at = timezone.now()
            instance.status = 'sudah_dibayar'
            instance.archived = True
            instance.archived_at = timezone.now()  # opsional
            instance.save()
            
        return super().partial_update(request, *args, **kwargs)



    

class SupportingDocumentViewSet(viewsets.ModelViewSet):
    queryset = SupportingDocument.objects.all().order_by('-created_at')
    serializer_class = SupportingDocumentSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        main_doc_id = self.request.query_params.get('main_document')
        if main_doc_id:
            qs = qs.filter(main_document_id=main_doc_id)
        return qs

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        new_status = request.data.get('status')

        if new_status == 'disetujui':
            instance.approved_at = timezone.now()
            instance.save()

        return super().partial_update(request, *args, **kwargs)

@api_view(['POST'])
def parse_and_store_view(request):
    uploaded_file = request.FILES.get('file')
    if not uploaded_file:
        return Response({"error": "No file uploaded"}, status=400)

    doc_title = request.data.get('title', 'Untitled Document')
    doc_company = request.data.get('company', 'ttu')
    doc_type = request.data.get('doc_type', 'tagihan_pekerjaan')

    original_ext = os.path.splitext(uploaded_file.name)[1].lower()

    with tempfile.NamedTemporaryFile(suffix=original_ext, delete=False) as temp_file:
        for chunk in uploaded_file.chunks():
            temp_file.write(chunk)
        temp_file_path = temp_file.name

    try:
        parsed_subsections = gpt_parse_subsections_from_image(temp_file_path)
    except Exception as e:
        os.remove(temp_file_path)
        return Response({"error": str(e)}, status=400)
    finally:
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

    doc = Document.objects.create(
        title=doc_title,
        company=doc_company,
        doc_type=doc_type,
        status='draft',
        file=uploaded_file
    )

    doc.parsed_json = parsed_subsections
    doc.save()

    return JsonResponse({
        "document_id": doc.id,
        "document_code": doc.document_code,
        "message": "Document created and GPT parsing stored in doc.parsed_json"
    }, safe=False)
