"""Encryption management endpoints.

All endpoints use get_user_email_from_token directly (NOT get_current_user)
to avoid the 423 cycle — these endpoints must work even when DB is locked.
"""

import secrets
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import (
    _db_keys,
    derive_key,
    get_user_db_path,
    init_user_db,
    invalidate_user_engine,
    read_user_meta,
    verify_db_key,
    write_user_meta,
)
from app.dependencies.auth import get_user_email_from_token

router = APIRouter(prefix="/api/v1/encryption", tags=["encryption"])


class EncryptionStatusResponse(BaseModel):
    encrypted: bool
    unlocked: bool


class SetupRequest(BaseModel):
    password: str


class UnlockRequest(BaseModel):
    password: str


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


class DisableRequest(BaseModel):
    password: str


@router.get("/status", response_model=EncryptionStatusResponse)
def get_status(email: str = Depends(get_user_email_from_token)):
    """Get encryption status without accessing the database."""
    meta = read_user_meta(email)
    return {"encrypted": meta.get("encrypted", False), "unlocked": email in _db_keys}


@router.post("/setup")
def setup_encryption(body: SetupRequest, email: str = Depends(get_user_email_from_token)):
    """Enable encryption on a currently plaintext database."""
    meta = read_user_meta(email)
    if meta.get("encrypted"):
        raise HTTPException(status_code=400, detail="Database is already encrypted")

    db_path = get_user_db_path(email)

    # Close all connections before modifying the file
    invalidate_user_engine(email)

    # Checkpoint WAL to consolidate all data into the main DB file
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
    except Exception:
        pass

    # Generate salt and derive key
    salt = secrets.token_hex(32)
    hex_key = derive_key(body.password, salt)

    # Use sqlcipher_export to create an encrypted copy, then replace the original
    import sqlcipher3.dbapi2 as sqlcipher
    import tempfile
    import os

    tmp_path = db_path + ".enc_tmp"
    try:
        # Open the plaintext DB and export to encrypted temp file
        plain_conn = sqlite3.connect(db_path)
        plain_conn.execute(f"ATTACH DATABASE '{tmp_path}' AS encrypted KEY \"x'{hex_key}'\"")
        plain_conn.execute("SELECT sqlcipher_export('encrypted')")
        plain_conn.execute("DETACH DATABASE encrypted")
        plain_conn.close()
    except Exception as e:
        # sqlite3 may not support sqlcipher_export; use sqlcipher3 API instead
        try:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            # Open source with sqlcipher3 (no key = plaintext mode)
            src_conn = sqlcipher.connect(db_path)
            src_conn.execute("PRAGMA key = \"x''\"")  # empty key = plaintext
            src_conn.execute(f"ATTACH DATABASE '{tmp_path}' AS encrypted KEY \"x'{hex_key}'\"")
            src_conn.execute("SELECT sqlcipher_export('encrypted')")
            src_conn.execute("DETACH DATABASE encrypted")
            src_conn.close()
        except Exception as inner_e:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise HTTPException(status_code=500, detail=f"Failed to encrypt database: {inner_e}")

    # Replace original with encrypted version
    os.replace(tmp_path, db_path)

    # Store key in memory and save meta
    _db_keys[email] = hex_key
    write_user_meta(email, {"encrypted": True, "salt": salt})

    return {"message": "Database encrypted successfully"}


@router.post("/unlock")
def unlock_database(body: UnlockRequest, email: str = Depends(get_user_email_from_token)):
    """Unlock an encrypted database by providing the data password."""
    meta = read_user_meta(email)
    if not meta.get("encrypted"):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    if email in _db_keys:
        return {"message": "Database is already unlocked"}

    hex_key = derive_key(body.password, meta["salt"])

    db_path = get_user_db_path(email)
    if not verify_db_key(db_path, hex_key):
        raise HTTPException(status_code=401, detail="Incorrect password")

    _db_keys[email] = hex_key
    invalidate_user_engine(email)

    # Run pending migrations now that key is in memory
    init_user_db(email)

    return {"message": "Database unlocked successfully"}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, email: str = Depends(get_user_email_from_token)):
    """Change the data password for an encrypted database."""
    meta = read_user_meta(email)
    if not meta.get("encrypted"):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    # Verify current password
    old_hex_key = derive_key(body.current_password, meta["salt"])
    db_path = get_user_db_path(email)
    if not verify_db_key(db_path, old_hex_key):
        raise HTTPException(status_code=401, detail="Incorrect current password")

    # Generate new salt and key
    new_salt = secrets.token_hex(32)
    new_hex_key = derive_key(body.new_password, new_salt)

    # Re-encrypt in-place using PRAGMA rekey
    import sqlcipher3.dbapi2 as sqlcipher
    conn = sqlcipher.connect(db_path)
    conn.execute(f"PRAGMA key = \"x'{old_hex_key}'\"")
    conn.execute(f"PRAGMA rekey = \"x'{new_hex_key}'\"")
    conn.close()

    # Update in-memory key and meta
    _db_keys[email] = new_hex_key
    invalidate_user_engine(email)
    write_user_meta(email, {"encrypted": True, "salt": new_salt})

    return {"message": "Password changed successfully"}


@router.post("/disable")
def disable_encryption(body: DisableRequest, email: str = Depends(get_user_email_from_token)):
    """Remove encryption from the database, converting it back to plaintext."""
    meta = read_user_meta(email)
    if not meta.get("encrypted"):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    hex_key = derive_key(body.password, meta["salt"])
    db_path = get_user_db_path(email)
    if not verify_db_key(db_path, hex_key):
        raise HTTPException(status_code=401, detail="Incorrect password")

    # Close all connections
    invalidate_user_engine(email)

    # Checkpoint WAL
    try:
        import sqlcipher3.dbapi2 as sqlcipher
        conn = sqlcipher.connect(db_path)
        conn.execute(f"PRAGMA key = \"x'{hex_key}'\"")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
    except Exception:
        pass

    import os

    tmp_path = db_path + ".plain_tmp"
    try:
        import sqlcipher3.dbapi2 as sqlcipher
        src_conn = sqlcipher.connect(db_path)
        src_conn.execute(f"PRAGMA key = \"x'{hex_key}'\"")
        src_conn.execute(f"ATTACH DATABASE '{tmp_path}' AS plaintext KEY ''")
        src_conn.execute("SELECT sqlcipher_export('plaintext')")
        src_conn.execute("DETACH DATABASE plaintext")
        src_conn.close()
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to decrypt database: {e}")

    os.replace(tmp_path, db_path)

    _db_keys.pop(email, None)
    write_user_meta(email, {"encrypted": False, "salt": None})

    return {"message": "Encryption disabled"}
