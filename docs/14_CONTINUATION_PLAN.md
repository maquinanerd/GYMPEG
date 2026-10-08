# 14 — Plano de continuação

Estado em **2026-10-08**: G0 concluído; código no `main` de `maquinanerd/GYMPEG`; CI do GitHub verde (lint, typecheck, unit, integração com Postgres, build, E2E). Deploy no Coolify aguardando a criação dos recursos (ver abaixo).

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

- Cadastro aberto enquanto o épico 1.1 não sai: não divulgar a URL.
- Fotos de progresso em volume local do Coolify, sem backup, até o G3.
- O histórico herdado do upstream ainda contém as imagens removidas.
- `npm audit`: 2 críticas e 18 altas, a maioria transitiva de next-pwa/workbox; resolvidas pelo upgrade para Serwist (G3) ou antes, se alguma for explorável em runtime.
