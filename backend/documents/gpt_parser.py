import base64
import json
import os
import re
from functools import lru_cache

# Optional .env support for local dev; on the server we use /etc/dms.env via systemd
try:
    from dotenv import load_dotenv, find_dotenv  # type: ignore
except Exception:  # dotenv is optional in prod
    load_dotenv = None
    find_dotenv = None

from openai import OpenAI


def encode_image(image_path: str) -> str:
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode("utf-8")


def extract_json_from_markdown(markdown_str: str) -> str:
    # Extract JSON from markdown-style code block
    json_match = re.search(r"```json\s*(.*?)\s*```", markdown_str, re.DOTALL)
    if json_match:
        return json_match.group(1).strip()
    # Fallback: strip stray backticks/labels
    return markdown_str.strip("`json\n ").replace("```", "").strip()


def _maybe_load_dotenv() -> None:
    # Useful for local dev; harmless/no-op on server if dotenv isn’t present
    if load_dotenv:
        try:
            # find_dotenv() looks upward for a .env file
            env_path = find_dotenv() if find_dotenv else None
            load_dotenv(dotenv_path=env_path or None)
        except Exception:
            pass


@lru_cache(maxsize=1)
def get_client() -> OpenAI:
    # Lazy-init so imports / management commands don’t require the key
    _maybe_load_dotenv()
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. "
            "Set it in /etc/dms.env on the server (OPENAI_API_KEY=...) "
            "or in a local .env during development."
        )
    return OpenAI(api_key=api_key)


def gpt_parse_subsections_from_image(image_path: str):
    b64_image = encode_image(image_path)

    prompt = """
You are an AI assistant that extracts table data from an invoice or financial document image.

The image contains multiple sections, each titled with 'PT. ...' (e.g., PT. GIN, PT. BPS, PT. BAT & ALS).
Under each section is a table with the following columns:

  1. "No"
  2. "KETERANGAN"
  3. "DIBAYAR KE"
  4. "BANK"
  5. "PENGIRIMAN"

Note: Titles may also be non-PT categories like "Sparepart" or "Penggantian Kas Kecil Kantor".
For each section:
  - Save the table as a 2D array of rows, where row 0 is the header:
    ["No", "KETERANGAN", "DIBAYAR KE", "BANK", "PENGIRIMAN"].
  - Subsequent rows contain the data.
  - Extract the SUBTOTAL if present.
The main 'company' field is the section title (e.g., "PT. GIN", or a category title).
If there's a final GRAND TOTAL (e.g., "TOTAL CEK YANG MAU DIBUKA = 878.826.600"), include it as:
  { "grand_total": "<value>" }

Note: If the document is a PDF, stop extracting data once "Total cek yang mau dibuka" is encountered.

Return strictly valid JSON with no extra text, exactly in this structure:
[
  {
    "company": "...",
    "table": [
      ["No", "KETERANGAN", "DIBAYAR KE", "BANK", "PENGIRIMAN"],
      ["1", "...", "...", "...", "..."]
    ],
    "subtotal": "..."
  },
  { "grand_total": "..." }
]
"""

    client = get_client()
    model = os.getenv("OPENAI_MODEL", "gpt-4o")

    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}",
                            "detail": "auto",
                        },
                    },
                ],
            }
        ],
        max_tokens=1200,
        temperature=0.0,
    )

    gpt_response = response.choices[0].message.content.strip()
    cleaned_json_str = extract_json_from_markdown(gpt_response)

    try:
        return json.loads(cleaned_json_str)
    except json.JSONDecodeError:
        # Return empty list on parse failures to avoid crashing callers
        return []


def gpt_belongs_to_current(image_path: str, current_row: dict, next_row: dict | None) -> dict:
    """
    Decide whether this supporting page should stay with the current row or advance to the next.
    Returns: {"stay": bool, "confidence": float in [0,1]}
    Notes:
      - No OCR text is persisted; only a decision is returned.
      - Prefer staying on current row unless evidence strongly favors advancing.
      - If next_row is None, always stay.
    """
    # If there is no next row, we must stay
    if not next_row:
        return {"stay": True, "confidence": 1.0}

    # Compose minimal, transient context
    def _join(x):  # short, single-line hints
        try:
            cells = [str(c) for c in x.get("cells", []) if str(c).strip()]
            s = " | ".join(cells)
            return s[:320]
        except Exception:
            return ""

    current_hint = _join(current_row)
    next_hint = _join(next_row)

    b64_image = encode_image(image_path)
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    client = get_client()

    sys_prompt = (
        "You classify a single supporting page image for a multi-item payment packet. "
        "Choose whether the page belongs to the CURRENT row or indicates ADVANCE to the NEXT row. "
        "Rules: stay with CURRENT for consecutive pages of the same item; only advance when cues clearly match the NEXT row. "
        "Cues include vendor/recipient, description, invoice/plate numbers, dates, bank names, totals. "
        "Return strict JSON: {\"stay\": true|false, \"confidence\": number between 0 and 1}. No extra text."
    )

    user_text = (
        "CURRENT_ROW HINT:\n" f"{current_hint}\n\n" "NEXT_ROW HINT:\n" f"{next_hint}\n"
    )

    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": sys_prompt},
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": user_text},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/jpeg;base64,{b64_image}", "detail": "auto"},
                        },
                    ],
                },
            ],
            max_tokens=60,
            temperature=0.0,
        )
        content = resp.choices[0].message.content.strip()
        payload_str = extract_json_from_markdown(content)
        data = json.loads(payload_str)
        stay = bool(data.get("stay", True))
        conf = float(data.get("confidence", 0.0))
        if conf < 0.0:
            conf = 0.0
        if conf > 1.0:
            conf = 1.0
        return {"stay": stay, "confidence": conf}
    except Exception:
        return {"stay": True, "confidence": 0.0}


def gpt_is_rekap_table_page(image_path: str) -> dict:
    """
    Return {"is_rekap": bool, "confidence": 0..1}.
    Classifies whether the page is a REKAP table page with columns:
    No | KETERANGAN | DIBAYAR KE | BANK | PENGIRIMAN, occupying most of the page.
    """
    b64 = encode_image(image_path)
    client = get_client()
    model = os.getenv("OPENAI_MODEL", "gpt-4o")
    sys = (
        "Decide if this single page is a structured REKAP PEMBAYARAN table "
        "with header exactly: No, KETERANGAN, DIBAYAR KE, BANK, PENGIRIMAN, "
        "occupying most of the page. Return JSON {\"is_rekap\": true|false, \"confidence\": 0..1}."
    )
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": sys},
                {
                    "role": "user",
                    "content": [
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}", "detail": "auto"}},
                    ],
                },
            ],
            max_tokens=50,
            temperature=0.0,
        )
        payload = extract_json_from_markdown(resp.choices[0].message.content.strip())
        out = json.loads(payload)
        return {
            "is_rekap": bool(out.get("is_rekap", False)),
            "confidence": float(out.get("confidence", 0.0)),
        }
    except Exception:
        return {"is_rekap": False, "confidence": 0.0}

