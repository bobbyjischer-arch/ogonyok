import {
  backButton,
  hapticFeedback,
  init,
  isTMA,
  miniApp,
  retrieveRawInitData,
  swipeBehavior,
  themeParams,
  viewport,
} from '@telegram-apps/sdk';
import {
  DEFAULT_APPEARANCE,
  applyTokens,
  asPaletteId,
  asThemeMode,
  tokensFor,
  tripletToHex,
  type Appearance,
  type TelegramParams,
} from './theme';

/**
 * Every SDK call is guarded: a method that the running Telegram client does
 * not support throws rather than no-ops, and we would rather lose a haptic tap
 * than white-screen the app.
 */
function attempt<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

export const inTelegram = (): boolean => attempt(() => isTMA()) === true;

/** Explicit opt-in preview so the UI can be opened in a plain browser. */
export const isPreview = (): boolean =>
  new URLSearchParams(window.location.search).get('preview') === '1';

let rawInitData = '';

/**
 * The raw, signed initData string. Resolved lazily and re-checked while empty:
 * capturing it once at boot loses the value on any client where the SDK's
 * launch-param parse comes up short, and then every API call 401s forever.
 */
export function getInitData(): string {
  if (rawInitData) return rawInitData;

  const fromSdk = attempt(() => retrieveRawInitData());
  if (typeof fromSdk === 'string' && fromSdk.length > 0) {
    rawInitData = fromSdk;
    return rawInitData;
  }

  // window.Telegram.WebApp.initData is the canonical raw string and is always
  // populated inside a real client, whatever the SDK made of the launch params.
  const legacy = (window as any)?.Telegram?.WebApp?.initData;
  if (typeof legacy === 'string' && legacy.length > 0) {
    rawInitData = legacy;
    return rawInitData;
  }

  return '';
}

function applyInsets(): void {
  const root = document.documentElement;
  const top = attempt(() => viewport.safeAreaInsetTop()) ?? 0;
  const bottom = attempt(() => viewport.safeAreaInsetBottom()) ?? 0;
  const contentTop = attempt(() => viewport.contentSafeAreaInsetTop()) ?? 0;
  const contentBottom = attempt(() => viewport.contentSafeAreaInsetBottom()) ?? 0;

  root.style.setProperty('--safe-top', `${top + contentTop}px`);
  root.style.setProperty('--safe-bottom', `${Math.max(bottom + contentBottom, 0)}px`);
}

export function isDarkTheme(): boolean {
  // telegram-web-app.js is present even in a plain browser and reports a
  // hardcoded light scheme, so only trust it when we are really in Telegram.
  if (inTelegram()) {
    const fromSdk = attempt(() => miniApp.isDark());
    if (typeof fromSdk === 'boolean') return fromSdk;
    const scheme = (window as any)?.Telegram?.WebApp?.colorScheme;
    if (scheme === 'dark' || scheme === 'light') return scheme === 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/* --- Оформление --- */

const APPEARANCE_KEY = 'tracker.appearance';

/**
 * Выбор дублируется в localStorage: настройки с сервера приезжают уже после
 * первой отрисовки, и без локальной копии приложение мигало бы чужой палитрой.
 */
function readStoredAppearance(): Appearance {
  try {
    const raw = window.localStorage.getItem(APPEARANCE_KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = JSON.parse(raw) as Partial<Appearance>;
    return { mode: asThemeMode(parsed.mode), palette: asPaletteId(parsed.palette) };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

let appearance: Appearance = readStoredAppearance();

export const getAppearance = (): Appearance => appearance;

/** Сырые themeParams клиента: snake_case и hex — как их отдаёт Telegram. */
function telegramParams(): TelegramParams {
  const raw = (window as any)?.Telegram?.WebApp?.themeParams;
  return raw && typeof raw === 'object' ? (raw as TelegramParams) : {};
}

function applyTheme(): void {
  const dark = appearance.mode === 'auto' ? isDarkTheme() : appearance.mode === 'dark';
  const tokens = tokensFor(appearance.palette, dark, telegramParams());
  applyTokens(tokens, dark);

  // Родной хром подгоняем под фон страницы, чтобы сверху не было шва.
  const hex = tripletToHex(tokens.bg) as `#${string}`;
  attempt(() => miniApp.setHeaderColor(hex));
  attempt(() => miniApp.setBackgroundColor(hex));
  attempt(() => miniApp.setBottomBarColor(hex));
}

export function setAppearance(next: Partial<Appearance>): void {
  appearance = {
    mode: asThemeMode(next.mode ?? appearance.mode),
    palette: asPaletteId(next.palette ?? appearance.palette),
  };
  try {
    window.localStorage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
  } catch {
    /* приватный режим — переживём без запоминания */
  }
  applyTheme();
}

/**
 * Everything that must happen before the first paint, and nothing that can
 * block it. No awaits live here on purpose: an unanswered request from the
 * Telegram client must never be able to stop React from mounting.
 */
export function setupTelegramSync(): void {
  applyTheme();

  if (!inTelegram()) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
    return;
  }

  attempt(() => init());

  // themeParams first: miniApp reads its colours when it mounts.
  attempt(() => themeParams.mountSync());
  attempt(() => miniApp.mountSync());
  attempt(() => backButton.mount());
  attempt(() => swipeBehavior.mount());
  // Stops a downward scroll gesture from dismissing the app mid-list.
  attempt(() => swipeBehavior.disableVertical());

  getInitData();

  applyTheme();
  attempt(() => themeParams.isDark.sub(applyTheme));
  attempt(() => miniApp.isDark.sub(applyTheme));

  // Dismiss Telegram's own splash as early as we can.
  attempt(() => miniApp.ready());
}

/** Viewport sizing. Runs after the first paint; failure only costs insets. */
export async function setupTelegramAsync(): Promise<void> {
  if (!inTelegram()) return;

  const mounting = attempt(() => viewport.mount());
  if (mounting && typeof (mounting as Promise<void>).then === 'function') {
    // Some clients never answer the viewport request; give up after a beat.
    await Promise.race([
      (mounting as Promise<void>).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
  }

  attempt(() => viewport.expand());
  applyInsets();
  attempt(() => viewport.safeAreaInsets.sub(applyInsets));
  attempt(() => viewport.contentSafeAreaInsets.sub(applyInsets));
}

/* --- Back button --- */

export function showBackButton(handler: () => void): () => void {
  const off = attempt(() => backButton.onClick(handler));
  attempt(() => backButton.show());
  return () => {
    attempt(() => backButton.hide());
    if (typeof off === 'function') off();
    else attempt(() => backButton.offClick(handler));
  };
}

export function hideBackButton(): void {
  attempt(() => backButton.hide());
}

/* --- Haptics --- */

type Impact = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type Notify = 'error' | 'success' | 'warning';

export const haptic = {
  impact(style: Impact = 'light') {
    attempt(() => hapticFeedback.impactOccurred(style));
  },
  notify(type: Notify) {
    attempt(() => hapticFeedback.notificationOccurred(type));
  },
  select() {
    attempt(() => hapticFeedback.selectionChanged());
  },
};

export function openLink(url: string): void {
  const webApp = (window as any)?.Telegram?.WebApp;
  if (webApp?.openTelegramLink && /^https:\/\/t\.me\//.test(url)) {
    webApp.openTelegramLink(url);
    return;
  }
  if (webApp?.openLink) {
    webApp.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function closeApp(): void {
  attempt(() => miniApp.close());
}
