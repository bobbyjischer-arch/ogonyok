import { useCallback, useEffect, useMemo, useState } from 'react';
import { CuratorPanel } from './components/CuratorPanel';
import { HabitDetail } from './components/HabitDetail';
import { HabitEditor } from './components/HabitEditor';
import { NavBar, type TabKey } from './components/NavBar';
import { Owl } from './components/Owl';
import { Loading, Status } from './components/Status';
import { ActivitiesScreen } from './screens/ActivitiesScreen';
import { FocusScreen } from './screens/FocusScreen';
import { HabitsScreen } from './screens/HabitsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ApiError, api, type ApiClient } from './lib/api';
import {
  DEFAULT_LANG,
  I18nProvider,
  asLang,
  translate,
  type Lang,
  type TranslationKey,
} from './lib/i18n';
import { mockClient } from './lib/mock';
import { haptic, inTelegram, isPreview, setAppearance } from './lib/telegram';
import type { PaletteId, ThemeMode } from './lib/theme';
import type { ActivityPatch, Habit, HabitDraft, HabitMode, State } from './lib/types';

/* ------------------------------------------------------------------ */
/* Ошибки                                                              */
/* ------------------------------------------------------------------ */

const ERROR_KEYS: Record<string, TranslationKey> = {
  network: 'errNetwork',
  unauthorized: 'errUnauthorized',
  forbidden: 'errForbidden',
};

const errorKey = (code: string): TranslationKey => ERROR_KEYS[code] ?? 'errGeneric';
const codeOf = (error: unknown): string => (error instanceof ApiError ? error.code : 'generic');

