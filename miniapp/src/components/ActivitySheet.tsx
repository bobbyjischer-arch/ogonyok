import { useState } from 'react';
import { Icon } from './Icon';
import { Button, Field, Group, Row, Sheet } from './ui';
import { activityLabelKey, durationOf, emojiOf } from '../lib/activities';
import { useI18n } from '../lib/i18n';
import { useNow } from '../lib/useNow';
import type { Activity, ActivityPatch, ActivityType } from '../lib/types';

/** Значения для `datetime-local`: контрол работает в местном времени без TZ. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

const fromLocalInput = (value: string): string | null => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
};

interface ActivitySheetProps {
  activity: Activity | null;
  types: ActivityType[];
  busy: boolean;
  /** Подпись автора — нужна куратору, который смотрит чужие события. */
  owner?: string;
  onClose: () => void;
  onPatch: (patch: ActivityPatch) => void;
  onDelete: () => void;
}

/**
 * Карточка занятия: что это было, сколько заняло, правка времени и удаление.
 * Одна и та же и у автора занятия, и у куратора — расходятся они только
 * подписью автора сверху.
 */
export function ActivitySheet({
  activity,
  types,
  busy,
  owner,
  onClose,
  onPatch,
  onDelete,
}: ActivitySheetProps) {
  const { t, locale } = useI18n();
  const now = useNow();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState('');
  const [ended, setEnded] = useState('');

  const beginEditing = () => {
    if (!activity) return;
    setStarted(toLocalInput(activity.startedAt));
    setEnded(activity.endedAt ? toLocalInput(activity.endedAt) : '');
    setEditing(true);
  };

  // Лист переиспользуется между занятиями — режимы сбрасываются при закрытии.
  const close = () => {
    setEditing(false);
    setConfirming(false);
    onClose();
  };

  if (!activity) return null;

  const duration = durationOf(activity, now);
  const stamp = (iso: string) =>
    new Date(iso).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  if (confirming) {
    return (
      <Sheet open onClose={close}>
        <div className="pb-2 pt-1 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-danger/10 text-danger">
            <Icon name="trash" size={24} />
          </span>
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">{t('deleteActivityTitle')}</h2>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-snug text-dim">
            {t('deleteActivityBody')}
          </p>
          <div className="mt-6 space-y-2.5">
            <Button variant="danger" disabled={busy} onClick={onDelete}>
              {busy ? t('working') : t('deleteActivityAction')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setConfirming(false)}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={close} title={t('activityDetailTitle')}>
      <div className="space-y-4">
        {owner ? (
          <p className="px-1 text-[13px] text-dim">
            {t('curatorEventOf', { name: owner })}
          </p>
        ) : null}

        <div className="space-y-3 rounded-card glass-card glass-shine p-4 text-[14px]">
          <DetailRow
            label={t('fieldType')}
            value={`${emojiOf(types, activity.kind)} ${t(activityLabelKey(activity.kind))}`}
          />
          <DetailRow label={t('fieldStart')} value={stamp(activity.startedAt)} />
          <DetailRow
            label={t('fieldEnd')}
            value={activity.endedAt ? stamp(activity.endedAt) : t('runningNow')}
          />
          <DetailRow
            label={t('fieldDuration')}
            value={`${Math.floor(duration / 3600000)}${t('hourShort')} ${Math.floor(
              (duration % 3600000) / 60000,
            )}${t('minShort')}`}
          />
          <DetailRow label={t('fieldCheckins')} value={String(activity.checkins)} />
        </div>

        {editing ? (
          <div className="space-y-3">
            <div>
              <span className="mb-2 block px-1 text-[13px] font-medium text-dim">
                {t('fieldType')}
              </span>
              <div className="grid grid-cols-5 gap-2">
                {types.map((type) => {
                  const selected = type.key === activity.kind;
                  return (
                    <button
                      key={type.key}
                      type="button"
                      disabled={busy}
                      onClick={() => onPatch({ kind: type.key })}
                      aria-pressed={selected}
                      className={`pressable flex aspect-square items-center justify-center rounded-[13px] text-[19px] transition-colors ${
                        selected ? 'bg-accent text-white' : 'bg-surface'
                      }`}
                      aria-label={t(activityLabelKey(type.key))}
                    >
                      {type.emoji}
                    </button>
                  );
                })}
              </div>
            </div>

            <Field label={t('fieldStart')}>
              <input
                type="datetime-local"
                value={started}
                onChange={(event) => setStarted(event.target.value)}
                className="h-[50px] w-full rounded-[13px] bg-surface px-4 text-[16px] text-ink outline-none focus:ring-2 focus:ring-accent/35"
              />
            </Field>
            <Field label={t('fieldEnd')} hint={t('fieldEndHint')}>
              <input
                type="datetime-local"
                value={ended}
                onChange={(event) => setEnded(event.target.value)}
                className="h-[50px] w-full rounded-[13px] bg-surface px-4 text-[16px] text-ink outline-none focus:ring-2 focus:ring-accent/35"
              />
            </Field>
            <Button
              disabled={busy}
              onClick={() => {
                const patch: ActivityPatch = {};
                const nextStart = fromLocalInput(started);
                if (nextStart) patch.startedAt = nextStart;
                // Пустое поле конца означает, что занятие снова идёт.
                patch.endedAt = ended ? fromLocalInput(ended) : null;
                onPatch(patch);
              }}
            >
              {busy ? t('saving') : t('saveChanges')}
            </Button>
          </div>
        ) : (
          <Group>
            <Row icon="pencil" title={t('editTimes')} onClick={beginEditing} chevron />
            <Row
              icon="trash"
              title={t('deleteActivityAction')}
              destructive
              onClick={() => setConfirming(true)}
              last
            />
          </Group>
        )}
      </div>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-dim">{label}</span>
      <span className="truncate font-medium text-ink">{value}</span>
    </div>
  );
}
