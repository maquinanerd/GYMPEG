import { dashboard as english } from '../en/dashboard';
import type { MessageShape } from '@/i18n/message-types';

export const dashboard = {
  onboardingTitle: 'Configure seu treino em 2 minutos',
  onboardingDescription:
    'Conte seu objetivo, quantas vezes pode treinar e o que sua academia tem, para o plano caber na sua rotina.',
  activeSession: 'Treino em andamento',
  sessionFallback: 'Treino',
  startedOn: '{name} iniciado em {date}',
  resumeSession: 'Retomar treino',
  noActiveProgram: 'Nenhum programa ativo',
  noActiveProgramDescription: 'Ative um programa para iniciar um treino.',
  viewPrograms: 'Ver programas',
  emptyProgram: 'Programa vazio',
  emptyProgramDescription: '{name} não tem nenhum treino configurado.',
  configureProgram: 'Configurar programa',
  startSession: 'Iniciar um treino',
  activeProgram: 'Programa ativo: {name}',
  chooseSession: 'Escolha um treino',
  nextWorkout: 'Próximo treino',
  nextFirst: 'Primeiro treino do programa',
  adherence: {
    title: 'Esta semana',
    sessions: '{done} de {planned} treinos planejados',
    sessionsLabel: 'Treinos planejados feitos nesta semana',
    sets: '{done} de {prescribed} séries prescritas nesses treinos',
  },
  records: {
    title: 'Recordes recentes',
    weight: '{exercise}: maior carga, {value} (antes {previous})',
    reps: '{exercise}: {value} reps com {weight} (antes {previous})',
    e1rm: '{exercise}: 1RM estimado de {value} (antes {previous})',
    setVolume: '{exercise}: maior série, {value} de volume (antes {previous})',
    exerciseVolume: '{exercise}: maior volume num treino, {value} (antes {previous})',
    workoutTonnage: 'Maior tonelagem num treino: {value} (antes {previous})',
    weeklyTonnage: 'Maior tonelagem semanal: {value} (antes {previous})',
    viewAll: 'Ver todos os recordes',
  },
  nextAfter: 'Vem depois de {name}',
  nextToday: 'Agendado para hoje',
  nextUpcoming:
    'Hoje é descanso · próximo na {day}, em {count, plural, one {# dia} other {# dias}}',
  chooseOther: 'Escolher outro treino',
  nextBadge: 'Próximo',
  cycleWeek: 'Semana {week} de {weeks}',
  cycleDeload: 'Semana {week} de {weeks} · descarga: menos séries e carga mais leve',
  programSessions: 'Treinos do programa',
  insight: {
    deloadTitle: 'Talvez seja hora de recuperar',
    stalledTitle: '{count, plural, one {Um exercício estagnou} other {# exercícios estagnaram}}',
    stalledDetail:
      '{count, plural, one {{names} não progrediu recentemente. Uma pequena mudança na carga, nas repetições ou na técnica pode destravar a evolução.} other {{names} não progrediram recentemente. Veja na página de evolução o que ajustar.}}',
    prTitle: 'Novo recorde pessoal',
    prWeightDetail: 'Seu último treino teve a série mais pesada até hoje em {name}. Mandou bem!',
    prOneRmDetail: 'Seu último treino bateu seu melhor 1RM estimado em {name}. Mandou bem!',
    consistentTitle: 'Você está treinando com constância',
    consistentDetail:
      'Treinou {count, plural, one {# dia} other {# dias}} nesta semana. Mantenha o ritmo.',
    deloadStalledReason:
      '{count, plural, one {# exercício estagnou: {names}.} other {# exercícios estagnaram: {names}.}}',
    deloadLongBlockReason: '{weeks} semanas de treino desde o último deload.',
    deloadReadinessReason:
      'Sua prontidão ficou em média {average}/5 {checkins, plural, one {no último check-in} other {nos últimos # check-ins}}.',
  },
} satisfies MessageShape<typeof english>;
