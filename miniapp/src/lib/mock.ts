import type { ApiClient } from './api';
import type { Activity, CuratorState, HabitDraft, Settings, State } from './types';

/**
 * `?preview=1` — интерфейс в обычном браузере, без Telegram и без сервера.
 * Нужен ровно для того, чтобы гонять вёрстку локально: initData в браузере
 * взять неоткуда, а поднимать ради кнопки целый туннель — перебор.
 */

const ISO = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const id = () => Math.random().toString(16).slice(2, 10);

/** Дата N дней назад как `YYYY-MM-DD` — тот же формат, что шлёт сервер. */
const dayString = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * DAY).toISOString().slice(0, 10);

function seed(): State {
  return {
    user: {
      id: 1,
      firstName: 'Веруня',
      lastName: '',
      username: 'preview',
      photoUrl: '',
      createdAt: ISO(30 * DAY),
      role: 'curator',
      settings: {
        currency: 'RUB',
        language: 'ru',
        theme: 'auto',
        palette: 'system',
        tzOffset: 180,
        notifications: true,
      },
    },
    activities: [
      {
        id: id(),
        kind: 'work',
        note: '',
        startedAt: ISO(72 * MINUTE),
        endedAt: null,
        checkins: 2,
        source: 'bot',
      },
      {
        id: id(),
        kind: 'sport',
        note: '',
        startedAt: ISO(6 * HOUR),
        endedAt: ISO(5 * HOUR),
        checkins: 1,
        source: 'bot',
      },
      {
        id: id(),
        kind: 'reading',
        note: '',
        startedAt: ISO(26 * HOUR),
        endedAt: ISO(25 * HOUR),
        checkins: 0,
        source: 'miniapp',
      },
    ],
    current: null,
    habits: [
      {
        id: id(),
        title: 'Зарядка',
        icon: 'dumbbell',
        mode: 'build',
        daysMask: 127,
        startedAt: ISO(20 * DAY),
        createdAt: ISO(20 * DAY),
        costPerDay: 0,
        unitsPerDay: 0,
        unitLabel: '',
        bestStreakMs: 0,
        relapses: [],
        // Девять дней подряд, считая со вчера: огонёк горит, сегодня не отмечено.
        days: Array.from({ length: 9 }, (_, i) => dayString(i + 1)),
      },
      {
        id: id(),
        title: 'Чтение',
        icon: 'book',
        mode: 'build',
        daysMask: 0b0010101, // пн, ср, пт
        startedAt: ISO(30 * DAY),
        createdAt: ISO(30 * DAY),
        costPerDay: 0,
        unitsPerDay: 0,
        unitLabel: '',
        bestStreakMs: 0,
        relapses: [],
        days: [],
      },
      {
        id: id(),
        title: 'Курение',
        icon: 'wind',
        mode: 'quit',
        daysMask: 127,
        startedAt: ISO(12 * DAY + 4 * HOUR),
        createdAt: ISO(12 * DAY),
        costPerDay: 250,
        unitsPerDay: 15,
        unitLabel: 'сигарет',
        bestStreakMs: 21 * DAY,
        relapses: [{ at: ISO(12 * DAY + 4 * HOUR), lastedMs: 21 * DAY }],
        days: [],
      },
      {
        id: id(),
        title: 'Экраны ночью',
        icon: 'phone',
        mode: 'quit',
        daysMask: 127,
        startedAt: ISO(3 * DAY),
        createdAt: ISO(3 * DAY),
        costPerDay: 0,
        unitsPerDay: 0,
        unitLabel: '',
        bestStreakMs: 0,
        relapses: [],
        days: [],
      },
    ],
    sessions: [
      { id: id(), habitId: null, durationMs: 5 * MINUTE, completed: true, at: ISO(4 * HOUR) },
      { id: id(), habitId: null, durationMs: 2 * MINUTE, completed: false, at: ISO(2 * DAY) },
    ],
    types: [
      { key: 'reading', emoji: '📖' },
      { key: 'sport', emoji: '🏋️' },
      { key: 'work', emoji: '💻' },
      { key: 'study', emoji: '📚' },
      { key: 'creative', emoji: '🎨' },
      { key: 'cleaning', emoji: '🧹' },
      { key: 'walk', emoji: '🚶' },
      { key: 'cooking', emoji: '🍳' },
      { key: 'other', emoji: '🎯' },
    ],
    today: dayString(0),
    channelUrl: null,
    isPublic: new URLSearchParams(window.location.search).get('public') === '1',
    appName: 'Трекер занятий',
    serverTime: new Date().toISOString(),
  };
}

