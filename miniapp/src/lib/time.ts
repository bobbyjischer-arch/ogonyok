import { localeOf, pluralize, translate, type Lang, type TranslationKey } from './i18n';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface Parts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function split(ms: number): Parts {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / DAY),
    hours: Math.floor((total % DAY) / HOUR),
    minutes: Math.floor((total % HOUR) / MINUTE),
    seconds: Math.floor((total % MINUTE) / SECOND),
  };
}

export const pad = (n: number): string => String(n).padStart(2, '0');

/** `12д 04:31:07` — the dense form used on habit cards. */
export function formatStreak(ms: number, lang: Lang): string {
  const { days, hours, minutes, seconds } = split(ms);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}${translate(lang, 'dayShort')} ${clock}` : clock;
}

/** `4:03` — countdown form for the urge timer. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND));
  return `${Math.floor(total / 60)}:${pad(total % 60)}`;
}

/** Coarse, human phrasing: `3 месяца`, `12 дней`, `4 часа`. */
export function formatDuration(ms: number, lang: Lang): string {
  const total = Math.max(0, ms);
  if (total < MINUTE) return `${Math.floor(total / SECOND)} ${translate(lang, 'secShort')}`;
  if (total < HOUR) return pluralize(lang, Math.floor(total / MINUTE), 'minute');
  if (total < DAY) return pluralize(lang, Math.floor(total / HOUR), 'hour');
  const days = Math.floor(total / DAY);
  if (days < 31) return pluralize(lang, days, 'day');
  if (days < 365) return pluralize(lang, Math.floor(days / 30), 'month');
  return pluralize(lang, Math.floor(days / 365), 'year');
}

export function daysBetween(ms: number): number {
  return Math.max(0, ms) / DAY;
}

export function formatDate(iso: string, lang: Lang): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(localeOf(lang), {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

export function formatMoney(amount: number, currency: string, lang: Lang): string {
  const value = Math.max(0, amount);
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      style: 'currency',
      currency,
      maximumFractionDigits: value >= 100 ? 0 : 2,
    }).format(value);
  } catch {
    return `${value.toFixed(value >= 100 ? 0 : 2)} ${currency}`;
  }
}

export function compactNumber(value: number, lang: Lang): string {
  try {
    return new Intl.NumberFormat(localeOf(lang), {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return String(Math.round(value));
  }
}

/* --- Milestones --- */

export interface Milestone {
  key: TranslationKey;
  ms: number;
}

export const MILESTONES: Milestone[] = [
  { key: 'ms1h', ms: HOUR },
  { key: 'ms1d', ms: DAY },
  { key: 'ms3d', ms: 3 * DAY },
  { key: 'ms1w', ms: 7 * DAY },
  { key: 'ms2w', ms: 14 * DAY },
  { key: 'ms1mo', ms: 30 * DAY },
  { key: 'ms3mo', ms: 90 * DAY },
  { key: 'ms6mo', ms: 180 * DAY },
  { key: 'ms1y', ms: 365 * DAY },
];

export function milestoneProgress(elapsed: number): {
  previous: Milestone | null;
  next: Milestone | null;
  ratio: number;
  reached: number;
} {
  let previous: Milestone | null = null;
  let next: Milestone | null = null;
  let reached = 0;

  for (const milestone of MILESTONES) {
    if (elapsed >= milestone.ms) {
      previous = milestone;
      reached += 1;
    } else {
      next = milestone;
      break;
    }
  }

  if (!next) return { previous, next: null, ratio: 1, reached };

  const floor = previous?.ms ?? 0;
  const span = next.ms - floor;
  const ratio = span <= 0 ? 0 : Math.min(1, Math.max(0, (elapsed - floor) / span));
  return { previous, next, ratio, reached };
}

export { SECOND, MINUTE, HOUR, DAY };
