#!/usr/bin/env bash
# Convenience wrapper: ./scripts/deploy.sh [--dry-run] [--force] [--no-delete]
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/deploy.py3 "$@"
