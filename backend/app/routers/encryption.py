"""Encryption management endpoints.

All endpoints use get_user_email_from_token directly (NOT get_current_user)
to avoid the 423 cycle — these endpoints must work even when DB is locked.
"""

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

    # Use sqlcipher3 + sqlcipher_export to create an encrypted copy, then replace the original.
    # Open the plaintext file with sqlcipher3 WITHOUT setting any key pragma — sqlcipher3 reads
    # it as a standard SQLite file. Then attach the encrypted destination and use sqlcipher_export.
    import sqlcipher3.dbapi2 as sqlcipher
    import os

    escaped = body.password.replace("'", "''")
    tmp_path = db_path + ".enc_tmp"
    try:
        conn = sqlcipher.connect(db_path)
        # PRAGMA key = "x''" tells SQLCipher 4 to treat the source as plaintext (no decryption)
        conn.execute("PRAGMA key = \"x''\"")
        conn.execute(f"ATTACH DATABASE '{tmp_path}' AS encrypted KEY '{escaped}'")
        conn.execute("SELECT sqlcipher_export('encrypted')")
        conn.execute("DETACH DATABASE encrypted")
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

    # Re-encrypt in-place using PRAGMA rekey
    import sqlcipher3.dbapi2 as sqlcipher
    old_escaped = body.current_password.replace("'", "''")
    new_escaped = body.new_password.replace("'", "''")
    conn = sqlcipher.connect(db_path)
    conn.execute(f"PRAGMA key = '{old_escaped}'")
    conn.execute(f"PRAGMA rekey = '{new_escaped}'")
    conn.close()

    # Update in-memory password and invalidate cached engine
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

    # Close all connections
    invalidate_user_engine(email)

    # Checkpoint WAL
    try:
        import sqlcipher3.dbapi2 as sqlcipher
        escaped = body.password.replace("'", "''")
        conn = sqlcipher.connect(db_path)
        conn.execute(f"PRAGMA key = '{escaped}'")
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.close()
    except Exception:
        pass

    import os

    escaped = body.password.replace("'", "''")
    tmp_path = db_path + ".plain_tmp"
    try:
        import sqlcipher3.dbapi2 as sqlcipher
        conn = sqlcipher.connect(db_path)
        conn.execute(f"PRAGMA key = '{escaped}'")
        # KEY "x''" forces true plaintext (unencrypted) SQLite output
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
