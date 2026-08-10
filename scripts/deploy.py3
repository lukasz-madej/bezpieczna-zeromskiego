#!/usr/bin/env python3
"""
Deploys the static site to the production FTP host, uploading only files
that are new or changed since the last successful deploy (tracked via a
local sha256 manifest), so you don't have to drag-and-drop everything
through an FTP client after every change.

Setup:
    1. Copy scripts/deploy.config.example.json to scripts/deploy.config.json
       and fill in your FTP credentials (this file is gitignored, never
       commit real credentials).
       OR set the DEPLOY_FTP_HOST / DEPLOY_FTP_USER / DEPLOY_FTP_PASS /
       DEPLOY_FTP_DIR / DEPLOY_FTP_PORT / DEPLOY_FTP_TLS environment
       variables instead (these take precedence over the config file).

Usage:
    python3 scripts/deploy.py3                 # upload changed files
    python3 scripts/deploy.py3 --dry-run        # show what would be uploaded
    python3 scripts/deploy.py3 --force          # re-upload everything
    python3 scripts/deploy.py3 --delete         # also remove remote files
                                                 # that no longer exist locally
"""

import argparse
import hashlib
import json
import os
import sys
from ftplib import FTP, FTP_TLS, error_perm
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_PATH = ROOT / "scripts" / ".deploy-manifest.json"
CONFIG_PATH = ROOT / "scripts" / "deploy.config.json"

# Directories that are never part of the deployed site.
EXCLUDE_DIRS = {".git", ".idea", ".github", "node_modules", "__pycache__"}

# Individual files that are never uploaded (dev tooling, secrets, OS cruft).
EXCLUDE_FILES = {
    ".DS_Store",
    ".gitignore",
    "scripts/deploy.py3",
    "scripts/deploy.sh",
    "scripts/deploy.config.json",
    "scripts/deploy.config.example.json",
    "scripts/.deploy-manifest.json",
}


def load_config():
    config = {}
    if CONFIG_PATH.exists():
        config = json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    env_map = {
        "host": "DEPLOY_FTP_HOST",
        "username": "DEPLOY_FTP_USER",
        "password": "DEPLOY_FTP_PASS",
        "remote_dir": "DEPLOY_FTP_DIR",
        "port": "DEPLOY_FTP_PORT",
        "use_tls": "DEPLOY_FTP_TLS",
    }
    for key, env_var in env_map.items():
        if env_var in os.environ:
            config[key] = os.environ[env_var]

    missing = [k for k in ("host", "username", "password") if not config.get(k)]
    if missing:
        sys.exit(
            f"ERROR: missing FTP config: {', '.join(missing)}.\n"
            f"Create {CONFIG_PATH.relative_to(ROOT)} (see deploy.config.example.json) "
            f"or set DEPLOY_FTP_* environment variables."
        )

    config.setdefault("remote_dir", "/")
    config.setdefault("port", 21)
    config.setdefault("use_tls", True)
    config["port"] = int(config["port"])
    if isinstance(config["use_tls"], str):
        config["use_tls"] = config["use_tls"].strip().lower() not in ("0", "false", "no", "")
    return config


def sha256_of(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def collect_local_files():
    """Returns {relative_posix_path: Path} for every file that should be deployed."""
    files = {}
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for name in filenames:
            full = Path(dirpath) / name
            rel = full.relative_to(ROOT).as_posix()
            if rel in EXCLUDE_FILES or name in EXCLUDE_FILES:
                continue
            files[rel] = full
    return files


def load_manifest():
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    return {}


def save_manifest(manifest):
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def connect(config):
    cls = FTP_TLS if config["use_tls"] else FTP
    ftp = cls()
    ftp.connect(config["host"], config["port"], timeout=30)
    ftp.login(config["username"], config["password"])
    if config["use_tls"]:
        ftp.prot_p()  # secure the data channel too
    if config.get("remote_dir") and config["remote_dir"] != "/":
        ensure_remote_dir(ftp, config["remote_dir"])
        ftp.cwd(config["remote_dir"])
    return ftp


def ensure_remote_dir(ftp, remote_path):
    """Creates remote_path (and parents) if it doesn't exist yet, without
    disturbing the FTP session's current working directory afterwards."""
    original_cwd = ftp.pwd()
    parts = [p for p in remote_path.strip("/").split("/") if p]
    for part in parts:
        try:
            ftp.cwd(part)
        except error_perm:
            ftp.mkd(part)
            ftp.cwd(part)
    ftp.cwd(original_cwd)


def upload_file(ftp, rel_path: str, local_path: Path):
    remote_dir = os.path.dirname(rel_path)
    if remote_dir:
        ensure_remote_dir(ftp, remote_dir)
    with local_path.open("rb") as f:
        ftp.storbinary(f"STOR {rel_path}", f)


def delete_remote_file(ftp, rel_path: str):
    try:
        ftp.delete(rel_path)
    except error_perm as exc:
        print(f"  ! could not delete {rel_path}: {exc}")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="show what would be uploaded/deleted, without doing it")
    parser.add_argument("--force", action="store_true", help="re-upload every file, ignoring the local manifest cache")
    parser.add_argument("--delete", action="store_true", help="delete remote files that no longer exist locally")
    args = parser.parse_args()

    config = load_config()
    local_files = collect_local_files()
    manifest = {} if args.force else load_manifest()

    to_upload = []
    for rel_path, local_path in sorted(local_files.items()):
        digest = sha256_of(local_path)
        if manifest.get(rel_path) != digest:
            to_upload.append((rel_path, local_path, digest))

    to_delete = sorted(set(manifest.keys()) - set(local_files.keys())) if args.delete else []

    if not to_upload and not to_delete:
        print("Nothing to deploy — everything is already up to date.")
        return

    print(f"Files to upload: {len(to_upload)}")
    for rel_path, _, _ in to_upload:
        print(f"  ↑ {rel_path}")
    if to_delete:
        print(f"Files to delete remotely: {len(to_delete)}")
        for rel_path in to_delete:
            print(f"  ✕ {rel_path}")

    if args.dry_run:
        print("\nDry run — no changes were made.")
        return

    print(f"\nConnecting to {config['host']}...")
    ftp = connect(config)
    try:
        new_manifest = dict(manifest)
        for rel_path, local_path, digest in to_upload:
            print(f"Uploading {rel_path}...")
            upload_file(ftp, rel_path, local_path)
            new_manifest[rel_path] = digest

        for rel_path in to_delete:
            print(f"Deleting {rel_path}...")
            delete_remote_file(ftp, rel_path)
            new_manifest.pop(rel_path, None)
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()

    save_manifest(new_manifest)
    print(f"\n✓ Deployed {len(to_upload)} file(s)" + (f", deleted {len(to_delete)}" if to_delete else ""))


if __name__ == "__main__":
    main()
