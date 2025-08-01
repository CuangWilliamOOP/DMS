# Generated by Django 5.1.6 on 2025-06-08 19:07

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0033_remove_document_report_file'),
    ]

    operations = [
        migrations.AlterField(
            model_name='document',
            name='company',
            field=models.CharField(choices=[('ttu', 'TTU (Tunggal Tunggu Unggul)'), ('asn', 'ASN (Alam Subur Nusantara)'), ('ols', 'OLS'), ('olm', 'OLM')], max_length=50),
        ),
        migrations.AlterField(
            model_name='document',
            name='doc_type',
            field=models.CharField(choices=[('ledger_lokasi', 'Ledger per Lokasi'), ('tagihan_pekerjaan', 'Tagihan Pekerjaan (BAPP)'), ('pembayaran_pekerjaan', 'Pembayaran Pekerjaan (BAPP)'), ('pembelian_sparepart', 'Pembelian Sparepart'), ('penggantian_kas_kantor', 'Penggantian Kas Kantor'), ('biaya_pengeluaran_proyek', 'Biaya Pengeluaran Proyek')], max_length=50),
        ),
        migrations.AlterField(
            model_name='document',
            name='document_code',
            field=models.CharField(editable=False, max_length=32, unique=True),
        ),
    ]
