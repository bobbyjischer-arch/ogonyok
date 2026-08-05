import { useEffect, useState } from 'react';
import { BUILD_ICONS, HABIT_ICONS, Icon } from './Icon';
import { Button, Field, Sheet, TextInput } from './ui';
import { haptic } from '../lib/telegram';
import { useI18n } from '../lib/i18n';
import { EVERY_DAY, toggleBit } from '../lib/streak';
import type { Habit, HabitDraft, HabitMode } from '../lib/types';

function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return toLocalInput(new Date().toISOString());
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function fromLocalInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

const emptyDraft = (mode: HabitMode): HabitDraft => ({
  title: '',
  icon: mode === 'build' ? 'dumbbell' : 'wind',
  mode,
  daysMask: EVERY_DAY,
  startedAt: new Date().toISOString(),
  costPerDay: 0,
  unitsPerDay: 0,
  unitLabel: '',
});

interface HabitEditorProps {
  open: boolean;
  habit?: Habit | null;
  /** Режим для новой привычки; у существующей берётся её собственный. */
  mode: HabitMode;
  currency: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (draft: HabitDraft) => void;
}

export function HabitEditor({
  open,
  habit,
  mode,
  currency,
  busy,
  onClose,
  onSubmit,
}: HabitEditorProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState<HabitDraft>(() => emptyDraft(mode));

  // Форма пересобирается на каждое открытие, чтобы отменённая правка не
  // протекала в следующую.
  useEffect(() => {
    if (!open) return;
    setDraft(
      habit
        ? {
            title: habit.title,
            icon: habit.icon,
            mode: habit.mode,
            daysMask: habit.daysMask || EVERY_DAY,
            startedAt: habit.startedAt,
            costPerDay: habit.costPerDay,
            unitsPerDay: habit.unitsPerDay,
            unitLabel: habit.unitLabel,
          }
        : emptyDraft(mode),
    );
  }, [open, habit, mode]);

  const patch = (next: Partial<HabitDraft>) => setDraft((prev) => ({ ...prev, ...next }));
  const canSave = draft.title.trim().length > 0 && !busy;
  const isBuild = draft.mode === 'build';
  const presets = isBuild ? BUILD_ICONS : HABIT_ICONS;
  const weekdays = t('weekdaysShort').split(',');

  const sheetTitle = habit ? t('editHabit') : isBuild ? t('newBuildHabit') : t('createHabit');

  return (
    <Sheet open={open} onClose={onClose} title={sheetTitle}>
      <div className="space-y-4">
        {/* Режим выбирается только при создании: смена на лету перевернула бы
            смысл уже накопленной истории. */}
        {habit ? null : (
          <div>
            <span className="mb-2 block px-1 text-[13px] font-medium text-dim">
              {t('habitMode')}
            </span>
            <div className="flex gap-2">
              <ModeButton
                active={isBuild}
                title={t('modeBuild')}
                hint={t('modeBuildHint')}
                onClick={() => patch({ mode: 'build', icon: 'dumbbell' })}
              />
              <ModeButton
                active={!isBuild}
                title={t('modeQuit')}
                hint={t('modeQuitHint')}
                onClick={() => patch({ mode: 'quit', icon: 'wind' })}
              />
            </div>
          </div>
        )}

        <Field label={isBuild ? t('buildWhat') : t('quittingWhat')}>
          <TextInput
            value={draft.title}
            onChange={(event) => patch({ title: event.target.value.slice(0, 40) })}
            placeholder={isBuild ? t('buildPlaceholder') : t('quittingPlaceholder')}
            maxLength={40}
            autoComplete="off"
            enterKeyHint="done"
          />
        </Field>

        <div>
          <span className="mb-2 block px-1 text-[13px] font-medium text-dim">{t('category')}</span>
          <div className="grid grid-cols-5 gap-2">
            {presets.map((preset) => {
              const selected = draft.icon === preset.name;
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    haptic.select();
                    patch({
                      icon: preset.name,
                      // Название категории — только подсказка: уже набранное
                      // пользователем не перетираем.
                      title: draft.title.trim()
                        ? draft.title
                        : preset.name === 'shield' || preset.name === 'target'
                          ? ''
                          : t(preset.key),
                    });
                  }}
                  aria-pressed={selected}
                  className={`pressable flex aspect-square items-center justify-center rounded-[13px] transition-colors ${
                    selected ? 'bg-accent text-white' : 'bg-surface text-dim'
                  }`}
                  aria-label={t(preset.key)}
                >
                  <Icon name={preset.name} size={21} strokeWidth={selected ? 1.9 : 1.7} />
                </button>
              );
            })}
          </div>
        </div>

        {isBuild ? (
          <div>
            <span className="mb-2 block px-1 text-[13px] font-medium text-dim">
              {t('scheduleLabel')}
            </span>
            <div className="flex gap-1.5">
              {weekdays.map((label, index) => {
                const active = (draft.daysMask & (1 << index)) !== 0;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      haptic.select();
                      const next = toggleBit(draft.daysMask, index);
                      // Пустое расписание бессмысленно — последний день не снимаем.
                      patch({ daysMask: next === 0 ? draft.daysMask : next });
                    }}
                    aria-pressed={active}
                    className={`pressable h-11 flex-1 rounded-[12px] text-[13px] font-semibold transition-colors ${
                      active ? 'bg-accent text-white' : 'bg-surface text-faint'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <span className="mt-1.5 block px-1 text-[12px] text-faint">
              {draft.daysMask === EVERY_DAY ? t('everyDay') : t('scheduleHint')}
            </span>
          </div>
        ) : (
          <>
            <Field label={t('startedAt')} hint={habit ? t('startedAtHint') : undefined}>
              <input
                type="datetime-local"
                value={toLocalInput(draft.startedAt)}
                max={toLocalInput(new Date().toISOString())}
                onChange={(event) => patch({ startedAt: fromLocalInput(event.target.value) })}
                className="h-[50px] w-full rounded-[13px] bg-surface px-4 text-[16px] text-ink outline-none focus:ring-2 focus:ring-accent/35"
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={t('costPerDay', { currency })}>
                <TextInput
                  inputMode="decimal"
                  value={draft.costPerDay === 0 ? '' : String(draft.costPerDay)}
                  onChange={(event) =>
                    patch({ costPerDay: clampNumber(event.target.value, 100000) })
                  }
                  placeholder="0"
                />
              </Field>
              <Field label={t('unitsPerDay')}>
                <TextInput
                  inputMode="decimal"
                  value={draft.unitsPerDay === 0 ? '' : String(draft.unitsPerDay)}
                  onChange={(event) =>
                    patch({ unitsPerDay: clampNumber(event.target.value, 10000) })
                  }
                  placeholder="0"
                />
              </Field>
            </div>

            <Field label={t('unitName')} hint={t('unitNameHint')}>
              <TextInput
                value={draft.unitLabel}
                onChange={(event) => patch({ unitLabel: event.target.value.slice(0, 20) })}
                placeholder={t('unitPlaceholder')}
                maxLength={20}
                autoComplete="off"
              />
            </Field>
          </>
        )}

        <div className="pt-1">
          <Button
            disabled={!canSave}
            onClick={() => onSubmit({ ...draft, title: draft.title.trim() })}
          >
            {busy
              ? t('saving')
              : habit
                ? t('saveChanges')
                : isBuild
                  ? t('createBuild')
                  : t('startClock')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function ModeButton({
  active,
  title,
  hint,
  onClick,
}: {
  active: boolean;
  title: string;
  hint: string;
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
      className={`pressable flex-1 rounded-[13px] px-3 py-3 text-left transition-colors ${
        active ? 'bg-accent text-white' : 'bg-surface text-dim'
      }`}
    >
      <span className="block text-[15px] font-semibold">{title}</span>
      <span
        className={`mt-0.5 block text-[11px] leading-tight ${active ? 'text-white/80' : 'text-faint'}`}
      >
        {hint}
      </span>
    </button>
  );
}

function clampNumber(raw: string, max: number): number {
  const parsed = Number.parseFloat(raw.replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(parsed, max);
}
