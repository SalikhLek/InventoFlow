import sqlite3
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user, require_role
from core.database import get_db, transaction
from schemas import Company, CompanyCreate, User

router = APIRouter(prefix="/companies", tags=["companies"])


@router.get("/", response_model=List[Company])
def read_companies(current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    try:
        if current_user.role == "admin":
            cur.execute("SELECT id, name, description, created_at FROM companies")
        else:
            cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", (current_user.company_id,))
        rows = cur.fetchall()
    finally:
        cur.close()
    return [Company(id=row["id"], name=row["name"], description=row["description"], created_at=row["created_at"]) for row in rows]


@router.get("/{company_id}", response_model=Company)
def read_company(company_id: int, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", (company_id,))
    else:
        if current_user.company_id != company_id:
            cur.close()
            raise HTTPException(status_code=403, detail="Access denied")
        cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", (company_id,))
    row = cur.fetchone()
    cur.close()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return Company(id=row["id"], name=row["name"], description=row["description"], created_at=row["created_at"])


@router.post("/", response_model=Company)
def create_company(company: CompanyCreate, current_user: User = Depends(require_role("admin")), conn: sqlite3.Connection = Depends(get_db)):
    created_at = datetime.utcnow().isoformat()
    try:
        with transaction(conn):
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO companies (name, description, created_at) VALUES (?, ?, ?)",
                (company.name, company.description, created_at),
            )
            company_id = cur.lastrowid
            cur.close()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Company name already exists")
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    return Company(id=company_id, name=company.name, description=company.description, created_at=created_at)
