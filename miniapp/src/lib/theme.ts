/**
 * Палитры и их применение. Модуль намеренно чистый — никаких обращений к SDK
 * Telegram, только данные и запись CSS-переменных. Оркестрация (что сейчас
 * выбрано, тёмная ли тема у клиента) живёт в `telegram.ts`, иначе получился бы
 * цикл импортов.
 *
 * Значения токенов — тройки «r g b», потому что тема раздаётся через
 * `rgb(var(--c-x) / <alpha>)` и модификаторы прозрачности должны работать.
 */

export type ThemeMode = 'auto' | 'light' | 'dark';
export type PaletteId = 'system' | 'warm' | 'telegram';

export interface Appearance {
  mode: ThemeMode;
  palette: PaletteId;
}

export const DEFAULT_APPEARANCE: Appearance = { mode: 'auto', palette: 'system' };

export interface Tokens {
  bg: string;
  surface: string;
  raised: string;
  ink: string;
  dim: string;
  faint: string;
  line: string;
  accent: string;
  positive: string;
  danger: string;
  lineAlpha: number;
  glassBar: string;
  glassBarAlpha: number;
  glassPill: string;
  glassPillAlpha: number;
  glassCard: string;
  glassCardAlpha: number;
}

const SYSTEM_LIGHT: Tokens = {
  bg: '255 255 255',
  surface: '246 246 248',
  raised: '255 255 255',
  ink: '10 10 11',
  dim: '138 138 142',
  faint: '176 176 181',
  line: '0 0 0',
  accent: '0 122 255',
  positive: '40 174 88',
  danger: '232 58 48',
  lineAlpha: 0.08,
  glassBar: '255 255 255',
  glassBarAlpha: 0.72,
  glassPill: '255 255 255',
  glassPillAlpha: 0.9,
  glassCard: '255 255 255',
  glassCardAlpha: 0.55,
};

const SYSTEM_DARK: Tokens = {
  bg: '0 0 0',
  surface: '20 20 22',
  raised: '28 28 31',
  ink: '255 255 255',
  dim: '138 138 142',
  faint: '104 104 110',
  line: '255 255 255',
  accent: '10 132 255',
  positive: '48 209 88',
  danger: '255 69 58',
  lineAlpha: 0.1,
  glassBar: '22 22 24',
  glassBarAlpha: 0.72,
  glassPill: '255 255 255',
  glassPillAlpha: 0.14,
  glassCard: '255 255 255',
  glassCardAlpha: 0.08,
};

/** Тёплая: песок и терракота днём, обожжённое дерево ночью. */
const WARM_LIGHT: Tokens = {
  bg: '253 249 243',
  surface: '246 238 227',
  raised: '255 252 247',
  ink: '40 30 22',
  dim: '141 121 101',
  faint: '184 164 141',
  line: '74 52 34',
  accent: '198 108 46',
  positive: '106 138 74',
  danger: '194 70 54',
  lineAlpha: 0.1,
  glassBar: '253 249 243',
  glassBarAlpha: 0.74,
  glassPill: '255 252 247',
  glassPillAlpha: 0.92,
  glassCard: '255 252 247',
  glassCardAlpha: 0.6,
};

const WARM_DARK: Tokens = {
  bg: '22 17 14',
  surface: '35 27 22',
  raised: '45 35 28',
  ink: '246 237 226',
  dim: '168 148 128',
  faint: '122 105 90',
  line: '255 238 219',
  accent: '232 142 78',
  positive: '128 170 96',
  danger: '235 108 88',
  lineAlpha: 0.12,
  glassBar: '30 23 19',
  glassBarAlpha: 0.76,
  glassPill: '255 238 219',
  glassPillAlpha: 0.14,
  glassCard: '255 238 219',
  glassCardAlpha: 0.08,
};

export interface PaletteMeta {
  id: PaletteId;
  /** Ключ подписи в словаре i18n. */
  labelKey: 'paletteSystem' | 'paletteWarm' | 'paletteTelegram';
  /** Две точки для превью в списке: фон и акцент. */
  swatch: (dark: boolean) => [string, string];
}

export const PALETTES: PaletteMeta[] = [
  {
    id: 'system',
    labelKey: 'paletteSystem',
    swatch: (dark) => (dark ? ['#000000', '#0a84ff'] : ['#ffffff', '#007aff']),
  },
  {
    id: 'warm',
    labelKey: 'paletteWarm',
    swatch: (dark) => (dark ? ['#16110e', '#e88e4e'] : ['#fdf9f3', '#c66c2e']),
  },
  {
    id: 'telegram',
    labelKey: 'paletteTelegram',
    swatch: (dark) => (dark ? ['#17212b', '#5288c1'] : ['#ffffff', '#3390ec']),
  },
];

