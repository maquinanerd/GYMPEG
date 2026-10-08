# 00 — Auditoria open source (Fase 0 / Gate G0)

- **Data:** 2026-10-08
- **Escopo:** 7 repositórios definidos em `docs/spec/00_MASTER_SPEC.md` §1.
- **Método:** clones em `_audit/repos/` (fora do git). Análise estática por quatro frentes paralelas e execução real do GymCoach (install, typecheck, lint, testes, build e audit) no Windows, além do CI do GitHub após o fork.
- **Detalhes com evidência `arquivo:linha`:** [`audit/gymcoach-platform.md`](audit/gymcoach-platform.md), [`audit/gymcoach-domain.md`](audit/gymcoach-domain.md), [`audit/benchmarks.md`](audit/benchmarks.md), [`EXERCISE_MEDIA_AUDIT.md`](EXERCISE_MEDIA_AUDIT.md).

## 1. Decisão

**Opção A, com reescrita seletiva: hard fork estrutural do GymCoach** ([ADR-001](adr/ADR-001-fork-gymcoach.md)).

- **Mantemos** a casca da aplicação (Next.js, Prisma, Docker, CI, UI shadcn), as bibliotecas de domínio puras e testadas, os importadores, a abstração de LLM e o padrão de autorização por dono.
- **Reescrevemos**, em ordem de risco: sync offline, catálogo de exercícios, modelo de programa com versões, geração por IA baseada em `exerciseId`, sessões revogáveis, storage S3 e o par export/exclusão (LGPD).
- Não acompanhamos o upstream continuamente. Correções de segurança dele são avaliadas e trazidas à mão.

O ganho é real: cerca de 39 mil linhas de produto e 29 mil de testes, 1.232 testes unitários, CI com Postgres real e E2E. A fundação de dados, porém, precisa ser redesenhada. O fork economiza muita UI e infraestrutura, e pouca modelagem.

## 2. Matriz de licenças

