# Generated by Django 5.1.6 on 2025-04-13 08:58

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0021_supportingdocument_section_index'),
    ]

    operations = [
        migrations.AddField(
            model_name='supportingdocument',
            name='approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
