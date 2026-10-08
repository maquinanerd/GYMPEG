# GymCoach: auditoria da camada de plataforma (Fase 0 / Gate G0)

- Repositório: `_audit/repos/gymcoach` (HEAD `a4d5e00`, 2026-10-07). Todos os caminhos abaixo são relativos à raiz do repo.
- Método: somente análise estática (leitura de código, `git log`, parse do `package-lock.json` com `python -I`). Nada foi instalado, buildado ou executado.
- Convenção: **[V]** = verificado no código (com `arquivo:linha`); **[A]** = alegado em README/CHANGELOG/docs, sem verificação; **[E]** = conhecimento externo ao repo (ecossistema), não verificado aqui.
- Fora de escopo (outra frente): algoritmos de treino, progressão, coach de IA e prompts.

---

## 1. Resumo executivo

1. Monólito Next.js 15.5 App Router com **55 route handlers em `app/api` + 2 em `app/mcp`**, nenhuma Server Action e **nenhuma camada de serviço/repositório**: 49 arquivos de rota e 14 páginas acessam o Prisma diretamente [V].
2. A isolação por usuário está **bem feita**. Todas as rotas que li filtram por `userId` na própria query, e há um teste-catraca que obriga cada rota parametrizada a ter um teste cross-user (`tests/integration/route-ownership-coverage.test.ts:1-50`). **Não encontrei IDOR explorável** [V].
3. A autenticação é fraca para um produto comercial: JWT HS256 *stateless* de 30 dias sem revogação, sem troca ou reset de senha, sem verificação de e-mail, cadastro aberto sem flag, bcrypt cost 10 e rate limit em memória com IP vindo de `X-Forwarded-For` [V].
4. Faltam por completo headers de segurança e CSP. O service worker guarda páginas e GETs autenticados de `/api/*` por até 7 dias, e o logout não limpa esse cache [V].
5. Os gaps de LGPD são graves. **Não existe exclusão de conta**, e as FKs `RESTRICT` bloqueariam um `user.delete`. O export (`/api/backup`) é incompleto: faltam medidas corporais, metas de volume, fotos e `coachNote`. Dados de saúde são enviados ao provedor de LLM sem fluxo de consentimento [V].
6. Fotos de progresso ficam em **disco local** (`UPLOADS_DIR`), servidas por rota autenticada com sniffing de magic bytes. Não há abstração S3 nem remoção de EXIF. As imagens de equipamento vão como `bytea` no Postgres [V].
7. O schema tem 22 models e 9 enums em 26 migrations lineares. **`Exercise` é por usuário (não existe catálogo global)**, há um só `muscleGroup`, nenhum alias/slug/pt-BR, e `Set` não tem `client_mutation_id`, `type` nem `rpe`. Faltam índices em FKs quentes, como `Set.sessionId` [V].
8. O Dockerfile é multi-stage e roda o standalone como usuário não-root, mas não tem HEALTHCHECK e as migrations rodam no `command` do compose. Funciona no Coolify com Postgres separado (basta `DATABASE_URL`), mas fica **limitado a uma réplica** por causa do rate limit em memória e do disco local [V].
9. Há dívida de stack em relação ao alvo: Zod 3, Tailwind 3, ESLint 8 (`.eslintrc.json` e `next lint`) e `@ducanh2912/next-pwa`, que é baseado em webpack e vira bloqueio para Next 16 com Turbopack [V/E].
10. A higiene de TypeScript é alta (strict, 0 `any`, 0 TODO, 180 arquivos de teste). Porém **309 dos 437 commits têm co-autoria do Claude** e o projeto roda como "experimento de autonomia". Na prática, o bus factor humano é de cerca de 1 pessoa [V].

**Veredito de plataforma:** dá para reaproveitar a UI, os parsers de importação, a abstração de LLM, o padrão de ownership e o pipeline de CI/Docker. O schema, a autenticação, o storage, o export/exclusão (LGPD) e o rate limit precisam ser **reprojetados**. O fork economiza bastante UI, mas pouca fundação de dados.

---

## 2. Arquitetura

### 2.1 Estrutura de pastas [V]
| Pasta | Conteúdo | Observação |
|---|---|---|
| `app/(app)/` | 16 páginas protegidas (dashboard, session, programs, history, progress, coach, chat, settings, exercises) | Server Components que consultam `db` diretamente. Exemplo: `app/(app)/progress/page.tsx` com 14 chamadas `db.` e 566 linhas |
| `app/(auth)/` | login e signup | |
| `app/(print)/` | ficha imprimível do programa | |
| `app/api/` | 55 `route.ts`: 25 GET, 37 POST, 8 PUT, 2 PATCH, 18 DELETE | Toda a escrita passa por route handlers. `grep "use server"` não retorna nada |
| `app/mcp/` | endpoint MCP Streamable HTTP + `/mcp/health` | |
| `lib/` | 98 módulos (sem contar testes): domínio puro (stats, progression, plates, warmup…), importadores, LLM, MCP, schemas Zod (`lib/schemas/*`, 20 arquivos) | Só 7 módulos de `lib` importam `db` |
| `components/` | 90 componentes, dos quais 71 são `'use client'`. Usa shadcn/ui (`components/ui/*`) | `session-runner.tsx` tem 940 linhas |
| `i18n/`, `messages/{en,fr,ru}` | catálogos em TypeScript tipado | **Não há pt-BR** (`i18n/config.ts:1`) |
| `prisma/` | `schema.prisma` (553 linhas), 26 migrations e `seed.ts` | Client gerado em `prisma/generated` (gitignored) |
| `scripts/` | `verify.sh` (green-gate dos agentes), scripts de container, seed de demo, gravação de mídia | |
| `tests/` | 36 de integração (Postgres real) e 20 E2E (Playwright) | |
| `docs/loops/`, `.claude/`, `CLAUDE.md`, `.coderabbit.yaml` | artefatos do processo de "agentes autônomos" | Não interessam ao produto |

### 2.2 Padrões e acoplamento [V]
- Os handlers seguem o padrão `requireApiUserId()`, depois `parseJsonBody(req, zodSchema)`, depois `db.*`, com erros tratados por `handleApiError()` (`lib/api.ts:113-211`). O padrão é consistente e simples.
- **Não há camada de serviço.** A lógica de persistência está duplicada entre REST e MCP, e já há divergência. Ao criar um `ProgramExercise`, a rota REST preenche `fatigueRate`/`loadAdjustmentPct` com `defaultIntraSetConfig` (`app/api/workouts/[id]/program-exercises/route.ts:42,55-56`), enquanto a tool MCP grava `null` (`lib/mcp/server.ts:765-766`).
- O domínio de cálculo fica em `lib/*` como funções puras e testáveis, o que é um ponto positivo. Já a montagem de dados para a UI fica nas páginas (Server Components).
- Comentários ainda carregam premissas de single-user: `prisma/schema.prisma:2` ("Single-user") e `lib/preferences.ts:1-2` ("Everything is single-user, so localStorage is enough"). A especificação original também é single-user (`docs/gymcoach-spec.md:20`).

