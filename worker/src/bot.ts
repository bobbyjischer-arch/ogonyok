/**
 * Логика бота. Порт питоновского «Трекера занятий» на вебхук Workers:
 * выбор занятия → старт → отметки куратору → финиш, плюс мост «куратор
 * отвечает реплаем» и панель /admin. Состояние живёт в D1, а не в памяти
 * процесса, поэтому рестарт больше не теряет активные сессии.
 */

import { ACTIVITY_TYPES, activityLabel, isActivityKind } from './activities';
import { recordCheckin } from './checkins';
import * as db from './db';
import { appName, curatorId, isAllowed, isCurator, isPublic, type Env } from './env';
import { EVERY_DAY, streakOf } from '../../shared/streak';
import {
  Telegram,
  describeMedia,
  keyboard,
  type InlineKeyboard,
  type TgCallbackQuery,
  type TgMessage,
  type TgUpdate,
} from './tg';
import {
  displayName,
  escapeHtml,
  humanDuration,
  localClock,
  localDay,
  localStamp,
  nowIso,
  startOfLocalDay,
} from './util';

/* ------------------------------------------------------------------ */
/* Клавиатуры                                                          */
/* ------------------------------------------------------------------ */

const appButton = (url: string) => ({ text: '📊 Приложение', web_app: { url } });

function activitiesKeyboard(url: string) {
  const rows: InlineKeyboard = [];
  for (let i = 0; i < ACTIVITY_TYPES.length; i += 2) {
    const row = ACTIVITY_TYPES.slice(i, i + 2).map((type) => ({
      text: `${type.emoji} ${type.ru}`,
      callback_data: `act:${type.key}`,
    }));
    rows.push(row);
  }
  rows.push([appButton(url)]);
  return keyboard(rows);
}

/**
 * Стартовый экран. В публичной версии бот в первую очередь про привычки,
 * поэтому занятия там прячутся за одну кнопку, а не занимают всё меню.
 */
function startKeyboard(env: Env, url: string) {
  if (!isPublic(env)) return activitiesKeyboard(url);
  return keyboard([
    [
      { text: '➕ Новая привычка', callback_data: 'hab:new' },
      { text: '🔥 Мои привычки', callback_data: 'hab:list' },
    ],
    [{ text: '⏱ Засечь занятие', callback_data: 'acts' }],
    [appButton(url)],
  ]);
}

const beginKeyboard = (kind: string) =>
  keyboard([
    [{ text: '🚀 Начать', callback_data: `begin:${kind}` }],
    [{ text: '◀️ Другое занятие', callback_data: 'back' }],
  ]);

const sessionKeyboard = (url: string) =>
  keyboard([
    [
      { text: '📍 Отметиться', callback_data: 'checkin' },
      { text: '✅ Завершить', callback_data: 'finish' },
    ],
    [appButton(url)],
  ]);

const cancelKeyboard = keyboard([[{ text: '◀️ Отмена', callback_data: 'cancel' }]]);

const restartKeyboard = (url: string) =>
  keyboard([[{ text: '🔄 Ещё занятие', callback_data: 'back' }], [appButton(url)]]);

const adminKeyboard = (notificationsOn: boolean, url: string) =>
  keyboard([
    [
      {
        text: notificationsOn ? '🔔 Уведомления: вкл' : '🔕 Уведомления: выкл',
        callback_data: 'adm:notify',
      },
    ],
    [{ text: '🔄 Обновить', callback_data: 'adm:refresh' }],
    [appButton(url)],
  ]);

/* ------------------------------------------------------------------ */
/* Тексты                                                              */
/* ------------------------------------------------------------------ */

function greeting(name: string, env: Env): string {
  const hello = `Привет, ${escapeHtml(name)}! 👋`;
  if (isPublic(env)) {
    return (
      `${hello}\n\n` +
      `Это <b>${escapeHtml(appName(env))}</b> — трекер привычек. Полезные отмечаешь каждый день ` +
      `и копишь огоньки, от вредных считаешь, сколько держишься.\n\n` +
      `Заводи привычки прямо здесь кнопкой ниже — или открой приложение, ` +
      `там же графики, фокус-таймер и занятия 👇`
    );
  }
  return `${hello}\n\nЧем хочешь сегодня заняться? Выбери вариант ниже 👇`;
}

