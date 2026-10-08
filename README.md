# GYM Peg

Plataforma de musculação para planejar, executar e acompanhar treinos: PWA mobile-first, funciona offline na academia, com progressão de carga determinística e IA como camada de explicação e planejamento.

> **Status:** Fase 0 (discovery) concluída sobre o fork do GymCoach; em andamento o Gate G1 (core funcional). Veja `docs/13_ROADMAP.md`.

## O que já existe (herdado do GymCoach e em adaptação)

- Logger de treino offline-first (IndexedDB/Dexie) com timer de descanso e PRs.
- Programas de treino, histórico, calendário, e1RM, volume por músculo.
- Peso corporal, medidas, fotos de progresso, check-in de prontidão.
- Coach de IA com providers plugáveis, gerador de programas e ajustes com confirmação.
- Importação Strong/Hevy, exportação, servidor MCP.

## O que estamos construindo

A especificação completa está em [`docs/spec/`](docs/spec/):

- [Especificação mestra](docs/spec/00_MASTER_SPEC.md)
- [Adendo: mídia dos exercícios](docs/spec/01_ADDENDUM_EXERCISE_MEDIA.md)
- [Adendo: IA para criação e adaptação de treinos](docs/spec/02_ADDENDUM_AI_WORKOUT_PLANNING.md)

## Stack

Next.js · React 19 · TypeScript strict · Tailwind + shadcn/ui · Prisma 7 · PostgreSQL · Dexie · next-intl (pt-BR padrão) · Zod · Vitest · Playwright · Docker · Coolify.

## Rodando localmente

Requisitos: Node 20+, npm, Docker (para o PostgreSQL).

```bash
npm ci
cp .env.example .env          # preencha JWT_SECRET e as chaves de IA desejadas
docker compose up -d          # PostgreSQL de desenvolvimento em localhost:5433
npx prisma migrate deploy
npm run db:seed               # cria a conta definida em USER_EMAIL/USER_PASSWORD e a base de exercícios
npm run dev                   # http://localhost:3030
```

Verificação antes de commit:

```bash
bash scripts/verify.sh            # lint + typecheck + unit + build
bash scripts/verify.sh --full     # + integração e e2e (PostgreSQL de teste em :5434)
```

## Deploy

Coolify com a aplicação via Dockerfile e o PostgreSQL como recurso separado. Passo a passo em [`docs/10_COOLIFY_DEPLOYMENT.md`](docs/10_COOLIFY_DEPLOYMENT.md).

## Licença e créditos

Derivado do [GymCoach](https://github.com/gymcoach-app/gymcoach) (MIT, © 2026 GymCoach contributors). Veja [`LICENSE`](LICENSE) e [`NOTICE.md`](NOTICE.md).
