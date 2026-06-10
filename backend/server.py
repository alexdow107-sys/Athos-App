"""Atho - Social Workout Tracking Platform - Backend API."""
import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

import httpx
from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Header, Request
from emergentintegrations.payments.stripe.checkout import StripeCheckout, CheckoutSessionRequest
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from jose import jwt, JWTError

from seed_data import SEED_EXERCISES, DEFAULT_MACHINES

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ===== Config =====
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]
JWT_SECRET = os.environ["JWT_SECRET_KEY"]
JWT_ALG = os.environ.get("JWT_ALGORITHM", "HS256")
JWT_EXPIRE_DAYS = int(os.environ.get("JWT_ACCESS_TOKEN_EXPIRE_DAYS", "30"))
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI(title="Atho API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("atho")


# ===== Helpers =====
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def gen_id(prefix: str = "id") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:16]}"


def clean(doc: Optional[dict]) -> Optional[dict]:
    """Remove MongoDB _id from a doc."""
    if doc is None:
        return None
    doc.pop("_id", None)
    return doc


def epley_1rm(weight: float, reps: int) -> float:
    if reps <= 0 or weight <= 0:
        return 0.0
    if reps == 1:
        return weight
    return round(weight * (1 + reps / 30.0), 1)


# ===== Models =====
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    username: str
    display_name: str


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class GoogleSessionIn(BaseModel):
    session_id: str


class GoogleCompleteSetupIn(BaseModel):
    username: str
    password: str


class OnboardIn(BaseModel):
    date_of_birth: Optional[str] = None
    age: Optional[int] = None
    height_unit: str = "cm"  # cm or ft_in
    weight_unit: str = "kg"  # kg or lb
    height: Optional[float] = None  # in chosen unit
    weight: Optional[float] = None
    is_private: bool = False


class GoalsIn(BaseModel):
    training_days_per_week: Optional[int] = None
    main_goal: Optional[str] = None
    weight_goal: Optional[str] = None
    experience_level: Optional[str] = None


class ProfileUpdateIn(BaseModel):
    display_name: Optional[str] = None
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None  # base64
    height_unit: Optional[str] = None
    weight_unit: Optional[str] = None
    distance_unit: Optional[str] = None  # "km" | "mi"
    height: Optional[float] = None
    weight: Optional[float] = None
    is_private: Optional[bool] = None
    hide_followers: Optional[bool] = None
    show_workout_status: Optional[bool] = None
    workout_status_audience: Optional[str] = None  # everyone | followers | close_friends
    close_friends: Optional[List[str]] = None
    training_days_per_week: Optional[int] = None
    main_goal: Optional[str] = None
    weight_goal: Optional[str] = None
    experience_level: Optional[str] = None
    plan_preferences: Optional[Dict[str, Any]] = None


class ExerciseCreateIn(BaseModel):
    name: str
    category: str
    muscle_group: str
    is_unilateral: bool = False


class SetIn(BaseModel):
    weight: Optional[float] = 0
    reps: Optional[int] = 0
    # unilateral fields
    left_weight: Optional[float] = None
    left_reps: Optional[int] = None
    right_weight: Optional[float] = None
    right_reps: Optional[int] = None
    completed: bool = False
    rpe: Optional[float] = None
    notes: Optional[str] = None


class ExerciseLogIn(BaseModel):
    exercise_id: str
    exercise_name: str
    is_unilateral: bool = False
    machine: Optional[str] = None
    notes: Optional[str] = None
    sets: List[SetIn] = []
    rest_seconds: int = 90


class WorkoutCreateIn(BaseModel):
    name: str = "Workout"
    notes: Optional[str] = None
    activity_type: str = "lifting"  # lifting | cardio | sports | other


class WorkoutFinishIn(BaseModel):
    name: Optional[str] = None
    notes: Optional[str] = None
    exercises: List[ExerciseLogIn] = []
    duration_seconds: int = 0
    caption: Optional[str] = None
    photos: Optional[List[str]] = None  # base64 data-uris
    visibility: str = "public"  # "public" or "private"


class CommentIn(BaseModel):
    text: str
    parent_id: Optional[str] = None


class MessageIn(BaseModel):
    text: Optional[str] = None
    shared_workout_id: Optional[str] = None
    shared_user_id: Optional[str] = None


class StartConversationIn(BaseModel):
    user_id: str