/**
 * Возврат к выбору занятия. В публичной версии приветствие — про привычки,
 * так что вернуть его над списком занятий было бы враньём.
 */
const pickActivityText = (env: Env, name: string): string =>
  isPublic(env) ? 'Чем сейчас займёшься? Выбери занятие 👇' : greeting(name, env);

function runningText(activity: db.ActivityRow, tzOffset: number): string {
  const elapsed = Date.now() - Date.parse(activity.started_at);
  return (
    `Идёт занятие 🚀\n\n` +
    `🏷 ${activityLabel(activity.kind)}\n` +
    `🕐 Начало: ${localClock(activity.started_at, tzOffset)}\n` +
    `⏱ Уже: ${humanDuration(elapsed)}\n` +
    `📍 Отметок: ${activity.checkins}\n\n` +
    `Захочешь отметиться, на каком ты моменте, — жми кнопку ниже 👇`
  );
}

function finishedText(activity: db.ActivityRow, endedAt: string): string {
  const duration = Date.parse(endedAt) - Date.parse(activity.started_at);
  return (
    `Готово, ты молодец! 🎉\n\n` +
    `🏷 Занятие: ${activityLabel(activity.kind)}\n` +
    `⏱ Длительность: ${humanDuration(duration)}\n` +
    `📍 Отметок: ${activity.checkins}\n\n` +
    `Захочешь ещё — жми кнопку 👇`
  );
}

/* ------------------------------------------------------------------ */
/* Уведомления куратору                                                */
/* ------------------------------------------------------------------ */

/**
 * Тумблер /admin глушит только служебные «начал/завершил». Сами отметки идут
 * куратору всегда: это то, ради чего бот и существует.
 */
async function notifyCurator(env: Env, tg: Telegram, text: string): Promise<void> {
  const curator = curatorId(env);
  // В публичной версии куратор не подписан на чужие старты и финиши.
  if (!curator || isPublic(env)) return;
  const row = await db.getUser(env.DB, curator);
  if (row && row.notifications === 0) return;
  await tg.sendMessage(curator, text);
}

/* ------------------------------------------------------------------ */
/* Отметки                                                             */
/* ------------------------------------------------------------------ */

/**
 * Отметка из чата. Текстовую часть и запись в базу берёт на себя общий
 * recordCheckin, здесь остаётся только вложение: оно уходит куратору копией,
 * чтобы работали все типы и не висела шапка «переслано от».
 */
async function saveAndRelayCheckin(
  env: Env,
  tg: Telegram,
  user: db.UserRow,
  activity: db.ActivityRow | null,
  message: TgMessage,
): Promise<void> {
  const { kind, fileId } = describeMedia(message);
  const text = message.text ?? message.caption ?? '';

  const { checkin } = await recordCheckin(env, tg, user, activity, { kind, text, fileId });

  const curator = curatorId(env);
  if (!curator || curator === user.id || isPublic(env)) return;
  if (kind === 'text' || kind === 'unknown') return;

  // Реплай должен работать и на само вложение, поэтому его id тоже в мосте.
  const copied = await tg.copyMessage(curator, message.chat.id, message.message_id);
  if (copied) await db.addRelay(env.DB, copied.message_id, user.id, checkin.id);
}

/* ------------------------------------------------------------------ */
/* Панель куратора                                                     */
/* ------------------------------------------------------------------ */

async function adminText(env: Env, tzOffset: number): Promise<string> {
  const since = startOfLocalDay(tzOffset);
  const [open, digest] = await Promise.all([
    db.allOpenActivities(env.DB),
    db.curatorDigest(env.DB, since),
  ]);

  const lines = [
    '🛠 <b>Панель куратора</b>',
    '',
    `▶️ Начато сегодня: <b>${digest.startedToday}</b>`,
    `✅ Завершено сегодня: <b>${digest.finishedToday}</b>`,
    `📍 Отметок сегодня: <b>${digest.checkinsToday}</b>`,
    '',
    `👥 <b>Идёт прямо сейчас: ${open.length}</b>`,
  ];

  if (open.length === 0) {
    lines.push('<i>Сейчас никто не занимается.</i>');
  } else {
    for (const row of open) {
      const who = escapeHtml(displayName({ first_name: row.first_name, username: row.username }));
      const elapsed = Date.now() - Date.parse(row.started_at);
      lines.push(
        `• ${who} — ${activityLabel(row.kind)}, ${humanDuration(elapsed)}, отметок: ${row.checkins}`,
      );
    }
  }

  return lines.join('\n');
}

