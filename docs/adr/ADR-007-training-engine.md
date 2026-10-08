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