# ===== Auth helpers =====
def create_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": now_utc(),
        "exp": now_utc() + timedelta(days=JWT_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def _resolve_user(token: str) -> Optional[dict]:
    # Try JWT first
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        uid = payload.get("sub")
        if uid:
            u = await db.users.find_one({"user_id": uid}, {"_id": 0})
            if u:
                return u
    except JWTError:
        pass
    # Try Emergent session token
    sess = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if sess:
        exp = sess.get("expires_at")
        if exp:
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp < now_utc():
                return None
        u = await db.users.find_one({"user_id": sess["user_id"]}, {"_id": 0})
        if u:
            return u
    return None


async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization[7:]
    user = await _resolve_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


async def get_current_user_optional(authorization: Optional[str] = Header(None)) -> Optional[dict]:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    return await _resolve_user(authorization[7:])


def public_user(u: dict, viewer: Optional[dict] = None) -> dict:
    """Strip sensitive data from a user doc."""
    if not u:
        return {}
    return {
        "user_id": u["user_id"],
        "username": u.get("username"),
        "display_name": u.get("display_name"),
        "profile_picture": u.get("profile_picture"),
        "bio": u.get("bio", ""),
        "is_private": u.get("is_private", False),
        "is_premium": u.get("is_premium", False),
        "followers_count": u.get("followers_count", 0),
        "following_count": u.get("following_count", 0),
        "workouts_count": u.get("workouts_count", 0),
        "currently_working_out": u.get("currently_working_out", False) if u.get("show_workout_status", True) else False,
        "active_workout_started_at": u.get("active_workout_started_at") if u.get("show_workout_status", True) and u.get("currently_working_out") else None,
        "active_workout_activity_type": u.get("active_workout_activity_type") if u.get("show_workout_status", True) and u.get("currently_working_out") else None,
        "hide_followers": u.get("hide_followers", False),
        "show_workout_status": u.get("show_workout_status", True),
        "workout_status_audience": u.get("workout_status_audience", "everyone"),
        "auth_provider": u.get("auth_provider", "email"),
        "needs_setup": u.get("needs_setup", False),
        "height_unit": u.get("height_unit", "cm"),
        "weight_unit": u.get("weight_unit", "kg"),
        "height": u.get("height"),
        "weight": u.get("weight"),
        "onboarded": u.get("onboarded", False),
        "seen_welcome_tour": u.get("seen_welcome_tour", False),
        "training_days_per_week": u.get("training_days_per_week"),
        "main_goal": u.get("main_goal"),
        "weight_goal": u.get("weight_goal"),
        "experience_level": u.get("experience_level"),
        "plan_preferences": u.get("plan_preferences"),
        "distance_unit": u.get("distance_unit", "km"),
    }


# ===== Startup =====
@app.on_event("startup")
async def startup():
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("username", unique=True, sparse=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.exercises.create_index([("name", 1)])
    await db.exercises.create_index([("category", 1)])
    await db.workouts.create_index([("user_id", 1), ("started_at", -1)])
    await db.workouts.create_index([("user_id", 1), ("date", 1)])
    await db.posts.create_index([("created_at", -1)])
    await db.follows.create_index([("follower_id", 1), ("following_id", 1)], unique=True)
    await db.notifications.create_index([("user_id", 1), ("created_at", -1)])
    await db.messages.create_index([("conversation_id", 1), ("created_at", 1)])
    # Seed exercises
    if await db.exercises.count_documents({"system": True}) == 0:
        docs = []
        for ex in SEED_EXERCISES:
            docs.append({
                "exercise_id": gen_id("ex"),
                "name": ex["name"],
                "category": ex["category"],
                "muscle_group": ex["muscle_group"],
                "is_unilateral": ex["is_unilateral"],
                "system": True,
                "user_id": None,
                "created_at": now_utc(),
            })
        if docs:
            await db.exercises.insert_many(docs)
        logger.info(f"Seeded {len(docs)} exercises")


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ===== AUTH =====
@api.post("/auth/register")
async def register(body: RegisterIn):
    if not re.match(r"^[a-zA-Z0-9_]{3,20}$", body.username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 chars, alphanumeric or underscore")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", body.password) or not re.search(r"\d", body.password):
        raise HTTPException(status_code=400, detail="Password must contain letters and at least one number")
    existing = await db.users.find_one({"$or": [{"email": body.email.lower()}, {"username": body.username.lower()}]})
    if existing:
        if existing.get("email") == body.email.lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail="Username already taken")
    uid = gen_id("user")
    user_doc = {
        "user_id": uid,
        "email": body.email.lower(),
        "username": body.username.lower(),
        "display_name": body.display_name,
        "password_hash": pwd_ctx.hash(body.password),
        "auth_provider": "email",
        "needs_setup": False,
        "bio": "",
        "profile_picture": None,
        "is_private": False,
        "is_premium": False,
        "hide_followers": False,
        "show_workout_status": True,
        "followers_count": 0,
        "following_count": 0,
        "workouts_count": 0,
        "currently_working_out": False,
        "height_unit": "cm",
        "weight_unit": "kg",
        "height": None,
        "weight": None,
        "date_of_birth": None,
        "age": None,
        "onboarded": False,
        "created_at": now_utc(),
    }
    await db.users.insert_one(user_doc)
    token = create_token(uid)
    user_doc.pop("_id", None)
    return {"token": token, "user": public_user(user_doc)}


@api.post("/auth/login")
async def login(body: LoginIn):
    u = await db.users.find_one({"email": body.email.lower()})
    if not u or not u.get("password_hash") or not pwd_ctx.verify(body.password, u["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_token(u["user_id"])
    return {"token": token, "user": public_user(clean(u))}


@api.post("/auth/google/session")
async def google_session(body: GoogleSessionIn):
    """Exchange Emergent session_id for a session token + user."""
    async with httpx.AsyncClient(timeout=15) as hc:
        resp = await hc.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session")
        data = resp.json()

    email = data.get("email", "").lower()
    name = data.get("name", "")
    picture = data.get("picture")
    session_token = data.get("session_token")
    if not email or not session_token:
        raise HTTPException(status_code=400, detail="Incomplete session data")

    # Upsert user
    existing = await db.users.find_one({"email": email})
    if existing:
        uid = existing["user_id"]
        # Sync picture if missing
        if not existing.get("profile_picture") and picture:
            await db.users.update_one({"user_id": uid}, {"$set": {"profile_picture": picture}})
    else:
        uid = gen_id("user")
        # Generate username from email
        base_username = re.sub(r"[^a-z0-9_]", "", email.split("@")[0].lower())[:15] or f"user{uid[-6:]}"
        username = base_username
        suffix = 0
        while await db.users.find_one({"username": username}):
            suffix += 1
            username = f"{base_username}{suffix}"
        await db.users.insert_one({
            "user_id": uid,
            "email": email,
            "username": username,
            "display_name": name or username,
            "password_hash": None,
            "auth_provider": "google",
            "needs_setup": True,
            "bio": "",
            "profile_picture": picture,
            "is_private": False,
            "is_premium": False,
            "hide_followers": False,
            "show_workout_status": True,
            "followers_count": 0,
            "following_count": 0,
            "workouts_count": 0,
            "currently_working_out": False,
            "height_unit": "cm",
            "weight_unit": "kg",
            "height": None,
            "weight": None,
            "onboarded": False,
            "created_at": now_utc(),
        })

    # Store session
    await db.user_sessions.update_one(
        {"session_token": session_token},
        {"$set": {
            "session_token": session_token,
            "user_id": uid,
            "expires_at": now_utc() + timedelta(days=7),
            "created_at": now_utc(),
        }},
        upsert=True,
    )
    u = await db.users.find_one({"user_id": uid}, {"_id": 0})
    return {"token": session_token, "user": public_user(u)}


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": public_user(current)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# ===== GOOGLE COMPLETE SETUP =====
@api.post("/auth/google/complete-setup")
async def google_complete_setup(body: GoogleCompleteSetupIn, current=Depends(get_current_user)):
    """For new Google users — set a password and choose a username."""
    if not current.get("needs_setup"):
        # Allow noop if already set up
        return {"user": public_user(current)}
    username = body.username.strip().lower()
    if not re.match(r"^[a-zA-Z0-9_]{3,20}$", username):
        raise HTTPException(status_code=400, detail="Username must be 3-20 chars, alphanumeric or underscore")
    if len(body.password) < 8 or not re.search(r"[A-Za-z]", body.password) or not re.search(r"\d", body.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain letters + a number")
    # Username uniqueness (allow current user's existing auto-generated one)
    existing = await db.users.find_one({"username": username, "user_id": {"$ne": current["user_id"]}})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {
            "username": username,
            "password_hash": pwd_ctx.hash(body.password),
            "needs_setup": False,
        }},
    )
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(u)}


# ===== ONBOARDING / PROFILE =====
@api.post("/users/onboard")
async def onboard(body: OnboardIn, current=Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    update["onboarded"] = True
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(u)}


@api.patch("/users/me")
async def update_me(body: ProfileUpdateIn, current=Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if "username" in update:
        username = update["username"].lower()
        if not re.match(r"^[a-zA-Z0-9_]{3,20}$", username):
            raise HTTPException(status_code=400, detail="Invalid username")
        existing = await db.users.find_one({"username": username, "user_id": {"$ne": current["user_id"]}})
        if existing:
            raise HTTPException(status_code=400, detail="Username taken")
        update["username"] = username
    if update:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(u)}


@api.delete("/users/me")
async def delete_account(current=Depends(get_current_user)):
    """Permanently delete the current user and all related data."""
    uid = current["user_id"]
    # Best-effort cascade across all collections
    await db.workouts.delete_many({"user_id": uid})
    await db.posts.delete_many({"user_id": uid})
    await db.likes.delete_many({"user_id": uid})
    await db.comments.delete_many({"user_id": uid})
    # Follows where user is on either side
    await db.follows.delete_many({"$or": [{"follower_id": uid}, {"following_id": uid}]})
    await db.notifications.delete_many({"$or": [{"user_id": uid}, {"actor_id": uid}]})
    # Conversations + messages for user
    conv_ids = []
    async for c in db.conversations.find({"participants": uid}):
        conv_ids.append(c["conversation_id"])
    if conv_ids:
        await db.messages.delete_many({"conversation_id": {"$in": conv_ids}})
        await db.conversations.delete_many({"conversation_id": {"$in": conv_ids}})
    # Active sessions
    await db.user_sessions.delete_many({"user_id": uid})
    # Custom exercises owned by user
    await db.exercises.delete_many({"user_id": uid})
    # Subscriptions / payments (if any)
    try:
        await db.payment_transactions.delete_many({"user_id": uid})
    except Exception:
        pass
    # Finally the user
    await db.users.delete_one({"user_id": uid})
    logger.info(f"[DELETE-ACCOUNT] purged {uid}")
    return {"ok": True}


@api.get("/users/search/q")
async def search_users(q: str, current=Depends(get_current_user_optional)):
    if not q or len(q) < 1:
        return {"users": []}
    pattern = re.escape(q.lower())
    cursor = db.users.find({
        "$or": [
            {"username": {"$regex": pattern}},
            {"display_name": {"$regex": pattern, "$options": "i"}},
        ]
    }, {"_id": 0}).limit(30)
    users = []
    async for u in cursor:
        users.append(public_user(u))
    return {"users": users}


@api.get("/users/suggestions/list")
async def suggested_users(current=Depends(get_current_user)):
    already = set()
    async for f in db.follows.find({"follower_id": current["user_id"]}):
        already.add(f["following_id"])
    already.add(current["user_id"])
    cursor = db.users.find({"user_id": {"$nin": list(already)}}, {"_id": 0}).limit(20)
    users = []
    async for u in cursor:
        users.append(public_user(u))
    return {"users": users}


@api.get("/users/{username}")
async def get_user_profile(username: str, current=Depends(get_current_user_optional)):
    u = await db.users.find_one({"username": username.lower()}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    profile = public_user(u)
    # Check follow status
    if current:
        f = await db.follows.find_one({"follower_id": current["user_id"], "following_id": u["user_id"]})
        profile["is_following"] = bool(f and f.get("status") == "accepted")
        profile["follow_pending"] = bool(f and f.get("status") == "pending")
        profile["is_self"] = current["user_id"] == u["user_id"]
    else:
        profile["is_following"] = False
        profile["follow_pending"] = False
        profile["is_self"] = False
    return {"user": profile}


@api.post("/users/{user_id}/follow")
async def follow_user(user_id: str, current=Depends(get_current_user)):
    if user_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.follows.find_one({"follower_id": current["user_id"], "following_id": user_id})
    if existing:
        return {"status": existing.get("status", "accepted")}

    status_val = "pending" if target.get("is_private") else "accepted"
    await db.follows.insert_one({
        "follow_id": gen_id("fol"),
        "follower_id": current["user_id"],
        "following_id": user_id,
        "status": status_val,
        "created_at": now_utc(),
    })

    if status_val == "accepted":
        await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": 1}})
        await db.users.update_one({"user_id": current["user_id"]}, {"$inc": {"following_count": 1}})
        await create_notification(user_id, "follow", current["user_id"], None)
    else:
        await create_notification(user_id, "follow_request", current["user_id"], None)

    return {"status": status_val}


@api.delete("/users/{user_id}/follow")
async def unfollow(user_id: str, current=Depends(get_current_user)):
    existing = await db.follows.find_one({"follower_id": current["user_id"], "following_id": user_id})
    if not existing:
        return {"ok": True}
    await db.follows.delete_one({"follow_id": existing["follow_id"]})
    if existing.get("status") == "accepted":
        await db.users.update_one({"user_id": user_id}, {"$inc": {"followers_count": -1}})
        await db.users.update_one({"user_id": current["user_id"]}, {"$inc": {"following_count": -1}})
    return {"ok": True}


@api.post("/users/follow-requests/{follow_id}/accept")
async def accept_follow_request(follow_id: str, current=Depends(get_current_user)):
    f = await db.follows.find_one({"follow_id": follow_id})
    if not f or f["following_id"] != current["user_id"]:
        raise HTTPException(status_code=404, detail="Not found")
    if f["status"] != "pending":
        return {"ok": True}
    await db.follows.update_one({"follow_id": follow_id}, {"$set": {"status": "accepted"}})
    await db.users.update_one({"user_id": current["user_id"]}, {"$inc": {"followers_count": 1}})
    await db.users.update_one({"user_id": f["follower_id"]}, {"$inc": {"following_count": 1}})
    await create_notification(f["follower_id"], "follow_accepted", current["user_id"], None)
    return {"ok": True}


@api.post("/users/follow-requests/{follow_id}/decline")
async def decline_follow_request(follow_id: str, current=Depends(get_current_user)):
    f = await db.follows.find_one({"follow_id": follow_id})
    if not f or f["following_id"] != current["user_id"]:
        raise HTTPException(status_code=404, detail="Not found")
    await db.follows.delete_one({"follow_id": follow_id})
    return {"ok": True}


@api.get("/users/{user_id}/followers")
async def get_followers(user_id: str, current=Depends(get_current_user_optional)):
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("hide_followers") and (not current or current["user_id"] != user_id):
        return {"users": []}
    cursor = db.follows.find({"following_id": user_id, "status": "accepted"})
    users = []
    async for f in cursor:
        u = await db.users.find_one({"user_id": f["follower_id"]}, {"_id": 0})
        if u:
            users.append(public_user(u))
    return {"users": users}


@api.get("/users/{user_id}/following")
async def get_following(user_id: str, current=Depends(get_current_user_optional)):
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.get("hide_followers") and (not current or current["user_id"] != user_id):
        return {"users": []}
    cursor = db.follows.find({"follower_id": user_id, "status": "accepted"})
    users = []
    async for f in cursor:
        u = await db.users.find_one({"user_id": f["following_id"]}, {"_id": 0})
        if u:
            users.append(public_user(u))
    return {"users": users}


# ===== EXERCISES =====
@api.get("/exercises")
async def list_exercises(category: Optional[str] = None, q: Optional[str] = None, current=Depends(get_current_user_optional)):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if q:
        query["name"] = {"$regex": re.escape(q), "$options": "i"}
    # Include system + user's custom
    if current:
        query = {"$and": [query, {"$or": [{"system": True}, {"user_id": current["user_id"]}]}]} if query else \
            {"$or": [{"system": True}, {"user_id": current["user_id"]}]}
    else:
        query = {"$and": [query, {"system": True}]} if query else {"system": True}

    cursor = db.exercises.find(query, {"_id": 0}).sort("name", 1).limit(500)
    items = [doc async for doc in cursor]
    return {"exercises": items, "default_machines": DEFAULT_MACHINES}


@api.post("/exercises")
async def create_custom_exercise(body: ExerciseCreateIn, current=Depends(get_current_user)):
    doc = {
        "exercise_id": gen_id("ex"),
        "name": body.name,
        "category": body.category,
        "muscle_group": body.muscle_group,
        "is_unilateral": body.is_unilateral,
        "system": False,
        "user_id": current["user_id"],
        "created_at": now_utc(),
    }
    await db.exercises.insert_one(doc)
    doc.pop("_id", None)
    return {"exercise": doc}


@api.get("/exercises/{exercise_id}/history")
async def exercise_history(exercise_id: str, current=Depends(get_current_user)):
    """Aggregate history for an exercise — used by workout logger.
    Returns: last_session, personal_record (best 1RM), lifetime_volume, recent_sets[]."""
    cursor = db.workouts.find({
        "user_id": current["user_id"],
        "status": "completed",
        "exercises.exercise_id": exercise_id,
    }).sort("started_at", -1).limit(50)

    sessions = []
    lifetime_volume = 0.0
    best_1rm = 0.0
    best_set: Optional[dict] = None
    async for w in cursor:
        for ex in w.get("exercises", []):
            if ex.get("exercise_id") != exercise_id:
                continue
            session_sets = []
            session_volume = 0.0
            for s in ex.get("sets", []):
                if not s.get("completed"):
                    continue
                if ex.get("is_unilateral"):
                    lw, lr = s.get("left_weight") or 0, s.get("left_reps") or 0
                    rw, rr = s.get("right_weight") or 0, s.get("right_reps") or 0
                    vol = (lw * lr) + (rw * rr)
                    one_rm = max(epley_1rm(lw, lr), epley_1rm(rw, rr))
                else:
                    w_, r_ = s.get("weight") or 0, s.get("reps") or 0
                    vol = w_ * r_
                    one_rm = epley_1rm(w_, r_)
                session_volume += vol
                lifetime_volume += vol
                if one_rm > best_1rm:
                    best_1rm = one_rm
                    best_set = {**s, "machine": ex.get("machine"), "date": w.get("started_at")}
                session_sets.append(s)
            sessions.append({
                "workout_id": w["workout_id"],
                "date": w.get("started_at"),
                "machine": ex.get("machine"),
                "sets": session_sets,
                "volume": session_volume,
            })

    return {
        "sessions": sessions,
        "last_session": sessions[0] if sessions else None,
        "personal_record": {"estimated_1rm": best_1rm, "set": best_set} if best_set else None,
        "lifetime_volume": lifetime_volume,
        "session_count": len(sessions),
    }


# ===== WORKOUTS =====
@api.post("/workouts/start")
async def start_workout(body: WorkoutCreateIn, current=Depends(get_current_user)):
    # End any existing active workout
    await db.workouts.update_many(
        {"user_id": current["user_id"], "status": "active"},
        {"$set": {"status": "abandoned"}},
    )
    wid = gen_id("wk")
    doc = {
        "workout_id": wid,
        "user_id": current["user_id"],
        "name": body.name or "Workout",
        "notes": body.notes,
        "activity_type": body.activity_type or "lifting",
        "status": "active",
        "exercises": [],
        "started_at": now_utc(),
        "ended_at": None,
        "date": now_utc().date().isoformat(),
        "duration_seconds": 0,
        "created_at": now_utc(),
    }
    await db.workouts.insert_one(doc)
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {
        "currently_working_out": True,
        "active_workout_started_at": doc["started_at"],
        "active_workout_activity_type": doc["activity_type"],
    }})
    doc.pop("_id", None)
    return {"workout": doc}


