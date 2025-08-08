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

    class Meta:
        model = SupportingDocument
        fields = "__all__"
        read_only_fields = (
            "supporting_doc_sequence",
            "identifier",
            "approved_at",
            "created_at",
        )


class UserSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSettings
        fields = ("idle_timeout", "theme_mode")


class PaymentProofSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentProof
        fields = "__all__"
        read_only_fields = ("identifier", "uploaded_at")