/** Весь SQL живёт здесь: бот и API ходят в базу только через эти функции. */

import { newId, nowIso } from './util';

export interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  photo_url: string;
  lang: string;
  currency: string;
  theme: string;
  palette: string;
  tz_offset: number;
  notifications: number;
  pending_kind: string | null;
  pending_ref: string | null;
  created_at: string;
  last_seen_at: string;
}

export interface ActivityRow {
  id: string;
  user_id: number;
  kind: string;
  note: string;
  started_at: string;
  ended_at: string | null;
  checkins: number;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface CheckinRow {
  id: string;
  activity_id: string | null;
  user_id: number;
  kind: string;
  text: string;
  file_id: string | null;
  created_at: string;
}

export interface HabitRow {
  id: string;
  user_id: number;
  title: string;
  icon: string;
  /** 'quit' — отказ от вредного, 'build' — поддержание полезного. */
  mode: string;
  /** Битовая маска дней недели: бит 0 — понедельник, бит 6 — воскресенье. */
  days_mask: number;
  started_at: string;
  cost_per_day: number;
  units_per_day: number;
  unit_label: string;
  best_streak_ms: number;
  created_at: string;
}

export interface HabitDayRow {
  id: string;
  habit_id: string;
  user_id: number;
  day: string;
  at: string;
}

export interface RelapseRow {
  id: string;
  habit_id: string;
  user_id: number;
  at: string;
  lasted_ms: number;
}

export interface FocusRow {
  id: string;
  user_id: number;
  habit_id: string | null;
  duration_ms: number;
  completed: number;
  at: string;
}

/* ------------------------------------------------------------------ */
/* Пользователи                                                        */
/* ------------------------------------------------------------------ */

export interface Profile {
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

/**
 * Заводит пользователя при первом контакте и обновляет профиль при каждом
 * следующем. photo_url приходит только из мини-аппа, поэтому апдейт из бота
 * не должен затирать его пустой строкой.
 */
export async function touchUser(db: D1Database, id: number, profile: Profile): Promise<UserRow> {
  const now = nowIso();
  const lang = profile.language_code === 'en' ? 'en' : 'ru';
  const row = await db
    .prepare(
      `INSERT INTO users (id, first_name, last_name, username, photo_url, lang, created_at, last_seen_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?7)
       ON CONFLICT(id) DO UPDATE SET
         first_name   = excluded.first_name,
         last_name    = excluded.last_name,
         username     = excluded.username,
         photo_url    = CASE WHEN excluded.photo_url <> '' THEN excluded.photo_url ELSE users.photo_url END,
         last_seen_at = excluded.last_seen_at
       RETURNING *`,
    )
    .bind(
      id,
      profile.first_name ?? '',
      profile.last_name ?? '',
      profile.username ?? '',
      profile.photo_url ?? '',
      lang,
      now,
    )
    .first<UserRow>();

  if (!row) throw new Error(`touchUser failed for ${id}`);
  return row;
}

export function getUser(db: D1Database, id: number): Promise<UserRow | null> {
  return db.prepare('SELECT * FROM users WHERE id = ?1').bind(id).first<UserRow>();
}

export async function setPending(
  db: D1Database,
  id: number,
  kind: string | null,
  ref: string | null,
): Promise<void> {
  await db
    .prepare('UPDATE users SET pending_kind = ?2, pending_ref = ?3 WHERE id = ?1')
    .bind(id, kind, ref)
    .run();
}

export async function updateSettings(
  db: D1Database,
  id: number,
  patch: {
    lang?: string;
    currency?: string;
    theme?: string;
    palette?: string;
    tz_offset?: number;
    notifications?: number;
  },
): Promise<void> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = ?${values.length + 1}`);
  }
  if (sets.length === 0) return;
  await db
    .prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?1`)
    .bind(id, ...values)
    .run();
}

/* ------------------------------------------------------------------ */
/* Занятия                                                             */
/* ------------------------------------------------------------------ */

export function openActivity(db: D1Database, userId: number): Promise<ActivityRow | null> {
  return db
    .prepare(
      'SELECT * FROM activities WHERE user_id = ?1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
    )
    .bind(userId)
    .first<ActivityRow>();
}

