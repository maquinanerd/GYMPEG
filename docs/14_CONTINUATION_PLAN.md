# 14 — Plano de continuação

Estado em **2026-10-09**: G0 concluído; G1 em andamento. Já entregues: épico 1.1 (produção segura), fuso horário do épico 1.2 e parte 1 do épico 1.4 (sync idempotente). Lista com commits na seção "Progresso" de `docs/GAP_MATRIX.md`. Código no `main` de `maquinanerd/GYMPEG`, CI do GitHub verde. Deploy no Coolify aguardando a criação dos recursos (ver abaixo).

Ordem dos próximos épicos: ~~1.3 catálogo global~~ (feito, `1aa05a5`) → **1.2 restante (onboarding)** → 1.5 logger único (`Set.type`, RPE, alvo × realizado) → 1.4 parte 2 (iniciar/finalizar offline, outbox por usuário) → 1.6 programas com revisões → 1.7 exclusão de conta e export. O sync idempotente foi antecipado porque perda e duplicação de séries são o maior risco assim que houver uso real.

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
