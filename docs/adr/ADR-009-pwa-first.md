# ADR-009 — PWA primeiro

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

A spec prioriza PWA mobile-first, usável na academia com conexão ruim. O GymCoach já é PWA via `@ducanh2912/next-pwa`, um plugin webpack que bloqueia o Next 16 (Turbopack) e traz dependências depreciadas com vulnerabilidades.

## Decisão

- Produto entregue como **PWA instalável** (manifest pt-BR, ícones próprios, atualização segura com aviso).
- No upgrade para Next 16, **trocar o next-pwa pelo Serwist**, com a política de cache do ADR-004: sem `/api` autenticado, mídia só do treino atual, limpeza no logout.
- UX desenhada para 360-430 px, uso com uma mão e alvos de toque grandes.

## Consequências

- Notificações de fim de descanso em segundo plano dependem da Push API (no iOS, só com a PWA instalada).
