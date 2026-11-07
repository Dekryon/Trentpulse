# TrentPulse: project context for Claude Code

Put this file in the repo root. Claude Code reads it automatically at the start of every session.

## What we are building

**TrentPulse** shows how busy each study and hangout spot on Trent University's Symons Campus (Peterborough, Ontario) is right now, and when it will be quiet. It needs no sensors. The score comes from three things:

1. **Crowd check-ins:** students tap a level from 1 (empty) to 5 (packed).
2. **A typical-week baseline:** history stored in Tiger Data.
3. **A "lecture just let out" boost:** from a hand-entered list of big classes.

The map is a satellite view of campus. Buildings are coloured green to red by busyness and rise in 3D.

**Event:** HackTrent 2026 (Devpost). **Deadline: Sunday Nov 8, 2026, 11:00 am Eastern.** Aim to submit by 10:30.

**Prizes we target:**
- Main ranking.
- MLH Best Use of Tiger Data (Stream Deck Mini): this is the main sponsor target.
- MLH Best Use of Gemini API.
- Optional: Vultr (deploy the API there), Auth0, GoDaddy domain.

**Judging criteria:** Innovation 25%, Technical Complexity 25%, Functionality and UX 20%, Impact 20%, Presentation 10%. Bonus for sponsor tech.

**Positioning:** Waitz/Occuspace and Density already do this at big schools using sensors. Trent has nothing. Our angle: "sensor-grade crowd data with zero hardware."

## Team

| Person | Role | Owns |
|---|---|---|
| Greg (me) | Front end lead | `web/`, demo video, Devpost write-up |
| Back end 1 | Data | Tiger Data service, `db/schema.sql`, `api/scripts/seed.ts`, benchmarks |
| Back end 2 | API | `api/src/`, score function, `lectures`, Gemini, deploy |

To avoid merge conflicts, each person mostly edits only their own folders.

## Repo layout

```
trentpulse/
├── CLAUDE.md
├── README.md                 setup steps (VS Code, GitHub, Tiger, deploy)
├── web/                      React 19 + Vite 8 + TypeScript + Tailwind v4 + MapLibre
│   ├── src/App.tsx           page state, polling, layout
│   ├── src/components/
│   │   ├── CampusMap.tsx     MapLibre: satellite, building fill, heat glow, 3D extrusion, labels
│   │   ├── BuildingPanel.tsx dark glass detail card (score bar, today vs typical chart, tip, check-in)
│   │   ├── TopTiles.tsx      number tiles across the top
│   │   ├── TimeBar.tsx       Live, time scrubber, day picker, Play day, 3D toggle
│   │   └── CheckInSheet.tsx  1 to 5 check-in bottom sheet
│   ├── src/lib/
│   │   ├── api.ts            calls the real API if VITE_API_URL is set, else the mock
│   │   ├── mockApi.ts        built-in fake back end, same response shapes
│   │   ├── spaces.ts         tracked places, OSM name regex, approx coords, CAMPUS_CENTER
│   │   ├── geo.ts            loads building outlines (public/buildings.json, then Overpass, then placeholder squares)
│   │   ├── colors.ts         heat colour scale + MapLibre expression
│   │   └── types.ts          shared types (copy also in api/src/types.ts)
│   ├── scripts/fetch-buildings.mjs   saves OSM outlines to public/buildings.json
│   └── src/main.tsx          sets MapLibre worker URL (required with Vite, see Gotchas)
├── api/                      Node + Fastify 5 + TypeScript (run with tsx) + pg + zod + @google/genai
│   ├── src/server.ts         all routes
│   ├── src/score.ts          busyness score + campus local time
│   ├── src/db.ts             pg Pool from DATABASE_URL
│   ├── scripts/apply-schema.ts   runs db/schema.sql one statement at a time
│   └── scripts/seed.ts       90 days x 9 spaces x 1/min ≈ 1.2M rows, refreshes aggregates, compresses
└── db/schema.sql             tables, hypertables, continuous aggregates, compression, seed spaces + EXAMPLE lectures
```

## Commands

