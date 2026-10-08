# 04 — Banco de dados

PostgreSQL 17 + Prisma 7 (ADR-002, ADR-003). Schema em `prisma/schema.prisma`, migrations em `prisma/migrations` (26 herdadas do GymCoach, lineares).

## 1. Schema atual (herdado)

22 models e 9 enums; tabela completa com linhas e `onDelete` em [audit/gymcoach-platform.md §3](audit/gymcoach-platform.md).

| Grupo | Models | Observação |
|---|---|---|
| Conta | `User`, `McpAccessToken` | Perfil, preferências e conta misturados em `User` |
| Catálogo | `Exercise` | **Por usuário** (`userId` obrigatório, `@@unique([userId, name])`), um `muscleGroup` |
| Academia | `Gym`, `GymEquipment`, `GymExerciseConfig`, `GymEquipmentExercise` | Incrementos reais em `weightOptions`; imagem em `bytea` |
| Programa | `Program`, `Workout` (= template de dia), `ProgramExercise` (= prescrição) | Sem fase/semana/revisão |
| Execução | `Session` (= treino executado), `Set` | `Set` sem `type`, `rpe`, `clientMutationId`, alvo |
| Corpo | `BodyweightEntry`, `BodyMeasurement`, `ProgressPhoto`, `ReadinessCheckin` | Fotos em disco local |
| Metas | `ExerciseGoal`, `VolumeTarget` | |
| IA | `Conversation`, `Message`, `CoachSession` | `CoachSession` sem FK para `User` |
| Auditoria | `McpHistoricalEquipmentBackfillAudit` | Específica do MCP |

Problemas estruturais: FKs `RESTRICT` (Exercise, Program, Session, Conversation) impedem a exclusão de conta; faltam índices em `Set.sessionId`, `Program.userId`, `Workout.programId`, `ProgramExercise.workoutId/exerciseId`, `Session.workoutId/programId/gymId`, `CoachSession.userId`; não há soft delete.

### Nomes: spec × schema

Para evitar renomear tabelas com dados (churn sem ganho), os nomes Prisma herdados ficam e o mapeamento é este:

| Spec | Model Prisma |
|---|---|
| WorkoutTemplate | `Workout` |
| ExercisePrescription / WorkoutTemplateExercise | `ProgramExercise` |
| Workout (executado) | `Session` |
| WorkoutSet | `Set` |
| WorkoutExercise | `SessionExercise` (novo) |
| AiConversation / AiMessage | `Conversation` / `Message` |

## 2. Schema alvo

Esboço dos models novos ou alterados. Tipos e índices finais saem de cada migration.