export async function startActivity(
  db: D1Database,
  userId: number,
  kind: string,
  source: string,
  startedAt = nowIso(),
): Promise<ActivityRow> {
  const now = nowIso();
  const id = newId();
  const row = await db
    .prepare(
      `INSERT INTO activities (id, user_id, kind, note, started_at, ended_at, checkins, source, created_at, updated_at)
       VALUES (?1, ?2, ?3, '', ?4, NULL, 0, ?5, ?6, ?6)
       RETURNING *`,
    )
    .bind(id, userId, kind, startedAt, source, now)
    .first<ActivityRow>();
  if (!row) throw new Error('startActivity failed');
  return row;
}

export function stopActivity(
  db: D1Database,
  id: string,
  endedAt = nowIso(),
): Promise<ActivityRow | null> {
  return db
    .prepare(
      `UPDATE activities SET ended_at = ?2, updated_at = ?3
       WHERE id = ?1 AND ended_at IS NULL RETURNING *`,
    )
    .bind(id, endedAt, nowIso())
    .first<ActivityRow>();
}

export function getActivity(db: D1Database, id: string): Promise<ActivityRow | null> {
  return db.prepare('SELECT * FROM activities WHERE id = ?1').bind(id).first<ActivityRow>();
}

export async function bumpCheckins(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE activities SET checkins = checkins + 1, updated_at = ?2 WHERE id = ?1')
    .bind(id, nowIso())
    .run();
}

export async function listActivities(
  db: D1Database,
  userId: number,
  limit = 60,
): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM activities WHERE user_id = ?1 ORDER BY started_at DESC LIMIT ?2')
    .bind(userId, limit)
    .all<ActivityRow>();
  return results ?? [];
}

export async function patchActivity(
  db: D1Database,
  id: string,
  userId: number,
  patch: { kind?: string; note?: string; started_at?: string; ended_at?: string | null },
): Promise<ActivityRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = ?${values.length + 2}`);
  }
  if (sets.length === 0) return getActivity(db, id);
  // id=?1, user_id=?2, значения занимают ?3..?N+2, updated_at идёт следом.
  return db
    .prepare(
      `UPDATE activities SET ${sets.join(', ')}, updated_at = ?${values.length + 3}
       WHERE id = ?1 AND user_id = ?2 RETURNING *`,
    )
    .bind(id, userId, ...values, nowIso())
    .first<ActivityRow>();
}

export async function deleteActivity(db: D1Database, id: string, userId: number): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM checkins WHERE activity_id = ?1').bind(id),
    db.prepare('DELETE FROM activities WHERE id = ?1 AND user_id = ?2').bind(id, userId),
  ]);
}

/** Занятия всех пользователей, которые идут прямо сейчас — для панели куратора. */
export async function allOpenActivities(db: D1Database): Promise<(ActivityRow & { first_name: string; username: string })[]> {
  const { results } = await db
    .prepare(
      `SELECT a.*, u.first_name, u.username
       FROM activities a JOIN users u ON u.id = a.user_id
       WHERE a.ended_at IS NULL ORDER BY a.started_at`,
    )
    .all<ActivityRow & { first_name: string; username: string }>();
  return results ?? [];
}

/** Последние занятия всех пользователей — лента событий у куратора. */
export async function recentActivitiesAll(
  db: D1Database,
  limit = 40,
): Promise<(ActivityRow & { first_name: string; username: string })[]> {
  const { results } = await db
    .prepare(
      `SELECT a.*, u.first_name, u.username
       FROM activities a JOIN users u ON u.id = a.user_id
       ORDER BY a.started_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<ActivityRow & { first_name: string; username: string }>();
  return results ?? [];
}

/** Занятия, начатые после границы местных суток. */
export async function activitiesSince(
  db: D1Database,
  userId: number,
  sinceIso: string,
): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM activities WHERE user_id = ?1 AND started_at >= ?2 ORDER BY started_at')
    .bind(userId, sinceIso)
    .all<ActivityRow>();
  return results ?? [];
}

/** Занятия, забытые открытыми — их закрывает cron. */
export async function staleActivities(db: D1Database, olderThanIso: string): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM activities WHERE ended_at IS NULL AND started_at < ?1')
    .bind(olderThanIso)
    .all<ActivityRow>();
  return results ?? [];
}

/** Счётчики за сегодня для панели /admin. */
export async function curatorDigest(
  db: D1Database,
  sinceIso: string,
): Promise<{ startedToday: number; finishedToday: number; checkinsToday: number }> {
  const [started, finished, checkins] = await db.batch<{ n: number }>([
    db.prepare('SELECT COUNT(*) AS n FROM activities WHERE started_at >= ?1').bind(sinceIso),
    db.prepare('SELECT COUNT(*) AS n FROM activities WHERE ended_at >= ?1').bind(sinceIso),
    db.prepare('SELECT COUNT(*) AS n FROM checkins WHERE created_at >= ?1').bind(sinceIso),
  ]);
  return {
    startedToday: started.results?.[0]?.n ?? 0,
    finishedToday: finished.results?.[0]?.n ?? 0,
    checkinsToday: checkins.results?.[0]?.n ?? 0,
  };
}

