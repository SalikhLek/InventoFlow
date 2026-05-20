import json
import sqlite3
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response

from database import get_db, transaction
from deps import get_current_user
from repositories import transactions_repo
from schemas import Transaction, TransactionCreate, User
from services.sales_history import aggregate_sales_by_day

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("/", response_model=Transaction)
def create_transaction(
    transaction_in: TransactionCreate,
    current_user: User = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
):
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")

    if transaction_in.transaction_type not in ["sell", "add", "remove"]:
        raise HTTPException(status_code=400, detail="transaction_type must be 'sell', 'add', or 'remove'")

    if transaction_in.quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    with transaction(conn):
        cur = conn.cursor()
        if current_user.role == "admin":
            cur.execute(
                "SELECT id, quantity, price, sales_history, company_id FROM items WHERE id=?",
                (transaction_in.item_id,),
            )
        else:
            cur.execute(
                "SELECT id, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?",
                (transaction_in.item_id, current_user.company_id),
            )
        item_row = cur.fetchone()

        if not item_row:
            cur.close()
            raise HTTPException(status_code=404, detail="Item not found")

        current_quantity = item_row["quantity"]
        item_price = item_row["price"]
        sales_history = json.loads(item_row["sales_history"]) if item_row["sales_history"] else []

        if transaction_in.transaction_type == "sell":
            new_quantity = current_quantity - transaction_in.quantity
            if new_quantity < 0:
                cur.close()
                raise HTTPException(status_code=400, detail="Insufficient quantity")
            sales_history.append(
                {"date": transaction_in.transaction_date, "sales": transaction_in.quantity}
            )
            sales_history = aggregate_sales_by_day(sales_history)
        elif transaction_in.transaction_type == "add":
            new_quantity = current_quantity + transaction_in.quantity
        else:
            new_quantity = current_quantity - transaction_in.quantity
            if new_quantity < 0:
                cur.close()
                raise HTTPException(status_code=400, detail="Insufficient quantity")

        cur.execute(
            "UPDATE items SET quantity=?, sales_history=? WHERE id=?",
            (new_quantity, json.dumps(sales_history), transaction_in.item_id),
        )

        created_at = datetime.utcnow().isoformat()
        price = transaction_in.price if transaction_in.price is not None else item_price
        cur.execute(
            """
            INSERT INTO transactions (item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                transaction_in.item_id,
                transaction_in.transaction_type,
                transaction_in.quantity,
                price,
                transaction_in.transaction_date,
                current_user.company_id,
                transaction_in.notes,
                created_at,
            ),
        )
        transaction_id = cur.lastrowid
        cur.close()

    return Transaction(
        id=transaction_id,
        item_id=transaction_in.item_id,
        transaction_type=transaction_in.transaction_type,
        quantity=transaction_in.quantity,
        price=price,
        transaction_date=transaction_in.transaction_date,
        company_id=current_user.company_id,
        notes=transaction_in.notes,
        created_at=created_at,
    )


@router.get("/", response_model=List[Transaction])
def read_transactions(
    response: Response,
    item_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(10000, ge=1, le=50000),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
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
            date_from=date_from,
            date_to=date_to,
            transaction_type=transaction_type,
        )
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    response.headers["X-Total-Count"] = str(total)
    return rows