```prisma
// ---------- Conta e perfil ----------
model User {
  // + timezone      String   @default("America/Sao_Paulo")
  // + locale        String   @default("pt-BR")
  // + birthDate     DateTime?
  // + experience    TrainingExperience?   // BEGINNER | INTERMEDIATE | ADVANCED
  // + deletedAt     DateTime?              // exclusão em duas fases (LGPD)
}
model AuthSession { id String @id; userId String; tokenHash String @unique; createdAt DateTime; lastSeenAt DateTime; expiresAt DateTime; revokedAt DateTime?; userAgent String? }
model UserPreference { userId String @id; restTimerSound Boolean; vibration Boolean; defaultRestSec Int; barWeightKg Float?; /* hoje em localStorage */ }
model TrainingAvailability { userId String @id; sessionsPerWeek Int; sessionMinutes Int; weekdays Int[]; preferredTime String? }
model ExercisePreference { userId String; exerciseId String; kind PreferenceKind /* PREFER | AVOID | KEEP */; reason String?; @@id([userId, exerciseId]) }
model Consent { id String @id; userId String; purpose ConsentPurpose /* AI_PROCESSING | TERMS | PRIVACY */; version String; grantedAt DateTime; revokedAt DateTime? }

// ---------- Catálogo ----------
model Exercise {
  id               String   @id
  ownerId          String?  // null = catálogo global; preenchido = exercício customizado (privado)
  slug             String
  name             String   // nome canônico em inglês (busca, importação)
  namePtBr         String?
  movementPattern  MovementPattern?
  forceType        ForceType?
  mechanic         Mechanic?       // COMPOUND | ISOLATION
  difficulty       Difficulty?
  laterality       Laterality?     // BILATERAL | UNILATERAL | ALTERNATING
  equipmentType    EquipmentType
  usesBodyweight   Boolean
  defaultRestSec   Int
  instructionsPtBr String?         // texto próprio (ADR-005)
  source           String?         // "gympeg-curated", "free-exercise-db:metadata", "user"
  sourceLicense    String?
  replacedById     String?         // fusão de duplicados preservando histórico
  active           Boolean @default(true)
  // unique: (slug) onde ownerId é null (índice parcial); (ownerId, slug) para customizados
}
model ExerciseAlias  { id String @id; exerciseId String; alias String; locale String; @@index([alias]) }
model Muscle         { id String @id; slug String @unique /* pectoralis_major… IDs do SVG */; namePtBr String; group MuscleGroup }
model ExerciseMuscle { exerciseId String; muscleId String; role MuscleRole /* PRIMARY | SECONDARY | STABILIZER */; contribution Float?; @@id([exerciseId, muscleId]) }
model ExerciseMedia  { id String @id; exerciseId String; ownerId String?; type MediaType; objectKey String; thumbnailKey String?; sha256 String; source String?; sourceUrl String?; license String; attribution String?; width Int?; height Int?; durationMs Int?; sortOrder Int; isPrimary Boolean; isActive Boolean }

// ---------- Programa ----------
model Program        { /* + goal, + currentRevisionId, + scheduleMode ROTATING | FIXED_DAYS */ }
model ProgramRevision{ id String @id; programId String; version Int; snapshot Json; reason String; createdBy RevisionAuthor /* USER | AI | SYSTEM */; aiUsageId String?; createdAt DateTime; @@unique([programId, version]) }
model ProgramPhase   { id String @id; programId String; order Int; name String; isDeload Boolean }
model ProgramWeek    { id String @id; phaseId String; order Int; isDeload Boolean }
model Workout        { /* template de dia: + weekId? (null = todas as semanas) */ }
model ProgramExercise{ /* prescrição: + targetRpe Float?, + percent1Rm Float?, + setScheme Json?, + progressionRuleId? */ }
model ProgressionRule{ id String @id; kind ProgressionKind /* DOUBLE | LINEAR | REPS_SUM | TIME */; params Json; version Int }

// ---------- Execução ----------
model Session        { /* + clientId String @unique (UUIDv7 do cliente), + programRevisionId, + startedAtClient, + timezone */ }
model SessionExercise{ id String @id; clientId String @unique; sessionId String; exerciseId String; programExerciseId String?; order Int; substitutedFromId String?; notes String? }
model Set {
  // + clientMutationId String     // UUIDv7 do cliente; @@unique([userId, clientMutationId])
  // + userId String                // desnormalizado para a restrição única e para queries
  // + sessionExerciseId String?
  // + type SetType                 // WARMUP | WORKING | DROP | AMRAP | FAILURE | BACKOFF | OTHER (substitui isWarmup/isDropSet)
  // + rpe Float?
  // + performedAt DateTime         // relógio do cliente, limitado; completedAt passa a ser receivedAt
  // + targetWeight Float?, targetRepsMin Int?, targetRepsMax Int?, targetRir Int?  // alvo × realizado
  // + bodyweightKgSnapshot Float?  // fim do peso corporal retroativo
  // + deletedAt DateTime?          // tombstone para o sync
  // @@index([sessionId])
}

// ---------- Inteligência ----------
model PersonalRecord        { id String @id; userId String; exerciseId String; kind PrKind /* WEIGHT | REPS_AT_WEIGHT | SET_VOLUME | E1RM | SESSION_TONNAGE | WEEK_TONNAGE */; value Float; setId String?; sessionId String?; achievedAt DateTime; formula String? }
model TrainingRecommendation{ id String @id; userId String; programExerciseId String; action RecommendationAction; value Float?; reason String; inputs Json; engineVersion String; createdAt DateTime; acceptedAt DateTime? }
model DeloadEvent           { id String @id; userId String; kind DeloadKind /* RECOMMENDED | MANUAL | PLANNED */; strategy DeloadStrategy; reason String; startsAt DateTime; endsAt DateTime }
model TrainingGuideline     { id String @id; key String; version Int; value Json; source String; updatedAt DateTime; @@unique([key, version]) }

// ---------- IA ----------
model AIUsage { id String @id; userId String; provider String; model String; operation AiOperation; inputTokens Int; outputTokens Int; latencyMs Int; estimatedCostUsd Decimal?; success Boolean; idempotencyKey String?; promptVersion String?; createdAt DateTime; @@unique([userId, idempotencyKey]) }

// ---------- Plataforma ----------
model AuditLog  { id String @id; actorId String?; actorKind String; entity String; entityId String; action String; oldValue Json?; newValue Json?; createdAt DateTime; @@index([entity, entityId]) }
model ImportJob { id String @id; userId String; source String; status JobStatus; preview Json?; result Json?; createdAt DateTime }
model ExportJob { id String @id; userId String; status JobStatus; objectKey String?; expiresAt DateTime?; createdAt DateTime }
```

