/* Формы данных ровно те, что отдаёт воркер: снимок состояния приходит целиком. */

import type { PaletteId, ThemeMode } from './theme';

export type { PaletteId, ThemeMode };

export type Role = 'user' | 'curator';

export interface Settings {
  currency: string;
  language: string;
  theme: ThemeMode;
  palette: PaletteId;
  /** Минуты от UTC — по ним бот считает границы «сегодня». */
  tzOffset: number;
  notifications: boolean;
}

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  photoUrl: string;
  createdAt: string;
  role: Role;
  settings: Settings;
}

/* --- Занятия --- */

export interface Activity {
  id: string;
  /** Ключ типа: work, sport, reading… Подпись берётся из i18n. */
  kind: string;
  note: string;
  startedAt: string;
  /** null = занятие идёт прямо сейчас. */
  endedAt: string | null;
  checkins: number;
  source: string;
}

export interface ActivityType {
  key: string;
  emoji: string;
}

export interface ActivityPatch {
  kind?: string;
  note?: string;
  startedAt?: string;
  endedAt?: string | null;
}

/* --- Привычки --- */

export interface Relapse {
  at: string;
  lastedMs: number;
}

/** 'quit' — отказ от вредного, 'build' — поддержание полезного. */
export type HabitMode = 'quit' | 'build';

export interface Habit {
  id: string;
  title: string;
  icon: string;
  mode: HabitMode;
  /** Битовая маска дней недели: бит 0 — понедельник, бит 6 — воскресенье. */
  daysMask: number;
  startedAt: string;
  createdAt: string;
  costPerDay: number;
  unitsPerDay: number;
  unitLabel: string;
  bestStreakMs: number;
  relapses: Relapse[];
  /** Дни `YYYY-MM-DD`, в которые привычка отмечена. Только для режима build. */
  days: string[];
}

export interface HabitDraft {
  title: string;
  icon: string;
  mode: HabitMode;
  daysMask: number;
  startedAt: string;
  costPerDay: number;
  unitsPerDay: number;
  unitLabel: string;
}

/** Сессия фокус-таймера. */
export interface Session {
  id: string;
  habitId: string | null;
  durationMs: number;
  completed: boolean;
  at: string;
}

/* --- Снимок --- */

export interface State {
  user: User;
  activities: Activity[];
  current: Activity | null;
  habits: Habit[];
  sessions: Session[];
  types: ActivityType[];
  /** Местная дата пользователя по данным сервера — якорь для всех серий. */
  today: string;
  channelUrl: string | null;
  /** Публичная версия: открыта всем, без питомца и без отчётов куратору. */
  isPublic: boolean;
  appName: string;
  serverTime: string;
}

/* --- Панель куратора --- */

export interface CuratorOpen extends Activity {
  user: { id: number; name: string; username: string };
}

export interface CuratorDay {
  userId: number;
  name: string;
  count: number;
  totalMs: number;
}

export interface CuratorState {
  open: CuratorOpen[];
  /** Лента последних событий всех пользователей — её куратор и правит. */
  recent: CuratorOpen[];
  today: CuratorDay[];
  curatorId: number;
  serverTime: string;
}