/* ------------------------------------------------------------------ */
/* Привычки в чате                                                     */
/* ------------------------------------------------------------------ */

/**
 * Завести и вести привычку можно прямо в переписке — это есть только в
 * публичной версии: в закрытой чат занят занятиями и куратором, а привычки
 * там живут в мини-аппе.
 *
 * Из чата задаём только режим и название. Иконка, расписание и стоимость
 * остаются за приложением: спрашивать их пятью сообщениями подряд — верный
 * способ, чтобы до конца дошёл один человек из десяти.
 */

/** Пресет «Другое» из наборов мини-аппа. */
const DEFAULT_ICON: Record<string, string> = { build: 'target', quit: 'shield' };

/** Сколько привычек показываем кнопками: длинный список — уже работа приложения. */
const HABIT_ROWS = 10;

const habitModeKeyboard = keyboard([
  [{ text: '🌱 Поддерживать полезную', callback_data: 'hab:new:build' }],
  [{ text: '🚫 Отказаться от вредной', callback_data: 'hab:new:quit' }],
  [{ text: '◀️ Отмена', callback_data: 'hab:home' }],
]);

const habitCancelKeyboard = keyboard([[{ text: '◀️ Отмена', callback_data: 'hab:home' }]]);

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const shortTitle = (title: string): string =>
  title.length > 18 ? `${title.slice(0, 17)}…` : title;

interface HabitView {
  /** Строка для текста сообщения. */
  line: string;
  /** Кнопка действия: отметить день или признать срыв. */
  button: { text: string; callback_data: string };
}

/**
 * Привычки вместе с историей отметок: серию считает общий `streakOf`, тот же,
 * что рисует огонёк в приложении, — иначе бот и мини-апп называли бы разные
 * числа.
 */
async function habitViews(env: Env, user: db.UserRow): Promise<HabitView[]> {
  const [habits, days] = await Promise.all([
    db.listHabits(env.DB, user.id),
    db.listHabitDays(env.DB, user.id),
  ]);

  const byHabit = new Map<string, string[]>();
  for (const row of days) {
    const list = byHabit.get(row.habit_id);
    if (list) list.push(row.day);
    else byHabit.set(row.habit_id, [row.day]);
  }

  const today = localDay(user.tz_offset);

  return habits.map((habit) => {
    const title = escapeHtml(habit.title);

    if (habit.mode === 'build') {
      const streak = streakOf(
        { days: byHabit.get(habit.id) ?? [], daysMask: habit.days_mask || EVERY_DAY },
        today,
      );
      const fire =
        streak.current > 0
          ? `🔥 ${streak.current} ${plural(streak.current, 'день', 'дня', 'дней')} подряд`
          : '🌱 серия ещё не началась';
      const mark = streak.doneToday
        ? 'сегодня отмечено ✅'
        : streak.scheduledToday
          ? 'сегодня ещё нет'
          : 'сегодня выходной';
      return {
        line: `🌱 <b>${title}</b>\n${fire} · ${mark}`,
        button: {
          text: `${streak.doneToday ? '↩️ Снять' : '✅ Отметить'}: ${shortTitle(habit.title)}`,
          callback_data: `hab:mark:${habit.id}`,
        },
      };
    }

    const held = Math.max(0, Date.now() - Date.parse(habit.started_at));
    // Рекорд в базе — про прошлые заходы, текущий может его уже перебить.
    const best = Math.max(habit.best_streak_ms, held);
    return {
      line: `🚫 <b>${title}</b>\n⏳ держишься ${humanDuration(held)} · рекорд ${humanDuration(best)}`,
      button: {
        text: `💔 Сорвался: ${shortTitle(habit.title)}`,
        callback_data: `hab:slip:${habit.id}`,
      },
    };
  });
}

