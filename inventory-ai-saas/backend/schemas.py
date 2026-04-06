from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


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


class UserBase(BaseModel):
    username: str


class UserCreate(UserBase):
    password: str
    email: str


class User(UserBase):
    id: int
    role: str = "user"
    company_id: Optional[int] = None
    created_at: str
    email: Optional[str] = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    email: str
    password: str


class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class Company(CompanyBase):
    id: int
    created_at: str


class APIKeyBase(BaseModel):
    key_name: str


class APIKeyCreate(APIKeyBase):
    pass


class APIKey(APIKeyBase):
    id: int
    api_key: str
    company_id: int
    created_at: str
    last_used_at: Optional[str] = None
    is_active: bool = True


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


class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class BatchForecastRequest(BaseModel):
    item_ids: List[int] = Field(..., min_length=1, max_length=200)
    days: int = Field(7, ge=1, le=30)
    method: str = Field("auto", pattern="^(auto|prophet|arima|mean)$")
