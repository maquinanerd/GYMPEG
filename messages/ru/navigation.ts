import { navigation as english } from '../en/navigation';
import type { MessageShape } from '@/i18n/message-types';

export const navigation = {
  home: 'Главная',
  history: 'История',
  progress: 'Прогресс',
  coach: 'Тренер',
  chat: 'Чат',
  programs: 'Программы',
  catalog: 'Упражнения',
  settings: 'Настройки',
  training: 'Тренировки',
  profile: 'Профиль',
  exercises: 'Упражнения',
  mainLabel: 'Основная навигация',
  trainingLabel: 'Разделы тренировок',
  openCoach: 'Открыть тренера',
} satisfies MessageShape<typeof english>;
