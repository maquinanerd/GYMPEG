# ADR-003 — Prisma × Drizzle e estratégia de migrations

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

O fork usa Prisma 7 (client gerado + adapter-pg), com 26 migrations lineares, várias escritas à mão com backfill. A spec manda evitar troca prematura de ORM no fork. A auditoria de plataforma sugeriu uma nova baseline de migrations porque o modelo-alvo diverge muito.

## Decisão

- **Manter Prisma 7.** Sem Drizzle.
- **Evoluir o schema de forma incremental, não rebaselinar.** Cada mudança estrutural segue *expand → migrate → contract*:
  1. a migration adiciona tabelas e colunas novas sem quebrar o código atual;
  2. backfill idempotente em SQL ou script;
  3. o código passa a usar o novo modelo;
  4. migration posterior remove o legado.
- Produção sempre com `prisma migrate deploy` (rodado pela imagem no start); nunca `db push`.
- Toda migration com backfill ganha teste de integração.

## Consequências

- A aplicação fica deployável a cada passo, inclusive com dados reais já em produção.
- O histórico de migrations fica mais longo. É o custo aceito de não perder dados.
