import { useMemo } from 'react';
import { useI18n } from '../lib/i18n';
import { EVERY_DAY, isScheduled, shiftDay, type StreakSource } from '../lib/streak';
import type { Habit } from '../lib/types';

interface ProgressChartProps {
  habit: Habit;
  today: string;
}

/**
 * График еженедельного прогресса за последние 8 недель: процент выполнения
 * запланированных дней. Считается теми же примитивами, что и серии
 * (`shared/streak`), чтобы график и огонёк никогда не расходились.
 */
export function ProgressChart({ habit, today }: ProgressChartProps) {
  const { t } = useI18n();

  const data = useMemo(() => {
    if (habit.mode === 'build') {
      return buildWeeklyData(habit, today, t('now'));
    }
    return [];
  }, [habit, today, t]);

  if (data.length === 0) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-card glass-card glass-shine p-4">
      <h4 className="mb-3 text-[13px] font-semibold text-dim">{t('weeklyProgress')}</h4>
      <div className="flex items-end justify-between gap-2" style={{ height: 120 }}>
        {data.map((week, index) => {
          const heightPct = (week.value / maxValue) * 100;
          return (
            <div key={index} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="relative w-full flex-1">
                <div
                  className="absolute bottom-0 w-full rounded-t-[4px] bg-accent transition-all"
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-faint">{week.label}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] leading-snug text-faint">{t('weeklyProgressHint')}</p>
    </div>
  );
}

interface WeekData {
  label: string;
  value: number;
}

/** Последние 8 недель для режима build: процент выполнения запланированных дней. */
function buildWeeklyData(habit: StreakSource, today: string, nowLabel: string): WeekData[] {
  const done = new Set(habit.days);
  const mask = habit.daysMask || EVERY_DAY;
  const weeks: WeekData[] = [];

  for (let weekOffset = 7; weekOffset >= 0; weekOffset -= 1) {
    const end = shiftDay(today, -weekOffset * 7);
    const start = shiftDay(end, -6);

    let planned = 0;
    let count = 0;
    for (let cursor = start; cursor <= end; cursor = shiftDay(cursor, 1)) {
      if (!isScheduled(mask, cursor)) continue;
      planned += 1;
      if (done.has(cursor)) count += 1;
    }

    weeks.push({
      label: weekOffset === 0 ? nowLabel : `−${weekOffset}`,
      value: planned === 0 ? 0 : Math.round((count / planned) * 100),
    });
  }

  return weeks;
}
