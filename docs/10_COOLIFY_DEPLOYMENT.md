# 10 — Deploy no Coolify

Ambiente atual: Coolify 4.3.23, servidor `localhost`, GitHub App `git-arrobapeg` com acesso a `maquinanerd/GYMPEG`.

## Topologia

```
GitHub (main) ──webhook──▶ Coolify ──build Dockerfile──▶ app gympeg (porta 3000, HTTPS via Traefik)
                                                          │  DATABASE_URL (rede interna)
                                                          ▼
                                                 gympeg-postgres (postgres:17-alpine, sem porta pública)
                                                          │
                                                          ▼
                                                 backups agendados (local + S3 quando configurado)
```

A imagem aplica `prisma migrate deploy` ao iniciar (idempotente) e expõe `GET /api/health` (200 só com banco acessível). Não há comando de start customizado nem hook de pré-deploy.

## 1. Projeto

Projects → **+ Add** → nome `GYM Peg` → ambiente `production`.

## 2. PostgreSQL (recurso separado)

No ambiente `production`: **+ New** → Databases → **PostgreSQL**.

| Campo | Valor |
|---|---|
| Name | `gympeg-postgres` |
| Image | `postgres:17-alpine` |
| Username | `gympeg` |
| Database | `gympeg` |
| Password | gerada pelo Coolify |
| Make it publicly available | **desligado** |

Start. Copie a **Postgres URL (internal)**; ela vira o `DATABASE_URL` da app.

### Backups

Aba **Backups** do banco, três agendamentos para cumprir a retenção da spec (7 diários, 4 semanais, 6 mensais):

| Frequência (cron) | Retenção local |
|---|---|
| `0 4 * * *` | 7 |
| `0 5 * * 0` | 4 |
| `0 6 1 * *` | 6 |

Segunda cópia: em Settings → **S3 Storages**, cadastrar um bucket (R2/S3/MinIO) e marcar "Save to S3" nos três agendamentos. Hoje nenhum banco do servidor envia backup para S3; sem isso, backup e app estão na mesma máquina.

**Restore testado** é obrigatório antes de considerar o backup válido: restaurar um dump em um Postgres descartável e rodar `GET /api/health` contra ele.

## 3. Aplicação

**+ New** → **Private Repository (with GitHub App)** → `git-arrobapeg` → `maquinanerd/GYMPEG`, branch `main`.

| Campo | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Ports Exposes | `3000` |
| Domains | `https://gympeg.62.171.164.224.sslip.io` (wildcard sslip.io do servidor, HTTPS automático; domínio próprio pode ser somado depois) |
| Auto Deploy | ligado (deploy a cada push em `main`) |

### Variáveis de ambiente

Marque os segredos apenas como **runtime** (não "build variable"), para não ficarem gravados em camadas da imagem.

| Variável | Valor | Obrigatória |
|---|---|---|
| `DATABASE_URL` | Postgres URL (internal) do passo 2 | sim |
| `JWT_SECRET` | 48+ caracteres aleatórios (`openssl rand -base64 48`) | sim |
| `NEXTAUTH_URL` | `https://gympeg.62.171.164.224.sslip.io` | sim |
| `SIGNUP_MODE` | `allowlist` (padrão em produção; `open` libera o cadastro, `closed` fecha) | não |
| `SIGNUP_ALLOWED_EMAILS` | seu e-mail (e de quem você convidar), separados por vírgula | sim, para criar a primeira conta |
| `AI_PROVIDER` | `gemini` (ou `demo` até ter chave) | sim |
| `GEMINI_API_KEY` | chave do Google AI Studio | para IA real |
| `AI_FALLBACK_PROVIDER` | `deepseek` | opcional |
| `DEEPSEEK_API_KEY` | chave DeepSeek | se houver fallback |

`NODE_ENV`, `PORT`, `HOSTNAME` e `UPLOADS_DIR=/app/uploads` já vêm da imagem.

### Armazenamento persistente (provisório)

Aba **Persistent Storage** → volume `gympeg-uploads` montado em `/app/uploads`. As fotos de progresso ainda ficam em disco até o storage S3 privado ser implementado (G3). O backup do Coolify **não cobre** esse volume.

### Healthcheck

Aba **Healthcheck** → habilitar, path `/api/health`, porta `3000`. A imagem também declara `HEALTHCHECK` próprio.

## 4. Primeiro deploy

Deploy. Ao subir, acessar `/signup` e criar a conta com um e-mail listado em `SIGNUP_ALLOWED_EMAILS`. O catálogo de exercícios é criado automaticamente no registro (não precisa de seed).

> Em produção o cadastro vem fechado por padrão (`allowlist`): só os e-mails listados conseguem criar conta. Outros recebem "cadastro apenas por convite", sem revelar se o e-mail já existe.

## 5. Operação

- Logs e status: pelo Coolify ou pelo MCP (`list_deployments`, `get_deployment`).
- Uma réplica apenas: o rate limit é em memória (ver auditoria). Escalar horizontalmente exige Redis.
- Migrations: sempre versionadas em `prisma/migrations`; nunca `db push` em produção.

## Pendências para o Gate G3

Storage S3 privado para fotos e mídia de exercícios; envio de backup para S3 e teste de restore automatizado; ambiente `staging` com banco e bucket próprios; headers de segurança/CSP; rate limit compartilhado.
