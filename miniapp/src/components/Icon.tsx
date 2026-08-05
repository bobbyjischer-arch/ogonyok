import type { ReactNode, SVGProps } from 'react';
import type { TranslationKey } from '../lib/i18n';

/**
 * Single-stroke 24px icon set. Everything is drawn on the same grid with the
 * same weight so glyphs sit together without any optical mismatch.
 */
const paths: Record<string, ReactNode> = {
  /* --- navigation --- */
  shield: <path d="M12 3.2l7 2.9v5.4c0 4.2-2.9 7.7-7 8.6-4.1-.9-7-4.4-7-8.6V6.1l7-2.9z" />,
  timer: (
    <>
      <circle cx="12" cy="13.8" r="7.4" />
      <path d="M12 13.8V9.9M9.6 2.8h4.8M12 2.8v3.6" />
    </>
  ),
  chart: <path d="M3.5 20.4h17M7.6 20.4v-4.9M12 20.4v-8.9M16.4 20.4v-12.8" />,
  person: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20.3c0-3.7 3.2-5.6 7-5.6s7 1.9 7 5.6" />
    </>
  ),

  /* --- controls --- */
  plus: <path d="M12 5.2v13.6M5.2 12h13.6" />,
  minus: <path d="M5.2 12h13.6" />,
  chevronRight: <path d="M9.2 4.8l7.2 7.2-7.2 7.2" />,
  chevronLeft: <path d="M14.8 4.8L7.6 12l7.2 7.2" />,
  chevronDown: <path d="M4.8 9.2L12 16.4l7.2-7.2" />,
  check: <path d="M4.6 12.6l5 5 9.8-10.8" />,
  close: <path d="M6.2 6.2l11.6 11.6M17.8 6.2L6.2 17.8" />,
  restart: (
    <>
      <path d="M12 4.6a7.4 7.4 0 1 0 7.4 7.4" />
      <path d="M11.6 1.6l3.4 3-3.4 3" />
    </>
  ),
  trash: (
    <>
      <path d="M4.6 6.6h14.8M9.4 6.6V4.4h5.2v2.2" />
      <path d="M6.6 6.6l.9 13h9l.9-13M10.4 10.2v6M13.6 10.2v6" />
    </>
  ),
  pencil: (
    <>
      <path d="M4 20l.9-4.3L15.4 5.2a2.1 2.1 0 0 1 3 3L7.9 18.7 4 20z" />
      <path d="M13.6 7l3.4 3.4" />
    </>
  ),
  play: <path d="M8.2 5.4l10.2 6.6-10.2 6.6z" />,
  pause: <path d="M9.4 5.2v13.6M14.6 5.2v13.6" />,
  arrowUpRight: <path d="M7 17L17 7M8.6 7H17v8.4" />,
  share: (
    <>
      <path d="M12 15.2V3.6M8.2 7.2L12 3.4l3.8 3.8" />
      <path d="M5.2 13v5.6a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2V13" />
    </>
  ),

  /* --- habit categories --- */
  wind: <path d="M3.2 8.4h9.2a3 3 0 1 0-3-3M3.2 12.4h12.6a3 3 0 1 1-3 3M3.2 16.4h7" />,
  phone: (
    <>
      <rect x="7" y="2.6" width="10" height="18.8" rx="2.6" />
      <path d="M10.6 5.6h2.8" />
    </>
  ),
  glass: <path d="M4.4 4.4h15.2L12 12.6zM12 12.6v6M8.4 18.6h7.2" />,
  sugar: <path d="M12 3.2l7.2 4.1v9.4L12 20.8l-7.2-4.1V7.3zM4.8 7.3l7.2 4.1 7.2-4.1M12 11.4v9.4" />,
  dice: (
    <>
      <rect x="3.6" y="3.6" width="16.8" height="16.8" rx="4.2" />
      <path d="M8.7 8.7h.01M12 12h.01M15.3 15.3h.01" strokeWidth="2.6" />
    </>
  ),
  cart: (
    <>
      <path d="M2.8 4.2h2.3l2.4 10.6h9.6l2.1-7.9H6.2" />
      <circle cx="9.4" cy="19" r="1.5" />
      <circle cx="16.6" cy="19" r="1.5" />
    </>
  ),
  coffee: (
    <>
      <path d="M4.4 7.4h12v5.8a5 5 0 0 1-5 5H9.4a5 5 0 0 1-5-5z" />
      <path d="M16.4 8.8h1.4a2.6 2.6 0 0 1 0 5.2h-1.4M3.6 21h13.6" />
    </>
  ),
  moon: <path d="M20.2 14.6A8.6 8.6 0 0 1 9.4 3.8 8.6 8.6 0 1 0 20.2 14.6z" />,
  gamepad: (
    <>
      <rect x="2.6" y="7.4" width="18.8" height="9.6" rx="4.8" />
      <path d="M7.2 10.6v3.2M5.6 12.2h3.2" />
      <path d="M15.8 11.4h.01M18.2 13.8h.01" strokeWidth="2.6" />
    </>
  ),

  /* --- stats --- */
  trophy: (
    <>
      <path d="M7.2 3.8h9.6v4.9a4.8 4.8 0 0 1-9.6 0z" />
      <path d="M7.2 5.4H4.6v1a3.6 3.6 0 0 0 3 3.5M16.8 5.4h2.6v1a3.6 3.6 0 0 1-3 3.5" />
      <path d="M12 13.5v3.9M8.2 20.3h7.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 6.8v5.4l3.4 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.4" y="5" width="17.2" height="15.6" rx="3.2" />
      <path d="M3.4 10h17.2M8.2 2.8v4.2M15.8 2.8v4.2" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="12" cy="6.4" rx="7.2" ry="3.1" />
      <path d="M4.8 6.4v11.2c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1V6.4" />
      <path d="M4.8 12c0 1.7 3.2 3.1 7.2 3.1s7.2-1.4 7.2-3.1" />
    </>
  ),
  flag: <path d="M6 21V3.6M6 4.4h11.4l-2.3 4.2 2.3 4.2H6" />,
  spark: <path d="M12 3l1.95 5.55L19.5 10.5l-5.55 1.95L12 18l-1.95-5.55L4.5 10.5l5.55-2.05z" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <circle cx="12" cy="12" r="4.4" />
      <path d="M12 12h.01" strokeWidth="2.8" />
    </>
  ),

  /* --- misc --- */
  info: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.2v5.4M12 7.6h.01" strokeWidth="2" />
    </>
  ),
  lock: (
    <>
      <rect x="4.6" y="10" width="14.8" height="10.6" rx="3.2" />
      <path d="M8.2 10V7.6a3.8 3.8 0 0 1 7.6 0V10" />
    </>
  ),
  users: (
    <>
      <circle cx="9.4" cy="8.2" r="3.4" />
      <path d="M3.4 19.8c0-3.4 2.7-5.2 6-5.2s6 1.8 6 5.2" />
      <path d="M16.2 5.2a3.4 3.4 0 0 1 0 6.6M17.4 14.9c2.1.5 3.4 2.1 3.4 4.9" />
    </>
  ),
  bell: (
    <>
      <path d="M6.2 9.4a5.8 5.8 0 0 1 11.6 0c0 4.4 1.6 5.4 1.6 6.4H4.6c0-1 1.6-2 1.6-6.4z" />
      <path d="M10 19a2.1 2.1 0 0 0 4 0" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="5.6" width="18" height="13.8" rx="3.4" />
      <path d="M3 10.2h18M16.4 15h.01" strokeWidth="2.6" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.4a13 13 0 0 1 0 17.2 13 13 0 0 1 0-17.2z" />
    </>
  ),

  /* --- полезные привычки --- */
  book: (
    <>
      <path d="M12 6.6c-1.7-1.3-3.8-1.9-6.4-1.9H4.2v13.4h1.4c2.6 0 4.7.6 6.4 1.9" />
      <path d="M12 6.6c1.7-1.3 3.8-1.9 6.4-1.9h1.4v13.4h-1.4c-2.6 0-4.7.6-6.4 1.9" />
      <path d="M12 6.6v13.4" />
    </>
  ),
  drop: <path d="M12 3.4c0 0 5.6 5.7 5.6 9.6a5.6 5.6 0 0 1-11.2 0c0-3.9 5.6-9.6 5.6-9.6z" />,
  dumbbell: (
    <path d="M6.6 8.8v6.4M3.9 10.4v3.2M17.4 8.8v6.4M20.1 10.4v3.2M6.6 12h10.8" />
  ),
  heart: (
    <path d="M12 19.9l-6.5-6.3a4 4 0 0 1 5.7-5.7l.8.8.8-.8a4 4 0 0 1 5.7 5.7z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 3.2v2.3M12 18.5v2.3M3.2 12h2.3M18.5 12h2.3M5.9 5.9l1.6 1.6M16.5 16.5l1.6 1.6M18.1 5.9l-1.6 1.6M7.5 16.5l-1.6 1.6" />
    </>
  ),
};

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 24, strokeWidth = 1.7, ...rest }: IconProps) {
  const glyph = paths[name] ?? paths.shield;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {glyph}
    </svg>
  );
}

