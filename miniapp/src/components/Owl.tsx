import { useCallback, useEffect, useRef, useState } from 'react';
import { activityLabelKey } from '../lib/activities';
import { useI18n, type Params, type TranslationKey } from '../lib/i18n';
import { streakOf } from '../lib/streak';
import { haptic } from '../lib/telegram';
import { formatDuration } from '../lib/time';
import type { Activity, Habit } from '../lib/types';

/**
 * Сова живёт над панелью навигации, сидит на ветке и ведёт себя как питомец:
 * моргает, вертит головой, засыпает от безделья и по тапу говорит что-нибудь
 * по делу — про текущее занятие, последнее завершённое или огонёк привычки.
 */

/** Сколько сидеть без внимания до того, как задремать. */
const SLEEP_AFTER_MS = 45_000;
const BUBBLE_MS = 4600;

const localDayOf = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

interface Phrase {
  key: TranslationKey;
  params?: Params;
}

interface OwlProps {
  current: Activity | null;
  activities: Activity[];
  habits: Habit[];
  today: string;
}

export function Owl({ current, activities, habits, today }: OwlProps) {
  const { t, lang, plural } = useI18n();

  const [asleep, setAsleep] = useState(false);
  const [blinking, setBlinking] = useState(false);
  const [tilt, setTilt] = useState(0);
  const [line, setLine] = useState<string | null>(null);
  const [hop, setHop] = useState(0);

  const lastPoke = useRef(Date.now());
  const lastPhrase = useRef<TranslationKey | ''>('');

  /* --- засыпание --- */

  useEffect(() => {
    // Пока занятие идёт, сова на посту и не дремлет.
    if (current) {
      setAsleep(false);
      return undefined;
    }
    const timer = window.setInterval(() => {
      if (Date.now() - lastPoke.current > SLEEP_AFTER_MS) setAsleep(true);
    }, 4000);
    return () => clearInterval(timer);
  }, [current]);

  /* --- моргание и повороты головы --- */

  useEffect(() => {
    if (asleep) return undefined;
    let blinkTimer = 0;
    const scheduleBlink = () => {
      blinkTimer = window.setTimeout(
        () => {
          setBlinking(true);
          window.setTimeout(() => setBlinking(false), 130);
          scheduleBlink();
        },
        2600 + Math.random() * 4200,
      );
    };
    scheduleBlink();
    return () => clearTimeout(blinkTimer);
  }, [asleep]);

  useEffect(() => {
    if (asleep) {
      setTilt(0);
      return undefined;
    }
    const timer = window.setInterval(
      () => setTilt(Math.floor(Math.random() * 3) - 1),
      7000 + Math.random() * 5000,
    );
    return () => clearInterval(timer);
  }, [asleep]);

  /* --- реплика --- */

  useEffect(() => {
    if (!line) return undefined;
    const timer = window.setTimeout(() => setLine(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [line]);

  const phrases = useCallback((): Phrase[] => {
    const out: Phrase[] = [];
    const hour = new Date().getHours();

    if (current) {
      const label = t(activityLabelKey(current.kind));
      const known: Record<string, TranslationKey> = {
        work: 'owlRunWork',
        sport: 'owlRunSport',
        reading: 'owlRunReading',
      };
      const key = known[current.kind];
      out.push(key ? { key } : { key: 'owlRunGeneric', params: { activity: label } });
      out.push({ key: 'owlWatching' });
    } else {
      const finished = activities.find(
        (activity) => activity.endedAt && localDayOf(activity.startedAt) === today,
      );
      if (finished?.endedAt) {
        out.push({
          key: 'owlLastToday',
          params: {
            activity: t(activityLabelKey(finished.kind)),
            duration: formatDuration(
              Date.parse(finished.endedAt) - Date.parse(finished.startedAt),
              lang,
            ),
          },
        });
      } else {
        out.push({ key: 'owlNothingToday' });
      }
    }

    const build = habits.filter((habit) => habit.mode === 'build');
    let topStreak = 0;
    let due: Habit | null = null;
    for (const habit of build) {
      const streak = streakOf(habit, today);
      if (streak.current > topStreak) topStreak = streak.current;
      if (!due && streak.scheduledToday && !streak.doneToday) due = habit;
    }
    if (topStreak > 1) out.push({ key: 'owlStreak', params: { days: plural(topStreak, 'day') } });
    if (due) out.push({ key: 'owlDue', params: { title: due.title } });

    if (hour >= 23 || hour < 6) out.push({ key: 'owlNight' });
    else if (hour < 10) out.push({ key: 'owlMorning' });

    out.push({ key: 'owlWho' });
    return out;
  }, [activities, current, habits, lang, plural, t, today]);

  const poke = useCallback(() => {
    haptic.impact('light');
    lastPoke.current = Date.now();
    setHop((n) => n + 1);

    const wasAsleep = asleep;
    setAsleep(false);

    if (wasAsleep) {
      lastPhrase.current = 'owlSleepy';
      setLine(t('owlSleepy'));
      return;
    }

    // Два раза подряд одну и ту же фразу не говорим.
    const options = phrases();
    const fresh = options.filter((phrase) => phrase.key !== lastPhrase.current);
    const pool = fresh.length > 0 ? fresh : options;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    lastPhrase.current = picked.key;
    setLine(t(picked.key, picked.params));
  }, [asleep, phrases, t]);

  return (
    <div className="owl-wrap" aria-hidden={false}>
      <div className="relative">
        {line ? (
          <div className="owl-bubble pointer-events-none absolute bottom-[108px] right-[4px] w-max max-w-[min(232px,62vw)] rounded-[14px] border hairline bg-bg/90 px-3.5 py-2 text-[13px] font-medium leading-snug text-ink shadow-[0_8px_28px_rgba(0,0,0,0.18)] backdrop-blur-[12px]">
            {line}
            <span className="absolute -bottom-[6px] right-[26px] h-3 w-3 rotate-45 border-b border-r hairline bg-bg/90" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={poke}
          aria-label={t('owlLabel')}
          className="owl-tap block"
        >
          {/* Прыжок пересоздаётся по ключу, дыхание и покачивание — постоянные. */}
          <span key={hop} className={hop > 0 ? 'owl-hop block' : 'block'}>
            <span className={asleep ? 'owl-asleep block' : 'owl-breathe block'}>
              <OwlArt asleep={asleep} blinking={blinking} tilt={tilt} />
            </span>
          </span>
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Рисунок                                                             */
/* ------------------------------------------------------------------ */

const BODY = '#A0785A';
const DARK = '#8A6248';
const FACE = '#C39A76';
const BELLY = '#EFE0CC';
const LINES = '#D6BFA3';
const BEAK = '#E9A23B';
const SCLERA = '#FFF7EC';
const PUPIL = '#2A211C';
const BRANCH = '#7A5C46';
const LEAF = '#5E8F5A';

function OwlArt({ asleep, blinking, tilt }: { asleep: boolean; blinking: boolean; tilt: number }) {
  const eyesShut = asleep || blinking;

  return (
    <svg width="98" height="122" viewBox="0 0 120 150" fill="none" aria-hidden="true">
      {/* ветка */}
      <path
        d="M120 119C102 113 86 123 60 119c-18-3-32 1-52-2"
        stroke={BRANCH}
        strokeWidth="7"
        strokeLinecap="round"
      />
      <path d="M97 118c5-7 11-11 20-13" stroke={BRANCH} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="114" cy="103" rx="7.5" ry="4" fill={LEAF} transform="rotate(-30 114 103)" />
      <ellipse cx="103" cy="110" rx="6" ry="3.4" fill={LEAF} transform="rotate(-14 103 110)" />

      {/* лапы */}
      <g stroke={BEAK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M52 100v14M52 114l-4.5 3.5M52 114l4.5 3.5" />
        <path d="M70 100v14M70 114l-4.5 3.5M70 114l4.5 3.5" />
      </g>

      {/* крылья */}
      <path d="M30 62c-8 14-6 30 4 40 2-14 0-28-4-40z" fill={DARK} />
      <path d="M92 62c8 14 6 30-4 40-2-14 0-28 4-40z" fill={DARK} />

      {/* тело */}
      <ellipse cx="61" cy="70" rx="33" ry="36" fill={BODY} />
      <ellipse cx="61" cy="84" rx="20" ry="21" fill={BELLY} />
      <path
        d="M53 78q8 5 16 0M53 88q8 5 16 0"
        stroke={LINES}
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />

      {/* голова целиком поворачивается — так живее, чем одни зрачки */}
      <g
        className="owl-head"
        style={{ transform: `rotate(${tilt * 6}deg)`, transformOrigin: '61px 80px' }}
      >
        <path d="M35 40 28 22l20 11z" fill={DARK} />
        <path d="M87 40 94 22 74 33z" fill={DARK} />
        <ellipse cx="61" cy="55" rx="28" ry="25" fill={FACE} />

        {eyesShut ? (
          <g stroke={PUPIL} strokeWidth="2.8" strokeLinecap="round" fill="none">
            <path d="M38 52q11 8 22 0" />
            <path d="M62 52q11 8 22 0" />
          </g>
        ) : (
          <>
            <circle cx="49" cy="53" r="12" fill={SCLERA} />
            <circle cx="73" cy="53" r="12" fill={SCLERA} />
            <g className="owl-pupil" style={{ transform: `translateX(${tilt * 2.4}px)` }}>
              <circle cx="49" cy="53" r="6.2" fill={PUPIL} />
              <circle cx="73" cy="53" r="6.2" fill={PUPIL} />
              <circle cx="51.4" cy="50.4" r="2" fill="#fff" opacity="0.85" />
              <circle cx="75.4" cy="50.4" r="2" fill="#fff" opacity="0.85" />
            </g>
          </>
        )}

        <path d="M61 58l-7 8q7 5 14 0z" fill={BEAK} />
      </g>

      {/* сон */}
      {asleep ? (
        <g fill={PUPIL} opacity="0.75" fontSize="13" fontWeight="700">
          <text className="owl-z" x="90" y="46" style={{ animationDelay: '0s' }}>
            z
          </text>
          <text className="owl-z" x="94" y="34" style={{ animationDelay: '1.1s' }} fontSize="11">
            z
          </text>
          <text className="owl-z" x="98" y="24" style={{ animationDelay: '2.2s' }} fontSize="9">
            z
          </text>
        </g>
      ) : null}
    </svg>
  );
}
