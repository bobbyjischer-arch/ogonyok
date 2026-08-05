import { createContext, useContext, useMemo, type ReactNode } from 'react';

export type Lang = 'ru' | 'en';

export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

export const DEFAULT_LANG: Lang = 'ru';

export const asLang = (value: unknown): Lang => (value === 'en' ? 'en' : 'ru');

const LOCALES: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US' };

/* ------------------------------------------------------------------ */
/* Dictionary                                                          */
/* ------------------------------------------------------------------ */

const ru = {
  /* nav */
  navActivities: 'Занятия',
  navHabits: 'Привычки',
  navFocus: 'Фокус',
  navStats: 'Статистика',
  navProfile: 'Профиль',

  /* habits */
  habitsTitle: 'Привычки',
  newHabit: 'Новая привычка',
  totalClean: 'Всего без срывов',
  longestRun: 'дольше всего — {duration}',
  emptyHabitsTitle: 'Пока ничего не отслеживается',
  emptyHabitsBody: 'Добавьте привычку, с которой вы покончили. Отсчёт начнётся сразу.',
  emptyHabitsAction: 'Добавить привычку',
  cleanSince: 'Держитесь с {date}',
  nextMilestone: 'Дальше · {label}',
  recordDays: 'рекорд — {days}',

  /* focus */
  focusTitle: 'Фокус',
  focusSubtitle: 'Тяга нарастает и отпускает за несколько минут. Переждите её.',
  focusSession: 'сессия {minutes} мин',
  breatheIn: 'Вдох',
  breatheHold: 'Задержка',
  breatheOut: 'Выдох',
  noHabit: 'Без привычки',
  startSession: 'Начать сессию',
  endSession: 'Завершить',
  cravingOutlasted: 'Тяга пережита',
  focusRunningWith: 'Держитесь: {title}.',
  focusRunningPlain: 'Просто следите за дыханием.',
  focusRunningTail: 'Тяга уже идёт на спад.',
  focusDoneBody: 'Ещё одна тяга, которая не победила. Дальше будет легче.',
  anotherSession: 'Ещё одна сессия',

  /* stats */
  statsTitle: 'Статистика',
  statsSubtitle: 'Всё, что вам удалось удержать.',
  emptyStatsTitle: 'Данных пока нет',
  emptyStatsBody: 'Добавьте первую привычку — и здесь появятся цифры.',
  statTotalClean: 'Всего без срывов',
  statLongest: 'Лучший результат',
  statSaved: 'Сэкономлено',
  statAvoided: 'Избежали',
  statMilestones: 'Этапов пройдено',
  statCravings: 'Раз выдержано',
  endedEarly: '{count} прервано',
  byHabit: 'По привычкам',
  bestAndRestarts: 'Лучший — {duration} · {restarts}',
  recentActivity: 'Последние события',
  habitRestarted: '{title} — отсчёт сброшен',
  streakEnded: 'продержались {duration} · {date}',
  sessionDone: 'Сессия фокуса завершена',
  sessionAborted: 'Сессия фокуса прервана',

  /* profile */
  profileTitle: 'Профиль',
  summary: 'Сводка',
  habitsTracked: 'Привычек отслеживается',
  focusSessions: 'Сессий фокуса',
  completedCount: '{count} завершено',
  memberSince: 'С нами с',
  preferences: 'Настройки',
  currency: 'Валюта',
  currencyHint: 'Для подсчёта сэкономленного',
  language: 'Язык',
  about: 'О приложении',
  ourChannel: 'Наш канал',
  ourChannelHint: 'Новости и обновления',
  howItWorks: 'Как работает таймер',
  howItWorksHint: 'Считает от последнего чистого старта, посекундно',
  footer: 'Трекер занятий · v2.0',
  footerNote: 'Занятия и серии привязаны к вашему аккаунту Telegram.',

  /* editor */
  editHabit: 'Изменить привычку',
  createHabit: 'Новая привычка',
  quittingWhat: 'От чего отказываетесь?',
  quittingPlaceholder: 'Курение',
  category: 'Категория',
  startedAt: 'Держитесь с',
  startedAtHint: 'Изменение перепишет текущую серию.',
  costPerDay: 'Трата в день ({currency})',
  unitsPerDay: 'Штук в день',
  unitName: 'Название единиц',
  unitNameHint: 'Для счётчика «избежали», например: сигарет',
  unitPlaceholder: 'сигарет',
  saveChanges: 'Сохранить',
  startClock: 'Запустить отсчёт',
  saving: 'Сохраняем…',

  /* detail */
  milestoneOf: '{label} — этап',
  allMilestones: 'Все этапы пройдены',
  bestStreak: 'Лучший результат',
  restartsLabel: 'Срывов',
  milestonesHeader: 'Этапы · {reached} из {total}',
  reached: 'Пройдено',
  toGo: 'ещё {duration}',
  manage: 'Управление',
  iRelapsed: 'Я сорвался',
  startedOn: 'Начало — {date}',
  deleteHabit: 'Удалить привычку',
  deleteConfirmTitle: 'Удалить привычку?',
  deleteConfirmBody: 'Привычка и вся её история будут удалены. Отменить это нельзя.',
  resetConfirmTitle: 'Сбросить отсчёт?',
  resetConfirmBody: 'Серия {duration} уйдёт в рекорды, а счётчик начнётся с нуля.',
  resetConfirmAction: 'Сбросить и начать заново',
  cancel: 'Отмена',
  working: 'Секунду…',

  /* status */
  outsideTitle: 'Откройте в Telegram',
  outsideBody: 'Habit Breaker работает внутри Telegram. Запустите бота и нажмите «Открыть».',
  gateTitle: 'Только для подписчиков',
  gateBody: 'Подпишитесь на канал, чтобы открыть приложение. Всё, что вы отслеживаете, сохранится.',
  gateJoin: 'Подписаться на канал',
  gateCheck: 'Я подписался',
  errorTitle: 'Не удалось загрузить',
  tryAgain: 'Попробовать снова',
  close: 'Закрыть',
  crashTitle: 'Что-то сломалось',
  crashBody: 'Приложение не смогло запуститься. Попробуйте открыть его заново.',
  reload: 'Перезагрузить',

  /* api errors */
  errNetwork: 'Нет связи. Проверьте интернет и попробуйте снова.',
  errUnauthorized: 'Откройте приложение через бота, чтобы войти.',
  errGeneric: 'Что-то пошло не так. Попробуйте снова.',
  errSubscription: 'Нужна подписка на канал.',

  /* categories */
  catSmoking: 'Курение',
  catAlcohol: 'Алкоголь',
  catSugar: 'Сахар',
  catScreens: 'Экраны',
  catGaming: 'Игры',
  catBetting: 'Ставки',
  catSpending: 'Траты',
  catCaffeine: 'Кофеин',
  catLateNights: 'Недосып',
  catOther: 'Другое',

  /* milestones */
  ms1h: '1 час',
  ms1d: '1 день',
  ms3d: '3 дня',
  ms1w: '1 неделя',
  ms2w: '2 недели',
  ms1mo: '1 месяц',
  ms3mo: '3 месяца',
  ms6mo: '6 месяцев',
  ms1y: '1 год',

  /* activities */
  activitiesTitle: 'Занятия',
  activitiesSubtitle: 'Чем занят и сколько это заняло.',
  nowRunning: 'Идёт сейчас',
  pickActivity: 'Чем займёмся?',
  switchActivity: 'Сменить занятие',
  checkInAction: 'Отметиться',
  finishAction: 'Завершить',
  runningNow: 'идёт…',
  todaySection: 'Сегодня',
  statTodayCount: 'Занятий',
  statTodayTime: 'Время',
  statTodayCheckins: 'Отметок',
  historySection: 'История',
  filterAll: 'Все',
  emptyActivitiesTitle: 'Занятий ещё не было',
  emptyActivitiesBody: 'Выберите занятие выше — время пойдёт сразу.',
  emptyFiltered: 'Занятий этого типа пока нет',
  checkInTitle: 'Отметка куратору',
  checkInPlaceholder: 'На каком ты сейчас моменте?',
  checkInSend: 'Отправить куратору',
  checkInSending: 'Отправляем…',
  activityDetailTitle: 'Занятие',
  fieldType: 'Тип',
  fieldStart: 'Начало',
  fieldEnd: 'Конец',
  fieldEndHint: 'Оставьте пустым — занятие снова пойдёт',
  fieldDuration: 'Длительность',
  fieldCheckins: 'Отметок',
  editTimes: 'Поправить время',
  deleteActivityAction: 'Удалить занятие',
  deleteActivityTitle: 'Удалить занятие?',
  deleteActivityBody: 'Занятие и его отметки исчезнут. Отменить это нельзя.',
  finishFirstHint: 'Начнёте новое — текущее закроется само.',

  /* типы занятий */
  actReading: 'Чтение',
  actSport: 'Спорт',
  actWork: 'Работа',
  actStudy: 'Учёба',
  actCreative: 'Творчество',
  actCleaning: 'Уборка',
  actWalk: 'Прогулка',
  actCooking: 'Готовка',
  actOther: 'Другое',

  /* куратор */
  curatorSection: 'Куратор',
  curatorOpenNow: 'Занимаются сейчас',
  curatorNobody: 'Сейчас никто не занимается',
  curatorTodayLabel: 'Сегодня',
  curatorNotifications: 'Уведомления о старте и финише',
  curatorNotificationsHint: 'Отметки приходят в любом случае',
  curatorRefresh: 'Обновить',
  curatorRecent: 'Последние события',
  curatorEventOf: 'Событие: {name}',
  curatorEditHint: 'Нажмите на событие, чтобы поправить время или удалить',

  errForbidden: 'Бот только для приглашённых.',

  /* режимы привычек */
  habitMode: 'Тип привычки',
  modeQuit: 'Отказаться',
  modeBuild: 'Поддерживать',
  modeQuitHint: 'Считаем время без срывов',
  modeBuildHint: 'Отмечаем день за днём и копим огоньки',
  sectionBuild: 'Полезные',
  sectionQuit: 'Отказ',
  buildWhat: 'Что делаете регулярно?',
  buildPlaceholder: 'Зарядка',
  createBuild: 'Завести привычку',
  newBuildHabit: 'Новая полезная привычка',
  emptyBuildTitle: 'Полезных привычек пока нет',
  emptyBuildBody: 'Добавьте то, что хотите делать регулярно, — и начните копить огоньки.',
  emptyBuildAction: 'Добавить привычку',

  /* серии */
  markToday: 'Отметить',
  markedToday: 'Отмечено',
  inARow: 'подряд',
  streakNone: 'Серии пока нет',
  streakStart: 'Отметьте сегодня — и огонёк загорится',
  topStreak: 'Лучший огонёк',
  doneTotal: 'Всего отметок',
  last30: 'За 30 дней',
  historyGrid: 'Последние 30 дней',
  notScheduled: 'не по плану',
  scheduleLabel: 'Дни недели',
  scheduleHint: 'В незапланированные дни огонёк не гаснет',
  everyDay: 'Каждый день',
  weekdaysShort: 'Пн,Вт,Ср,Чт,Пт,Сб,Вс',

  /* категории полезных */
  bcatSport: 'Спорт',
  bcatReading: 'Чтение',
  bcatWater: 'Вода',
  bcatMorning: 'Утро',
  bcatSleep: 'Сон',
  bcatHealth: 'Здоровье',
  bcatMeditation: 'Медитация',
  bcatStudy: 'Учёба',
  bcatSocial: 'Общение',
  bcatOther: 'Другое',

  /* оформление */
  appearance: 'Оформление',
  themeLabel: 'Тема',
  themeAuto: 'Как в Telegram',
  themeLight: 'Светлая',
  themeDark: 'Тёмная',
  paletteLabel: 'Палитра',
  paletteSystem: 'Системная',
  paletteWarm: 'Тёплая',
  paletteTelegram: 'Из Telegram',
  paletteHint: 'Цвета берутся из вашей темы Telegram',

  /* сова */
  owlLabel: 'Сова',
  owlRunWork: 'Работа идёт. Я послежу, чтобы ты не сбежал.',
  owlRunSport: 'Спорт! Дыши ровно, я считаю.',
  owlRunReading: 'Читаешь — сижу тихо-тихо.',
  owlRunGeneric: 'Сейчас у тебя {activity}. Не отвлекайся.',
  owlWatching: 'Я всё вижу. У меня глаза большие.',
  owlLastToday: 'Последним было {activity} — {duration}. Неплохо.',
  owlNothingToday: 'Сегодня ещё ни одного занятия. Начнём?',
  owlStreak: '{days} подряд. Не дай огоньку погаснуть.',
  owlDue: '«{title}» сегодня ещё не отмечено.',
  owlNight: 'Ночь — моё время. А тебе бы поспать.',
  owlMorning: 'Утро. Самое время начать, пока никто не мешает.',
  owlWho: 'Ух.',
  owlSleepy: 'М-м? Я не спала. Просто моргала.',

  /* units */
  dayShort: 'д',
  secShort: 'сек',
  minShort: 'м',
  hourShort: 'ч',
};

