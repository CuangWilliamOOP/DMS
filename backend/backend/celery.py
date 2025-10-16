import os
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "backend.settings")

app = Celery("backend")
app.conf.broker_url = os.environ.get("CELERY_BROKER_URL")
app.conf.result_backend = os.environ.get("CELERY_RESULT_BACKEND")
app.conf.timezone = "Asia/Jakarta"
app.conf.task_time_limit = 1800
app.conf.task_soft_time_limit = 1700
app.conf.worker_max_tasks_per_child = 100
app.conf.accept_content = ["json"]
app.conf.result_accept_content = ["json"]
app.conf.task_serializer = "json"
app.conf.result_serializer = "json"

app.autodiscover_tasks()
app.conf.imports = ("backend.tasks",)  # ensure tasks loaded
