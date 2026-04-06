import sqlite3
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from database import get_db, transaction
from deps import get_current_user
from repositories import users as users_repo
from schemas import LoginRequest, PasswordChange, ProfileUpdate, Token, User, UserCreate
from security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=User)
def register(user: UserCreate, conn: sqlite3.Connection = Depends(get_db)):
    if users_repo.get_user_by_username(conn, user.username):
        raise HTTPException(status_code=400, detail="Username already exists")

    if len(user.password) < 3:
        raise HTTPException(status_code=400, detail="Password must be at least 3 characters")

    if not user.email or not user.email.strip():
        raise HTTPException(status_code=400, detail="Email is required")

    if "@" not in user.email or "." not in user.email.split("@")[1]:
        raise HTTPException(status_code=400, detail="Invalid email format")

    password_hash = hash_password(user.password)
    created_at = datetime.utcnow().isoformat()

    try:
        with transaction(conn):
            cur = conn.cursor()
            cur.execute("SELECT id FROM users WHERE email=?", (user.email.strip(),))
            if cur.fetchone():
                raise HTTPException(status_code=400, detail="Email already exists")

            cur.execute(
                "INSERT INTO companies (name, description, created_at) VALUES (?, ?, ?)",
                (f"{user.username}'s Company", f"Company for {user.username}", created_at),
            )
            company_id = cur.lastrowid

            cur.execute(
                "INSERT INTO users (username, password_hash, role, company_id, created_at, email) VALUES (?, ?, ?, ?, ?, ?)",
                (user.username, password_hash, "user", company_id, created_at, user.email.strip()),
            )
            user_id = cur.lastrowid
    except HTTPException:
        raise
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    except sqlite3.Error as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

    return User(id=user_id, username=user.username, role="user", company_id=company_id, created_at=created_at, email=user.email.strip())


@router.post("/login", response_model=Token)
def login(payload: LoginRequest, conn: sqlite3.Connection = Depends(get_db)):
    if not payload.email or not payload.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    user_row = users_repo.get_user_by_email(conn, payload.email)
    if not user_row:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(payload.password, user_row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token({"sub": user_row["username"]})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=User)
def read_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me/profile", response_model=User)
def update_profile(payload: ProfileUpdate, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    new_username = payload.username.strip() if payload.username is not None else current_user.username
    new_email = payload.email.strip() if payload.email is not None else (current_user.email or "")

    cur = conn.cursor()
    if payload.username is not None and new_username != current_user.username:
        cur.execute("SELECT id FROM users WHERE username=?", (new_username,))
        if cur.fetchone():
            cur.close()
            raise HTTPException(status_code=400, detail="Username already exists")

    if payload.email is not None and new_email:
        cur.execute("SELECT id FROM users WHERE email=? AND id != ?", (new_email, current_user.id))
        if cur.fetchone():
            cur.close()
            raise HTTPException(status_code=400, detail="Email already in use")

    cur.execute(
        "UPDATE users SET username=?, email=? WHERE id=?",
        (new_username, new_email, current_user.id),
    )
    cur.close()
    conn.commit()

    return User(
        id=current_user.id,
        username=new_username,
        role=current_user.role,
        company_id=current_user.company_id,
        created_at=current_user.created_at,
        email=new_email,
    )


@router.post("/me/change-password")
def change_password(payload: PasswordChange, current_user: User = Depends(get_current_user), conn: sqlite3.Connection = Depends(get_db)):
    user_row = users_repo.get_user_by_username(conn, current_user.username)
    if not user_row or not verify_password(payload.current_password, user_row["password_hash"]):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if len(payload.new_password) < 3:
        raise HTTPException(status_code=400, detail="New password must be at least 3 characters")

    new_hash = hash_password(payload.new_password)
    with transaction(conn):
        cur = conn.cursor()
        cur.execute("UPDATE users SET password_hash=? WHERE id=?", (new_hash, current_user.id))
        cur.close()

    return {"message": "Password changed"}
