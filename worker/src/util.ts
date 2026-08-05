/** Идентификаторы и время. Ничего из Node — только то, что есть в Workers. */

const HEX = '0123456789abcdef';

export function newId(bytes = 8): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes));
  let out = '';
  for (const byte of raw) out += HEX[byte >> 4] + HEX[byte & 15];
  return out;
}

export const nowIso = (): string => new Date().toISOString();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** `1 ч 20 мин` / `45 мин` — так же, как считал питоновский бот. */
export function humanDuration(ms: number): string {
  const minutes = Math.max(0, Math.floor(ms / MINUTE));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} мин`;
  return m === 0 ? `${h} ч` : `${h} ч ${m} мин`;
}

/**
 * Часы:минуты в часовом поясе пользователя. Смещение хранится в минутах,
 * потому что в Workers нет tzdata, а у нас всего один-два пользователя.
 */
export function localClock(iso: string, tzOffsetMinutes: number): string {
  const shifted = new Date(Date.parse(iso) + tzOffsetMinutes * MINUTE);
  const hh = String(shifted.getUTCHours()).padStart(2, '0');
  const mm = String(shifted.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** `29.07 21:15` — для списков, где нужна и дата. */
export function localStamp(iso: string, tzOffsetMinutes: number): string {
  const shifted = new Date(Date.parse(iso) + tzOffsetMinutes * MINUTE);
  const dd = String(shifted.getUTCDate()).padStart(2, '0');
  const mo = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mo} ${localClock(iso, tzOffsetMinutes)}`;
}

/** Местная дата пользователя как `YYYY-MM-DD` — ключ дневной отметки. */
export function localDay(tzOffsetMinutes: number, at = Date.now()): string {
  return new Date(at + tzOffsetMinutes * MINUTE).toISOString().slice(0, 10);
}

/** Начало местных суток, возвращённое как UTC-ISO — граница для «сегодня». */
export function startOfLocalDay(tzOffsetMinutes: number, at = Date.now()): string {
  const shifted = at + tzOffsetMinutes * MINUTE;
  const midnight = Math.floor(shifted / DAY) * DAY;
  return new Date(midnight - tzOffsetMinutes * MINUTE).toISOString();
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Имя пользователя одной строкой, без пустых пробелов посередине. */
export function displayName(user: {
  first_name?: string;
  last_name?: string;
  username?: string;
}): string {
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (user.username) return `@${user.username}`;
  return 'Пользователь';
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export const clampNumber = (value: unknown, min: number, max: number, fallback = 0): number => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
};

/** ISO-строка или `null`, если пришёл мусор. Дата из будущего не пропускается. */
export function safeIso(value: unknown, allowFuture = false): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  if (!allowFuture && parsed > Date.now() + MINUTE) return null;
  return new Date(parsed).toISOString();
}
