/**
 * Типы занятий. Ключ стабильный и лежит в базе; эмодзи и русская подпись
 * используются ботом, мини-апп берёт свои подписи из i18n по тому же ключу.
 */

export interface ActivityType {
  key: string;
  emoji: string;
  ru: string;
}

export const ACTIVITY_TYPES: ActivityType[] = [
  { key: 'reading', emoji: '📖', ru: 'Чтение' },
  { key: 'sport', emoji: '🏋️', ru: 'Спорт' },
  { key: 'work', emoji: '💻', ru: 'Работа' },
  { key: 'study', emoji: '📚', ru: 'Учёба' },
  { key: 'creative', emoji: '🎨', ru: 'Творчество' },
  { key: 'cleaning', emoji: '🧹', ru: 'Уборка' },
  { key: 'walk', emoji: '🚶', ru: 'Прогулка' },
  { key: 'cooking', emoji: '🍳', ru: 'Готовка' },
  { key: 'other', emoji: '🎯', ru: 'Другое' },
];

const BY_KEY = new Map(ACTIVITY_TYPES.map((type) => [type.key, type]));

export const isActivityKind = (key: unknown): key is string =>
  typeof key === 'string' && BY_KEY.has(key);

export function activityLabel(key: string): string {
  const type = BY_KEY.get(key);
  return type ? `${type.emoji} ${type.ru}` : '🎯 Занятие';
}

export function activityEmoji(key: string): string {
  return BY_KEY.get(key)?.emoji ?? '🎯';
}