@api.get("/workouts/active")
async def get_active_workout(current=Depends(get_current_user)):
    w = await db.workouts.find_one({"user_id": current["user_id"], "status": "active"}, {"_id": 0})
    return {"workout": w}


@api.post("/workouts/{workout_id}/finish")
async def finish_workout(workout_id: str, body: WorkoutFinishIn, current=Depends(get_current_user)):
    w = await db.workouts.find_one({"workout_id": workout_id, "user_id": current["user_id"]})
    if not w:
        raise HTTPException(status_code=404, detail="Workout not found")

    started = w.get("started_at")
    ended = now_utc()
    duration = body.duration_seconds or int((ended - started).total_seconds()) if started else 0

    # Compute volume + check PRs
    total_volume = 0.0
    prs: List[dict] = []
    exercises_clean = []
    for ex in body.exercises:
        ex_dict = ex.dict()
        ex_volume = 0.0
        best_set_1rm = 0.0
        for s in ex_dict["sets"]:
            if not s.get("completed"):
                continue
            if ex_dict.get("is_unilateral"):
                lw = s.get("left_weight") or 0
                lr = s.get("left_reps") or 0
                rw = s.get("right_weight") or 0
                rr = s.get("right_reps") or 0
                vol = (lw * lr) + (rw * rr)
                one_rm = max(epley_1rm(lw, lr), epley_1rm(rw, rr))
            else:
                vol = (s.get("weight") or 0) * (s.get("reps") or 0)
                one_rm = epley_1rm(s.get("weight") or 0, s.get("reps") or 0)
            ex_volume += vol
            if one_rm > best_set_1rm:
                best_set_1rm = one_rm
                _best_set_data = s  # noqa: F841 - retained for future PR detail
        total_volume += ex_volume
        ex_dict["volume"] = ex_volume
        exercises_clean.append(ex_dict)

        # Check for PR (compare to prior best 1RM)
        prior_best = 0.0
        cursor = db.workouts.find({
            "user_id": current["user_id"],
            "status": "completed",
            "exercises.exercise_id": ex.exercise_id,
            "workout_id": {"$ne": workout_id},
        })
        async for pw in cursor:
            for pex in pw.get("exercises", []):
                if pex.get("exercise_id") != ex.exercise_id:
                    continue
                for ps in pex.get("sets", []):
                    if not ps.get("completed"):
                        continue
                    if pex.get("is_unilateral"):
                        v = max(epley_1rm(ps.get("left_weight") or 0, ps.get("left_reps") or 0),
                                epley_1rm(ps.get("right_weight") or 0, ps.get("right_reps") or 0))
                    else:
                        v = epley_1rm(ps.get("weight") or 0, ps.get("reps") or 0)
                    if v > prior_best:
                        prior_best = v
        if best_set_1rm > prior_best and best_set_1rm > 0:
            prs.append({
                "exercise_id": ex.exercise_id,
                "exercise_name": ex.exercise_name,
                "estimated_1rm": best_set_1rm,
                "prior_best": prior_best,
            })

    update = {
        "status": "completed",
        "ended_at": ended,
        "duration_seconds": duration,
        "exercises": exercises_clean,
        "total_volume": total_volume,
        "prs": prs,
        "name": body.name or w.get("name", "Workout"),
        "notes": body.notes if body.notes is not None else w.get("notes"),
    }
    await db.workouts.update_one({"workout_id": workout_id}, {"$set": update})
    await db.users.update_one({"user_id": current["user_id"]}, {
        "$set": {
            "currently_working_out": False,
            "active_workout_started_at": None,
            "active_workout_activity_type": None,
        },
        "$inc": {"workouts_count": 1},
    })

    # Create social post
    if exercises_clean:
        visibility = body.visibility if body.visibility in ("public", "private") else "public"
        post_doc = {
            "post_id": gen_id("post"),
            "user_id": current["user_id"],
            "workout_id": workout_id,
            "name": update["name"],
            "duration_seconds": duration,
            "total_volume": total_volume,
            "exercise_count": len(exercises_clean),
            "prs": prs if visibility == "public" else [],
            "likes_count": 0,
            "comments_count": 0,
            "caption": (body.caption or "")[:500],
            "photos": (body.photos or [])[:6] if visibility == "public" else [],
            "visibility": visibility,
            "created_at": ended,
        }
        await db.posts.insert_one(post_doc)

    final = await db.workouts.find_one({"workout_id": workout_id}, {"_id": 0})
    return {"workout": final, "prs": prs}