async function habitsScreen(
  env: Env,
  user: db.UserRow,
  url: string,
): Promise<{ text: string; reply_markup: ReturnType<typeof keyboard> }> {
  const views = await habitViews(env, user);

  if (views.length === 0) {
    return {
      text:
        '🔥 <b>Мои привычки</b>\n\n' +
        'Пока пусто. Заведи первую — это одна кнопка и одно сообщение с названием.',
      reply_markup: keyboard([
        [{ text: '➕ Новая привычка', callback_data: 'hab:new' }],
        [appButton(url)],
        [{ text: '◀️ Назад', callback_data: 'hab:home' }],
      ]),
    };
  }

  const shown = views.slice(0, HABIT_ROWS);
  const lines = shown.map((view) => view.line);
  if (views.length > shown.length) {
    lines.push(`<i>…и ещё ${views.length - shown.length} — в приложении.</i>`);
  }

  const rows: InlineKeyboard = shown.map((view) => [view.button]);
  rows.push([
    { text: '➕ Новая', callback_data: 'hab:new' },
    { text: '🔄 Обновить', callback_data: 'hab:list' },
  ]);
  rows.push([appButton(url)]);
  rows.push([{ text: '◀️ Назад', callback_data: 'hab:home' }]);

  return {
    text: `🔥 <b>Мои привычки</b>\n\n${lines.join('\n\n')}`,
    reply_markup: keyboard(rows),
  };
}

/** Название пришло текстом — заводим привычку и подтверждаем. */
async function createHabitFromChat(
  env: Env,
  tg: Telegram,
  user: db.UserRow,
  chatId: number,
  rawTitle: string,
  url: string,
): Promise<void> {
  const mode = user.pending_ref === 'build' ? 'build' : 'quit';
  const title = rawTitle.trim().slice(0, 40);

  if (!title) {
    await tg.sendMessage(chatId, 'Название нужно текстом — одной строкой 🙂', {
      reply_markup: habitCancelKeyboard,
    });
    return;
  }

  await db.createHabit(env.DB, user.id, {
    title,
    icon: DEFAULT_ICON[mode] ?? 'shield',
    mode,
    daysMask: EVERY_DAY,
    startedAt: nowIso(),
    costPerDay: 0,
    unitsPerDay: 0,
    unitLabel: '',
  });
  await db.setPending(env.DB, user.id, null, null);

  const safe = escapeHtml(title);
  const text =
    mode === 'build'
      ? `Готово! 🌱\n\n<b>${safe}</b> — отмечай каждый день, и огонёк будет расти.\n\n` +
        `Расписание пока «каждый день»: дни, иконку и напоминание себе можно поправить в приложении.`
      : `Готово! 🚫\n\nОтсчёт по <b>${safe}</b> пошёл с этой минуты. ` +
        `Сорвёшься — обнулишь счётчик кнопкой, и прошлый результат останется рекордом.`;

  await tg.sendMessage(chatId, text, {
    reply_markup: keyboard([
      [{ text: '🔥 Мои привычки', callback_data: 'hab:list' }],
      [appButton(url)],
    ]),
  });
}

/* ------------------------------------------------------------------ */
/* Сообщения                                                           */
/* ------------------------------------------------------------------ */

