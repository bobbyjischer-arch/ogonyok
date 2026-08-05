import { useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { Group, Row, Screen, ScreenTitle, SectionLabel, Sheet } from '../components/ui';
import { formatDate } from '../lib/time';
import { LANGUAGES, useI18n, type Lang, type TranslationKey } from '../lib/i18n';
import { haptic, openLink } from '../lib/telegram';
import { PALETTES, type PaletteId, type ThemeMode } from '../lib/theme';
import type { Habit, Session, User } from '../lib/types';

const THEME_OPTIONS: { mode: ThemeMode; key: TranslationKey }[] = [
  { mode: 'auto', key: 'themeAuto' },
  { mode: 'light', key: 'themeLight' },
  { mode: 'dark', key: 'themeDark' },
];

/** Две точки — фон палитры и её акцент. */
function Swatch({ colors, big }: { colors: [string, string]; big?: boolean }) {
  return (
    <span className={`relative inline-block shrink-0 ${big ? 'h-7 w-7' : 'h-4 w-4'}`}>
      <span
        className="absolute inset-0 rounded-full border hairline"
        style={{ background: colors[0] }}
      />
      <span
        className="absolute bottom-0 right-0 h-[58%] w-[58%] rounded-full"
        style={{ background: colors[1] }}
      />
    </span>
  );
}

const CURRENCIES = ['RUB', 'USD', 'EUR', 'GBP', 'UAH', 'KZT', 'BYN', 'PLN', 'TRY', 'GEL'];

interface ProfileScreenProps {
  user: User;
  habits: Habit[];
  sessions: Session[];
  channelUrl: string | null;
  onCurrencyChange: (currency: string) => void;
  onLanguageChange: (lang: Lang) => void;
  onThemeChange: (mode: ThemeMode) => void;
  onPaletteChange: (palette: PaletteId) => void;
  /** Блок куратора: рисуется только у него, поэтому приходит сверху. */
  extra?: ReactNode;
}

export function ProfileScreen({
  user,
  habits,
  sessions,
  channelUrl,
  onCurrencyChange,
  onLanguageChange,
  onThemeChange,
  onPaletteChange,
  extra,
}: ProfileScreenProps) {
  const { t, lang } = useI18n();
  const [currencyOpen, setCurrencyOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Тема уже применена к документу — оттуда и берём, какой сейчас режим,
  // не пересчитывая системные предпочтения второй раз.
  const dark =
    typeof document === 'undefined'
      ? false
      : document.documentElement.classList.contains('dark');
  const themeLabel = t(
    THEME_OPTIONS.find((option) => option.mode === user.settings.theme)?.key ?? 'themeAuto',
  );
  const paletteMeta =
    PALETTES.find((item) => item.id === user.settings.palette) ?? PALETTES[0];

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || t('navProfile');
  const initials = (user.firstName || '?').trim().charAt(0).toUpperCase();
  const langLabel = LANGUAGES.find((item) => item.code === lang)?.label ?? lang;

  return (
    <Screen>
      <ScreenTitle title={t('profileTitle')} />

      <div className="flex items-center gap-4 px-1 pb-2">
        {user.photoUrl ? (
          <img
            src={user.photoUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-surface text-[24px] font-semibold text-dim">
            {initials}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[20px] font-bold tracking-[-0.01em]">{name}</p>
          <p className="mt-0.5 truncate text-[14px] text-dim">
            {user.username ? `@${user.username}` : formatDate(user.createdAt, lang)}
          </p>
        </div>
      </div>

      <SectionLabel>{t('summary')}</SectionLabel>
      <Group>
        <Row icon="shield" title={t('habitsTracked')} value={String(habits.length)} />
        <Row
          icon="timer"
          title={t('focusSessions')}
          value={String(sessions.length)}
          detail={t('completedCount', { count: sessions.filter((s) => s.completed).length })}
        />
        <Row icon="calendar" title={t('memberSince')} value={formatDate(user.createdAt, lang)} last />
      </Group>

      {extra}

      <SectionLabel>{t('appearance')}</SectionLabel>
      <Group>
        <Row
          icon="moon"
          title={t('themeLabel')}
          value={themeLabel}
          onClick={() => setThemeOpen(true)}
          chevron
        />
        <Row
          icon="spark"
          title={t('paletteLabel')}
          value={
            <span className="inline-flex items-center gap-2">
              <Swatch colors={paletteMeta.swatch(dark)} />
              {t(paletteMeta.labelKey)}
            </span>
          }
          onClick={() => setPaletteOpen(true)}
          chevron
          last
        />
      </Group>

      <SectionLabel>{t('preferences')}</SectionLabel>
      <Group>
        <Row
          icon="globe"
          title={t('language')}
          value={langLabel}
          onClick={() => setLangOpen(true)}
          chevron
        />
        <Row
          icon="wallet"
          title={t('currency')}
          detail={t('currencyHint')}
          value={user.settings.currency}
          onClick={() => setCurrencyOpen(true)}
          chevron
          last
        />
      </Group>

      <SectionLabel>{t('about')}</SectionLabel>
      <Group>
        {channelUrl ? (
          <Row
            icon="users"
            title={t('ourChannel')}
            detail={t('ourChannelHint')}
            onClick={() => openLink(channelUrl)}
            chevron
          />
        ) : null}
        <Row icon="info" title={t('howItWorks')} detail={t('howItWorksHint')} last />
      </Group>

      <p className="px-1 pb-2 pt-8 text-center text-[12px] leading-relaxed text-faint">
        {t('footer')}
        <br />
        {t('footerNote')}
      </p>

      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)} title={t('themeLabel')}>
        <div className="space-y-2">
          {THEME_OPTIONS.map((option) => {
            const active = option.mode === user.settings.theme;
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => {
                  haptic.select();
                  onThemeChange(option.mode);
                  setThemeOpen(false);
                }}
                className={`pressable flex h-[52px] w-full items-center justify-between rounded-[13px] px-4 text-[16px] font-medium transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface text-ink'
                }`}
              >
                {t(option.key)}
                {active ? <Icon name="check" size={17} strokeWidth={2.4} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={paletteOpen} onClose={() => setPaletteOpen(false)} title={t('paletteLabel')}>
        <div className="space-y-2">
          {PALETTES.map((item) => {
            const active = item.id === user.settings.palette;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  haptic.select();
                  onPaletteChange(item.id);
                  setPaletteOpen(false);
                }}
                className={`pressable flex h-[56px] w-full items-center gap-3 rounded-[13px] px-4 text-left text-[16px] font-medium transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface text-ink'
                }`}
              >
                <Swatch colors={item.swatch(dark)} big />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{t(item.labelKey)}</span>
                  {item.id === 'telegram' ? (
                    <span
                      className={`block truncate text-[12px] ${active ? 'text-white/75' : 'text-faint'}`}
                    >
                      {t('paletteHint')}
                    </span>
                  ) : null}
                </span>
                {active ? <Icon name="check" size={17} strokeWidth={2.4} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('language')}>
        <div className="space-y-2">
          {LANGUAGES.map((item) => {
            const active = item.code === lang;
            return (
              <button
                key={item.code}
                type="button"
                onClick={() => {
                  haptic.select();
                  onLanguageChange(item.code);
                  setLangOpen(false);
                }}
                className={`pressable flex h-[52px] w-full items-center justify-between rounded-[13px] px-4 text-[16px] font-medium transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface text-ink'
                }`}
              >
                {item.label}
                {active ? <Icon name="check" size={17} strokeWidth={2.4} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>

      <Sheet open={currencyOpen} onClose={() => setCurrencyOpen(false)} title={t('currency')}>
        <div className="grid grid-cols-3 gap-2">
          {CURRENCIES.map((code) => {
            const active = code === user.settings.currency;
            return (
              <button
                key={code}
                type="button"
                onClick={() => {
                  haptic.select();
                  onCurrencyChange(code);
                  setCurrencyOpen(false);
                }}
                className={`pressable flex h-12 items-center justify-center gap-1.5 rounded-[13px] text-[15px] font-semibold transition-colors ${
                  active ? 'bg-accent text-white' : 'bg-surface text-ink'
                }`}
              >
                {code}
                {active ? <Icon name="check" size={15} strokeWidth={2.4} /> : null}
              </button>
            );
          })}
        </div>
      </Sheet>
    </Screen>
  );
}
