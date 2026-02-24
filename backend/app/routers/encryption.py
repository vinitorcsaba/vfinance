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

    # Encrypt via copy + PRAGMA rekey:
    # 1. Copy the plaintext file to a temp path
    # 2. Open the copy with sqlcipher3 in plaintext mode (PRAGMA key = "x''")
    # 3. PRAGMA rekey = 'password' encrypts it in-place with SQLCipher's default KDF
    # 4. Replace the original
    # This avoids ATTACH cipher-settings inheritance issues.
    import sqlcipher3.dbapi2 as sqlcipher

    escaped = body.password.replace("'", "''")
    tmp_path = db_path + ".enc_tmp"
    try:
        shutil.copy2(db_path, tmp_path)
        conn = sqlcipher.connect(tmp_path)
        conn.execute("PRAGMA key = \"x''\"")  # open copy as plaintext
        conn.execute(f"PRAGMA rekey = '{escaped}'")  # encrypt in-place
        conn.close()
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"Failed to encrypt database: {e}")

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