@api.delete("/workouts/{workout_id}")
async def delete_workout(workout_id: str, current=Depends(get_current_user)):
    w = await db.workouts.find_one({"workout_id": workout_id})
    if not w or w["user_id"] != current["user_id"]:
        raise HTTPException(status_code=404, detail="Not found")
    await db.workouts.delete_one({"workout_id": workout_id})
    await db.posts.delete_many({"workout_id": workout_id})
    user_update: dict = {}
    if w.get("status") == "active":
        user_update["$set"] = {"currently_working_out": False}
    if w.get("status") == "completed":
        user_update["$inc"] = {"workouts_count": -1}
    if user_update:
        await db.users.update_one({"user_id": current["user_id"]}, user_update)
    return {"ok": True}


@api.get("/workouts/{workout_id}")
async def get_workout(workout_id: str, current=Depends(get_current_user_optional)):
    w = await db.workouts.find_one({"workout_id": workout_id}, {"_id": 0})
    if not w:
        raise HTTPException(status_code=404, detail="Not found")
    u = await db.users.find_one({"user_id": w["user_id"]}, {"_id": 0})
    return {"workout": w, "user": public_user(u) if u else None}


@api.get("/workouts/user/{user_id}")
async def list_user_workouts(user_id: str, limit: int = 50, current=Depends(get_current_user_optional)):
    cursor = db.workouts.find({"user_id": user_id, "status": "completed"}, {"_id": 0}).sort("started_at", -1).limit(limit)
    return {"workouts": [w async for w in cursor]}


@api.get("/workouts/user/{user_id}/calendar")
async def workouts_calendar(user_id: str, year: int, month: int, current=Depends(get_current_user_optional)):
    """Return dates of completed workouts for a month."""
    start_d = f"{year:04d}-{month:02d}-01"
    end_month = month + 1 if month < 12 else 1
    end_year = year if month < 12 else year + 1
    end_d = f"{end_year:04d}-{end_month:02d}-01"
    cursor = db.workouts.find({
        "user_id": user_id,
        "status": "completed",
        "date": {"$gte": start_d, "$lt": end_d},
    }, {"_id": 0, "workout_id": 1, "name": 1, "date": 1, "started_at": 1, "total_volume": 1, "duration_seconds": 1, "exercises": 1, "prs": 1})
    items = [w async for w in cursor]
    # Group by date
    by_date: Dict[str, List[dict]] = {}
    for w in items:
        d = w["date"]
        by_date.setdefault(d, []).append(w)
    return {"workouts_by_date": by_date}


# ===== CARDIO =====

class CardioIn(BaseModel):
    type: str
    duration_seconds: int
    distance_km: Optional[float] = None
    notes: Optional[str] = None
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today


@api.post("/cardio")
async def log_cardio(body: CardioIn, current=Depends(get_current_user)):
    import uuid as _uuid
    today = datetime.utcnow().strftime("%Y-%m-%d")
    doc = {
        "cardio_id": str(_uuid.uuid4()),
        "user_id": current["user_id"],
        "type": body.type,
        "duration_seconds": body.duration_seconds,
        "distance_km": body.distance_km,
        "notes": body.notes,
        "date": body.date or today,
        "created_at": datetime.utcnow().isoformat(),
    }
    await db.cardio.insert_one(doc)
    doc.pop("_id", None)
    return {"cardio": doc}


@api.get("/cardio")
async def list_cardio(limit: int = 200, current=Depends(get_current_user)):
    cursor = db.cardio.find({"user_id": current["user_id"]}, {"_id": 0}).sort("date", -1).limit(limit)
    return {"cardio": [c async for c in cursor]}