### 2.3 `middleware.ts` [V]
- Valida só a assinatura do JWT no edge (`middleware.ts:18-45`). As rotas públicas ficam numa lista exata (`middleware.ts:7-16`): login, signup, `/mcp`, `/mcp/health`, `/api/locale` e as rotas de auth.
- O matcher exclui `_next/static`, `_next/image`, `exercise-media/`, `icons`, `manifest.json`, `sw.js` e `workbox-` (`middleware.ts:55`). O padrão `icons` não tem barra, então casa qualquer path que comece com "icons", o que é inofensivo hoje.
- O middleware não confere se o usuário ainda existe nem se o token foi revogado (não existe revogação).
- Cada página chama `requireSession()` (16 de 17 páginas; `programs/new` é estática). `requireSession` lança `Error` genérico (`lib/auth.ts:53-59`), o que gera 500 em vez de redirect se o token expirar entre o middleware e a página.

### 2.4 `next.config.js` [V]
- `output: 'standalone'` e `reactStrictMode` (`next.config.js:55-58`). Não há `headers()`, CSP, `poweredByHeader: false` nem `images.remotePatterns`.
- PWA via `@ducanh2912/next-pwa` com `register`, `skipWaiting` e `clientsClaim` (`next.config.js:5-51`). O runtime caching tem três entradas:
  - `pages`: NetworkFirst, 50 entradas, 7 dias (`:17-26`);
  - **`api-get`: NetworkFirst para todo GET em `/api/*`, 24 h (`:27-37`)**. Isso põe respostas autenticadas no Cache Storage. O comentário da linha 13 diz que as rotas de API não são pré-cacheadas, mas o cache em runtime acontece;
  - `static-assets`: CacheFirst (`:38-48`).
- O `sw.js` é gerado no build (está no `.gitignore` e não vai para o repo).

### 2.5 i18n [V]
- `next-intl` 4 sem prefixo de locale na URL. O locale vem do cookie `gymcoach.locale` (`i18n/request.ts:23-33`, `i18n/config.ts:1-7`). Os locales são `en`, `fr` e `ru`, **sem pt-BR**.
- Os catálogos ficam em `messages/<locale>/*.ts` (cerca de 1.228 linhas por locale). Nomes de exercício e de treino vêm de mapas estáticos (`i18n/exercise-names.ts`, 272 linhas).
- As mensagens de erro da API são strings em inglês fixas no código (por exemplo `app/api/sessions/route.ts:37`), sem i18n.
- **Fuso horário:** `timeZone` é o do servidor (`i18n/request.ts:31`) e a semana ISO é calculada em UTC (`lib/stats.ts:121-126`). `User` não guarda timezone. Para o Brasil (UTC-3), um treino depois das 21h cai no dia seguinte nas agregações semanais. O calendário de histórico é exceção: aceita `?tz=` (`lib/history-calendar.ts:17-22`).

### 2.6 PWA e offline [V]
- O manifest está em `public/manifest.json` (standalone, `lang: en`). O `pwa-update-manager.tsx` cuida das atualizações do SW.
- A fila offline usa Dexie e cobre **só séries** (`lib/indexeddb.ts:68-74`, tabela `pendingSets`).
- **Não há idempotência.** O `localId` não vai para o servidor (`lib/sync.ts:101-119`) e não existe constraint única. Se a resposta se perder depois do commit, o retry duplica a série; o risco é reconhecido em `app/api/sessions/[id]/sets/route.ts:77-80`.
- **O horário da série é o do servidor no momento da sincronização** (`Set.completedAt @default(now())`, `prisma/schema.prisma:395`). O payload não leva `createdAt`, então uma série registrada offline recebe o horário em que sincronizou.
- O logout não limpa o Cache Storage nem o IndexedDB (`components/auth/logout-button.tsx:14-19`; o único `caches.delete` do código está no seletor de idioma, `components/shared/language-selector.tsx:47-51`).
- As preferências (som, vibração, barra/anilhas, métricas) ficam em `localStorage` (`lib/preferences.ts:1-73`). Elas não sincronizam entre dispositivos e se misturam entre usuários num mesmo aparelho.

---

## 3. Schema Prisma

### 3.1 Visão geral [V]
- Generator `prisma-client` (Prisma 7) com output em `./generated` (`prisma/schema.prisma:4-8`). O datasource não tem `url`, que vem de `prisma.config.ts:23-30`.
- **26 migrations**, versionadas e lineares, de `20260430180630_lot_1_initial_schema` até `20260915033000_add_mcp_historical_equipment_backfill_audit`, mais `migration_lock.toml`, num total de 566 linhas de SQL. Várias foram escritas à mão com backfill de dados. Exemplo: `20260722161000_add_gym_profiles/migration.sql` faz heurística por nome em inglês e russo para preencher `equipmentType`.
- As migrations anteriores à criação do repo (abril/maio) vêm de uma base privada em francês que foi "migrada para inglês" (commit `2b05cb9`, 2026-05-26).
- IDs são `cuid()` em `TEXT`. `ProgressPhoto` usa `randomUUID()` (`app/api/progress-photos/route.ts:83`). Pesos são `Float` (DOUBLE PRECISION). Não há soft delete (`deletedAt`) em nenhuma tabela.