type Key = keyof typeof ru;

const en: Record<Key, string> = {
  navActivities: 'Activities',
  navHabits: 'Habits',
  navFocus: 'Focus',
  navStats: 'Stats',
  navProfile: 'Profile',

  habitsTitle: 'Habits',
  newHabit: 'New habit',
  totalClean: 'Total clean time',
  longestRun: 'longest run {duration}',
  emptyHabitsTitle: 'Nothing tracked yet',
  emptyHabitsBody: 'Add the habit you are done with. The clock starts the moment you do.',
  emptyHabitsAction: 'Add a habit',
  cleanSince: 'Clean since {date}',
  nextMilestone: 'Next · {label}',
  recordDays: '{days} record',

  focusTitle: 'Focus',
  focusSubtitle: 'A craving peaks and fades in minutes. Sit with it until it does.',
  focusSession: '{minutes} minute session',
  breatheIn: 'Breathe in',
  breatheHold: 'Hold',
  breatheOut: 'Breathe out',
  noHabit: 'No habit',
  startSession: 'Start session',
  endSession: 'End session',
  cravingOutlasted: 'Craving outlasted',
  focusRunningWith: 'Holding the line on {title}.',
  focusRunningPlain: 'Stay with the breath.',
  focusRunningTail: 'The urge is already on its way down.',
  focusDoneBody: 'That is one more craving that did not win. It gets easier each time.',
  anotherSession: 'Another session',

  statsTitle: 'Stats',
  statsSubtitle: 'Everything you have held onto so far.',
  emptyStatsTitle: 'No data yet',
  emptyStatsBody: 'Track your first habit and the numbers will start filling in here.',
  statTotalClean: 'Total clean time',
  statLongest: 'Longest streak',
  statSaved: 'Money saved',
  statAvoided: 'Avoided',
  statMilestones: 'Milestones reached',
  statCravings: 'Cravings outlasted',
  endedEarly: '{count} ended early',
  byHabit: 'By habit',
  bestAndRestarts: 'Best {duration} · {restarts}',
  recentActivity: 'Recent activity',
  habitRestarted: '{title} restarted',
  streakEnded: '{duration} streak ended · {date}',
  sessionDone: 'Focus session completed',
  sessionAborted: 'Focus session ended early',

  profileTitle: 'Profile',
  summary: 'Summary',
  habitsTracked: 'Habits tracked',
  focusSessions: 'Focus sessions',
  completedCount: '{count} completed',
  memberSince: 'Member since',
  preferences: 'Preferences',
  currency: 'Currency',
  currencyHint: 'Used for the money-saved figures',
  language: 'Language',
  about: 'About',
  ourChannel: 'Our channel',
  ourChannelHint: 'Updates and new features',
  howItWorks: 'How the timer works',
  howItWorksHint: 'Counts from your last clean start, second by second',
  footer: 'Activity Tracker · v2.0',
  footerNote: 'Sessions and streaks are stored against your Telegram account.',

  editHabit: 'Edit habit',
  createHabit: 'New habit',
  quittingWhat: 'What are you quitting?',
  quittingPlaceholder: 'Smoking',
  category: 'Category',
  startedAt: 'Clean since',
  startedAtHint: 'Editing this rewrites your current streak.',
  costPerDay: 'Cost per day ({currency})',
  unitsPerDay: 'Units per day',
  unitName: 'Unit name',
  unitNameHint: 'Used for the “avoided” count, e.g. cigarettes.',
  unitPlaceholder: 'cigarettes',
  saveChanges: 'Save changes',
  startClock: 'Start the clock',
  saving: 'Saving…',

  milestoneOf: '{label} milestone',
  allMilestones: 'All milestones cleared',
  bestStreak: 'Best streak',
  restartsLabel: 'Restarts',
  milestonesHeader: 'Milestones · {reached} of {total}',
  reached: 'Reached',
  toGo: '{duration} to go',
  manage: 'Manage',
  iRelapsed: 'I relapsed',
  startedOn: 'Started {date}',
  deleteHabit: 'Delete habit',
  deleteConfirmTitle: 'Delete this habit?',
  deleteConfirmBody: 'The habit and its full history are removed. This cannot be undone.',
  resetConfirmTitle: 'Reset the clock?',
  resetConfirmBody:
    'Your {duration} streak gets banked as a record, and the counter starts again from zero.',
  resetConfirmAction: 'Reset and start over',
  cancel: 'Cancel',
  working: 'Working…',

  outsideTitle: 'Open in Telegram',
  outsideBody: 'Habit Breaker runs inside Telegram. Start the bot and tap Open.',
  gateTitle: 'Subscribers only',
  gateBody:
    'Join our channel to unlock the app. It takes a second, and you keep everything you track.',
  gateJoin: 'Join the channel',
  gateCheck: 'I subscribed',
  errorTitle: 'Could not load',
  tryAgain: 'Try again',
  close: 'Close',
  crashTitle: 'Something broke',
  crashBody: 'The app failed to start. Try opening it again.',
  reload: 'Reload',

  errNetwork: 'No connection. Check your network and try again.',
  errUnauthorized: 'Open this app from the bot to sign in.',
  errGeneric: 'Something went wrong. Try again.',
  errSubscription: 'Channel subscription required.',

  catSmoking: 'Smoking',
  catAlcohol: 'Alcohol',
  catSugar: 'Sugar',
  catScreens: 'Screens',
  catGaming: 'Gaming',
  catBetting: 'Betting',
  catSpending: 'Spending',
  catCaffeine: 'Caffeine',
  catLateNights: 'Late nights',
  catOther: 'Other',

  ms1h: '1 hour',
  ms1d: '1 day',
  ms3d: '3 days',
  ms1w: '1 week',
  ms2w: '2 weeks',
  ms1mo: '1 month',
  ms3mo: '3 months',
  ms6mo: '6 months',
  ms1y: '1 year',

  activitiesTitle: 'Activities',
  activitiesSubtitle: 'What you are doing and how long it took.',
  nowRunning: 'Running now',
  pickActivity: 'What are we doing?',
  switchActivity: 'Switch activity',
  checkInAction: 'Check in',
  finishAction: 'Finish',
  runningNow: 'running…',
  todaySection: 'Today',
  statTodayCount: 'Sessions',
  statTodayTime: 'Time',
  statTodayCheckins: 'Check-ins',
  historySection: 'History',
  filterAll: 'All',
  emptyActivitiesTitle: 'No sessions yet',
  emptyActivitiesBody: 'Pick an activity above — the clock starts right away.',
  emptyFiltered: 'Nothing of this type yet',
  checkInTitle: 'Check in with your curator',
  checkInPlaceholder: 'Where are you right now?',
  checkInSend: 'Send to curator',
  checkInSending: 'Sending…',
  activityDetailTitle: 'Session',
  fieldType: 'Type',
  fieldStart: 'Start',
  fieldEnd: 'End',
  fieldEndHint: 'Leave empty to set the session running again',
  fieldDuration: 'Duration',
  fieldCheckins: 'Check-ins',
  editTimes: 'Adjust times',
  deleteActivityAction: 'Delete session',
  deleteActivityTitle: 'Delete this session?',
  deleteActivityBody: 'The session and its check-ins are removed. This cannot be undone.',
  finishFirstHint: 'Starting a new one closes the current session.',

  actReading: 'Reading',
  actSport: 'Sport',
  actWork: 'Work',
  actStudy: 'Study',
  actCreative: 'Creative',
  actCleaning: 'Cleaning',
  actWalk: 'Walk',
  actCooking: 'Cooking',
  actOther: 'Other',

  curatorSection: 'Curator',
  curatorOpenNow: 'Active right now',
  curatorNobody: 'Nobody is working right now',
  curatorTodayLabel: 'Today',
  curatorNotifications: 'Start and finish notifications',
  curatorNotificationsHint: 'Check-ins always come through',
  curatorRefresh: 'Refresh',
  curatorRecent: 'Recent events',
  curatorEventOf: 'Event by {name}',
  curatorEditHint: 'Tap an event to adjust its time or delete it',

  errForbidden: 'This bot is invite-only.',

  habitMode: 'Habit type',
  modeQuit: 'Quit',
  modeBuild: 'Build',
  modeQuitHint: 'Counts the time since your last slip',
  modeBuildHint: 'Check in day by day and grow the streak',
  sectionBuild: 'Building',
  sectionQuit: 'Quitting',
  buildWhat: 'What do you want to do regularly?',
  buildPlaceholder: 'Morning workout',
  createBuild: 'Add the habit',
  newBuildHabit: 'New habit to build',
  emptyBuildTitle: 'Nothing to build yet',
  emptyBuildBody: 'Add something you want to do regularly and start growing a streak.',
  emptyBuildAction: 'Add a habit',

  markToday: 'Check in',
  markedToday: 'Done',
  inARow: 'in a row',
  streakNone: 'No streak yet',
  streakStart: 'Check in today and light the flame',
  topStreak: 'Best streak',
  doneTotal: 'Total check-ins',
  last30: 'Last 30 days',
  historyGrid: 'Last 30 days',
  notScheduled: 'not scheduled',
  scheduleLabel: 'Days of the week',
  scheduleHint: 'Unscheduled days never break the streak',
  everyDay: 'Every day',
  weekdaysShort: 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',

  bcatSport: 'Sport',
  bcatReading: 'Reading',
  bcatWater: 'Water',
  bcatMorning: 'Morning',
  bcatSleep: 'Sleep',
  bcatHealth: 'Health',
  bcatMeditation: 'Meditation',
  bcatStudy: 'Study',
  bcatSocial: 'Social',
  bcatOther: 'Other',

  appearance: 'Appearance',
  themeLabel: 'Theme',
  themeAuto: 'Follow Telegram',
  themeLight: 'Light',
  themeDark: 'Dark',
  paletteLabel: 'Palette',
  paletteSystem: 'System',
  paletteWarm: 'Warm',
  paletteTelegram: 'From Telegram',
  paletteHint: 'Colors are taken from your Telegram theme',

  owlLabel: 'Owl',
  owlRunWork: 'Work in progress. I will make sure you stay put.',
  owlRunSport: 'Sport! Breathe steady, I am counting.',
  owlRunReading: 'You are reading — I will keep very quiet.',
  owlRunGeneric: 'You are on {activity} right now. Stay with it.',
  owlWatching: 'I see everything. Big eyes, you know.',
  owlLastToday: 'Last one was {activity} — {duration}. Not bad.',
  owlNothingToday: 'Nothing logged today yet. Shall we start?',
  owlStreak: '{days} in a row. Do not let the flame go out.',
  owlDue: '“{title}” is still unchecked today.',
  owlNight: 'Night is my shift. You, though, should sleep.',
  owlMorning: 'Morning. Best time to start, before anyone interrupts.',
  owlWho: 'Hoo.',
  owlSleepy: 'Hm? I was not asleep. Just blinking.',

  dayShort: 'd',
  secShort: 'sec',
  minShort: 'm',
  hourShort: 'h',
};

