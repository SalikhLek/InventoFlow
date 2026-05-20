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
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    transaction_type: Optional[str] = None,
) -> Tuple[List[Transaction], int]:
    conditions = []
    params = []

    if item_id is not None:
        conditions.append("t.item_id=?")
        params.append(item_id)

    if not is_admin:
        conditions.append("t.company_id=?")
        params.append(company_id)

    if date_from:
        conditions.append("t.transaction_date >= ?")
        params.append(date_from)

    if date_to:
        conditions.append("t.transaction_date <= ?")
        params.append(date_to + "T23:59:59" if "T" not in date_to else date_to)

    if transaction_type:
        conditions.append("t.transaction_type=?")
        params.append(transaction_type)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    base_query = f"""
        FROM transactions t
        LEFT JOIN items i ON t.item_id = i.id
        {where_clause}
    """

    cur = conn.cursor()
    cur.execute(f"SELECT COUNT(*) {base_query}", params)
    total = cur.fetchone()[0]

    cur.execute(
        f"""
        SELECT t.id, t.item_id, t.transaction_type, t.quantity, t.price,
               t.transaction_date, t.company_id, t.notes, t.created_at,
               i.name as item_name
        {base_query}
        ORDER BY t.transaction_date DESC, t.created_at DESC
        LIMIT ? OFFSET ?
        """,
        params + [limit, skip],
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
            item_name=row["item_name"],
        )
        for row in rows
    ]
    return out, total
