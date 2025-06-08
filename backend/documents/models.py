import os
import random
import string
from django.db import models
from django.core.exceptions import ValidationError

def validate_file_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    valid_extensions = [
        '.pdf', '.doc', '.docx', '.xls', '.xlsx',
        '.png', '.jpg', '.jpeg'
    ]
    if ext not in valid_extensions:
        raise ValidationError(
            'Hanya file PDF, Word, Excel, atau gambar (PNG/JPG/JPEG) yang diperbolehkan.'
        )

def generate_document_code():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

class Document(models.Model):
    DOCUMENT_TYPES = (
        ('ledger_lokasi', 'Ledger per Lokasi'),
        ('tagihan_pekerjaan', 'Tagihan Pekerjaan (BAPP)'),
        ('pembayaran_pekerjaan', 'Pembayaran Pekerjaan (BAPP)'),
        ('pembelian_sparepart', 'Pembelian Sparepart'),
        ('penggantian_kas_kantor', 'Penggantian Kas Kantor'),
        ('biaya_pengeluaran_proyek', 'Biaya Pengeluaran Proyek'),
    )

    COMPANIES = (
        ('ttu', 'TTU (Tunggal Tunggu Unggul)'),
        ('asn', 'ASN (Alam Subur Nusantara)'),
    )

    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('belum_disetujui', 'Belum Disetujui'),
        ('disetujui', 'Disetujui'),
        ('rejected', 'Ditolak'), 
        ('sudah_dibayar', 'Sudah Dibayar'), # tambahan
    ]

    document_code = models.CharField(
        max_length=20,
        unique=True,
        default=generate_document_code
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    title = models.CharField(max_length=200)
    doc_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    company = models.CharField(max_length=50, choices=COMPANIES)
    description = models.TextField(blank=True)
    file = models.FileField(
        upload_to='uploads/',
        blank=True,
        null=True,
        validators=[validate_file_extension]
    )
    reject_comment = models.TextField(blank=True, null=True)  # tambahan
    rejected_at = models.DateTimeField(blank=True, null=True)  # tambahan
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    parsed_json = models.JSONField(blank=True, null=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)



    def __str__(self):
        return self.title


class SupportingDocument(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('disetujui', 'Disetujui'),
        ('rejected', 'Ditolak'),
    ]

    main_document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name='supporting_docs'
    )
    title = models.CharField(max_length=200, blank=True)
    file = models.FileField(
        upload_to='uploads/supporting_docs/',
        validators=[validate_file_extension]
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    company_name = models.CharField(max_length=200, null=True, blank=True)
    row_index = models.IntegerField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    section_index = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"Supporting Doc for {self.main_document} - {self.title or self.file.name}"