Corpo: `BodyweightEntry` ganha `source` (MANUAL, IMPORT, HEALTH_CONNECT, HEALTHKIT, OTHER) e `externalId`; `BodyMeasurement` ganha `BODY_FAT_PCT` e `ABDOMEN`; `ProgressPhoto` ganha `angle`, `objectKey` e `weightAtTime`.

Regra de exclusão: toda FK para `User` passa a `onDelete: Cascade`. A exclusão de conta apaga também os objetos do storage e registra um `AuditLog` sem dados pessoais.

## 3. Sequência de migrations (expand → migrate → contract)

| # | Migration | Tipo | Gate |
|---|---|---|---|
| M1 | Índices em FKs quentes | expand | G1 |
| M2 | `User.timezone`, `locale`, `experience`, `birthDate`; `UserPreference`; `TrainingAvailability`; `ExercisePreference` | expand | G1 |
| M3 | `AuthSession` + troca do JWT por sessão em banco | expand + código | G1 |
| M4 | FKs de `User` → Cascade; `CoachSession.userId` com FK | contract | G1 |
| M5 | Catálogo global: `Exercise.ownerId` (renomeia `userId`, nullable), novos campos, `Muscle`, `ExerciseMuscle`, `ExerciseAlias`; seed curado; backfill que funde as cópias por usuário no global equivalente (via `replacedById`) e mantém o resto como customizado | expand + backfill | G1 |
| M6 | `Set`: `clientMutationId`, `userId`, `type`, `rpe`, `performedAt`, alvo, `bodyweightKgSnapshot`, `deletedAt`; backfill (`type` a partir de `isWarmup`/`isDropSet`, `performedAt = completedAt`, ids gerados para o legado) | expand + backfill | G1 |
| M7 | `Session.clientId`, `SessionExercise` + backfill a partir dos sets | expand + backfill | G1 |
| M8 | `ProgramRevision`, `ProgramPhase`, `ProgramWeek`, `ProgressionRule`; revisão v1 gerada para cada programa existente | expand + backfill | G1 |
| M9 | `PersonalRecord`, `TrainingRecommendation`, `DeloadEvent`, `TrainingGuideline` | expand | G2 |
| M10 | `ExerciseMedia`, `ProgressPhoto.objectKey`/`angle`; migração de arquivos para S3 | expand + backfill | G3 |
| M11 | `AIUsage`, `Consent`, `AuditLog`, `ImportJob`, `ExportJob` | expand | G3/G4 |
| M12 | Remover `Set.isWarmup/isDropSet`, `GymEquipment.imageData`, `ProgressPhoto.storagePath` | contract | G3 |

Cada migration com backfill tem teste de integração com Postgres real (dados legados → estado novo) e é idempotente.
