# TrentPulse

See how busy every study and hangout spot on Trent's Symons Campus is right now, and when it will be quiet. It needs no sensors: crowd check-ins plus the class schedule, stored as time-series data in Tiger Data. Built for HackTrent 2026.

```
trentpulse/
├── web/     Front end (Greg)      React + Vite + TypeScript + Tailwind + MapLibre
├── api/     API (Back end 2)      Node + Fastify + TypeScript + Gemini
├── db/      Database (Back end 1) schema.sql for Tiger Data
└── .vscode/ Recommended VS Code extensions
```

---

## 1. Open it in VS Code

1. Unzip `trentpulse.zip` somewhere easy, like `Documents/trentpulse`.
2. In VS Code: **File → Open Folder…** and pick the `trentpulse` folder.
3. When VS Code asks to install the recommended extensions, click **Install**. Tailwind autocomplete is the important one.
4. Open the terminal with **View → Terminal** (or Ctrl + `).

You need **Node.js 20 or newer**. Check with `node -v`. If it's missing, install the LTS version from nodejs.org.

## 2. Run the front end (works right away, no back end needed)

```bash
cd web
npm install
npm run dev
```

Open the link it prints (usually http://localhost:5173). You get:

- The satellite map of Symons Campus. Esri imagery works with no key.
- Buildings coloured by busyness, a heat glow, and labels with live scores.
- The glass panel with a score bar, today vs typical chart, tip and check-in button.
- The top tiles, the time scrubber, **Play day**, a day picker and the **3D** toggle.
- The check-in sheet. Tap a level and the map changes.

While `VITE_API_URL` is empty, the app runs on **built-in demo data** (`web/src/lib/mockApi.ts`), so you can build every screen before the API exists.

### Get the real building outlines (do this once)

The app first looks for `web/public/buildings.json`, then asks OpenStreetMap live, then falls back to placeholder squares.

```bash
cd web
npm run fetch:buildings
```

This saves real outlines to `public/buildings.json`, so the demo never depends on a live map service. If it says a building is **Missing**, it prints every building name it found nearby. Adjust the name pattern for that building in `web/src/lib/spaces.ts` (the `match:` field) **and** in `web/scripts/fetch-buildings.mjs`, then run it again. Commit `buildings.json`.

### Optional: MapTiler satellite

Copy `web/.env.example` to `web/.env.local` and add a free key from maptiler.com:

```
VITE_MAPTILER_KEY=your_key
```

## 3. Put it on GitHub (so the team can share it)

**Easiest way, in VS Code:**

1. Click the **Source Control** icon on the left (the branch symbol).
2. Click **Publish to GitHub**. Sign in to GitHub when it asks.
3. Choose **Private** for now, or Public, since Devpost needs a public link at the end.
4. Make sure the `.env` files are **not** ticked. `.gitignore` already skips them, which keeps your keys secret.

**Teammates then:**

1. Go to the repo on github.com, click **Code → copy the URL**.
2. In VS Code: **Ctrl+Shift+P → "Git: Clone"**, paste the URL, then open the folder.
3. Add teammates on github.com under **Settings → Collaborators** so they can push.

**Daily flow:** pull before you start (**Source Control → ... → Pull**), commit small pieces with a clear message, then push (**Sync Changes**). To avoid stepping on each other, Greg works in `web/`, Back end 1 in `db/` and `api/scripts/`, and Back end 2 in `api/src/`.

## 4. Back end setup (Back end 1 and 2)

1. Create a free service on **Tiger Data** (tigerdata.com) and copy its connection string.
2. Set up the API:

```bash
cd api
npm install
cp .env.example .env        # then paste DATABASE_URL (and GEMINI_API_KEY if you have one)
npm run db:schema           # creates tables, hypertables, aggregates, compression
npm run seed                # 90 days of history, about 1.2M rows (a few minutes)
npm run dev                 # API on http://localhost:3001
```

3. Test it: open http://localhost:3001/api/now and http://localhost:3001/api/stats

4. Point the front end at it, in `web/.env.local`:

```
VITE_API_URL=http://localhost:3001
```

Restart `npm run dev` in `web/`. The "Demo data" badge disappears.

### API endpoints (plan section 08)

| Method | Path | What it does |
|---|---|---|
| GET | `/api/spaces` | List of tracked places |
| GET | `/api/now` | Live scores (the front end polls this every 15 s) |
| GET | `/api/forecast?at=ISO` | Scores for any time (time scrubber) |
| POST | `/api/checkins` | `{ "space_id": "bata", "level": 4 }` |
| GET | `/api/spaces/:id/history` | Today vs typical for the chart |
| GET | `/api/suggest?near=bata` | Gemini tip (rule-based if no key) |
| GET | `/api/stats` | Rows, compression ratio, query time for the pitch |

### Real lectures

`db/schema.sql` inserts **example** lectures. Replace them with about 30 of the biggest sections from the myTrent timetable (building, weekday, start, end, size). Don't scrape the portal; type them in.

## 5. Deploy

- **Front end:** vercel.com → New Project → import the repo → Root Directory `web` → add `VITE_API_URL` (your deployed API) → Deploy.
- **API:** Vultr (sponsor prize) or Render as a quick backup. Root `api`, start command `npm start`, and add the same `.env` values. Set `CORS_ORIGIN` to your Vercel URL.

## Where things live (front end)

| File | What it is |
|---|---|
| `web/src/App.tsx` | The page: state, polling, layout |
| `web/src/components/CampusMap.tsx` | MapLibre map: satellite, building fill, heat glow, 3D, labels |
| `web/src/components/BuildingPanel.tsx` | The glass detail card |
| `web/src/components/TopTiles.tsx` | Number tiles across the top |
| `web/src/components/TimeBar.tsx` | Live, scrubber, day, play, 3D |
| `web/src/components/CheckInSheet.tsx` | 1 to 5 check-in |
| `web/src/lib/api.ts` | Talks to the API, or the mock |
| `web/src/lib/mockApi.ts` | Demo data, same shapes as the API |
| `web/src/lib/spaces.ts` | The places we track and their OSM name patterns |
| `web/src/lib/geo.ts` | Loads building outlines, centroids, distances |
| `web/src/lib/types.ts` | Shared data shapes (copy also in `api/src/types.ts`) |

## Status

- Front end: builds and runs. Tested with demo data, including the check-in flow and the 3D toggle.
- API and seed: type-check cleanly but **have not been run against a real Tiger Data service yet**. Run `npm run db:schema` first and watch for any `FAIL` lines.