@api.get("/cardio/{cardio_id}")
async def get_cardio(cardio_id: str, current=Depends(get_current_user)):
    doc = await db.cardio.find_one({"cardio_id": cardio_id, "user_id": current["user_id"]}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    return {"cardio": doc}


@api.put("/cardio/{cardio_id}")
async def update_cardio(cardio_id: str, body: CardioIn, current=Depends(get_current_user)):
    doc = await db.cardio.find_one({"cardio_id": cardio_id, "user_id": current["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    updates = {k: v for k, v in body.dict().items() if v is not None}
    await db.cardio.update_one({"cardio_id": cardio_id}, {"$set": updates})
    updated = await db.cardio.find_one({"cardio_id": cardio_id}, {"_id": 0})
    return {"cardio": updated}


@api.delete("/cardio/{cardio_id}")
async def delete_cardio(cardio_id: str, current=Depends(get_current_user)):
    doc = await db.cardio.find_one({"cardio_id": cardio_id, "user_id": current["user_id"]})
    if not doc:
        raise HTTPException(status_code=404, detail="Not found")
    await db.cardio.delete_one({"cardio_id": cardio_id})
    await db.posts.delete_many({"cardio_id": cardio_id})
    return {"ok": True}


class CardioPostIn(BaseModel):
    caption: Optional[str] = None
    photos: Optional[List[str]] = None
    visibility: str = "public"


@api.post("/cardio/{cardio_id}/post")
async def post_cardio(cardio_id: str, body: CardioPostIn, current=Depends(get_current_user)):
    import uuid as _uuid
    c = await db.cardio.find_one({"cardio_id": cardio_id, "user_id": current["user_id"]})
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    # Upsert: one post per cardio session
    existing = await db.posts.find_one({"cardio_id": cardio_id})
    post_id = existing["post_id"] if existing else str(_uuid.uuid4())
    doc = {
        "post_id": post_id,
        "user_id": current["user_id"],
        "cardio_id": cardio_id,
        "workout_id": None,
        "name": c["type"],
        "duration_seconds": c["duration_seconds"],
        "distance_km": c.get("distance_km"),
        "total_volume": 0,
        "exercise_count": 0,
        "caption": body.caption,
        "photos": body.photos or [],
        "visibility": body.visibility,
        "prs": [],
        "likes_count": existing.get("likes_count", 0) if existing else 0,
        "comments_count": existing.get("comments_count", 0) if existing else 0,
        "created_at": existing["created_at"] if existing else datetime.utcnow().isoformat(),
        "post_type": "cardio",
    }
    await db.posts.replace_one({"post_id": post_id}, doc, upsert=True)
    doc.pop("_id", None)
    return {"post": doc}


# ===== FEED =====
@api.get("/feed")
async def get_feed(limit: int = 30, current=Depends(get_current_user)):
    """Feed = posts from followed users + self."""
    following_ids = [current["user_id"]]
    async for f in db.follows.find({"follower_id": current["user_id"], "status": "accepted"}):
        following_ids.append(f["following_id"])
    cursor = db.posts.find({"user_id": {"$in": following_ids}}, {"_id": 0}).sort("created_at", -1).limit(limit)
    posts = []
    async for p in cursor:
        u = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
        liked = await db.likes.find_one({"post_id": p["post_id"], "user_id": current["user_id"]})
        saved = await db.saves.find_one({"post_id": p["post_id"], "user_id": current["user_id"]})
        posts.append({**p, "user": public_user(u) if u else None, "liked": bool(liked), "saved": bool(saved)})
    return {"posts": posts}


@api.get("/feed/explore")
async def explore_feed(limit: int = 30, current=Depends(get_current_user_optional)):
    """Public posts from anyone (non-private accounts)."""
    cursor = db.posts.find({"visibility": "public"}, {"_id": 0}).sort("created_at", -1).limit(limit * 2)
    posts = []
    async for p in cursor:
        u = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
        if not u or u.get("is_private"):
            continue
        liked = False
        saved = False
        if current:
            liked = bool(await db.likes.find_one({"post_id": p["post_id"], "user_id": current["user_id"]}))
            saved = bool(await db.saves.find_one({"post_id": p["post_id"], "user_id": current["user_id"]}))
        posts.append({**p, "user": public_user(u), "liked": liked, "saved": saved})
        if len(posts) >= limit:
            break
    return {"posts": posts}


@api.post("/posts/{post_id}/like")
async def like_post(post_id: str, current=Depends(get_current_user)):
    p = await db.posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    existing = await db.likes.find_one({"post_id": post_id, "user_id": current["user_id"]})
    if existing:
        return {"liked": True}
    await db.likes.insert_one({
        "like_id": gen_id("lk"),
        "post_id": post_id,
        "user_id": current["user_id"],
        "created_at": now_utc(),
    })
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes_count": 1}})
    if p["user_id"] != current["user_id"]:
        await create_notification(p["user_id"], "like", current["user_id"], post_id)
    return {"liked": True}


@api.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, current=Depends(get_current_user)):
    res = await db.likes.delete_one({"post_id": post_id, "user_id": current["user_id"]})
    if res.deleted_count:
        await db.posts.update_one({"post_id": post_id}, {"$inc": {"likes_count": -1}})
    return {"liked": False}


@api.post("/posts/{post_id}/save")
async def save_post(post_id: str, current=Depends(get_current_user)):
    p = await db.posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    existing = await db.saves.find_one({"post_id": post_id, "user_id": current["user_id"]})
    if existing:
        return {"saved": True}
    await db.saves.insert_one({
        "save_id": gen_id("sv"),
        "post_id": post_id,
        "user_id": current["user_id"],
        "created_at": now_utc(),
    })
    if p["user_id"] != current["user_id"]:
        await create_notification(p["user_id"], "save", current["user_id"], post_id)
    return {"saved": True}


@api.delete("/posts/{post_id}/save")
async def unsave_post(post_id: str, current=Depends(get_current_user)):
    await db.saves.delete_one({"post_id": post_id, "user_id": current["user_id"]})
    return {"saved": False}


@api.post("/posts/{post_id}/comments")
async def create_comment(post_id: str, body: CommentIn, current=Depends(get_current_user)):
    p = await db.posts.find_one({"post_id": post_id})
    if not p:
        raise HTTPException(status_code=404, detail="Not found")
    cid = gen_id("c")
    doc = {
        "comment_id": cid,
        "post_id": post_id,
        "user_id": current["user_id"],
        "text": body.text,
        "parent_id": body.parent_id,
        "created_at": now_utc(),
    }
    await db.comments.insert_one(doc)
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"comments_count": 1}})
    if p["user_id"] != current["user_id"]:
        await create_notification(p["user_id"], "comment" if not body.parent_id else "reply", current["user_id"], post_id)
    doc.pop("_id", None)
    doc["user"] = public_user(current)
    return {"comment": doc}


@api.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, current=Depends(get_current_user_optional)):
    cursor = db.comments.find({"post_id": post_id}, {"_id": 0}).sort("created_at", 1).limit(500)
    out = []
    async for c in cursor:
        u = await db.users.find_one({"user_id": c["user_id"]}, {"_id": 0})
        out.append({**c, "user": public_user(u) if u else None})
    return {"comments": out}


@api.get("/posts/by-workout/{workout_id}")
async def post_by_workout(workout_id: str, current=Depends(get_current_user_optional)):
    p = await db.posts.find_one({"workout_id": workout_id}, {"_id": 0})
    return {"post": p}


# ===== NOTIFICATIONS =====
async def create_notification(user_id: str, notif_type: str, actor_id: str, ref_id: Optional[str]):
    if user_id == actor_id:
        return
    await db.notifications.insert_one({
        "notification_id": gen_id("n"),
        "user_id": user_id,
        "type": notif_type,
        "actor_id": actor_id,
        "ref_id": ref_id,
        "read": False,
        "created_at": now_utc(),
    })


@api.get("/notifications")
async def list_notifications(current=Depends(get_current_user)):
    cursor = db.notifications.find({"user_id": current["user_id"]}, {"_id": 0}).sort("created_at", -1).limit(100)
    items = []
    async for n in cursor:
        actor = await db.users.find_one({"user_id": n["actor_id"]}, {"_id": 0})
        n["actor"] = public_user(actor) if actor else None
        # If follow_request, attach follow_id for accept/decline
        if n["type"] == "follow_request":
            f = await db.follows.find_one({"follower_id": n["actor_id"], "following_id": current["user_id"], "status": "pending"})
            n["follow_id"] = f["follow_id"] if f else None
        items.append(n)
    return {"notifications": items}


@api.post("/notifications/read")
async def mark_notifications_read(current=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": current["user_id"], "read": False}, {"$set": {"read": True}})
    return {"ok": True}


@api.get("/notifications/unread-count")
async def unread_count(current=Depends(get_current_user)):
    n = await db.notifications.count_documents({"user_id": current["user_id"], "read": False})
    return {"count": n}


# ===== DIRECT MESSAGES =====
def _conv_id(a: str, b: str) -> str:
    ids = sorted([a, b])
    return f"conv_{ids[0]}_{ids[1]}"


@api.post("/conversations/start")
async def start_conversation(body: StartConversationIn, current=Depends(get_current_user)):
    other = await db.users.find_one({"user_id": body.user_id})
    if not other:
        raise HTTPException(status_code=404, detail="User not found")
    cid = _conv_id(current["user_id"], body.user_id)
    existing = await db.conversations.find_one({"conversation_id": cid})
    if not existing:
        doc = {
            "conversation_id": cid,
            "participants": [current["user_id"], body.user_id],
            "last_message": None,
            "last_message_at": now_utc(),
            "created_at": now_utc(),
        }
        await db.conversations.insert_one(doc)
    return {"conversation_id": cid}


@api.get("/conversations")
async def list_conversations(current=Depends(get_current_user)):
    uid = current["user_id"]
    cursor = db.conversations.find({"participants": uid}, {"_id": 0}).sort("last_message_at", -1)
    items = []
    async for c in cursor:
        other_id = next((p for p in c["participants"] if p != uid), None)
        if not other_id:
            continue
        other = await db.users.find_one({"user_id": other_id}, {"_id": 0})
        read_at = (c.get("read_at") or {}).get(uid)
        msg_filter: Dict[str, Any] = {"conversation_id": c["conversation_id"], "sender_id": {"$ne": uid}}
        if read_at:
            msg_filter["created_at"] = {"$gt": read_at}
        unread = await db.messages.count_documents(msg_filter)
        items.append({**c, "other_user": public_user(other) if other else None, "unread_count": unread})
    return {"conversations": items}


@api.get("/conversations/unread-count")
async def conversations_unread_count(current=Depends(get_current_user)):
    uid = current["user_id"]
    total = 0
    async for c in db.conversations.find({"participants": uid}):
        read_at = (c.get("read_at") or {}).get(uid)
        msg_filter: Dict[str, Any] = {"conversation_id": c["conversation_id"], "sender_id": {"$ne": uid}}
        if read_at:
            msg_filter["created_at"] = {"$gt": read_at}
        total += await db.messages.count_documents(msg_filter)
    return {"count": total}


@api.get("/conversations/{conversation_id}/messages")
async def list_messages(conversation_id: str, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conversation_id})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    cursor = db.messages.find({"conversation_id": conversation_id}, {"_id": 0}).sort("created_at", 1).limit(500)
    msgs = [m async for m in cursor]
    # Mark conversation as read for current user
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {f"read_at.{current['user_id']}": now_utc()}},
    )
    return {"messages": msgs}


