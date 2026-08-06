#!/usr/bin/env python3
"""
Scrapes the current signature count from petycjeonline.com and writes
it to data/signatures.json.

Usage:
    python3 scripts/fetch-signatures.py

Schedule with cron (every hour):
    0 * * * * cd /path/to/bezpieczna-zeromskiego && python3 scripts/fetch-signatures.py
"""

import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = (
    "https://www.petycjeonline.com/"
    "wprowadzenie_skutecznych_dziaa_poprawiajcych_bezpieczestwo_na_ulicy_eromskiego_w_otwocku"
)
OUT = Path(__file__).parent / "bezpieczna-zeromskiego.pl" / "data" / "signatures.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pl,en;q=0.9",
}

def fetch_count() -> int:
    req = urllib.request.Request(URL, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode("utf-8", errors="replace")

    m = re.search(r'id=["\']spv9SignCount["\'][^>]*>(\d[\d\s,]*)<', html)
    if not m:
        raise ValueError("Could not find spv9SignCount in page HTML")
    return int(re.sub(r"[\s,]", "", m.group(1)))

def main():
    try:
        count = fetch_count()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        sys.exit(1)

    data = {
        "count": count,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "script": "global"
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"✓ {count} podpisów – zapisano do {OUT}")

if __name__ == "__main__":
    main()
