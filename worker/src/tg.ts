/**
 * Тонкий клиент Bot API поверх fetch. Библиотека здесь не нужна: методов
 * используется десяток, а на free-тарифе каждый лишний килобайт бандла и
 * каждая миллисекунда CPU на разбор апдейта — не бесплатны.
 */

export interface TgFrom {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TgMessage {
  message_id: number;
  from?: TgFrom;
  chat: { id: number; type: string };
  date: number;
  text?: string;
  caption?: string;
  reply_to_message?: TgMessage;
  photo?: { file_id: string }[];
  voice?: { file_id: string };
  video_note?: { file_id: string };
  video?: { file_id: string };
  audio?: { file_id: string };
  document?: { file_id: string };
  sticker?: { file_id: string };
  animation?: { file_id: string };
  location?: { latitude: number; longitude: number };
}

export interface TgCallbackQuery {
  id: string;
  from: TgFrom;
  message?: TgMessage;
  data?: string;
}

export interface TgUpdate {
  update_id: number;
  message?: TgMessage;
  edited_message?: TgMessage;
  callback_query?: TgCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
  web_app?: { url: string };
}

export type InlineKeyboard = InlineButton[][];

export const keyboard = (rows: InlineKeyboard) => ({ inline_keyboard: rows });

/** Тип вложения и его file_id — одним проходом, без девяти проверок на месте. */
export function describeMedia(message: TgMessage): { kind: string; fileId: string | null } {
  if (message.photo?.length) {
    return { kind: 'photo', fileId: message.photo[message.photo.length - 1].file_id };
  }
  if (message.voice) return { kind: 'voice', fileId: message.voice.file_id };
  if (message.video_note) return { kind: 'video_note', fileId: message.video_note.file_id };
  if (message.video) return { kind: 'video', fileId: message.video.file_id };
  if (message.audio) return { kind: 'audio', fileId: message.audio.file_id };
  if (message.document) return { kind: 'document', fileId: message.document.file_id };
  if (message.sticker) return { kind: 'sticker', fileId: message.sticker.file_id };
  if (message.animation) return { kind: 'animation', fileId: message.animation.file_id };
  if (message.location) return { kind: 'location', fileId: null };
  if (message.text) return { kind: 'text', fileId: null };
  return { kind: 'unknown', fileId: null };
}

export const MEDIA_ICONS: Record<string, string> = {
  text: '💬',
  voice: '🎤',
  video_note: '🔄',
  photo: '📸',
  video: '🎬',
  document: '📄',
  audio: '🎵',
  sticker: '🎭',
  animation: '🎞',
  location: '📍',
  unknown: '📨',
};

export class Telegram {
  constructor(private readonly token: string) {}

  /**
   * Ошибка Bot API возвращается как null, а не бросается: вебхук обязан
   * ответить 200, иначе Telegram будет повторять апдейт по кругу.
   */
  async call<T = unknown>(method: string, payload?: Record<string, unknown>): Promise<T | null> {
    try {
      const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload ?? {}),
      });
      const body = (await response.json()) as { ok: boolean; result?: T; description?: string };
      if (!body.ok) {
        console.error(`[tg] ${method} failed: ${body.description ?? 'unknown error'}`);
        return null;
      }
      return body.result ?? null;
    } catch (error) {
      console.error(`[tg] ${method} threw:`, (error as Error).message);
      return null;
    }
  }

  sendMessage(chatId: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call<TgMessage>('sendMessage', {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...extra,
    });
  }

  editMessageText(chatId: number, messageId: number, text: string, extra: Record<string, unknown> = {}) {
    return this.call<TgMessage>('editMessageText', {
      chat_id: chatId,
      message_id: messageId,
      text,
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      ...extra,
    });
  }

  editReplyMarkup(chatId: number, messageId: number, replyMarkup: unknown) {
    return this.call('editMessageReplyMarkup', {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: replyMarkup,
    });
  }

  answerCallback(id: string, text?: string, showAlert = false) {
    return this.call('answerCallbackQuery', {
      callback_query_id: id,
      ...(text ? { text } : {}),
      ...(showAlert ? { show_alert: true } : {}),
    });
  }

  /** Копия вместо пересылки: у куратора не висит «переслано от», и работает для всех типов. */
  copyMessage(toChatId: number, fromChatId: number, messageId: number, extra: Record<string, unknown> = {}) {
    return this.call<{ message_id: number }>('copyMessage', {
      chat_id: toChatId,
      from_chat_id: fromChatId,
      message_id: messageId,
      ...extra,
    });
  }

  setChatMenuButton(chatId: number, url: string) {
    return this.call('setChatMenuButton', {
      chat_id: chatId,
      menu_button: { type: 'web_app', text: 'Приложение', web_app: { url } },
    });
  }

  setMyCommands(commands: { command: string; description: string }[]) {
    return this.call('setMyCommands', { commands });
  }
}
