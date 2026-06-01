"""Atho backend E2E API tests against the live preview URL.

Covers: auth, onboarding, profile, exercises, workouts, feed/posts,
notifications, conversations, analytics, insights, subscription.
"""
import os
import time
import uuid
import requests
import pytest
from pymongo import MongoClient

BASE = "https://strength-social-3.preview.emergentagent.com/api"

UNIQ = uuid.uuid4().hex[:8]
USER_A = {
    "email": f"test_a_{UNIQ}@atho.app",
    "password": "testpass123",
    "username": f"testa{UNIQ}",
    "display_name": "Tester A",
}
USER_B = {
    "email": f"test_b_{UNIQ}@atho.app",
    "password": "testpass123",
    "username": f"testb{UNIQ}",
    "display_name": "Tester B",
}

state = {}


def _h(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- Auth ----------
def test_01_register_user_a():
    r = requests.post(f"{BASE}/auth/register", json=USER_A, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["username"] == USER_A["username"].lower()
    assert data["user"]["onboarded"] is False
    state["token_a"] = data["token"]
    state["user_a"] = data["user"]


def test_02_register_user_b():
    r = requests.post(f"{BASE}/auth/register", json=USER_B, timeout=30)
    assert r.status_code == 200, r.text
    state["token_b"] = r.json()["token"]
    state["user_b"] = r.json()["user"]


def test_03_login():
    r = requests.post(f"{BASE}/auth/login", json={"email": USER_A["email"], "password": USER_A["password"]})
    assert r.status_code == 200, r.text
    assert "token" in r.json()


def test_04_login_bad_password():
    r = requests.post(f"{BASE}/auth/login", json={"email": USER_A["email"], "password": "wrong"})
    assert r.status_code == 401


def test_05_get_me():
    r = requests.get(f"{BASE}/auth/me", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["user"]["username"] == USER_A["username"].lower()


def test_06_get_me_no_token():
    r = requests.get(f"{BASE}/auth/me")
    assert r.status_code == 401


def test_07_google_session_bad():
    r = requests.post(f"{BASE}/auth/google/session", json={"session_id": "invalid_session_xyz"})
    assert r.status_code == 401


# ---------- Onboarding / Profile ----------
def test_10_onboard():
    body = {"height_unit": "cm", "weight_unit": "kg", "height": 180, "weight": 80, "is_private": False, "age": 30}
    r = requests.post(f"{BASE}/users/onboard", json=body, headers=_h(state["token_a"]))
    assert r.status_code == 200, r.text
    assert r.json()["user"]["onboarded"] is True
    assert r.json()["user"]["height"] == 180


def test_11_patch_me():
    r = requests.patch(f"{BASE}/users/me", json={"bio": "I lift", "display_name": "Tester A2"}, headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["user"]["bio"] == "I lift"
    assert r.json()["user"]["display_name"] == "Tester A2"


# ---------- Exercises ----------
def test_20_list_barbell_exercises():
    r = requests.get(f"{BASE}/exercises?category=barbell", headers=_h(state["token_a"]))
    assert r.status_code == 200
    items = r.json()["exercises"]
    assert len(items) >= 20, f"Expected ~35 barbell, got {len(items)}"
    assert all(e["category"] == "barbell" for e in items)


def test_21_search_bench():
    r = requests.get(f"{BASE}/exercises?q=bench", headers=_h(state["token_a"]))
    assert r.status_code == 200
    items = r.json()["exercises"]
    assert len(items) >= 1
    assert any("bench" in e["name"].lower() for e in items)
    # Pick a bench-press exercise for workout test
    bp = next((e for e in items if "bench press" in e["name"].lower()), items[0])
    state["bench_ex"] = bp


def test_22_create_custom_exercise():
    r = requests.post(f"{BASE}/exercises", json={
        "name": f"Custom Ex {UNIQ}",
        "category": "machine",
        "muscle_group": "chest",
        "is_unilateral": False,
    }, headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["exercise"]["name"].startswith("Custom Ex")


# ---------- Workouts ----------
def test_30_start_workout():
    r = requests.post(f"{BASE}/workouts/start", json={"name": "Push Day"}, headers=_h(state["token_a"]))
    assert r.status_code == 200
    w = r.json()["workout"]
    assert w["status"] == "active"
    state["workout_id"] = w["workout_id"]


def test_31_active_workout():
    r = requests.get(f"{BASE}/workouts/active", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["workout"]["workout_id"] == state["workout_id"]


def test_32_finish_workout_with_pr():
    bp = state["bench_ex"]
    body = {
        "name": "Push Day",
        "duration_seconds": 1800,
        "exercises": [{
            "exercise_id": bp["exercise_id"],
            "exercise_name": bp["name"],
            "is_unilateral": False,
            "sets": [
                {"weight": 60, "reps": 10, "completed": True},
                {"weight": 80, "reps": 5, "completed": True},
                {"weight": 100, "reps": 1, "completed": True},
            ],
            "rest_seconds": 90,
        }],
    }
    r = requests.post(f"{BASE}/workouts/{state['workout_id']}/finish", json=body, headers=_h(state["token_a"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["workout"]["status"] == "completed"
    # total volume = 600 + 400 + 100 = 1100
    assert data["workout"]["total_volume"] == 1100
    # PR detected (first workout, so any 1RM should be PR)
    assert len(data["prs"]) >= 1
    state["finished_workout_id"] = state["workout_id"]


def test_33_workouts_count_incremented():
    r = requests.get(f"{BASE}/auth/me", headers=_h(state["token_a"]))
    assert r.json()["user"]["workouts_count"] == 1
    assert r.json()["user"]["currently_working_out"] is False


def test_34_exercise_history():
    r = requests.get(f"{BASE}/exercises/{state['bench_ex']['exercise_id']}/history", headers=_h(state["token_a"]))
    assert r.status_code == 200
    data = r.json()
    assert data["session_count"] >= 1
    assert data["personal_record"] is not None
    assert data["lifetime_volume"] == 1100


def test_35_user_workouts_list():
    r = requests.get(f"{BASE}/workouts/user/{state['user_a']['user_id']}", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert len(r.json()["workouts"]) >= 1


def test_36_calendar():
    from datetime import datetime
    now = datetime.utcnow()
    r = requests.get(f"{BASE}/workouts/user/{state['user_a']['user_id']}/calendar?year={now.year}&month={now.month}", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert isinstance(r.json()["workouts_by_date"], dict)
    assert len(r.json()["workouts_by_date"]) >= 1


# ---------- Feed / Posts ----------
def test_40_feed():
    r = requests.get(f"{BASE}/feed", headers=_h(state["token_a"]))
    assert r.status_code == 200
    posts = r.json()["posts"]
    assert len(posts) >= 1
    state["post_id"] = posts[0]["post_id"]


def test_41_explore():
    r = requests.get(f"{BASE}/feed/explore", headers=_h(state["token_b"]))
    assert r.status_code == 200
    # User A is public, should appear
    posts = r.json()["posts"]
    assert any(p["post_id"] == state["post_id"] for p in posts)


def test_42_like_unlike():
    r = requests.post(f"{BASE}/posts/{state['post_id']}/like", headers=_h(state["token_b"]))
    assert r.status_code == 200 and r.json()["liked"] is True
    r = requests.delete(f"{BASE}/posts/{state['post_id']}/like", headers=_h(state["token_b"]))
    assert r.status_code == 200 and r.json()["liked"] is False


def test_43_save_unsave():
    r = requests.post(f"{BASE}/posts/{state['post_id']}/save", headers=_h(state["token_b"]))
    assert r.status_code == 200 and r.json()["saved"] is True
    r = requests.delete(f"{BASE}/posts/{state['post_id']}/save", headers=_h(state["token_b"]))
    assert r.status_code == 200 and r.json()["saved"] is False


def test_44_comments():
    r = requests.post(f"{BASE}/posts/{state['post_id']}/comments", json={"text": "Nice lift!"}, headers=_h(state["token_b"]))
    assert r.status_code == 200
    r = requests.get(f"{BASE}/posts/{state['post_id']}/comments")
    assert r.status_code == 200
    assert any(c["text"] == "Nice lift!" for c in r.json()["comments"])


# ---------- Users / Follow ----------
def test_50_search_users():
    r = requests.get(f"{BASE}/users/search/q?q={USER_A['username'][:5]}", headers=_h(state["token_b"]))
    assert r.status_code == 200
    users = r.json()["users"]
    assert any(u["user_id"] == state["user_a"]["user_id"] for u in users)


def test_51_follow_public():
    r = requests.post(f"{BASE}/users/{state['user_a']['user_id']}/follow", headers=_h(state["token_b"]))
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"


def test_52_private_follow_pending():
    # Make user B private
    requests.patch(f"{BASE}/users/me", json={"is_private": True}, headers=_h(state["token_b"]))
    r = requests.post(f"{BASE}/users/{state['user_b']['user_id']}/follow", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["status"] == "pending"
    # Reset
    requests.patch(f"{BASE}/users/me", json={"is_private": False}, headers=_h(state["token_b"]))


# ---------- Notifications ----------
def test_60_notifications_and_unread():
    r = requests.get(f"{BASE}/notifications", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert len(r.json()["notifications"]) >= 1
    r = requests.get(f"{BASE}/notifications/unread-count", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["count"] >= 1
    r = requests.post(f"{BASE}/notifications/read", headers=_h(state["token_a"]))
    assert r.status_code == 200
    r = requests.get(f"{BASE}/notifications/unread-count", headers=_h(state["token_a"]))
    assert r.json()["count"] == 0


# ---------- Conversations ----------
def test_70_conversations_and_messages():
    r = requests.post(f"{BASE}/conversations/start", json={"user_id": state["user_b"]["user_id"]}, headers=_h(state["token_a"]))
    assert r.status_code == 200
    cid = r.json()["conversation_id"]
    state["conv_id"] = cid
    r = requests.post(f"{BASE}/conversations/{cid}/messages", json={"text": "Yo!"}, headers=_h(state["token_a"]))
    assert r.status_code == 200
    r = requests.get(f"{BASE}/conversations/{cid}/messages", headers=_h(state["token_b"]))
    assert r.status_code == 200
    assert any(m["text"] == "Yo!" for m in r.json()["messages"])
    r = requests.get(f"{BASE}/conversations", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert any(c["conversation_id"] == cid for c in r.json()["conversations"])


# ---------- Analytics ----------
def test_80_analytics_overview():
    r = requests.get(f"{BASE}/analytics/overview", headers=_h(state["token_a"]))
    assert r.status_code == 200
    data = r.json()
    assert data["total_workouts"] >= 1
    assert "weekly_volume" in data
    assert "muscle_volume" in data
    assert "top_exercises" in data


def test_81_analytics_exercise():
    r = requests.get(f"{BASE}/analytics/exercise/{state['bench_ex']['exercise_id']}", headers=_h(state["token_a"]))
    assert r.status_code == 200
    data = r.json()
    assert "points" in data
    assert "plateau_sessions" in data
    assert "imbalance_pct" in data


# ---------- Insights / Premium ----------
def test_90_insights_402_non_premium():
    r = requests.post(f"{BASE}/insights/generate", headers=_h(state["token_a"]))
    assert r.status_code == 402


def test_91_subscription_status_inactive():
    r = requests.get(f"{BASE}/subscription/status", headers=_h(state["token_a"]))
    assert r.status_code == 200
    assert r.json()["is_premium"] is False


def test_92_premium_flip_and_insights():
    # Direct DB flip
    mongo = MongoClient("mongodb://localhost:27017")
    db = mongo["atho_db"]
    db.users.update_one({"user_id": state["user_a"]["user_id"]}, {"$set": {"is_premium": True}})
    r = requests.get(f"{BASE}/subscription/status", headers=_h(state["token_a"]))
    assert r.json()["is_premium"] is True
    # Generate insights (may use LLM - allow generous timeout)
    r = requests.post(f"{BASE}/insights/generate", headers=_h(state["token_a"]), timeout=60)
    assert r.status_code == 200, r.text
    assert "insights" in r.json()
    assert isinstance(r.json()["insights"], list)
    assert len(r.json()["insights"]) >= 1


def test_93_subscription_checkout():
    r = requests.post(f"{BASE}/subscription/checkout", headers=_h(state["token_a"]), timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "checkout_url" in data
    assert data["checkout_url"].startswith("https://")


def test_94_subscription_cancel():
    r = requests.post(f"{BASE}/subscription/cancel", headers=_h(state["token_a"]))
    assert r.status_code == 200
    r = requests.get(f"{BASE}/subscription/status", headers=_h(state["token_a"]))
    assert r.json()["is_premium"] is False