@api.post("/conversations/{conversation_id}/messages")
async def send_message(conversation_id: str, body: MessageIn, current=Depends(get_current_user)):
    conv = await db.conversations.find_one({"conversation_id": conversation_id})
    if not conv or current["user_id"] not in conv["participants"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    mid = gen_id("msg")
    doc = {
        "message_id": mid,
        "conversation_id": conversation_id,
        "sender_id": current["user_id"],
        "text": body.text,
        "shared_workout_id": body.shared_workout_id,
        "shared_user_id": body.shared_user_id,
        "created_at": now_utc(),
    }
    await db.messages.insert_one(doc)
    preview = body.text or ("Shared a workout" if body.shared_workout_id else "Shared a profile")
    await db.conversations.update_one(
        {"conversation_id": conversation_id},
        {"$set": {"last_message": preview, "last_message_at": now_utc()}},
    )
    doc.pop("_id", None)
    return {"message": doc}


# ===== ANALYTICS (rule-based) =====
@api.get("/analytics/overview")
async def analytics_overview(current=Depends(get_current_user)):
    """FREE: total workouts, duration, weekly count, muscle group volume distribution.
    PREMIUM: total volume, weekly volume trend, top exercises ranked, exercise-level strength data."""
    is_prem = bool(current.get("is_premium"))
    cutoff = now_utc() - timedelta(weeks=12)
    cursor = db.workouts.find({"user_id": current["user_id"], "status": "completed", "started_at": {"$gte": cutoff}})
    weekly_volume: Dict[str, float] = {}
    weekly_count: Dict[str, int] = {}
    exercise_volume: Dict[str, Dict[str, Any]] = {}
    muscle_volume: Dict[str, float] = {}
    total_workouts = 0
    total_duration = 0
    total_volume = 0.0

    # Build exercise->muscle map
    ex_muscles: Dict[str, str] = {}
    async for ex in db.exercises.find({}, {"_id": 0, "exercise_id": 1, "muscle_group": 1}):
        ex_muscles[ex["exercise_id"]] = ex.get("muscle_group", "other")

    async for w in cursor:
        total_workouts += 1
        total_duration += w.get("duration_seconds", 0)
        total_volume += w.get("total_volume", 0) or 0
        started = w.get("started_at")
        if started:
            iso_year, iso_week, _ = started.isocalendar()
            wk_key = f"{iso_year}-W{iso_week:02d}"
            weekly_volume[wk_key] = weekly_volume.get(wk_key, 0) + (w.get("total_volume") or 0)
            weekly_count[wk_key] = weekly_count.get(wk_key, 0) + 1
        for ex in w.get("exercises", []):
            eid = ex.get("exercise_id")
            ename = ex.get("exercise_name")
            vol = ex.get("volume", 0) or 0
            if eid:
                if eid not in exercise_volume:
                    exercise_volume[eid] = {"exercise_id": eid, "exercise_name": ename, "volume": 0, "sessions": 0}
                exercise_volume[eid]["volume"] += vol
                exercise_volume[eid]["sessions"] += 1
                mg = ex_muscles.get(eid, "other")
                muscle_volume[mg] = muscle_volume.get(mg, 0) + vol

    weeks_sorted = sorted(weekly_volume.keys())
    base = {
        "total_workouts": total_workouts,
        "total_duration_seconds": total_duration,
        "weekly_workouts": [{"week": k, "workouts": weekly_count.get(k, 0)} for k in weeks_sorted],
        "muscle_volume": [{"muscle": k, "volume": v} for k, v in sorted(muscle_volume.items(), key=lambda x: -x[1])],
        "is_premium": is_prem,
    }
    if not is_prem:
        # Lock premium fields with null placeholders so client can show paywall
        base.update({
            "total_volume": None,
            "weekly_volume": None,
            "top_exercises": None,
            "premium_locked": [
                "total_volume", "weekly_volume", "top_exercises", "strength_trend", "exercise_analytics",
            ],
        })
        return base
    base.update({
        "total_volume": total_volume,
        "weekly_volume": [{"week": k, "volume": weekly_volume[k], "workouts": weekly_count.get(k, 0)} for k in weeks_sorted],
        "top_exercises": sorted(exercise_volume.values(), key=lambda x: -x["volume"])[:10],
    })
    return base


@api.get("/analytics/exercise/{exercise_id}")
async def exercise_analytics(exercise_id: str, current=Depends(get_current_user)):
    """Premium-only: 1RM trend, plateau detection, imbalance for one exercise."""
    if not current.get("is_premium"):
        raise HTTPException(status_code=402, detail="Premium subscription required")
    cursor = db.workouts.find({
        "user_id": current["user_id"],
        "status": "completed",
        "exercises.exercise_id": exercise_id,
    }).sort("started_at", 1)

    points = []  # {date, best_1rm, volume, left_volume, right_volume}
    is_unilateral_ever = False
    async for w in cursor:
        for ex in w.get("exercises", []):
            if ex.get("exercise_id") != exercise_id:
                continue
            best = 0.0
            vol = 0.0
            lvol = 0.0
            rvol = 0.0
            for s in ex.get("sets", []):
                if not s.get("completed"):
                    continue
                if ex.get("is_unilateral"):
                    is_unilateral_ever = True
                    lw, lr = s.get("left_weight") or 0, s.get("left_reps") or 0
                    rw, rr = s.get("right_weight") or 0, s.get("right_reps") or 0
                    one_rm = max(epley_1rm(lw, lr), epley_1rm(rw, rr))
                    vol += (lw * lr) + (rw * rr)
                    lvol += lw * lr
                    rvol += rw * rr
                else:
                    w_, r_ = s.get("weight") or 0, s.get("reps") or 0
                    one_rm = epley_1rm(w_, r_)
                    vol += w_ * r_
                if one_rm > best:
                    best = one_rm
            if vol > 0:
                points.append({
                    "date": w["started_at"].isoformat() if w.get("started_at") else None,
                    "best_1rm": best,
                    "volume": vol,
                    "left_volume": lvol,
                    "right_volume": rvol,
                })

    # Plateau detection: best 1RM hasn't increased in last N sessions
    plateau_weeks = 0
    if len(points) >= 3:
        recent_best = max(p["best_1rm"] for p in points[-5:]) if len(points) >= 5 else max(p["best_1rm"] for p in points)
        peak_overall = max(p["best_1rm"] for p in points)
        if recent_best < peak_overall * 0.98:
            # how many sessions since peak
            peak_idx = max(range(len(points)), key=lambda i: points[i]["best_1rm"])
            sessions_since_peak = len(points) - 1 - peak_idx
            plateau_weeks = max(1, sessions_since_peak)

    # 1RM trend
    first_1rm = points[0]["best_1rm"] if points else 0
    last_1rm = points[-1]["best_1rm"] if points else 0
    trend_pct = round(((last_1rm - first_1rm) / first_1rm * 100), 1) if first_1rm > 0 else 0

    # Imbalance
    imbalance_pct = None
    if is_unilateral_ever:
        total_l = sum(p["left_volume"] for p in points)
        total_r = sum(p["right_volume"] for p in points)
        if total_l > 0 and total_r > 0:
            stronger = max(total_l, total_r)
            weaker = min(total_l, total_r)
            imbalance_pct = round((stronger - weaker) / stronger * 100, 1)

    return {
        "points": points,
        "plateau_sessions": plateau_weeks,
        "trend_pct": trend_pct,
        "first_1rm": first_1rm,
        "last_1rm": last_1rm,
        "imbalance_pct": imbalance_pct,
        "is_unilateral": is_unilateral_ever,
    }


# ===== AI INSIGHTS (Premium) =====
@api.post("/insights/generate")
async def generate_insights(current=Depends(get_current_user)):
    if not current.get("is_premium"):
        raise HTTPException(status_code=402, detail="Premium subscription required")

    # Build summary of last 12 weeks
    cutoff = now_utc() - timedelta(weeks=12)
    workouts = []
    cursor = db.workouts.find({"user_id": current["user_id"], "status": "completed", "started_at": {"$gte": cutoff}}).sort("started_at", 1)
    async for w in cursor:
        workouts.append(w)

    if not workouts:
        return {"insights": [{"title": "Get Started", "body": "Log a few workouts so Atho can analyze your progress and detect plateaus."}]}

    # Build per-exercise summary
    ex_data: Dict[str, Dict[str, Any]] = {}
    for w in workouts:
        for ex in w.get("exercises", []):
            eid = ex.get("exercise_id")
            ename = ex.get("exercise_name")
            if not eid:
                continue
            if eid not in ex_data:
                ex_data[eid] = {"name": ename, "is_unilateral": ex.get("is_unilateral", False), "sessions": []}
            best_1rm = 0
            total_vol = 0
            lvol = 0
            rvol = 0
            for s in ex.get("sets", []):
                if not s.get("completed"):
                    continue
                if ex.get("is_unilateral"):
                    lw, lr = s.get("left_weight") or 0, s.get("left_reps") or 0
                    rw, rr = s.get("right_weight") or 0, s.get("right_reps") or 0
                    one_rm = max(epley_1rm(lw, lr), epley_1rm(rw, rr))
                    total_vol += (lw * lr) + (rw * rr)
                    lvol += lw * lr
                    rvol += rw * rr
                else:
                    one_rm = epley_1rm(s.get("weight") or 0, s.get("reps") or 0)
                    total_vol += (s.get("weight") or 0) * (s.get("reps") or 0)
                if one_rm > best_1rm:
                    best_1rm = one_rm
            ex_data[eid]["sessions"].append({
                "date": w["started_at"].date().isoformat() if w.get("started_at") else None,
                "best_1rm": best_1rm,
                "volume": total_vol,
                "left_vol": lvol,
                "right_vol": rvol,
            })

    # Build prompt summary
    summary_lines = []
    for eid, dat in list(ex_data.items())[:10]:
        sessions = dat["sessions"]
        if len(sessions) < 2:
            continue
        first_1rm = sessions[0]["best_1rm"]
        last_1rm = sessions[-1]["best_1rm"]
        change = last_1rm - first_1rm
        line = f"- {dat['name']}: {len(sessions)} sessions, est 1RM {first_1rm:.0f} → {last_1rm:.0f} ({change:+.0f})"
        if dat["is_unilateral"]:
            tl = sum(s["left_vol"] for s in sessions)
            tr = sum(s["right_vol"] for s in sessions)
            if tl > 0 and tr > 0:
                diff = abs(tl - tr) / max(tl, tr) * 100
                line += f", L/R volume diff {diff:.0f}%"
        summary_lines.append(line)

    summary_text = "\n".join(summary_lines) if summary_lines else "User has limited training data."

    prompt = f"""You are an elite strength coach. Analyze this athlete's last 12 weeks of training and produce 3-5 concise, actionable insights.

Training summary:
{summary_text}

Total workouts: {len(workouts)}
Average per week: {len(workouts)/12:.1f}

Return ONLY a JSON array (no markdown) of objects with "title" and "body" fields.
Each insight should be specific to the data above. Examples of good insight titles:
- "Bench Press Plateau"
- "Strong Upper Body Progress"  
- "Right-Side Dominance Detected"
- "Volume Trend Up"

Keep body fields to 1-2 sentences. Be specific with numbers when relevant."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"insights-{current['user_id']}-{int(now_utc().timestamp())}",
            system_message="You are an elite strength coach providing concise, data-driven training insights. Return only valid JSON.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        msg = UserMessage(text=prompt)
        resp = await chat.send_message(msg)
        # Parse JSON
        import json
        text = resp.strip()
        # Strip possible code fence
        if text.startswith("```"):
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
        insights = json.loads(text)
        if not isinstance(insights, list):
            insights = [{"title": "Coach Note", "body": str(insights)}]
    except Exception as e:
        logger.error(f"LLM insights failed: {e}")
        # Fallback to rule-based summary
        insights = []
        for line in summary_lines[:3]:
            insights.append({"title": "Training Progress", "body": line.lstrip("- ")})
        if not insights:
            insights = [{"title": "Keep Going", "body": f"You've completed {len(workouts)} workouts. Log more to unlock deeper insights."}]

    # Save
    await db.insights.insert_one({
        "insight_id": gen_id("ins"),
        "user_id": current["user_id"],
        "items": insights,
        "created_at": now_utc(),
    })
    return {"insights": insights}


@api.get("/insights/latest")
async def latest_insights(current=Depends(get_current_user)):
    doc = await db.insights.find_one({"user_id": current["user_id"]}, {"_id": 0}, sort=[("created_at", -1)])
    if not doc:
        return {"insights": [], "created_at": None}
    return {"insights": doc["items"], "created_at": doc["created_at"]}


# ===== SUBSCRIPTION (Stripe) =====
@api.get("/subscription/status")
async def subscription_status(current=Depends(get_current_user)):
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {
        "is_premium": u.get("is_premium", False),
        "status": u.get("stripe_subscription_status", "inactive"),
        "current_period_end": u.get("stripe_period_end"),
    }


@api.post("/subscription/checkout")
async def create_checkout(current=Depends(get_current_user), request: Request = None):
    """Create a Stripe Checkout Session for Atho Premium (30-day pass for $9.99)."""
    origin_header = request.headers.get("origin") if request else None
    origin = origin_header or "https://strength-social-3.preview.emergentagent.com"

    webhook_url = f"{origin}/api/subscription/webhook"
    sc = StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)

    try:
        session = await sc.create_checkout_session(CheckoutSessionRequest(
            amount=9.99,
            currency="usd",
            success_url=f"{origin}/subscription-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{origin}/subscription",
            metadata={"user_id": current["user_id"], "product": "atho_premium_monthly"},
        ))
        # Record pending transaction
        await db.payment_transactions.insert_one({
            "transaction_id": gen_id("tx"),
            "session_id": session.session_id,
            "user_id": current["user_id"],
            "amount": 9.99,
            "currency": "usd",
            "status": "pending",
            "payment_status": "unpaid",
            "metadata": {"product": "atho_premium_monthly"},
            "created_at": now_utc(),
        })
        return {"checkout_url": session.url, "session_id": session.session_id}
    except Exception as e:
        logger.error(f"Stripe checkout failed: {e}")
        raise HTTPException(status_code=500, detail=f"Checkout creation failed: {e}")


@api.get("/subscription/verify")
async def verify_checkout(session_id: str, current=Depends(get_current_user)):
    sc = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        status_resp = await sc.get_checkout_status(session_id)
        # Update transaction
        update = {
            "status": status_resp.status,
            "payment_status": status_resp.payment_status,
            "updated_at": now_utc(),
        }
        await db.payment_transactions.update_one({"session_id": session_id}, {"$set": update})

        if status_resp.payment_status == "paid":
            # Activate premium for 30 days (idempotent — only extend on first paid receipt)
            tx = await db.payment_transactions.find_one({"session_id": session_id})
            if tx and not tx.get("premium_granted"):
                now_dt = now_utc()
                u = await db.users.find_one({"user_id": current["user_id"]})
                # Extend from later of (current period end, now)
                current_end = u.get("stripe_period_end") if u else None
                if current_end and isinstance(current_end, datetime):
                    if current_end.tzinfo is None:
                        current_end = current_end.replace(tzinfo=timezone.utc)
                    base = max(current_end, now_dt)
                else:
                    base = now_dt
                new_end = base + timedelta(days=30)
                await db.users.update_one(
                    {"user_id": current["user_id"]},
                    {"$set": {
                        "is_premium": True,
                        "stripe_subscription_status": "active",
                        "stripe_period_end": new_end,
                    }},
                )
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"premium_granted": True}},
                )
            return {"ok": True, "is_premium": True, "status": status_resp.status, "payment_status": status_resp.payment_status}
        return {"ok": False, "is_premium": False, "status": status_resp.status, "payment_status": status_resp.payment_status}
    except Exception as e:
        logger.error(f"Stripe verify failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@api.post("/subscription/cancel")
async def cancel_subscription(current=Depends(get_current_user)):
    """Cancel: flip premium off immediately (since this is a 30-day pass model)."""
    await db.users.update_one(
        {"user_id": current["user_id"]},
        {"$set": {"is_premium": False, "stripe_subscription_status": "canceled", "stripe_period_end": None}},
    )
    return {"ok": True}


@api.post("/subscription/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for payment completion (via emergent wrapper)."""
    payload = await request.body()
    signature = request.headers.get("Stripe-Signature")
    sc = StripeCheckout(api_key=STRIPE_API_KEY)
    try:
        event = await sc.handle_webhook(payload, signature)
    except Exception as e:
        logger.error(f"Webhook parse failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid payload")

    # event.event_type ~ "checkout.session.completed", event.session_id, event.payment_status
    if getattr(event, "payment_status", None) == "paid" and getattr(event, "session_id", None):
        tx = await db.payment_transactions.find_one({"session_id": event.session_id})
        if tx and not tx.get("premium_granted"):
            now_dt = now_utc()
            new_end = now_dt + timedelta(days=30)
            await db.users.update_one(
                {"user_id": tx["user_id"]},
                {"$set": {"is_premium": True, "stripe_subscription_status": "active", "stripe_period_end": new_end}},
            )
            await db.payment_transactions.update_one(
                {"session_id": event.session_id},
                {"$set": {"premium_granted": True, "status": "complete", "payment_status": "paid"}},
            )
    return {"received": True}


@api.post("/users/me/seen-tour")
async def mark_tour_seen(current=Depends(get_current_user)):
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"seen_welcome_tour": True}})
    return {"ok": True}


