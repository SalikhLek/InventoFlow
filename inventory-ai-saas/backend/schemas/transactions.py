from typing import Optional

from pydantic import BaseModel


class TransactionBase(BaseModel):
    item_id: int
    transaction_type: str
    quantity: int
    price: Optional[float] = None
    transaction_date: str
    notes: Optional[str] = None


class TransactionCreate(TransactionBase):
    pass


class Transaction(TransactionBase):
    id: int
    company_id: int
    created_at: str
