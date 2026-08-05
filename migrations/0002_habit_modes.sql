-- Привычки становятся двусторонними: можно не только отказываться от вредного,
-- но и поддерживать полезное с ежедневной отметкой и серией «огоньков».

-- 'quit'  — отказ: счётчик времени с последнего срыва (как было).
-- 'build' — поддержание: отметка за день, серия считается по дням.
ALTER TABLE habits ADD COLUMN mode TEXT NOT NULL DEFAULT 'quit';

-- Битовая маска запланированных дней недели: бит 0 — понедельник … бит 6 —
-- воскресенье. 127 = каждый день. Незапланированный день серию не рвёт,
-- поэтому «спорт по пн/ср/пт» держит огонёк честно.
ALTER TABLE habits ADD COLUMN days_mask INTEGER NOT NULL DEFAULT 127;

-- Рекорд серии в днях отдельной колонкой не хранится: он выводится из полной
-- истории отметок, и так его нельзя рассинхронизировать с фактами.

-- Отметки выполнения по дням. day — местная дата пользователя (YYYY-MM-DD),
-- посчитанная из его tz_offset, чтобы «сегодня» совпадало с тем, что он видит.
CREATE TABLE IF NOT EXISTS habit_days (
  id       TEXT    PRIMARY KEY,
  habit_id TEXT    NOT NULL,
  user_id  INTEGER NOT NULL,
  day      TEXT    NOT NULL,
  at       TEXT    NOT NULL
);

-- Одна отметка на день: повторный тап переключает, а не плодит дубли.
CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_days_unique ON habit_days(habit_id, day);
CREATE INDEX IF NOT EXISTS idx_habit_days_user ON habit_days(user_id, day DESC);