# ===== HEALTH =====
@api.get("/")
async def root():
    return {"app": "Athos", "version": "1.1"}


# ===== GOALS & COACH PLAN =====
@api.post("/users/goals")
async def set_goals(body: GoalsIn, current=Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(u)}


# Athos in-house coaching split templates (user-provided rules)
SPLIT_TEMPLATES = {
    6: [
        {
            "name": "Push Pull Legs (PPL × 2)",
            "schedule": ["Push", "Pull", "Legs", "Push", "Pull", "Legs", "Rest"],
            "volume_note": "2-3 sets per muscle group per workout. One rest day mid-week is okay.",
        },
        {
            "name": "Upper / Lower (6×)",
            "schedule": ["Upper", "Lower", "Upper", "Lower", "Upper", "Lower", "Rest (Sun)"],
            "volume_note": "Lower per-session volume: arms 1-2 sets, back & chest 3 sets, hamstrings 3, quads 3, glutes/adductors 2 sets mix.",
        },
    ],
    5: [{
        "name": "PPL + Upper / Lower",
        "schedule": ["Push", "Pull", "Legs", "Rest", "Upper", "Lower", "Rest"],
        "volume_note": "2-3 sets per muscle on PPL days; Upper/Lower acts as a higher-volume finisher week.",
    }],
    4: [{
        "name": "Upper / Lower (4×)",
        "schedule": ["Upper", "Lower", "Rest", "Upper", "Lower", "Rest", "Rest"],
        "volume_note": "3-4 sets per muscle group per session. Use rest days for cardio if desired.",
    }],
    3: [{
        "name": "Upper / Lower / Full Body",
        "schedule": ["Upper", "Rest", "Lower", "Rest", "Rest", "Full Body", "Rest"],
        "volume_note": "Higher volume sessions: 4-5 working sets per muscle group.",
    }],
    2: [{
        "name": "Full Body × 2",
        "schedule": ["Full Body", "Rest", "Rest", "Full Body", "Rest", "Rest", "Rest"],
        "volume_note": "Compound-focused full-body sessions, 3-4 sets per movement.",
    }],
}


