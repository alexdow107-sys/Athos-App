# Atho — Social Workout Tracking Platform

## Vision
Atho is a Hevy + Strava hybrid for serious lifters — workout tracking, progression analytics, and a social feed focused on training data (not lifestyle).

## Tech Stack
- **Frontend**: Expo (React Native) + Expo Router. File-based routing under `/app`.
- **Backend**: FastAPI + Motor (MongoDB). Single `server.py` + `seed_data.py`.
- **Auth**: Custom JWT email/password + Emergent-managed Google OAuth (both coexist in `users` collection).
- **Payments**: Stripe checkout for Atho Premium ($9.99/mo).
- **AI**: Emergent LLM key + Claude Sonnet 4.5 for coaching insights.

## Core Features (MVP)
1. **Auth**: Email/password signup + login, Google sign-in via Emergent, onboarding (units, height/weight, privacy).
2. **Exercise Database**: 170 seeded exercises across barbell/dumbbell/machine/cable/bodyweight/cardio + custom exercises.
3. **Workout Logger**: Active workout with persistent state, set logging (weight × reps), rest timer that survives navigation, unilateral toggle (L/R tracking), machine selector, exercise history shown during logging.
4. **PR Detection**: Auto-detect new estimated 1RM PRs (Epley formula) on workout finish.
5. **Calendar**: Month view of completed workouts.
6. **Social Feed**: Following + Explore tabs. Workout posts auto-create on finish. Like / comment / save.
7. **Profile**: Avatar, stats, follow/unfollow, followers list, follow requests for private accounts.
8. **Search & Discovery**: User search by username/display_name + suggestions.
9. **Notifications**: Likes, comments, follows, follow accepts, follow requests, saves.
10. **DMs**: Direct messaging (polled) between users.
11. **Settings**: Profile edit, unit prefs, privacy toggles, sign out.
12. **Analytics (Free)**: Weekly volume, muscle group distribution, top exercises, per-exercise 1RM chart with plateau/imbalance detection.
13. **Premium ($9.99/mo)**: AI coaching insights powered by Claude Sonnet 4.5 + Stripe checkout.

## Key Endpoints (backend)
- `POST /api/auth/register|login|google/session|logout`, `GET /api/auth/me`
- `POST /api/users/onboard`, `PATCH /api/users/me`
- `GET /api/users/{username}`, `GET /api/users/search/q`, `POST/DELETE /api/users/{id}/follow`
- `GET/POST /api/exercises`, `GET /api/exercises/{id}/history`
- `POST /api/workouts/start|{id}/finish`, `GET /api/workouts/active|{id}|user/{id}|user/{id}/calendar`
- `GET /api/feed|/feed/explore`, `POST/DELETE /api/posts/{id}/like|save`, `GET/POST /api/posts/{id}/comments`
- `GET /api/notifications`, `POST /api/notifications/read`, `GET /api/notifications/unread-count`
- `POST /api/conversations/start`, `GET /api/conversations`, `GET/POST /api/conversations/{id}/messages`
- `GET /api/analytics/overview|exercise/{id}`
- `POST /api/insights/generate`, `GET /api/insights/latest`
- `POST /api/subscription/checkout|cancel`, `GET /api/subscription/status|verify`

## Differentiators
- Machine-specific tracking (e.g. Hammer Strength vs Life Fitness press)
- Unilateral L/R tracking with imbalance detection
- AI coach insights (premium)
- Athlete-focused feed (no lifestyle content)

## Next Phases
- Workout copy / templates / programs
- Coach mode for premium users (sell programs)
- Phone/Apple sign-in
- Push notifications
- Voice/video messages