### 3.2 Models (22) [V]
| Model | Linhas | Campos-chave | Relações / onDelete | Índices / únicos |
|---|---|---|---|---|
| `User` | 14-58 | email, passwordHash, bodyweight, displayName, sex, heightCm, goal (enum), weeklyFrequency, unit (KG/LB), deloadUntil, coachNote, activeGymId | `activeGym` → Gym **SetNull** | `email @unique` |
| `McpAccessToken` | 62-75 | name, tokenHash (SHA-256), tokenPrefix, canWrite, lastUsedAt, revokedAt | User **Cascade** | `tokenHash @unique`; `(userId, createdAt)` |
| `McpHistoricalEquipmentBackfillAudit` | 82-95 | gymId, exerciseId, equipmentId (escalares sem FK), setIds `String[]`, equipmentSnapshot Json, undoneAt | User **Cascade** | `(userId, createdAt)` |
| `Conversation` | 117-127 | title | User (**RESTRICT**, padrão Prisma; SQL em `20260526010000_add_chat/migration.sql:31`) | `(userId, updatedAt)` |
| `Message` | 134-143 | role USER/ASSISTANT, content Text | Conversation **Cascade** | `(conversationId, createdAt)` |
| `Exercise` | 145-169 | **userId (catálogo por usuário)**, name, muscleGroup (1 enum), category COMPOUND/ISOLATION/CARDIO, equipmentType, defaultRestSec, notes, usesBodyweight | User **RESTRICT** (`lot_1…/migration.sql:132`) | `@@unique([userId, name])` |
| `Program` | 212-226 | name, description, phase (String livre), isActive, startDate, endDate | User **RESTRICT** (`:135`) | **nenhum índice em userId** |
| `Workout` (= template de dia) | 228-237 | name, dayOfWeek, order | Program **Cascade** | **nenhum** (programId sem índice) |
| `ProgramExercise` | 239-264 | order, targetSets, targetRepsMin/Max, targetRIR, restSec, tempo, notes, supersetGroup, autoregulationMode, fatigueRate, loadAdjustmentPct | Workout **Cascade**; Exercise **RESTRICT** | **nenhum** |
| `Session` (= treino executado) | 271-289 | startedAt, finishedAt, notes, gymId (congelado) | User **RESTRICT**; Program/Workout **SetNull**; Gym **SetNull** | `(userId, startedAt)` |
| `Gym` | 291-309 | name, dumbbellWeights[], plateWeights[], barWeights[] (kg) | User **Cascade** | `@@unique([userId, name])`; `(userId, updatedAt)` |
| `GymExerciseConfig` | 311-324 | isAvailable, weightOptions[] | Gym/Exercise **Cascade** | `@@unique([gymId, exerciseId])`; `(exerciseId)` |
| `GymEquipment` | 326-347 | name, equipmentType, manufacturer, modelName, quantity, **weightOptions[]**, imageUrl, **imageData Bytes**, imageMimeType | Gym **Cascade** | `@@unique([gymId, name])`; `(gymId, equipmentType)` |
| `GymEquipmentExercise` | 349-357 | PK composta | ambos **Cascade** | `@@id([equipmentId, exerciseId])`; `(exerciseId)` |
| `Set` | 359-403 | setNumber, weight, reps, rir (Int?), durationSec, distanceM, avgHr, maxHr, track Json, notes, **isWarmup, isDropSet (booleanos)**, completedAt, equipmentNameSnapshot, equipmentLoadSnapshot | Session **Cascade**; Exercise **RESTRICT**; GymEquipment **SetNull** | `(exerciseId, completedAt)`; `(gymEquipmentId, completedAt)`. **Não há índice em `sessionId`** |
| `ExerciseGoal` | 411-426 | targetWeight, targetReps, achievedAt | User/Exercise **Cascade** | `@@unique([userId, exerciseId])` |
| `VolumeTarget` | 436-448 | muscleGroup, mev, mrv | User **Cascade** | `@@unique([userId, muscleGroup])` |
| `BodyweightEntry` | 455-465 | weightKg, measuredAt, note | User **Cascade** | `(userId, measuredAt)` |
| `BodyMeasurement` | 471-482 | site (enum com 13 locais), valueCm, measuredAt | User **Cascade** | `(userId, site, measuredAt)` |
| `ProgressPhoto` | 506-520 | takenAt, storagePath (relativo), mimeType, byteSize, note | User **Cascade** | `(userId, takenAt)` |
| `CoachSession` | 522-531 | weekStart/End, prompt Text, response Text, appliedAt | **Nenhuma relação nem FK** com User (userId solto) | **nenhum índice** |
| `ReadinessCheckin` | 537-553 | readiness 1-5, sleepQuality 1-5, soreness Json, note | User **Cascade** | `(userId, createdAt)` |

Enums (9): `Sex` (97), `WeightUnit` (103), `TrainingGoal` (108), `MessageRole` (129), `EquipmentType` (171), `MuscleGroup` (181, com 16 valores incluindo OTHER), `ExerciseCategory` (202), `SetAutoregulationMode` (266) e `BodyMeasurementSite` (484).

**Problemas estruturais [V]:**
- Faltam índices em FKs muito consultadas: `Set.sessionId`, `Program.userId`, `Workout.programId`, `ProgramExercise.workoutId/exerciseId`, `Session.workoutId/programId/gymId` e `CoachSession.userId`. O Postgres não indexa FKs sozinho. As queries `set where session: { userId }` (por exemplo `lib/coach.ts:317-325` e `lib/last-performance.ts:35-58`, que faz N+1 por exercício) vão degradar com muitos usuários.
- Há uma mistura de `Cascade` (tabelas novas) com `RESTRICT` (tabelas originais: Exercise, Program, Session, Conversation e as FKs de Exercise). Isso deixa a exclusão de usuário inconsistente, e `CoachSession` ficaria órfã.
- Imagens de equipamento ficam em `bytea` (`schema.prisma:337-339`), com até 5 MB cada e 1.000 itens por academia (`lib/gym-equipment.ts:10-11`). Isso incha o banco e os backups.
- `Set` como nome de model sombreia o `Set` global do JS quando importado (`app/api/sessions/[id]/sets/route.ts:2`).

