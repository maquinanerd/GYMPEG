# ADR-008 — Abstração de LLM

- **Status:** Aceito (camada de provider implementada; camada de domínio no G4)
- **Data:** 2026-10-08

## Contexto

O adendo de IA pede Gemini Flash-Lite como padrão, DeepSeek Flash como alternativa, fallback configurável, structured output, registro de uso e custo e nenhuma chamada a fornecedor fora de uma camada única. O GymCoach já centralizava tudo em `lib/llm` (Anthropic, OpenRouter, codex-lb, demo), mas só com texto.

## Decisão

Duas camadas:

1. **`LlmProvider`** (`lib/llm`, implementado no commit `77a0843`). Cuida de transporte e fornecedor:
   - `GeminiProvider` (`gemini-3.5-flash-lite`) e `DeepSeekProvider` (`deepseek-flash`), IDs confirmados na documentação oficial em 2026-10-08;
   - `AI_PROVIDER` (padrão `gemini`; `LLM_PROVIDER` mantido como alias) e `AI_FALLBACK_PROVIDER`;
   - `FallbackProvider`: 1 retry em erro transitório (429/5xx), troca direta em erro de configuração (401/403/404) e nenhum fallback em requisição inválida. Nunca roda dois modelos ao mesmo tempo, e o stream só troca de provider antes do primeiro chunk;
   - `responseFormat: 'json'` (JSON nativo) e `usage` (tokens) no resultado.
2. **`AIProvider` de domínio** (G4): `generateWorkoutPlan` e `adjustWorkoutPlan` sobre `LlmProvider`. Inclui:
   - `TrainingContextBuilder`;
   - `ExerciseRetrievalService` e a tool `searchExercises`;
   - `WorkoutPlanValidator`;
   - o fluxo GENERATE → schema → domínio → ids → PREVIEW → confirmação → SAVE;
   - `ProgramRevision`, `AIUsage` e idempotency key;
   - feature flags `ai.*`;
   - prompts versionados em `prompts/<nome>/vN.md`.

## Consequências

- A troca de fornecedor é só configuração.
- Tool calling ainda precisa entrar no contrato `LlmProvider` (Gemini `functionDeclarations`, DeepSeek `tools`).
- A IA nunca é fonte de números: recebe valores calculados pelo domínio.
