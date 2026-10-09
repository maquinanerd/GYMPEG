# 10 — Deploy no Coolify

Ambiente atual: Coolify 4.4.3, servidor `localhost`, GitHub App `git-arrobapeg` com acesso a `maquinanerd/GYMPEG`.

## Recursos criados (2026-10-09, pela API do Coolify)

| Recurso | Nome | UUID |
|---|---|---|
| Projeto | GYM Peg (ambiente `production`) | `nraby31za1qalujxlubbjwnc` |
| Banco | `gympeg-postgres` (postgres:17-alpine, sem porta pública) | `ukxflpotnfj7e8xvbwxcobqk` |
| Aplicação | `gympeg` → https://gympeg.62.171.164.224.sslip.io | `1cvbajtvdg1jgoa0lp9l8ki7` |

Tudo abaixo já está configurado nesses recursos: as variáveis da tabela (com `DATABASE_URL` e `JWT_SECRET` só em runtime), o volume `/app/uploads`, o healthcheck, os 3 agendamentos de backup e o deploy automático a cada push em `main`. A injeção de variáveis como build args está desligada, porque o build não precisa de segredo. O MCP do Coolify só lê e faz deploy; criar recursos exige a API com um token de escrita.

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
| `EMAIL_PROVIDER` | `resend` | para reset de senha por e-mail |
| `RESEND_API_KEY` | chave da Resend (domínio do remetente verificado lá) | com `resend` |
| `EMAIL_FROM` | `GYM Peg <no-reply@seu-dominio>` | com `resend` |
| `APP_URL` | origem pública usada nos links dos e-mails (padrão: `NEXTAUTH_URL`) | não |
| `STORAGE_PROVIDER` | `s3` para guardar as fotos no bucket privado | quando houver bucket |
| `S3_ENDPOINT` | ex.: `https://<conta>.r2.cloudflarestorage.com` | com `s3` |
| `S3_BUCKET` | nome do bucket privado | com `s3` |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | token de API do R2 com leitura e escrita só nesse bucket | com `s3` |
| `S3_REGION` | `auto` no R2 (padrão) | não |

Sem `EMAIL_PROVIDER`, a tela "Esqueceu a senha?" informa que o reset por e-mail não está disponível.

`NODE_ENV`, `PORT`, `HOSTNAME` e `UPLOADS_DIR=/app/uploads` já vêm da imagem.

### Armazenamento persistente (provisório)

Aba **Persistent Storage** → volume `gympeg-uploads` montado em `/app/uploads`. As fotos de progresso ficam neste volume enquanto `STORAGE_PROVIDER` não estiver configurado; com o bucket, as novas vão direto para ele e as antigas migram na primeira leitura. O backup do Coolify **não cobre** esse volume.

### Healthcheck

Aba **Healthcheck** → habilitar, host **`127.0.0.1`**, path `/api/health`, porta `3000`. A imagem também declara `HEALTHCHECK` próprio.

O host precisa ser `127.0.0.1`, não `localhost`: na imagem Alpine o `wget` resolve `localhost` para `::1` (IPv6), enquanto o Next.js escuta só em `0.0.0.0` (IPv4). Com `localhost`, o healthcheck recebe "connection refused", o Coolify marca o container como unhealthy e desfaz o deploy.

Ao mudar uma variável pela API, envie o valor puro: o `real_value` devolvido pela API já vem entre aspas, e reenviá-lo duplica as aspas e quebra o `.env` do container.

## 4. Primeiro deploy

Deploy. Ao subir, acessar `/signup` e criar a conta com um e-mail listado em `SIGNUP_ALLOWED_EMAILS`. O catálogo de exercícios é criado automaticamente no registro (não precisa de seed).

> Em produção o cadastro vem fechado por padrão (`allowlist`): só os e-mails listados conseguem criar conta. Outros recebem "cadastro apenas por convite", sem revelar se o e-mail já existe.

## 5. Operação

- Logs e status: pelo Coolify ou pelo MCP (`list_deployments`, `get_deployment`).
- Uma réplica apenas: o rate limit é em memória (ver auditoria). Escalar horizontalmente exige Redis.
- Migrations: sempre versionadas em `prisma/migrations`; nunca `db push` em produção.

## Pendências para o Gate G3

Storage S3 privado para fotos e mídia de exercícios; envio de backup para S3 e teste de restore automatizado; ambiente `staging` com banco e bucket próprios; headers de segurança/CSP; rate limit compartilhado.