### 3.3 Gap em relação às entidades-alvo
| Entidade-alvo | Status | Model correspondente / observação |
|---|---|---|
| User | **existe** | `User`, mas mistura identidade, perfil e preferências |
| UserProfile | parcial | campos dentro de `User` (displayName, sex, heightCm, bodyweight, goal, weeklyFrequency, coachNote). Não tem data de nascimento nem nível de experiência |
| UserPreference | parcial | só `User.unit` está no banco; o resto fica em `localStorage` (`lib/preferences.ts`) |
| TrainingGoal | parcial | enum `TrainingGoal` com um único valor em `User.goal`; não é entidade |
| Gym | **existe** | `Gym`, com pesos livres por academia |
| Equipment (catálogo) | ausente | não há catálogo global; `GymEquipment` é instância por academia |
| GymEquipment (incrementos reais) | **parcial-forte** | `GymEquipment.weightOptions Float[]` com a lista explícita de cargas da máquina, mais `quantity`, `manufacturer`/`modelName` e vínculo N:N com exercício; também `GymExerciseConfig.weightOptions` e o snapshot por série (`Set.equipmentLoadSnapshot`). Não modela incremento/mín/máx nem carga de cabo/polia |
| Exercise | parcial | `Exercise` **por usuário** (seed de cerca de 56 itens no cadastro, `app/api/auth/register/route.ts:46`). Faltam slug, name_pt_br, aliases, movement_pattern, force_type, difficulty, laterality, unilateral, source e source_license. `category` cumpre parcialmente o papel de `mechanic` |
| ExerciseAlias | ausente | tradução estática em `i18n/exercise-names.ts`; lista de nomes por mídia em `data/exercise-media.json` |
| Muscle | ausente | só o enum `MuscleGroup` |
| ExerciseMuscle (role + contribution) | ausente | um único `muscleGroup` por exercício |
| ExerciseMedia | parcial | estático: `data/exercise-media.json` + `public/exercise-media/free-exercise-db/*` (Unlicense, `public/exercise-media/free-exercise-db/LICENSE.md`); não fica no banco |
| Program | **existe** | `Program` (`phase` é string) |
| ProgramPhase | ausente | `Program.phase` String |
| ProgramWeek | ausente | — |
| WorkoutTemplate | **existe** | é o model chamado **`Workout`** |
| WorkoutTemplateExercise | **existe** | `ProgramExercise` |
| ExercisePrescription | parcial | embutida em `ProgramExercise` (sets, faixa de reps, RIR, descanso, tempo, superset, autoregulação); não há prescrição por série nem por semana |
| ProgressionRule | ausente | a regra está em código (`lib/progression.ts`) |
| ProgramRevision | ausente | o "apply" do coach edita no lugar e prefixa notas (`app/api/coach/[id]/apply/route.ts:100-119`) |
| Workout (executado) | **existe** | é o model chamado **`Session`** |
| WorkoutExercise | ausente | `Set` aponta direto para `exerciseId`; a ordem vem do template |
| WorkoutSet | parcial | `Set`: weight, reps, rir (Int 0-5, `lib/schemas/set.ts:18`), isWarmup e isDropSet. Faltam **client_mutation_id**, **type** (WARMUP/WORKING/DROP/AMRAP/FAILURE/BACKOFF), **rpe** e **is_pr** |
| RestTimerPreference | parcial | `Exercise.defaultRestSec`, `ProgramExercise.restSec` e o resto em `localStorage` |
| PersonalRecord | ausente | calculado na hora (`lib/records.ts`) |
| ExerciseGoal | **existe** | `ExerciseGoal` (1 por usuário e exercício) |
| BodyWeightEntry | parcial | `BodyweightEntry`, **sem `source`** |
| BodyMeasurement | **existe** | `BodyMeasurement` |
| ProgressPhoto | **existe** | `ProgressPhoto` (disco local; sem pose/ângulo) |
| ReadinessCheckin | **existe** | `ReadinessCheckin` |
| TrainingRecommendation | parcial | `CoachSession` (debrief em markdown + appliedAt); os ajustes não ficam persistidos de forma estruturada |
| TrainingInsight | ausente | calculado (`lib/home-insight.ts`) |
| AiConversation | **existe** | `Conversation` |
| AiMessage | **existe** | `Message` (sem modelo, tokens ou custo) |
| AIUsage | ausente | nenhuma contabilidade de tokens em `lib/llm/*` |
| ImportJob | ausente | importações síncronas numa única transação (`app/api/import/strong/route.ts:133-136`) |
| ExportJob | ausente | `GET /api/backup` síncrono |
| AuditLog | ausente | só a auditoria específica `McpHistoricalEquipmentBackfillAudit` |
| NotificationPreference | ausente | — |
| Trainer / TrainerClient | ausente | não há papéis nem relação treinador-aluno |

Extras do GymCoach que não estão na especificação: `VolumeTarget` (MEV/MRV por músculo), `McpAccessToken`, `GymExerciseConfig` e `GymEquipmentExercise`.

---

## 4. Autenticação e segurança

### 4.1 Fluxo [V]
- O **cadastro** fica em `POST /api/auth/register` (`app/api/auth/register/route.ts`). É aberto a qualquer visitante, sem flag de convite ou bloqueio (nenhum `ALLOW_SIGNUP`/`DISABLE_SIGNUP` no repo). Usa bcrypt **cost 10** (`:40`), faz seed do catálogo de exercícios para o usuário (`:46`) e loga em seguida. Retorna 409 quando o e-mail já existe (`:33-37`), o que permite enumeração.
- O **login** fica em `POST /api/auth/login`. Tem rate limit de 10/min por IP (`:16`) e Zod. O e-mail **não é normalizado** (sem lowercase, `:30`). Não há comparação bcrypt "dummy" quando o usuário não existe (`:39`), o que permite enumeração por timing. O corpo é lido com `req.json()` sem limite (`:23`).
- A **sessão** é um JWT HS256 (`jose`) com claims `userId` e `email` e TTL de 30 dias (`lib/auth.ts:11,26-32`), num cookie `gymcoach-session` com `httpOnly`, `sameSite: 'lax'`, `path=/`, `Secure` por padrão em produção e possibilidade de opt-out por env (`lib/auth.ts:78-92`). O segredo exige 32 caracteres ou mais (`lib/auth.ts:13-19`).
- O **logout** só apaga o cookie (`app/api/auth/logout/route.ts:6`). Como não há `jti`, versionamento de sessão nem tabela de sessões, um token vazado continua válido por 30 dias.
- **Funcionalidades ausentes:** troca de senha, reset de senha, verificação de e-mail, 2FA, papéis/admin e exclusão de conta (`grep` por `user.delete`/`deleteAccount` sem resultado; `passwordHash` só aparece em login, register e no comentário do backup).

### 4.2 Autorização por rota (IDOR) [V]
- Todas as 51 rotas não públicas de `app/api` chamam `requireApiUserId()`. As únicas sem essa chamada são `auth/login`, `auth/register`, `auth/logout` e `locale`, todas públicas por desenho.
- O padrão das rotas com `[id]` é escopar a própria leitura ou escrita por `userId`. Exemplos:
  - `db.exercise.update({ where: { id, userId } })` (`app/api/exercises/[id]/route.ts:31-34`);
  - `db.workout.delete({ where: { id, program: { userId } } })` (`app/api/workouts/[id]/route.ts:33`);
  - `programExercise` via `workout: { program: { userId } }` (`app/api/program-exercises/[id]/route.ts:21-25,36-37,66-68`);
  - sets via `JOIN Session ... userId` com `FOR UPDATE` (`app/api/sets/[id]/route.ts:24,64`).
- IDs vindos no corpo da requisição também são validados:
  - `exerciseId` (`app/api/sessions/[id]/sets/route.ts:33-38`, `app/api/workouts/[id]/program-exercises/route.ts:29-34`);
  - `workoutId`/`gymId` (`app/api/sessions/route.ts:33-51`);
  - `exerciseConfigs[].exerciseId` (`lib/gym-data.ts:4-15`);
  - `gymEquipmentId` (`lib/set-equipment.ts:22-43`);
  - `exerciseIds` de equipamento (`lib/gym-equipment.ts:310-318`);
  - `setIds` do backfill MCP (`lib/mcp/historical-equipment-backfill.ts:255-297`).