@api.post("/coach/plan")
async def generate_coach_plan(current=Depends(get_current_user)):
    """Generate a personalized AI training plan. Free for all users."""
    prefs = current.get("plan_preferences") or {}
    days = int(prefs.get("days_per_week") or current.get("training_days_per_week") or 3)
    goal = prefs.get("primary_goal") or current.get("main_goal") or "hypertrophy"
    weight_goal = prefs.get("weight_goal") or current.get("weight_goal") or "maintain"
    duration_min = int(prefs.get("session_duration_min") or 60)
    experience = prefs.get("experience_level") or current.get("experience_level") or "intermediate"
    equipment = prefs.get("equipment") or "full_gym"
    focus_areas = prefs.get("focus_areas") or []
    injuries = prefs.get("injuries") or ""
    extra_notes = prefs.get("extra_notes") or ""

    templates = SPLIT_TEMPLATES.get(days, SPLIT_TEMPLATES[3])
    plan = {
        "days_per_week": days,
        "main_goal": goal,
        "weight_goal": weight_goal,
        "session_duration_min": duration_min,
        "experience": experience,
        "equipment": equipment,
        "focus_areas": focus_areas,
        "templates": templates,
        "ai_enriched": False,
        "ai_summary": None,
        "ai_weekly_plan": None,
    }

    # Pull last 4 weeks of workout notes to feed AI context
    cutoff = now_utc() - timedelta(weeks=4)
    notes_lines: List[str] = []
    async for w in db.workouts.find({
        "user_id": current["user_id"],
        "status": "completed",
        "started_at": {"$gte": cutoff},
    }, {"_id": 0, "name": 1, "notes": 1, "exercises.exercise_name": 1, "exercises.notes": 1}):
        if w.get("notes"):
            notes_lines.append(f"- Session '{w.get('name')}': {w['notes']}")
        for ex in (w.get("exercises") or []):
            if ex.get("notes"):
                notes_lines.append(f"  · {ex.get('exercise_name')}: {ex['notes']}")
    notes_text = "\n".join(notes_lines[:30]) if notes_lines else "(no recent workout notes)"

    equip_label = {"full_gym": "full gym", "home_dumbbells": "home gym with dumbbells/bands", "bodyweight": "bodyweight only"}.get(equipment, equipment)

    prompt = (
        f"You are an elite strength coach for Athos. Build a 7-day plan personalized for this athlete.\n\n"
        f"ATHLETE PROFILE:\n"
        f"- Trains {days}× per week, ~{duration_min} minutes per session\n"
        f"- Experience level: {experience}\n"
        f"- Equipment: {equip_label}\n"
        f"- Primary goal: {goal}\n"
        f"- Weight goal: {weight_goal}\n"
        f"- Focus areas requested: {', '.join(focus_areas) if focus_areas else 'balanced'}\n"
        f"- Injuries / limitations: {injuries or 'none reported'}\n"
        f"- Additional context from athlete: {extra_notes or 'none'}\n\n"
        f"Recent workout notes (use to refine the plan if relevant):\n{notes_text}\n\n"
        f"Return ONLY JSON with shape:\n"
        f'{{"summary": "2-3 sentence overview tailored to this athlete", "weekly_plan": [{{"day":"Mon","focus":"Push","exercises":[{{"name":"...","sets":3,"reps":"8-10","note":"..."}}]}}]}}\n'
        f"Total of 7 days (include rest days as focus='Rest' with empty exercises). Make exercise picks match their equipment and experience. Volume should fit the {duration_min}-minute window."
    )

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        import json as _json
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"coach-plan-{current['user_id']}-{int(now_utc().timestamp())}",
            system_message="You are an elite strength coach. Output strict JSON only.",
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        resp = await chat.send_message(UserMessage(text=prompt))
        txt = resp.strip()
        if txt.startswith("```"):
            txt = re.sub(r"^```(?:json)?\s*", "", txt)
            txt = re.sub(r"\s*```$", "", txt)
        parsed = _json.loads(txt)
        plan["ai_summary"] = parsed.get("summary")
        plan["ai_weekly_plan"] = parsed.get("weekly_plan")
        plan["ai_enriched"] = True
    except Exception as e:
        logger.error(f"Coach AI plan failed: {e}")

    # Persist latest plan
    await db.coach_plans.update_one(
        {"user_id": current["user_id"]},
        {"$set": {**plan, "user_id": current["user_id"], "updated_at": now_utc()}},
        upsert=True,
    )
    return {"plan": plan}


@api.get("/coach/plan")
async def get_coach_plan(current=Depends(get_current_user)):
    doc = await db.coach_plans.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"plan": doc}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
