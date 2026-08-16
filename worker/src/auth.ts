/**
 * Проверка Telegram initData на WebCrypto.
 *
 *   secret = HMAC_SHA256(key: "WebAppData", data: botToken)
 *   hash   = HMAC_SHA256(key: secret,       data: dataCheckString)
 *
 * Подпись проверяется до любого чтения и записи: неподписанный или подправленный
 * payload получает 401 и до базы не доходит.
 */

export interface TgUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export type AuthResult =
  | { ok: true; user: TgUser }
  | { ok: false; reason: 'missing' | 'malformed' | 'signature' | 'expired' };

const encoder = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(data));
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Сравнение за постоянное время — чтобы по времени ответа нельзя было подобрать хеш. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyInitData(
  raw: string,
  botToken: string,
  // Неделя, а не сутки: десктопный Telegram держит мини-апп открытым днями,
  // и подпись, «протухшая» за спиной у пользователя, молча ломала бы все
  // сохранения. Подпись всё равно неподдельна — свежесть только против реплея.
  maxAgeSeconds = 7 * 24 * 60 * 60,
): Promise<AuthResult> {
  if (!raw) return { ok: false, reason: 'missing' };

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'malformed' };

  // Строка проверки — все поля кроме hash, отсортированные по имени.
  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === 'hash') continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();

  const secret = await hmac(encoder.encode('WebAppData'), botToken);
  const computed = toHex(await hmac(secret, pairs.join('\n')));
  if (!timingSafeEqual(computed, hash)) return { ok: false, reason: 'signature' };

  const authDate = Number(params.get('auth_date'));
  if (Number.isFinite(authDate) && maxAgeSeconds > 0) {
    const age = Date.now() / 1000 - authDate;
    if (age > maxAgeSeconds) return { ok: false, reason: 'expired' };
  }

  let user: TgUser;
  try {
    user = JSON.parse(params.get('user') || 'null');
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (!user || typeof user.id !== 'number') return { ok: false, reason: 'malformed' };

  return { ok: true, user };
}
