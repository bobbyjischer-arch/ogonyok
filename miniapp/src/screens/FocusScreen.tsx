import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Button, Ring, Screen, ScreenTitle } from '../components/ui';
import { formatCountdown } from '../lib/time';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { haptic } from '../lib/telegram';
import type { Habit } from '../lib/types';

const PRESETS = [2, 5, 10, 15];

/** Box breathing: four equal phases, cycled for as long as the timer runs. */
const PHASES: TranslationKey[] = ['breatheIn', 'breatheHold', 'breatheOut', 'breatheHold'];
const PHASE_MS = 4000;

type Status = 'idle' | 'running' | 'done';

interface FocusScreenProps {
  habits: Habit[];
  onComplete: (payload: { habitId: string | null; durationMs: number; completed: boolean }) => void;
}

export function FocusScreen({ habits, onComplete }: FocusScreenProps) {
  const { t } = useI18n();
  const [minutes, setMinutes] = useState(5);
  const [habitId, setHabitId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [remaining, setRemaining] = useState(minutes * 60_000);
  const deadline = useRef(0);

  const totalMs = minutes * 60_000;

  // A wall-clock deadline rather than a decrementing counter, so a
  // backgrounded webview resumes with the correct time left. Ticking at 4 Hz
  // is plenty: the readout only changes once a second, and the ring smooths
  // the steps out with its own transition.
  useEffect(() => {
    if (status !== 'running') return undefined;
    const tick = () => {
      const left = deadline.current - Date.now();
      if (left <= 0) {
        setRemaining(0);
        setStatus('done');
        haptic.notify('success');
        onComplete({ habitId, durationMs: totalMs, completed: true });
        return;
      }
      setRemaining(left);
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [status, habitId, totalMs, onComplete]);

  useEffect(() => {
    if (status === 'idle') setRemaining(minutes * 60_000);
  }, [minutes, status]);

  const start = useCallback(() => {
    deadline.current = Date.now() + minutes * 60_000;
    setRemaining(minutes * 60_000);
    setStatus('running');
    haptic.impact('medium');
  }, [minutes]);

  const stop = useCallback(() => {
    const elapsed = totalMs - Math.max(0, deadline.current - Date.now());
    setStatus('idle');
    setRemaining(minutes * 60_000);
    haptic.impact('soft');
    if (elapsed > 3000) onComplete({ habitId, durationMs: elapsed, completed: false });
  }, [habitId, minutes, onComplete, totalMs]);

  const reset = useCallback(() => {
    setStatus('idle');
    setRemaining(minutes * 60_000);
  }, [minutes]);

  const progress = totalMs === 0 ? 0 : 1 - remaining / totalMs;
  const elapsedMs = totalMs - remaining;
  const phase = PHASES[Math.floor(elapsedMs / PHASE_MS) % PHASES.length];
  const selected = habits.find((habit) => habit.id === habitId) ?? null;

  return (
    <Screen>
      <ScreenTitle title={t('focusTitle')} subtitle={t('focusSubtitle')} />

      <div className="flex flex-col items-center pt-4">
        <Ring
          progress={progress}
          size={244}
          width={7}
          className={status === 'done' ? 'text-positive' : 'text-accent'}
        >
          {status === 'done' ? (
            <>
              <span className="text-positive">
                <Icon name="check" size={38} strokeWidth={2.2} />
              </span>
              <span className="mt-3 text-[17px] font-semibold">{t('cravingOutlasted')}</span>
            </>
          ) : (
            <>
              <span className="text-[52px] font-bold leading-none tracking-[-0.04em] num">
                {formatCountdown(remaining)}
              </span>
              <span className="mt-3 h-[18px] text-[14px] font-medium text-dim">
                {status === 'running' ? t(phase) : t('focusSession', { minutes })}
              </span>
            </>
          )}
        </Ring>
      </div>

      {status === 'idle' ? (
        <>
          <div className="mt-8 flex gap-2">
            {PRESETS.map((preset) => {
              const active = preset === minutes;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    haptic.select();
                    setMinutes(preset);
                  }}
                  aria-pressed={active}
                  className={`pressable h-11 flex-1 rounded-[13px] text-[15px] font-semibold transition-colors ${
                    active ? 'bg-accent text-white' : 'bg-surface text-dim'
                  }`}
                >
                  {preset}
                  {t('minShort')}
                </button>
              );
            })}
          </div>

          {habits.length > 0 ? (
            <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto scroll-area px-4 pb-1">
              <Chip label={t('noHabit')} active={habitId === null} onClick={() => setHabitId(null)} />
              {habits.map((habit) => (
                <Chip
                  key={habit.id}
                  label={habit.title}
                  icon={habit.icon as IconName}
                  active={habitId === habit.id}
                  onClick={() => setHabitId(habit.id)}
                />
              ))}
            </div>
          ) : null}

          <div className="mt-6">
            <Button icon="play" onClick={start}>
              {t('startSession')}
            </Button>
          </div>
        </>
      ) : null}

      {status === 'running' ? (
        <div className="mt-8 space-y-2.5">
          <p className="px-2 text-center text-[15px] leading-snug text-dim">
            {selected ? t('focusRunningWith', { title: selected.title }) : t('focusRunningPlain')}{' '}
            {t('focusRunningTail')}
          </p>
          <Button variant="secondary" icon="close" onClick={stop}>
            {t('endSession')}
          </Button>
        </div>
      ) : null}

      {status === 'done' ? (
        <div className="mt-8 space-y-2.5">
          <p className="px-2 text-center text-[15px] leading-snug text-dim">{t('focusDoneBody')}</p>
          <Button icon="restart" onClick={reset}>
            {t('anotherSession')}
          </Button>
        </div>
      ) : null}
    </Screen>
  );
}

function Chip({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: IconName;
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
      className={`pressable flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-colors ${
        active ? 'bg-accent text-white' : 'bg-surface text-dim'
      }`}
    >
      {icon ? <Icon name={icon} size={15} className="shrink-0" /> : null}
      {/* Habit titles run up to 40 characters — clip instead of stretching the chip. */}
      <span className="max-w-[46vw] truncate">{label}</span>
    </button>
  );
}
