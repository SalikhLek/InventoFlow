import sqlite3
import json
import traceback
import secrets
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any

import numpy as np
from fastapi import FastAPI, HTTPException, Depends, status, Request, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import JSONResponse
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, ValidationError
from statsmodels.tsa.arima.model import ARIMA

# Optional imports for forecast
try:
    from prophet import Prophet
    import pandas as pd
    PROPHET_AVAILABLE = True
except ImportError:
    PROPHET_AVAILABLE = False

app = FastAPI(title="Inventory AI SaaS API")

# --- CORS Configuration ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "inventory.db"

# --- Auth settings ---
SECRET_KEY = "CHANGE_ME_DEV_SECRET"  # replace in production
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days (10080 minutes)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# --- Database setup ---
def init_db():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    
    # Items table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL NOT NULL,
            sales_history TEXT DEFAULT '[]',
            company_id INTEGER,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)
    
    # Companies table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT NOT NULL
        )
    """)
    
    # Users table - updated with role and company
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            company_id INTEGER,
            email TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)

    # Ensure "email" column exists for existing databases
    try:
        cur.execute("PRAGMA table_info(users)")
        columns = [row[1] for row in cur.fetchall()]
        if 'email' not in columns:
            cur.execute("ALTER TABLE users ADD COLUMN email TEXT")
    except Exception:
        pass
    
    # API Keys table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key_name TEXT NOT NULL,
            api_key TEXT NOT NULL UNIQUE,
            company_id INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            last_used_at TEXT,
            is_active INTEGER DEFAULT 1,
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)
    
    # Transactions table for item operations (sell, add, remove)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            transaction_type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            price REAL,
            transaction_date TEXT NOT NULL,
            company_id INTEGER NOT NULL,
            notes TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (item_id) REFERENCES items(id),
            FOREIGN KEY (company_id) REFERENCES companies(id)
        )
    """)
    
    con.commit()
    con.close()

init_db()

# --- Global Exception Handlers ---
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.detail, "status_code": exc.status_code}
    )

@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error": True,
            "message": "Validation error",
            "details": exc.errors(),
            "status_code": 422
        }
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    print(f"Unexpected error: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "message": "Internal server error. Please try again later.",
            "status_code": 500
        }
    )

# --- Root and healthcheck ---
@app.get("/", include_in_schema=False)
def root():
    return {"status": "ok", "service": "Inventory AI SaaS", "docs": "/docs"}


@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"status": "ok"}

# --- Pydantic schemas ---
class ItemBase(BaseModel):
    name: str
    quantity: int
    price: float
    sales_history: Optional[List[Dict[str, Any]]] = []

class ItemCreate(ItemBase):
    pass

class ItemUpdate(BaseModel):
    name: Optional[str]
    quantity: Optional[int]
    price: Optional[float]
    sales_history: Optional[List[Dict[str, Any]]]

class Item(ItemBase):
    id: int

# --- Auth schemas ---
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    role: str = "user"
    company_id: Optional[int] = None
    created_at: str
    email: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# --- Company schemas ---
class CompanyBase(BaseModel):
    name: str
    description: Optional[str] = None

class CompanyCreate(CompanyBase):
    pass

class Company(CompanyBase):
    id: int
    created_at: str

# --- API Key schemas ---
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

# --- Transaction schemas ---
class TransactionBase(BaseModel):
    item_id: int
    transaction_type: str  # 'sell', 'add', 'remove'
    quantity: int
    price: Optional[float] = None
    transaction_date: str  # ISO format date
    notes: Optional[str] = None

class TransactionCreate(TransactionBase):
    pass

class Transaction(TransactionBase):
    id: int
    company_id: int
    created_at: str

# --- Profile update schemas ---
class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None

class PasswordChange(BaseModel):
    current_password: str
    new_password: str


# --- Auth helpers ---
def verify_password(plain_password: str, password_hash: str) -> bool:
    try:
        password_bytes = plain_password.encode('utf-8')
        hash_bytes = password_hash.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    except Exception:
        return False


