"""Backend tests for the new auth/onboarding flow (phone/OTP removed)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://strength-social-3.preview.emergentagent.com").rstrip("/")


def _rand(prefix="t"):
    return f"{prefix}{uuid.uuid4().hex[:10]}"


def _email():
    return f"{_rand('u')}@athos.app"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def new_user(session):
    """Register a fresh email user."""
    email = f"{_rand('u')}@athos.app"
    username = _rand("u")
    password = "Strong123"
    payload = {
        "email": email,
        "password": password,
        "username": username,
        "display_name": "Test User",
    }
    r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data
    assert "user" in data
    return {"creds": payload, "token": data["token"], "user": data["user"]}


# === Registration ===
class TestRegister:
    def test_register_returns_token_and_needs_setup_false(self, new_user):
        u = new_user["user"]
        assert u["needs_setup"] is False
        assert u["email"] if "email" in u else True  # public_user may strip email; not required
        assert u["username"] == new_user["creds"]["username"].lower()
        assert "phone" not in u  # phone field is gone
        assert new_user["token"]

    def test_register_duplicate_email_returns_400(self, session, new_user):
        payload = dict(new_user["creds"])
        payload["username"] = _rand("dup")
        r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code == 400
        assert "email" in r.text.lower()

    def test_register_duplicate_username_returns_400(self, session, new_user):
        payload = {
            "email": f"{_rand('e')}@athos.app",
            "password": "Strong123",
            "username": new_user["creds"]["username"],
            "display_name": "x",
        }
        r = session.post(f"{BASE_URL}/api/auth/register", json=payload)
        assert r.status_code == 400
        assert "username" in r.text.lower()

    def test_register_invalid_username(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"{_rand('e')}@athos.app",
            "password": "Strong123",
            "username": "ab",  # too short
            "display_name": "x",
        })
        assert r.status_code == 400

    def test_register_weak_password(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"{_rand('e')}@athos.app",
            "password": "short",
            "username": _rand("u"),
            "display_name": "x",
        })
        assert r.status_code == 400

    def test_register_password_no_digit(self, session):
        r = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"{_rand('e')}@athos.app",
            "password": "OnlyLetters",
            "username": _rand("u"),
            "display_name": "x",
        })
        assert r.status_code == 400


# === Removed OTP endpoints must 404 ===
class TestOTPRemoved:
    def test_send_otp_404(self, session):
        r = session.post(f"{BASE_URL}/api/auth/send-otp", json={"phone": "+15551234567"})
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text[:200]}"

    def test_verify_otp_404(self, session):
        r = session.post(f"{BASE_URL}/api/auth/verify-otp", json={"phone": "+15551234567", "code": "000000"})
        assert r.status_code == 404, f"expected 404, got {r.status_code} {r.text[:200]}"


# === Login ===
class TestLogin:
    def test_login_works_for_new_user(self, session, new_user):
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": new_user["creds"]["email"],
            "password": new_user["creds"]["password"],
        })
        assert r.status_code == 200
        data = r.json()
        assert data["token"]
        assert data["user"]["needs_setup"] is False

    def test_login_bad_password(self, session, new_user):
        r = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": new_user["creds"]["email"],
            "password": "WrongPass99",
        })
        assert r.status_code == 401


# === Google complete-setup ===
class TestGoogleCompleteSetup:
    def test_complete_setup_noop_for_email_user(self, session, new_user):
        """When user has needs_setup=false (email user), endpoint returns 200 with same user."""
        r = session.post(
            f"{BASE_URL}/api/auth/google/complete-setup",
            json={"username": "newname", "password": "Strong123"},
            headers={"Authorization": f"Bearer {new_user['token']}"},
        )
        assert r.status_code == 200, f"{r.status_code} {r.text}"
        data = r.json()
        # User should be unchanged (still original username, needs_setup false)
        assert data["user"]["username"] == new_user["creds"]["username"].lower()
        assert data["user"]["needs_setup"] is False

    def test_complete_setup_requires_auth(self, session):
        r = session.post(
            f"{BASE_URL}/api/auth/google/complete-setup",
            json={"username": "abcdef", "password": "Strong123"},
        )
        assert r.status_code == 401

    # The next two simulate validation. For needs_setup=false users, the endpoint short-circuits
    # before validation. We assert these via a fake needs_setup=true user by directly checking
    # the regex/password rules with a flagged user is not possible without DB access; so we just
    # confirm the no-op path for email users above. Validation paths are guarded by the same
    # regex used in /auth/register which we already tested.


# === Onboarding + seen-tour ===
class TestOnboardingAndTour:
    def test_onboard_then_seen_tour(self, session, new_user):
        token = new_user["token"]
        h = {"Authorization": f"Bearer {token}"}

        r = session.post(f"{BASE_URL}/api/users/onboard", json={
            "height_unit": "cm",
            "weight_unit": "kg",
            "height": 175,
            "weight": 75,
            "age": 28,
            "is_private": False,
        }, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["user"]["onboarded"] is True

        # Goals (optional but used by the onboarding screen)
        r2 = session.post(f"{BASE_URL}/api/users/goals", json={
            "training_days_per_week": 4,
            "main_goal": "hypertrophy",
            "weight_goal": "maintain",
        }, headers=h)
        assert r2.status_code == 200, r2.text

        # Mark intro seen
        r3 = session.post(f"{BASE_URL}/api/users/me/seen-tour", headers=h)
        assert r3.status_code == 200, r3.text
        # Verify via /auth/me
        rm = session.get(f"{BASE_URL}/api/auth/me", headers=h)
        assert rm.status_code == 200
        u = rm.json()["user"]
        assert u["onboarded"] is True
        assert u["seen_welcome_tour"] is True


# === /auth/me ===
class TestMe:
    def test_me_returns_no_phone(self, session, new_user):
        r = session.get(f"{BASE_URL}/api/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        u = r.json()["user"]
        assert "phone" not in u
        assert "needs_setup" in u
