import { navigation as english } from '../en/navigation';
import type { MessageShape } from '@/i18n/message-types';

export const navigation = {
  home: 'Início',
  history: 'Histórico',
  progress: 'Evolução',
  coach: 'Coach',
  chat: 'Chat',
  programs: 'Programas',
  catalog: 'Catálogo',
  settings: 'Configurações',
  training: 'Treinos',
  profile: 'Perfil',
  exercises: 'Exercícios',
  mainLabel: 'Navegação principal',
  trainingLabel: 'Seções de treino',
  openCoach: 'Abrir o coach',
} satisfies MessageShape<typeof english>;
