import json
import sqlite3
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from database import get_db, transaction
from deps import get_current_user
from repositories import transactions_repo
from schemas import Item, ItemCreate, ItemUpdate, Transaction, User
from services.sales_history import aggregate_sales_by_day

router = APIRouter(prefix="/items", tags=["items"])


@router.post("/", response_model=Item)
def create_item(item: ItemCreate, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")
    if not item.name or item.name.strip() == "":
        raise HTTPException(status_code=400, detail="Item name is required")
    if item.quantity < 0:
        raise HTTPException(status_code=400, detail="Quantity cannot be negative")
    if item.price < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")

    sales_history_str = json.dumps(aggregate_sales_by_day(item.sales_history or []))

    try:
        with transaction(conn):
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO items (name, quantity, price, sales_history, company_id) VALUES (?, ?, ?, ?, ?)",
                (item.name, item.quantity, item.price, sales_history_str, current_user.company_id),
            )
            item_id = cur.lastrowid
            cur.close()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {**item.model_dump(), "id": item_id, "sales_history": json.loads(sales_history_str)}


@router.post("/bulk")
def bulk_create_items(payload: dict, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    items = payload.get("items", [])
    success, errors = [], []
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Некорректный формат данных")

    with transaction(conn):
        cur = conn.cursor()
        for i, item in enumerate(items):
            try:
                name = item.get("name", "").strip()
                quantity = int(item.get("quantity", 0))
                price = float(item.get("price", 0))
                if not name:
                    raise ValueError("Нет названия")
                if quantity < 0 or price < 0:
                    raise ValueError("Количество/цена < 0")
                cur.execute(
                    "INSERT INTO items (name, quantity, price, sales_history, company_id) VALUES (?, ?, ?, '[]', ?)",
                    (name, quantity, price, current_user.company_id),
                )
                success.append(name)
            except Exception as e:
                errors.append({"row": i + 1, "name": item.get("name"), "error": str(e)})
        cur.close()

    return {"imported": success, "errors": errors}


@router.get("/", response_model=List[Item])
def read_items(
    response: Response,
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1, le=50000),
    current_user: User = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    cur = conn.cursor()
    try:
        if current_user.role == "admin":
            cur.execute("SELECT COUNT(*) FROM items")
            total = cur.fetchone()[0]
            cur.execute(
                "SELECT id, name, quantity, price, sales_history FROM items ORDER BY id LIMIT ? OFFSET ?",
                (limit, skip),
            )
        else:
            cur.execute("SELECT COUNT(*) FROM items WHERE company_id = ?", (current_user.company_id,))
            total = cur.fetchone()[0]
            cur.execute(
                "SELECT id, name, quantity, price, sales_history FROM items WHERE company_id = ? ORDER BY id LIMIT ? OFFSET ?",
                (current_user.company_id, limit, skip),
            )
        rows = cur.fetchall()
    except sqlite3.Error as e:
        cur.close()
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cur.close()

    response.headers["X-Total-Count"] = str(total)
    return [
        {
            "id": row["id"],
            "name": row["name"],
            "quantity": row["quantity"],
            "price": row["price"],
            "sales_history": json.loads(row["sales_history"]) if row["sales_history"] else [],
        }
        for row in rows
    ]


@router.get("/{item_id}/transactions", response_model=List[Transaction])
def read_item_transactions(
    response: Response,
    item_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1, le=50000),
    current_user: User = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    try:
        rows, total = transactions_repo.list_transactions(
            conn,
            company_id=current_user.company_id,
            is_admin=current_user.role == "admin",
            item_id=item_id,
            skip=skip,
            limit=limit,
        )
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    response.headers["X-Total-Count"] = str(total)
    return rows


@router.get("/{item_id}", response_model=Item)
def read_item(item_id: int, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute(
            "SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?",
            (item_id, current_user.company_id),
        )
    row = cur.fetchone()
    cur.close()
    if row:
        return {
            "id": row["id"],
            "name": row["name"],
            "quantity": row["quantity"],
            "price": row["price"],
            "sales_history": json.loads(row["sales_history"]) if row["sales_history"] else [],
        }
    raise HTTPException(status_code=404, detail="Item not found")


@router.put("/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemUpdate, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute(
            "SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?",
            (item_id, current_user.company_id),
        )
    row = cur.fetchone()
    if not row:
        cur.close()
        raise HTTPException(status_code=404, detail="Item not found")

    current = {
        "name": row["name"],
        "quantity": row["quantity"],
        "price": row["price"],
        "sales_history": json.loads(row["sales_history"]) if row["sales_history"] else [],
    }
    raw_history = item.sales_history if item.sales_history is not None else current["sales_history"]
    updated = {
        "name": item.name if item.name is not None else current["name"],
        "quantity": item.quantity if item.quantity is not None else current["quantity"],
        "price": item.price if item.price is not None else current["price"],
        "sales_history": aggregate_sales_by_day(raw_history),
    }

    with transaction(conn):
        cur = conn.cursor()
        cur.execute(
            "UPDATE items SET name=?, quantity=?, price=?, sales_history=? WHERE id=?",
            (updated["name"], updated["quantity"], updated["price"], json.dumps(updated["sales_history"]), item_id),
        )
        cur.close()

    return {**updated, "id": item_id}


@router.delete("/{item_id}")
def delete_item(item_id: int, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    with transaction(conn):
        cur = conn.cursor()
        if current_user.role == "admin":
            cur.execute("DELETE FROM items WHERE id=?", (item_id,))
        else:
            cur.execute("DELETE FROM items WHERE id=? AND company_id=?", (item_id, current_user.company_id))
        affected = cur.rowcount
        cur.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}
