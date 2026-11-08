-- TrentPulse database (Tiger Data / TimescaleDB)
-- Apply with: cd api && npm run db:schema   (or paste into the Tiger SQL editor)

CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Spaces we track (regular table). lng/lat: rough centre, used for walking distance.
CREATE TABLE IF NOT EXISTS spaces (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  bank  TEXT NOT NULL CHECK (bank IN ('west', 'east')),
  type  TEXT NOT NULL CHECK (type IN ('study', 'social', 'gym', 'college', 'lecture')),
  lng   DOUBLE PRECISION NOT NULL,
  lat   DOUBLE PRECISION NOT NULL
);

-- Crowd check-ins from students' phones (time-series)
CREATE TABLE IF NOT EXISTS checkins (
  time      TIMESTAMPTZ NOT NULL DEFAULT now(),
  space_id  TEXT NOT NULL REFERENCES spaces(id),
  level     SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 5),
  device    TEXT
);
SELECT create_hypertable('checkins', 'time', if_not_exists => TRUE);

-- Occupancy feed from the seed script: the big table (1M+ rows)
CREATE TABLE IF NOT EXISTS samples (
  time      TIMESTAMPTZ NOT NULL,
  space_id  TEXT NOT NULL REFERENCES spaces(id),
  score     SMALLINT NOT NULL CHECK (score BETWEEN 0 AND 100)
);
SELECT create_hypertable('samples', 'time', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS samples_space_time ON samples (space_id, time DESC);

-- Big lectures, hand-entered from the timetable (example rows below)
CREATE TABLE IF NOT EXISTS lectures (
  id        SERIAL PRIMARY KEY,
  space_id  TEXT NOT NULL REFERENCES spaces(id),
  dow       SMALLINT NOT NULL CHECK (dow BETWEEN 1 AND 7),  -- ISO: 1 Mon .. 7 Sun
  starts    TIME NOT NULL,
  ends      TIME NOT NULL,
  est_size  INT NOT NULL
);

-- 5-minute rollup of check-ins, kept fresh every minute (live map)
CREATE MATERIALIZED VIEW IF NOT EXISTS busyness_5m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('5 minutes', time) AS bucket, space_id,
       avg(level)::float AS avg_level, count(*) AS reports
FROM checkins GROUP BY bucket, space_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('busyness_5m',
  start_offset => INTERVAL '1 day', end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute', if_not_exists => TRUE);

-- 15-minute rollup of the big feed: the baseline uses this so class-change rushes
-- (students pouring out of lectures at :50) show on the map, not just hourly averages
CREATE MATERIALIZED VIEW IF NOT EXISTS busyness_15m
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('15 minutes', time) AS bucket, space_id,
       avg(score)::float AS avg_score
FROM samples GROUP BY bucket, space_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('busyness_15m',
  start_offset => INTERVAL '120 days', end_offset => INTERVAL '15 minutes',
  schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);

-- Hourly rollup of the big feed (charts)
CREATE MATERIALIZED VIEW IF NOT EXISTS busyness_1h
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket('1 hour', time) AS bucket, space_id,
       avg(score)::float AS avg_score, max(score) AS peak
FROM samples GROUP BY bucket, space_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('busyness_1h',
  start_offset => INTERVAL '120 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '15 minutes', if_not_exists => TRUE);

-- Compression: old chunks shrink a lot (show the ratio in the pitch)
ALTER TABLE samples SET (timescaledb.compress, timescaledb.compress_segmentby = 'space_id');
SELECT add_compression_policy('samples', INTERVAL '7 days', if_not_exists => TRUE);

-- Spaces: centres of the OpenStreetMap outlines (area-weighted), used for walking distances
INSERT INTO spaces (id, name, bank, type, lng, lat) VALUES
  ('bata', 'Bata Library',       'west', 'study',   -78.29043, 44.35723),
  ('sc',   'Student Centre',     'west', 'social',  -78.29110, 44.35670),
  ('ath',  'Athletics Centre',   'west', 'gym',     -78.29250, 44.35546),
  ('cc',   'Champlain College',  'west', 'college', -78.29070, 44.35896),
  ('lec',  'Lady Eaton College', 'west', 'college', -78.29221, 44.35821),
  ('sci',  'Science Complex',    'east', 'lecture', -78.28831, 44.35871),
  ('dna',  'DNA Building',       'east', 'lecture', -78.28495, 44.35903),
  ('gz',   'Gzowski College',    'east', 'lecture', -78.28752, 44.35745),
  ('oc',   'Otonabee College',   'east', 'college', -78.28629, 44.35798)
ON CONFLICT (id) DO NOTHING;

-- EXAMPLE lectures. Replace with ~30 real big sections from myTrent.
INSERT INTO lectures (space_id, dow, starts, ends, est_size)
SELECT * FROM (VALUES
  ('sci', 1, TIME '11:00', TIME '11:50', 200), ('sci', 2, TIME '11:00', TIME '11:50', 200),
  ('sci', 3, TIME '11:00', TIME '11:50', 200), ('sci', 4, TIME '11:00', TIME '11:50', 200),
  ('sci', 5, TIME '11:00', TIME '11:50', 200),
  ('gz',  2, TIME '12:00', TIME '13:20', 180), ('gz', 4, TIME '12:00', TIME '13:20', 180),
  ('dna', 1, TIME '14:00', TIME '14:50', 150), ('dna', 3, TIME '14:00', TIME '14:50', 150),
  ('oc',  1, TIME '10:00', TIME '10:50', 260), ('oc', 3, TIME '10:00', TIME '10:50', 260),
  ('oc',  5, TIME '10:00', TIME '10:50', 260)
) AS v(space_id, dow, starts, ends, est_size)
WHERE NOT EXISTS (SELECT 1 FROM lectures);