def hash_password(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_user_by_username(username: str) -> Optional[dict]:
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("SELECT id, username, password_hash, role, company_id, created_at, email FROM users WHERE username=?", (username,))
    row = cur.fetchone()
    cur.close()
    con.close()
    if not row:
        return None
    return {
        "id": row[0], 
        "username": row[1], 
        "password_hash": row[2], 
        "role": row[3] or "user",
        "company_id": row[4],
        "created_at": row[5],
        "email": row[6] if len(row) > 6 else None
    }


def require_role(required_role: str):
    """Dependency to check if user has required role"""
    async def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != required_role and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {required_role} role or admin"
            )
        return current_user
    return role_checker


async def get_current_user(token: str = Depends(oauth2_scheme)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user_row = get_user_by_username(username)
    if user_row is None:
        raise credentials_exception
    return User(
        id=user_row["id"], 
        username=user_row["username"], 
        role=user_row.get("role", "user"),
        company_id=user_row.get("company_id"),
        created_at=user_row["created_at"],
        email=user_row.get("email")
    )


def generate_api_key() -> str:
    """Generate a secure API key"""
    return secrets.token_urlsafe(32)


def verify_api_key(api_key: str) -> Optional[dict]:
    """Verify API key and return company info"""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("""
        SELECT api_key, company_id, is_active 
        FROM api_keys 
        WHERE api_key = ? AND is_active = 1
    """, (api_key,))
    row = cur.fetchone()
    cur.close()
    con.close()
    if not row:
        return None
    # Update last_used_at
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("UPDATE api_keys SET last_used_at = ? WHERE api_key = ?", 
                (datetime.utcnow().isoformat(), api_key))
    con.commit()
    cur.close()
    con.close()
    return {"company_id": row[1]} 

# --- Auth Endpoints ---

@app.post("/auth/register", response_model=User)
def register(user: UserCreate):
    try:
        if get_user_by_username(user.username):
            raise HTTPException(status_code=400, detail="Username already exists")
        
        if len(user.password) < 3:
            raise HTTPException(status_code=400, detail="Password must be at least 3 characters")
        
        password_hash = hash_password(user.password)
        created_at = datetime.utcnow().isoformat()
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        try:
            # Create default company for new user
            cur.execute(
                "INSERT INTO companies (name, description, created_at) VALUES (?, ?, ?)",
                (f"{user.username}'s Company", f"Company for {user.username}", created_at),
            )
            company_id = cur.lastrowid
            
            # Create user with default role 'user'
            cur.execute(
                "INSERT INTO users (username, password_hash, role, company_id, created_at, email) VALUES (?, ?, ?, ?, ?, ?)",
                (user.username, password_hash, "user", company_id, created_at, None),
            )
            user_id = cur.lastrowid
            con.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Username already exists")
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            con.close()
        return User(id=user_id, username=user.username, role="user", company_id=company_id, created_at=created_at)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")


class LoginRequest(BaseModel):
    username: str
    password: str


@app.post("/auth/login", response_model=Token)
def login(payload: LoginRequest):
    try:
        if not payload.username or not payload.password:
            raise HTTPException(status_code=400, detail="Username and password are required")
        
        user_row = get_user_by_username(payload.username)
        if not user_row:
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        if not verify_password(payload.password, user_row["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        access_token = create_access_token({"sub": user_row["username"]})
        return {"access_token": access_token, "token_type": "bearer"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")


@app.get("/auth/me", response_model=User)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


# --- Profile management ---
@app.put("/auth/me/profile", response_model=User)
def update_profile(payload: ProfileUpdate, current_user: User = Depends(get_current_user)):
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()

        new_username = payload.username.strip() if payload.username is not None else current_user.username
        new_email = payload.email.strip() if payload.email is not None else current_user.email

        # Validate username uniqueness if changed
        if payload.username is not None and new_username != current_user.username:
            cur.execute("SELECT id FROM users WHERE username=?", (new_username,))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Username already exists")

        # Validate email uniqueness if provided and changed
        if payload.email is not None and new_email:
            cur.execute("SELECT id FROM users WHERE email=? AND id != ?", (new_email, current_user.id))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email already in use")

        cur.execute(
            "UPDATE users SET username=?, email=? WHERE id=?",
            (new_username, new_email, current_user.id),
        )
        con.commit()
        cur.close()
        con.close()
        # Return updated user
        return User(
            id=current_user.id,
            username=new_username,
            role=current_user.role,
            company_id=current_user.company_id,
            created_at=current_user.created_at,
            email=new_email,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@app.post("/auth/me/change-password")
def change_password(payload: PasswordChange, current_user: User = Depends(get_current_user)):
    try:
        # Verify current password
        user_row = get_user_by_username(current_user.username)
        if not user_row or not verify_password(payload.current_password, user_row["password_hash"]):
            raise HTTPException(status_code=400, detail="Current password is incorrect")

        if len(payload.new_password) < 3:
            raise HTTPException(status_code=400, detail="New password must be at least 3 characters")

        new_hash = hash_password(payload.new_password)
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        cur.execute("UPDATE users SET password_hash=? WHERE id=?", (new_hash, current_user.id))
        con.commit()
        cur.close()
        con.close()
        return {"message": "Password changed"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to change password: {str(e)}")


# --- CRUD Endpoints (protected) ---

@app.post("/items/", response_model=Item)
def create_item(item: ItemCreate, current_user: User = Depends(get_current_user)):
    try:
        if not current_user.company_id:
            raise HTTPException(status_code=400, detail="User must belong to a company")
        if not item.name or item.name.strip() == "":
            raise HTTPException(status_code=400, detail="Item name is required")
        if item.quantity < 0:
            raise HTTPException(status_code=400, detail="Quantity cannot be negative")
        if item.price < 0:
            raise HTTPException(status_code=400, detail="Price cannot be negative")
        
        sales_history_str = json.dumps(item.sales_history or [])
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        try:
            cur.execute("INSERT INTO items (name, quantity, price, sales_history, company_id) VALUES (?, ?, ?, ?, ?)", 
                        (item.name, item.quantity, item.price, sales_history_str, current_user.company_id))
            item_id = cur.lastrowid
            con.commit()
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            con.close()
        return {**item.dict(), "id": item_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create item: {str(e)}")

@app.post("/items/bulk")
def bulk_create_items(payload=Body(...), current_user: User = Depends(get_current_user)):
    """Принимает список товаров: [{name,quantity,price}], добавляет в текущую компанию пользователя"""
    items = payload.get('items', [])
    success, errors = [], []
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User must belong to a company")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="Некорректный формат данных")
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    for i, item in enumerate(items):
        try:
            name = item.get('name', '').strip()
            quantity = int(item.get('quantity', 0))
            price = float(item.get('price', 0))
            if not name:
                raise ValueError('Нет названия')
            if quantity < 0 or price < 0:
                raise ValueError('Количество/цена < 0')
            cur.execute("INSERT INTO items (name, quantity, price, sales_history, company_id) VALUES (?, ?, ?, '[]', ?)", 
                        (name, quantity, price, current_user.company_id))
            success.append(name)
        except Exception as e:
            errors.append({'row': i + 1, 'name': item.get('name'), 'error': str(e)})
    con.commit()
    cur.close()
    con.close()
    return { 'imported': success, 'errors': errors }

@app.get("/items/", response_model=List[Item])
def read_items(current_user: User = Depends(get_current_user)):
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        try:
            # Admin can see all items, others see only their company's items
            if current_user.role == "admin":
                cur.execute("SELECT id, name, quantity, price, sales_history FROM items")
            else:
                cur.execute("SELECT id, name, quantity, price, sales_history FROM items WHERE company_id = ?", 
                           (current_user.company_id,))
            rows = cur.fetchall()
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            con.close()
        return [
            {
                "id": row[0],
                "name": row[1],
                "quantity": row[2],
                "price": row[3],
                "sales_history": json.loads(row[4]) if row[4] else []
            }
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch items: {str(e)}")

@app.get("/items/{item_id}", response_model=Item)
def read_item(item_id: int, current_user: User = Depends(get_current_user)):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    # Check if item belongs to user's company (unless admin)
    if current_user.role == "admin":
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?", 
                   (item_id, current_user.company_id))
    row = cur.fetchone()
    cur.close()
    con.close()
    if row:
        return {
            "id": row[0],
            "name": row[1],
            "quantity": row[2],
            "price": row[3],
            "sales_history": json.loads(row[4]) if row[4] else []
        }
    else:
        raise HTTPException(status_code=404, detail="Item not found")

@app.put("/items/{item_id}", response_model=Item)
def update_item(item_id: int, item: ItemUpdate, current_user: User = Depends(get_current_user)):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    # Fetch original with company check
    if current_user.role == "admin":
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute("SELECT id, name, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?", 
                   (item_id, current_user.company_id))
    row = cur.fetchone()
    if not row:
        cur.close()
        con.close()
        raise HTTPException(status_code=404, detail="Item not found")
    current = {
        "name": row[1],
        "quantity": row[2],
        "price": row[3],
        "sales_history": json.loads(row[4]) if row[4] else []
    }
    updated = {
        "name": item.name if item.name is not None else current["name"],
        "quantity": item.quantity if item.quantity is not None else current["quantity"],
        "price": item.price if item.price is not None else current["price"],
        "sales_history": item.sales_history if item.sales_history is not None else current["sales_history"],
    }
    cur.execute(
        "UPDATE items SET name=?, quantity=?, price=?, sales_history=? WHERE id=?",
        (updated["name"], updated["quantity"], updated["price"], json.dumps(updated["sales_history"]), item_id)
    )
    con.commit()
    cur.close()
    con.close()
    return {**updated, "id": item_id}

@app.delete("/items/{item_id}")
def delete_item(item_id: int, current_user: User = Depends(get_current_user)):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    # Check if item exists and belongs to user's company (unless admin)
    if current_user.role == "admin":
        cur.execute("DELETE FROM items WHERE id=?", (item_id,))
    else:
        cur.execute("DELETE FROM items WHERE id=? AND company_id=?", (item_id, current_user.company_id))
    affected = cur.rowcount
    con.commit()
    cur.close()
    con.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}

# --- Transaction Endpoints ---

@app.post("/transactions/", response_model=Transaction)
def create_transaction(transaction: TransactionCreate, current_user: User = Depends(get_current_user)):
    """Create a transaction (sell/add/remove) for an item"""
    try:
        if not current_user.company_id:
            raise HTTPException(status_code=400, detail="User must belong to a company")
        
        if transaction.transaction_type not in ['sell', 'add', 'remove']:
            raise HTTPException(status_code=400, detail="transaction_type must be 'sell', 'add', or 'remove'")
        
        if transaction.quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be positive")
        
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        
        # Check if item exists and belongs to user's company
        if current_user.role == "admin":
            cur.execute("SELECT id, quantity, price, sales_history, company_id FROM items WHERE id=?", (transaction.item_id,))
        else:
            cur.execute("SELECT id, quantity, price, sales_history, company_id FROM items WHERE id=? AND company_id=?", 
                       (transaction.item_id, current_user.company_id))
        item_row = cur.fetchone()
        
        if not item_row:
            cur.close()
            con.close()
            raise HTTPException(status_code=404, detail="Item not found")
        
        current_quantity = item_row[1]
        item_price = item_row[2]
        sales_history = json.loads(item_row[3]) if item_row[3] else []
        
        # Calculate new quantity
        if transaction.transaction_type == 'sell':
            new_quantity = current_quantity - transaction.quantity
            if new_quantity < 0:
                cur.close()
                con.close()
                raise HTTPException(status_code=400, detail="Insufficient quantity")
            # Add to sales_history
            sales_history.append({
                "date": transaction.transaction_date,
                "sales": transaction.quantity
            })
        elif transaction.transaction_type == 'add':
            new_quantity = current_quantity + transaction.quantity
        else:  # remove
            new_quantity = current_quantity - transaction.quantity
            if new_quantity < 0:
                cur.close()
                con.close()
                raise HTTPException(status_code=400, detail="Insufficient quantity")
        
        # Update item quantity and sales_history
        cur.execute("UPDATE items SET quantity=?, sales_history=? WHERE id=?", 
                   (new_quantity, json.dumps(sales_history), transaction.item_id))
        
        # Create transaction record
        created_at = datetime.utcnow().isoformat()
        price = transaction.price if transaction.price is not None else item_price
        cur.execute("""
            INSERT INTO transactions (item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (transaction.item_id, transaction.transaction_type, transaction.quantity, price, 
              transaction.transaction_date, current_user.company_id, transaction.notes, created_at))
        transaction_id = cur.lastrowid
        
        con.commit()
        cur.close()
        con.close()
        
        return Transaction(
            id=transaction_id,
            item_id=transaction.item_id,
            transaction_type=transaction.transaction_type,
            quantity=transaction.quantity,
            price=price,
            transaction_date=transaction.transaction_date,
            company_id=current_user.company_id,
            notes=transaction.notes,
            created_at=created_at
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create transaction: {str(e)}")

@app.get("/transactions/", response_model=List[Transaction])
def read_transactions(
    item_id: Optional[int] = Query(None),
    current_user: User = Depends(get_current_user)
):
    """Get transactions, optionally filtered by item_id"""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    try:
        if item_id:
            if current_user.role == "admin":
                cur.execute("""
                    SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                    FROM transactions WHERE item_id=?
                    ORDER BY transaction_date DESC, created_at DESC
                """, (item_id,))
            else:
                cur.execute("""
                    SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                    FROM transactions WHERE item_id=? AND company_id=?
                    ORDER BY transaction_date DESC, created_at DESC
                """, (item_id, current_user.company_id))
        else:
            if current_user.role == "admin":
                cur.execute("""
                    SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                    FROM transactions
                    ORDER BY transaction_date DESC, created_at DESC
                """)
            else:
                cur.execute("""
                    SELECT id, item_id, transaction_type, quantity, price, transaction_date, company_id, notes, created_at
                    FROM transactions WHERE company_id=?
                    ORDER BY transaction_date DESC, created_at DESC
                """, (current_user.company_id,))
        rows = cur.fetchall()
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    finally:
        cur.close()
        con.close()
    
    return [
        Transaction(
            id=row[0],
            item_id=row[1],
            transaction_type=row[2],
            quantity=row[3],
            price=row[4],
            transaction_date=row[5],
            company_id=row[6],
            notes=row[7],
            created_at=row[8]
        )
        for row in rows
    ]

@app.get("/items/{item_id}/transactions", response_model=List[Transaction])
def read_item_transactions(item_id: int, current_user: User = Depends(get_current_user)):
    """Get transactions for a specific item"""
    return read_transactions(item_id=item_id, current_user=current_user)

# --- Company Endpoints ---

@app.get("/companies/", response_model=List[Company])
def read_companies(current_user: User = Depends(get_current_user)):
    """Get companies - admin sees all, others see only their company"""
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        if current_user.role == "admin":
            cur.execute("SELECT id, name, description, created_at FROM companies")
        else:
            cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", 
                       (current_user.company_id,))
        rows = cur.fetchall()
        cur.close()
        con.close()
        return [
            Company(id=row[0], name=row[1], description=row[2], created_at=row[3])
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch companies: {str(e)}")


@app.get("/companies/{company_id}", response_model=Company)
def read_company(company_id: int, current_user: User = Depends(get_current_user)):
    """Get company by ID - users can only see their own company unless admin"""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    if current_user.role == "admin":
        cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", (company_id,))
    else:
        if current_user.company_id != company_id:
            raise HTTPException(status_code=403, detail="Access denied")
        cur.execute("SELECT id, name, description, created_at FROM companies WHERE id=?", (company_id,))
    row = cur.fetchone()
    cur.close()
    con.close()
    if not row:
        raise HTTPException(status_code=404, detail="Company not found")
    return Company(id=row[0], name=row[1], description=row[2], created_at=row[3])


@app.post("/companies/", response_model=Company)
def create_company(company: CompanyCreate, current_user: User = Depends(require_role("admin"))):
    """Create company - admin only"""
    try:
        created_at = datetime.utcnow().isoformat()
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        try:
            cur.execute(
                "INSERT INTO companies (name, description, created_at) VALUES (?, ?, ?)",
                (company.name, company.description, created_at),
            )
            company_id = cur.lastrowid
            con.commit()
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Company name already exists")
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            con.close()
        return Company(id=company_id, name=company.name, description=company.description, created_at=created_at)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create company: {str(e)}")


# --- API Key Endpoints ---

@app.get("/admin/database")
def view_database(current_user: User = Depends(require_role("admin"))):
    """Просмотр всех таблиц и их данных (только для админов)"""
    try:
        con = sqlite3.connect(DB_PATH)
        con.row_factory = sqlite3.Row  # Для получения данных как словарей
        cur = con.cursor()
        
        # Получаем список всех таблиц
        cur.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = [row[0] for row in cur.fetchall()]
        
        result = {}
        
        for table_name in tables:
            # Получаем структуру таблицы
            cur.execute(f"PRAGMA table_info({table_name})")
            columns = [{"name": row[1], "type": row[2], "notnull": row[3], "default": row[4], "pk": row[5]} for row in cur.fetchall()]
            
            # Получаем данные таблицы (ограничиваем до 1000 записей для безопасности)
            cur.execute(f"SELECT * FROM {table_name} LIMIT 1000")
            rows = cur.fetchall()
            
            # Конвертируем Row объекты в словари
            data = [dict(row) for row in rows]
            
            result[table_name] = {
                "columns": columns,
                "row_count": len(data),
                "data": data
            }
        
        cur.close()
        con.close()
        
        return {
            "tables": tables,
            "details": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка при чтении базы данных: {str(e)}")


@app.post("/api-keys/", response_model=APIKey)
def create_api_key(api_key_data: APIKeyCreate, current_user: User = Depends(get_current_user)):
    """Create API key for user's company"""
    try:
        if not current_user.company_id:
            raise HTTPException(status_code=400, detail="User must belong to a company")
        api_key = generate_api_key()
        created_at = datetime.utcnow().isoformat()
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        try:
            cur.execute(
                "INSERT INTO api_keys (key_name, api_key, company_id, created_at, is_active) VALUES (?, ?, ?, ?, ?)",
                (api_key_data.key_name, api_key, current_user.company_id, created_at, 1),
            )
            key_id = cur.lastrowid
            con.commit()
        except sqlite3.Error as e:
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
        finally:
            cur.close()
            con.close()
        return APIKey(
            id=key_id,
            key_name=api_key_data.key_name,
            api_key=api_key,
            company_id=current_user.company_id,
            created_at=created_at,
            is_active=True
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create API key: {str(e)}")


@app.get("/api-keys/", response_model=List[APIKey])
def read_api_keys(current_user: User = Depends(get_current_user)):
    """Get API keys for user's company"""
    try:
        con = sqlite3.connect(DB_PATH)
        cur = con.cursor()
        if current_user.role == "admin":
            cur.execute("SELECT id, key_name, api_key, company_id, created_at, last_used_at, is_active FROM api_keys")
        else:
            if not current_user.company_id:
                raise HTTPException(status_code=400, detail="User must belong to a company")
            cur.execute(
                "SELECT id, key_name, api_key, company_id, created_at, last_used_at, is_active FROM api_keys WHERE company_id=?",
                (current_user.company_id,)
            )
        rows = cur.fetchall()
        cur.close()
        con.close()
        return [
            APIKey(
                id=row[0],
                key_name=row[1],
                api_key=row[2],
                company_id=row[3],
                created_at=row[4],
                last_used_at=row[5],
                is_active=bool(row[6])
            )
            for row in rows
        ]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch API keys: {str(e)}")


@app.delete("/api-keys/{key_id}")
def delete_api_key(key_id: int, current_user: User = Depends(get_current_user)):
    """Delete API key - users can only delete their company's keys"""
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    if current_user.role == "admin":
        cur.execute("DELETE FROM api_keys WHERE id=?", (key_id,))
    else:
        if not current_user.company_id:
            raise HTTPException(status_code=400, detail="User must belong to a company")
        cur.execute("DELETE FROM api_keys WHERE id=? AND company_id=?", (key_id, current_user.company_id))
    affected = cur.rowcount
    con.commit()
    cur.close()
    con.close()
    if affected == 0:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": "API key deleted"}


# --- AI Demand Forecast Endpoint ---

@app.get("/items/{item_id}/forecast")
def forecast_item_demand(
    item_id: int,
    days: int = Query(7, ge=1, le=30),  # forecast up to 30 days, default 7
    method: str = Query('auto', regex='^(auto|prophet|arima|mean)$'),
    current_user: User = Depends(get_current_user),
):
    # Get sales_history: expects [{"date": "YYYY-MM-DD", "sales": int}, ...]
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    # Check if item belongs to user's company (unless admin)
    if current_user.role == "admin":
        cur.execute("SELECT sales_history, company_id FROM items WHERE id=?", (item_id,))
    else:
        cur.execute("SELECT sales_history, company_id FROM items WHERE id=? AND company_id=?", 
                   (item_id, current_user.company_id))
    row = cur.fetchone()
    cur.close()
    con.close()
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    raw_sales_history = json.loads(row[0]) if row[0] else []

    # Validate structure - allow empty list
    if not isinstance(raw_sales_history, list):
        raise HTTPException(status_code=400, detail="sales_history should be a list of {'date','sales'} dicts")
    
    # Clean entries - filter valid entries
    sales_history = [
        x for x in raw_sales_history
        if (
            isinstance(x, dict) and "date" in x and "sales" in x and isinstance(x["sales"], (int, float))
        )
    ]
    
    # If no valid sales history, return zero forecast
    if len(sales_history) == 0:
        return {"item_id": item_id, "forecast": [0 for _ in range(days)], "lower": [0]*days, "upper": [0]*days, "used_method": "mean"}

    # Helper: mean fallback
    def mean_forecast():
        avg_sales = int(round(sum(x["sales"] for x in sales_history) / max(1, len(sales_history))))
        return {
            "item_id": item_id,
            "forecast": [avg_sales for _ in range(days)],
            "lower": [max(0, int(avg_sales * 0.8)) for _ in range(days)],
            "upper": [int(avg_sales * 1.2) for _ in range(days)],
            "used_method": "mean"
        }

    # Select engine
    selected = method
    if method == 'auto':
        selected = 'prophet' if 'PROPHET_AVAILABLE' in globals() and PROPHET_AVAILABLE else 'arima'

    # Prophet
    if selected == 'prophet' and 'PROPHET_AVAILABLE' in globals() and PROPHET_AVAILABLE:
        try:
            import pandas as pd  # ensure available when PROPHET_AVAILABLE
            df = pd.DataFrame(sales_history)
            df['ds'] = pd.to_datetime(df['date'])
            df['y'] = df['sales']
            prophet_df = df[['ds', 'y']].sort_values('ds')
            m = Prophet(yearly_seasonality=True, weekly_seasonality=True, daily_seasonality=False, interval_width=0.9)
            m.fit(prophet_df)
            future = m.make_future_dataframe(periods=days, freq='D')
            future = future[future['ds'] > prophet_df['ds'].max()].head(days)
            forecast = m.predict(future)
            forecast_vals = [max(0, int(round(v))) for v in forecast['yhat'].values]
            lower = [max(0, int(round(v))) for v in forecast['yhat_lower'].values]
            upper = [max(0, int(round(v))) for v in forecast['yhat_upper'].values]
            return {"item_id": item_id, "forecast": forecast_vals, "lower": lower, "upper": upper, "used_method": "prophet"}
        except Exception as e:
            # fallback
            return mean_forecast()

    # ARIMA
    if selected == 'arima':
        try:
            import numpy as np
            series = np.array([x['sales'] for x in sales_history], dtype=float)
            if len(series) < 3:
                return mean_forecast()
            model = ARIMA(series, order=(1,1,1))
            res = model.fit()
            fc = res.forecast(steps=days)
            pred = [max(0, int(round(v))) for v in fc]
            resid = res.resid if hasattr(res, 'resid') else series - res.fittedvalues
            std = float(np.std(resid)) if resid is not None and len(resid) > 1 else 1.0
            z = 1.64  # ~90%
            lower = [max(0, int(round(v - z*std))) for v in fc]
            upper = [max(0, int(round(v + z*std))) for v in fc]
            return {"item_id": item_id, "forecast": pred, "lower": lower, "upper": upper, "used_method": "arima"}
        except Exception:
            return mean_forecast()

    # Mean fallback
    return mean_forecast()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
