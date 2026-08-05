import { useCallback, useEffect, useState } from 'react';
import { ActivitySheet } from './ActivitySheet';
import { Group, Row, SectionLabel } from './ui';
import { activityLabelKey, durationOf, emojiOf } from '../lib/activities';
import { useI18n } from '../lib/i18n';
import { useNow } from '../lib/useNow';
import type { ApiClient } from '../lib/api';
import type { ActivityPatch, ActivityType, CuratorOpen, CuratorState } from '../lib/types';

interface CuratorPanelProps {
  client: ApiClient;
  types: ActivityType[];
  notifications: boolean;
  busy: boolean;
  onToggleNotifications: (value: boolean) => void;
  onPatchActivity: (id: string, patch: ActivityPatch) => Promise<void>;
  onDeleteActivity: (id: string) => Promise<void>;
}

/**
 * Виден только куратору. Данные тянутся отдельным запросом, а не лежат в общем
 * снимке: остальным пользователям чужие сессии знать незачем. Отсюда же
 * куратор правит и удаляет чужие события — он за них отвечает.
 */
export function CuratorPanel({
  client,
  types,
  notifications,
  busy,
  onToggleNotifications,
  onPatchActivity,
  onDeleteActivity,
}: CuratorPanelProps) {
  const { t, plural } = useI18n();
  const now = useNow();
  const [data, setData] = useState<CuratorState | null>(null);
  const [detail, setDetail] = useState<CuratorOpen | null>(null);

  const refresh = useCallback(() => {
    client
      .curator()
      .then(setData)
      .catch(() => setData(null));
  }, [client]);

  useEffect(refresh, [refresh]);

  const short = (ms: number) => {
    const minutes = Math.max(0, Math.floor(ms / 60000));
    const hours = Math.floor(minutes / 60);
    return hours > 0
      ? `${hours}${t('hourShort')} ${minutes % 60}${t('minShort')}`
      : `${minutes}${t('minShort')}`;
  };

  // После правки чужого события общий снимок не меняется — панель обновляем сами.
  const applyPatch = async (id: string, patch: ActivityPatch) => {
    await onPatchActivity(id, patch);
    setDetail(null);
    refresh();
  };

  const applyDelete = async (id: string) => {
    await onDeleteActivity(id);
    setDetail(null);
    refresh();
  };

  return (
    <>
      <SectionLabel>{t('curatorSection')}</SectionLabel>
      <Group>
        <Row
          icon="bell"
          title={t('curatorNotifications')}
          detail={t('curatorNotificationsHint')}
          value={notifications ? '🔔' : '🔕'}
          onClick={busy ? undefined : () => onToggleNotifications(!notifications)}
        />
        <Row icon="restart" title={t('curatorRefresh')} onClick={refresh} last />
      </Group>

      <SectionLabel>{t('curatorOpenNow')}</SectionLabel>
      {data && data.open.length > 0 ? (
        <Group>
          {data.open.map((entry, index) => (
            <Row
              key={entry.id}
              title={entry.user.name}
              detail={`${emojiOf(types, entry.kind)} ${t(activityLabelKey(entry.kind))} · ${plural(
                entry.checkins,
                'checkin',
              )}`}
              value={short(now - Date.parse(entry.startedAt))}
              onClick={() => setDetail(entry)}
              chevron
              last={index === data.open.length - 1}
            />
          ))}
        </Group>
      ) : (
        <p className="rounded-card glass-card glass-shine p-5 text-center text-[15px] text-dim">
          {t('curatorNobody')}
        </p>
      )}

      {data && data.today.length > 0 ? (
        <>
          <SectionLabel>{t('curatorTodayLabel')}</SectionLabel>
          <Group>
            {data.today.map((entry, index) => (
              <Row
                key={entry.userId}
                title={entry.name}
                detail={plural(entry.count, 'activity')}
                value={short(entry.totalMs)}
                last={index === data.today.length - 1}
              />
            ))}
          </Group>
        </>
      ) : null}

      {data && data.recent.length > 0 ? (
        <>
          <SectionLabel>{t('curatorRecent')}</SectionLabel>
          <Group>
            {data.recent.map((entry, index) => (
              <Row
                key={entry.id}
                title={`${emojiOf(types, entry.kind)} ${t(activityLabelKey(entry.kind))}`}
                detail={`${entry.user.name} · ${new Date(entry.startedAt).toLocaleString(undefined, {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}`}
                value={entry.endedAt ? short(durationOf(entry, now)) : t('runningNow')}
                onClick={() => setDetail(entry)}
                chevron
                last={index === data.recent.length - 1}
              />
            ))}
          </Group>
          <p className="px-1 pt-2 text-[12px] leading-snug text-faint">{t('curatorEditHint')}</p>
        </>
      ) : null}

      <ActivitySheet
        activity={detail}
        types={types}
        busy={busy}
        owner={detail?.user.name}
        onClose={() => setDetail(null)}
        onPatch={(patch) => {
          if (detail) void applyPatch(detail.id, patch);
        }}
        onDelete={() => {
          if (detail) void applyDelete(detail.id);
        }}
      />
    </>
  );
}
