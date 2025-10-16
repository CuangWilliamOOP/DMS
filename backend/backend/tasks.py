import os
from celery import shared_task


@shared_task(name="parse_job", queue="parse")
def parse_job(job_id: str, tmp_path: str, user_id: int, title: str, company: str, doc_type: str, original_name: str):
    # Import here to avoid cycles
    from documents.views import _parse_and_store_core

    try:
        _parse_and_store_core(job_id, tmp_path, title, company, doc_type, original_name)
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
