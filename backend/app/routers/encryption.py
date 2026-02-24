"""Encryption management endpoints.

All endpoints use get_user_email_from_token directly (NOT get_current_user)
to avoid the 423 cycle — these endpoints must work even when DB is locked.
"""

import os
import shutil
import sqlite3

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import (
    _db_keys,
    get_user_db_path,
    init_user_db,
    invalidate_user_engine,
    is_db_encrypted,
    verify_db_key,
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
    db_path = get_user_db_path(email)
    return {"encrypted": is_db_encrypted(db_path), "unlocked": email in _db_keys}


@router.post("/setup")
def setup_encryption(body: SetupRequest, email: str = Depends(get_user_email_from_token)):
    """Enable encryption on a currently plaintext database."""
    db_path = get_user_db_path(email)
    if is_db_encrypted(db_path):
        raise HTTPException(status_code=400, detail="Database is already encrypted")

    # Close all connections before modifying the file
    invalidate_user_engine(email)

    # Checkpoint WAL to consolidate all data into the main DB file
    try:
        conn = sqlite3.connect(db_path)
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
    except Exception:
        pass

    # Encrypt using SQLite backup API:
    # 1. Open source with sqlcipher3 in x'' passthrough mode (reads plaintext pages as-is)
    # 2. Open an empty destination with a fresh text-password key (no x'' / raw-key mode)
    # 3. src.backup(dst) copies pages at the C level; destination encrypts each page with
    #    its own key — no cipher-settings inheritance possible (backup API is not ATTACH)
    # 4. verify_db_key confirms the output is openable with the stored password
    # 5. Remove stale WAL/SHM files from the old plaintext DB before replacing
    import sqlcipher3.dbapi2 as sqlcipher

    escaped = body.password.replace("'", "''")
    tmp_path = db_path + ".enc_tmp"
    try:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        src = sqlcipher.connect(db_path)
        src.execute("PRAGMA key = \"x''\"")  # plaintext passthrough — read source as-is

        dst = sqlcipher.connect(tmp_path)
        dst.execute(f"PRAGMA key = '{escaped}'")  # standard text-password KDF for destination

        src.backup(dst)  # page-level copy: src pages → encrypted dst pages
        src.close()
        dst.close()
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to encrypt database: {e}")

    # Belt-and-suspenders: verify the output is encrypted AND the key opens it
    if not is_db_encrypted(tmp_path):
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail="Encryption failed: output file is not encrypted")

    if not verify_db_key(tmp_path, body.password):
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail="Encryption failed: key verification failed")

    # Remove stale WAL/SHM files from the old plaintext DB so SQLCipher doesn't
    # try to apply plaintext WAL pages to the newly encrypted database
    for suffix in ["-wal", "-shm"]:
        stale = db_path + suffix
        if os.path.exists(stale):
            os.remove(stale)

    # Replace original with encrypted version
    os.replace(tmp_path, db_path)

    # Store password in memory
    _db_keys[email] = body.password

    return {"message": "Database encrypted successfully"}


@router.post("/unlock")
def unlock_database(body: UnlockRequest, email: str = Depends(get_user_email_from_token)):
    """Unlock an encrypted database by providing the data password."""
    db_path = get_user_db_path(email)
    if not is_db_encrypted(db_path):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    if email in _db_keys:
        return {"message": "Database is already unlocked"}

    if not verify_db_key(db_path, body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    _db_keys[email] = body.password
    invalidate_user_engine(email)

    # Run pending migrations now that key is in memory
    init_user_db(email)

    return {"message": "Database unlocked successfully"}


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, email: str = Depends(get_user_email_from_token)):
    """Change the data password for an encrypted database."""
    db_path = get_user_db_path(email)
    if not is_db_encrypted(db_path):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    if not verify_db_key(db_path, body.current_password):
        raise HTTPException(status_code=401, detail="Incorrect current password")

    import sqlcipher3.dbapi2 as sqlcipher
    old_escaped = body.current_password.replace("'", "''")
    new_escaped = body.new_password.replace("'", "''")
    conn = sqlcipher.connect(db_path)
    conn.execute(f"PRAGMA key = '{old_escaped}'")
    conn.execute(f"PRAGMA rekey = '{new_escaped}'")
    conn.close()

    _db_keys[email] = body.new_password
    invalidate_user_engine(email)

    return {"message": "Password changed successfully"}


@router.post("/disable")
def disable_encryption(body: DisableRequest, email: str = Depends(get_user_email_from_token)):
    """Remove encryption from the database, converting it back to plaintext."""
    db_path = get_user_db_path(email)
    if not is_db_encrypted(db_path):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    if not verify_db_key(db_path, body.password):
        raise HTTPException(status_code=401, detail="Incorrect password")

    invalidate_user_engine(email)

    # Decrypt via sqlcipher_export to a new plaintext file:
    # Open encrypted source with the correct password, then ATTACH a new empty file
    # with KEY "x''" (empty raw bytes = SQLCipher plaintext passthrough mode).
    # sqlcipher_export copies all data without encryption into the destination.
    import sqlcipher3.dbapi2 as sqlcipher

    escaped = body.password.replace("'", "''")
    tmp_path = db_path + ".plain_tmp"
    try:
        conn = sqlcipher.connect(db_path)
        conn.execute(f"PRAGMA key = '{escaped}'")
        conn.execute(f"ATTACH DATABASE '{tmp_path}' AS plaintext KEY \"x''\"")
        conn.execute("SELECT sqlcipher_export('plaintext')")
        conn.execute("DETACH DATABASE plaintext")
        conn.close()
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to decrypt database: {e}")

    os.replace(tmp_path, db_path)

    _db_keys.pop(email, None)

    return {"message": "Encryption disabled"}


@router.post("/reset")
def reset_encrypted_db(email: str = Depends(get_user_email_from_token)):
    """
    Emergency reset: delete a locked encrypted database that cannot be opened.
    The user will get a fresh empty database on next login.
    Only works when the DB is encrypted AND locked (no key in memory) —
    if the DB is already unlocked, use disable instead.
    """
    db_path = get_user_db_path(email)

    if not is_db_encrypted(db_path):
        raise HTTPException(status_code=400, detail="Database is not encrypted")

    if email in _db_keys:
        raise HTTPException(
            status_code=400,
            detail="Database is unlocked — use disable to remove encryption instead",
        )

    # Delete the locked DB and clear any cached state
    invalidate_user_engine(email)
    _db_keys.pop(email, None)
    if os.path.exists(db_path):
        os.remove(db_path)

    return {"message": "Encrypted database deleted. A fresh database will be created on next login."}