async function handleMessage(message: TgMessage, env: Env, tg: Telegram, url: string): Promise<void> {
  const from = message.from;
  if (!from || from.is_bot) return;
  if (message.chat.type !== 'private') return;

  if (!isAllowed(env, from.id)) {
    await tg.sendMessage(message.chat.id, 'Извините, этот бот только для приглашённых пользователей.');
    return;
  }

  const user = await db.touchUser(env.DB, from.id, from);
  const text = (message.text ?? '').trim();
  const command = text.startsWith('/') ? text.split(/[\s@]/)[0].toLowerCase() : '';

  // Куратор отвечает реплаем на отметку — доставляем автору.
  if (!command && isCurator(env, from.id) && message.reply_to_message) {
    const relay = await db.findRelay(env.DB, message.reply_to_message.message_id);
    if (relay) {
      if (message.text) {
        await tg.sendMessage(relay.user_id, `💬 <b>Сообщение от куратора</b>\n\n${escapeHtml(message.text)}`);
      } else {
        await tg.sendMessage(relay.user_id, '💬 <b>Сообщение от куратора</b>');
        await tg.copyMessage(relay.user_id, message.chat.id, message.message_id);
      }
      await tg.sendMessage(message.chat.id, 'Отправлено ✅');
      return;
    }
  }

  switch (command) {
    case '/start':
    case '/help': {
      await db.setPending(env.DB, user.id, null, null);
      const open = await db.openActivity(env.DB, user.id);
      if (open) {
        await tg.sendMessage(message.chat.id, runningText(open, user.tz_offset), {
          reply_markup: sessionKeyboard(url),
        });
      } else {
        await tg.sendMessage(message.chat.id, greeting(from.first_name || 'друг', env), {
          reply_markup: startKeyboard(env, url),
        });
      }
      return;
    }

    /* --- привычки: только публичная версия --- */

    case '/new':
    case '/habit': {
      if (!isPublic(env)) break;
      await db.setPending(env.DB, user.id, null, null);
      await tg.sendMessage(
        message.chat.id,
        '➕ <b>Новая привычка</b>\n\nЧто это будет — полезное, что хочешь делать регулярно, ' +
          'или вредное, от чего отказываешься?',
        { reply_markup: habitModeKeyboard },
      );
      return;
    }

    case '/habits': {
      if (!isPublic(env)) break;
      const screen = await habitsScreen(env, user, url);
      await tg.sendMessage(message.chat.id, screen.text, { reply_markup: screen.reply_markup });
      return;
    }

    case '/app': {
      await tg.sendMessage(
        message.chat.id,
        '🌐 <b>Приложение</b>\n\nЗанятия, привычки, фокус-таймер и статистика — всё внутри.',
        { reply_markup: keyboard([[appButton(url)]]) },
      );
      return;
    }

    case '/list': {
      const activities = await db.listActivities(env.DB, user.id, 10);
      if (activities.length === 0) {
        await tg.sendMessage(message.chat.id, 'Занятий пока нет. Нажми /start и выбери первое!', {
          reply_markup: activitiesKeyboard(url),
        });
        return;
      }
      const lines = activities.map((activity, index) => {
        const start = localStamp(activity.started_at, user.tz_offset);
        const tail = activity.ended_at
          ? `${localClock(activity.ended_at, user.tz_offset)} · ${humanDuration(
              Date.parse(activity.ended_at) - Date.parse(activity.started_at),
            )}`
          : 'идёт…';
        return `${index + 1}. ${activityLabel(activity.kind)} — ${start} → ${tail}`;
      });
      await tg.sendMessage(message.chat.id, `📋 <b>Последние занятия</b>\n\n${lines.join('\n')}`, {
        reply_markup: keyboard([[appButton(url)]]),
      });
      return;
    }

    case '/cancel': {
      await db.setPending(env.DB, user.id, null, null);
      await tg.sendMessage(message.chat.id, 'Хорошо, продолжаем! 💪');
      return;
    }

    case '/admin': {
      if (!isCurator(env, from.id)) return;
      const curatorRow = await db.getUser(env.DB, from.id);
      await tg.sendMessage(message.chat.id, await adminText(env, user.tz_offset), {
        reply_markup: adminKeyboard((curatorRow?.notifications ?? 1) === 1, url),
      });
      return;
    }

    default:
      break;
  }

  if (command) {
    await tg.sendMessage(
      message.chat.id,
      isPublic(env)
        ? 'Не знаю такой команды. Есть /start, /new, /habits, /app.'
        : 'Не знаю такой команды. Есть /start, /list, /app.',
    );
    return;
  }

  // Ждём название новой привычки — любой текст становится им.
  if (user.pending_kind === 'habit') {
    await createHabitFromChat(env, tg, user, message.chat.id, text, url);
    return;
  }

  // Не команда: это отметка. Либо мы её ждали, либо занятие уже идёт.
  const activity = await db.openActivity(env.DB, user.id);
  const awaiting = user.pending_kind === 'checkin';

  if (!activity && !awaiting) {
    await tg.sendMessage(
      message.chat.id,
      isPublic(env)
        ? 'Сейчас ничего не ждём. Вот что можно сделать 👇'
        : 'Сейчас нет активного занятия. Выбери, чем занимаешься 👇',
      { reply_markup: startKeyboard(env, url) },
    );
    return;
  }

  // Индикатор «печатает» — украшение, и ждать его нельзя: недоступный Bot API
  // задержал бы запись самой отметки на весь таймаут запроса.
  void tg.call('sendChatAction', { chat_id: message.chat.id, action: 'typing' });
  await saveAndRelayCheckin(env, tg, user, activity, message);
  if (awaiting) await db.setPending(env.DB, user.id, null, null);

  await tg.sendMessage(message.chat.id, 'Передал! ✅ Возвращаемся к делу 💪', {
    reply_markup: activity ? sessionKeyboard(url) : keyboard([[appButton(url)]]),
  });
}

