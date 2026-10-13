import { navigation as english } from '../en/navigation';
import type { MessageShape } from '@/i18n/message-types';

export const navigation = {
  home: 'Accueil',
  history: 'Historique',
  progress: 'Progrès',
  coach: 'Coach',
  chat: 'Chat',
  programs: 'Programmes',
  catalog: 'Catalogue',
  settings: 'Réglages',
  training: 'Entraînement',
  profile: 'Profil',
  exercises: 'Exercices',
  mainLabel: 'Navigation principale',
  trainingLabel: "Sections d'entraînement",
  openCoach: 'Ouvrir le coach',
} satisfies MessageShape<typeof english>;