const DICT: Record<Lang, Record<Key, string>> = { ru, en };

/* ------------------------------------------------------------------ */
/* Plurals                                                             */
/* ------------------------------------------------------------------ */

type PluralNoun =
  | 'day'
  | 'hour'
  | 'minute'
  | 'second'
  | 'month'
  | 'year'
  | 'habit'
  | 'restart'
  | 'activity'
  | 'checkin';

/** Russian needs three forms: 1 день, 2 дня, 5 дней. */
const RU_FORMS: Record<PluralNoun, [string, string, string]> = {
  day: ['день', 'дня', 'дней'],
  hour: ['час', 'часа', 'часов'],
  minute: ['минута', 'минуты', 'минут'],
  second: ['секунда', 'секунды', 'секунд'],
  month: ['месяц', 'месяца', 'месяцев'],
  year: ['год', 'года', 'лет'],
  habit: ['привычка', 'привычки', 'привычек'],
  restart: ['срыв', 'срыва', 'срывов'],
  activity: ['занятие', 'занятия', 'занятий'],
  checkin: ['отметка', 'отметки', 'отметок'],
};

const EN_FORMS: Record<PluralNoun, [string, string]> = {
  day: ['day', 'days'],
  hour: ['hour', 'hours'],
  minute: ['minute', 'minutes'],
  second: ['second', 'seconds'],
  month: ['month', 'months'],
  year: ['year', 'years'],
  habit: ['habit', 'habits'],
  restart: ['restart', 'restarts'],
  activity: ['session', 'sessions'],
  checkin: ['check-in', 'check-ins'],
};