export interface CuratorDayRow {
  user_id: number;
  first_name: string;
  username: string;
  count: number;
  total_ms: number;
}

/**
 * Сводка по каждому пользователю за сегодня. Длительность считается прямо в
 * SQLite, чтобы не тянуть в воркер все строки ради одной суммы.
 */
export async function curatorToday(db: D1Database, sinceIso: string): Promise<CuratorDayRow[]> {
  const { results } = await db
    .prepare(
      `SELECT a.user_id AS user_id, u.first_name AS first_name, u.username AS username,
              COUNT(*) AS count,
              CAST(COALESCE(SUM(
                CASE WHEN a.ended_at IS NOT NULL
                     THEN (julianday(a.ended_at) - julianday(a.started_at)) * 86400000
                     ELSE 0 END
              ), 0) AS INTEGER) AS total_ms
       FROM activities a JOIN users u ON u.id = a.user_id
       WHERE a.started_at >= ?1
       GROUP BY a.user_id
       ORDER BY total_ms DESC`,
    )
    .bind(sinceIso)
    .all<CuratorDayRow>();
  return results ?? [];
}

/* ------------------------------------------------------------------ */
/* Отметки и мост к куратору                                           */
/* ------------------------------------------------------------------ */

export async function addCheckin(
  db: D1Database,
  data: { activityId: string | null; userId: number; kind: string; text: string; fileId: string | null },
): Promise<CheckinRow> {
  const id = newId();
  const row = await db
    .prepare(
      `INSERT INTO checkins (id, activity_id, user_id, kind, text, file_id, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING *`,
    )
    .bind(id, data.activityId, data.userId, data.kind, data.text, data.fileId, nowIso())
    .first<CheckinRow>();
  if (!row) throw new Error('addCheckin failed');
  return row;
}

export async function listCheckins(
  db: D1Database,
  userId: number,
  limit = 60,
): Promise<CheckinRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM checkins WHERE user_id = ?1 ORDER BY created_at DESC LIMIT ?2')
    .bind(userId, limit)
    .all<CheckinRow>();
  return results ?? [];
}