let state = seed();
// Первое занятие в сиде — открытое, на него и указываем.
state.current = state.activities[0];

const settle = (): Promise<State> =>
  new Promise((resolve) => setTimeout(() => resolve(structuredClone(state)), 120));

const findActivity = (activityId: string): Activity | undefined =>
  state.activities.find((activity) => activity.id === activityId);

export const mockClient: ApiClient = {
  load: settle,

  startActivity(kind) {
    if (state.current) {
      state.current.endedAt = new Date().toISOString();
      state.current = null;
    }
    const activity: Activity = {
      id: id(),
      kind,
      note: '',
      startedAt: new Date().toISOString(),
      endedAt: null,
      checkins: 0,
      source: 'miniapp',
    };
    state.activities = [activity, ...state.activities];
    state.current = activity;
    return settle();
  },

  stopActivity(activityId) {
    const activity = findActivity(activityId);
    if (activity) activity.endedAt = new Date().toISOString();
    if (state.current?.id === activityId) state.current = null;
    return settle();
  },

  checkin(activityId) {
    const activity = findActivity(activityId);
    if (activity) activity.checkins += 1;
    return settle();
  },

  patchActivity(activityId, patch) {
    const activity = findActivity(activityId);
    if (activity) {
      if (patch.kind) activity.kind = patch.kind;
      if (patch.note !== undefined) activity.note = patch.note;
      if (patch.startedAt) activity.startedAt = patch.startedAt;
      if (patch.endedAt !== undefined) activity.endedAt = patch.endedAt;
      state.current = activity.endedAt === null ? activity : state.current;
    }
    return settle();
  },

  deleteActivity(activityId) {
    state.activities = state.activities.filter((activity) => activity.id !== activityId);
    if (state.current?.id === activityId) state.current = null;
    return settle();
  },

  createHabit(draft: HabitDraft) {
    state.habits = [
      ...state.habits,
      {
        id: id(),
        createdAt: new Date().toISOString(),
        bestStreakMs: 0,
        relapses: [],
        days: [],
        ...draft,
      },
    ];
    return settle();
  },

  toggleDay(habitId, day) {
    state.habits = state.habits.map((habit) => {
      if (habit.id !== habitId) return habit;
      const has = habit.days.includes(day);
      return {
        ...habit,
        days: has ? habit.days.filter((d) => d !== day) : [...habit.days, day],
      };
    });
    return settle();
  },

  updateHabit(habitId, draft) {
    state.habits = state.habits.map((habit) =>
      habit.id === habitId ? { ...habit, ...draft } : habit,
    );
    return settle();
  },

  deleteHabit(habitId) {
    state.habits = state.habits.filter((habit) => habit.id !== habitId);
    return settle();
  },

  relapse(habitId) {
    const at = new Date().toISOString();
    state.habits = state.habits.map((habit) => {
      if (habit.id !== habitId) return habit;
      const lasted = Date.now() - Date.parse(habit.startedAt);
      return {
        ...habit,
        startedAt: at,
        bestStreakMs: Math.max(habit.bestStreakMs, lasted),
        relapses: [...habit.relapses, { at, lastedMs: lasted }],
      };
    });
    return settle();
  },

  addFocus(payload) {
    state.sessions = [
      { id: id(), at: new Date().toISOString(), ...payload },
      ...state.sessions,
    ];
    return settle();
  },

  updateSettings(patch: Partial<Settings>) {
    state.user = { ...state.user, settings: { ...state.user.settings, ...patch } };
    return settle();
  },

  curator(): Promise<CuratorState> {
    const withUser = (activity: Activity) => ({
      ...activity,
      user: { id: 1, name: 'Веруня', username: 'preview' },
    });
    return Promise.resolve({
      open: state.current ? [withUser(state.current)] : [],
      recent: state.activities.slice(0, 10).map(withUser),
      today: [{ userId: 1, name: 'Веруня', count: 2, totalMs: 2 * HOUR }],
      curatorId: 1,
      serverTime: new Date().toISOString(),
    });
  },
};
