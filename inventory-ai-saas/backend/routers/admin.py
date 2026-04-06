import sqlite3

from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from deps import require_role
from schemas import User

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/database")
def view_database(_: User = Depends(require_role("admin")), conn: sqlite3.Connection = Depends(get_db)):
    try:
        cur = conn.cursor()
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        result = {}
        for table_name in tables:
            cur.execute(f"PRAGMA table_info({table_name})")
            columns = [
                {"name": row[1], "type": row[2], "notnull": row[3], "default": row[4], "pk": row[5]}
                for row in cur.fetchall()
            ]
            cur.execute(f"SELECT * FROM {table_name} LIMIT 1000")
            rows = cur.fetchall()
            data = [dict(row) for row in rows]
            result[table_name] = {"columns": columns, "row_count": len(data), "data": data}
        cur.close()
        return {"tables": tables, "details": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении базы данных: {str(e)}")
