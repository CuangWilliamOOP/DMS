"""backend/documents/serializers.py – updated to surface SupportingDocument.identifier
"""

from rest_framework import serializers

from .models import Document, SupportingDocument, UserSettings, PaymentProof


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = (
            "document_code",
            "sequence_no",
            "revision_no",
            "approved_at",
            "rejected_at",
            "finished_draft_at",
            "paid_at",
            "archived_at",
        )


class SupportingDocumentSerializer(serializers.ModelSerializer):
    # Expose concatenated identifier (read‑only)
    identifier = serializers.CharField(read_only=True)
    # Force URL serialization for files/images
    file = serializers.FileField(use_url=True)
    preview_image = serializers.ImageField(use_url=True, allow_null=True, required=False)

    class Meta:
        model = SupportingDocument
        fields = "__all__"
        read_only_fields = (
            "supporting_doc_sequence",
            "identifier",
            "approved_at",
            "created_at",
            "ai_auto_attached",
            "ai_confidence",
            "ai_low_confidence",
        )


class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ("idle_timeout", "theme_mode", "whatsapp_number")
        read_only_fields = ("whatsapp_number",)


class PaymentProofSerializer(serializers.ModelSerializer):
    # Force URL serialization
    file = serializers.FileField(use_url=True)
    class Meta:
        model = PaymentProof
        fields = "__all__"
        read_only_fields = ("identifier", "uploaded_at")
