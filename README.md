# KodaCare

A multimodal patient-partner health assistant built for HackFax / PatriotHacks 2026.

Patients log symptoms via voice and image, Gemini AI parses the data, and a linked "Partner" user can view insights.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.13, Flask, Flask-JWT-Extended |
| Database | MongoDB (PyMongo, hosted on Atlas) |
| AI | Google Gemini 2.5 Flash |
| Frontend | Expo / React Native (mobile app) |
| Auth | JWT tokens, bcrypt, security question reset |

---

## Setup

### Prerequisites

- **Python 3.13+** (`python3 --version`)
- **Node.js 18+** and **npm** (`node -v` / `npm -v`)
- **MongoDB** — local install or free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- **Expo Go** app on your phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) / [Android](https://play.google.com/store/apps/details?id=host.exp.exponent))
- A **Google Gemini API key** ([get one here](https://aistudio.google.com/apikey))

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd 2026-Hackfax-PatriotHacks
cp .env.example .env
```

Edit `.env` and fill in:

| Variable | What to put |
|----------|-------------|
| `MONGO_URI` | Your MongoDB connection string (Atlas or `mongodb://localhost:27017/kodacare`) |
| `JWT_SECRET` | Any long random string |
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `FLASK_DEBUG` | `True` for development |
| `GEMINI_MODEL` | `gemini-2.5-flash` |

### 2. Backend setup

```bash
python3 -m venv .venv
source .venv/bin/activate        # macOS/Linux
# .venv\Scripts\activate         # Windows
pip install -r requirements.txt
```

### 3. Mobile app setup

```bash
cd mobile
npm install
cd ..
```

### 4. Run it

You need **three terminals**:

**Terminal 1 — Backend (port 5001):**

```bash
source .venv/bin/activate
python3 run.py
```

Verify at `http://127.0.0.1:5001/api/health` — should return `{"status": "healthy"}`.

**Terminal 2 — Backend tunnel (so your phone can reach the API):**

```bash
npx localtunnel --port 5001
```

This prints a URL like `https://some-name.loca.lt`. Copy it — you'll need it in the next step.

**Terminal 3 — Expo (mobile app):**

Before starting, open `mobile/src/services/api.ts` and set `BASE` to the localtunnel URL from Terminal 2:

```typescript
const BASE = "https://some-name.loca.lt";
```

Then start Expo:

```bash
cd mobile
npx expo start --tunnel
```

Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS).

> **Important: Tunnel URL changes every restart!** If localtunnel dies or you restart it, it gives a new URL. You **must** update `mobile/src/services/api.ts` line 3 to match. Save the file and the app will hot-reload automatically. If you see "Network request failed" in the app, this is almost always the reason.

---

## Frontend Files — What Each Does

All frontend code lives in `mobile/`. It uses KodaCare branding.

### Screens (`src/screens/`)

Each screen is a self-contained React Native component with an inline `StyleSheet` at the bottom. **To change the appearance of any page, edit the `styles` object in that file.**

| File | What it shows | New Features |
|------|--------------|--------------|
| `LoginScreen.tsx` | Patient sign-in form. | Dark theme with KodaCare branding. |
| `RegisterScreen.tsx` | Patient registration. | Dark theme. |
| `ForgotPasswordScreen.tsx` | Password reset. | Dark theme. |
| `PartnerLoginScreen.tsx` | Partner code entry. | Large monospace input for 6-digit code. |
| `LogScreen.tsx` | Chat interface with Barnaby the Bear. | Patients type symptoms, Barnaby responds with structured health logging. |
| `RecordScreen.tsx` | Voice recording intro screen. | Shows options for Voice, Camera, or Text Log. |
| `CheckInScreen.tsx` | Image capture via `expo-image-picker`. | Send a photo of a symptom for Gemini to analyse. |
| `AccountScreen.tsx` | Profile header, settings. | Change password, generate partner link code, sign out. |
| `PartnerDashboardScreen.tsx` | Partner view. | Shows linked status & fetches real health logs. |
| `TextLogScreen.tsx` | Specialized text chat with Barnaby. | Includes **"Log It"** button to force a summary. |
| `VoiceLogScreen.tsx` | Specialized voice recording interface. | Includes **"Log It"** button to force a summary. |
| `CameraLogScreen.tsx` | Specialized camera/photo sending interface. | Includes **"Log It"** button to force a summary. |

### The "Log It" Button

The specialized log screens (`TextLogScreen`, `VoiceLogScreen`, `CameraLogScreen`) feature a **"Log It"** button in the header. Use this if Barnaby keeps asking follow-up questions. It forces the AI to summarize all conversation history context and log the condition immediately, instead of waiting for a natural conversation break.

---

## API Endpoints

| Method | Endpoint | Auth? | Description |
|--------|----------|-------|-------------|
| POST | `/api/process-aura` | Yes | Multimodal input (text/audio/image) → Gemini AI → structured health log + TTS audio. Supports `force_log=true` with `conversation_history` to summarize and log immediately. |
| GET | `/api/tts/<filename>` | No | Serve cached TTS audio (WAV) — URL returned in `process-aura` response |
| ... | ... | ... | (See other standard auth endpoints in `backend/app.py` or existing docs) |

---

## Troubleshooting

- **`ModuleNotFoundError: No module named 'backend'`** — run `python3 run.py` from the project root, not inside `backend/`.
- **MongoDB timeout** — check `MONGO_URI` in `.env`. If Atlas, whitelist your IP.
- **Network request failed on phone** — make sure localtunnel is running and the URL in `api.ts` matches.
- **Localtunnel interstitial page** — the `bypass-tunnel-reminder` header in `api.ts` handles this. If it still shows, visit the URL in a browser first and click through.
- **Port in use** — `lsof -ti:5001 | xargs kill -9`

---

Built for HackFax / PatriotHacks 2026.
