from rest_framework import serializers
from .models import Document, SupportingDocument

class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = [
            'id',
            'document_code',
            'title',
            'doc_type',
            'company',
            'file',
            'description',
            'status',
            'reject_comment',  
            'rejected_at',      
            'created_at',
            'updated_at',
            'approved_at',
            'parsed_json',
            'payment_reference',  
            'paid_at',
            'archived',          # ← Tambahkan ini
            'archived_at'        # ← dan ini
        ]

class SupportingDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupportingDocument
        fields = '__all__'