/* ------------------------------------------------------------------ */
/* Кнопки                                                              */
/* ------------------------------------------------------------------ */

async function handleCallback(query: TgCallbackQuery, env: Env, tg: Telegram, url: string): Promise<void> {
  const from = query.from;
  const chatId = query.message?.chat.id;
  const messageId = query.message?.message_id;
  const data = query.data ?? '';

  if (!chatId || !messageId) {
    await tg.answerCallback(query.id);
    return;
  }
  if (!isAllowed(env, from.id)) {
    await tg.answerCallback(query.id, 'Бот только для приглашённых', true);
    return;
  }

  const user = await db.touchUser(env.DB, from.id, from);

  /* --- выбор занятия --- */

  if (data.startsWith('act:')) {
    const kind = data.slice(4);
    if (!isActivityKind(kind)) {
      await tg.answerCallback(query.id, 'Неизвестное занятие', true);
      return;
    }
    await tg.answerCallback(query.id);
    await tg.editMessageText(
      chatId,
      messageId,
      `Отличный выбор — ${activityLabel(kind)}!\n\nКогда будешь готов(а), жми «Начать» 🚀`,
      { reply_markup: beginKeyboard(kind) },
    );
    return;
  }

  if (data.startsWith('begin:')) {
    const kind = data.slice(6);
    if (!isActivityKind(kind)) {
      await tg.answerCallback(query.id, 'Неизвестное занятие', true);
      return;
    }

    // Забыли завершить прошлое — закрываем сами, иначе счётчики поедут.
    const previous = await db.openActivity(env.DB, user.id);
    if (previous) await db.stopActivity(env.DB, previous.id);

    const activity = await db.startActivity(env.DB, user.id, kind, 'bot');
    await db.setPending(env.DB, user.id, null, null);
    await tg.answerCallback(query.id, 'Поехали! 🚀');

    const started = localClock(activity.started_at, user.tz_offset);
    const head = previous
      ? `Прошлое занятие (${activityLabel(previous.kind)}) закрыл. `
      : '';
    await tg.editMessageText(
      chatId,
      messageId,
      `${head}Поехали! 🚀\n\n` +
        `🏷 Занятие: ${activityLabel(kind)}\n` +
        `🕐 Начало: ${started}\n\n` +
        `Я рядом. Захочешь отметиться, на каком ты моменте, — жми кнопку ниже 👇`,
      { reply_markup: sessionKeyboard(url) },
    );

    await notifyCurator(
      env,
      tg,
      `▶️ <b>${escapeHtml(displayName(user))}</b> (id <code>${user.id}</code>) начал(а) занятие\n` +
        `🏷 ${activityLabel(kind)}\n🕐 ${started}`,
    );
    return;
  }

  /* --- ход занятия --- */

  if (data === 'checkin') {
    const activity = await db.openActivity(env.DB, user.id);
    if (!activity) {
      await tg.answerCallback(query.id, 'Занятие не найдено. Нажми /start', true);
      return;
    }
    await db.setPending(env.DB, user.id, 'checkin', activity.id);
    await tg.answerCallback(query.id);
    await tg.editMessageText(
      chatId,
      messageId,
      'Расскажи, на каком ты сейчас моменте 👇\nМожно текстом, голосовым или кружком — передам куратору 😉',
      { reply_markup: cancelKeyboard },
    );
    return;
  }

  if (data === 'cancel') {
    await db.setPending(env.DB, user.id, null, null);
    const activity = await db.openActivity(env.DB, user.id);
    await tg.answerCallback(query.id);
    await tg.editMessageText(
      chatId,
      messageId,
      activity ? runningText(activity, user.tz_offset) : greeting(from.first_name || 'друг', env),
      { reply_markup: activity ? sessionKeyboard(url) : startKeyboard(env, url) },
    );
    return;
  }

  if (data === 'finish') {
    const activity = await db.openActivity(env.DB, user.id);
    if (!activity) {
      await tg.answerCallback(query.id, 'Занятие не найдено. Нажми /start', true);
      return;
    }
    const stopped = (await db.stopActivity(env.DB, activity.id)) ?? activity;
    await db.setPending(env.DB, user.id, null, null);
    const endedAt = stopped.ended_at ?? new Date().toISOString();

    await tg.answerCallback(query.id, 'Отличная работа! 🎉');
    await tg.editMessageText(chatId, messageId, finishedText(stopped, endedAt), {
      reply_markup: restartKeyboard(url),
    });

    await notifyCurator(
      env,
      tg,
      `✅ <b>${escapeHtml(displayName(user))}</b> завершил(а) занятие\n` +
        `🏷 ${activityLabel(stopped.kind)}\n` +
        `⏱ ${humanDuration(Date.parse(endedAt) - Date.parse(stopped.started_at))}\n` +
        `📍 Отметок: ${stopped.checkins}`,
    );
    return;
  }

  if (data === 'back' || data === 'acts') {
    await db.setPending(env.DB, user.id, null, null);
    await tg.answerCallback(query.id);
    await tg.editMessageText(chatId, messageId, pickActivityText(env, from.first_name || 'друг'), {
      reply_markup: activitiesKeyboard(url),
    });
    return;
  }

  /* --- привычки (публичная версия) --- */

  if (data.startsWith('hab:')) {
    if (!isPublic(env)) {
      await tg.answerCallback(query.id, 'Привычки живут в приложении', true);
      return;
    }

    const [, action, habitId] = data.split(':');

    if (action === 'home') {
      await db.setPending(env.DB, user.id, null, null);
      await tg.answerCallback(query.id);
      await tg.editMessageText(chatId, messageId, greeting(from.first_name || 'друг', env), {
        reply_markup: startKeyboard(env, url),
      });
      return;
    }

    if (action === 'new') {
      // Второй сегмент есть только после выбора режима: hab:new:build.
      const mode = habitId;
      if (mode !== 'build' && mode !== 'quit') {
        await db.setPending(env.DB, user.id, null, null);
        await tg.answerCallback(query.id);
        await tg.editMessageText(
          chatId,
          messageId,
          '➕ <b>Новая привычка</b>\n\nЧто это будет — полезное, что хочешь делать регулярно, ' +
            'или вредное, от чего отказываешься?',
          { reply_markup: habitModeKeyboard },
        );
        return;
      }

      await db.setPending(env.DB, user.id, 'habit', mode);
      await tg.answerCallback(query.id);
      await tg.editMessageText(
        chatId,
        messageId,
        mode === 'build'
          ? '🌱 Как назовём? Напиши одним сообщением — например, «Зарядка» или «Читать 20 минут».'
          : '🚫 От чего отказываешься? Напиши одним сообщением — например, «Курение» или «Сахар».',
        { reply_markup: habitCancelKeyboard },
      );
      return;
    }

    if (action === 'list') {
      await tg.answerCallback(query.id);
      const screen = await habitsScreen(env, user, url);
      await tg.editMessageText(chatId, messageId, screen.text, {
        reply_markup: screen.reply_markup,
      });
      return;
    }

    const habit = habitId ? await db.getHabit(env.DB, habitId, user.id) : null;
    if (!habit) {
      await tg.answerCallback(query.id, 'Привычка не найдена', true);
      return;
    }

    if (action === 'mark' && habit.mode === 'build') {
      const marked = await db.toggleHabitDay(env.DB, habit, localDay(user.tz_offset));
      await tg.answerCallback(query.id, marked ? 'Отмечено! 🔥' : 'Отметку снял');
    } else if (action === 'slip' && habit.mode === 'quit') {
      // Срыв обнуляет счётчик — переспрашиваем, случайный тап дорого стоит.
      await tg.answerCallback(query.id);
      await tg.editMessageText(
        chatId,
        messageId,
        `Сбросить счётчик по <b>${escapeHtml(habit.title)}</b>?\n\n` +
          `Сейчас на нём ${humanDuration(Math.max(0, Date.now() - Date.parse(habit.started_at)))}. ` +
          `Результат останется в рекорде, отсчёт начнётся заново.`,
        {
          reply_markup: keyboard([
            [{ text: '💔 Да, сорвался', callback_data: `hab:slipped:${habit.id}` }],
            [{ text: '◀️ Нет, держусь', callback_data: 'hab:list' }],
          ]),
        },
      );
      return;
    } else if (action === 'slipped' && habit.mode === 'quit') {
      await db.recordRelapse(env.DB, habit);
      await tg.answerCallback(query.id, 'Обнулил. Начинаем заново 💪');
    } else {
      await tg.answerCallback(query.id, 'Это действие не для этой привычки', true);
      return;
    }

    const screen = await habitsScreen(env, user, url);
    await tg.editMessageText(chatId, messageId, screen.text, { reply_markup: screen.reply_markup });
    return;
  }

  /* --- панель куратора --- */

  if (data.startsWith('adm:')) {
    if (!isCurator(env, from.id)) {
      await tg.answerCallback(query.id, 'Недостаточно прав', true);
      return;
    }
    let notificationsOn = (user.notifications ?? 1) === 1;
    if (data === 'adm:notify') {
      notificationsOn = !notificationsOn;
      await db.updateSettings(env.DB, user.id, { notifications: notificationsOn ? 1 : 0 });
      await tg.answerCallback(query.id, notificationsOn ? 'Уведомления включены 🔔' : 'Уведомления выключены 🔕');
    } else {
      await tg.answerCallback(query.id, 'Обновил 🔄');
    }
    await tg.editMessageText(chatId, messageId, await adminText(env, user.tz_offset), {
      reply_markup: adminKeyboard(notificationsOn, url),
    });
    return;
  }

  await tg.answerCallback(query.id);
}

