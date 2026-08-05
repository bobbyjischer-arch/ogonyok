import { Icon } from '../components/Icon';
import { BuildHabitCard, HabitCard } from '../components/HabitCard';
import { Button, EmptyState, Screen } from '../components/ui';
import { useNow } from '../lib/useNow';
import { formatDuration, formatStreak } from '../lib/time';
import { useI18n } from '../lib/i18n';
import { streakOf } from '../lib/streak';
import { haptic } from '../lib/telegram';
import type { Habit, HabitMode } from '../lib/types';

interface HabitsScreenProps {
  habits: Habit[];
  today: string;
  busy: boolean;
  onAdd: (mode: HabitMode) => void;
  onOpen: (habit: Habit) => void;
  onToggleDay: (habit: Habit) => void;
}

export function HabitsScreen({
  habits,
  today,
  busy,
  onAdd,
  onOpen,
  onToggleDay,
}: HabitsScreenProps) {
  const now = useNow();
  const { t, lang, plural } = useI18n();

  const build = habits.filter((habit) => habit.mode === 'build');
  const quit = habits.filter((habit) => habit.mode !== 'build');

  if (habits.length === 0) {
    return (
      <Screen>
        <div className="pb-1 pt-6">
          <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">
            {t('habitsTitle')}
          </h1>
        </div>
        <EmptyState
          icon="spark"
          title={t('emptyBuildTitle')}
          body={t('emptyBuildBody')}
          action={
            <div className="space-y-2.5">
              <Button icon="plus" onClick={() => onAdd('build')}>
                {t('emptyBuildAction')}
              </Button>
              <Button variant="secondary" icon="shield" onClick={() => onAdd('quit')}>
                {t('emptyHabitsAction')}
              </Button>
            </div>
          }
        />
      </Screen>
    );
  }

  // Сводка режима отказа: суммарное время и самая длинная текущая серия.
  const totalClean = quit.reduce(
    (sum, habit) => sum + Math.max(0, now - Date.parse(habit.startedAt)),
    0,
  );
  const longestClean = quit.reduce(
    (max, habit) => Math.max(max, now - Date.parse(habit.startedAt)),
    0,
  );
  const topStreak = build.reduce((max, habit) => Math.max(max, streakOf(habit, today).current), 0);

  return (
    <Screen>
      <div className="pb-1 pt-6">
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">
          {t('habitsTitle')}
        </h1>
      </div>

      {/* --- полезные --- */}

      <SectionHead title={t('sectionBuild')} onAdd={() => onAdd('build')} />

      {build.length === 0 ? (
        <AddCard label={t('emptyBuildAction')} onClick={() => onAdd('build')} />
      ) : (
        <>
          <p className="px-1 pb-3 text-[13px] text-dim">
            {topStreak > 0 ? (
              <>
                {t('topStreak')}:{' '}
                <span className="font-semibold text-ink">🔥 {plural(topStreak, 'day')}</span>
              </>
            ) : (
              t('streakStart')
            )}
          </p>
          <div className="space-y-2.5">
            {build.map((habit) => (
              <BuildHabitCard
                key={habit.id}
                habit={habit}
                today={today}
                busy={busy}
                onOpen={() => onOpen(habit)}
                onToggleToday={() => onToggleDay(habit)}
              />
            ))}
          </div>
        </>
      )}

      {/* --- отказ --- */}

      <SectionHead title={t('sectionQuit')} onAdd={() => onAdd('quit')} />

      {quit.length === 0 ? (
        <AddCard label={t('emptyHabitsAction')} onClick={() => onAdd('quit')} />
      ) : (
        <>
          <div className="px-1 pb-4">
            <p className="text-[13px] font-medium text-dim">{t('totalClean')}</p>
            <p className="mt-1.5 text-[32px] font-bold leading-none tracking-[-0.035em] num">
              {formatStreak(totalClean, lang)}
            </p>
            {quit.length > 1 ? (
              <p className="mt-1.5 text-[13px] text-dim">
                {t('longestRun', { duration: formatDuration(longestClean, lang) })}
              </p>
            ) : null}
          </div>
          <div className="space-y-2.5">
            {quit.map((habit) => (
              <HabitCard key={habit.id} habit={habit} onOpen={() => onOpen(habit)} />
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

function SectionHead({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-7">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">{title}</h2>
      <button
        type="button"
        onClick={() => {
          haptic.impact('light');
          onAdd();
        }}
        aria-label={title}
        className="pressable flex h-7 w-7 items-center justify-center rounded-full bg-surface text-dim"
      >
        <Icon name="plus" size={16} strokeWidth={2.3} />
      </button>
    </div>
  );
}

function AddCard({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        haptic.impact('medium');
        onClick();
      }}
      className="pressable flex w-full items-center justify-center gap-2 rounded-card border border-dashed hairline py-4 text-[15px] font-medium text-dim"
    >
      <Icon name="plus" size={17} strokeWidth={2} />
      {label}
    </button>
  );
}
