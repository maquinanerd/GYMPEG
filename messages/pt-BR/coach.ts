import { coach as english } from '../en/coach';
import type { MessageShape } from '@/i18n/message-types';

export const coach = {
  title: 'Coach',
  description: 'Análise semanal dos seus treinos feita por IA.',
  chatTitle: 'Chat',
  chatDescription: 'Converse com seu coach tendo seus dados de treino como contexto.',
  conversation: 'Conversa',
  client: {
    generating: 'Gerando (10-20s)...',
    request: 'Pedir uma análise semanal',
    empty: 'Nenhuma análise ainda. Peça a primeira acima.',
    unknownError: 'Erro desconhecido',
    keyMissing: 'Chave do {provider} ausente',
    keySetup: 'Defina {variable} no .env para ativar o coach.',
    applied: 'Aplicado',
    debriefFrom: 'Análise de {date}',
    weekOf: 'Semana de {date}',
  },
  chat: {
    apiKey: 'Defina {variable} no .env para ativar o chat.',
    liveSession: 'Treino em andamento anexado.',
    new: 'Nova',
    placeholder: 'Mande uma mensagem para seu coach...',
    send: 'Enviar',
    liveSessionDescription:
      'O coach vê as séries registradas até agora e as metas do programa para este treino.',
    emptySession:
      'Dúvida no meio do treino? Pergunte sobre a próxima série, uma carga que não parece certa ou a troca de um exercício.',
    empty:
      'Pergunte como sair de um platô, sobre volume de treino, progressão, recuperação ou ajustes por lesão.',
    advisory:
      'O chat orienta, mas não pode editar seus dados. Aplique as mudanças você mesmo na página Programas ou pela análise semanal.',
  },
  context: {
    title: 'O que seu coach vê',
    teaser: 'O contexto de treino por trás de cada análise. Toque para expandir.',
    history: 'Histórico de treinos',
    goals: 'Metas',
    achieved: 'atingida',
    noGoals: 'Nenhuma meta de exercício definida.',
    fatigue: 'Fadiga',
    conditioning: 'Condicionamento',
    readiness: 'Prontidão',
    historySummary:
      '{weeks, plural, one {# semana} other {# semanas}} de histórico recente em {exercises, plural, one {# exercício} other {# exercícios}}.',
    noHistory:
      'Nenhum treino registrado ainda - o coach começa a aprender a partir do seu primeiro treino.',
    goalProgress: '({percent}% do caminho)',
    stalled: 'Exercícios estagnados: {names}.',
    noStalled: 'Nenhum exercício estagnado detectado.',
    deloadActive: 'Uma semana de deload planejada está ativa.',
    deloadRecommended: 'Deload recomendado{reasons, select, none {.} other {: {reasons}.}}',
    noDeload: 'Nenhum deload recomendado.',
    conditioningSummary:
      'Nesta semana: {minutes} min{km, select, none {} other { · {km} km}} · {sessions, plural, one {# sessão} other {# sessões}} (meta de {target} min/semana)',
    today: 'hoje',
    daysAgo: '{days, plural, one {há # dia} other {há # dias}}',
    readinessSummary: 'Último check-in {when}: prontidão {readiness}/5, sono {sleep}/5.',
    noReadiness: 'Nenhum check-in de prontidão nos últimos 7 dias.',
    privacy:
      'Um resumo compacto como este, mais seus registros recentes série a série, é o que a IA recebe - nunca os dados da sua conta nem nada fora do seu histórico de treinos.',
  },
  note: {
    title: 'Recado para o seu coach',
    description:
      'Adicione contexto que os dados de treino não mostram, como uma lesão, doença ou viagem.',
    placeholder:
      'ex.: O ombro está incomodando, pegue leve nos exercícios de empurrar esta semana.',
    clear: 'Limpar',
    save: 'Salvar',
    saved: 'Recado salvo.',
    cleared: 'Recado apagado.',
    error: 'Não foi possível salvar seu recado.',
  },
  adjustments: {
    title: 'Ajustes sugeridos',
    applied: 'Já aplicado',
    description:
      'Escolha o que aplicar ao programa ativo. Você pode editar os valores antes de confirmar.',
    aria: 'Aplicar o ajuste em {exercise}',
    repsMin: 'Reps mín.',
    repsMax: 'Reps máx.',
    sets: 'Séries',
    rest: 'Descanso (s)',
    targetLoad: 'Carga-alvo',
    versus: ' (atual: {value})',
    applying: 'Aplicando...',
    apply: 'Aplicar {count, plural, one {# ajuste} other {# ajustes}}',
  },
} satisfies MessageShape<typeof english>;
