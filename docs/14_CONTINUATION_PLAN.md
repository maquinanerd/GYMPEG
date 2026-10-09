# 14 — Plano de continuação

Estado em **2026-10-09**: G0 concluído; G1 em andamento. Já entregues: épico 1.1 (produção segura), épico 1.2 (fuso horário e onboarding), épico 1.3 (catálogo global), épico 1.4 (sync idempotente e treino sem rede), o núcleo do épico 1.5 (logger único), o épico 1.6 (programas com versões, próximo treino, troca só na sessão, templates por catálogo, mesociclo leve) e o épico 1.7 (exclusão de conta e export). Lista com commits na seção "Progresso" de `docs/GAP_MATRIX.md`. Código no `main` de `maquinanerd/GYMPEG`, CI do GitHub verde. **Em produção** em https://gympeg.62.171.164.224.sslip.io (Coolify, deploy automático a cada push em `main`; ver `docs/10_COOLIFY_DEPLOYMENT.md`).

Ordem dos próximos épicos: ~~1.3 catálogo global~~ (feito, `1aa05a5`) → ~~1.2 onboarding~~ (feito, `9c83af1`) → ~~1.5 logger único~~ (feito, `1a4355b`: `Set.type`, RPE, alvo × realizado; "substituir só nesta sessão" ficou para o 1.6, porque depende do `WorkoutExercise` da sessão) → ~~1.4 parte 2~~ (feito: iniciar/finalizar offline, outbox por usuário, página offline) → **1.6 programas com revisões** (fatias: A versões, diff e restauração, feita; B próximo treino por rotação ou dia fixo, feita; C substituir exercício só nesta sessão, feita; D templates por `exerciseId` do catálogo, feita; E mesociclo leve com semana de descarga, feita. Fases e semanas com prescrições próprias por semana ficaram para depois: hoje o ciclo só alterna semana normal e descarga) → ~~1.7 exclusão de conta e export~~ (feito) → **1.8 histórico no fuso local com filtros**. O sync idempotente foi antecipado porque perda e duplicação de séries são o maior risco assim que houver uso real.

Modelo offline (1.4): o service worker não guarda HTML nem `/api` autenticados. Navegação sem rede cai na página `app/~offline`, que lê a URL e roda a sessão a partir do IndexedDB (`localSessions` + pacote de treino de `GET /api/session-pack`, atualizado a cada 10 min com rede e depois de cada treino). Sem rede só o treino funciona: histórico, programas e progresso pedem conexão. Restam do ADR-004 o push por agregado com resultado por item e as exclusões com tombstone (hoje apagar uma série já sincronizada exige rede).

Contract pendente do 1.5: `isWarmup`/`isDropSet` continuam gravados em sincronia com `Set.type` (todo gravador passa por `resolveSetType`), porque estatísticas, PRs, coach e importadores ainda leem as flags. As colunas só saem depois que esses leitores migrarem para `type`.

## Como retomar

1. Ler `CLAUDE.md`, `docs/spec/`, `docs/GAP_MATRIX.md` e `docs/13_ROADMAP.md`.
2. Pegar o próximo épico do G1, na ordem do roadmap.
3. Para cada épico:
   1. ler as notas da área em `docs/audit/` (com `arquivo:linha`);
   2. migration *expand* com backfill testado (ADR-003);
   3. serviço em `lib/services/` e domínio puro em `lib/`;
   4. rota fina e UI com textos via `messages/` (pt-BR e en);
   5. testes unit + integração;
   6. `bash scripts/verify.sh` verde;
   7. commit e push.
4. Atualizar a gap matrix (coluna Estado) e este arquivo.

## Fluxo de entrega

- Hoje `main` = produção (o Coolify fará deploy a cada push). Assim que a aplicação estiver no ar com usuários: branch por épico → PR → CI verde → merge.
- Antes de dados reais: criar o ambiente `staging` no Coolify (banco e bucket próprios).
- Windows sem Docker: rodar o gate rápido local (`verify.sh`) e deixar integração e E2E para o CI.

## Decisões pendentes do usuário

| Decisão | Opções | Bloqueia |
|---|---|---|
| Domínio público do app | subdomínio a escolher | Deploy |
| Chaves de IA | `GEMINI_API_KEY` (e `DEEPSEEK_API_KEY` para fallback) ou `AI_PROVIDER=demo` | IA real em produção |
| Object storage | Cloudflare R2 (recomendado) × MinIO × S3 | G3 (fotos, mídia, backup off-site) |
| Mídia de exercícios | sessão de fotos com termo de cessão × ilustração encomendada × pacote comercial licenciado | Fase 1 de mídia |
| Validação jurídica | metadados do free-exercise-db; licença do nosso próprio código (repo público) | Lançamento comercial |
| Visibilidade do repositório | público (hoje) × privado | — |
| Provedor de e-mail | para reset de senha e convites | Épico 1.1 |

## Riscos a monitorar

- Cadastro: em produção só e-mails em `SIGNUP_ALLOWED_EMAILS` criam conta (padrão `allowlist`).
- Fotos de progresso em volume local do Coolify, sem backup, até o G3.
- O histórico herdado do upstream ainda contém as imagens removidas.
- `npm audit`: 2 críticas e 18 altas, a maioria transitiva de next-pwa/workbox; resolvidas pelo upgrade para Serwist (G3) ou antes, se alguma for explorável em runtime.
