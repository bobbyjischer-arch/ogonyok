import type { TranslationKey } from './i18n';
import type { Activity, ActivityType } from './types';

/**
 * Ключ типа занятия приходит с сервера, подпись живёт в словаре. Так один и
 * тот же `work` читается «Работа» и «Work» без единого текста в базе.
 */
const LABEL_KEYS: Record<string, TranslationKey> = {
  reading: 'actReading',
  sport: 'actSport',
  work: 'actWork',
  study: 'actStudy',
  creative: 'actCreative',
  cleaning: 'actCleaning',
  walk: 'actWalk',
  cooking: 'actCooking',
  other: 'actOther',
};

export const activityLabelKey = (kind: string): TranslationKey => LABEL_KEYS[kind] ?? 'actOther';

/** Эмодзи берём из ответа сервера, чтобы список типов правился в одном месте. */
export function emojiOf(types: ActivityType[], kind: string): string {
  return types.find((type) => type.key === kind)?.emoji ?? '🎯';
}

/** Длительность занятия; у незакрытого считается до текущего момента. */
export const durationOf = (activity: Activity, now: number): number =>
  Math.max(
    0,
    (activity.endedAt ? Date.parse(activity.endedAt) : now) - Date.parse(activity.startedAt),
  );

/** Сравнение по местным суткам устройства — так же, как их видит пользователь. */
export function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}
