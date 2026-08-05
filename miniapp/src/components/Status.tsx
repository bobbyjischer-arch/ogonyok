import { Icon, type IconName } from './Icon';
import { Button } from './ui';

export function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 28 28" className="animate-spin text-faint" aria-label="Loading">
        <circle
          cx="14"
          cy="14"
          r="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="18 52"
        />
      </svg>
    </div>
  );
}

interface StatusProps {
  icon: IconName;
  title: string;
  body: string;
  primary?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}

export function Status({ icon, title, body, primary, secondary }: StatusProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 pb-16 text-center">
      <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-[20px] bg-surface text-dim">
        <Icon name={icon} size={28} />
      </span>
      <h1 className="text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
      <p className="mt-2 max-w-[300px] text-[15px] leading-snug text-dim">{body}</p>
      <div className="mt-7 w-full max-w-[280px] space-y-2.5">
        {primary ? <Button onClick={primary.onClick}>{primary.label}</Button> : null}
        {secondary ? (
          <Button variant="secondary" onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
