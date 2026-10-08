# CLAUDE.md — GYM Peg

GYM Peg é uma plataforma comercial de musculação (PWA, offline-first, pt-BR primeiro) derivada do GymCoach (MIT, ver `NOTICE.md`). O sistema sabe o que o usuário deveria fazer hoje, sabe o que ele fez antes, registra o que realmente aconteceu e usa esse histórico para preparar a próxima sessão de forma explicável.

## Fonte de verdade

- `docs/spec/00_MASTER_SPEC.md` — especificação mestra (gates G0-G5, MVP, entidades, princípios).
- `docs/spec/01_ADDENDUM_EXERCISE_MEDIA.md` — mídia dos exercícios (`ExerciseMedia`, S3, licenças).
- `docs/spec/02_ADDENDUM_AI_WORKOUT_PLANNING.md` — IA para gerar/ajustar treinos (Gemini/DeepSeek, `exerciseId` only, validator, preview).
- `docs/00_OPEN_SOURCE_AUDIT.md`, `docs/adr/` — decisões já tomadas. Leia antes de propor arquitetura.

## Princípios inegociáveis

- **IA explica, domínio calcula.** Volume, e1RM, carga, PR, tendência, aderência e stall vêm de funções puras testadas em `lib/`, nunca do LLM.
- **IA nunca escreve direto no banco**: GENERATE → schema (Zod) → validação de domínio → PREVIEW → usuário confirma → SAVE. A IA só devolve `exerciseId` existentes.
- **Licenças**: nunca copiar código ou mídia de projetos AGPL (wger, liftosaur, openGym, granite) nem do forge (sem licença). Toda mídia de exercício guarda origem e licença.
- **Dados sensíveis (LGPD)**: peso, medidas e fotos são dados de saúde. Autorização por `userId` em toda query, nada sensível em logs, fotos só em storage privado.
- **Offline-first**: o treino ativo funciona sem rede; toda mutação tem id gerado no cliente para idempotência.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind + shadcn/ui (`components/ui`) · Prisma 7 + adapter-pg · PostgreSQL · Dexie (IndexedDB) · next-intl · Zod · Vitest · Playwright. Gerenciador: **npm**. Node >= 20.

## Onde as coisas vivem

- `app/` páginas e rotas (`app/api/**/route.ts`); `components/` UI; `lib/` domínio e helpers (testes colocados `*.test.ts`); `lib/llm/` providers de IA; `lib/schemas/` Zod; `prisma/` schema, migrations, seed; `messages/<locale>/` catálogos de texto; `i18n/` config de idiomas; `tests/integration` (Postgres real) e `tests/e2e` (Playwright).

## Convenções

- Valide toda entrada de API com Zod. Reutilize primitivas de `components/ui`.
- Código, identificadores e comentários em inglês; **texto de UI sempre via `messages/`** (pt-BR é o idioma padrão, en mantido em paridade). Nada de string de UI hardcoded.
- Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:` …). Testes junto com a mudança.
- Corrija o código, nunca enfraqueça o teste para ficar verde.
- Migrations versionadas (`prisma migrate dev` local, `prisma migrate deploy` em produção). Nunca `db push` em produção.

## Gate de verificação

```bash
bash scripts/verify.sh          # prisma generate + lint + typecheck + unit + build
bash scripts/verify.sh --full   # + integration + e2e (Postgres de teste em :5434)
```

Postgres de teste: `docker compose -f docker-compose.test.yml up -d` e depois `DATABASE_URL=postgresql://gymcoach_test:gymcoach_test@localhost:5434/gymcoach_test npx prisma migrate deploy`. Na máquina de desenvolvimento Windows o Docker pode estar desligado: nesse caso rode o gate rápido localmente e deixe integração/e2e para o CI (`.github/workflows/ci.yml`).

## Upstream

`upstream` = `https://github.com/gymcoach-app/gymcoach`. Para trazer correções: `git fetch upstream && git merge upstream/main` em uma branch, resolver conflitos preservando nossas mudanças (pt-BR, providers, docs). Não reintroduzir `.claude/` nem os workflows de demo/publicação do upstream.

## Deploy

Coolify: aplicação (Dockerfile) + PostgreSQL como recurso separado, sem porta pública. Detalhes em `docs/10_COOLIFY_DEPLOYMENT.md`.
