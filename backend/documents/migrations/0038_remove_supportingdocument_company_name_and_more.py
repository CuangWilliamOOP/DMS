# Generated by Django 5.1.6 on 2025-06-14 16:48

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0037_supportingdocument_company_name_and_more'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='supportingdocument',
            name='company_name',
        ),
        migrations.RemoveField(
            model_name='supportingdocument',
            name='row_index',
        ),
        migrations.RemoveField(
            model_name='supportingdocument',
            name='section_index',
        ),
    ]