function Toast({ text }: { text: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-safet">
      <p className="mt-3 animate-fade-in rounded-full bg-danger px-4 py-2 text-[14px] font-medium text-white shadow-lg">
        {text}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Приложение                                                          */
/* ------------------------------------------------------------------ */

type Boot = 'loading' | 'ready' | 'outside' | 'error';

export default function App() {
  // В превью тот же интерфейс работает против локального мока, без сервера.
  const client: ApiClient = useMemo(() => (isPreview() ? mockClient : api), []);

  const [boot, setBoot] = useState<Boot>('loading');
  const [errorCode, setErrorCode] = useState('generic');
  const [state, setState] = useState<State | null>(null);
  const [tab, setTab] = useState<TabKey>('activities');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [openHabitId, setOpenHabitId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; habit: Habit | null; mode: HabitMode }>({
    open: false,
    habit: null,
    mode: 'build',
  });

  const lang: Lang = asLang(state?.user.settings.language ?? DEFAULT_LANG);

  /* --- загрузка --- */

  const load = useCallback(() => {
    setBoot('loading');
    client
      .load()
      .then((next) => {
        setState(next);
        setBoot('ready');

        // Оформление хранится на сервере, чтобы тема совпадала на всех
        // устройствах; локальная копия нужна только для первой отрисовки.
        setAppearance({
          mode: next.user.settings.theme,
          palette: next.user.settings.palette,
        });

        // Часовой пояс устройства уезжает на сервер, чтобы «сегодня» в боте и
        // в приложении означало одни и те же сутки.
        const tzOffset = -new Date().getTimezoneOffset();
        if (next.user.settings.tzOffset !== tzOffset) {
          client
            .updateSettings({ tzOffset })
            .then(setState)
            .catch(() => undefined);
        }
      })
      .catch((error: unknown) => {
        setErrorCode(codeOf(error));
        setBoot('error');
      });
  }, [client]);

  useEffect(() => {
    if (!inTelegram() && !isPreview()) {
      setBoot('outside');
      return;
    }
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  // Заголовок вкладки берётся с сервера: бандл один на обе версии.
  useEffect(() => {
    if (state?.appName) document.title = state.appName;
  }, [state?.appName]);

  /* --- мутации --- */

  /** Любое действие: сервер отвечает свежим состоянием, клиент его подменяет. */
  const run = useCallback(
    async (action: () => Promise<State>): Promise<void> => {
      setBusy(true);
      try {
        setState(await action());
      } catch (error) {
        haptic.notify('error');
        setToast(translate(lang, errorKey(codeOf(error))));
      } finally {
        setBusy(false);
      }
    },
    [lang],
  );

  const startActivity = useCallback(
    (kind: string) => {
      void run(() => client.startActivity(kind));
    },
    [client, run],
  );

  const stopActivity = useCallback(
    (id: string) => {
      haptic.notify('success');
      void run(() => client.stopActivity(id));
    },
    [client, run],
  );

  const checkin = useCallback(
    (id: string, text: string) => run(() => client.checkin(id, text)),
    [client, run],
  );

  // Возвращают промис: панель куратора ждёт завершения, чтобы перезапросить
  // чужие события — в собственном снимке их нет.
  const patchActivity = useCallback(
    (id: string, patch: ActivityPatch) => run(() => client.patchActivity(id, patch)),
    [client, run],
  );

  const deleteActivity = useCallback(
    (id: string) => run(() => client.deleteActivity(id)),
    [client, run],
  );

  const submitHabit = useCallback(
    (draft: HabitDraft) => {
      const target = editor.habit;
      setEditor({ open: false, habit: null, mode: draft.mode });
      setOpenHabitId(null);
      void run(() => (target ? client.updateHabit(target.id, draft) : client.createHabit(draft)));
    },
    [client, editor.habit, run],
  );

  const toggleHabitDay = useCallback(
    (habitId: string, day: string) => {
      void run(() => client.toggleDay(habitId, day));
    },
    [client, run],
  );

  const completeFocus = useCallback(
    (payload: { habitId: string | null; durationMs: number; completed: boolean }) => {
      void run(() => client.addFocus(payload));
    },
    [client, run],
  );

  const changeCurrency = useCallback(
    (currency: string) => {
      void run(() => client.updateSettings({ currency }));
    },
    [client, run],
  );

  const changeLanguage = useCallback(
    (next: Lang) => {
      void run(() => client.updateSettings({ language: next }));
    },
    [client, run],
  );

  const toggleNotifications = useCallback(
    (notifications: boolean) => {
      void run(() => client.updateSettings({ notifications }));
    },
    [client, run],
  );

  // Цвета меняем сразу, не дожидаясь ответа сервера: ждать перекраску обидно.
  const changeTheme = useCallback(
    (mode: ThemeMode) => {
      setAppearance({ mode });
      void run(() => client.updateSettings({ theme: mode }));
    },
    [client, run],
  );

  const changePalette = useCallback(
    (palette: PaletteId) => {
      setAppearance({ palette });
      void run(() => client.updateSettings({ palette }));
    },
    [client, run],
  );

  const closeHabitDetail = useCallback(() => setOpenHabitId(null), []);
  const closeEditor = useCallback(
    () => setEditor((prev) => ({ ...prev, open: false, habit: null })),
    [],
  );

  /* --- экраны состояния --- */

  if (boot === 'outside') {
    return (
      <Status
        icon="info"
        title={translate(DEFAULT_LANG, 'outsideTitle')}
        body={translate(DEFAULT_LANG, 'outsideBody')}
      />
    );
  }

  if (boot === 'error') {
    return (
      <Status
        icon="info"
        title={translate(lang, 'errorTitle')}
        body={translate(lang, errorKey(errorCode))}
        primary={{ label: translate(lang, 'tryAgain'), onClick: load }}
      />
    );
  }

  if (boot === 'loading' || !state) return <Loading />;

  const { user, habits, sessions, activities, current, types, channelUrl, today, isPublic } = state;
  // Держим привычку по id: после мутации приезжает новый объект состояния.
  const detailHabit = habits.find((habit) => habit.id === openHabitId) ?? null;

  return (
    <I18nProvider lang={lang}>
      <div className="min-h-full">
        {tab === 'activities' ? (
          <ActivitiesScreen
            activities={activities}
            current={current}
            types={types}
            busy={busy}
            onStart={startActivity}
            onStop={stopActivity}
            onCheckin={checkin}
            onPatch={patchActivity}
            onDelete={deleteActivity}
          />
        ) : null}

        {tab === 'habits' ? (
          <HabitsScreen
            habits={habits}
            today={today}
            busy={busy}
            onAdd={(mode) => setEditor({ open: true, habit: null, mode })}
            onOpen={(habit) => setOpenHabitId(habit.id)}
            onToggleDay={(habit) => toggleHabitDay(habit.id, today)}
          />
        ) : null}

        {tab === 'focus' ? <FocusScreen habits={habits} onComplete={completeFocus} /> : null}

        {tab === 'stats' ? (
          <StatsScreen
            habits={habits}
            sessions={sessions}
            currency={user.settings.currency}
            today={today}
          />
        ) : null}

        {tab === 'profile' ? (
          <ProfileScreen
            user={user}
            habits={habits}
            sessions={sessions}
            channelUrl={channelUrl}
            onCurrencyChange={changeCurrency}
            onLanguageChange={changeLanguage}
            onThemeChange={changeTheme}
            onPaletteChange={changePalette}
            extra={
              user.role === 'curator' ? (
                <CuratorPanel
                  client={client}
                  types={types}
                  notifications={user.settings.notifications}
                  busy={busy}
                  onToggleNotifications={toggleNotifications}
                  onPatchActivity={patchActivity}
                  onDeleteActivity={deleteActivity}
                />
              ) : null
            }
          />
        ) : null}

        <NavBar active={tab} onChange={setTab} />
        {/* Сова — часть закрытой версии; в публичной её нет. */}
        {isPublic ? null : (
          <Owl current={current} activities={activities} habits={habits} today={today} />
        )}

        <HabitDetail
          habit={detailHabit}
          currency={user.settings.currency}
          today={today}
          busy={busy}
          onClose={closeHabitDetail}
          onToggleDay={(day) => {
            if (detailHabit) toggleHabitDay(detailHabit.id, day);
          }}
          onEdit={() => {
            if (detailHabit) setEditor({ open: true, habit: detailHabit, mode: detailHabit.mode });
            setOpenHabitId(null);
          }}
          onRelapse={() => {
            if (!detailHabit) return;
            setOpenHabitId(null);
            void run(() => client.relapse(detailHabit.id));
          }}
          onDelete={() => {
            if (!detailHabit) return;
            setOpenHabitId(null);
            void run(() => client.deleteHabit(detailHabit.id));
          }}
        />

        <HabitEditor
          open={editor.open}
          habit={editor.habit}
          mode={editor.mode}
          currency={user.settings.currency}
          busy={busy}
          onClose={closeEditor}
          onSubmit={submitHabit}
        />

        {toast ? <Toast text={toast} /> : null}
      </div>
    </I18nProvider>
  );
}
