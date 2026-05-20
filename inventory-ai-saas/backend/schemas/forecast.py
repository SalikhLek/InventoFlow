from typing import List

from pydantic import BaseModel, Field


class BatchForecastRequest(BaseModel):
    item_ids: List[int] = Field(..., min_length=1, max_length=200)
    days: int = Field(7, ge=1, le=30)
    method: str = Field("auto", pattern="^(auto|prophet|sarima|mean|compare)$")
