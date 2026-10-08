# ADR-002 — PostgreSQL

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

O GymCoach já usa PostgreSQL 16 via Prisma (adapter-pg). A spec pede PostgreSQL 17 como recurso separado no Coolify, com backup agendado e sem porta pública. O servidor Coolify do usuário já opera um Postgres 17 nesse padrão (`aluguei-postgres`).

## Decisão

- **PostgreSQL 17** (`postgres:17-alpine`) como recurso standalone do Coolify, na rede interna, sem porta pública.
- A aplicação recebe só `DATABASE_URL`. Os composes que embutem o banco (`docker-compose.prod.yml`, `docker-compose.selfhost.yml`) não são usados em produção.
- Backups do Coolify em três agendamentos (7 diários, 4 semanais, 6 mensais), com cópia em S3. Um backup só conta como válido após teste de restore.
- Testes de integração seguem com Postgres real (CI: service container; local: `docker-compose.test.yml`).

## Consequências

- Upgrade 16 → 17 sem impacto de código. Alinhar a imagem do CI e do compose de teste para 17.
- Busca de exercícios pode usar `pg_trgm`/`unaccent` (extensões disponíveis na imagem oficial).
