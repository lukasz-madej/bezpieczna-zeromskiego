#!/usr/bin/env python3
"""
Deploys the static site to the production FTP host, uploading only files
that are new or changed since the last successful deploy (tracked via a
local sha256 manifest), so you don't have to drag-and-drop everything
through an FTP client after every change.

Setup:
    1. Copy scripts/deploy.config.example.json to scripts/deploy.config.json
       and fill in host/username/remote_dir (this file is gitignored, never
       commit real credentials).
    2. Store the FTP password securely instead of writing it into the config
       file:
         - On macOS, store it in Keychain and reference it via
           "keychain_service" in the config (see below):
               python3 scripts/deploy.py3 --set-password
         - Anywhere else (or if you prefer), set the DEPLOY_FTP_PASS
           environment variable instead.
       (A plain "password" field in the config file is still supported as a
       last resort, but is not recommended since it is stored in plaintext.)

    Config file fields:
      host, username, remote_dir, port, use_tls, keychain_service
      (keychain_service enables secure macOS Keychain password lookup;
      the Keychain "account" is always the configured "username")

    Environment variables (override config file, in this order of
    precedence: env vars > config file "password" > macOS Keychain):
      DEPLOY_FTP_HOST / DEPLOY_FTP_USER / DEPLOY_FTP_PASS / DEPLOY_FTP_DIR /
      DEPLOY_FTP_PORT / DEPLOY_FTP_TLS / DEPLOY_FTP_KEYCHAIN_SERVICE

Usage:
    python3 scripts/deploy.py3                  # upload changed files, delete
                                                 # remote files no longer
                                                 # present locally
    python3 scripts/deploy.py3 --dry-run        # show what would be uploaded/deleted
    python3 scripts/deploy.py3 --force          # re-upload everything
    python3 scripts/deploy.py3 --no-delete      # skip deleting remote files
                                                 # that no longer exist locally
    python3 scripts/deploy.py3 --set-password   # store the FTP password in
                                                 # macOS Keychain (prompts,
                                                 # never echoed/saved to disk)
"""

import argparse
import getpass
import hashlib
import json
import os
import subprocess
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


def keychain_get_password(service: str, account: str):
    """Reads a password from the macOS Keychain. Returns None if unavailable
    (not on macOS, `security` missing, or no matching entry)."""
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-a", account, "-s", service, "-w"],
            capture_output=True, text=True, check=True,
        )
        return result.stdout.strip() or None
    except (FileNotFoundError, subprocess.CalledProcessError):
        return None


def keychain_set_password(service: str, account: str, password: str):
    """Stores/updates a password in the macOS Keychain."""
    subprocess.run(
        ["security", "add-generic-password", "-a", account, "-s", service, "-w", password, "-U"],
        check=True,
    )


