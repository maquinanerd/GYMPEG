# ADR-001 — Fork do GymCoach × greenfield

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

A spec (§1) pedia auditar o GymCoach (MIT) antes de escolher entre fork estrutural (A), reaproveitamento parcial (B) ou greenfield (C). A auditoria ([00_OPEN_SOURCE_AUDIT.md](../00_OPEN_SOURCE_AUDIT.md)) achou uma base madura em UI, infra, testes e libs de domínio. Os pontos fracos estão na fundação de dados: sync sem idempotência, catálogo por usuário, programa sem versões, IA por nome livre, sessão irrevogável e LGPD. O upstream é mantido por agentes autônomos, com bus factor humano ≈ 1.

## Decisão

**A, com reescrita seletiva: hard fork estrutural.**

- O histórico do upstream foi preservado no repositório (remote `upstream`), mas **não sincronizamos continuamente**. Correções de segurança do upstream são avaliadas e trazidas à mão.
- A estrutura flat (`app/`, `lib/`, `components/`) fica como está. O monorepo da spec §3 só depois da baseline estável (spec: "rodar, testar, documentar, baseline, só depois refatorar").
- As áreas marcadas como reescrita na [gap matrix](../GAP_MATRIX.md) são substituídas por partes, sempre com a aplicação deployável. Nada de big bang.
- Projetos AGPL e sem licença são usados só como referência conceitual.

## Consequências

- Ganho imediato: produto funcional, CI completo e 1.232 testes.
- Custo: cada área reescrita precisa de migração de dados e de reaprender código gerado por agentes.
- O nome do pacote e o cookie ainda dizem "gymcoach". O rebranding técnico (cookies, nomes de pacote) fica para quando não houver usuários com sessão, para não deslogar ninguém.
