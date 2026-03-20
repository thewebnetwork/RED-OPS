"""
Nextcloud / WebDAV file storage utility for RED-OPS.

Replaces ephemeral Railway local disk storage with persistent TrueNAS/Nextcloud storage.

Required environment variables:
    NEXTCLOUD_URL       e.g. https://cloud.redribbongroup.ca  (no trailing slash)
    NEXTCLOUD_USER      Service account username
    NEXTCLOUD_PASSWORD  Service account app password
    NEXTCLOUD_ENABLED   Set to "true" to activate (falls back to local disk otherwise)

Folder structure on Nextcloud:
    RED-OPS/
      orders/
        {order_id}/
          {file_id}{ext}
"""

import os
import httpx
import xml.etree.ElementTree as ET
from typing import Optional, Tuple

NEXTCLOUD_URL = os.environ.get("NEXTCLOUD_URL", "").rstrip("/")
NEXTCLOUD_USER = os.environ.get("NEXTCLOUD_USER", "")
NEXTCLOUD_PASSWORD = os.environ.get("NEXTCLOUD_PASSWORD", "")
NEXTCLOUD_ENABLED = os.environ.get("NEXTCLOUD_ENABLED", "false").lower() == "true"
NEXTCLOUD_BASE = "RED-OPS"


def is_configured() -> bool:
    return NEXTCLOUD_ENABLED and bool(NEXTCLOUD_URL) and bool(NEXTCLOUD_USER) and bool(NEXTCLOUD_PASSWORD)


def _auth() -> Tuple[str, str]:
    return (NEXTCLOUD_USER, NEXTCLOUD_PASSWORD)


def _dav_url(path: str) -> str:
    """Build WebDAV URL for a path relative to the Nextcloud base folder."""
    return f"{NEXTCLOUD_URL}/remote.php/dav/files/{NEXTCLOUD_USER}/{NEXTCLOUD_BASE}/{path}"


async def _ensure_dirs(client: httpx.AsyncClient, path: str) -> None:
    """Create all intermediate directories for a given path."""
    parts = path.split("/")
    # Walk from root to leaf, creating each directory
    for i in range(1, len(parts)):
        dir_path = "/".join(parts[:i])
        url = _dav_url(dir_path)
        try:
            await client.request("MKCOL", url, auth=_auth(), timeout=10.0)
        except Exception:
            pass  # Directory may already exist — that's fine


async def upload_file(
    nc_path: str,
    content: bytes,
    content_type: str = "application/octet-stream",
) -> bool:
    """
    Upload file bytes to Nextcloud at the given path.
    nc_path is relative to the RED-OPS base folder, e.g. 'orders/{order_id}/{file_id}.mp4'
    Returns True on success.
    """
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            await _ensure_dirs(client, nc_path)
            resp = await client.put(
                _dav_url(nc_path),
                content=content,
                headers={"Content-Type": content_type},
                auth=_auth(),
            )
            return resp.status_code in (200, 201, 204)
    except Exception as e:
        print(f"[Nextcloud] upload_file error: {e}")
        return False


async def download_file(nc_path: str) -> Optional[bytes]:
    """
    Download file bytes from Nextcloud.
    Returns bytes on success, None if not found or error.
    """
    if not is_configured():
        return None
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            resp = await client.get(_dav_url(nc_path), auth=_auth())
            if resp.status_code == 200:
                return resp.content
            return None
    except Exception as e:
        print(f"[Nextcloud] download_file error: {e}")
        return None


async def delete_file(nc_path: str) -> bool:
    """Delete a file from Nextcloud. Returns True on success or if already gone."""
    if not is_configured():
        return False
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.delete(_dav_url(nc_path), auth=_auth())
            return resp.status_code in (204, 404)
    except Exception as e:
        print(f"[Nextcloud] delete_file error: {e}")
        return False


async def create_share_link(nc_path: str, expire_days: int = 30) -> Optional[str]:
    """
    Create a public read-only share link for a file.
    Returns the share URL or None on failure.
    """
    if not is_configured():
        return None
    try:
        from datetime import datetime, timedelta, timezone
        expire_date = (datetime.now(timezone.utc) + timedelta(days=expire_days)).strftime("%Y-%m-%d")

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{NEXTCLOUD_URL}/ocs/v2.php/apps/files_sharing/api/v1/shares",
                auth=_auth(),
                headers={"OCS-APIRequest": "true", "Content-Type": "application/x-www-form-urlencoded"},
                data={
                    "path": f"/{NEXTCLOUD_BASE}/{nc_path}",
                    "shareType": "3",       # 3 = public link
                    "permissions": "1",     # 1 = read only
                    "expireDate": expire_date,
                },
            )
            if resp.status_code == 200:
                root = ET.fromstring(resp.text)
                token_el = root.find(".//token")
                if token_el is not None and token_el.text:
                    return f"{NEXTCLOUD_URL}/s/{token_el.text}/download"
        return None
    except Exception as e:
        print(f"[Nextcloud] create_share_link error: {e}")
        return None


def order_file_path(order_id: str, stored_filename: str) -> str:
    """Canonical Nextcloud path for an order file."""
    return f"orders/{order_id}/{stored_filename}"
