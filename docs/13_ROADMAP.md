# 13 — Roadmap e plano do MVP

Gates da spec (§71-76). Cada épico segue a Definition of Done (§77): tipos, validação, migration, autorização, loading/empty/erro, mobile, testes, docs e acessibilidade básica.

## G0 — Discovery ✓ (2026-10-08)

Auditoria, decisão de fork, gap matrix, ADR-001..010, arquitetura, schema atual e futuro, este roadmap. Já entregue junto:

- fork do GymCoach no `maquinanerd/GYMPEG`, sem a automação do upstream;
- pt-BR como idioma padrão e UI rebatizada para GYM Peg;
- providers Gemini/DeepSeek com fallback (ADR-008, camada 1);
- `/api/health` e imagem que aplica migrations sozinha (pronta para o Coolify);
- remoção das imagens de exercício não licenciadas.

## G1 — Core funcional (MVP)

Ordem pensada para manter produção estável e atacar primeiro o risco de dados.

| # | Épico | Itens do MVP (spec §60) | Migrations |
|---|---|---|---|
| 1.1 | **Produção segura**: controle de cadastro (convite/allowlist), sessões revogáveis, troca de senha, índices, limite de corpo JSON, headers básicos | 1 | M1, M3 |
| 1.2 | **Fuso e perfil**: `User.timezone`, onboarding (objetivo, experiência, disponibilidade, academia/equipamentos, preferências e exercícios evitados), sem exigir peso/altura | 2, 3 | M2 |
| 1.3 | **Catálogo global**: `Exercise` global + customizados, músculos normalizados, aliases, busca pt-BR, seed curado dos ≈220 P0 com nomes e instruções próprias em pt-BR | 3, 4 | M5 |
| 1.4 | **Sync offline idempotente** (ADR-004): outbox, UUIDv7, `clientMutationId`, iniciar/finalizar offline, `performedAt`, logout limpa dados locais, SW sem cache de `/api` autenticado | 5, 6, 8 | M6, M7 |
| 1.5 | **Logger único**: um fluxo de registro com a sugestão pré-preenchida, "última vez" sempre visível, tipos de série, RPE opcional, substituir só nesta sessão | 5, 6, 7 | M7 |
| 1.6 | **Programas com revisões**: `ProgramRevision`, fases/semanas, próximo treino por rotação ou dia fixo, templates por `exerciseId` | 4 | M8 |
| 1.7 | **Exclusão de conta e export** (LGPD) | 1 | M4 |
| 1.8 | **Histórico** no fuso local, com filtros | 9 | — |

Critério de saída do G1: os itens 1-9 e 15 do MVP funcionando em produção, CI verde e testes de offline (retry, reload, duas abas, aba fechada, finalizar com pendências).

## G2 — Inteligência determinística

| # | Épico | MVP |
|---|---|---|
| 2.1 | Motor de progressão v2 (ADR-007): regras por prescrição, INCREASE/HOLD/DECREASE/DELOAD/INSUFFICIENT_DATA, motivo e entradas persistidos, kg/lb | 14 |
| 2.2 | PRs completos + `PersonalRecord`, e1RM com fórmula e teto de reps | 13 |
| 2.3 | Volume e frequência por músculo (primário/secundário), séries efetivas, aderência ao plano | 10 |
| 2.4 | Peso corporal com média móvel e tendência 7/30/90 d; medidas com % de gordura | 11, 12 |
| 2.5 | Stall por janela móvel, deload recomendado/manual/planejado com motivo | — |
| 2.6 | Relatório semanal determinístico; `TrainingGuideline` versionada | — |
| 2.7 | SVG anatômico próprio (frente/costas) colorido por `ExerciseMuscle` (antecipado da mídia fase 2) | — |

## G3 — Produto completo inicial

- Storage S3 (ADR-006): fotos privadas com signed URL, EXIF removido, migração do disco e do `bytea`.
- Mídia de exercícios licenciada + `ExerciseMedia` + pipeline + "Ver execução" + `exercise_media_coverage`.
- Next 16 + Serwist, Zod 4, Tailwind 4, ESLint 9.
- Import Hevy/Strong com mapeamento manual e RPE preservado; export completo.
- Produção: backup com cópia S3, teste de restore, ambiente staging, logs estruturados, CSP completa, rate limit compartilhado, auditoria de segurança.

## G4 — IA

ADR-008, camada 2: `TrainingContextBuilder`, `ExerciseRetrievalService` + tool `searchExercises`, `AIProvider.generateWorkoutPlan/adjustWorkoutPlan` só com `exerciseId`, `WorkoutPlanValidator`, preview → confirmação → `ProgramRevision`, ajuste pontual com diff, reavaliação a cada 4/6/8 semanas, `AIUsage`, idempotency key, feature flags `ai.*`, prompts versionados, consentimento antes de enviar dados de saúde. MCP passa a usar o mesmo fluxo (sem escrita direta).

## G5 — Expansão

Treinador/aluno, nutrição (USDA FoodData Central), Health Connect/HealthKit via Capacitor (ADR-010), notificações push.