/** Категории для полезной привычки — той, которую заводят, а не бросают. */
export const BUILD_ICONS: { name: IconName; key: TranslationKey }[] = [
  { name: 'dumbbell', key: 'bcatSport' },
  { name: 'book', key: 'bcatReading' },
  { name: 'drop', key: 'bcatWater' },
  { name: 'sun', key: 'bcatMorning' },
  { name: 'moon', key: 'bcatSleep' },
  { name: 'heart', key: 'bcatHealth' },
  { name: 'timer', key: 'bcatMeditation' },
  { name: 'chart', key: 'bcatStudy' },
  { name: 'users', key: 'bcatSocial' },
  { name: 'target', key: 'bcatOther' },
];

/** Preset categories offered when creating a habit. */
export const HABIT_ICONS: { name: IconName; key: TranslationKey }[] = [
  { name: 'wind', key: 'catSmoking' },
  { name: 'glass', key: 'catAlcohol' },
  { name: 'sugar', key: 'catSugar' },
  { name: 'phone', key: 'catScreens' },
  { name: 'gamepad', key: 'catGaming' },
  { name: 'dice', key: 'catBetting' },
  { name: 'cart', key: 'catSpending' },
  { name: 'coffee', key: 'catCaffeine' },
  { name: 'moon', key: 'catLateNights' },
  { name: 'shield', key: 'catOther' },
];