function ruForm(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

export function pluralize(lang: Lang, count: number, noun: PluralNoun): string {
  const n = Math.abs(Math.round(count));
  if (lang === 'ru') return `${count} ${ruForm(n, RU_FORMS[noun])}`;
  return `${count} ${EN_FORMS[noun][n === 1 ? 0 : 1]}`;
}

/* ------------------------------------------------------------------ */
/* Translator                                                          */
/* ------------------------------------------------------------------ */

export type Params = Record<string, string | number>;

export function translate(lang: Lang, key: Key, params?: Params): string {
  let out = DICT[lang][key] ?? DICT[DEFAULT_LANG][key] ?? String(key);
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      out = out.split(`{${name}}`).join(String(value));
    }
  }
  return out;
}

export const localeOf = (lang: Lang): string => LOCALES[lang];

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

export interface I18n {
  lang: Lang;
  t: (key: Key, params?: Params) => string;
  plural: (count: number, noun: PluralNoun) => string;
  locale: string;
}

const I18nContext = createContext<I18n>(build(DEFAULT_LANG));

function build(lang: Lang): I18n {
  return {
    lang,
    t: (key, params) => translate(lang, key, params),
    plural: (count, noun) => pluralize(lang, count, noun),
    locale: LOCALES[lang],
  };
}

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  const value = useMemo(() => build(lang), [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export const useI18n = (): I18n => useContext(I18nContext);

export type { Key as TranslationKey };
