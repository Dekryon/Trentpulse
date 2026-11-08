# TrentPulse

**How busy is every study and hangout spot on Trent University's Symons Campus right now, and when will it be quiet?**

Live: **https://trentpulse.vercel.app** · Built for HackTrent 2026

Big universities pay for door sensors (Waitz, Occuspace, Density) to answer this. Trent has nothing. TrentPulse answers it with zero hardware: students tap a one-second check-in, Tiger Data supplies the typical pattern for every weekday and hour, and a class schedule flags the rush after a big lecture. The result is a satellite map of campus where buildings glow from green to red and rise in 3D.

---

## What you can do

- **See the whole campus at a glance.** Nine spaces on both banks of the Otonabee, coloured by busyness, with the level written as a word (Quiet, Moderate, Busy, Packed), never colour alone.
- **Check in with one tap.** Pick 1 (empty) to 5 (packed). The map updates for everyone within 15 seconds.
- **Check in from a photo.** Snap the room and Gemini suggests the level; you confirm with one tap.
- **Ask a question.** "When will Bata be quieter?" Gemini answers from the live scores and the next four hours of the forecast.
- **Scrub through the day.** Drag the time bar or press Play day to watch a typical day unfold, including the crowd after a lecture lets out.
- **Tilt into 3D.** Busier buildings rise higher.
- **Use it without the map.** The List view shows every space, quietest first, and works fully with a keyboard and a screen reader.

## How the score works

Every space gets a score from 0 to 100, recalculated on each request:

```
live weight = 0.5 × min(check-ins in the last 20 min, 3) ÷ 3
score       = live weight × live + (0.8 − live weight) × baseline + 0.2 × lecture boost
```

- **live**: the average of recent check-ins, newer ones weighted more. Only each device's latest vote counts.
- **baseline**: the typical score for this weekday and hour, read from a Tiger Data continuous aggregate.
- **lecture boost**: while a big class is in session its building gets a boost; for 25 minutes after it ends, nearby spaces get one that fades with distance and time.

One check-in already moves the map a little; three or more give live reports their full weight. With no check-ins the score rests on the baseline, so the map is never blank.

Levels: 0 to 25 Quiet, 26 to 50 Moderate, 51 to 75 Busy, 76 to 100 Packed. All time maths uses campus time (America/Toronto).

## Built on Tiger Data

Tiger Data (TimescaleDB on Postgres) is the core of the project, not just storage. Every feature below is used by the live app.

| Feature | Where | What it does for us |
|---|---|---|
| **Hypertables** | `checkins`, `samples` | Time-partitioned tables for every check-in and for the history feed |
| **Continuous aggregate** `busyness_5m` | over `checkins` | 5-minute rollups, refreshed every minute, real-time |
| **Continuous aggregate** `busyness_1h` | over `samples` | Hourly rollups that power the baseline, the forecast and the charts |
| **Compression** | `samples`, segmented by `space_id` | Chunks older than 7 days are compressed automatically |
| **Plain SQL** | everywhere | `time_bucket`, `DISTINCT ON`, window filters; nothing exotic |

Current numbers, shown live in the app's Tiger Data tile and at `/api/stats`:

- **1,166,400 rows** of history (90 days × 9 spaces × one per minute)
- **122.8 MB → 2.0 MB** for the compressed chunks, **60.4×** across the whole table
- **about 40 ms** to score all nine spaces (live check-ins, baseline and lecture boost together)

The schema is in [`db/schema.sql`](db/schema.sql).

## Built with Gemini

Gemini does three jobs, all grounded in live Tiger Data rather than general knowledge:

1. **Photo check-in (multimodal).** A downscaled room photo goes to Gemini, which rates how full the room is on our 1 to 5 scale with a short reason. It returns no level for photos it can't judge, and it is told never to describe people. The photo is never stored by TrentPulse.
2. **Ask TrentPulse.** Free-text questions are answered from the current scores, trends, check-in counts and a four-hour forecast. Off-topic questions are politely declined.
3. **Tips** in each building's panel, such as suggesting a quieter spot nearby.

The free tier allows only about 20 requests per model per day, so the API chains five flash models, skips any model that reports its quota is used up, caches tips (15 min) and answers (5 min), and falls back to a plain answer from the data if Gemini is unavailable.

## How it fits together

```
Phone or laptop ──page──▶ Vercel (website + building outlines)
       │
       ├──tiles──▶ Esri World Imagery
       │
       └──JSON──▶ Render (Fastify API) ──SQL──▶ Tiger Data
                                        └─────▶ Gemini
```

