import type { IconName } from '../components/Icon';
import { EmptyState, Group, Row, Screen, ScreenTitle, SectionLabel, Stat } from '../components/ui';
import { useNow } from '../lib/useNow';
import {
  compactNumber,
  daysBetween,
  formatDate,
  formatDuration,
  formatMoney,
  milestoneProgress,
} from '../lib/time';
import { useI18n } from '../lib/i18n';
import { streakOf } from '../lib/streak';
import type { Habit, Session } from '../lib/types';

interface StatsScreenProps {
  habits: Habit[];
  sessions: Session[];
  currency: string;
  today: string;
}

interface Entry {
  key: string;
  icon: IconName;
  title: string;
  detail: string;
  at: number;
}

export function StatsScreen({ habits, sessions, currency, today }: StatsScreenProps) {
  const now = useNow();
  const { t, lang, plural } = useI18n();

  const build = habits.filter((habit) => habit.mode === 'build');
  const quit = habits.filter((habit) => habit.mode !== 'build');

  const totals = quit.reduce(
    (acc, habit) => {
      const elapsed = Math.max(0, now - Date.parse(habit.startedAt));
      const days = daysBetween(elapsed);
      acc.clean += elapsed;
      acc.saved += habit.costPerDay * days;
      acc.avoided += habit.unitsPerDay * days;
      acc.milestones += milestoneProgress(elapsed).reached;
      acc.best = Math.max(acc.best, habit.bestStreakMs, elapsed);
      return acc;
    },
    { clean: 0, saved: 0, avoided: 0, milestones: 0, best: 0 },
  );

  const buildTotals = build.reduce(
    (acc, habit) => {
      const streak = streakOf(habit, today);
      acc.top = Math.max(acc.top, streak.current);
      acc.record = Math.max(acc.record, streak.best);
      acc.marks += streak.total;
      acc.doneToday += streak.doneToday ? 1 : 0;
      acc.dueToday += streak.scheduledToday ? 1 : 0;
      return acc;
    },
    { top: 0, record: 0, marks: 0, doneToday: 0, dueToday: 0 },
  );

  const wins = sessions.filter((session) => session.completed).length;

  if (habits.length === 0) {
    return (
      <Screen>
        <ScreenTitle title={t('statsTitle')} />
        <EmptyState icon="chart" title={t('emptyStatsTitle')} body={t('emptyStatsBody')} />
      </Screen>
    );
  }

  const activity: Entry[] = [
    ...quit.flatMap((habit) =>
      habit.relapses.map((relapse, index) => ({
        key: `${habit.id}-r${index}`,
        icon: 'restart' as IconName,
        title: t('habitRestarted', { title: habit.title }),
        detail: t('streakEnded', {
          duration: formatDuration(relapse.lastedMs, lang),
          date: formatDate(relapse.at, lang),
        }),
        at: Date.parse(relapse.at),
      })),
    ),
    ...sessions.map((session) => ({
      key: session.id,
      icon: (session.completed ? 'check' : 'close') as IconName,
      title: session.completed ? t('sessionDone') : t('sessionAborted'),
      detail: `${formatDuration(session.durationMs, lang)} · ${formatDate(session.at, lang)}`,
      at: Date.parse(session.at),
    })),
  ]
    .filter((item) => Number.isFinite(item.at))
    .sort((a, b) => b.at - a.at)
    .slice(0, 12);

  return (
    <Screen>
      <ScreenTitle title={t('statsTitle')} subtitle={t('statsSubtitle')} />

      {/* --- полезные привычки --- */}

      {build.length > 0 ? (
        <>
          <SectionLabel>{t('sectionBuild')}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat
              icon="spark"
              label={t('topStreak')}
              value={`🔥 ${buildTotals.top}`}
              caption={plural(buildTotals.record, 'day') + ' — ' + t('bestStreak').toLowerCase()}
            />
            <Stat icon="check" label={t('doneTotal')} value={String(buildTotals.marks)} />
            <Stat
              icon="flag"
              label={t('todaySection')}
              value={`${buildTotals.doneToday} / ${buildTotals.dueToday}`}
            />
            <Stat icon="shield" label={t('habitsTracked')} value={String(build.length)} />
          </div>

          <Group>
            {build.map((habit, index) => {
              const streak = streakOf(habit, today);
              return (
                <Row
                  key={habit.id}
                  icon={habit.icon as IconName}
                  title={habit.title}
                  detail={`${t('topStreak')}: ${plural(streak.best, 'day')} · ${streak.last30.done}/${streak.last30.planned} ${t('last30').toLowerCase()}`}
                  value={`🔥 ${streak.current}`}
                  last={index === build.length - 1}
                />
              );
            })}
          </Group>
        </>
      ) : null}

      {/* --- отказ --- */}

      {quit.length > 0 ? (
        <>
          <SectionLabel>{t('sectionQuit')}</SectionLabel>
          <div className="grid grid-cols-2 gap-2.5">
            <Stat icon="clock" label={t('statTotalClean')} value={formatDuration(totals.clean, lang)} />
            <Stat icon="trophy" label={t('statLongest')} value={formatDuration(totals.best, lang)} />
            {totals.saved > 0 ? (
              <Stat icon="coins" label={t('statSaved')} value={formatMoney(totals.saved, currency, lang)} />
            ) : null}
            {totals.avoided > 0 ? (
              <Stat
                icon="target"
                label={t('statAvoided')}
                value={compactNumber(Math.floor(totals.avoided), lang)}
              />
            ) : null}
            <Stat icon="flag" label={t('statMilestones')} value={String(totals.milestones)} />
            <Stat
              icon="spark"
              label={t('statCravings')}
              value={String(wins)}
              caption={
                sessions.length > wins ? t('endedEarly', { count: sessions.length - wins }) : undefined
              }
            />
          </div>

          <Group>
            {quit.map((habit, index) => {
              const elapsed = Math.max(0, now - Date.parse(habit.startedAt));
              return (
                <Row
                  key={habit.id}
                  icon={habit.icon as IconName}
                  title={habit.title}
                  detail={t('bestAndRestarts', {
                    duration: formatDuration(Math.max(habit.bestStreakMs, elapsed), lang),
                    restarts: plural(habit.relapses.length, 'restart'),
                  })}
                  value={formatDuration(elapsed, lang)}
                  last={index === quit.length - 1}
                />
              );
            })}
          </Group>
        </>
      ) : null}

      {activity.length > 0 ? (
        <>
          <SectionLabel>{t('recentActivity')}</SectionLabel>
          <Group>
            {activity.map((item, index) => (
              <Row
                key={item.key}
                icon={item.icon}
                title={item.title}
                detail={item.detail}
                last={index === activity.length - 1}
              />
            ))}
          </Group>
        </>
      ) : null}
    </Screen>
  );
}
