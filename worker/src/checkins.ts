/**
 * Отметка — единственная вещь, которую умеют делать оба входа: и бот, и
 * мини-апп. Общий путь живёт здесь, чтобы куратор получал одинаковое
 * сообщение независимо от того, откуда пришла отметка.
 */

import { activityLabel } from './activities';
import * as db from './db';
import { curatorId, isPublic, type Env } from './env';
import { MEDIA_ICONS, type Telegram } from './tg';
import { displayName, escapeHtml, humanDuration } from './util';

export interface CheckinInput {
  kind: string;
  text: string;
  fileId: string | null;
}

export interface CheckinResult {
  checkin: db.CheckinRow;
  /** id сообщения у куратора — на него можно ответить реплаем. */
  anchorId: number | null;
}

export async function recordCheckin(
  env: Env,
  tg: Telegram,
  user: db.UserRow,
  activity: db.ActivityRow | null,
  input: CheckinInput,
): Promise<CheckinResult> {
  const checkin = await db.addCheckin(env.DB, {
    activityId: activity?.id ?? null,
    userId: user.id,
    kind: input.kind,
    text: input.text.slice(0, 3000),
    fileId: input.fileId,
  });
  if (activity) await db.bumpCheckins(env.DB, activity.id);

  const curator = curatorId(env);
  // Куратору самому себе отметки не шлём — он бы получал эхо собственных
  // сообщений. В публичной версии не шлём вообще никому.
  if (!curator || curator === user.id || isPublic(env)) return { checkin, anchorId: null };

  const elapsed = activity ? Date.now() - Date.parse(activity.started_at) : 0;
  const lines = [
    `📍 <b>Отметка от ${escapeHtml(displayName(user))}</b> (id <code>${user.id}</code>)`,
    activity
      ? `🏷 ${activityLabel(activity.kind)} · в работе ${humanDuration(elapsed)}`
      : '🏷 Вне занятия',
  ];
  if (checkin.text) lines.push('', `💬 ${escapeHtml(checkin.text)}`);
  else if (input.kind !== 'text') lines.push('', `${MEDIA_ICONS[input.kind] ?? '📨'} вложение ниже`);
  lines.push('', '<i>Ответьте на это сообщение реплаем, чтобы написать пользователю.</i>');

  const anchor = await tg.sendMessage(curator, lines.join('\n'));
  if (anchor) await db.addRelay(env.DB, anchor.message_id, user.id, checkin.id);

  return { checkin, anchorId: anchor?.message_id ?? null };
}
