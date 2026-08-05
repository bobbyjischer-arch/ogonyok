import { Icon, type IconName } from './Icon';
import { useNow } from '../lib/useNow';
import { formatDate, formatStreak, milestoneProgress, split } from '../lib/time';
import { useI18n } from '../lib/i18n';
import { currentWeek, streakOf, type DayCell } from '../lib/streak';
import { haptic } from '../lib/telegram';
import type { Habit } from '../lib/types';

/* ------------------------------------------------------------------ */
/* Полезная привычка: огонёк, неделя, отметка                          */
/* ------------------------------------------------------------------ */

interface BuildHabitCardProps {
  habit: Habit;
  today: string;
  busy: boolean;
  onOpen: () => void;
  onToggleToday: () => void;
}

export function BuildHabitCard({ habit, today, busy, onOpen, onToggleToday }: BuildHabitCardProps) {
  const { t, plural } = useI18n();
  const streak = streakOf(habit, today);
  const week = currentWeek(habit, today);

  return (
    <div className="rounded-card glass-card glass-shine p-4">
      {/* Открытие карточки и отметка — разные действия, поэтому не вложены. */}
      <button type="button" onClick={onOpen} className="pressable flex w-full items-center gap-3 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-raised text-ink">
          <Icon name={habit.icon as IconName} size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-tight">{habit.title}</span>
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-dim">
            {streak.current > 0
              ? `${plural(streak.current, 'day')} ${t('inARow')}`
              : t('streakNone')}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-1">
          <span className={`text-[22px] leading-none ${streak.current > 0 ? '' : 'opacity-30 grayscale'}`}>
            🔥
          </span>
          <span className="text-[22px] font-bold leading-none tracking-[-0.02em] num">
            {streak.current}
          </span>
        </span>
      </button>

      <div className="mt-4 flex justify-between gap-1">
        {week.map((cell) => (
          <WeekDot key={cell.day} cell={cell} />
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          haptic.impact(streak.doneToday ? 'soft' : 'medium');
          onToggleToday();
        }}
        className={`pressable mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-[13px] px-3 py-2 text-center text-[15px] font-semibold leading-tight transition-colors disabled:opacity-40 ${
          streak.doneToday ? 'bg-positive/15 text-positive' : 'bg-accent text-white'
        }`}
      >
        <Icon name="check" size={17} strokeWidth={2.4} className="shrink-0" />
        {streak.doneToday ? t('markedToday') : t('markToday')}
      </button>
    </div>
  );
}

function WeekDot({ cell }: { cell: DayCell }) {
  const { t } = useI18n();
  const labels = t('weekdaysShort').split(',');
  const weekday = labels[(new Date(`${cell.day}T12:00:00Z`).getUTCDay() + 6) % 7] ?? '';

  const body = cell.done
    ? 'bg-accent text-white'
    : cell.scheduled
      ? `bg-surface text-faint ${cell.isToday ? 'ring-2 ring-accent/45' : ''}`
      : 'bg-transparent text-faint/50';

  return (
    <span className="flex flex-1 flex-col items-center gap-1">
      <span className={`text-[10px] leading-none ${cell.isToday ? 'font-semibold text-ink' : 'text-faint'}`}>
        {weekday}
      </span>
      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] ${body}`}>
        {cell.done ? <Icon name="check" size={14} strokeWidth={2.6} /> : cell.scheduled ? '' : '·'}
      </span>
    </span>
  );
}

export function HabitCard({ habit, onOpen }: { habit: Habit; onOpen: () => void }) {
  const now = useNow();
  const { t, lang, plural } = useI18n();
  const elapsed = now - Date.parse(habit.startedAt);
  const { next, ratio } = milestoneProgress(elapsed);
  const { days } = split(elapsed);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="pressable block w-full rounded-card glass-card glass-shine p-4 text-left"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-raised text-ink">
          <Icon name={habit.icon as IconName} size={19} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-semibold leading-tight">
            {habit.title}
          </span>
          <span className="mt-0.5 block truncate text-[13px] leading-tight text-dim">
            {t('cleanSince', { date: formatDate(habit.startedAt, lang) })}
          </span>
        </span>
        <span className="shrink-0 text-faint">
          <Icon name="chevronRight" size={17} strokeWidth={2.2} />
        </span>
      </div>

      <p className="mt-4 text-[34px] font-bold leading-none tracking-[-0.03em] num">
        {formatStreak(elapsed, lang)}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-ink/10">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-700 ease-spring"
            style={{ width: `${Math.max(ratio * 100, next ? 1.5 : 100)}%` }}
          />
        </span>
        <span className="shrink-0 text-[12px] font-medium text-dim">
          {next
            ? t('nextMilestone', { label: t(next.key) })
            : t('recordDays', { days: plural(days, 'day') })}
        </span>
      </div>
    </button>
  );
}
