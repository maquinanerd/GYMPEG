import { dashboard as english } from '../en/dashboard';
import type { MessageShape } from '@/i18n/message-types';

export const dashboard = {
  onboardingTitle: 'Configurez votre entraînement en 2 minutes',
  onboardingDescription:
    'Indiquez votre objectif, votre disponibilité et l’équipement de votre salle pour un plan qui vous correspond.',
  activeSession: 'Séance en cours',
  sessionFallback: 'Séance',
  startedOn: '{name} démarrée le {date}',
  resumeSession: 'Reprendre la séance',
  noActiveProgram: 'Aucun programme actif',
  noActiveProgramDescription: 'Activez un programme pour démarrer une séance.',
  viewPrograms: 'Voir les programmes',
  emptyProgram: 'Programme vide',
  emptyProgramDescription: '{name} n’a aucune séance configurée.',
  configureProgram: 'Configurer le programme',
  startSession: 'Démarrer une séance',
  activeProgram: 'Programme actif : {name}',
  chooseSession: 'Choisir une séance',
  nextWorkout: 'Prochaine séance',
  nextFirst: 'Première séance du programme',
  adherence: {
    title: 'Cette semaine',
    sessions: '{done} séances sur {planned} prévues',
    sessionsLabel: 'Séances prévues faites cette semaine',
    sets: '{done} séries sur {prescribed} prescrites dans ces séances',
  },
  records: {
    title: 'Records récents',
    weight: '{exercise} : charge la plus lourde, {value} (avant {previous})',
    reps: '{exercise} : {value} reps à {weight} (avant {previous})',
    e1rm: '{exercise} : 1RM estimé de {value} (avant {previous})',
    setVolume: '{exercise} : plus grosse série, {value} de volume (avant {previous})',
    exerciseVolume: '{exercise} : plus gros volume en une séance, {value} (avant {previous})',
    workoutTonnage: 'Plus gros tonnage en une séance : {value} (avant {previous})',
    weeklyTonnage: 'Plus gros tonnage hebdomadaire : {value} (avant {previous})',
    viewAll: 'Voir tous les records',
  },
  nextAfter: 'Vient après {name}',
  nextToday: 'Prévue aujourd’hui',
  nextUpcoming:
    'Repos aujourd’hui · prochaine le {day}, dans {count, plural, one {# jour} other {# jours}}',
  chooseOther: 'Choisir une autre séance',
  nextBadge: 'Prochaine',
  cycleWeek: 'Semaine {week} sur {weeks}',
  cycleDeload: 'Semaine {week} sur {weeks} · décharge : moins de séries, charge plus légère',
  programSessions: 'Séances du programme',
  insight: {
    deloadTitle: 'Une récupération semble nécessaire',
    stalledTitle: '{count, plural, one {Un exercice stagne} other {# exercices stagnent}}',
    stalledDetail:
      '{count, plural, one {{names} n’a pas progressé récemment. Un petit changement de charge, de répétitions ou de technique peut relancer la progression.} other {{names} n’ont pas progressé récemment. Consultez la page Progrès pour savoir quoi ajuster.}}',
    prTitle: 'Nouveau record personnel',
    prWeightDetail:
      'Votre dernière séance a établi une nouvelle charge maximale sur {name}. Bravo.',
    prOneRmDetail:
      'Votre dernière séance a établi un nouveau meilleur 1RM estimé sur {name}. Bravo.',
    consistentTitle: 'Vous vous entraînez régulièrement',
    consistentDetail:
      '{count, plural, one {# jour d’entraînement} other {# jours d’entraînement}} cette semaine. Gardez le rythme.',
    deloadStalledReason:
      '{count, plural, one {# exercice stagne : {names}.} other {# exercices stagnent : {names}.}}',
    deloadReadinessReason:
      'Votre forme est en moyenne à {average}/5 sur {checkins, plural, one {votre dernier bilan} other {vos # derniers bilans}}.',
  },
} satisfies MessageShape<typeof english>;
