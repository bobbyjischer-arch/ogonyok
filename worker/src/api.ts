/**
 * REST для мини-аппа. Каждый запрос подписан initData, каждая мутация
 * возвращает свежее состояние целиком: клиент просто заменяет своё, и
 * рассинхрон между вкладками «Занятия» и «Привычки» становится невозможен.
 */

import { ACTIVITY_TYPES, isActivityKind } from './activities';
import { verifyInitData } from './auth';
import { recordCheckin } from './checkins';
import * as db from './db';
import { appName, curatorId, isAllowed, isCurator, isPublic, type Env } from './env';
import { Telegram } from './tg';
import {
  clampNumber,
  displayName,
  json,
  localDay,
  nowIso,
  safeIso,
  startOfLocalDay,
} from './util';

/* --- Разбор полей привычки --- */

const asMode = (value: unknown): string => (value === 'build' ? 'build' : 'quit');

/** Маска без единого дня сделала бы серию бессмысленной — падаем на «каждый день». */
function asDaysMask(value: unknown): number {
  const mask = Math.round(clampNumber(value, 0, 127, 127));
  return mask === 0 ? 127 : mask;
}

/**
 * Отметить можно сегодняшний или пропущенный день в пределах двух месяцев:
 * «сделал, но забыл нажать» — обычное дело, а вот отмечать будущее нельзя.
 * Окно совпадает с сеткой истории в приложении (8 недель), иначе тап по
 * старой клетке уходил бы в ошибку.
 */
function validDay(value: unknown, today: string): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  if (value > today) return null;
  const earliest = new Date(Date.parse(`${today}T00:00:00Z`) - 60 * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return value < earliest ? null : value;
}

/* ------------------------------------------------------------------ */
/* Сериализация                                                        */
/* ------------------------------------------------------------------ */

const toActivity = (row: db.ActivityRow) => ({
  id: row.id,
  kind: row.kind,
  note: row.note,
  startedAt: row.started_at,
  endedAt: row.ended_at,
  checkins: row.checkins,
  source: row.source,
});

const toHabit = (
  row: db.HabitRow,
  relapses: db.RelapseRow[],
  daysByHabit: Map<string, string[]>,
) => ({
  id: row.id,
  title: row.title,
  icon: row.icon,
  mode: row.mode === 'build' ? 'build' : 'quit',
  daysMask: row.days_mask,
  startedAt: row.started_at,
  createdAt: row.created_at,
  costPerDay: row.cost_per_day,
  unitsPerDay: row.units_per_day,
  unitLabel: row.unit_label,
  bestStreakMs: row.best_streak_ms,
  relapses: relapses
    .filter((relapse) => relapse.habit_id === row.id)
    .map((relapse) => ({ at: relapse.at, lastedMs: relapse.lasted_ms })),
  // Полная история отметок: серию и рекорд считает клиент, чтобы одна и та же
  // логика не жила в двух местах.
  days: daysByHabit.get(row.id) ?? [],
});

const toSession = (row: db.FocusRow) => ({
  id: row.id,
  habitId: row.habit_id,
  durationMs: row.duration_ms,
  completed: row.completed === 1,
  at: row.at,
});

const toUser = (row: db.UserRow, role: 'user' | 'curator') => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  username: row.username,
  photoUrl: row.photo_url,
  createdAt: row.created_at,
  role,
  settings: {
    currency: row.currency,
    language: row.lang,
    theme: row.theme,
    palette: row.palette,
    tzOffset: row.tz_offset,
    notifications: row.notifications === 1,
  },
});

