from typing import Any, Dict, List, Optional

from pydantic import BaseModel


class ItemBase(BaseModel):
    name: str
    quantity: int
    price: float
    sales_history: Optional[List[Dict[str, Any]]] = []


class ItemCreate(ItemBase):
    pass


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[int] = None
    price: Optional[float] = None
    sales_history: Optional[List[Dict[str, Any]]] = None


class Item(ItemBase):
    id: int