- As páginas com `[id]` também filtram por usuário. `history/[id]` faz `findUnique` e depois compara (`app/(app)/history/[id]/page.tsx:61,88`); está correto, mas é o único lugar com o padrão "busca e depois compara".
- **Suspeitos de IDOR:** nenhum explorável encontrado. Pontos de atenção que não são IDOR:
  - `POST /api/coach/[id]/apply` aplica ajustes **enviados pelo cliente** (não os do debrief salvo) ao programa ativo do próprio usuário, fora de transação (`app/api/coach/[id]/apply/route.ts:20,111-117`);
  - `history/[id]` usa o padrão "comparar depois";
  - o cálculo de `order` (max+1) não tem lock nem constraint única (`app/api/programs/[id]/workouts/route.ts:24-29`).
- A disciplina é mantida pelo ratchet de teste `tests/integration/route-ownership-coverage.test.ts:1-80` mais `route-ownership.test.ts` (553 linhas).

### 4.3 Validação de entrada [V]
- Há Zod em quase todo o input (20 schemas em `lib/schemas/*`, 39 arquivos importam `zod`). Os objetos usam strip por padrão (sem `.passthrough()`), então não há mass assignment: por exemplo, `exerciseInputSchema` não aceita `userId` (`lib/schemas/exercise.ts:14-24`).
- Bug menor: `z.coerce.boolean()` transforma a string `"false"` em `true` (`lib/schemas/exercise.ts:22`).
- `parseJsonBody` **só limita o tamanho se `maxBytes` for passado** (`lib/api.ts:121-142`). O próprio código reconhece que route handlers não têm limite de corpo (`lib/api.ts:144-149`). Têm limite as importações (cerca de 7,5 MB), o backup (50 MB), fotos (8 MiB), imagens de equipamento (7,1 MB) e `sets/parse` (4 KB). **Login e register (públicos) e quase todas as rotas autenticadas não têm limite.**
- Os parsers XML (GPX/TCX) são próprios e rejeitam `<!DOCTYPE`/`<!ENTITY`, então são seguros contra XXE (`lib/import/gpx.ts:307`, `lib/import/tcx.ts:246`). O CSV de exportação neutraliza fórmulas (`lib/csv.ts:42-48`). O markdown do coach usa `react-markdown` sem `rehype-raw`, e não há `dangerouslySetInnerHTML`.

### 4.4 MCP (`app/mcp`, `lib/mcp`) [V]
- **Autenticação:** token pessoal `gmc_` + 32 bytes aleatórios em base64url (`lib/mcp/auth.ts:12-14`), guardado como SHA-256 (`:16-18`), com no máximo 10 ativos por usuário (`app/api/mcp-tokens/route.ts:35-36`). Tem flags `canWrite` e `revokedAt`. **Não expira.**
- **Transporte do token:** pode ir no header `Authorization: Bearer`, em `X-GymCoach-Token` **ou em `?token=` na query string** (`lib/mcp/auth.ts:24-34`). A URL de conector exibida ao usuário embute o token na query (`app/api/mcp-tokens/route.ts:58-60`), de modo que ele vaza em logs de proxy (Traefik), histórico e referers.
- **Permissões:** são 22 tools; as 12 de escrita chamam `requireWrite` (`lib/mcp/server.ts:81-87`; chamadas nas linhas 313, 347, 377, 543, 567, 643, 667, 700, 729, 807, 841 e 866). Todas as queries usam `principal.userId`.
- **CORS:** `Access-Control-Allow-Origin: *` por padrão (`lib/mcp/cors.ts:103-105`). A proteção contra DNS rebinding é **opt-in** via `MCP_ALLOWED_ORIGINS`/`MCP_ALLOWED_HOSTS` (`app/mcp/route.ts:35-46`). Como a autenticação é por bearer e não por cookie, o `*` tem impacto limitado.
- **Rate limit:** nenhum. Cada requisição consulta o banco para validar o token, e há um `update lastUsedAt` *fire-and-forget* (`lib/mcp/auth.ts:46-51`).
- **Transporte:** stateless (`sessionIdGenerator: undefined`), GET retorna 405 (`app/mcp/route.ts:59-70`).

### 4.5 Achados de segurança
| # | Sev. | Achado | Evidência |
|---|---|---|---|
| S1 | **Alta** | Sessão JWT de 30 dias sem revogação/rotação; logout não invalida; não existe troca/reset de senha | `lib/auth.ts:11,26-32`; `app/api/auth/logout/route.ts:6` |
| S2 | **Alta** | Sem exclusão de conta (LGPD art. 18); FKs `RESTRICT` (Exercise/Program/Session/Conversation) e `CoachSession` sem FK impedem uma exclusão limpa | grep sem resultado; `prisma/migrations/20260430180630_lot_1_initial_schema/migration.sql:132,135,147`; `20260526010000_add_chat/migration.sql:31`; `schema.prisma:522-531` |
| S3 | **Alta** | Service worker guarda HTML autenticado (7 dias) e todo GET de `/api/*` (24 h); logout não limpa caches nem IndexedDB. Em dispositivo compartilhado, os dados de saúde ficam acessíveis offline | `next.config.js:17-37`; `components/auth/logout-button.tsx:14-19` |
| S4 | Média | Nenhum header de segurança: sem CSP, `frame-ancestors`/X-Frame-Options (clickjacking), HSTS, Referrer-Policy; `X-Powered-By` exposto | `next.config.js:54-58` (sem `headers()`); grep sem resultado |
| S5 | Média | Corpo JSON sem limite em rotas públicas (`login`/`register`) e na maioria das autenticadas: DoS de memória | `app/api/auth/login/route.ts:23`; `lib/api.ts:128-132,144-149` |
| S6 | Média | Rate limit em memória com `Map` nunca podado, por processo, com chave de IP vinda do primeiro `X-Forwarded-For` (falsificável se o proxy não sobrescrever); sem lockout por conta | `lib/rate-limit.ts:269,278-302` |
| S7 | Média | Token MCP aceito/divulgado em query string; tokens sem expiração; sem rate limit no `/mcp` | `lib/mcp/auth.ts:33`; `app/api/mcp-tokens/route.ts:60` |
| S8 | Média | Dados de saúde (perfil, coachNote com lesões, check-ins, histórico) enviados ao provedor de LLM sem consentimento registrado; o prompt completo fica persistido em `CoachSession.prompt` | `app/api/coach/chat/route.ts:69-77`; `app/api/coach/route.ts:15-31`; `SECURITY.md` admite |
| S9 | Média | Export incompleto (portabilidade): `/api/backup` não inclui BodyMeasurement, VolumeTarget, ProgressPhoto nem `coachNote`, embora o README diga "export everything" | `app/api/backup/route.ts:45-63,100-173` (grep sem os models); README:57,233-235 [A] |
| S10 | Baixa | Cadastro aberto sem flag; enumeração de e-mail (409 e timing); e-mail sensível a maiúsculas | `app/api/auth/register/route.ts:33-37`; `app/api/auth/login/route.ts:30,39` |
| S11 | Baixa | bcrypt cost 10 (aceitável mas no limite; argon2id preferível); truncamento do bcrypt em 72 bytes com senha de até 200 caracteres | `app/api/auth/register/route.ts:40`; `lib/schemas/auth.ts:5-8` |
| S12 | Baixa | CSRF: depende só de `SameSite=Lax`; `parseJsonBody` não exige `Content-Type: application/json`, então um site *same-site* (subdomínio irmão no mesmo domínio do Coolify) consegue POST `text/plain`; só `/api/locale` checa Origin | `lib/api.ts:121-136`; `app/api/locale/route.ts:20-33` |
| S13 | Baixa | Fotos sem remoção de EXIF (GPS); a observação vai na query string (fica em logs) | `app/api/progress-photos/route.ts:59-63,72-85` |
| S14 | Baixa | Seed com credencial padrão (`change-me-immediately`) e demo com `NEXT_PUBLIC_DEMO_PASSWORD` embutido no bundle | `prisma/seed.ts:31-40`; `.env.example:29-31`; `Dockerfile:28-33` |
| S15 | Info | Logs: `console.error(err)` cru (erros do Prisma podem trazer valores); sem logger estruturado nem observabilidade | `lib/api.ts:209`; `app/api/auth/login/route.ts:48` |

