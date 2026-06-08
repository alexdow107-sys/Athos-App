# Athos — Social Workout Tracking Platform (v1.1)

## Vision
Athos is a Hevy + Strava hybrid for serious lifters — workout tracking, progression analytics, AI-powered training plans, and a social feed focused on training data (not lifestyle).

## What's new in v1.1
- **Rebranded Atho → Athos** (logo + brand text)
- **Strava-style intro carousel** (`/auth/intro`) shown after signup
- **Calendar DOB picker** in onboarding (was free-text)
- **Goals capture during onboarding**: training days/week, main goal (strength/hypertrophy/calisthenics/general), weight goal (lose/maintain/gain)
- **AI Coach Plan endpoint** `/api/coach/plan` — combines user-provided Athos coaching rules + Claude Sonnet 4.5 + recent workout notes
- **Premium gating** moved to strength data: `total_volume`, `weekly_volume`, `top_exercises`, exercise-level `/analytics/exercise/{id}` (1RM, plateau, imbalance)
- **Stronger password rules** (≥8 chars, letters + numbers) or Google sign-in
- **Always-visible workout settings**: unilateral L/R, machine selector, rest timer chips, notes — no more `...` menu
- **Auto-complete sets** when both weight + reps are entered (no manual checkmark required)
- **Live workout status** with `active_workout_started_at` so any profile/feed can show a real timer + activity type (lifting/cardio/sports/other)
- **Activity types** on workouts: lifting | cardio | sports | other
- **Live status visibility settings**: everyone | followers | close_friends + hide toggle
- **AI-aware of workout notes**: Premium coach plans now reference user's per-exercise notes (e.g. "form cue: hips before chest" → AI tailors future programming)

## Athos coaching rules (used by plan generator)
- 6×/wk PPL: 2-3 sets per muscle per workout, one rest day in week
- 6×/wk U/L: lower per-session volume (arms 1-2, back/chest 3, hams 3, quads 3, glutes/adductors 2 mix), rest Sundays
- 5×/wk: PPL → Rest → UL → Rest, repeat
- 4×/wk: UL Rest UL Rest Rest
- 3×/wk: U Rest L Rest Rest FullBody Rest
- 2×/wk: Full body twice with rests wherever
- Weight loss: keep lifting volume, add zone-2 cardio on rest days
- Weight gain: progressive overload + compound focus, 8-12 reps for hypertrophy

## Tech Stack
- Frontend: Expo (React Native) + Expo Router
- Backend: FastAPI + Motor (MongoDB), single `server.py`
- Auth: JWT email/password + Emergent Google OAuth
- Payments: Stripe (emergentintegrations wrapper) — $9.99 / 30-day premium pass
- AI: Emergent LLM key + Claude Sonnet 4.5 for insights & coach plans

## Key New Endpoints
- `POST /api/users/goals` — set training_days_per_week / main_goal / weight_goal / experience_level
- `POST /api/coach/plan` — generate 7-day plan from goals + (premium) AI enrichment with workout-notes context
- `GET /api/coach/plan` — last saved plan
- `POST /api/workouts/start` now accepts `activity_type` (lifting | cardio | sports | other)
- `GET /api/analytics/overview` — premium-gated (strength data null for free users with `premium_locked` array hint)
- `GET /api/analytics/exercise/{id}` — premium-only (402 otherwise)
- `PATCH /api/users/me` accepts `workout_status_audience` and `close_friends`

## Next Phases
- Mark which followers are "close friends" for the live-status audience
- Coach Mode (creators sell programs)
- Workout templates / programs / "copy workout from feed"
- Push notifications on deploy
- Phone/Apple sign-in
