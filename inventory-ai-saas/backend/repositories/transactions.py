import sqlite3
from typing import List, Optional, Tuple

from schemas import Transaction


def list_transactions(
    conn: sqlite3.Connection,
    *,
    company_id: Optional[int],
    is_admin: bool,
    item_id: Optional[int],
    skip: int,
    limit: int,
) -> Tuple[List[Transaction], int]:
    cur = conn.cursor()
    if item_id is not None:
        if is_admin:
            cur.execute("SELECT COUNT(*) FROM transactions WHERE item_id=?", (item_id,))
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                FROM transactions WHERE item_id=?
                ORDER BY transaction_date DESC, created_at DESC
                LIMIT ? OFFSET ?
                """,
                (item_id, limit, skip),
            )
        else:
            cur.execute(
                "SELECT COUNT(*) FROM transactions WHERE item_id=? AND company_id=?",
                (item_id, company_id),
            )
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                FROM transactions WHERE item_id=? AND company_id=?
                ORDER BY transaction_date DESC, created_at DESC
                LIMIT ? OFFSET ?
                """,
                (item_id, company_id, limit, skip),
            )
    else:
        if is_admin:
            cur.execute("SELECT COUNT(*) FROM transactions")
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                FROM transactions
                ORDER BY transaction_date DESC, created_at DESC
                LIMIT ? OFFSET ?
                """,
                (limit, skip),
            )
        else:
            cur.execute("SELECT COUNT(*) FROM transactions WHERE company_id=?", (company_id,))
            total = cur.fetchone()[0]
            cur.execute(
                """
                SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                FROM transactions WHERE company_id=?
                ORDER BY transaction_date DESC, created_at DESC
                LIMIT ? OFFSET ?
                """,
                (company_id, limit, skip),
            )
    rows = cur.fetchall()
    cur.close()
    out = [
        Transaction(
            id=row["id"],
            item_id=row["item_id"],
            transaction_type=row["transaction_type"],
            quantity=row["quantity"],
            price=row["price"],
            transaction_date=row["transaction_date"],
            company_id=row["company_id"],
            notes=row["notes"],
            created_at=row["created_at"],
        )
        for row in rows
    ]
    return out, total
