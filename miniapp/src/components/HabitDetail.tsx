import { useEffect, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { Button, Group, Ring, Row, Sheet, Stat } from './ui';
import { useNow } from '../lib/useNow';
import {
  MILESTONES,
  compactNumber,
  daysBetween,
  formatDate,
  formatDuration,
  formatMoney,
  formatStreak,
  milestoneProgress,
} from '../lib/time';
import { useI18n } from '../lib/i18n';
import { recentDays, streakOf, type DayCell } from '../lib/streak';
import { haptic } from '../lib/telegram';
import type { Habit } from '../lib/types';

type Mode = 'detail' | 'relapse' | 'delete';

interface HabitDetailProps {
  habit: Habit | null;
  currency: string;
  today: string;
  busy?: boolean;
  onClose: () => void;
  onEdit: () => void;
  onRelapse: () => void;
  onDelete: () => void;
  onToggleDay: (day: string) => void;
}

export function HabitDetail({
  habit,
  currency,
  today,
  busy,
  onClose,
  onEdit,
  onRelapse,
  onDelete,
  onToggleDay,
}: HabitDetailProps) {
  const [mode, setMode] = useState<Mode>('detail');
  const now = useNow();
  const { t, lang, plural } = useI18n();

  useEffect(() => {
    if (habit) setMode('detail');
  }, [habit]);

  if (!habit) return null;

  /* --- подтверждения --- */

  if (mode === 'relapse' || mode === 'delete') {
    const isDelete = mode === 'delete';
    return (
      <Sheet open onClose={onClose}>
        <div className="pb-2 pt-1 text-center">
          <span
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] ${
              isDelete ? 'bg-danger/10 text-danger' : 'bg-surface text-ink'
            }`}
          >
            <Icon name={isDelete ? 'trash' : 'restart'} size={24} />
          </span>
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">
            {isDelete ? t('deleteConfirmTitle') : t('resetConfirmTitle')}
          </h2>
          <p className="mx-auto mt-2 max-w-[300px] text-[15px] leading-snug text-dim">
            {isDelete
              ? t('deleteConfirmBody')
              : t('resetConfirmBody', {
                  duration: formatDuration(now - Date.parse(habit.startedAt), lang),
                })}
          </p>
          <div className="mt-6 space-y-2.5">
            <Button
              variant={isDelete ? 'danger' : 'primary'}
              disabled={busy}
              onClick={isDelete ? onDelete : onRelapse}
            >
              {busy ? t('working') : isDelete ? t('deleteHabit') : t('resetConfirmAction')}
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setMode('detail')}>
              {t('cancel')}
            </Button>
          </div>
        </div>
      </Sheet>
    );
  }

  /* --- полезная привычка: огонёк и сетка дней --- */

  if (habit.mode === 'build') {
    const streak = streakOf(habit, today);
    const grid = recentDays(habit, today, 28);
    const rate =
      streak.last30.planned === 0
        ? 0
        : Math.round((streak.last30.done / streak.last30.planned) * 100);

    return (
      <Sheet open onClose={onClose}>
        <div className="flex flex-col items-center pb-1 pt-1">
          <div className="flex items-center gap-2 text-dim">
            <Icon name={habit.icon as IconName} size={17} />
            <span className="text-[15px] font-medium">{habit.title}</span>
          </div>

          <div className="mt-6 flex items-baseline gap-2">
            <span
              className={`text-[44px] leading-none ${streak.current > 0 ? '' : 'opacity-30 grayscale'}`}
            >
              🔥
            </span>
            <span className="text-[56px] font-bold leading-none tracking-[-0.04em] num">
              {streak.current}
            </span>
          </div>
          <p className="mt-2 text-[14px] text-dim">
            {streak.current > 0
              ? `${plural(streak.current, 'day')} ${t('inARow')}`
              : t('streakStart')}
          </p>

          <div className="mt-5 w-full">
            <Button
              disabled={busy}
              variant={streak.doneToday ? 'secondary' : 'primary'}
              icon="check"
              onClick={() => {
                haptic.impact(streak.doneToday ? 'soft' : 'medium');
                onToggleDay(today);
              }}
            >
              {streak.doneToday ? t('markedToday') : t('markToday')}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <Stat icon="trophy" label={t('topStreak')} value={plural(streak.best, 'day')} />
          <Stat icon="check" label={t('doneTotal')} value={String(streak.total)} />
          <Stat
            icon="chart"
            label={t('last30')}
            value={`${rate}%`}
            caption={`${streak.last30.done} / ${streak.last30.planned}`}
          />
          <Stat icon="calendar" label={t('memberSince')} value={formatDate(habit.createdAt, lang)} />
        </div>

        <h3 className="px-1 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">
          {t('historyGrid')}
        </h3>
        <div className="grid grid-cols-7 gap-1.5 rounded-card glass-card glass-shine p-3">
          {grid.map((cell) => (
            <GridCell key={cell.day} cell={cell} busy={Boolean(busy)} onToggle={onToggleDay} />
          ))}
        </div>
        <p className="px-1 pt-2 text-[12px] leading-snug text-faint">{t('scheduleHint')}</p>

        <h3 className="px-1 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">
          {t('manage')}
        </h3>
        <Group>
          <Row icon="pencil" title={t('editHabit')} onClick={onEdit} chevron />
          <Row
            icon="trash"
            title={t('deleteHabit')}
            destructive
            onClick={() => setMode('delete')}
            last
          />
        </Group>
      </Sheet>
    );
  }

  /* --- отказ от вредного --- */

  const elapsed = now - Date.parse(habit.startedAt);
  const { next, ratio, reached } = milestoneProgress(elapsed);
  const days = daysBetween(elapsed);
  const saved = habit.costPerDay * days;
  const avoided = habit.unitsPerDay * days;
  const best = Math.max(habit.bestStreakMs, elapsed);

  return (
    <Sheet open onClose={onClose}>
      <div className="flex flex-col items-center pb-1 pt-1">
        <div className="flex items-center gap-2 text-dim">
          <Icon name={habit.icon as IconName} size={17} />
          <span className="text-[15px] font-medium">{habit.title}</span>
        </div>

        <div className="my-5">
          <Ring progress={next ? ratio : 1} size={212} width={7}>
            <span className="text-[30px] font-bold leading-none tracking-[-0.03em] num">
              {formatStreak(elapsed, lang)}
            </span>
            <span className="mt-2 text-[13px] text-dim">
              {next ? t('milestoneOf', { label: t(next.key) }) : t('allMilestones')}
            </span>
          </Ring>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Stat icon="trophy" label={t('bestStreak')} value={formatDuration(best, lang)} />
        <Stat icon="restart" label={t('restartsLabel')} value={String(habit.relapses.length)} />
        {habit.costPerDay > 0 ? (
          <Stat icon="coins" label={t('statSaved')} value={formatMoney(saved, currency, lang)} />
        ) : null}
        {habit.unitsPerDay > 0 ? (
          <Stat
            icon="target"
            label={t('statAvoided')}
            value={compactNumber(Math.floor(avoided), lang)}
            caption={habit.unitLabel || undefined}
          />
        ) : null}
      </div>

      <h3 className="px-1 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">
        {t('milestonesHeader', { reached, total: MILESTONES.length })}
      </h3>
      <Group>
        {MILESTONES.map((milestone, index) => {
          const done = elapsed >= milestone.ms;
          return (
            <Row
              key={milestone.key}
              icon={done ? 'check' : 'lock'}
              title={t(milestone.key)}
              value={
                done
                  ? t('reached')
                  : t('toGo', { duration: formatDuration(milestone.ms - elapsed, lang) })
              }
              last={index === MILESTONES.length - 1}
            />
          );
        })}
      </Group>

      <h3 className="px-1 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">
        {t('manage')}
      </h3>
      <Group>
        <Row icon="pencil" title={t('editHabit')} onClick={onEdit} chevron />
        <Row
          icon="restart"
          title={t('iRelapsed')}
          detail={t('startedOn', { date: formatDate(habit.startedAt, lang) })}
          onClick={() => setMode('relapse')}
          chevron
        />
        <Row
          icon="trash"
          title={t('deleteHabit')}
          destructive
          onClick={() => setMode('delete')}
          last
        />
      </Group>
    </Sheet>
  );
}

/** Клетка сетки: тап отмечает пропущенный день — «сделал, но забыл нажать». */
function GridCell({
  cell,
  busy,
  onToggle,
}: {
  cell: DayCell;
  busy: boolean;
  onToggle: (day: string) => void;
}) {
  const body = cell.done
    ? 'bg-accent text-white'
    : cell.scheduled
      ? `bg-surface text-faint ${cell.isToday ? 'ring-2 ring-accent/45' : ''}`
      : 'bg-surface/40 text-faint/40';

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        haptic.select();
        onToggle(cell.day);
      }}
      aria-label={cell.day}
      className={`pressable flex aspect-square items-center justify-center rounded-[9px] text-[10px] disabled:opacity-50 ${body}`}
    >
      {cell.done ? <Icon name="check" size={13} strokeWidth={2.6} /> : Number(cell.day.slice(8))}
    </button>
  );
}