Segredos: só via env (`.env.example`). `.env` e `/secrets/` estão no `.gitignore`. Não encontrei segredo commitado nos arquivos lidos.

---

## 5. Uploads e fotos [V]

- **Fotos de progresso**
  - Os bytes vêm crus no corpo, com limite de 8 MiB aplicado durante a leitura do stream (`lib/progress-photo.ts:23`; `app/api/progress-photos/route.ts:72`).
  - O tipo é decidido por **magic bytes** (allowlist jpeg/png/webp; o `Content-Type` do cliente é ignorado) (`lib/progress-photo.ts:29-55`).
  - A gravação é em **disco local**: `path.resolve(UPLOADS_DIR ?? './uploads', 'progress-photos')`, com arquivo `<userId>/<uuid>.<ext>`, modo 0600 e diretório 0700 (`lib/progress-photo.ts:71-84,129-138`). O nome do arquivo é UUID gerado no servidor (`app/api/progress-photos/route.ts:83`). Há verificação de contenção de path com `realpath` (`lib/progress-photo.ts:111-123`).
  - As fotos são servidas **só** por `GET /api/progress-photos/[id]/image`, escopado por usuário, com `Cache-Control: private, no-store` e `nosniff` (`app/api/progress-photos/[id]/image/route.ts:17-45`). Não estão em `/public`.
  - A exclusão remove o arquivo antes da linha no banco (`app/api/progress-photos/[id]/route.ts:28-29`).
  - **Não há** re-encode, remoção de EXIF, thumbnails, quota por usuário nem abstração de object storage.
- **Imagens de equipamento:** chegam em base64 no JSON (até 5 MB decodificado, `lib/gym-equipment.ts:10,515-543`) e são **gravadas em `GymEquipment.imageData` (bytea)**. Uma URL externa `https://` também é aceita (`lib/schemas/gym-equipment.ts:25`), e a rota responde com redirect para ela (`app/api/gym-equipment/[id]/image/route.ts:18`).
- **Mídia de exercícios:** são estáticos públicos em `public/exercise-media/free-exercise-db` (cerca de 11 MB, licença Unlicense incluída) e ficam fora do middleware (`middleware.ts:49-55`).
- **Diferença em relação ao alvo** (bucket S3 privado, signed URL curta e object key UUID): só a object key em UUID já existe. Seria preciso criar uma interface `StorageProvider` (put/get/delete/signedUrl), migrar as fotos e o `bytea` de equipamento para S3, servir por signed URL e adicionar remoção de EXIF, thumbnails e quotas. O ponto de troca é pequeno (`lib/progress-photo.ts` tem 158 linhas, mais 3 rotas).

---

## 6. Infra, deploy e Coolify

