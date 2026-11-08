# TrentPulse · Devpost submission draft

Paste each section into the matching Devpost field. Edit freely.

---

## Project name

TrentPulse

## Tagline (short description)

See how busy every study spot at Trent is right now, and when it'll be quiet. No sensors needed.

---

## Inspiration

Every Trent student knows the walk: you cross the Faryon Bridge to Bata Library, climb the stairs, and every seat is taken. Then you try the Student Centre. Then Champlain.

Bigger universities solve this with door sensors from companies like Waitz and Occuspace. Trent doesn't have them, and buying hardware for every building isn't realistic. We wanted the same answer, "is it busy right now?", built from things a campus already has: its students' phones, its own history and its class schedule.

## What it does

TrentPulse is a live map of Symons Campus. Nine study and hangout spaces on both banks of the Otonabee are coloured from green to red by how busy they are, with the level always written as a word too (Quiet, Moderate, Busy, Packed).

- **One-tap check-ins.** Students rate a space from 1 (empty) to 5 (packed). Everyone's map updates within 15 seconds.
- **Photo check-in.** Snap the room and Gemini suggests the level; the student confirms with one tap.
- **Ask TrentPulse.** Questions like "When will Bata be quieter?" are answered by Gemini from live scores and a four-hour forecast.
- **Time travel.** Drag the time bar or press Play day to watch a typical day, including the rush after a big lecture lets out.
- **3D view.** Tilt the map and busier buildings rise higher.
- **List view.** Every space, quietest first, fully usable with a keyboard or a screen reader.

When nobody has checked in, the map still works: it falls back on the typical pattern for that weekday and hour, so it's never blank.

## How we built it

**Tiger Data** sits at the centre. Check-ins and the history feed live in **hypertables**. Three **continuous aggregates** keep 5-minute, 15-minute and hourly rollups up to date on their own; the 15-minute one powers the baseline and forecast, fine enough to show the rush when classes let out. A **compression policy** shrinks anything older than a week: our 1,166,400 rows of history take 2.0 MB instead of 122.4 MB in the compressed chunks, 60× across the whole table. Scoring all nine spaces takes about 17 ms on the server. These numbers are live in the app's Tiger Data tile.

The **score** blends three signals: recent check-ins (each device's latest vote, newer ones weighted more), the typical score for this weekday and quarter hour, and a boost near big lectures that fades with distance and time. Live reports gain weight as they add up, so one person can nudge the map but can't flip it.

**Gemini** handles the parts that need understanding. Photo check-in uses its multimodal input to judge how full a room is. Ask TrentPulse gives it the live data and a forecast and asks it to answer in two sentences without inventing anything. To live within the free tier we chain five flash models, skip any that report their quota is used up, cache answers, and fall back to a plain data answer.

The **website** is React, Vite, TypeScript and Tailwind, with MapLibre drawing Esri satellite imagery and real building outlines from OpenStreetMap. The **API** is Fastify on Node. The website is hosted on Vercel and the API on Render.

**Privacy was a design rule, not an afterthought.** There are no accounts. Phones get an anonymous ID only for one-vote-per-building limits. "Use my location" runs entirely on the phone and never sends coordinates. Photos are never stored. The API refuses requests that don't come from our site.

## Challenges we ran into

- **Our first score ignored single check-ins.** With fewer than three reports it fell back to history, so a live check-in during a demo changed nothing. We replaced the cutoff with a weight that ramps up per report.
- **Gemini's free tier is about 20 requests per model per day,** and we used it up while testing. Ask, tips and photos now share a chain of five models with caching and quota-aware skipping. The model we started with had also been retired for new users, which we only found by reading the error.
- **Compressed data confused our row count.** After compression, Tiger's fast row estimate reported about 83,000 rows instead of 1.17 million until we refreshed the table statistics. The seed now does that automatically.
- **Our building positions were up to 600 m off.** We had guessed coordinates; computing centres from the real OpenStreetMap outlines fixed walking distances and nearby-spot suggestions.
- **Trusting check-ins without tracking people.** We can't prove where a phone is, so we made fake check-ins not matter instead: one vote per device, capped influence, and a baseline that anchors the score.
- **Making a map work on a phone.** The first mobile version hid the map behind its own panels. We rebuilt the layout so the map stays visible and every control is thumb-sized.

## Accomplishments that we're proud of

- A full loop that really works: a phone check-in at Bata moved its score from 22 to 46 on everyone's screen.
- Real time-series engineering on Tiger Data, with hypertables, continuous aggregates and compression all doing live work.
- Gemini used in two genuinely different ways, reading photos and reasoning over live data, both grounded in our numbers.
- Accessibility from the start: words beside colours, a full list view, keyboard and screen reader support.
- A privacy model we can explain in one sentence: we never know who you are or where you are.

## What we learned

- Time-series data wants time-series tools. Continuous aggregates turned what would have been slow queries over a million rows into instant lookups.
- Free AI tiers run out fast; design the fallback first.
- A good crowd-sourced score has to work with zero reports and stay calm with one bad one.
- Looking at the app on a real phone finds problems no test does.

## What's next for TrentPulse

- Trent's timetable feed from the Registrar, so every class counts automatically
- Wi-Fi or card-swipe counts from Trent IT as a second live signal, still with no new hardware
- QR codes at building entrances as proof of presence
- "Tell me when it's quiet" alerts
- Forecasts learned from real check-in history
- More spaces, the Durham GTA campus, and other schools

## A note on the data

The buildings, check-ins, scoring and Gemini answers are real. The 90 days of history are simulated by a minute-by-minute model of how students move: classes changing at :50, students flowing from lecture halls to nearby spaces, meal and gym peaks, quiet weekends and the term calendar. It gives the baseline realistic shape until real check-ins build up. The lecture schedule is a sample of 12 big sections, since real class sizes and rooms sit behind the student portal, which we didn't scrape.

---

## Built with (Devpost tags)

tiger-data, timescaledb, postgresql, gemini, google-ai-studio, react, typescript, vite, tailwindcss, maplibre, openstreetmap, node.js, fastify, zod, vercel, render

## Links

- Live app: https://trentpulse.vercel.app
- Code: https://github.com/Dekryon/Trentpulse
- Demo video: (add after recording)

## Prizes to tick

- Best Use of Tiger Data (MLH)
- Best Use of Gemini API (MLH)
- Accessibility Workshop Competition (if eligible)
- Main ranking (General)
