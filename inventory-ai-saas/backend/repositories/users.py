import sqlite3
from typing import Any, Optional


def _row_to_dict(row: Optional[sqlite3.Row]) -> Optional[dict[str, Any]]:
    if row is None:
        return None
    return {
        "id": row["id"],
        "username": row["username"],
        "password_hash": row["password_hash"],
        "role": row["role"] or "user",
        "company_id": row["company_id"],
        "created_at": row["created_at"],
        "email": row["email"] if "email" in row.keys() else None,
    }


def get_user_by_username(conn: sqlite3.Connection, username: str) -> Optional[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, password_hash, role, company_id, created_at, email FROM users WHERE username=?",
        (username,),
    )
    row = cur.fetchone()
    cur.close()
    return _row_to_dict(row)


def get_user_by_email(conn: sqlite3.Connection, email: str) -> Optional[dict[str, Any]]:
    cur = conn.cursor()
    cur.execute(
        "SELECT id, username, password_hash, role, company_id, created_at, email FROM users WHERE email=?",
        (email,),
    )
    row = cur.fetchone()
    cur.close()
    return _row_to_dict(row)