/** Полный снимок: одно место, где собирается всё, что видит приложение. */
async function buildState(env: Env, user: db.UserRow) {
  const [activities, current, habits, relapses, sessions, habitDays] = await Promise.all([
    db.listActivities(env.DB, user.id, 80),
    db.openActivity(env.DB, user.id),
    db.listHabits(env.DB, user.id),
    db.listRelapses(env.DB, user.id),
    db.listFocusSessions(env.DB, user.id, 120),
    db.listHabitDays(env.DB, user.id),
  ]);

  const daysByHabit = new Map<string, string[]>();
  for (const row of habitDays) {
    const list = daysByHabit.get(row.habit_id);
    if (list) list.push(row.day);
    else daysByHabit.set(row.habit_id, [row.day]);
  }

  return {
    user: toUser(user, isCurator(env, user.id) ? 'curator' : 'user'),
    activities: activities.map(toActivity),
    current: current ? toActivity(current) : null,
    habits: habits.map((habit) => toHabit(habit, relapses, daysByHabit)),
    sessions: sessions.map(toSession),
    types: ACTIVITY_TYPES.map((type) => ({ key: type.key, emoji: type.emoji })),
    today: localDay(user.tz_offset),
    channelUrl: env.CHANNEL_URL || null,
    // Публичная сборка отличается от закрытой только этим флагом — один и тот
    // же бандл обслуживает оба воркера.
    isPublic: isPublic(env),
    appName: appName(env),
    serverTime: nowIso(),
  };
}

const stateResponse = async (env: Env, user: db.UserRow) =>
  json({ state: await buildState(env, user) });

/* ------------------------------------------------------------------ */
/* Роутер                                                              */
/* ------------------------------------------------------------------ */

