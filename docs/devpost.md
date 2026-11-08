# TrentPulse · Devpost submission draft

Paste each section into the matching Devpost field. Edit freely.

---

## Project name

TrentPulse

## Tagline (short description)

See how busy Trent's dining halls, cafés and study spots are right now, and when they'll be quiet. No sensors needed.

---

## Inspiration

You've got an hour before your next class, so you walk to the Champlain dining hall and the line is out the door. The Starbucks in the Student Centre isn't any better. By the time you find somewhere to eat, half the break is gone. The same thing happens at Bata when every seat upstairs is taken.

Bigger schools answer "is it busy?" with door sensors from companies like Waitz and Occuspace. Trent doesn't have any, and putting hardware in every building wasn't something we could do in a weekend. So we tried to get close to the same answer using students' phones and the campus's own patterns.

## What it does

TrentPulse is a map of Symons Campus coloured from green to red by how busy each place is. It covers the dining halls at Champlain, Lady Eaton and Otonabee, the Starbucks in the Student Centre, the Tim Hortons in Otonabee, Bata Library, the Athletics Centre and the main lecture buildings. Each one also shows its level in words, so nobody has to rely on colour alone, and the food inside each building is listed in its panel.

When you're in a space you can rate it from 1 (empty) to 5 (packed), and everyone's map picks it up within 15 seconds. If you'd rather not judge it yourself, take a photo and Gemini suggests a level for you to confirm. There's also an Ask box where you can type something like "Which dining hall is quietest for lunch?" and get an answer based on the current scores and the next four hours of forecast.

The time bar lets you scrub through a typical day. Tuesday at 10:50 is a good one to watch: the lecture halls empty out and the Student Centre fills up within a few minutes, then the dining halls peak around lunch. You can tilt the map into 3D, where busier buildings stand taller, or switch to a list view that works with a keyboard and screen reader.

If nobody has checked in recently, the map falls back on what that weekday and time usually looks like, so it's never empty.

## How we built it

Tiger Data does most of the heavy lifting. Check-ins and the history feed are hypertables, and on top of them we run continuous aggregates at 5 minutes, 15 minutes and an hour. The 15-minute one is what makes the class-change rush visible; hourly averages smoothed it out completely. A compression policy handles older history, and our 1,166,400 rows shrink from 122.4 MB to 2.0 MB in the compressed chunks, about 60× across the table. Scoring every space takes around 17 ms on the server, and the app shows these numbers live in its Tiger Data tile.

The score mixes recent check-ins with the usual level for that weekday and quarter hour, plus a boost for spaces near a big lecture that just ended. One check-in moves the score a little. It takes three before live reports get their full weight, which stops a single bad report from turning a building red.

Gemini handles photo check-ins and the Ask box. For questions we send it the live scores, the forecast and which food is in which building, and tell it to answer only from that data. That's what lets it answer "where should I eat?" as well as "where should I study?". The free tier ran out on us during testing, so the API now tries five flash models in order, skips any that say they're out of quota, caches answers, and falls back to a plain answer built from the data if none of them respond.

The front end is React with TypeScript, Vite and Tailwind. MapLibre draws Esri satellite imagery and building outlines from OpenStreetMap. The API is Fastify on Node, hosted on Render, and the site is on Vercel.

There are no accounts. Each phone gets a random ID so it can only vote once per building every 15 minutes. "Use my location" works out the nearest building on the phone itself, and coordinates never reach our server. Photos aren't stored, and the API only answers requests coming from our own site.

## Challenges we ran into

Our first version of the score ignored check-ins until a space had three of them. We found out when we checked in at Bata during a test and nothing changed. Replacing the cutoff with a weight that grows with each report fixed it.

Gemini's free tier allows about 20 requests per model per day, and we burned through it while testing. The model we started with had also been retired for new accounts, which we only worked out from the error message. That's where the five-model fallback came from.

After compressing the history, Tiger's quick row estimate said we had about 83,000 rows instead of 1.17 million. Running ANALYZE fixed it, and the seed script does that automatically now.

Our building coordinates started as guesses, and some were 600 m off. We recalculated them from the real OpenStreetMap outlines, which also corrected the walking distances behind the lecture boost.

On phones, the first layout covered most of the map with panels. We rebuilt it so the map stays visible.

## Accomplishments that we're proud of

Checking in from a phone at Bata and watching its score go from 22 to 46 on another screen. That was when it started to feel like a real product.

We're also glad the Tiger Data features are doing actual work in the app instead of sitting on a slide, and that photo check-in ended up fast enough to use, at about a second.

## What we learned

Continuous aggregates were the biggest lesson: queries over a million rows became quick lookups. We also learned to build the fallback for a free AI tier before depending on it, and that a crowd-sourced score has to behave sensibly with zero reports long before it has many.

## What's next for TrentPulse

For food, the next step is tracking each café and dining line on its own instead of scoring the whole building; Trent Food Services' till counts would make that accurate. The other obvious step is Trent's real timetable, so every class feeds the lecture boost instead of our sample of 12. Wi-Fi connection counts from Trent IT would add a second live signal without any new hardware. Further out we'd like QR codes at entrances to confirm check-ins, alerts when a space gets quiet, and forecasts trained on real check-ins once there are enough of them.

## A note on the data

The buildings, check-ins, scoring and Gemini answers are real. The 90 days of history are simulated by a minute-by-minute model of how students move: classes end at :50, people walk from lecture halls to the nearest spaces, dining halls peak at meal times, the gym has its own hours, and weekends are quiet. It gives the baseline a realistic shape until real check-ins build up. The lecture schedule is a sample of 12 big sections, because real class sizes and rooms sit behind the student portal.

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
