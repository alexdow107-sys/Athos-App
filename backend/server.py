"""Atho - Social Workout Tracking Platform - Backend API."""
import os
import re
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import FastAPI, APIRouter, Depends, HTTPException, status, Header, Request
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


def coerce_dt(v) -> Optional[datetime]:
    """Posts store created_at as a datetime (workouts) or ISO string (cardio).
    Normalize to an aware datetime for comparisons; return None if unparseable."""
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    if isinstance(v, str):
        try:
            d = datetime.fromisoformat(v.replace("Z", "+00:00"))
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except Exception:
            return None
    return None


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
    local_date: Optional[str] = None  # client's local date YYYY-MM-DD; falls back to UTC


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
    await db.blocks.create_index([("blocker_id", 1), ("blocked_id", 1)], unique=True)
    await db.blocks.create_index([("blocked_id", 1)])
    await db.reports.create_index([("status", 1), ("created_at", -1)])
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


@api.get("/auth/me")
async def me(current=Depends(get_current_user)):
    return {"user": public_user(current)}


@api.post("/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


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
    already |= await blocked_user_ids(current["user_id"])
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
        profile["is_blocked"] = bool(await db.blocks.find_one(
            {"blocker_id": current["user_id"], "blocked_id": u["user_id"]}))
    else:
        profile["is_following"] = False
        profile["follow_pending"] = False
        profile["is_self"] = False
        profile["is_blocked"] = False
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


# ===== BLOCKING & REPORTING (content moderation) =====

async def blocked_user_ids(uid: str) -> set:
    """User IDs hidden from `uid` in both directions — people they blocked AND
    people who blocked them. Used to filter feeds, discovery, and messaging."""
    ids = set()
    async for b in db.blocks.find(
        {"$or": [{"blocker_id": uid}, {"blocked_id": uid}]},
        {"_id": 0, "blocker_id": 1, "blocked_id": 1},
    ):
        ids.add(b["blocker_id"])
        ids.add(b["blocked_id"])
    ids.discard(uid)
    return ids


async def is_blocked_between(a: str, b: str) -> bool:
    """True if either user has blocked the other."""
    return bool(await db.blocks.find_one({"$or": [
        {"blocker_id": a, "blocked_id": b},
        {"blocker_id": b, "blocked_id": a},
    ]}))


@api.post("/users/{user_id}/block")
async def block_user(user_id: str, current=Depends(get_current_user)):
    if user_id == current["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    target = await db.users.find_one({"user_id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    uid = current["user_id"]
    if not await db.blocks.find_one({"blocker_id": uid, "blocked_id": user_id}):
        await db.blocks.insert_one({
            "block_id": gen_id("blk"),
            "blocker_id": uid,
            "blocked_id": user_id,
            "created_at": now_utc(),
        })
    # Tear down any follow relationship in both directions, keeping counts correct.
    for follower, following in ((uid, user_id), (user_id, uid)):
        f = await db.follows.find_one({"follower_id": follower, "following_id": following})
        if f:
            await db.follows.delete_one({"follow_id": f["follow_id"]})
            if f.get("status") == "accepted":
                await db.users.update_one({"user_id": following}, {"$inc": {"followers_count": -1}})
                await db.users.update_one({"user_id": follower}, {"$inc": {"following_count": -1}})
    return {"ok": True, "blocked": True}


@api.delete("/users/{user_id}/block")
async def unblock_user(user_id: str, current=Depends(get_current_user)):
    await db.blocks.delete_one({"blocker_id": current["user_id"], "blocked_id": user_id})
    return {"ok": True, "blocked": False}


@api.get("/blocks")
async def list_blocks(current=Depends(get_current_user)):
    """Accounts the current user has blocked (for the management screen)."""
    out = []
    async for b in db.blocks.find({"blocker_id": current["user_id"]}, {"_id": 0}).sort("created_at", -1):
        u = await db.users.find_one({"user_id": b["blocked_id"]}, {"_id": 0})
        if u:
            out.append(public_user(u))
    return {"blocked": out}


class ReportIn(BaseModel):
    target_type: str           # "post" | "user" | "comment" | "message"
    target_id: str
    reason: str                # short category, e.g. "spam", "harassment"
    details: Optional[str] = None


@api.post("/reports")
async def create_report(body: ReportIn, current=Depends(get_current_user)):
    if body.target_type not in ("post", "user", "comment", "message"):
        raise HTTPException(status_code=400, detail="Invalid report target")
    await db.reports.insert_one({
        "report_id": gen_id("rep"),
        "reporter_id": current["user_id"],
        "target_type": body.target_type,
        "target_id": body.target_id,
        "reason": body.reason,
        "details": (body.details or "")[:1000],
        "status": "open",
        "created_at": now_utc(),
    })
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


def detect_weight_stall(sessions: List[dict], weight_unit: str) -> Optional[dict]:
    """
    Flag when the top working set's weight (and reps) hasn't progressed for at
    least 3 sessions spanning ~3+ weeks — the classic plateau — and suggest
    bumping the weight to break the cycle.

    `sessions` is newest-first (as returned by exercise_history). Returns a
    suggestion dict, or None if there's no stall.
    """
    tops = []  # (date, top_weight, reps_at_top_weight), newest-first
    for s in sessions:
        top = None
        for st in s.get("sets", []):
            if st.get("weight") is not None:
                w_, r_ = st.get("weight") or 0, st.get("reps") or 0
            else:  # unilateral — use the heavier side
                lw, lr = st.get("left_weight") or 0, st.get("left_reps") or 0
                rw, rr = st.get("right_weight") or 0, st.get("right_reps") or 0
                w_, r_ = (lw, lr) if lw >= rw else (rw, rr)
            if w_ and w_ > 0 and (top is None or w_ > top[0]):
                top = (w_, r_)
        d = coerce_dt(s.get("date"))
        if top and d:
            tops.append((d, top[0], top[1]))

    if len(tops) < 3:
        return None

    # Streak of the most-recent consecutive sessions at the same top weight.
    cur_weight = tops[0][1]
    streak = []
    for (d, w_, r_) in tops:
        if abs(w_ - cur_weight) < 1e-6:
            streak.append((d, w_, r_))
        else:
            break  # they went heavier/lighter — not a flat stall

    if len(streak) < 3:
        return None
    span_days = (streak[0][0] - streak[-1][0]).total_seconds() / 86400.0
    if span_days < 21:  # under ~3 weeks
        return None
    # If reps are still climbing at this weight, that's genuine (double) progression.
    if streak[0][2] > streak[-1][2] + 1:
        return None

    step = 2.5 if (weight_unit or "kg") == "kg" else 5
    suggested = round((cur_weight + step) * 100) / 100
    return {
        "stalled": True,
        "weight": cur_weight,
        "reps": streak[0][2],
        "sessions": len(streak),
        "weeks": round(span_days / 7.0),
        "suggested_weight": suggested,
        "unit": weight_unit or "kg",
    }


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

    stall = detect_weight_stall(sessions, current.get("weight_unit", "kg"))

    return {
        "sessions": sessions,
        "last_session": sessions[0] if sessions else None,
        "personal_record": {"estimated_1rm": best_1rm, "set": best_set} if best_set else None,
        "lifetime_volume": lifetime_volume,
        "session_count": len(sessions),
        "stall": stall,
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
        # Day the workout belongs to, in the user's LOCAL timezone (sent by client).
        # Falls back to the UTC date for older clients that don't send it.
        "date": body.local_date or now_utc().date().isoformat(),
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
        "created_at": existing["created_at"] if existing else now_utc(),
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
    blocked = await blocked_user_ids(current["user_id"])
    following_ids = [i for i in following_ids if i not in blocked]
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
    """
    Discover public posts from accounts you DON'T already follow, ranked by how
    close they are to your own activity:
      - creators whose posts you've liked/saved before (engagement affinity),
      - workouts that share exercises with your own training (content overlap),
      - your lifting/cardio mix,
    then popularity and recency. Logged-out users get popular, recent public posts.
    """
    excluded_ids = set()       # self + people you already follow
    interest_authors = set()   # creators whose posts you've liked/saved
    my_exercises = set()       # exercise_ids you train
    does_cardio = False
    does_lifting = False

    if current:
        uid = current["user_id"]
        excluded_ids.add(uid)
        async for f in db.follows.find(
            {"follower_id": uid, "status": "accepted"}, {"following_id": 1}
        ):
            excluded_ids.add(f["following_id"])
        excluded_ids |= await blocked_user_ids(uid)  # hide blocked accounts both ways

        # Engagement affinity — authors of posts you've liked or saved
        engaged_post_ids = set()
        async for l in db.likes.find({"user_id": uid}, {"post_id": 1}).limit(300):
            engaged_post_ids.add(l["post_id"])
        async for s in db.saves.find({"user_id": uid}, {"post_id": 1}).limit(300):
            engaged_post_ids.add(s["post_id"])
        if engaged_post_ids:
            async for p in db.posts.find(
                {"post_id": {"$in": list(engaged_post_ids)}}, {"user_id": 1}
            ):
                interest_authors.add(p["user_id"])

        # Content overlap — exercises you actually train
        async for w in db.workouts.find(
            {"user_id": uid, "status": "completed"}, {"exercises.exercise_id": 1}
        ).sort("started_at", -1).limit(40):
            does_lifting = True
            for ex in (w.get("exercises") or []):
                if ex.get("exercise_id"):
                    my_exercises.add(ex["exercise_id"])
        does_cardio = bool(await db.cardio.find_one({"user_id": uid}, {"_id": 1}))

    # Candidate pool: recent public posts not from excluded users
    query: Dict[str, Any] = {"visibility": "public"}
    if excluded_ids:
        query["user_id"] = {"$nin": list(excluded_ids)}
    candidates = [
        p async for p in db.posts.find(query, {"_id": 0})
        .sort("created_at", -1).limit(max(limit * 4, 100))
    ]

    now_ts = now_utc()
    scored = []
    for p in candidates:
        u = await db.users.find_one({"user_id": p["user_id"]}, {"_id": 0})
        if not u or u.get("is_private"):
            continue
        score = 0.0
        # Engagement affinity with this creator
        if p["user_id"] in interest_authors:
            score += 5.0
        # Exercise overlap with your training (workout posts only)
        if my_exercises and p.get("workout_id"):
            w = await db.workouts.find_one(
                {"workout_id": p["workout_id"]}, {"exercises.exercise_id": 1}
            )
            if w:
                post_ex = {ex.get("exercise_id") for ex in (w.get("exercises") or [])}
                overlap = len(post_ex & my_exercises)
                if overlap:
                    score += min(overlap, 5) * 1.5
        # Activity-type affinity (covers cardio posts, which have no exercises)
        is_cardio_post = p.get("post_type") == "cardio" or bool(p.get("cardio_id"))
        if is_cardio_post and does_cardio:
            score += 2.0
        elif not is_cardio_post and does_lifting:
            score += 1.0
        # Popularity + recency
        score += min(p.get("likes_count", 0), 25) * 0.2
        created = coerce_dt(p.get("created_at"))
        if created:
            age_days = max((now_ts - created).total_seconds() / 86400.0, 0.0)
            score += max(0.0, 3.0 - age_days)  # recency bonus, decays over ~3 days
        scored.append((score, p, u))

    scored.sort(key=lambda t: t[0], reverse=True)

    posts = []
    for _score, p, u in scored[:limit]:
        liked = saved = False
        if current:
            liked = bool(await db.likes.find_one({"post_id": p["post_id"], "user_id": current["user_id"]}))
            saved = bool(await db.saves.find_one({"post_id": p["post_id"], "user_id": current["user_id"]}))
        posts.append({**p, "user": public_user(u), "liked": liked, "saved": saved})
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
    if await is_blocked_between(current["user_id"], body.user_id):
        raise HTTPException(status_code=403, detail="You can't message this user")
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
    other_id = next((p for p in conv["participants"] if p != current["user_id"]), None)
    if other_id and await is_blocked_between(current["user_id"], other_id):
        raise HTTPException(status_code=403, detail="You can't message this user")
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
    is_prem = True  # all analytics are free
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
    """1RM trend, plateau detection, imbalance for one exercise (free)."""
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


@api.post("/users/me/seen-tour")
async def mark_tour_seen(current=Depends(get_current_user)):
    await db.users.update_one({"user_id": current["user_id"]}, {"$set": {"seen_welcome_tour": True}})
    return {"ok": True}


# ===== HEALTH =====
@api.get("/")
async def root():
    return {"app": "Athos", "version": "1.1"}


# ===== GOALS =====
@api.post("/users/goals")
async def set_goals(body: GoalsIn, current=Depends(get_current_user)):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.users.update_one({"user_id": current["user_id"]}, {"$set": update})
    u = await db.users.find_one({"user_id": current["user_id"]}, {"_id": 0})
    return {"user": public_user(u)}


app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