export async function handleApi(request: Request, env: Env, path: string): Promise<Response> {
  /* --- аутентификация --- */

  const header = request.headers.get('authorization') || '';
  const raw = header.startsWith('tma ') ? header.slice(4) : '';
  const auth = await verifyInitData(raw, env.BOT_TOKEN);
  if (!auth.ok) return json({ error: 'unauthorized', reason: auth.reason }, 401);
  if (!isAllowed(env, auth.user.id)) return json({ error: 'forbidden' }, 403);

  const user = await db.touchUser(env.DB, auth.user.id, auth.user);
  const method = request.method.toUpperCase();
  const segments = path.split('/').filter(Boolean); // ['api', ...]
  const [, section, id, action] = segments;

  const body = async (): Promise<Record<string, unknown>> => {
    try {
      const parsed = await request.json();
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  };

  const tg = new Telegram(env.BOT_TOKEN);

  /* --- состояние --- */

  if (section === 'state' && method === 'GET') {
    return stateResponse(env, user);
  }

  /* --- занятия --- */

  if (section === 'activities') {
    if (method === 'POST' && id === 'start') {
      const payload = await body();
      const kind = payload.kind;
      if (!isActivityKind(kind)) return json({ error: 'bad_request', field: 'kind' }, 400);

      // Одно открытое занятие на человека: прошлое закрываем сами.
      const previous = await db.openActivity(env.DB, user.id);
      if (previous) await db.stopActivity(env.DB, previous.id);
      await db.startActivity(env.DB, user.id, kind, 'miniapp');
      return stateResponse(env, user);
    }

    if (!id) return json({ error: 'not_found' }, 404);

    const activity = await db.getActivity(env.DB, id);
    // Куратор правит и чужие занятия: он за них отвечает и видит их в панели.
    const curator = isCurator(env, user.id);
    if (!activity || (activity.user_id !== user.id && !curator)) {
      return json({ error: 'not_found' }, 404);
    }
    const owner = activity.user_id;

    if (method === 'POST' && action === 'stop') {
      await db.stopActivity(env.DB, activity.id);
      return stateResponse(env, user);
    }

    if (method === 'POST' && action === 'checkin') {
      // Отметка — слова самого человека, писать их за него нельзя даже куратору.
      if (owner !== user.id) return json({ error: 'forbidden' }, 403);
      const payload = await body();
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!text) return json({ error: 'bad_request', field: 'text' }, 400);
      await recordCheckin(env, tg, user, activity, { kind: 'text', text, fileId: null });
      return stateResponse(env, user);
    }

    if (method === 'PATCH' && !action) {
      const payload = await body();
      const patch: Parameters<typeof db.patchActivity>[3] = {};

      if (payload.kind !== undefined) {
        if (!isActivityKind(payload.kind)) return json({ error: 'bad_request', field: 'kind' }, 400);
        patch.kind = payload.kind;
      }
      if (payload.note !== undefined) {
        patch.note = String(payload.note).slice(0, 500);
      }
      if (payload.startedAt !== undefined) {
        const started = safeIso(payload.startedAt);
        if (!started) return json({ error: 'bad_request', field: 'startedAt' }, 400);
        patch.started_at = started;
      }
      if (payload.endedAt !== undefined) {
        if (payload.endedAt === null) {
          patch.ended_at = null;
        } else {
          const ended = safeIso(payload.endedAt);
          if (!ended) return json({ error: 'bad_request', field: 'endedAt' }, 400);
          patch.ended_at = ended;
        }
      }

      // Конец раньше начала превратил бы длительность в отрицательную.
      const started = patch.started_at ?? activity.started_at;
      const ended = patch.ended_at === undefined ? activity.ended_at : patch.ended_at;
      if (ended && Date.parse(ended) < Date.parse(started)) {
        return json({ error: 'bad_request', field: 'endedAt' }, 400);
      }

      await db.patchActivity(env.DB, activity.id, owner, patch);
      return stateResponse(env, user);
    }

    if (method === 'DELETE' && !action) {
      await db.deleteActivity(env.DB, activity.id, owner);
      return stateResponse(env, user);
    }

    return json({ error: 'not_found' }, 404);
  }

  /* --- привычки --- */

  if (section === 'habits') {
    if (method === 'POST' && !id) {
      const payload = await body();
      const title = String(payload.title ?? '').trim().slice(0, 40);
      if (!title) return json({ error: 'bad_request', field: 'title' }, 400);
      await db.createHabit(env.DB, user.id, {
        title,
        icon: String(payload.icon ?? 'shield').slice(0, 24),
        mode: asMode(payload.mode),
        daysMask: asDaysMask(payload.daysMask),
        startedAt: safeIso(payload.startedAt) ?? nowIso(),
        costPerDay: clampNumber(payload.costPerDay, 0, 100000),
        unitsPerDay: clampNumber(payload.unitsPerDay, 0, 10000),
        unitLabel: String(payload.unitLabel ?? '').slice(0, 20),
      });
      return stateResponse(env, user);
    }

    if (!id) return json({ error: 'not_found' }, 404);

    const habit = await db.getHabit(env.DB, id, user.id);
    if (!habit) return json({ error: 'not_found' }, 404);

    if (method === 'POST' && action === 'relapse') {
      await db.recordRelapse(env.DB, habit);
      return stateResponse(env, user);
    }

    // Огонёк полезной привычки: тап отмечает день, повторный тап снимает.
    if (method === 'POST' && action === 'day') {
      if (habit.mode !== 'build') return json({ error: 'bad_request', field: 'mode' }, 400);
      const payload = await body();
      const today = localDay(user.tz_offset);
      const day = payload.day === undefined ? today : validDay(payload.day, today);
      if (!day) return json({ error: 'bad_request', field: 'day' }, 400);
      await db.toggleHabitDay(env.DB, habit, day);
      return stateResponse(env, user);
    }

    if (method === 'PATCH' && !action) {
      const payload = await body();
      const patch: Record<string, string | number> = {};
      if (payload.title !== undefined) {
        const title = String(payload.title).trim().slice(0, 40);
        if (!title) return json({ error: 'bad_request', field: 'title' }, 400);
        patch.title = title;
      }
      if (payload.icon !== undefined) patch.icon = String(payload.icon).slice(0, 24);
      if (payload.mode !== undefined) patch.mode = asMode(payload.mode);
      if (payload.daysMask !== undefined) patch.days_mask = asDaysMask(payload.daysMask);
      if (payload.startedAt !== undefined) {
        const started = safeIso(payload.startedAt);
        if (!started) return json({ error: 'bad_request', field: 'startedAt' }, 400);
        patch.started_at = started;
      }
      if (payload.costPerDay !== undefined) {
        patch.cost_per_day = clampNumber(payload.costPerDay, 0, 100000);
      }
      if (payload.unitsPerDay !== undefined) {
        patch.units_per_day = clampNumber(payload.unitsPerDay, 0, 10000);
      }
      if (payload.unitLabel !== undefined) {
        patch.unit_label = String(payload.unitLabel).slice(0, 20);
      }
      await db.patchHabit(env.DB, habit.id, user.id, patch);
      return stateResponse(env, user);
    }

    if (method === 'DELETE' && !action) {
      await db.deleteHabit(env.DB, habit.id, user.id);
      return stateResponse(env, user);
    }

    return json({ error: 'not_found' }, 404);
  }

  /* --- фокус --- */

  if (section === 'focus' && method === 'POST') {
    const payload = await body();
    const habitId = typeof payload.habitId === 'string' ? payload.habitId : null;
    if (habitId && !(await db.getHabit(env.DB, habitId, user.id))) {
      return json({ error: 'bad_request', field: 'habitId' }, 400);
    }
    await db.addFocusSession(env.DB, user.id, {
      habitId,
      durationMs: clampNumber(payload.durationMs, 0, 12 * 60 * 60 * 1000),
      completed: payload.completed === true,
    });
    return stateResponse(env, user);
  }

  /* --- настройки --- */

  if (section === 'settings' && method === 'PATCH') {
    const payload = await body();
    const patch: {
      lang?: string;
      currency?: string;
      theme?: string;
      palette?: string;
      tz_offset?: number;
      notifications?: number;
    } = {};

    if (payload.language !== undefined) patch.lang = payload.language === 'en' ? 'en' : 'ru';
    if (payload.theme !== undefined) {
      patch.theme = payload.theme === 'light' || payload.theme === 'dark' ? payload.theme : 'auto';
    }
    if (payload.palette !== undefined) {
      patch.palette =
        payload.palette === 'warm' || payload.palette === 'telegram' ? payload.palette : 'system';
    }
    if (payload.currency !== undefined) {
      const currency = String(payload.currency).toUpperCase();
      if (!/^[A-Z]{3}$/.test(currency)) return json({ error: 'bad_request', field: 'currency' }, 400);
      patch.currency = currency;
    }
    if (payload.tzOffset !== undefined) {
      patch.tz_offset = Math.round(clampNumber(payload.tzOffset, -840, 840, 180));
    }
    // Тумблер уведомлений принадлежит куратору — остальным его менять нечего.
    if (payload.notifications !== undefined && isCurator(env, user.id)) {
      patch.notifications = payload.notifications === true ? 1 : 0;
    }

    await db.updateSettings(env.DB, user.id, patch);
    const fresh = (await db.getUser(env.DB, user.id)) ?? user;
    return stateResponse(env, fresh);
  }

  /* --- панель куратора --- */

  if (section === 'curator' && method === 'GET') {
    if (!isCurator(env, user.id)) return json({ error: 'forbidden' }, 403);
    const since = startOfLocalDay(user.tz_offset);
    const [open, today, recent] = await Promise.all([
      db.allOpenActivities(env.DB),
      db.curatorToday(env.DB, since),
      db.recentActivitiesAll(env.DB, 40),
    ]);
    const withUser = (row: db.ActivityRow & { first_name: string; username: string }) => ({
      ...toActivity(row),
      user: {
        id: row.user_id,
        name: displayName({ first_name: row.first_name, username: row.username }),
        username: row.username,
      },
    });
    return json({
      open: open.map(withUser),
      recent: recent.map(withUser),
      today: today.map((row) => ({
        userId: row.user_id,
        name: displayName({ first_name: row.first_name, username: row.username }),
        count: row.count,
        totalMs: row.total_ms,
      })),
      curatorId: curatorId(env),
      serverTime: nowIso(),
    });
  }

  return json({ error: 'not_found' }, 404);
}