def load_config(require_password=True):
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
        "keychain_service": "DEPLOY_FTP_KEYCHAIN_SERVICE",
    }
    for key, env_var in env_map.items():
        if env_var in os.environ:
            config[key] = os.environ[env_var]

    # Password resolution order: env var / config "password" (already merged
    # above) > macOS Keychain (looked up by keychain_service + username).
    if not config.get("password") and config.get("keychain_service") and config.get("username"):
        keychain_password = keychain_get_password(config["keychain_service"], config["username"])
        if keychain_password:
            config["password"] = keychain_password

    required = ["host", "username"] + (["password"] if require_password else [])
    missing = [k for k in required if not config.get(k)]
    if missing:
        sys.exit(
            f"ERROR: missing FTP config: {', '.join(missing)}.\n"
            f"Create {CONFIG_PATH.relative_to(ROOT)} (see deploy.config.example.json), "
            f"set DEPLOY_FTP_* environment variables, or run "
            f"'python3 scripts/deploy.py3 --set-password' to store the password in Keychain."
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


# Files whose ?v= cache-buster query string should be kept in sync with the
# content hash of the asset they reference.  Key = asset path (relative to
# ROOT), value = list of HTML files that reference it.
CACHE_BUSTED_ASSETS = {
    "css/style.css": ["index.html", "projekt.html"],
    "js/main.js": ["index.html", "projekt.html"],
}

_CACHE_BUSTER_RE_TMPL = r'({asset}\?v=)[^\s"\'>#]*'


def bump_cache_busters(manifest):
    """Rewrites ?v=<hash> in HTML files, but only for assets whose content
    has changed since the last successful deploy (compared against the
    sha256 manifest).  HTML is left untouched when CSS/JS are unchanged."""
    import re
    changed = []
    for asset_rel, html_files in CACHE_BUSTED_ASSETS.items():
        asset_path = ROOT / asset_rel
        if not asset_path.exists():
            print(f"  ? cache-buster: {asset_rel} not found, skipping")
            continue
        digest = sha256_of(asset_path)
        if manifest.get(asset_rel) == digest:
            continue
        new_hash = digest[:12]
        pattern = re.compile(_CACHE_BUSTER_RE_TMPL.format(asset=re.escape(asset_rel)))
        for html_rel in html_files:
            html_path = ROOT / html_rel
            if not html_path.exists():
                continue
            original = html_path.read_text(encoding="utf-8")
            updated = pattern.sub(rf"\g<1>{new_hash}", original)
            if updated == original:
                continue
            html_path.write_text(updated, encoding="utf-8")
            print(f"  ↻ cache-buster updated: {html_rel}  ({asset_rel}?v={new_hash})")
            changed.append(html_rel)
    return changed


def commit_cache_buster_changes(changed_files):
    """Commits HTML files rewritten by bump_cache_busters so the repo stays
    in sync with the ?v= hashes that were just deployed."""
    unique = list(dict.fromkeys(changed_files))
    if not unique:
        return
    try:
        subprocess.run(
            ["git", "add", "--", *unique],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        staged = subprocess.run(
            ["git", "diff", "--cached", "--name-only", "--", *unique],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        if not staged.stdout.strip():
            return
        message = "Bump cache-buster hashes after deploy"
        subprocess.run(
            ["git", "commit", "-m", message],
            cwd=ROOT, check=True, capture_output=True, text=True,
        )
        print(f"✓ Committed cache-buster updates: {', '.join(unique)}")
    except subprocess.CalledProcessError as exc:
        err = (exc.stderr or exc.stdout or str(exc)).strip()
        print(f"  ! could not commit cache-buster changes: {err}")
    except FileNotFoundError:
        print("  ! could not commit cache-buster changes: git not found")


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
    parser.add_argument("--no-delete", action="store_true", help="skip deleting remote files that no longer exist locally")
    parser.add_argument("--set-password", action="store_true",
                         help="prompt for the FTP password and store it in macOS Keychain "
                              "(requires 'keychain_service' + 'username' in the config file)")
    args = parser.parse_args()

    if args.set_password:
        config = load_config(require_password=False)
        service = config.get("keychain_service")
        if not service:
            sys.exit(
                "ERROR: add a \"keychain_service\" field to "
                f"{CONFIG_PATH.relative_to(ROOT)} first, e.g. \"bezpieczna-zeromskiego-ftp\"."
            )
        password = getpass.getpass(f"FTP password for {config['username']}@{config['host']}: ")
        if not password:
            sys.exit("ERROR: empty password, aborting.")
        keychain_set_password(service, config["username"], password)
        print(f"✓ Password stored in Keychain (service \"{service}\", account \"{config['username']}\").")
        return

    config = load_config()
    manifest = {} if args.force else load_manifest()
    cache_buster_files = bump_cache_busters(manifest)
    local_files = collect_local_files()

    to_upload = []
    for rel_path, local_path in sorted(local_files.items()):
        digest = sha256_of(local_path)
        if manifest.get(rel_path) != digest:
            to_upload.append((rel_path, local_path, digest))

    to_delete = [] if args.no_delete else sorted(set(manifest.keys()) - set(local_files.keys()))

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
    commit_cache_buster_changes(cache_buster_files)


if __name__ == "__main__":
    main()
