import { dashboard as english } from '../en/dashboard';
import type { MessageShape } from '@/i18n/message-types';

export const dashboard = {
  onboardingTitle: 'Настройте тренировки за 2 минуты',
  onboardingDescription:
    'Укажите цель, сколько раз в неделю можете тренироваться и что есть в вашем зале, чтобы план подошёл именно вам.',
  activeSession: 'Активная тренировка',
  sessionFallback: 'Тренировка',
  startedOn: '{name}, начало: {date}',
  resumeSession: 'Продолжить тренировку',
  noActiveProgram: 'Нет активной программы',
  noActiveProgramDescription: 'Активируйте программу, чтобы начать тренировку.',
  viewPrograms: 'Открыть программы',
  emptyProgram: 'Пустая программа',
  emptyProgramDescription: 'В программе «{name}» не настроены тренировки.',
  configureProgram: 'Настроить программу',
  startSession: 'Начать тренировку',
  activeProgram: 'Активная программа: {name}',
  chooseSession: 'Выбрать тренировку',
  nextWorkout: 'Следующая тренировка',
  nextFirst: 'Первая тренировка программы',
  nextAfter: 'Идёт после {name}',
  nextToday: 'Запланирована на сегодня',
  nextUpcoming:
    'Сегодня отдых · следующая: {day}, через {count, plural, one {# день} few {# дня} many {# дней} other {# дня}}',
  chooseOther: 'Выбрать другую тренировку',
  nextBadge: 'Следующая',
  programSessions: 'Тренировки программы',
  insight: {
    deloadTitle: 'Похоже, пора восстановиться',
    stalledTitle:
      '{count, plural, one {Прогресс в упражнении остановился} few {Прогресс остановился в # упражнениях} many {Прогресс остановился в # упражнениях} other {Прогресс остановился в # упражнения}}',
    stalledDetail:
      '{count, plural, one {В упражнении «{names}» в последнее время нет прогресса. Небольшое изменение веса, повторов или техники может помочь.} few {В упражнениях {names} в последнее время нет прогресса. Откройте страницу прогресса, чтобы выбрать корректировку.} many {В упражнениях {names} в последнее время нет прогресса. Откройте страницу прогресса, чтобы выбрать корректировку.} other {В упражнениях {names} в последнее время нет прогресса. Откройте страницу прогресса, чтобы выбрать корректировку.}}',
    prTitle: 'Новый личный рекорд',
    prWeightDetail: 'На последней тренировке установлен новый рекорд веса в упражнении «{name}».',
    prOneRmDetail: 'На последней тренировке установлен новый расчётный 1ПМ в упражнении «{name}».',
    consistentTitle: 'Вы тренируетесь регулярно',
    consistentDetail:
      'На этой неделе: {count, plural, one {# тренировочный день} few {# тренировочных дня} many {# тренировочных дней} other {# тренировочного дня}}. Продолжайте в том же режиме.',
    deloadStalledReason:
      '{count, plural, one {Прогресс остановился в # упражнении: {names}.} few {Прогресс остановился в # упражнениях: {names}.} many {Прогресс остановился в # упражнениях: {names}.} other {Прогресс остановился в # упражнения: {names}.}}',
    deloadReadinessReason:
      'Средняя готовность за последние {checkins, plural, one {# оценку} few {# оценки} many {# оценок} other {# оценки}} составляет {average}/5.',
  },
} satisfies MessageShape<typeof english>;