```bash
# front end
cd web && npm install && npm run dev        # http://localhost:5173
npm run build                                # tsc -b && vite build
npm run fetch:buildings                      # real Trent outlines -> public/buildings.json

# api
cd api && npm install
cp .env.example .env                         # DATABASE_URL from Tiger, GEMINI_API_KEY optional
npm run db:schema                            # every line should print "ok"
npm run seed                                 # SEED_DAYS=30 for a faster first run
npm run dev                                  # http://localhost:3001
npm run typecheck
```

Environment variables:
- `web/.env.local`: `VITE_API_URL` (empty means mock data), `VITE_MAPTILER_KEY` (empty means free Esri imagery).
- `api/.env`: `DATABASE_URL` (keep `?sslmode=require`), `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash`; check it is still current), `PORT=3001`, `CORS_ORIGIN`.

## Tracked spaces

Space ids are used everywhere (DB, API, GeoJSON `properties.id`):

| id | name | bank | type |
|---|---|---|---|
| bata | Bata Library | west | study |
| sc | Student Centre | west | social |
| ath | Athletics Centre | west | gym |
| cc | Champlain College | west | college |
| lec | Lady Eaton College | west | college |
| sci | Science Complex | east | lecture |
| dna | DNA Building (Life & Health Sciences) | east | lecture |
| gz | Gzowski College | east | lecture |
| oc | Otonabee College | east | college |

Campus facts:
- The Otonabee River runs through the middle of campus. The Faryon Bridge joins the West Bank and the East Bank.
- Bata, Champlain, Lady Eaton, the Student Centre and the Athletics Centre are on the West Bank.
- The Science Complex, DNA, Gzowski, Otonabee and Wenjack Theatre are on the East Bank.
- Coordinates in `spaces.ts` and `schema.sql` are **approximate**. The real outlines come from OpenStreetMap.

## API contract (source of truth; change only with the whole team)

```
GET  /api/spaces                     -> Space[] (id, name, bank, type, lng, lat)
GET  /api/now                        -> NowResponse   (front end polls every 15 s)
GET  /api/forecast?at=<ISO>          -> NowResponse   (time scrubber)
POST /api/checkins  {space_id, level 1..5}  -> 201 {ok:true}
GET  /api/spaces/:id/history         -> { today: [{t, score}], typical: [{t, score}] }
GET  /api/suggest?near=<id>          -> { text }      (Gemini, rule-based fallback)
GET  /api/stats                      -> { rows_total, compression_ratio, score_query_ms }
GET  /health
```

```ts
NowResponse = { updated_at: string; events?: string[];
  spaces: { id; score: 0..100; level: 'quiet'|'moderate'|'busy'|'packed'; reports_20m: number; trend: 'up'|'down'|'flat' }[] }
```

Levels: 0 to 25 quiet, 26 to 50 moderate, 51 to 75 busy, 76 to 100 packed. Always show the word as well as the colour, for accessibility.

## Score

```
score = 0.5 * live + 0.3 * baseline + 0.2 * lecture_boost
```

- **live:** recency-weighted average of check-ins in the last 20 min. Level 1..5 maps to 0..100.
- **baseline:** average of `busyness_1h.avg_score` for the same ISO weekday and hour (America/Toronto), excluding the last day.
- **lecture_boost:** during a lecture, its own building gets `size/260*100`. For 25 min after a lecture ends, nearby non-lecture spaces get `size/260*100 * exp(-meters/450) * (1 - minutes/25)`. Capped at 100.
- **Fallback:** with fewer than 3 recent check-ins, `0.8 * baseline + 0.2 * boost`.
- All time maths uses campus local time (America/Toronto), not server UTC.

## Database (Tiger Data = TimescaleDB on Postgres)

- `spaces` (regular table) and `lectures` (regular table; ISO `dow` 1..7, `starts`, `ends`, `est_size`). The lectures in `schema.sql` are **EXAMPLES**. Replace them with about 30 real big sections typed in from the myTrent timetable. **Do not scrape myTrent:** room data sits behind the login.
- `checkins` hypertable (time, space_id, level, device).
- `samples` hypertable (time, space_id, score). This is the big seeded feed, compressed and segmented by `space_id`, with a compression policy after 7 days.
- `busyness_5m` continuous aggregate on checkins (real-time, refreshed every minute).
- `busyness_1h` continuous aggregate on samples (real-time, refreshed every 15 min).
- Show these features by name in the demo and the README: hypertables, continuous aggregates, compression ratio, 1M+ rows, query ms (`/api/stats`).
- Use the 30-day trial service, not the Free plan. The Free plan lacks some features.

