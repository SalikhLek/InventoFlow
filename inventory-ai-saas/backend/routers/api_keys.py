import sqlite3
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from database import get_db, transaction
from deps import get_current_user
from schemas import APIKey, APIKeyCreate, User
from security import generate_api_key

router = APIRouter(prefix="/api-keys", tags=["api-keys"])


@router.post("/", response_model=APIKey)
def create_api_key(api_key_data: APIKeyCreate, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")
    api_key = generate_api_key()
    created_at = datetime.utcnow().isoformat()
    try:
        with transaction(conn):
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO api_keys (key_name, api_key, company_id, created_at, is_active) VALUES (?, ?, ?, ?, ?)",
                (api_key_data.key_name, api_key, current_user.company_id, created_at, 1),
            )
            key_id = cur.lastrowid
            cur.close()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return APIKey(
        id=key_id,
        key_name=api_key_data.key_name,
        api_key=api_key,
        company_id=current_user.company_id,
        created_at=created_at,
        is_active=True,
    )


@router.get("/", response_model=List[APIKey])
def read_api_keys(current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT id, key_name, api_key, company_id, created_at, last_used_at, is_active FROM api_keys")
    else:
        if not current_user.company_id:
            cur.close()
            raise HTTPException(status_code=400, detail="User must belong to a company")
        cur.execute(
            "SELECT id, key_name, api_key, company_id, created_at, last_used_at, is_active FROM api_keys WHERE company_id=?",
            (current_user.company_id,),
        )
    rows = cur.fetchall()
    cur.close()
    return [
        APIKey(
            id=row["id"],
            key_name=row["key_name"],
            api_key=row["api_key"],
            company_id=row["company_id"],
            created_at=row["created_at"],
            last_used_at=row["last_used_at"],
            is_active=bool(row["is_active"]),
        )
        for row in rows
    ]


@router.delete("/{key_id}")
def delete_api_key(key_id: int, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    with transaction(conn):
        cur = conn.cursor()
        if current_user.role == "admin":
            cur.execute("DELETE FROM api_keys WHERE id=?", (key_id,))
        else:
            if not current_user.company_id:
                cur.close()
                raise HTTPException(status_code=400, detail="User must belong to a company")
            cur.execute("DELETE FROM api_keys WHERE id=? AND company_id=?", (key_id, current_user.company_id))
        affected = cur.rowcount
        cur.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}