/* ------------------------------------------------------------------ */
/* Точка входа                                                         */
/* ------------------------------------------------------------------ */

export async function handleUpdate(
  update: TgUpdate,
  env: Env,
  tg: Telegram,
  url: string,
): Promise<void> {
  try {
    if (update.callback_query) {
      await handleCallback(update.callback_query, env, tg, url);
      return;
    }
    if (update.message) {
      await handleMessage(update.message, env, tg, url);
    }
  } catch (error) {
    // Апдейт всё равно подтверждаем: иначе Telegram будет слать его по кругу.
    console.error('[bot] update failed:', (error as Error).message);
  }
}

/**
 * Cron: занятие, забытое открытым дольше 12 часов, закрывается само —
 * иначе оно навсегда останется «идёт» и испортит всю статистику.
 */
export async function closeStaleActivities(env: Env, tg: Telegram): Promise<number> {
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const stale = await db.staleActivities(env.DB, cutoff);

  for (const activity of stale) {
    // Закрываем задним числом, по последней отметке или через 12 часов после старта.
    const endedAt = new Date(Date.parse(activity.started_at) + 12 * 60 * 60 * 1000).toISOString();
    await db.stopActivity(env.DB, activity.id, endedAt);
    await tg.sendMessage(
      activity.user_id,
      `⏱ Занятие ${activityLabel(activity.kind)} висело открытым больше 12 часов — я закрыл его сам.\n` +
        `Если время неверное, поправь его в приложении.`,
    );
  }

  return stale.length;
}
