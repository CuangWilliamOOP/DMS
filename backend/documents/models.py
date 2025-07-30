"""backend/documents/models.py – updated pattern for Tagihan Pekerjaan

* Tagihan Pekerjaan (`doc_type == "tagihan_pekerjaan"`):
    A1-<COMP>-YYMMDD<X><Y>
      • X ∈ [A‑Z0‑9]  – alfanumerik acak
      • Y ∈ [0‑9]     – digit acak
* Dokumen lain tetap menggunakan pola prefix‑bulanan‑running number.
* `generate_document_code()` stub dipertahankan demi kompatibilitas migrasi lama.
"""

import os
import random
import string
from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

# -----------------------------------------------------------------------------
# Legacy stub (masih dipakai migration 0013_…)
# -----------------------------------------------------------------------------

def generate_document_code():  # noqa: N802
    return "LEGACY-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=6))

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------

def validate_file_extension(value):
    ext = os.path.splitext(value.name)[1].lower()
    if ext not in [
        ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".png", ".jpg", ".jpeg",
    ]:
        raise ValidationError(
            "File harus PDF, Word, Excel, PNG, JPG, atau JPEG."
        )

PREFIX_MAP = {
    "pembayaran_pekerjaan": "PP",
    "penggantian_kas_kantor": "KK",
    "pembelian_sparepart": "PS",
    "ledger_lokasi": "LL",
    "default": "DOC",
}

# -----------------------------------------------------------------------------
# Model: Document
# -----------------------------------------------------------------------------


class Document(models.Model):
    DOCUMENT_TYPES = (
        ("ledger_lokasi", "Ledger per Lokasi"),
        ("tagihan_pekerjaan", "Tagihan Pekerjaan (BAPP)"),
        ("pembayaran_pekerjaan", "Pembayaran Pekerjaan (BAPP)"),
        ("pembelian_sparepart", "Pembelian Sparepart"),
        ("penggantian_kas_kantor", "Penggantian Kas Kantor"),
        ("biaya_pengeluaran_proyek", "Biaya Pengeluaran Proyek"),
    )
    COMPANIES = (
        ("ttu", "TTU"),
        ("asn", "ASN"),
        ("ols", "OLS"),
        ("olm", "OLM"),
    )
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("belum_disetujui", "Belum Disetujui"),
        ("disetujui", "Disetujui"),
        ("rejected", "Ditolak"),
        ("sudah_dibayar", "Sudah Dibayar"),
    ]

    document_code = models.CharField(max_length=40, unique=True, editable=False)
    sequence_no = models.PositiveIntegerField(default=0, editable=False, db_index=True)
    revision_no = models.PositiveIntegerField(default=0, editable=False)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    title = models.CharField(max_length=200)
    doc_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    company = models.CharField(max_length=50, choices=COMPANIES)
    description = models.TextField(blank=True)

    file = models.FileField(
        upload_to="uploads/",
        null=True,
        blank=True,
        validators=[validate_file_extension],
    )

    # Timeline fields
    reject_comment = models.TextField(blank=True, null=True)
    rejected_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    finished_draft_at = models.DateTimeField(null=True, blank=True)
    payment_reference = models.CharField(max_length=100, blank=True, null=True)
    paid_at = models.DateTimeField(blank=True, null=True)
    archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

    parsed_json = models.JSONField(blank=True, null=True)

    def __str__(self):
        return self.document_code or "(new)"

    # ------------------------------------------------------------------
    # Code generator
    # ------------------------------------------------------------------

    def _generate_next_code(self):
        comp = self.company.upper()
        now = timezone.now()

        # --- Tagihan Pekerjaan khusus: A1 pattern ---
        if self.doc_type == "tagihan_pekerjaan":
            yymmdd = now.strftime("%y%m%d")  # YYMMDD
            part_x = random.choice(string.ascii_uppercase + string.digits)
            part_y = random.choice(string.digits)
            code = f"A1-{comp}-{yymmdd}{part_x}{part_y}"
            return code, 0

        # --- Default prefix + running number ---
        prefix = PREFIX_MAP.get(self.doc_type, PREFIX_MAP["default"])
        yymm = now.strftime("%y%m")
        latest = (
            Document.objects
            .filter(
                doc_type=self.doc_type,
                company=self.company,
                created_at__year=now.year,
                created_at__month=now.month,
            )
            .aggregate(models.Max("sequence_no"))
            .get("sequence_no__max")
            or 0
        )
        seq = latest + 1
        code = f"{prefix}-{comp}-{yymm}-{seq:04d}"
        return code, seq

    # ------------------------------------------------------------------

    def save(self, *args, **kwargs):
        if not self.document_code:
            self.document_code, self.sequence_no = self._generate_next_code()
        elif self.revision_no and not self.document_code.endswith(f"-R{self.revision_no}"):
            self.document_code += f"-R{self.revision_no}"
        super().save(*args, **kwargs)


# -----------------------------------------------------------------------------
# Model: SupportingDocument
# -----------------------------------------------------------------------------


class SupportingDocument(models.Model):
    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("disetujui", "Disetujui"),
        ("rejected", "Ditolak"),
    ]

    main_document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="supporting_docs",
    )
    item_ref_code = models.CharField(max_length=12, db_index=True)
    supporting_doc_sequence = models.PositiveSmallIntegerField(default=1)  # 1, 2, 3 …

    # NEW: concatenated identifier e.g. GK3H2Q4A01
    identifier = models.CharField(max_length=14, unique=True, editable=False)

    title = models.CharField(max_length=200, blank=True)
    file = models.FileField(
        upload_to="uploads/supporting_docs/",
        validators=[validate_file_extension],
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    created_at = models.DateTimeField(auto_now_add=True)

    # Convenience metadata for quick UI look‑ups
    company_name = models.CharField(max_length=200, blank=True, null=True)
    section_index = models.IntegerField(blank=True, null=True)
    row_index = models.IntegerField(blank=True, null=True)

    approved_at = models.DateTimeField(blank=True, null=True)

    # -----------------------------
    # Hooks
    # -----------------------------

    def save(self, *args, **kwargs):
        # Auto‑populate identifier once both parts are known
        if not self.identifier and self.item_ref_code and self.supporting_doc_sequence:
            self.identifier = f"{self.item_ref_code}{self.supporting_doc_sequence:02d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.identifier or (
            f"{self.main_document.document_code} – {os.path.basename(self.file.name)}"
        )
