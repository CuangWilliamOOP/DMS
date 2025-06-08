# documents/migrations/0015_fix_document_code_uniqueness.py
# Comment of where we fix it: we fix duplicates for document_code

from django.db import migrations
import string
import random

def generate_unique_code(Document):
    """
    Generates an 8-char random code of uppercase letters + digits,
    ensuring no collision in the Document table.
    """
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
        if not Document.objects.filter(document_code=code).exists():
            return code

def fix_document_code_uniqueness(apps, schema_editor):
    Document = apps.get_model("documents", "Document")
    all_docs = Document.objects.all()

    for doc in all_docs:
        # If another row uses the same code, generate a new one until it's truly unique
        while Document.objects.filter(document_code=doc.document_code).exclude(pk=doc.pk).exists():
            doc.document_code = generate_unique_code(Document)
            doc.save()

class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0013_document_document_code'),
    ]

    operations = [
        migrations.RunPython(fix_document_code_uniqueness),
    ]
