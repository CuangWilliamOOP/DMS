from django.db import migrations
from django.contrib.auth.hashers import make_password
from django.contrib.auth.models import Group

USER_MAP = {
    "WilliamASN": "owner",
    "SubardiASN": "higher-up",
    "SiskaASN": "employee",
}
PASSWORD = "1to8"

def create_users(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    User = apps.get_model("auth", "User")

    for role in set(USER_MAP.values()):
        Group.objects.get_or_create(name=role)

    for username, role in USER_MAP.items():
        user, _ = User.objects.get_or_create(username=username)
        user.password = make_password(PASSWORD)
        user.is_staff = role == "owner"
        user.is_superuser = role == "owner"
        user.save()
        group = Group.objects.get(name=role)
        user.groups.add(group)

class Migration(migrations.Migration):
    dependencies = [
        ("documents", "0042_rename_full_ref_code_supportingdocument_identifier"),  # adjust if needed
    ]
    operations = [
        migrations.RunPython(create_users),
    ]
