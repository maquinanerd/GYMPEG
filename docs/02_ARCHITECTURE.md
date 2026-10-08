# 02 — Arquitetura

## 1. Hoje (fork do GymCoach, 2026-10-08)

```
Navegador / PWA (Next.js 15, React 19, next-pwa)
  ├── Server Components (app/(app)/*) ──────────┐ leem Prisma direto
  ├── Client Components (components/*)          │
  │     └── Dexie: fila de séries (lib/sync.ts) │
  ▼                                             ▼
Route handlers (app/api/**, 55)  ── Prisma 7 (adapter-pg) ──▶ PostgreSQL
  │   requireApiUserId → Zod → db.*            ▲
  ├── lib/* domínio puro (stats, progression, gym-loads, records, deload…)
  ├── lib/llm (Gemini, DeepSeek, Anthropic, OpenRouter, codex-lb, demo + fallback)
  └── app/mcp (22 tools, token pessoal)
Disco local do container: fotos de progresso (UPLOADS_DIR)
```

Características:

- Monólito Next.js, estrutura flat, sem Server Actions e **sem camada de serviço**: 49 rotas e 14 páginas acessam o Prisma diretamente, e REST e MCP já divergem.
- O domínio de cálculo é puro e testado em `lib/`. A orquestração (montar dados, persistir decisões) fica espalhada em páginas e rotas.
- Autenticação por JWT stateless em cookie HttpOnly. Autorização por `userId` em cada query, com teste-catraca de posse.
- Imagem Docker standalone, não-root, que aplica migrations no start e tem healthcheck em `/api/health`.

## 2. Alvo

```
PWA (Next.js 16 + Serwist, mobile-first, pt-BR)
  ├── UI (components/*, shadcn)            ┌────────────────────────────┐
  ├── Treino ativo offline                 │ Outbox Dexie por usuário   │
  │     IDs UUIDv7 do cliente ─────────────▶ push por agregado, idem-  │
  │                                        │ potente, resultado por item│
  ▼                                        └─────────────┬──────────────┘
Route handlers / Server Actions (finos: auth → Zod → serviço)
  ▼
lib/services/*   ← única porta de escrita (REST, sync e MCP usam a mesma)
  ├── lib/training-engine/*   puro: progressão, stall, deload, PR, e1RM, volume, aderência
  ├── lib/catalog/*           catálogo global, busca pt-BR/alias, ExerciseRetrievalService
  ├── lib/ai/*                AIProvider de domínio, TrainingContextBuilder, WorkoutPlanValidator
  │     └── lib/llm/*         transporte: Gemini ⇄ DeepSeek (fallback), JSON, usage
  ├── lib/storage/*           ObjectStorageProvider (S3/R2), signed URLs
  └── lib/events/*            eventos de domínio (WorkoutCompleted, PersonalRecordAchieved…)
  ▼
Prisma 7 ─▶ PostgreSQL 17 (Coolify, rede interna, backups 7d/4s/6m + S3)
Object storage: bucket privado (fotos) + bucket público via CDN (mídia de exercícios)
Redis (quando houver mais de uma réplica): rate limit compartilhado, filas
```

### Princípios de camada

1. **Rotas são finas.** Autenticam, validam com Zod e chamam um serviço. Nenhuma regra de negócio em rota ou página.
2. **Serviços são a única porta de escrita.** Cada serviço recebe o `userId` explicitamente e verifica a posse de toda FK recebida. REST, sync offline e MCP chamam o mesmo serviço.
3. **Domínio é puro.** `lib/training-engine` não importa Prisma, `fetch` nem relógio (o `now` e o fuso são parâmetros).
4. **IA explica, domínio calcula.** `lib/ai` só recebe números já calculados. Toda saída da IA passa pelo validador e por confirmação do usuário antes de virar `ProgramRevision`.
5. **Fornecedor isolado.** Só `lib/llm` fala com APIs de LLM, e só `lib/storage` fala com S3.

## 3. Transição

A camada de serviço nasce por agregado, conforme cada área é reescrita (ADR-001: sem big bang):

| Ordem | Agregado | Motivo |
|---|---|---|
| 1 | Treino executado (sessão, séries) | Pré-requisito do sync idempotente (ADR-004) |
| 2 | Catálogo de exercícios | Catálogo global (ADR-005) |
| 3 | Programa + revisões | `ProgramRevision`, base da IA (ADR-008) |
| 4 | Corpo (peso, medidas, fotos) | Storage S3 (ADR-006) e LGPD |
| 5 | Conta | Sessões revogáveis, exclusão e export |

O MCP passa a chamar os serviços conforme cada agregado migra. Até lá, as tools de escrita do MCP ficam como estão.

## 4. Deploy

Ver [10_COOLIFY_DEPLOYMENT.md](10_COOLIFY_DEPLOYMENT.md). Push em `main` → CI (lint, typecheck, unit, integração, build, E2E, smoke da imagem) → Coolify faz build do Dockerfile → a imagem aplica migrations e sobe → healthcheck `/api/health`.
