# ADR-007 — Motor de treino determinístico

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

A spec põe progressão, autorregulação, stall e deload no domínio, sem LLM. O GymCoach tem libs puras boas (`progression.ts`, `gym-loads.ts`, `intra-set-autoregulation.ts`, `stats.ts`, `records.ts`, `deload.ts`). Os limites delas: incrementos fixos em kg, progressão indexada por exercício (e não pela prescrição), sem DECREASE/INSUFFICIENT_DATA e nenhuma decisão persistida.

## Decisão

- Módulo `lib/training-engine/` com funções puras (vira `packages/training-engine` quando houver monorepo): `calculateE1RM`, `detectPR`, `detectStall`, `recommendNextLoad`, `recommendDeload`, `calculateAdherence`, `calculateWeightTrend` e volume por músculo.
- **Estado derivado do histórico**, não contadores mutáveis. A recomendação é função de (regra da prescrição, séries realizadas, inventário do equipamento, readiness opcional).
- Saída sempre `{ action: INCREASE|HOLD|DECREASE|DELOAD|INSUFFICIENT_DATA, value, reason, inputs }`. A decisão é **persistida** (`TrainingRecommendation`) com as entradas usadas, para auditoria e para a IA explicar.
- Progressão **por prescrição** (linha do programa), não por exercício, para que dia pesado e dia leve não se contaminem.
- O incremento respeita o equipamento real (`gym-loads.ts`) e a unidade do usuário (kg/lb).
- Parâmetros científicos em `TrainingGuideline` versionada (version, source, updatedAt), nunca constantes espalhadas.
- Semanas, streaks e PRs calculados no fuso do usuário.

## Consequências

- Reaproveita `gym-loads.ts` e os testes existentes como regressão.
- Exige `User.timezone`, `WorkoutSet.type/rpe` e prescrição por linha antes do motor v2.

## Implementação (2026-10-09, épico 2.1)

- `lib/training-engine/guideline.ts`: parâmetros versionados (`TRAINING_GUIDELINE.version`), com incrementos por categoria em kg e em lb.
- `lib/training-engine/progression.ts`: `recommendNextLoad` devolve `{ action, valueKg, reason, deltaKg, inputs, guidelineVersion }`. INCREASE no topo da faixa em todas as séries de trabalho; DECREASE quando a maioria ficou abaixo do mínimo; HOLD no meio; DELOAD (semana de descarga ou prontidão muito baixa) 10% abaixo; INSUFFICIENT_DATA sem histórico. Prontidão e descarga só reduzem, nunca acima da decisão base. O valor passa pelo inventário real (`constrainGymWeight`).
- Histórico por prescrição: `getLastPerformances` prefere a última sessão do mesmo treino e só recorre à última sessão do exercício quando o treino ainda não tem histórico.
- Persistência: `TrainingRecommendation`, gravada no início da sessão no servidor (online ou quando o início offline chega), uma por linha de força, com as entradas, o histórico usado e a versão. A tela da sessão roda o mesmo motor sobre as mesmas entradas (`suggestNextWeight` virou adaptador).
- Limite conhecido: a preferência "autorregulação por prontidão" mora no aparelho; o registro do servidor sempre aplica a prontidão (está nas entradas gravadas).
