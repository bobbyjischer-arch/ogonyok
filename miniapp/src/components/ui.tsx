import { useEffect, type ReactNode } from 'react';
import { Icon, type IconName } from './Icon';
import { haptic, showBackButton } from '../lib/telegram';

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-full w-full max-w-lg px-4 pt-safet">
      <div className="pb-[calc(var(--nav-height)+var(--safe-bottom)+28px)]">{children}</div>
    </div>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="px-1 pb-5 pt-6">
      <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em]">{title}</h1>
      {subtitle ? <p className="mt-1 text-[15px] leading-snug text-dim">{subtitle}</p> : null}
    </header>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 pb-2 pt-6 text-[13px] font-semibold uppercase tracking-[0.06em] text-faint">
      {children}
    </h2>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white',
  secondary: 'glass-card glass-shine text-ink',
  danger: 'bg-danger text-white',
  ghost: 'bg-transparent text-accent',
};

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  full?: boolean;
  type?: 'button' | 'submit';
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  icon,
  disabled,
  full = true,
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic.impact('light');
        onClick?.();
      }}
      // min-h, not h: a label that wraps (long word, narrow phone, other
      // language) has to push the outline down instead of spilling out of it.
      className={`pressable inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[14px] px-4 py-2 text-center text-[16px] font-semibold leading-tight outline-none disabled:opacity-40 ${
        BUTTON_STYLES[variant]
      } ${full ? 'w-full' : ''}`}
    >
      {icon ? <Icon name={icon} size={19} strokeWidth={2} className="shrink-0" /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Grouped rows                                                        */
/* ------------------------------------------------------------------ */

export function Group({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-card glass-card">{children}</div>;
}

interface RowProps {
  icon?: IconName;
  title: string;
  detail?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  last?: boolean;
}

export function Row({
  icon,
  title,
  detail,
  value,
  onClick,
  chevron,
  destructive,
  last,
}: RowProps) {
  const interactive = Boolean(onClick);
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => {
        haptic.impact('light');
        onClick?.();
      }}
      className={`flex w-full items-center gap-3 px-4 text-left ${
        interactive ? 'pressable' : 'cursor-default'
      }`}
    >
      {icon ? (
        <span className={`shrink-0 ${destructive ? 'text-danger' : 'text-dim'}`}>
          <Icon name={icon} size={21} />
        </span>
      ) : null}
      <span
        className={`flex min-w-0 flex-1 items-center gap-3 py-[13px] ${
          last ? '' : 'border-b hairline'
        }`}
      >
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[16px] leading-tight ${
              destructive ? 'text-danger' : 'text-ink'
            }`}
          >
            {title}
          </span>
          {detail ? (
            <span className="mt-0.5 block truncate text-[13px] leading-tight text-dim">
              {detail}
            </span>
          ) : null}
        </span>
        {value ? <span className="shrink-0 text-[15px] text-dim num">{value}</span> : null}
        {chevron ? (
          <span className="shrink-0 text-faint">
            <Icon name="chevronRight" size={17} strokeWidth={2.2} />
          </span>
        ) : null}
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom sheet                                                        */
/* ------------------------------------------------------------------ */

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export function Sheet({ open, onClose, title, children }: SheetProps) {
  // While a sheet is up, Telegram's back button dismisses it instead of
  // navigating away from the app.
  useEffect(() => {
    if (!open) return undefined;
    const restore = showBackButton(onClose);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      restore();
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in bg-black/35 backdrop-blur-[2px]"
      />
      <div className="relative animate-sheet-in rounded-t-xl3 bg-bg/80 glass-shine pb-safeb shadow-[0_-8px_40px_rgba(0,0,0,0.18)] backdrop-blur-[20px]">
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="h-[5px] w-9 rounded-full bg-ink/15" />
        </div>
        {title ? (
          <div className="flex items-center justify-between px-4 pb-1 pt-2">
            <h2 className="text-[20px] font-bold tracking-[-0.01em]">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              className="pressable -mr-1 flex h-8 w-8 items-center justify-center rounded-full bg-surface text-dim"
              aria-label="Close"
            >
              <Icon name="close" size={16} strokeWidth={2.4} />
            </button>
          </div>
        ) : null}
        <div className="max-h-[78vh] overflow-y-auto scroll-area px-4 pb-5 pt-3">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block px-1 text-[13px] font-medium text-dim">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block px-1 text-[12px] text-faint">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  'h-[50px] w-full rounded-[13px] bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:ring-2 focus:ring-accent/35';

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={INPUT_CLASS} />;
}

/* ------------------------------------------------------------------ */
/* Progress ring                                                       */
/* ------------------------------------------------------------------ */

interface RingProps {
  progress: number;
  size?: number;
  width?: number;
  className?: string;
  children?: ReactNode;
  trackClass?: string;
}

export function Ring({
  progress,
  size = 220,
  width = 8,
  className = 'text-accent',
  trackClass = 'text-ink/10',
  children,
}: RingProps) {
  const radius = (size - width) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={width}
          className={trackClass}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className={`${className} transition-[stroke-dashoffset] duration-500 ease-spring`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-[20px] glass-card glass-shine text-faint">
        <Icon name={icon} size={28} />
      </span>
      <h3 className="text-[17px] font-semibold">{title}</h3>
      <p className="mt-1.5 max-w-[280px] text-[15px] leading-snug text-dim">{body}</p>
      {action ? <div className="mt-6 w-full max-w-[240px]">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

export function Stat({
  icon,
  label,
  value,
  caption,
}: {
  icon: IconName;
  label: string;
  value: string;
  caption?: string;
}) {
  return (
    <div className="rounded-card glass-card glass-shine p-4">
      <span className="text-dim">
        <Icon name={icon} size={20} />
      </span>
      <p className="mt-3 text-[22px] font-bold leading-none tracking-[-0.02em] num">{value}</p>
      <p className="mt-1.5 text-[13px] leading-tight text-dim">{label}</p>
      {caption ? <p className="mt-0.5 text-[12px] leading-tight text-faint">{caption}</p> : null}
    </div>
  );
}
