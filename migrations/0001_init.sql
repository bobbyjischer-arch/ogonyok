-- Схема трекера: занятия с куратором + вредные привычки + фокус-сессии.
-- Всё время хранится строками ISO-8601 в UTC.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,          -- telegram user id
  first_name    TEXT    NOT NULL DEFAULT '',
  last_name     TEXT    NOT NULL DEFAULT '',
  username      TEXT    NOT NULL DEFAULT '',
  photo_url     TEXT    NOT NULL DEFAULT '',
  lang          TEXT    NOT NULL DEFAULT 'ru',
  currency      TEXT    NOT NULL DEFAULT 'RUB',
  tz_offset     INTEGER NOT NULL DEFAULT 180, -- минуты от UTC, для границ «сегодня»
  notifications INTEGER NOT NULL DEFAULT 1,   -- куратор: слать ли уведомления
  pending_kind  TEXT,                         -- 'checkin' пока ждём текст отметки
  pending_ref   TEXT,                         -- id занятия, к которому ждём отметку
  created_at    TEXT    NOT NULL,
  last_seen_at  TEXT    NOT NULL
);

-- Занятия: то, что в питоновском боте было Session, только переживает рестарт.
CREATE TABLE IF NOT EXISTS activities (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  kind       TEXT    NOT NULL,                -- ключ типа: work, sport, reading…
  note       TEXT    NOT NULL DEFAULT '',
  started_at TEXT    NOT NULL,
  ended_at   TEXT,                            -- NULL = занятие идёт прямо сейчас
  checkins   INTEGER NOT NULL DEFAULT 0,
  source     TEXT    NOT NULL DEFAULT 'bot',  -- bot | miniapp | auto
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_activities_user   ON activities(user_id, started_at DESC);
-- Открытое занятие ищется на каждом апдейте, поэтому отдельный частичный индекс.
CREATE INDEX IF NOT EXISTS idx_activities_open   ON activities(user_id) WHERE ended_at IS NULL;

-- Отметки внутри занятия. Текст, кружок, голосовое — что угодно.
CREATE TABLE IF NOT EXISTS checkins (
  id          TEXT    PRIMARY KEY,
  activity_id TEXT,
  user_id     INTEGER NOT NULL,
  kind        TEXT    NOT NULL DEFAULT 'text',
  text        TEXT    NOT NULL DEFAULT '',
  file_id     TEXT,
  created_at  TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_checkins_activity ON checkins(activity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_checkins_user     ON checkins(user_id, created_at DESC);

-- Мост «куратор отвечает реплаем»: id сообщения в чате куратора -> автор отметки.
CREATE TABLE IF NOT EXISTS relays (
  message_id INTEGER PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  checkin_id TEXT,
  created_at TEXT NOT NULL
);

-- Вредные привычки (Habit Breaker).
CREATE TABLE IF NOT EXISTS habits (
  id             TEXT    PRIMARY KEY,
  user_id        INTEGER NOT NULL,
  title          TEXT    NOT NULL,
  icon           TEXT    NOT NULL DEFAULT 'shield',
  started_at     TEXT    NOT NULL,
  cost_per_day   REAL    NOT NULL DEFAULT 0,
  units_per_day  REAL    NOT NULL DEFAULT 0,
  unit_label     TEXT    NOT NULL DEFAULT '',
  best_streak_ms INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_habits_user ON habits(user_id, created_at);

CREATE TABLE IF NOT EXISTS relapses (
  id        TEXT    PRIMARY KEY,
  habit_id  TEXT    NOT NULL,
  user_id   INTEGER NOT NULL,
  at        TEXT    NOT NULL,
  lasted_ms INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_relapses_habit ON relapses(habit_id, at DESC);

-- Сессии фокус-таймера (в мини-аппе это тип Session).
CREATE TABLE IF NOT EXISTS focus_sessions (
  id          TEXT    PRIMARY KEY,
  user_id     INTEGER NOT NULL,
  habit_id    TEXT,
  duration_ms INTEGER NOT NULL,
  completed   INTEGER NOT NULL DEFAULT 0,
  at          TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_focus_user ON focus_sessions(user_id, at DESC);
