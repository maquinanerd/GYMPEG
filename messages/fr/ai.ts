import { ai as english } from '../en/ai';
import type { MessageShape } from '@/i18n/message-types';

export const ai = {
  consent: {
    title: "Autoriser l'IA à lire un résumé de votre entraînement",
    description:
      "Pour créer ou ajuster un programme, GYM Peg envoie ce résumé au fournisseur d'IA configuré sur ce serveur :",
    items: {
      profile: "profil : sexe, taille, niveau d'expérience et objectif ;",
      availability: 'disponibilités, équipement de la salle et exercices préférés ou évités ;',
      body: 'tendance du poids corporel (moyenne hebdomadaire et variation sur 30 jours) ;',
      training: 'un résumé des séances récentes et de vos principaux exercices.',
    },
    notSent:
      "Les photos, mensurations, notes et votre e-mail ne sont jamais envoyés. L'IA ne choisit que des exercices de votre catalogue et l'application vérifie chaque programme avant que vous le voyiez.",
    withdraw: 'Vous pouvez retirer ce consentement à tout moment dans les Réglages.',
    accept: "J'accepte",
    error: "Impossible d'enregistrer votre consentement.",
    settingsTitle: "L'IA et vos données",
    settingsGranted: "Vous avez autorisé l'IA à lire un résumé de votre entraînement.",
    settingsMissing: "Les fonctions d'IA restent désactivées tant que vous ne les autorisez pas.",
    settingsWithdraw: 'Retirer le consentement',
    settingsWithdrawn: 'Consentement retiré.',
  },
  planner: {
    title: "Planifier avec l'IA",
    description:
      "L'IA crée un programme hebdomadaire à partir de votre profil, de vos disponibilités, de votre salle et de votre historique. Vous le relisez avant tout enregistrement.",
    requestLabel: 'Une demande particulière ? (facultatif)',
    requestPlaceholder: 'Ex. : plus de fessiers, haut/bas du corps, séances de 60 minutes.',
    generate: 'Générer le programme',
    regenerate: 'En générer un autre',
    steps: {
      context: 'Lecture de votre profil et historique...',
      candidates: 'Choix des exercices disponibles dans votre salle...',
      planning: 'Construction du programme...',
      validating: 'Vérification du volume, de la durée et des limites...',
    },
    disabled: 'La planification par IA est désactivée sur ce serveur.',
    error: 'Impossible de générer un programme. Réessayez.',
  },
  preview: {
    title: 'Aperçu',
    description:
      "Rien n'est encore enregistré. Retirez ce que vous ne voulez pas, puis enregistrez.",
    rationale: 'Pourquoi ce programme',
    minutes: '~{minutes} min',
    prescription: '{sets} × {min}-{max} reps',
    rir: 'RIR {rir}',
    rest: '{seconds}s de repos',
    weeklySets: 'Séries hebdomadaires par muscle',
    warnings: "Points d'attention",
    removeExercise: "Retirer l'exercice",
    rotation: 'Rotation',
    invalid: "Le programme n'est plus valide : {reason}",
    save: 'Enregistrer le programme',
    saveAndActivate: 'Enregistrer et activer',
    saved: 'Programme enregistré.',
    saveError: "Impossible d'enregistrer le programme.",
  },
  warnings: {
    SESSIONS_DIFFER_FROM_AVAILABILITY:
      '{workouts} séances, mais vous vous entraînez {sessions} fois par semaine.',
    TOO_LONG: '{workout} risque de dépasser votre séance de {minutes} minutes.',
    VOLUME_TOO_HIGH: '{muscle} : {sets} séries par semaine, beaucoup à récupérer.',
    MUSCLE_NOT_COVERED: 'Aucun travail direct pour {group}.',
  },
  majorGroups: {
    chest: 'les pectoraux',
    back: 'le dos',
    shoulders: 'les épaules',
    quads: 'les quadriceps',
    posteriorChain: 'les ischios et fessiers',
  },
  weekdays: {
    mon: 'Lun',
    tue: 'Mar',
    wed: 'Mer',
    thu: 'Jeu',
    fri: 'Ven',
    sat: 'Sam',
    sun: 'Dim',
  },
} satisfies MessageShape<typeof english>;
