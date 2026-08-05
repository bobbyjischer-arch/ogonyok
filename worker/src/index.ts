/**
 * Единственная точка входа: вебхук бота, API мини-аппа и сам мини-апп живут
 * на одном origin. Поэтому кнопка web_app и запросы к /api идут туда же,
 * откуда отдана страница, и никакого CORS в проекте нет вообще.
 */

import { handleApi } from './api';
import { closeStaleActivities, handleUpdate } from './bot';
import { isPublic, type Env } from './env';
import { Telegram, type TgUpdate } from './tg';
import { json } from './util';

/** Меню команд у версий разное: привычки заводят из чата только в публичной. */
function botCommands(env: Env) {
  if (isPublic(env)) {
    return [
      { command: 'start', description: 'Главное меню' },
      { command: 'new', description: 'Новая привычка' },
      { command: 'habits', description: 'Мои привычки' },
      { command: 'app', description: 'Открыть приложение' },
      { command: 'cancel', description: 'Отменить ввод' },
    ];
  }
  return [
    { command: 'start', description: 'Выбрать занятие' },
    { command: 'list', description: 'Последние занятия' },
    { command: 'app', description: 'Открыть приложение' },
    { command: 'cancel', description: 'Отменить ввод отметки' },
  ];
}

/**
 * Разовая настройка после деплоя: ставит вебхук, команды и кнопку меню.
 * Закрыта тем же секретом, что и сам вебхук.
 */
async function handleSetup(request: Request, env: Env, origin: string): Promise<Response> {
  const secret = new URL(request.url).searchParams.get('secret') || '';
  if (!env.WEBHOOK_SECRET || secret !== env.WEBHOOK_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  const tg = new Telegram(env.BOT_TOKEN);
  const me = await tg.call<{ username: string; id: number }>('getMe');
  if (!me) return json({ error: 'bad_token', hint: 'wrangler secret put BOT_TOKEN' }, 502);

  const webhook = await tg.call('setWebhook', {
    url: `${origin}/tg/webhook`,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
    max_connections: 20,
  });
  await tg.setMyCommands(botCommands(env));
  // Без chat_id кнопка меню становится общей для всех личных чатов бота.
  await tg.call('setChatMenuButton', {
    menu_button: { type: 'web_app', text: 'Приложение', web_app: { url: `${origin}/` } },
  });
  const info = await tg.call('getWebhookInfo');

  return json({ ok: Boolean(webhook), bot: `@${me.username}`, app: `${origin}/`, webhook: info });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/healthz') {
      return new Response('ok', {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
      });
    }

    if (path === '/setup') {
      return handleSetup(request, env, url.origin);
    }

    if (path === '/tg/webhook') {
      if (request.method !== 'POST') return new Response('method not allowed', { status: 405 });
      // Секретный заголовок отсекает чужие POST'ы: адрес вебхука угадать можно,
      // заголовок — нет.
      if (request.headers.get('x-telegram-bot-api-secret-token') !== env.WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 });
      }

      let update: TgUpdate | null = null;
      try {
        update = (await request.json()) as TgUpdate;
      } catch {
        return new Response('ok');
      }
      if (!update) return new Response('ok');

      // 200 уходит сразу, работа доделывается фоном: Telegram не ждёт наши
      // походы в Bot API и не шлёт апдейт повторно.
      const tg = new Telegram(env.BOT_TOKEN);
      ctx.waitUntil(handleUpdate(update, env, tg, `${url.origin}/`));
      return new Response('ok');
    }

    if (path === '/api' || path.startsWith('/api/')) {
      return handleApi(request, env, path);
    }

    // Всё остальное — собранный мини-апп; неизвестные пути отдают index.html.
    return env.ASSETS.fetch(request);
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const tg = new Telegram(env.BOT_TOKEN);
    ctx.waitUntil(
      closeStaleActivities(env, tg).then((count) => {
        if (count > 0) console.log(`[cron] closed ${count} stale activities`);
      }),
    );
  },
};
