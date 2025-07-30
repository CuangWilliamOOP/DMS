# backend/utils.py
import secrets
import string
import re

def generate_unique_item_ref_code(used: set[str] | None = None, length: int = 8) -> str:
    """
    Return an opaque alphanumeric code that is:
      • upper-case A-Z + 0-9
      • unique within `used` (if provided)
    """
    used = used or set()
    alphabet = string.ascii_uppercase + string.digits
    while True:
        code = ''.join(secrets.choice(alphabet) for _ in range(length))
        if code not in used:
            return code

# ---------- IDR helpers ----------
def _idr_to_int(text: str) -> int:
    """'5.662.397' → 5662397 (safe for '' / None)."""
    nums = re.sub(r"[^0-9]", "", str(text))
    return int(nums) if nums else 0


def _int_to_idr(n: int) -> str:
    """5662397 → '5.662.397'."""
    return f"{n:,}".replace(",", ".")

# ---------- Main routine ----------
def recalc_totals(parsed: list[dict]) -> list[dict]:
    """
    • For every section that has a table, sum the **PENGIRIMAN** column  
      and write the subtotal string back into `section["subtotal"]`.  
    • Append / update the trailing object `{ "grand_total": "…" }`.
    """
    grand = 0
    for sec in parsed:
        tbl = sec.get("table") or []
        if not tbl:
            continue
        headers = tbl[0]
        try:
            idx = headers.index("PENGIRIMAN")
        except ValueError:
            continue
        subtotal = sum(_idr_to_int(r[idx]) for r in tbl[1:] if len(r) > idx)
        sec["subtotal"] = _int_to_idr(subtotal)
        grand += subtotal

    gt_str = _int_to_idr(grand)
    if parsed and isinstance(parsed[-1], dict) and "grand_total" in parsed[-1]:
        parsed[-1]["grand_total"] = gt_str
    else:
        parsed.append({"grand_total": gt_str})
    return parsed
