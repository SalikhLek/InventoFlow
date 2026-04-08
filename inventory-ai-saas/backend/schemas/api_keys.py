from typing import Optional

from pydantic import BaseModel


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