### 6.1 Dockerfile [V]
- Multi-stage `deps → builder → prod-deps → runner` em `node:22-alpine` (`Dockerfile:9-92`), com `output: standalone`. O runner recebe o `node_modules` de produção completo (`npm ci --omit=dev`, `:47-51,68`), que inclui o Prisma CLI e o `tsx`, então a imagem fica grande. Isso foi feito para contornar o bug do bcrypt nativo (#127, comentado em `:40-46`).
- Roda com **usuário não-root** `nextjs` (uid 1001) (`:62-63,87`). `/app/uploads` é criado com o owner certo (`:84-85`).
- **Não tem `HEALTHCHECK`**, e não existe `/api/health` público (o `/mcp/health` exige token). O `CMD` é só `node server.js` (`:92`): **as migrations não rodam na imagem**, apenas no `command` dos composes.
- As variáveis `NEXT_PUBLIC_DEMO_*` são *build args* (`:28-33`).

### 6.2 Composes [V]
- `docker-compose.yml` sobe só o Postgres de desenvolvimento, na porta 5433 do host.
- `docker-compose.prod.yml` builda o app e sobe o Postgres junto. Roda `prisma migrate deploy && node server.js` (`:68-69`) e expõe o app só em `127.0.0.1:3010` (`:73`). Tem um perfil `seed-demo` (`:81-95`). Esse compose **não repassa `LLM_PROVIDER` nem `ANTHROPIC_API_KEY`** (`:44-61`), embora `anthropic` seja o padrão.
- `docker-compose.selfhost.yml` usa a imagem `ghcr.io/gymcoach-app/gymcoach:latest` (`:149`) com o Postgres no mesmo compose, aplica as migrations no start (`:174-175`) e publica a porta `${GYMCOACH_PORT:-3000}` (`:177`).
- `docker-compose.test.yml` sobe um Postgres em tmpfs na porta 5434.
- **Produção usa `migrate deploy`** (nunca `db push`). O seed de demo só roda manualmente.

### 6.3 GitHub Actions [V]
- `ci.yml`: lint, typecheck e testes unitários; integração com o Postgres como service; build de produção; *docker-smoke* (build da imagem, migrate, `GET /login`, register e login); e2e com Playwright. Usa actions em tags mutáveis (`@v5`, `@v3`, `@v6`), sem pin por SHA.
- `publish-image.yml`: dispara com `workflow_run` depois de CI verde no main e publica `:latest` e `:sha-xxx` só para amd64 (`:283-340`).
- `deploy-demo.yml`: só `workflow_dispatch`, com `permissions: {}` e SSH com forced command (`:221-258`). É específico da instância demo deles e não serve para nós.

### 6.4 Adequação ao Coolify (Postgres como recurso separado, sem porta exposta, backup no Coolify)
| Requisito | Situação |
|---|---|
| Build pack Dockerfile | Funciona (standalone, porta 3000, `HOSTNAME=0.0.0.0`) |
| Postgres separado | Funciona: só depende de `DATABASE_URL` (`lib/db.ts:228`; `prisma.config.ts:29`). **Não usar** os composes `prod`/`selfhost`, que embutem o banco e (no selfhost) publicam porta |
| Migrations | Precisa configurar o *pre-deployment command* `node node_modules/prisma/build/index.js migrate deploy` ou mudar o `CMD`/entrypoint. O caminho do bundle é necessário porque o shim `.bin` quebra (`docker-compose.prod.yml:64-67`) |
| Healthcheck | Não existe. Criar `/api/health` (DB ping) e `HEALTHCHECK`; enquanto isso, usar `GET /login` = 200 |
| Persistência | Precisa de Persistent Storage em `/app/uploads`. **O backup do Coolify cobre só o banco**: as fotos ficariam sem backup. É mais um motivo para ir de S3 |
| Escala horizontal | **Inviável hoje**: rate limit em memória (`lib/rate-limit.ts:269`) e disco local. Ficaria limitado a uma réplica |
| HTTPS/proxy | Traefik faz o TLS; o cookie é `Secure` por padrão em produção (`lib/auth.ts:78-82`); o rate limit usa XFF (Traefik sobrescreve XFF de clientes não confiáveis [E]) |
| Segredos | `JWT_SECRET` (32 caracteres ou mais), chaves de LLM e `DATABASE_URL` como env do Coolify |
| Tamanho do banco | Imagens de equipamento em `bytea` incham o dump e o tempo de restore |

---

## 7. Dependências

Versões resolvidas no `package-lock.json` (lockfileVersion 3, **1.242 entradas, 667.912 bytes**) [V]:

| Pacote | Versão | Alvo / risco |
|---|---|---|
| next | 15.5.19 (`package.json:53`, fixado) | Alvo é o 16. O código já usa APIs assíncronas (`await props.params`, `await cookies()`), o que facilita. Pendências [E]: `middleware.ts` → `proxy.ts` (depreciado no 16), `next lint` removido (`package.json:11`), Turbopack como padrão no build |
| @ducanh2912/next-pwa | 10.2.9 | **Bloqueio para Next 16 com Turbopack**: é plugin webpack (workbox-build 7.1, que traz `glob@7`, `inflight` e `rimraf@3`, todos depreciados). Migrar para Serwist [E] |
| react / react-dom | 19.2.7 | ok |
| zod | 3.25.76 (`:66`) | Alvo é o 4: 39 arquivos importam zod e há 21 usos de `.email()/.cuid()/.url()/.datetime()/.date()`, formas depreciadas no v4. `@hookform/resolvers` 3.10 precisaria ir para a v5 [E] |
| tailwindcss | 3.4.19 (`:90`) | Alvo é o 4: usa `tailwind.config.ts` e `@tailwind` (`app/globals.css:1-3`) com shadcn/ui. `tailwind-merge` 2.6 iria para a v3 |
| eslint | 8.57.1 (**depreciado/EOL** segundo o lockfile) + `.eslintrc.json` | Alvo é o ESLint 9 com flat config; `eslint-config-next` 15.5.19 |
| prisma / @prisma/client / adapter-pg | 7.8.0 | atual; `prisma` e `tsx` estão em `dependencies` (vão para a imagem) |
| jose | 5.10.0 | v6 disponível [E] |
| bcrypt | 6.0.0 | binding nativo (exige toolchain no alpine; já causou o bug #127) |
| dexie | 4.4.3 | ok |
| next-intl | 4.13.2 | ok |
| @anthropic-ai/sdk | 0.98.1 | ok |
| @modelcontextprotocol/sdk | 1.29.0 | ok |
| lucide-react | 0.460.0 | antigo |
| vitest | 4.1.8; @playwright/test 1.60.0; typescript 5.9.3 | ok |

Pacotes marcados como depreciados no lockfile: 9 (eslint 8, `@humanwhocodes/*`, `glob@7`, `inflight`, `rimraf@3`, `sourcemap-codec`, `source-map@0.8-beta`, `whatwg-encoding`). Há `overrides.form-data` (`package.json:97-99`), o que indica que já foi preciso corrigir uma CVE transitiva.

---

## 8. Qualidade e dívida técnica [V]

- **Tamanho:** cerca de 39,4 mil linhas de código-fonte sem testes (app, components, lib, i18n) e cerca de 29 mil linhas de testes. Os maiores arquivos:

  | Arquivo | Linhas |
  |---|---|
  | `lib/coach.ts` | 1.008 |
  | `app/api/backup/route.ts` | 976 |
  | `components/session/session-runner.tsx` | 940 |
  | `lib/mcp/server.ts` | 887 |
  | `lib/programs/templates.ts` | 880 |
  | `components/session/editable-sets-table.tsx` | 795 |
  | `components/session/set-input.tsx` | 746 |
  | `lib/stats.ts` | 638 |
  | `lib/gym-equipment.ts` | 615 |
  | `components/settings/import-section.tsx` | 615 |

- **TypeScript:** `strict` + `noUncheckedIndexedAccess` + `noImplicitOverride` (`tsconfig.json:7-9`). ESLint com `no-explicit-any: error` (`.eslintrc.json:8`). Contagem: **0 `any`**, **0 TODO/FIXME/HACK**, 9 `eslint-disable` e 1 `@ts-ignore/expect-error`.
- **Dívida visível:**
  - não há camada de serviço, e REST e MCP já divergem (seção 2.2);
  - o backup é um monólito de 976 linhas, síncrono, numa transação de 60 s com até 50 MB em memória;
  - há N+1 em `lib/last-performance.ts`;
  - nenhuma listagem tem paginação (bodyweight, measurements, mensagens);
  - todo o histórico da conversa é reenviado ao LLM a cada mensagem (`app/api/coach/chat/route.ts:59-67`);
  - comentários extensos referenciando issues (o estilo é verboso mas útil).
- **Testes:**

  | Tipo | Arquivos | Escopo |
  |---|---|---|
  | Unitários (`lib/**/*.test.ts`) | 85 | domínio, schemas, parsers de importação, LLM, MCP auth/cors, sync |
  | Componentes (`components/**/*.test.tsx`) | 39 | principalmente `session/*`, `progress/*`, `settings/*` |
  | Integração (`tests/integration`) | 36 | Postgres real: ownership (2 suites), backup, importações, MCP, rotas de progresso/fotos, sets e concorrência |
  | E2E (`tests/e2e`) | 20 | auth, importações (Strong, Hevy, FIT, GPX, TCX, GymCoach), fotos, medidas, metas, superset, chat, deload, retorno ao treino, seletor de peso |

  Não há e2e de offline/SW. Não há meta de cobertura no CI (`vitest.config.ts:14-21`).

---

## 9. Maturidade [V]

- O primeiro commit público é de 2026-05-26 ("bootstrap open-source edition"), seguido pela migração do código de francês para inglês (`2b05cb9`). O último commit é de 2026-10-07. A tag `v1.0.0` é de 2026-10-05 (CHANGELOG:38).
- **Ritmo:** 2026-05: 20 commits; 06: 177; 07: 33; 08: 34; 09: 164; 10: 9. É um padrão em rajadas.
- **Por tipo** (sem merges): feat 118, fix 94, docs 91, test 29, chore 21, refactor 4. Há 56 merges.
- **Autores:** Julien Audibert (188 + 57 + 1 commits em três identidades), bot "GymCoach" (109), Renat (74 + 3) e contribuidores pontuais (3 e 2). **Bus factor humano de cerca de 1** (Julien), com um segundo colaborador relevante.
- **Geração por IA:** 309 mensagens de commit têm `Co-Authored-By: Claude …` (Fable 5/5.1, Opus 4.7/4.8/5.5). O repo se descreve como mantido por *loops* autônomos (`docs/loops/README.md`, `docs/loops/07-autonomy.md` "autonomy experiment"), com 16 tags `autonomy-baseline-*`. As permissões do agente são amplas (`.claude/settings.json`: `Bash(node *)`, `Bash(npm install)`, `git push`). Na prática: muito código produzido rapidamente, com alto grau de consistência e testes, mas com **dívida de compreensão humana**. Ninguém de fora do loop conhece a base a fundo.
- **Estabilidade:** o CHANGELOG segue Keep a Changelog, com seção Security (CHANGELOG:633-657) [A/V]. O alto número de `fix` logo após `feat` (ondas de PR "fixup/3xx") indica churn.
- **Licença:** MIT, "Copyright (c) 2026 GymCoach contributors" (`LICENSE:1-3`). Pode virar fork comercial desde que o aviso seja mantido. As mídias de exercício são Unlicense.

---

## 10. Reaproveitamento

### Reaproveitáveis (com adaptação)
- `lib/api.ts`: `readBodyBytesWithCap`, `handleApiError` e o padrão `requireApiUserId`/`parseJsonBody`. O ideal é tornar `maxBytes` obrigatório.
- O padrão de ownership com escopo na query e o **ratchet de teste** (`tests/integration/route-ownership*.test.ts`).
- `lib/import/*` (Strong, Hevy, GymCoach CSV, FIT, GPX, TCX, mais `track.ts`) e seus testes. São parsers endurecidos (caps, Zod, XML sem DTD) e de alto valor.
- `lib/csv.ts` (escape com proteção contra fórmula) e `app/api/history/csv/route.ts`.
- `lib/llm/*` (interface de provider: Anthropic, OpenRouter, codex-lb e demo). Falta acrescentar contabilidade de uso (AIUsage).
- `lib/mcp/auth.ts` e `lib/mcp/cors.ts` (token com hash, flags de escrita), sem o modo `?token=`.
- `lib/progress-photo.ts`: `sniffImageType` e a checagem de contenção. A parte de disco seria trocada pelo provider S3.
- `lib/sync.ts` e `lib/indexeddb.ts` como base da fila offline (falta enviar `client_mutation_id` e `performedAt`).
- `components/ui/*` (shadcn), além dos componentes de sessão e progresso (a avaliação funcional é da outra frente).
- `Dockerfile` (multi-stage, não-root) e `ci.yml` (especialmente o *docker-smoke*), com adaptações.
- Estrutura de i18n com catálogos TS tipados (falta adicionar `pt-BR`).

### NÃO reaproveitáveis (reprojetar)
- `prisma/schema.prisma` e as 26 migrations: catálogo de exercício por usuário, ausência de Muscle/ExerciseMuscle/Alias, `Set` sem idempotência e tipo, FKs RESTRICT, índices faltando. **Recomendação: nova baseline de migrations.**
- `lib/auth.ts` e as rotas `auth/*`: trocar por sessões em banco (revogáveis), com reset/troca de senha, verificação de e-mail e argon2id.
- `lib/rate-limit.ts` (em memória): trocar por Redis ou Postgres.
- `app/api/backup/route.ts`: substituir por `ExportJob`/`ImportJob` assíncronos e completos (LGPD).
- `lib/preferences.ts` (localStorage): passar a ser `UserPreference` no banco.
- `@ducanh2912/next-pwa` e o bloco PWA de `next.config.js`: migrar para Serwist, com política de cache sem `/api/*` autenticado e limpeza no logout.
- `docker-compose.prod.yml`, `docker-compose.selfhost.yml` e `deploy-demo.yml`: não servem para o Coolify.
- `.claude/`, `CLAUDE.md`, `docs/loops/`, `.coderabbit.yaml`, `scripts/verify.sh`, `scripts/record.mjs` e `scripts/screenshots.mjs`: artefatos do processo deles, a remover.
- `prisma/seed.ts` com a credencial padrão.

---

## 11. Riscos para o fork

1. **Reescrita de fundação.** O modelo de dados alvo diverge em catálogo, músculos, prescrição por semana/fase, `WorkoutExercise` e tipagem de séries. Quase toda query em 49 rotas e 14 páginas seria afetada, e não há camada de serviço para isolar a mudança.
2. **LGPD.** Faltam exclusão de conta, export completo, consentimento para envio de dados de saúde à IA, limpeza de cache do SW no logout e remoção de EXIF. São bloqueios para lançamento comercial no Brasil.
3. **Segurança de sessão.** JWT de 30 dias irrevogável e ausência de reset de senha são inaceitáveis para SaaS. Somam-se a ausência de CSP/headers e corpos sem limite.
4. **Escala e operação.** Faltam índices em FKs quentes e há rate limit em memória, disco local para fotos, imagens em `bytea`, nenhum health endpoint e nenhum logger estruturado. Isso limita a uma réplica e torna os backups incompletos no Coolify.
5. **Upgrade de stack.** Next 16 com Turbopack exige trocar o plugin PWA. Somam-se Zod 4 (com resolvers v5), Tailwind 4 (com shadcn) e ESLint 9 flat config. Isso dá várias semanas de trabalho antes de evoluir o produto.
6. **Offline-first incompleto.** Retries podem duplicar séries (sem idempotência) e a série recebe o horário da sincronização. Para um app de academia (sinal ruim), isso afeta diretamente a integridade dos dados.
7. **Manutenção upstream.** O bus factor humano é de cerca de 1, a maior parte do código foi gerada por agentes autônomos e há churn alto. Acompanhar o upstream depois do fork tende a ser inviável, então o fork deve ser tratado como *hard fork*.
8. **i18n e fuso.** Não há pt-BR (cerca de 1,2 mil linhas de catálogo mais os nomes de exercícios), as mensagens de API estão em inglês fixo e as agregações usam UTC ou o fuso do servidor.
