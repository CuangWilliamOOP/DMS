from __future__ import annotations

import os
from celery import shared_task


@shared_task(queue="parse")
def parse_job(job_id: str, tmp_path: str, user_id: int, title: str, company: str, doc_type: str, original_name: str):
	# Defer heavy work to the view module's core function to reuse helpers
	from documents.views import _parse_and_store_core, progress_update

	try:
		progress_update(job_id, 2, "Unggahan diterima")
		_parse_and_store_core(job_id, tmp_path, title, company, doc_type, original_name)
	finally:
		try:
			os.remove(tmp_path)
		except Exception:
			pass
	return {"ok": True}
