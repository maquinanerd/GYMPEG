import { ai as english } from '../en/ai';
import type { MessageShape } from '@/i18n/message-types';

export const ai = {
  consent: {
    title: 'Permitir que a IA leia um resumo do seu treino',
    description:
      'Para montar ou ajustar um plano, o GYM Peg envia este resumo ao provedor de IA configurado neste servidor:',
    items: {
      profile: 'perfil: sexo, altura, nível de experiência e objetivo;',
      availability:
        'disponibilidade, equipamentos da academia e exercícios que você prefere ou evita;',
      body: 'tendência do peso corporal (média semanal e variação em 30 dias);',
      training: 'um resumo dos treinos recentes e dos seus principais exercícios.',
    },
    notSent:
      'Fotos, medidas, anotações e seu e-mail nunca são enviados. A IA só escolhe exercícios do seu catálogo, e o app confere cada plano antes de você vê-lo.',
    withdraw: 'Você pode retirar este consentimento a qualquer momento em Configurações.',
    accept: 'Concordo',
    error: 'Não foi possível salvar seu consentimento.',
    settingsTitle: 'IA e seus dados',
    settingsGranted: 'Você permitiu que a IA leia um resumo do seu treino.',
    settingsMissing: 'Os recursos de IA ficam desligados até você permitir.',
    settingsWithdraw: 'Retirar consentimento',
    settingsWithdrawn: 'Consentimento retirado.',
  },
  planner: {
    title: 'Planejar com IA',
    description:
      'A IA monta um plano semanal a partir do seu perfil, disponibilidade, academia e histórico. Você revisa antes de qualquer coisa ser salva.',
    requestLabel: 'Algo específico? (opcional)',
    requestPlaceholder:
      'Ex.: mais foco em glúteos, divisão superior/inferior, treinos de 60 minutos.',
    generate: 'Gerar plano',
    regenerate: 'Gerar outro',
    steps: {
      context: 'Lendo seu perfil e histórico...',
      candidates: 'Escolhendo exercícios que sua academia tem...',
      planning: 'Montando o plano...',
      validating: 'Conferindo volume, tempo e limites...',
    },
    disabled: 'O planejamento com IA está desligado neste servidor.',
    error: 'Não foi possível gerar um plano. Tente de novo.',
  },
  preview: {
    title: 'Prévia',
    description: 'Nada foi salvo ainda. Remova o que não quiser e salve.',
    rationale: 'Por que este plano',
    minutes: '~{minutes} min',
    prescription: '{sets} × {min}-{max} reps',
    rir: 'RIR {rir}',
    rest: '{seconds}s de descanso',
    weeklySets: 'Séries semanais por músculo',
    warnings: 'Pontos de atenção',
    removeExercise: 'Remover exercício',
    rotation: 'Rotação',
    invalid: 'O plano deixou de ser válido: {reason}',
    save: 'Salvar programa',
    saveAndActivate: 'Salvar e ativar',
    saved: 'Programa salvo.',
    saveError: 'Não foi possível salvar o plano.',
  },
  warnings: {
    SESSIONS_DIFFER_FROM_AVAILABILITY:
      '{workouts} treinos, mas você treina {sessions} vezes por semana.',
    TOO_LONG: '{workout} pode passar do seu tempo de {minutes} minutos.',
    VOLUME_TOO_HIGH: '{muscle}: {sets} séries por semana é muito para recuperar.',
    MUSCLE_NOT_COVERED: 'Nenhum trabalho direto para {group}.',
  },
  majorGroups: {
    chest: 'peito',
    back: 'costas',
    shoulders: 'ombros',
    quads: 'quadríceps',
    posteriorChain: 'posteriores e glúteos',
  },
  weekdays: {
    mon: 'Seg',
    tue: 'Ter',
    wed: 'Qua',
    thu: 'Qui',
    fri: 'Sex',
    sat: 'Sáb',
    sun: 'Dom',
  },
} satisfies MessageShape<typeof english>;
