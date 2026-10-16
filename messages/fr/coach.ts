import { coach as english } from '../en/coach';
import type { MessageShape } from '@/i18n/message-types';

export const coach = {
  title: 'Coach',
  label: 'Coach',
  subtitle: 'Le texte en italique est écrit par l’IA. Les chiffres viennent de l’app.',
  conversation: 'Conversation',
  offline:
    'Le coach a besoin d’une connexion. L’entraînement fonctionne normalement et reste enregistré sur cet appareil.',
  tabs: {
    label: 'Sections du coach',
    conversation: 'Conversation',
    analyses: 'Bilans',
  },
  client: {
    title: 'Bilans hebdomadaires',
    generate: 'Générer',
    generating: 'Génération...',
    empty: 'Aucun bilan pour l’instant. Le coach lit votre semaine et dit quoi garder ou changer.',
    error: 'Le bilan n’a pas été généré.',
    keyMissing: 'Clé {provider} manquante',
    keySetup: 'Définissez {variable} dans .env pour activer le coach.',
    applied: 'Appliqué',
    weekOf: 'Semaine du {date}',
    suggested:
      '{count, plural, one {# ajustement proposé} other {# ajustements proposés}}',
    unreadable: 'Les ajustements proposés de ce bilan sont illisibles.',
  },
  chat: {
    apiKey: 'Définissez {variable} dans .env pour activer le chat.',
    liveSession: 'Séance en cours attachée',
    liveSessionDescription:
      'Le coach voit les séries déjà enregistrées et les objectifs du programme pour cette séance.',
    new: 'Nouvelle conversation',
    conversations: 'Conversations',
    placeholder: 'Écrivez à votre coach...',
    messageLabel: 'Message au coach',
    send: 'Envoyer',
    thinking: 'Rédaction...',
    error: 'Le coach n’a pas répondu.',
    loadError: 'Cette conversation n’a pas chargé.',
    suggestionsLabel: 'Questions suggérées',
    suggestions: {
      plateau: 'Comment sortir du plateau au développé couché ?',
      deload: 'Dois-je faire une décharge ?',
      swap: 'Remplacer un exercice à cause d’une douleur',
    },
    sessionSuggestions: {
      load: 'Garder ou baisser la charge à la prochaine série ?',
      swap: 'Cet exercice fait mal. Par quoi le remplacer ?',
      rest: 'Combien de repos ici ?',
    },
    emptySession:
      'Une question en pleine séance ? Demandez conseil sur votre prochaine série, une charge qui semble anormale ou un changement d’exercice.',
    empty:
      'Posez vos questions : sortir d’un plateau, volume d’entraînement, progression, récupération ou adaptation à une blessure.',
    advisory:
      'Le chat conseille mais ne modifie pas vos données. Appliquez les changements vous-même depuis la page Programmes ou depuis le bilan hebdomadaire.',
  },
  context: {
    title: 'Ce que reçoit le coach',
    description:
      'Un résumé calculé par l’app, plus vos dernières séries enregistrées. Jamais vos données de compte ni rien hors de votre historique d’entraînement.',
    history: 'Historique',
    historyValue:
      '{weeks, plural, one {# semaine} other {# semaines}} · {exercises, plural, one {# exercice} other {# exercices}}',
    noHistory: 'Aucune séance pour l’instant',
    goals: 'Objectifs',
    goal: '{name} {weight} kg × {reps}',
    goalProgress: '{percent} %',
    achieved: 'atteint',
    noGoals: 'Aucun',
    stalled: 'En stagnation',
    noStalled: 'Aucun',
    deload: 'Décharge',
    deloadActive: 'Cette semaine',
    deloadRecommended: 'Recommandée{reasons, select, none {} other { : {reasons}}}',
    noDeload: 'Pas nécessaire',
    conditioning: 'Cardio',
    conditioningValue:
      '{minutes} sur {target} min{km, select, none {} other { · {km} km}} · {sessions, plural, one {# séance} other {# séances}}',
    readiness: 'Forme',
    readinessValue: '{readiness} sur 5 · sommeil {sleep} sur 5 · {when}',
    today: 'aujourd’hui',
    daysAgo: '{days, plural, one {il y a # jour} other {il y a # jours}}',
    noReadiness: 'Aucun bilan de forme en 7 jours',
  },
  note: {
    title: 'Note au coach',
    description:
      'Ajoutez du contexte que les données ne montrent pas, comme une blessure, une maladie ou un déplacement.',
    placeholder: 'ex. En déplacement du 20 au 24/10, haltères seulement à l’hôtel',
    clear: 'Effacer',
    save: 'Enregistrer',
    saved: 'Note enregistrée.',
    cleared: 'Note effacée.',
    error: 'Impossible d’enregistrer la note.',
  },
  adjustments: {
    title: 'Ajustements proposés',
    applied: 'Déjà appliqué',
    description:
      'Choisissez ce qui doit être appliqué au programme actif. Vous pouvez modifier les valeurs avant de confirmer.',
    proposed: '{count, plural, one {Ajustement proposé} other {# ajustements proposés}}',
    note: 'Rien ne change avant que vous ne vérifiiez et confirmiez.',
    review: '{count, plural, one {Vérifier l’ajustement} other {Vérifier les ajustements}}',
    aria: 'Appliquer l’ajustement à {exercise}',
    repsMin: 'Reps min',
    repsMax: 'Reps max',
    sets: 'Séries',
    rest: 'Repos (s)',
    targetLoad: 'Charge cible',
    versus: ' (au lieu de {value})',
    applying: 'Application...',
    apply: 'Appliquer {count, plural, one {# ajustement} other {# ajustements}}',
    noneSelected: 'Sélectionnez au moins un ajustement.',
    done: '{count, plural, one {# ajustement appliqué} other {# ajustements appliqués}}{skipped, plural, =0 {.} other { (# ignorés : {names}).}}',
    error: 'Impossible d’appliquer les ajustements.',
  },
} satisfies MessageShape<typeof english>;
