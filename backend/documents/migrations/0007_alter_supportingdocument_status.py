# Generated by Django 5.1.6 on 2025-03-01 10:52

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0006_supportingdocument_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='supportingdocument',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('pending', 'Pending'), ('disetujui', 'Disetujui'), ('rejected', 'Ditolak')], default='draft', max_length=20),
        ),
    ]
