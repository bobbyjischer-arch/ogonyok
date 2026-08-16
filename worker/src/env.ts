export interface Env {
  /** База D1. Привязка объявлена в wrangler.toml. */
  DB: D1Database;
  /** Собранный мини-апп, отдаётся как статика. */
  ASSETS: Fetcher;

  /* --- секреты: wrangler secret put --- */
  BOT_TOKEN: string;
  /** Совпадает с secret_token у setWebhook; чужой POST на вебхук отсекается. */
  WEBHOOK_SECRET: string;

  /* --- переменные из [vars] --- */
  CURATOR_ID: string;
  ALLOWED_USERS: string;
  CHANNEL_URL: string;
  /** '1' — публичная версия: открыта всем и не дёргает куратора. */
  PUBLIC_MODE?: string;
  APP_NAME?: string;
}

/**
 * Версия мини-аппа для сброса кеша вебвью Telegram: вебвью игнорирует
 * revalidation и держит старый index.html, а смена query (`/?v=N`) принудительно
 * ведёт на свежую копию. Поднимается на каждый релиз мини-аппа.
 */
export const APP_VERSION = 2;

/** URL мини-аппа с версией: его получают кнопка меню и web_app-кнопки в чатах. */
export const appUrl = (origin: string): string => `${origin}/?v=${APP_VERSION}`;

/**
 * В публичной версии бот открыт всем, поэтому отметки и уведомления куратору
 * не уходят: иначе его личный чат завалило бы кружками незнакомых людей.
 * Панель и /admin у куратора при этом остаются.
 */
export const isPublic = (env: Env): boolean => env.PUBLIC_MODE === '1';

export const appName = (env: Env): string => env.APP_NAME || 'Трекер занятий';

/** Разбор списка из [vars]. Пустой список означает «открыто всем». */
export function allowedUsers(env: Env): number[] {
  return (env.ALLOWED_USERS || '')
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/**
 * Куратор проверяется отдельно, а не подмешивается в список: иначе список
 * никогда не был бы пустым и публичная версия не открылась бы никому.
 */
export function isAllowed(env: Env, userId: number): boolean {
  const listed = allowedUsers(env);
  if (listed.length === 0) return true;
  return listed.includes(userId) || isCurator(env, userId);
}

export function curatorId(env: Env): number {
  const id = Number(env.CURATOR_ID);
  return Number.isFinite(id) && id > 0 ? id : 0;
}

export const isCurator = (env: Env, userId: number): boolean => curatorId(env) === userId;
