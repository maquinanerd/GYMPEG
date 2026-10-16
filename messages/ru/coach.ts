import { coach as english } from '../en/coach';
import type { MessageShape } from '@/i18n/message-types';

export const coach = {
  title: 'Тренер',
  label: 'Тренер',
  subtitle: 'Курсивом пишет ИИ. Числа считает приложение.',
  conversation: 'Диалог',
  offline:
    'Тренеру нужна сеть. Тренировка работает как обычно и сохраняется на этом устройстве.',
  tabs: {
    label: 'Разделы тренера',
    conversation: 'Диалог',
    analyses: 'Разборы',
  },
  client: {
    title: 'Недельные разборы',
    generate: 'Создать',
    generating: 'Генерация...',
    empty: 'Разборов пока нет. Тренер изучит вашу неделю и скажет, что оставить или изменить.',
    error: 'Разбор не создан.',
    keyMissing: 'Не задан ключ {provider}',
    keySetup: 'Укажите {variable} в файле .env, чтобы включить тренера.',
    applied: 'Применено',
    weekOf: 'Неделя от {date}',
    suggested:
      '{count, plural, one {# изменение предложено} few {# изменения предложено} many {# изменений предложено} other {# изменения предложено}}',
    unreadable: 'Не удалось прочитать предложенные изменения этого разбора.',
  },
  chat: {
    apiKey: 'Укажите {variable} в файле .env, чтобы включить чат.',
    liveSession: 'Текущая тренировка прикреплена',
    liveSessionDescription:
      'Тренер видит уже записанные подходы и цели программы для этой тренировки.',
    new: 'Новый диалог',
    conversations: 'Диалоги',
    placeholder: 'Напишите тренеру...',
    messageLabel: 'Сообщение тренеру',
    send: 'Отправить',
    thinking: 'Пишет...',
    error: 'Тренер не ответил.',
    loadError: 'Диалог не загрузился.',
    suggestionsLabel: 'Подсказки',
    suggestions: {
      plateau: 'Как преодолеть плато в жиме лёжа?',
      deload: 'Нужна ли мне разгрузка?',
      swap: 'Заменить упражнение из-за боли',
    },
    sessionSuggestions: {
      load: 'Оставить или снизить вес в следующем подходе?',
      swap: 'Это упражнение причиняет боль. Чем заменить?',
      rest: 'Сколько отдыхать здесь?',
    },
    emptySession:
      'Вопрос во время тренировки? Спросите о следующем подходе, неподходящем весе или замене упражнения.',
    empty:
      'Спросите, как преодолеть плато, настроить объём, прогрессию, восстановление или нагрузку при травме.',
    advisory:
      'Чат даёт советы, но не изменяет ваши данные. Вносите изменения сами на странице «Программы» или из еженедельного разбора.',
  },
  context: {
    title: 'Что получает тренер',
    description:
      'Сводка, рассчитанная приложением, и недавние записи подходов. Никаких данных аккаунта и ничего вне истории тренировок.',
    history: 'История',
    historyValue:
      '{weeks, plural, one {# неделя} few {# недели} many {# недель} other {# недели}} · {exercises, plural, one {# упражнение} few {# упражнения} many {# упражнений} other {# упражнения}}',
    noHistory: 'Тренировок пока нет',
    goals: 'Цели',
    goal: '{name} {weight} кг × {reps}',
    goalProgress: '{percent}%',
    achieved: 'достигнута',
    noGoals: 'Не заданы',
    stalled: 'Без прогресса',
    noStalled: 'Нет',
    deload: 'Разгрузка',
    deloadActive: 'На этой неделе',
    deloadRecommended: 'Рекомендована{reasons, select, none {} other {: {reasons}}}',
    noDeload: 'Не нужна',
    conditioning: 'Кардио',
    conditioningValue:
      '{minutes} из {target} мин{km, select, none {} other { · {km} км}} · {sessions, plural, one {# тренировка} few {# тренировки} many {# тренировок} other {# тренировки}}',
    readiness: 'Готовность',
    readinessValue: '{readiness} из 5 · сон {sleep} из 5 · {when}',
    today: 'сегодня',
    daysAgo:
      '{days, plural, one {# день назад} few {# дня назад} many {# дней назад} other {# дня назад}}',
    noReadiness: 'Оценок за 7 дней нет',
  },
  note: {
    title: 'Заметка для тренера',
    description:
      'Добавьте контекст, которого нет в данных: травма, болезнь, поездка или другие обстоятельства.',
    placeholder: 'например: в поездке 20–24.10, в отеле только гантели',
    clear: 'Очистить',
    save: 'Сохранить',
    saved: 'Заметка сохранена.',
    cleared: 'Заметка очищена.',
    error: 'Не удалось сохранить заметку.',
  },
  adjustments: {
    title: 'Предлагаемые изменения',
    applied: 'Уже применено',
    description:
      'Выберите изменения для активной программы. Значения можно отредактировать перед подтверждением.',
    proposed:
      '{count, plural, one {Предложенное изменение} few {# предложенных изменения} many {# предложенных изменений} other {# предложенного изменения}}',
    note: 'Ничего не изменится, пока вы не проверите и не подтвердите.',
    review: '{count, plural, one {Проверить изменение} other {Проверить изменения}}',
    aria: 'Применить изменение к упражнению {exercise}',
    repsMin: 'Повторы, мин.',
    repsMax: 'Повторы, макс.',
    sets: 'Подходы',
    rest: 'Отдых (с)',
    targetLoad: 'Целевой вес',
    versus: ' (было {value})',
    applying: 'Применение...',
    apply:
      'Применить {count, plural, one {# изменение} few {# изменения} many {# изменений} other {# изменения}}',
    noneSelected: 'Выберите хотя бы одно изменение.',
    done: '{count, plural, one {Применено # изменение} few {Применено # изменения} many {Применено # изменений} other {Применено # изменения}}{skipped, plural, =0 {.} other { (пропущено #: {names}).}}',
    error: 'Не удалось применить изменения.',
  },
} satisfies MessageShape<typeof english>;