## Front end design

The style is a satellite map with dark glass UI, taken from three Dribbble references: a FarmSense field heatmap, the Landtrack farming dashboard, and an analytics dashboard.

- **Base map:** a satellite raster. Esri World Imagery by default, MapTiler if a key is set. The attribution must stay visible.
- **Buildings:** a `fill` layer coloured by `score` (green #2f9e6a, amber #e0a526, red #d9472b). 3D mode switches to `fill-extrusion` with height `6 + score*0.9`, pitch 60 and bearing -25.
- **Heat glow:** a `heatmap` layer from building centroids, weighted by score (2D only).
- **Selected building:** a white dashed outline, in the Landtrack style.
- **Glass panels:** `.glass` in `index.css`, about 86% dark, so text stays readable over the photo.
- **Colours:** Trent green `#1d5c3f`, gold `#d9ac4f`. Fonts: Archivo (display) and IBM Plex Sans (body).
- **Overnight:** before 7:00 or after 23:00 the app opens on Tuesday 12:00 instead of live.
- **Mobile first:** the panel goes above the time bar on small screens, and the check-in sheet is a bottom sheet.

## Gotchas already solved

- **MapLibre v6 with Vite:** the worker file is not bundled automatically. `main.tsx` imports `maplibre-gl/dist/maplibre-gl-worker.mjs?url` and calls `setWorkerUrl(...)`. Without that you get "Worker failed to load".
- **TimescaleDB commands in one transaction:** some fail when run that way, so `apply-schema.ts` splits `schema.sql` on `;` + newline and runs each statement separately.
- **`npm create vite`** now installs TypeScript 7 and oxlint. Both are fine; the builds pass.

## Status (as of Sat Nov 7, 2 am)

- [x] Plan written (published artifact "TrentPulse Hackathon Plan").
- [x] `web/` builds and runs on mock data. Map, panel, tiles, scrubber, Play day, 3D toggle and check-in were all tested. Satellite tiles and Overpass were blocked in the build sandbox, so **check them on a real laptop**.
- [x] `api/` and the seed script type-check, but **have not been run against a real Tiger service yet**. Expect small SQL fixes when `npm run db:schema` runs.
- [ ] Run `npm run fetch:buildings` and fix any "Missing" name patterns in `spaces.ts` **and** `fetch-buildings.mjs`.
- [ ] Create the Tiger service, then run `db:schema` and `seed`.
- [ ] Point `web` at the API with `VITE_API_URL`.
- [ ] Enter the real lectures.
- [ ] Deploy: web to Vercel (root `web`), API to Vultr or Render (root `api`, `npm start`, set `CORS_ORIGIN`).
- [ ] Stretch: code-split MapLibre (the bundle is about 1.1 MB), Auth0 login, rate-limit check-ins by device.
- [ ] Devpost: description, features, 2 to 3 min video, public repo, tech docs, future scope, tick the prizes.

## Timeline (Sat Nov 7 to Sun Nov 8)

- **Sat 9:00:** kickoff, agree on the contract, repo, keys.
- **13:00, milestone 1:** the map shows real numbers from the deployed API.
- **18:00, milestone 2:** full loop. A phone check-in changes the map within 15 s.
- **23:00:** feature freeze, deploy, sleep.
- **Sun 7:00 to 8:30:** polish, README.
- **8:30 to 9:30:** record the demo.
- **9:30 to 10:30:** Devpost.

**Demo script (2:30):**
1. Hook: "Is Bata full?"
2. Show the heatmap.
3. Live phone check-in.
4. Scrub the day and watch a lecture let out.
5. 3D tilt.
6. Gemini tip.
7. Tiger stats (rows, compression).
8. Future: Registrar timetable feed, card-swipe counts.

## How to work with me (Greg)

- **No em dashes** in any text you write (UI copy, README, Devpost, comments).
- Give **complete, working code** (full files or full functions), not fragments, and explain what each part does and why in plain words.
- I'm the front end lead, so default to the `web/` folder unless I ask about the back end.
- Prefer small, safe changes that keep `npm run build` passing. Run the build after edits.
- Never commit `.env` files or keys.
