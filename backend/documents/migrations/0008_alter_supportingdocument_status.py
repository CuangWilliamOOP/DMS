# Generated by Django 5.1.6 on 2025-03-01 10:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0007_alter_supportingdocument_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='supportingdocument',
            name='status',
            field=models.CharField(choices=[('draft', 'Draft'), ('disetujui', 'Disetujui'), ('rejected', 'Ditolak')], default='draft', max_length=20),
        ),
    ]