/* ------------------------------------------------------------------ */
/* Цвета Telegram                                                      */
/* ------------------------------------------------------------------ */

/** `#rrggbb` или `#rgb` → «r g b». Мусор превращается в null. */
export function hexToTriplet(hex: unknown): string | null {
  if (typeof hex !== 'string') return null;
  const value = hex.trim().replace(/^#/, '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const int = Number.parseInt(full, 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

export function tripletToHex(triplet: string): string {
  const parts = triplet.split(/\s+/).map((part) => Number(part) & 255);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return '#000000';
  return `#${parts.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

/** Сырые themeParams клиента: ключи в snake_case, значения — hex. */
export type TelegramParams = Record<string, unknown>;

/**
 * Тема Telegram как палитра: приложение выглядит так же, как чат, из которого
 * его открыли, включая пользовательские темы. Чего клиент не дал — берём из
 * системной палитры, чтобы не остаться без цвета.
 */
function telegramTokens(dark: boolean, params: TelegramParams): Tokens {
  const base = dark ? SYSTEM_DARK : SYSTEM_LIGHT;
  const pick = (...keys: string[]): string | null => {
    for (const key of keys) {
      const triplet = hexToTriplet(params[key]);
      if (triplet) return triplet;
    }
    return null;
  };

  const bg = pick('bg_color') ?? base.bg;
  const surface = pick('secondary_bg_color', 'section_bg_color') ?? base.surface;
  const ink = pick('text_color') ?? base.ink;

  return {
    bg,
    surface,
    raised: pick('section_bg_color', 'bg_color') ?? base.raised,
    ink,
    dim: pick('subtitle_text_color', 'hint_color') ?? base.dim,
    faint: pick('hint_color', 'subtitle_text_color') ?? base.faint,
    line: ink,
    accent: pick('button_color', 'link_color', 'accent_text_color') ?? base.accent,
    positive: base.positive,
    danger: pick('destructive_text_color') ?? base.danger,
    lineAlpha: base.lineAlpha,
    glassBar: pick('header_bg_color', 'bg_color') ?? base.glassBar,
    glassBarAlpha: base.glassBarAlpha,
    glassPill: dark ? ink : bg,
    glassPillAlpha: base.glassPillAlpha,
    glassCard: dark ? ink : bg,
    glassCardAlpha: base.glassCardAlpha,
  };
}

export function tokensFor(palette: PaletteId, dark: boolean, params: TelegramParams): Tokens {
  if (palette === 'warm') return dark ? WARM_DARK : WARM_LIGHT;
  if (palette === 'telegram') return telegramTokens(dark, params);
  return dark ? SYSTEM_DARK : SYSTEM_LIGHT;
}

/* ------------------------------------------------------------------ */
/* Применение                                                          */
/* ------------------------------------------------------------------ */

/**
 * Переменные ставятся инлайном на <html>: так они перебивают и `:root`, и
 * `:root.dark` из CSS, а первая отрисовка всё равно успевает пройти по
 * дефолтам из таблицы стилей — без вспышки чужого цвета.
 */
export function applyTokens(tokens: Tokens, dark: boolean): void {
  const root = document.documentElement;
  root.classList.toggle('dark', dark);

  const vars: Record<string, string> = {
    '--c-bg': tokens.bg,
    '--c-surface': tokens.surface,
    '--c-raised': tokens.raised,
    '--c-ink': tokens.ink,
    '--c-dim': tokens.dim,
    '--c-faint': tokens.faint,
    '--c-line': tokens.line,
    '--c-accent': tokens.accent,
    '--c-positive': tokens.positive,
    '--c-danger': tokens.danger,
    '--line-alpha': String(tokens.lineAlpha),
    '--glass-bar': tokens.glassBar,
    '--glass-bar-alpha': String(tokens.glassBarAlpha),
    '--glass-pill': tokens.glassPill,
    '--glass-pill-alpha': String(tokens.glassPillAlpha),
    '--glass-card': tokens.glassCard,
    '--glass-card-alpha': String(tokens.glassCardAlpha),
  };

  for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export const asThemeMode = (value: unknown): ThemeMode =>
  value === 'light' || value === 'dark' ? value : 'auto';

export const asPaletteId = (value: unknown): PaletteId =>
  value === 'warm' || value === 'telegram' ? value : 'system';
