import { useCallback, useMemo, useState } from 'react';
import { Button, EmptyState, Screen, ScreenTitle, SectionLabel, Sheet, Stat } from '../components/ui';
import { ActivitySheet } from '../components/ActivitySheet';
import { activityLabelKey, durationOf, emojiOf, isToday } from '../lib/activities';
import { useI18n } from '../lib/i18n';
import { haptic } from '../lib/telegram';
import { formatStreak } from '../lib/time';
import { useNow } from '../lib/useNow';
import type { Activity, ActivityPatch, ActivityType } from '../lib/types';

/* ------------------------------------------------------------------ */
/* Экран                                                               */
/* ------------------------------------------------------------------ */

interface ActivitiesScreenProps {
  activities: Activity[];
  current: Activity | null;
  types: ActivityType[];
  busy: boolean;
  onStart: (kind: string) => void;
  onStop: (id: string) => void;
  onCheckin: (id: string, text: string) => Promise<void>;
  onPatch: (id: string, patch: ActivityPatch) => void;
  onDelete: (id: string) => void;
}

export function ActivitiesScreen({
  activities,
  current,
  types,
  busy,
  onStart,
  onStop,
  onCheckin,
  onPatch,
  onDelete,
}: ActivitiesScreenProps) {
  const now = useNow();
  const { t, lang, plural, locale } = useI18n();
  const [filter, setFilter] = useState<string>('all');
  const [detail, setDetail] = useState<Activity | null>(null);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const clock = useCallback(
    (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale],
  );

  const shortDuration = useCallback(
    (ms: number) => {
      const minutes = Math.floor(ms / 60000);
      const hours = Math.floor(minutes / 60);
      return hours > 0
        ? `${hours}${t('hourShort')} ${minutes % 60}${t('minShort')}`
        : `${minutes}${t('minShort')}`;
    },
    [t],
  );

  const today = useMemo(() => {
    const rows = activities.filter((activity) => isToday(activity.startedAt));
    return {
      count: rows.length,
      totalMs: rows.reduce((sum, activity) => sum + durationOf(activity, now), 0),
      checkins: rows.reduce((sum, activity) => sum + activity.checkins, 0),
    };
    // `now` тикает раз в секунду и подтягивает идущее занятие в сумму дня.
  }, [activities, now]);

  // История без текущего занятия: оно уже показано карточкой сверху.
  const past = useMemo(
    () => activities.filter((activity) => activity.id !== current?.id),
    [activities, current],
  );

  const presentKinds = useMemo(() => {
    const seen = new Set(past.map((activity) => activity.kind));
    return types.filter((type) => seen.has(type.key));
  }, [past, types]);

  const filtered = useMemo(
    () => (filter === 'all' ? past : past.filter((activity) => activity.kind === filter)),
    [past, filter],
  );

  const closeDetail = useCallback(() => setDetail(null), []);
  const closeCheckin = useCallback(() => setCheckinOpen(false), []);

  return (
    <Screen>
      <ScreenTitle title={t('activitiesTitle')} subtitle={t('activitiesSubtitle')} />

      {/* Идущее занятие */}
      {current ? (
        <section className="rounded-card glass-card glass-shine p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-raised text-[20px]">
              {emojiOf(types, current.kind)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-dim">{t('nowRunning')}</p>
              <p className="truncate text-[17px] font-semibold leading-tight">
                {t(activityLabelKey(current.kind))}
              </p>
            </div>
          </div>

          <p className="mt-4 text-[38px] font-bold leading-none tracking-[-0.03em] num">
            {formatStreak(Math.max(0, now - Date.parse(current.startedAt)), lang)}
          </p>
          <p className="mt-2 text-[13px] text-dim">
            {t('fieldStart')}: {clock(current.startedAt)} · {plural(current.checkins, 'checkin')}
          </p>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button
              variant="secondary"
              icon="spark"
              full
              disabled={busy}
              onClick={() => setCheckinOpen(true)}
            >
              {t('checkInAction')}
            </Button>
            <Button icon="check" full disabled={busy} onClick={() => onStop(current.id)}>
              {t('finishAction')}
            </Button>
          </div>
        </section>
      ) : null}

      {/* Выбор занятия */}
      <SectionLabel>{current ? t('switchActivity') : t('pickActivity')}</SectionLabel>
      <div className="grid grid-cols-3 gap-2">
        {types.map((type) => (
          <button
            key={type.key}
            type="button"
            disabled={busy}
            onClick={() => {
              haptic.impact('medium');
              onStart(type.key);
            }}
            className="pressable flex flex-col items-center justify-center gap-1.5 rounded-[14px] glass-card glass-shine px-2 py-3.5 disabled:opacity-40"
          >
            <span className="text-[22px] leading-none">{type.emoji}</span>
            <span className="text-center text-[12px] font-medium leading-tight text-dim">
              {t(activityLabelKey(type.key))}
            </span>
          </button>
        ))}
      </div>
      {current ? (
        <p className="px-1 pt-2 text-[12px] leading-snug text-faint">{t('finishFirstHint')}</p>
      ) : null}

      {/* Сегодня */}
      {today.count > 0 ? (
        <>
          <SectionLabel>{t('todaySection')}</SectionLabel>
          <div className="grid grid-cols-3 gap-2.5">
            <Stat icon="flag" label={t('statTodayCount')} value={String(today.count)} />
            <Stat icon="clock" label={t('statTodayTime')} value={shortDuration(today.totalMs)} />
            <Stat icon="spark" label={t('statTodayCheckins')} value={String(today.checkins)} />
          </div>
        </>
      ) : null}

      {/* История */}
      <SectionLabel>{t('historySection')}</SectionLabel>

      {past.length === 0 ? (
        <EmptyState
          icon="clock"
          title={t('emptyActivitiesTitle')}
          body={t('emptyActivitiesBody')}
        />
      ) : (
        <>
          {presentKinds.length > 1 ? (
            <div className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto scroll-area px-4 pb-1">
              <FilterChip
                label={t('filterAll')}
                active={filter === 'all'}
                onClick={() => setFilter('all')}
              />
              {presentKinds.map((type) => (
                <FilterChip
                  key={type.key}
                  label={`${type.emoji} ${t(activityLabelKey(type.key))}`}
                  active={filter === type.key}
                  onClick={() => setFilter(type.key)}
                />
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <p className="rounded-card glass-card glass-shine p-5 text-center text-[15px] text-dim">
              {t('emptyFiltered')}
            </p>
          ) : (
            <div className="overflow-hidden rounded-card glass-card">
              {filtered.map((activity, index) => (
                <button
                  key={activity.id}
                  type="button"
                  onClick={() => {
                    haptic.impact('light');
                    setDetail(activity);
                  }}
                  className="pressable flex w-full items-center gap-3 px-4 text-left"
                >
                  <span className="shrink-0 text-[19px]">{emojiOf(types, activity.kind)}</span>
                  <span
                    className={`flex min-w-0 flex-1 items-center gap-3 py-[13px] ${
                      index === filtered.length - 1 ? '' : 'border-b hairline'
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] leading-tight">
                        {t(activityLabelKey(activity.kind))}
                      </span>
                      <span className="mt-0.5 block truncate text-[13px] leading-tight text-dim">
                        {clock(activity.startedAt)} →{' '}
                        {activity.endedAt ? clock(activity.endedAt) : t('runningNow')}
                        {activity.checkins > 0 ? ` · 📍${activity.checkins}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] text-dim num">
                      {shortDuration(durationOf(activity, now))}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      <CheckinSheet
        open={checkinOpen && Boolean(current)}
        busy={busy}
        onClose={closeCheckin}
        onSend={async (text) => {
          if (!current) return;
          await onCheckin(current.id, text);
          setCheckinOpen(false);
        }}
      />

      <ActivitySheet
        activity={detail}
        types={types}
        busy={busy}
        onClose={closeDetail}
        onPatch={(patch) => {
          if (!detail) return;
          onPatch(detail.id, patch);
          setDetail(null);
        }}
        onDelete={() => {
          if (!detail) return;
          onDelete(detail.id);
          setDetail(null);
        }}
      />
    </Screen>
  );
}

/* ------------------------------------------------------------------ */
/* Чип фильтра                                                         */
/* ------------------------------------------------------------------ */

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.select();
        onClick();
      }}
      aria-pressed={active}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'glass-card glass-shine text-dim'
      }`}
    >
      {label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Отметка                                                             */
/* ------------------------------------------------------------------ */

function CheckinSheet({
  open,
  busy,
  onClose,
  onSend,
}: {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  onSend: (text: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState('');

  return (
    <Sheet open={open} onClose={onClose} title={t('checkInTitle')}>
      <div className="space-y-4">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, 1000))}
          placeholder={t('checkInPlaceholder')}
          rows={4}
          className="w-full resize-none rounded-[13px] bg-surface px-4 py-3 text-[16px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/35"
        />
        <Button
          icon="arrowUpRight"
          disabled={busy || text.trim().length === 0}
          onClick={() => {
            const payload = text.trim();
            if (!payload) return;
            void onSend(payload).then(() => setText(''));
          }}
        >
          {busy ? t('checkInSending') : t('checkInSend')}
        </Button>
      </div>
    </Sheet>
  );
}
