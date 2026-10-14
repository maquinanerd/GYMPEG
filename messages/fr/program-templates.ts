import { programTemplates as english } from '../en/program-templates';
import type { MessageShape } from '@/i18n/message-types';

export const programTemplates = {
  fiveThreeOneBbb: {
    name: '5/3/1 (Boring But Big, 4 jours)',
    summary:
      'Mouvements principaux du 5/3/1 de Wendler avec travail complémentaire BBB en 5x10, 4 jours.',
    attribution:
      '5/3/1 de Jim Wendler. Le mouvement principal se calcule sur votre training max (TM = 90 % du 1RM), en vagues de 5, 3 puis 1 répétition d’une semaine à l’autre, dernière série en AMRAP. Le complémentaire se fait en 5x10 à ~50-60 % du TM.',
    programName: '5/3/1 Boring But Big',
    description:
      '5/3/1 de Wendler avec le volume complémentaire Boring But Big. Fixez votre training max à 90 % de votre 1RM et faites progresser le TM, pas la charge au jour le jour.',
    phase: 'Force',
    workouts: {
      day1: 'Jour 1 - Développé militaire',
      day2: 'Jour 2 - Soulevé de terre',
      day3: 'Jour 3 - Développé couché',
      day4: 'Jour 4 - Squat',
    },
    notes: {
      mainLift: 'Mouvement principal. Vague 5/3/1 sur le training max ; dernière série en AMRAP.',
      supplemental: 'Complémentaire Boring But Big : 5x10 à ~50-60 % du TM.',
      pullingAccessory: 'Accessoire de tirage pour équilibrer le volume de poussée.',
    },
  },
  gzclp: {
    name: 'GZCLP (progression linéaire)',
    summary: 'Progression linéaire basée sur GZCL : T1 5x3, T2 3x10, T3 3x15+, 3 jours.',
    attribution:
      'GZCLP de Cody LeFever. T1 : 5x3+ lourd, ajoutez du poids à chaque séance ; en cas de stagnation, passez à 6x2 puis à 10x1. T2 : 3x10 (puis 3x8 et 3x6). T3 : 3x15+ avec la dernière série en AMRAP ; ajoutez du poids quand la dernière série atteint 25.',
    programName: 'GZCLP',
    description:
      'Progression linéaire basée sur GZCL, avec les niveaux T1 (force principale), T2 (volume secondaire) et T3 (accessoires). Ajoutez du poids à chaque séance jusqu’à la stagnation, puis passez au schéma de répétitions suivant.',
    phase: 'Force',
    workouts: {
      dayA: 'Jour A - Squat / Développé couché',
      dayB: 'Jour B - Développé militaire / Soulevé de terre',
      dayC: 'Jour C - Développé couché / Squat',
    },
    notes: {
      t1: 'T1 : 5x3+, dernière série en AMRAP. Ajoutez du poids à chaque séance.',
      t2: 'T2 : 3x10, puis 3x8 et 3x6 en cas de stagnation.',
      t3Progression:
        'T3 : 3x15+, dernière série en AMRAP. Ajoutez du poids quand la dernière série atteint 25.',
      t3: 'T3 : 3x15+, dernière série en AMRAP.',
    },
  },
  ppl: {
    name: 'Push / Pull / Legs (6 jours)',
    summary:
      'Split PPL classique d’hypertrophie sur 6 jours, travail de 8-12 répétitions à 1-2 RIR.',
    attribution:
      'Push/Pull/Legs classique (poussée, tirage, jambes), deux fois par semaine. Fourchettes d’hypertrophie (8-15 répétitions), 1-2 RIR ; augmentez la charge quand vous atteignez le haut de la fourchette sur toutes les séries.',
    programName: 'Push Pull Legs',
    description:
      'Split Push/Pull/Legs d’hypertrophie sur 6 jours. Faites chaque séance deux fois par semaine ; augmentez la charge quand le haut de la fourchette est atteint sur toutes les séries.',
    phase: 'Hypertrophie',
    workouts: {
      pushA: 'Poussée A',
      pullA: 'Tirage A',
      legsA: 'Jambes A',
      pushB: 'Poussée B',
      pullB: 'Tirage B',
      legsB: 'Jambes B',
    },
  },
  upperLower: {
    name: 'Haut / Bas du corps (4 jours)',
    summary: 'Split haut/bas du corps sur 4 jours, équilibrant force et hypertrophie.',
    attribution:
      'Upper/Lower classique sur 4 jours. Polyarticulaires plus lourds (5-8 répétitions) en début de séance, accessoires d’hypertrophie (8-15 répétitions) ensuite, 1-2 RIR.',
    programName: 'Haut / Bas du corps',
    description:
      'Split haut/bas du corps sur 4 jours. Commencez par un polyarticulaire plus lourd, puis accumulez du volume d’hypertrophie sur les accessoires. Augmentez la charge en haut de chaque fourchette de répétitions.',
    phase: 'Hypertrophie',
    workouts: {
      upperA: 'Haut du corps A',
      lowerA: 'Bas du corps A',
      upperB: 'Haut du corps B',
      lowerB: 'Bas du corps B',
    },
  },
  nsuns: {
    name: 'nSuns 531 LP (4 jours)',
    summary:
      'Progression linéaire nSuns 531, 4 jours, vagues à gros volume sur les mouvements principaux.',
    attribution:
      'nSuns 531 LP. Le mouvement principal suit une vague de 9 séries (ex. 8/6/4/4/4/5/6/7/8+ répétitions à un %TM croissant puis décroissant) ; l’AMRAP de la série clé détermine la hausse hebdomadaire du TM. Suivez la vague en notant les répétitions prescrites à chaque série.',
    programName: 'nSuns 531 LP',
    description:
      'Progression linéaire nSuns 531. Chaque mouvement principal suit une vague d’intensité de 9 séries, avec une série en AMRAP qui décide de la hausse du training max la semaine suivante. Faites les répétitions prescrites à chaque série, telles qu’écrites.',
    phase: 'Force',
    workouts: {
      day1: 'Jour 1 - Développé couché / Développé militaire',
      day2: 'Jour 2 - Squat / Soulevé de terre sumo',
      day3: 'Jour 3 - Développé militaire / Développé incliné',
      day4: 'Jour 4 - Soulevé de terre / Squat avant',
    },
    notes: {
      t1Wave: 'Vague T1 nSuns : 8/6/4/4/4/5/6/7/8+ répétitions ; la série clé est en AMRAP.',
      t1DeadliftWave:
        'Vague T1 nSuns : 5/3/1/3/3/3/5/7/4+ répétitions ; la série clé est en AMRAP.',
      t2UpperWave: 'Vague T2 nSuns : 6/5/3/5/7/4/6/8 répétitions.',
      t2LowerWave: 'Vague T2 nSuns : 5/5/3/5/7/4/6/8 répétitions.',
    },
  },
  startingStrength: {
    name: 'Starting Strength (3x5 A/B)',
    summary:
      'Progression linéaire débutant de Rippetoe : deux séances full body, 3x5, plus de poids à chaque séance.',
    attribution:
      'Starting Strength de Mark Rippetoe. Alternez les séances A et B sur 3 séances par semaine. Squat en 3x5 à chaque séance ; ajoutez 2,5-5 kg chaque fois que toutes les répétitions sont réussies. Le soulevé de terre se fait en 1x5. Retirez 10 % en cas de stagnation.',
    programName: 'Starting Strength',
    description:
      'Progression linéaire à la barre pour débutants, de Rippetoe. Deux séances full body en alternance, trois fois par semaine. Squat en 3x5 à chaque séance, avec une petite hausse de charge dès que toutes les répétitions prescrites sont réussies.',
    phase: 'Force',
    workouts: {
      workoutA: 'Séance A - Squat / Développé couché / Soulevé de terre',
      workoutB: 'Séance B - Squat / Développé militaire / Power clean',
    },
    notes: {
      squat: '3x5. Ajoutez 2,5-5 kg à chaque séance où toutes les répétitions sont réussies.',
      press: '3x5. Ajoutez du poids à chaque séance où toutes les répétitions sont réussies.',
      deadlift: '1 série de travail de 5. Ajoutez du poids à chaque séance.',
      powerClean: '5x3 tirages explosifs. Les débutants peuvent le remplacer par du rowing barre.',
    },
  },
  stronglifts: {
    name: 'StrongLifts 5x5 (A/B)',
    summary:
      'Deux séances full body en alternance, 5x5 sur les mouvements principaux, plus de poids à chaque séance.',
    attribution:
      'StrongLifts 5x5, de Mehdi. Alternez les séances A et B sur 3 séances par semaine. 5x5 au squat, au développé couché, au développé militaire et au rowing ; soulevé de terre en 1x5. Ajoutez 2,5 kg à chaque séance ; retirez 10 % après trois échecs.',
    programName: 'StrongLifts 5x5',
    description:
      'Deux séances full body en alternance, trois fois par semaine. 5x5 sur les mouvements principaux (soulevé de terre en 1x5). Ajoutez un peu de poids à chaque séance et retirez 10 % après trois stagnations.',
    phase: 'Force',
    workouts: {
      workoutA: 'Séance A - Squat / Développé couché / Rowing',
      workoutB: 'Séance B - Squat / Développé militaire / Soulevé de terre',
    },
    notes: {
      squat: '5x5. Ajoutez 2,5 kg à chaque séance où toutes les répétitions sont réussies.',
      mainLift: '5x5. Ajoutez du poids à chaque séance où toutes les répétitions sont réussies.',
      deadlift: '1 série de travail de 5. Ajoutez du poids à chaque séance.',
    },
  },
  madcow: {
    name: 'Madcow 5x5 (intermédiaire)',
    summary:
      '5x5 à progression hebdomadaire : lundi lourd, mercredi léger, vendredi triple record.',
    attribution:
      'Programme intermédiaire Madcow 5x5. Le lundi, la charge monte sur 5 séries jusqu’à une série lourde de 5 ; le mercredi est un volume de récupération plus léger ; le vendredi, la charge monte jusqu’à une série lourde suivie d’une série allégée (back-off). Progressez d’une semaine à l’autre, pas d’une séance à l’autre.',
    programName: 'Madcow 5x5',
    description:
      '5x5 intermédiaire à progression hebdomadaire. Montez en charge série après série jusqu’à une série lourde le lundi, allégez le mercredi et battez une nouvelle série lourde le vendredi. Ajoutez du poids d’une semaine à l’autre plutôt qu’à chaque séance.',
    phase: 'Force',
    workouts: {
      monday: 'Lundi - Montée lourde',
      wednesday: 'Mercredi - Léger',
      friday: 'Vendredi - Série lourde / Record',
    },
    notes: {
      squatRamp:
        'Montez en 5 séries jusqu’à une série lourde de 5. La dernière se situe vers 1-2 RIR.',
      ramp: 'Montez en 5 séries jusqu’à une série lourde de 5.',
      squatLight:
        'Volume de récupération plus léger ; montez jusqu’à la charge de la 3e série du lundi.',
      light: 'Volume de récupération plus léger.',
      deadliftLight:
        'Montée plus légère ; gardez le tirage lourd pour la progression hebdomadaire.',
      squatTopSet:
        'Montez jusqu’à une série lourde de 3 (série record), puis une série allégée de 8.',
      benchTopSet: 'Montez jusqu’à une série lourde de 3 (série record), puis une série allégée.',
      rowTopSet: 'Montez jusqu’à une série lourde, puis une série allégée.',
    },
  },
  phul: {
    name: 'PHUL (Power Hypertrophy Upper Lower)',
    summary:
      'Haut/bas du corps sur 4 jours : deux jours lourds de force et deux jours d’hypertrophie à plus de répétitions.',
    attribution:
      'PHUL (Power Hypertrophy Upper Lower). Deux jours de force (3-5 répétitions sur les mouvements principaux) et deux jours d’hypertrophie (8-15 répétitions). Progressez en charge les jours de force ; cherchez le volume et la fourchette de répétitions les jours d’hypertrophie.',
    programName: 'PHUL',
    description:
      'Power Hypertrophy Upper Lower. Deux jours de force plus lourds développent la force sur les mouvements principaux (3-5 répétitions) et deux jours d’hypertrophie accumulent du volume (8-15 répétitions). Quatre séances par semaine.',
    phase: 'Hypertrophie',
    workouts: {
      upperPower: 'Haut du corps - Force',
      lowerPower: 'Bas du corps - Force',
      upperHypertrophy: 'Haut du corps - Hypertrophie',
      lowerHypertrophy: 'Bas du corps - Hypertrophie',
    },
  },
  phat: {
    name: 'PHAT (Power Hypertrophy Adaptive Training)',
    summary:
      'Split sur 5 jours de Layne Norton : deux jours de force et trois jours d’hypertrophie à gros volume.',
    attribution:
      'PHAT de Layne Norton. Deux jours de force travaillent les mouvements principaux entre 3 et 5 répétitions ; trois jours d’hypertrophie travaillent les mêmes schémas plus légers, entre 8 et 20 répétitions. Cinq séances par semaine, volume total élevé.',
    programName: 'PHAT',
    description:
      'Power Hypertrophy Adaptive Training (Layne Norton). Deux jours de force (3-5 répétitions) développent la force et trois jours d’hypertrophie (8-20 répétitions) apportent le volume pour le haut et le bas du corps. Cinq séances par semaine.',
    phase: 'Hypertrophie',
    workouts: {
      upperPower: 'Haut du corps - Force',
      lowerPower: 'Bas du corps - Force',
      backShouldersHypertrophy: 'Dos / Épaules - Hypertrophie',
      lowerHypertrophy: 'Bas du corps - Hypertrophie',
      chestArmsHypertrophy: 'Pectoraux / Bras - Hypertrophie',
    },
  },
  fullBody: {
    name: 'Full body 3x/semaine (débutant)',
    summary: 'Programme full body pour débutants, trois séances par semaine, volume modéré.',
    attribution:
      'Full body générique pour débutants, trois jours non consécutifs par semaine. Chaque séance travaille tout le corps avec un polyarticulaire principal par schéma de mouvement et un accessoire. Ajoutez du poids quand vous atteignez le haut de la fourchette sur toutes les séries.',
    programName: 'Full body 3x',
    description:
      'Programme full body pour débutants, sur trois jours non consécutifs par semaine. Chaque jour comprend un squat, une charnière de hanche ou un tirage, une poussée et un accessoire, entre 6 et 15 répétitions. Augmentez la charge en haut de chaque fourchette.',
    phase: 'Général',
    workouts: {
      fullBodyA: 'Full body A',
      fullBodyB: 'Full body B',
      fullBodyC: 'Full body C',
    },
  },
} satisfies MessageShape<typeof english>;