| Part | Tech | Why |
|---|---|---|
| Website | React 19, Vite 8, TypeScript, Tailwind CSS v4 | Fast to build, one language with the API |
| Map | MapLibre GL via react-map-gl, Esri satellite tiles | Free, no account; 2D heat map and 3D in one library |
| Building shapes | OpenStreetMap, saved to `web/public/buildings.json` | Real outlines with no live map call during a demo |
| Live data | TanStack Query (15 s polling), Recharts | The map stays live; today vs typical chart |
| API | Node, Fastify 5, zod, pg, @google/genai | Light and quick; validates every request |
| Database | Tiger Data | Time-series tables, rollups and compression |
| Hosting | Vercel (website), Render (API, `render.yaml`) | Free tiers, quick deploys |

## Privacy and trust

- **No accounts and no personal data.** Each phone gets a random anonymous ID, used only so it gets one vote per building per 15 minutes. IP addresses are not stored.
- **Location stays on the phone.** "Use my location" picks the nearest building in the browser and warns if you are clearly off campus. Coordinates are never sent.
- **Photos are not stored.** A photo exists only for the request that sends it to Gemini.
- **Fake check-ins can't flip the map.** Repeated taps from one device count once, live reports cap at half of the score, and the baseline anchors the rest.
- **The API only serves our website.** Requests from other origins get a 403, and check-ins, questions and photos have per-network limits.

## Accessibility

- Busyness is always written as a word next to the colour.
- The List view gives every space with its level, score and recent check-ins, and each row has a full spoken label.
- Touch targets are at least 44 px on phones, every control has a visible focus ring, panels close with Escape and a close button, and animation respects reduced-motion settings.

## Run it locally

You need Node.js 20 or newer.

**Website only, on built-in demo data (no keys needed):**

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

**With the real API:**

1. Create a Tiger Data service (the trial, not the free plan, which lacks some features) and copy its connection string.
2. Set up the API:

```bash
cd api
npm install
cp .env.example .env   # paste DATABASE_URL, and GEMINI_API_KEY from Google AI Studio
npm run db:schema      # tables, hypertables, aggregates, compression; every line prints "ok"
npm run seed           # 90 days of history (SEED_DAYS=30 for a quicker run)
npm run dev            # http://localhost:3001
```

3. Point the website at it: create `web/.env.local` with `VITE_API_URL=http://localhost:3001`, then restart `npm run dev` in `web/`.

To refresh the building outlines from OpenStreetMap: `cd web && npm run fetch:buildings`.

## Deploy

- **API on Render:** New → Blueprint → this repo. `render.yaml` sets everything except the secrets; Render asks for `DATABASE_URL` and `GEMINI_API_KEY`. Set `CORS_ORIGIN` to the website's address.
- **Website on Vercel:** root directory `web`, environment variable `VITE_API_URL` set to the API's address.

## API

All `/api` routes accept requests only from the allowed website origins.

| Method | Path | What it returns |
|---|---|---|
| GET | `/api/spaces` | The tracked spaces |
| GET | `/api/now` | Live scores, levels, trends, check-in counts, events |
| GET | `/api/forecast?at=ISO` | The same, for any time (time bar) |
| GET | `/api/spaces/:id/history` | Today vs a typical day, hourly |
| POST | `/api/checkins` | `{ space_id, level 1..5, device }` |
| POST | `/api/photo-estimate` | `{ image (base64), mimeType }` → suggested level and reason |
| POST | `/api/ask` | `{ question }` → answer from live data |
| GET | `/api/suggest?near=id` | A short tip for one space |
| GET | `/api/stats` | Row count, compression ratio, score query time |
| GET | `/health` | Liveness check (open) |

## Project layout

```
web/   website: React, MapLibre, Tailwind
api/   Fastify API, score function, Gemini, seed and schema scripts
db/    schema.sql for Tiger Data
```

## What is real and what is simulated

- **Real:** the buildings and their outlines, every check-in, the scoring, the Tiger Data features and numbers, and the Gemini answers.
- **Simulated:** the 90 days of history come from a seed script with hand-shaped daily curves per type of space (library, gym, college and so on). They give the baseline something to work with until real check-ins build up.
- **Sample:** the lecture schedule is a sample of 12 big sections. Real class sizes and rooms sit behind the student portal, which we did not scrape.

## What's next

- Trent's timetable feed from the Registrar, so every class counts automatically
- Wi-Fi or card-swipe counts from Trent IT as a second live signal, still with no new hardware
- QR codes at building entrances as proof of presence for check-ins
- "Tell me when it's quiet" alerts for a chosen space
- Forecasts learned from real check-in history instead of hand-shaped curves
- More spaces, the Durham GTA campus, and other schools

## Team

Built at HackTrent 2026 by Gregory Uku.
