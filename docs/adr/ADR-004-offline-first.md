# ADR-004 — Offline-first

- **Status:** Aceito (implementação no G1)
- **Data:** 2026-10-08

## Contexto

O sync do GymCoach (`lib/sync.ts`) cobre só séries numa sessão já aberta e não tem idempotência. Há sete cenários verificados de duplicação ou perda (O1-O7 em `docs/audit/gymcoach-domain.md`). O service worker guarda respostas autenticadas e o logout não limpa nada.

## Decisão

- **IDs gerados no cliente (UUIDv7)** para sessão de treino, exercício da sessão e série. São estáveis entre edições e usados como chave de idempotência (`clientMutationId`), com restrição única `(userId, clientMutationId)` no servidor.
- **Outbox no IndexedDB (Dexie)**, escopado por usuário e coalescido por entidade. Nunca é apagado por expiração de sessão: os pendentes ficam aguardando novo login do mesmo usuário.
- **Push por agregado** (sessão com exercícios e séries), com **resultado por item**: um item inválido não derruba o lote, e o servidor devolve a versão canônica dos itens recusados ou ajustados.
- **`performedAt` vem do cliente**, limitado a poucos minutos no futuro. O servidor registra `receivedAt`.
- **Iniciar e finalizar treino funcionam offline.** Finalizar só fecha a sessão no servidor depois que o outbox dela esvazia.
- **Exclusões com tombstone.**
- **Service worker:** não guardar `GET /api/*` autenticado nem HTML de páginas com dados. Cache só de assets e da mídia do treino atual. O logout limpa IndexedDB e Cache Storage.
- Schema de validação único (Zod) compartilhado entre cliente e servidor.

## Consequências

- Reescrita de `lib/sync.ts`, `lib/sync-hydration.ts`, `lib/indexeddb.ts` e das rotas de séries/sessões.
- Testes obrigatórios: retry após perda de resposta, reload no meio da sessão, duas abas, aba fechada durante o envio, finalizar com pendências, relógio adiantado.
