import { useEffect, useRef, useState } from 'react';
import { Icon, type IconName } from './Icon';
import { haptic } from '../lib/telegram';
import { useI18n, type TranslationKey } from '../lib/i18n';

export type TabKey = 'activities' | 'habits' | 'focus' | 'stats' | 'profile';

const TABS: { key: TabKey; label: TranslationKey; icon: IconName }[] = [
  { key: 'activities', label: 'navActivities', icon: 'clock' },
  { key: 'habits', label: 'navHabits', icon: 'shield' },
  { key: 'focus', label: 'navFocus', icon: 'timer' },
  { key: 'stats', label: 'navStats', icon: 'chart' },
  { key: 'profile', label: 'navProfile', icon: 'person' },
];

interface NavBarProps {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}

export function NavBar({ active, onChange }: NavBarProps) {
  const { t } = useI18n();
  const index = Math.max(
    0,
    TABS.findIndex((tab) => tab.key === active),
  );

  // Re-keying the pill on every move restarts the squash animation.
  const [travelKey, setTravelKey] = useState(0);
  const previous = useRef(index);

  useEffect(() => {
    if (previous.current !== index) {
      previous.current = index;
      setTravelKey((n) => n + 1);
    }
  }, [index]);

  const slot = 100 / TABS.length;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 glass-bar pb-safeb">
      {/* No padding on the row: the track's 20% and a button's flex-1 must measure
          the same box, otherwise the pill drifts off-centre by a few pixels. */}
      <div className="relative mx-auto flex h-[58px] w-full max-w-lg">
        {/* Indicator track — sits behind the buttons and slides between slots. */}
        <div
          className="pointer-events-none absolute inset-y-[6px] left-0 px-1 transition-transform duration-[420ms] ease-spring"
          style={{ width: `${slot}%`, transform: `translateX(${index * 100}%)` }}
          aria-hidden="true"
        >
          <div key={travelKey} className="pill-travel h-full w-full rounded-full glass-pill" />
        </div>

        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                if (isActive) return;
                haptic.select();
                onChange(tab.key);
              }}
              aria-current={isActive ? 'page' : undefined}
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] px-1.5 outline-none"
            >
              <Icon
                name={tab.icon}
                size={22}
                strokeWidth={isActive ? 1.9 : 1.7}
                className={`shrink-0 transition-colors duration-200 ${isActive ? 'text-ink' : 'text-faint'}`}
              />
              {/* The caption is capped by the button's content box, which sits 2px
                  inside the pill on each side — so it can never cross the outline. */}
              <span
                className={`block w-full truncate text-center text-nav transition-colors duration-200 ${
                  isActive ? 'font-semibold text-ink' : 'font-medium text-faint'
                }`}
              >
                {t(tab.label)}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
