# Generated by Django 5.1.6 on 2025-02-28 17:43

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0004_document_updated_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('disetujui', 'Disetujui'), ('rejected', 'Ditolak')], default='draft', max_length=20),
        ),
    ]
