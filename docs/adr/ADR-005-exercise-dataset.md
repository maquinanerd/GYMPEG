# ADR-005 — Base de exercícios

- **Status:** Aceito
- **Data:** 2026-10-08

## Contexto

O free-exercise-db (876 exercícios, Unlicense declarada) cobre 91% das variantes P0. Porém o dataset de origem (`wrkout/exercises.json`) declara que as imagens foram raspadas da internet, que o mantenedor não detém os direitos e que desaconselha uso comercial. As instruções são idênticas às do Bodybuilding.com. O GymCoach distribuía 164 dessas imagens. Detalhes em [EXERCISE_MEDIA_AUDIT.md](../EXERCISE_MEDIA_AUDIT.md).

## Decisão

- **Catálogo global próprio**, persistido no nosso banco, sem dependência de API externa.
- Do free-exercise-db usamos **só metadados** (nome, músculos, equipamento, categoria), reescritos na nossa taxonomia (`movement_pattern`, `ExerciseMuscle`, equipamentos), com `source` e `sourceLicense` por linha.
- **Instruções escritas por nós em pt-BR.** Não traduzimos o texto de origem, porque isso seria obra derivada.
- **Imagens do free-exercise-db não entram em produção** (removidas no commit `f7febeb`). Uso só local, como placeholder, com `license = UNVERIFIED` e `isActive = false`.
- A curadoria começa pelos ≈220 exercícios P0, com nome pt-BR, aliases de busca e nome original em inglês.
- Exercícios customizados do usuário nunca sobrescrevem os globais. Mídia customizada é privada.

## Implementação (2026-10-09)

- Dados curados em `data/catalog/exercises.json` e `data/catalog/muscles.json`, validados por Zod (`lib/catalog/catalog-schema.ts`) e por `lib/catalog/catalog-data.test.ts`. Cada linha guarda `source`, `sourceRef` (id do free-exercise-db, quando houver), `sourceLicense` e `reviewStatus` (`draft` até revisão humana das instruções).
- `Exercise.userId` nulo = catálogo global, identificado por `slug` estável. Músculos em `Muscle`/`ExerciseMuscle` (PRIMARY/SECONDARY); busca e nomes legados em `ExerciseAlias`.
- Carga no start do servidor (`instrumentation.ts` → `syncGlobalCatalog`), só quando o hash do conteúdo muda. Exercícios removidos do arquivo são desativados, nunca apagados.
- As cópias por conta criadas pelo GymCoach são fundidas no global equivalente (séries, prescrições, metas e vínculos de academia são reapontados). Novas contas não recebem mais cópia.
- Importações, templates, gerador de programa e MCP resolvem nomes pelo catálogo (`findUsableExerciseByName`) antes de criar um exercício customizado.
- O navegador usa `data/catalog/search-index.json` (gerado por `scripts/build-catalog-index.ts`) para nomes pt-BR e busca por aliases.

## Consequências

- A Fase 1 de mídia exige produção ou licenciamento de imagens (decisão de orçamento pendente).
- O SVG anatômico próprio passa a ser o primeiro visual do produto.