| Projeto | Licença verificada | Uso permitido para nós |
|---|---|---|
| **GymCoach** | MIT (`LICENSE`) | **Base do produto.** Manter o aviso de copyright (`NOTICE.md`) |
| wger | AGPL-3.0 (código); dados com licença por linha, padrão CC-BY-SA 4 | Só conceito. Dados apenas com atribuição/*share-alike* e parecer jurídico |
| liftosaur | AGPL-3.0; imagens compradas da Gym visual, fora do repo | Só conceito (motor de progressão descrito com palavras próprias) |
| openGym | AGPL-3.0-or-later; titularidade da mídia **não resolvida** (`NOTICE.md:92-117`) | Só UX. Mídia, dados e traduções proibidos |
| granite | AGPL-3.0 (+ CLA) | Só conceito de offline-first |
| forge | **Sem licença** (todos os direitos reservados) | Nenhum uso; só observação de UX |
| free-exercise-db | Unlicense declarada, mas **imagens raspadas da internet** segundo o upstream; instruções idênticas às do Bodybuilding.com | **Só metadados** (nomes, músculos, equipamento), reescritos na nossa taxonomia. Imagens e instruções **não** |

Consequência imediata, já aplicada: o GymCoach distribuía 164 imagens do free-exercise-db em `public/exercise-media`. Elas foram removidas do produto (commit `f7febeb`). A UI de mídia continua, desligada até haver fonte licenciada.

## 3. GymCoach em números

| Item | Resultado |
|---|---|
| Commits / idade | 437 commits, criado em 2026-05-27, v1.0.0 em 2026-10-05 |
| Autoria | 309 commits com co-autoria de IA, mantido por "loops autônomos"; bus factor humano ≈ 1 |
| Código | ≈ 39,4 mil linhas (app, components, lib, i18n), ≈ 29 mil linhas de testes |
| Testes (execução local, Windows) | **1.229/1.232 unitários passando**. As 3 falhas são de permissão/symlink do Windows em `lib/progress-photo.test.ts`, não bugs |
| Typecheck / lint / build | ✓ / ✓ (avisos) / ✓ (339 s) |
| CI no GitHub após o fork | lint + typecheck + unit ✓, integração com Postgres ✓, build ✓, E2E Playwright ✓ |
| `npm audit --omit=dev` | 30 vulnerabilidades (1 baixa, 9 moderadas, 18 altas, 2 críticas). A maioria é transitiva de `@ducanh2912/next-pwa`/workbox |
| TypeScript | strict + `noUncheckedIndexedAccess`, 0 `any`, 0 TODO |
| Schema | 22 models, 9 enums, 26 migrations lineares |
| API | 55 route handlers + MCP, nenhuma Server Action, sem camada de serviço |

## 4. O que o GymCoach faz bem (reaproveitar)

- **Isolamento por usuário.** Toda query filtra por `userId`, e um teste-catraca exige caso cross-user para cada rota com `[id]`. Nenhum IDOR explorável encontrado.
- **`lib/gym-loads.ts`.** Ajusta a carga ao inventário real da academia (halter 20 → 22 → 24, barra com anilhas, stack de máquina). Atende diretamente a spec §5/§13.
- **Libs puras e testadas:** progressão dupla, autorregulação intra-série, retorno após pausa, stall, deload, e1RM, PRs, volume/frequência por músculo, anilhas, aquecimento, timer por horário de término, supersets, cardio.
- **Importadores endurecidos:** Strong, Hevy, CSV, TCX, GPX, FIT, com preview e dedupe.
- **Abstração de LLM centralizada.** Já ganhou Gemini, DeepSeek e fallback (commit `77a0843`).
- **Uploads de foto:** checagem de tipo por magic bytes, nome UUID, servidas só por rota autenticada.
- **Infra:** Dockerfile multi-stage não-root, CI com Postgres real, E2E e smoke test da imagem.

## 5. O que precisa ser reescrito

| Área | Problema | Severidade |
|---|---|---|
| Sync offline | Sem idempotência. Duplica séries em retry e reload; perde séries com aba fechada ou ao finalizar com pendências (cenários O1-O7); horário da série = horário do sync | **Alta** |
| IA de geração/ajuste | Usa nome livre e cria exercício inventado (`upsert` por nome); catálogo inteiro no prompt; sem validador de domínio, `ProgramRevision`, `AIUsage` nem idempotência; MCP grava direto | **Alta** |
| Modelo de programa | Sem semanas/fases/mesociclos, sem versões; ajustes e trocas sobrescrevem a prescrição; excluir programa desanexa o histórico | **Alta** |
| Catálogo de exercícios | Por usuário (cópia no registro), um músculo por exercício, sem slug/alias/pt-BR/padrão de movimento/licença | **Alta** |
| Sessão/autenticação | JWT de 30 dias irrevogável; sem troca/reset de senha; cadastro aberto; bcrypt cost 10 | **Alta** |
| LGPD | Sem exclusão de conta (FKs `RESTRICT`); export incompleto; dados de saúde ao LLM sem consentimento; SW guarda respostas autenticadas e o logout não limpa | **Alta** |
| Storage | Fotos em disco local; imagens de equipamento em `bytea`; sem S3, EXIF, thumbnails | Média |
| Métricas | Semanas em UTC (domingo à noite no Brasil cai na semana seguinte); peso corporal retroativo; Epley sem teto de reps; PR "ao vivo" só contra a última sessão | Média |
| Progressão | +2,5/+1 kg fixos em kg; indexada por exercício (dia pesado contamina o leve); sem DECREASE/INSUFFICIENT_DATA | Média |
| Plataforma | Sem headers/CSP, corpo JSON sem limite, rate limit em memória, sem índices em FKs quentes, sem logger estruturado | Média |
| Stack | Zod 3, Tailwind 3, ESLint 8, next-pwa (bloqueia Next 16) | Média |
| i18n | Sem pt-BR. **Já em andamento** (pt-BR padrão) | Baixa |

## 6. Benchmarks: o que levar como conceito

Do [estudo completo](audit/benchmarks.md), descrito com palavras próprias:

1. **Progressão derivada do histórico**, com snapshot da decisão (regra, entradas, resultado, motivo) em vez de contadores mutáveis dentro do programa (contraste com liftosaur; inspiração wger/openGym).
2. **Série com alvo e realizado lado a lado**, para o histórico sobreviver a edições do programa (wger).
3. **Offline com IDs do cliente (UUIDv7), push por agregado, resultado por item, tombstones e outbox que nunca é apagado ao expirar sessão** (granite, com as armadilhas dele evitadas).
4. **Catálogo com proveniência e licença por linha**, fusão com "substituído por" e tradução com status de revisão (wger).
5. **Logger:** repetir a última série com 1 toque, timer persistido como horário de término, superset com descanso único por rodada, aquecimento fora de PR e volume (forge, openGym).

## 7. Riscos que seguem abertos

1. **Jurídico de mídia.** A Fase 1 de mídia exige fotos próprias ou licenciadas, ou ilustração encomendada. O SVG anatômico próprio é o único visual limpo com 100% de cobertura imediata.
2. **Repositório público.** `maquinanerd/GYMPEG` é público: a spec, a estratégia e o código ficam visíveis. O histórico herdado do upstream ainda contém as imagens removidas (só reescrevendo o histórico, operação destrutiva não realizada).
3. **Cadastro aberto em produção** até existir controle de convite.
4. **Upgrade de stack** (Next 16 + Serwist, Zod 4, Tailwind 4, ESLint 9): semanas de trabalho, a planejar antes de crescer o código novo.
5. **Dívida de compreensão.** Código gerado por agentes; leitura e testes antes de mexer em cada área.