export async function addRelay(
  db: D1Database,
  messageId: number,
  userId: number,
  checkinId: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO relays (message_id, user_id, checkin_id, created_at) VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT(message_id) DO UPDATE SET user_id = excluded.user_id`,
    )
    .bind(messageId, userId, checkinId, nowIso())
    .run();
}

export function findRelay(db: D1Database, messageId: number) {
  return db
    .prepare('SELECT * FROM relays WHERE message_id = ?1')
    .bind(messageId)
    .first<{ message_id: number; user_id: number; checkin_id: string | null }>();
}

/* ------------------------------------------------------------------ */
/* Привычки                                                            */
/* ------------------------------------------------------------------ */

export async function listHabits(db: D1Database, userId: number): Promise<HabitRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM habits WHERE user_id = ?1 ORDER BY created_at')
    .bind(userId)
    .all<HabitRow>();
  return results ?? [];
}

export async function listRelapses(db: D1Database, userId: number): Promise<RelapseRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM relapses WHERE user_id = ?1 ORDER BY at')
    .bind(userId)
    .all<RelapseRow>();
  return results ?? [];
}

export async function createHabit(
  db: D1Database,
  userId: number,
  draft: {
    title: string;
    icon: string;
    mode: string;
    daysMask: number;
    startedAt: string;
    costPerDay: number;
    unitsPerDay: number;
    unitLabel: string;
  },
): Promise<HabitRow> {
  const id = newId();
  const row = await db
    .prepare(
      `INSERT INTO habits (id, user_id, title, icon, mode, days_mask, started_at,
                           cost_per_day, units_per_day, unit_label, best_streak_ms, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, 0, ?11) RETURNING *`,
    )
    .bind(
      id,
      userId,
      draft.title,
      draft.icon,
      draft.mode,
      draft.daysMask,
      draft.startedAt,
      draft.costPerDay,
      draft.unitsPerDay,
      draft.unitLabel,
      nowIso(),
    )
    .first<HabitRow>();
  if (!row) throw new Error('createHabit failed');
  return row;
}

/* --- Дневные отметки полезных привычек --- */

/** Вся история отметок пользователя: серию и рекорд считает уже клиент. */
export async function listHabitDays(
  db: D1Database,
  userId: number,
  limit = 2000,
): Promise<HabitDayRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM habit_days WHERE user_id = ?1 ORDER BY day DESC LIMIT ?2')
    .bind(userId, limit)
    .all<HabitDayRow>();
  return results ?? [];
}

/** Повторный тап по тому же дню снимает отметку — отсюда возврат состояния. */
export async function toggleHabitDay(
  db: D1Database,
  habit: HabitRow,
  day: string,
): Promise<boolean> {
  const existing = await db
    .prepare('SELECT id FROM habit_days WHERE habit_id = ?1 AND day = ?2')
    .bind(habit.id, day)
    .first<{ id: string }>();

  if (existing) {
    await db
      .prepare('DELETE FROM habit_days WHERE habit_id = ?1 AND day = ?2')
      .bind(habit.id, day)
      .run();
    return false;
  }

  await db
    .prepare('INSERT INTO habit_days (id, habit_id, user_id, day, at) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(newId(), habit.id, habit.user_id, day, nowIso())
    .run();
  return true;
}

export function getHabit(db: D1Database, id: string, userId: number): Promise<HabitRow | null> {
  return db
    .prepare('SELECT * FROM habits WHERE id = ?1 AND user_id = ?2')
    .bind(id, userId)
    .first<HabitRow>();
}

export async function patchHabit(
  db: D1Database,
  id: string,
  userId: number,
  patch: Record<string, string | number>,
): Promise<HabitRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [column, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    values.push(value);
    sets.push(`${column} = ?${values.length + 2}`);
  }
  if (sets.length === 0) return getHabit(db, id, userId);
  return db
    .prepare(`UPDATE habits SET ${sets.join(', ')} WHERE id = ?1 AND user_id = ?2 RETURNING *`)
    .bind(id, userId, ...values)
    .first<HabitRow>();
}

export async function deleteHabit(db: D1Database, id: string, userId: number): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM relapses WHERE habit_id = ?1 AND user_id = ?2').bind(id, userId),
    db.prepare('DELETE FROM habit_days WHERE habit_id = ?1 AND user_id = ?2').bind(id, userId),
    db.prepare('UPDATE focus_sessions SET habit_id = NULL WHERE habit_id = ?1').bind(id),
    db.prepare('DELETE FROM habits WHERE id = ?1 AND user_id = ?2').bind(id, userId),
  ]);
}

/**
 * Срыв: серия уходит в рекорд, отсчёт начинается заново. Обе записи в одной
 * batch-транзакции, иначе при обрыве можно потерять рекорд или получить срыв
 * без сброса счётчика.
 */
export async function recordRelapse(
  db: D1Database,
  habit: HabitRow,
  at = nowIso(),
): Promise<void> {
  const lasted = Math.max(0, Date.parse(at) - Date.parse(habit.started_at));
  const best = Math.max(habit.best_streak_ms, lasted);
  await db.batch([
    db
      .prepare('INSERT INTO relapses (id, habit_id, user_id, at, lasted_ms) VALUES (?1, ?2, ?3, ?4, ?5)')
      .bind(newId(), habit.id, habit.user_id, at, lasted),
    db
      .prepare('UPDATE habits SET started_at = ?2, best_streak_ms = ?3 WHERE id = ?1')
      .bind(habit.id, at, best),
  ]);
}

/* ------------------------------------------------------------------ */
/* Фокус                                                               */
/* ------------------------------------------------------------------ */

export async function addFocusSession(
  db: D1Database,
  userId: number,
  data: { habitId: string | null; durationMs: number; completed: boolean },
): Promise<FocusRow> {
  const id = newId();
  const row = await db
    .prepare(
      `INSERT INTO focus_sessions (id, user_id, habit_id, duration_ms, completed, at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6) RETURNING *`,
    )
    .bind(id, userId, data.habitId, Math.round(data.durationMs), data.completed ? 1 : 0, nowIso())
    .first<FocusRow>();
  if (!row) throw new Error('addFocusSession failed');
  return row;
}

export async function listFocusSessions(
  db: D1Database,
  userId: number,
  limit = 100,
): Promise<FocusRow[]> {
  const { results } = await db
    .prepare('SELECT * FROM focus_sessions WHERE user_id = ?1 ORDER BY at DESC LIMIT ?2')
    .bind(userId, limit)
    .all<FocusRow>();
  return results ?? [];
}
