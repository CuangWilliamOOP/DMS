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

