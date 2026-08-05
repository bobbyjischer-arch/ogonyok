/**
 * Серии полезных привычек. Общий файл для мини-аппа и воркера: бот показывает
 * тот же огонёк, что и приложение, а держать одну и ту же логику в двух местах —
 * верный способ получить два разных ответа.
 *
 * Даты — строки `YYYY-MM-DD`, они сравниваются лексикографически и не зависят
 * от часового пояса устройства. Разбор идёт через полдень UTC, чтобы переход
 * на летнее время не сдвинул день.
 *
 * Ни браузерных, ни воркерных API здесь нет — только Date, иначе файл не
 * получилось бы делить.
 */

const DAY_MS = 86_400_000;
/** Потолок обхода: защита от зацикливания, а не продуктовое ограничение. */
const MAX_WALK = 3650;

const parseDay = (day: string): number => Date.parse(`${day}T12:00:00Z`);
const formatDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

export const shiftDay = (day: string, delta: number): string =>
  formatDay(parseDay(day) + delta * DAY_MS);

/** 0 — понедельник, 6 — воскресенье: так же, как разложены биты маски. */
export const weekdayOf = (day: string): number => (new Date(parseDay(day)).getUTCDay() + 6) % 7;

export const isScheduled = (mask: number, day: string): boolean =>
  (mask & (1 << weekdayOf(day))) !== 0;

export const EVERY_DAY = 127;

/**
 * Структурный минимум вместо типа Habit из мини-аппа: у воркера свои строки
 * базы, и тащить сюда клиентские типы значило бы связать их намертво.
 */
export interface StreakSource {
  days: string[];
  daysMask: number;
}

export interface StreakInfo {
  /** Текущая серия в запланированных днях подряд. */
  current: number;
  /** Самая длинная серия за всю историю. */
  best: number;
  doneToday: boolean;
  /** Запланирована ли привычка на сегодня. */
  scheduledToday: boolean;
  total: number;
  /** Сколько запланированных дней из последних 30 закрыто. */
  last30: { done: number; planned: number };
}

export interface DayCell {
  day: string;
  done: boolean;
  scheduled: boolean;
  isToday: boolean;
}

export function streakOf(habit: StreakSource, today: string): StreakInfo {
  const done = new Set(habit.days);
  const mask = habit.daysMask || EVERY_DAY;

  /* --- текущая серия --- */

  // Сегодняшний день ещё не закончился: пока он не отмечен, серия считается
  // со вчера, иначе огонёк гас бы каждое утро.
  let cursor = isScheduled(mask, today) && !done.has(today) ? shiftDay(today, -1) : today;
  let current = 0;
  for (let i = 0; i < MAX_WALK; i += 1) {
    if (isScheduled(mask, cursor)) {
      if (!done.has(cursor)) break;
      current += 1;
    }
    cursor = shiftDay(cursor, -1);
  }

  /* --- рекорд --- */

  let best = current;
  if (done.size > 0) {
    const earliest = [...done].sort()[0];
    let run = 0;
    let walker = earliest;
    for (let i = 0; i < MAX_WALK && walker <= today; i += 1) {
      if (isScheduled(mask, walker)) {
        if (done.has(walker)) {
          run += 1;
          if (run > best) best = run;
        } else {
          run = 0;
        }
      }
      walker = shiftDay(walker, 1);
    }
  }

  /* --- последние 30 дней --- */

  let doneCount = 0;
  let planned = 0;
  for (let i = 0; i < 30; i += 1) {
    const day = shiftDay(today, -i);
    if (!isScheduled(mask, day)) continue;
    planned += 1;
    if (done.has(day)) doneCount += 1;
  }

  return {
    current,
    best,
    doneToday: done.has(today),
    scheduledToday: isScheduled(mask, today),
    total: done.size,
    last30: { done: doneCount, planned },
  };
}

/** Последние `count` дней в хронологическом порядке — для точек и сетки. */
export function recentDays(habit: StreakSource, today: string, count: number): DayCell[] {
  const done = new Set(habit.days);
  const mask = habit.daysMask || EVERY_DAY;
  const cells: DayCell[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const day = shiftDay(today, -i);
    cells.push({
      day,
      done: done.has(day),
      scheduled: isScheduled(mask, day),
      isToday: day === today,
    });
  }
  return cells;
}

/** Текущая неделя с понедельника по воскресенье — строка точек на карточке. */
export function currentWeek(habit: StreakSource, today: string): DayCell[] {
  const done = new Set(habit.days);
  const mask = habit.daysMask || EVERY_DAY;
  const monday = shiftDay(today, -weekdayOf(today));
  return Array.from({ length: 7 }, (_, index) => {
    const day = shiftDay(monday, index);
    return {
      day,
      done: done.has(day),
      scheduled: isScheduled(mask, day),
      isToday: day === today,
    };
  });
}

export const toggleBit = (mask: number, weekday: number): number => mask ^ (1 << weekday);
