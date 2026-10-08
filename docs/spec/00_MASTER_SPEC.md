# Plataforma de Musculação — Especificação Mestra

> Fonte de verdade do produto. Recebida em 2026-10-08. Os adendos em `docs/spec/01_*` e `docs/spec/02_*` complementam e, quando conflitarem, prevalecem sobre este documento no seu tema específico.

## Contexto da decisão inicial

Em vez de começar do zero, auditar e possivelmente fazer fork técnico do **GymCoach** (`gymcoach-app/gymcoach`, MIT), que já usa Next.js + TypeScript + PostgreSQL + Prisma + Docker + PWA offline-first e implementa treino, séries/reps/RIR, progressão, e1RM, peso corporal, medidas, fotos, calendário, PRs, histórico, equipamentos, IA, importação Strong/Hevy, cardio e MCP.

| Projeto | Interesse | Licença / decisão |
|---|---|---|
| GymCoach | Next.js, PostgreSQL, PWA offline, progressão, IA, medidas, fotos, cardio, import/export, testes | MIT — melhor candidato para base |
| wger | Treino + peso + nutrição + API + multiusuário | AGPL — benchmark |
| Liftosaur | Motor de progressão/deload e programas complexos | AGPL — benchmark do motor |
| openGym | UX, PWA, 1.324 exercícios, supersets, passkeys | AGPL + questão de direitos de mídia |
| Granite | Offline-first, REST + MCP | AGPL |
| Forge | Logger, timer, PRs, gráficos | Benchmark de UX |
| free-exercise-db | 800+ exercícios, músculos, equipamento, imagens | Unlicense — aproveitável (a auditar) |

Caminho proposto: **GymCoach MIT → fork/auditoria → nossa arquitetura → nosso design → nosso domínio → nossos algoritmos → PT-BR → Coolify.** Não fazer fork de projetos AGPL.

Benchmarks comerciais: Hevy (logger, rotinas, RPE, histórico, medidas, fotos), Boostcamp (mesociclos, RIR, e1RM, volume por músculo, progressão), Fitbod (treino gerado por objetivo, experiência, equipamentos, duração, preferências, histórico).

Dados de peso, % de gordura, fotos corporais, medidas e atividade podem ser **dados referentes à saúde** → dados pessoais sensíveis pela LGPD. Segurança, exclusão de conta, exportação, consentimento, controle de acesso e retenção nascem junto com o sistema.

### Arquitetura-alvo (visão geral)

```text
USUÁRIO
   │
   ▼
PWA / WEB APP — Next.js 16 + React 19 + TypeScript
   ├── Treino ativo offline → IndexedDB / Dexie
   ▼
API / SERVER ACTIONS
   ├── Motor de treino
   ├── Motor de progressão
   ├── Estatísticas
   ├── Motor de recomendações
   ├── IA Coach
   └── Workers
   ├───────────────┬───────────────┐
   ▼               ▼               ▼
PostgreSQL       Redis         Object Storage
(Coolify)        (Coolify)     S3/R2/MinIO
   ▼
Backups automáticos → S3
```

No Coolify, PostgreSQL é **recurso separado** da aplicação (volume persistente, URL interna, backup agendado nativo com envio para S3). A aplicação é Dockerizada, ligada ao GitHub, com deploy por webhook.

---

## 0. Missão

Plataforma web/PWA completa para planejamento, execução e acompanhamento de musculação. Não é apenas um diário. Deve funcionar como: planejador de treinamento; logger; histórico completo; sistema de progressão; análise de performance; acompanhamento corporal; gerador de programas; assistente de treino; PWA utilizável na academia com internet instável; futuramente plataforma para treinador acompanhar alunos.

Deploy em **Coolify**: app Dockerizada, PostgreSQL separado, Redis quando necessário, storage S3-compatible para imagens, backups automáticos.

## 1. Primeira tarefa: auditoria open source

Analisar profundamente: `gymcoach-app/gymcoach`, `wger-project/wger`, `astashov/liftosaur`, `DuarteSantos8/openGym`, `MorrisMorrison/granite`, `bndct-devops/forge`, `yuhonas/free-exercise-db`.

**Regra de licenciamento:** não copiar código AGPL se o produto final não for distribuído sob AGPL. Projetos AGPL servem só como referência arquitetural, de UX, estudo de algoritmos e levantamento de funcionalidades.

Candidato principal a fork: GymCoach (MIT, Next.js, TS, PostgreSQL, Prisma, Docker, offline-first, PWA, IA opcional, progressão, body tracking, testes). Auditar completamente antes de decidir entre: **A.** fork estrutural; **B.** reaproveitamento parcial; **C.** greenfield usando apenas conceitos.

Produzir `docs/00_OPEN_SOURCE_AUDIT.md` com: funcionalidades, arquitetura, dependências, cobertura de testes, problemas, dívida técnica, segurança, licenças, arquivos reaproveitáveis e não reaproveitáveis, maturidade, riscos.

## 2. Stack proposta

- **Frontend:** Next.js 16, React 19, TypeScript strict, App Router, Tailwind CSS, shadcn/ui.
- **Banco:** PostgreSQL 17.
- **ORM:** avaliar Prisma vs Drizzle. Se usar o fork GymCoach, evitar migração prematura de Prisma para Drizzle; primeiro estabilizar o produto.
- **Validação:** Zod.
- **Offline:** IndexedDB + Dexie.
- **Cache/jobs:** Redis + BullMQ ou equivalente (não obrigatório no MVP).
- **Testes:** Vitest, Testing Library, Playwright, PostgreSQL real nos testes de integração.
- **PWA:** manifest, service worker, cache control, modo treino offline, background sync, notificações, atualização segura.

## 3. Monorepo

Preferência futura:

```
apps/web
packages/{db, ui, domain, training-engine, analytics, ai, exercises, validation, config}
```

Se o fork for flat, **não reorganizar imediatamente**. Primeiro: rodar → testar → documentar → estabelecer baseline → só depois refatorar.

## 4. Perfil do usuário

Onboarding detalhado.
- **Básico:** nome, timezone, idioma, unidade kg/lb, altura, peso, data de nascimento opcional.
- **Treinamento:** objetivo, experiência, dias disponíveis, duração por sessão, academia/equipamentos, exercícios preferidos, exercícios a evitar, dias da semana, horário habitual, foco muscular opcional.
- **Objetivos:** hipertrofia, força, condicionamento geral, recomposição corporal, manutenção, retorno aos treinos, personalizado.
- O sistema **não deve exigir** peso/altura para funcionar.

## 5. Academias e equipamentos

Usuário pode ter várias academias (ex.: Academia A, Academia B, condomínio, casa), cada uma com seus equipamentos: barra, anilhas, halteres, smith, crossover, máquina, banco, rack, kettlebell, elástico, peso corporal, outros.

Máquinas configuráveis registram **incrementos reais** (ex.: Leg Press 40, 50, 60, 70, 80, 90, 100…). A recomendação nunca sugere "87,5 kg" numa máquina que só tem 80 ou 90.

## 6. Base de exercícios

Importar dataset de licença permissiva/domínio público. Não depender permanentemente de API externa; persistir base própria.

Tabela `EXERCISE`: id, slug, name, name_pt_br, aliases, description, instructions, exercise_type, movement_pattern, force_type, mechanic, difficulty, primary_muscles, secondary_muscles, stabilizers, equipment, laterality, bodyweight, unilateral, default_rest_seconds, active, source, source_license, created_at, updated_at.

Movimentos: squat, hinge, horizontal_push, vertical_push, horizontal_pull, vertical_pull, knee_flexion, knee_extension, elbow_flexion, elbow_extension, shoulder_abduction, calf, core, carry, isolation, cardio.

Exercícios customizados permitidos. **Nunca sobrescrever exercícios globais** quando o usuário personalizar algo.

## 7. Músculos

`MUSCLE` (id, slug, name, anatomical_group) e `EXERCISE_MUSCLE` (exercise_id, muscle_id, role PRIMARY|SECONDARY|STABILIZER, contribution). Contribution é estimativa analítica, nunca apresentada como medida fisiológica exata.

## 8. Programas de treino

Hierarquia: `PROGRAM → PHASE → WEEK → WORKOUT_TEMPLATE → EXERCISE_PRESCRIPTION`.

Suportar: uma semana, múltiplas semanas, mesociclos, deload, progressão, semanas diferentes, treino rotativo, dias fixos, sequência independente do calendário. Ex.: Programa Hipertrofia — Semana 1: A Upper, B Lower, C Upper, D Lower; Semana 2: …

## 9. Prescrição do exercício

Exercício, nº de séries, rep range, carga alvo, % de 1RM opcional, RPE alvo, RIR alvo, descanso, tempo, notas, warm-up, drop set, myo reps (futuro), rest pause (futuro), AMRAP, superset, giant set, ordem. Ex.: Supino reto — 3 séries, 6-8 reps, RIR 2, descanso 180 s.

## 10. Motor de geração de programas

**Não usar LLM como motor principal.** Criar `packages/training-engine`, geração determinística. Entrada `TrainingProfile` (objetivo, experiência, frequência, disponibilidade, equipamentos, duração, preferências, histórico, exercícios evitados, músculos prioritários). Saída `TrainingProgram`.

> Nota: o adendo `02_ADDENDUM_AI_WORKOUT_PLANNING.md` introduz a IA como seletora de exercícios sobre candidatos determinísticos, com validação obrigatória no backend. As duas visões devem coexistir: motor determinístico como base/fallback e validador; IA como camada de seleção/explicação.

## 11. Seleção do split

Regras configuráveis (não hardcode definitivo). Exemplos: 2 dias → Full Body A/B; 3 dias → Full Body, Upper/Lower alternado, PPL em certos contextos; 4 dias → Upper/Lower, Torso/Limbs, Push/Pull híbrido; 5 dias → Upper/Lower + especializações, PPL + Upper/Lower; 6 dias → PPL x2, Upper/Lower x3. Considerar aderência, tempo, volume semanal, recuperação, preferência.

## 12. Motor de seleção de exercício

```
exerciseScore = equipmentMatch + goalMatch + muscleCoverage + movementCoverage
              + userPreference + historyFamiliarity + progressionSuitability
              - avoidancePenalty - redundancyPenalty - fatiguePenalty
```

Nunca selecionar equipamento inexistente na academia escolhida. Permitir substituição priorizando: mesmo músculo principal, mesmo padrão, equipamento disponível, estímulo semelhante.

## 13. Motor de progressão

Componente central, sem depender de IA. Inicialmente **double progression** (ex.: 3x8-12): enquanto não atingir o topo da faixa, manter carga e perseguir reps; ao atingir o critério, aumentar carga respeitando o **incremento real** do equipamento (halter 20 → 22 → 24, nunca 20 → 20,73).

## 14. Autorregulação

Usa desempenho, RIR, RPE, sessões anteriores, stalls, frequência, readiness opcional. Resultados: `INCREASE | HOLD | DECREASE | DELOAD | INSUFFICIENT_DATA`. Toda recomendação traz **valor recomendado, motivo e dados utilizados**. Ex.: "32 kg → 34 kg. Você completou 3 séries no limite superior da faixa mantendo RIR compatível com a meta."

## 15. Stall

Detecção de estagnação por **janela móvel**, não por uma sessão ruim. Sinais: mesma carga sem progressão, queda repetida de reps, RIR pior, e1RM estagnado, sessões consecutivas abaixo da meta. Nunca aplicar deload automaticamente sem registrar o motivo.

## 16. Deload

Recomendado, manual ou planejado. Estratégias: redução de volume, de intensidade ou combinação. Registrar `DELOAD_REASON` para auditoria.

## 17. Treino ativo

Provavelmente a tela mais importante; excelente no celular.

```
EXERCÍCIO
último treino: 80×10, 80×9, 80×8
hoje:
S1 [peso][reps][RIR] ✓
S2 [peso][reps][RIR]
S3 [peso][reps][RIR]
```

Ferramentas: timer, histórico, gráfico, instrução, substituir, notas, adicionar/remover série, calculadora de anilhas, warm-up, PR.

## 18. Offline-first

```
ação do usuário → IndexedDB → UI atualiza imediatamente → sync queue → API → PostgreSQL
```

Toda operação tem `clientMutationId` para idempotência. Evitar duplicação por reload, retry, conexão instável e múltiplas abas.

## 19. Timer de descanso

Por exercício: automático após completar série, pause, +15 s, −15 s, skip, vibração, som, notificação, continua após mudança de tela.

## 20. Histórico

Calendário; filtros por período, programa, exercício, academia, músculo. Treino concluído é essencialmente imutável; correções posteriores são auditáveis.

## 21. Recordes

Automáticos: maior peso, maior nº de reps, maior volume, melhor e1RM, maior tonelagem do treino, maior tonelagem semanal. PR identifica contexto ("Novo PR de e1RM no supino").

## 22. Estimated 1RM

Arquitetura extensível, inicial **Epley**. Nunca apresentar e1RM como 1RM real. Guardar fórmula, valor e série de origem.

## 23. Peso corporal

`BODY_WEIGHT_ENTRY` (user_id, date, weight, source MANUAL|IMPORT|HEALTH_CONNECT|HEALTHKIT|OTHER, notes). Mostrar peso atual, média móvel, tendência, variação 7/30/90 dias. Não interpretar variação diária isolada como tendência.

## 24. Medidas corporais

`BODY_MEASUREMENT`: weight, body_fat_percentage, waist, neck, shoulders, chest, left/right_biceps, left/right_forearm, abdomen, hips, left/right_thigh, left/right_calf. Tudo opcional.

## 25. Fotos de progresso

Em storage S3-compatible; **nunca em `/public`**. `PROGRESS_PHOTO` (id, user_id, captured_at, object_key, angle FRONT|SIDE|BACK|OTHER, weight_at_time, notes). Acesso só via endpoint autenticado ou signed URL de curta duração.

## 26. Dashboard

Responde rápido "o que eu faço hoje?": próximo treino, sequência atual, duração estimada, músculos planejados, último peso, adesão semanal, progresso recente, peso, PR recente, principal insight. Sem gráficos inúteis.

## 27. Analytics

Volume por exercício/músculo/semana/mês/programa; séries planejadas, realizadas e efetivas (configurável); frequência por músculo; performance (max load, reps, e1RM, volume); consistência (treinos semanais, aderência, streak, calendário).

## 28. Body map

Mapa frontal/traseiro com modos: músculos treinados, volume semanal, músculos pouco treinados, distribuição do programa. SVG próprio ou recurso de licença claramente permissiva; nada de mídia com licenciamento duvidoso.

## 29. Relatório semanal

Determinístico (ex.: 4/4 treinos, 92 séries, 5 PRs; volume Peitoral +12%, Costas +4%, Quadríceps −8%; melhor evolução Supino e1RM 91 → 94 kg; peso médio 78,4 → 78,0 kg). A IA pode comentar depois; números sempre do domínio, nunca do LLM.

## 30. IA / Coach

Camada **sobre** o domínio. Nunca entregar o banco bruto ao modelo. `TrainingContextBuilder` produz JSON estruturado (`goal`, `experience`, `activeProgram`, `lastWorkouts`, `exerciseTrends`, `bodyWeightTrend`, `readiness`, `stalls`, `recommendations`).

## 31. Funções da IA (fase posterior)

Explicar evolução, analisar semana, explicar stall, propor ajustes, gerar programa, responder sobre o histórico, sugerir substituições, preparar próximo mesociclo. Toda modificação: **GENERATE → VALIDATE → PREVIEW → USER CONFIRM → APPLY**. Nunca GENERATE → DATABASE.

## 32. Providers de IA

Abstração `LLMProvider`; implementações possíveis Anthropic, OpenAI, OpenRouter. Domínio não amarrado a fornecedor. *(Atualizado pelo adendo 02: providers iniciais Gemini e DeepSeek.)*

## 33. Nutrição

Fora do primeiro MVP se atrasar o core. Preparar arquitetura (alimento, refeição, calorias, macros, meta diária, histórico). Fontes: USDA FoodData Central (CC0), Open Food Facts, base brasileira depois. Nunca misturar entidades de treino e nutrição.

## 34. Cardio

Caminhada, corrida, bicicleta, escada, elíptico, remo, customizado. Campos: duração, distância, FC, pace, calorias estimadas opcionais. Cardio **não** entra no volume de musculação.

## 35. Wearables (futuro)

Android: Health Connect / Google Health API (Google Fit tem suporte só até o fim de 2026 — não projetar sobre ele). iOS: HealthKit. Arquitetura aceita `EXTERNAL_HEALTH_RECORD`. Não integrar Health Connect/HealthKit direto na PWA; usar Capacitor/shell nativo ou app complementar.

## 36. Importação

Prioridade: Hevy CSV, Strong CSV, CSV genérico, JSON próprio. Fluxo: upload → parse → **preview** → mapping → validate → duplicate detection → import. Nunca importar sem preview.

## 37. Exportação

Exportar todos os dados em CSV e JSON: treinos, séries, medidas, peso, programas, exercícios, configurações.

## 38. Personal trainer (preparar modelo)

`TRAINER`, `CLIENT`, `TRAINER_CLIENT`. Futuro: criar/atribuir programa, ver histórico, comentar treino, acompanhar aderência e evolução. Permissões separadas; nunca acesso global ao treinador.

## 39. Notificações (futuro)

Treino do dia, treino perdido, timer, resumo semanal, novo programa, mensagem do treinador. Opt-in.

## 40. Gamificação

Baixa prioridade: streak, PR, semanas completas, volume acumulado, sessões. Não transformar em cassino.

## 41. Banco — entidades principais (ERD)

User, UserProfile, UserPreference, TrainingGoal, Gym, Equipment, GymEquipment, Exercise, ExerciseAlias, Muscle, ExerciseMuscle, Program, ProgramPhase, ProgramWeek, WorkoutTemplate, WorkoutTemplateExercise, ExercisePrescription, ProgressionRule, Workout, WorkoutExercise, WorkoutSet, RestTimerPreference, PersonalRecord, ExerciseGoal, BodyWeightEntry, BodyMeasurement, ProgressPhoto, ReadinessCheckin, TrainingRecommendation, TrainingInsight, ProgramRevision, AiConversation, AiMessage, ImportJob, ExportJob, AuditLog, NotificationPreference. *(Adendos acrescentam ExerciseMedia e AIUsage.)*

## 42. WorkoutSet

Tabela central: id, user_id, workout_id, workout_exercise_id, exercise_id, equipment_id, set_number, type, weight, reps, duration, distance, rir, rpe, completed, completed_at, is_pr, notes, client_mutation_id, created_at, updated_at. Type: `WARMUP | WORKING | DROP | AMRAP | FAILURE | BACKOFF | OTHER`.

## 43. Auditoria

`AuditLog` (actor, entity, entity_id, action, old_value, new_value, timestamp), principalmente para programas, séries, medidas, permissões, IA, treinador.

## 44. Privacidade

Privacy by design. Obrigatório: acesso isolado por usuário, testes de IDOR, autorização em todo endpoint, CSRF conforme arquitetura, rate limit, cookies HttpOnly/Secure, senhas com algoritmo moderno, secrets fora do repo, logs sem dados sensíveis, exclusão de conta, exportação de dados, política de retenção, consentimentos, registro de versões dos termos.

## 45. Fotos

Nunca `/public/uploads/user123/photo.jpg`. Bucket S3 privado, arquivo com UUID aleatório, nunca email/nome no object key.

## 46. Coolify

Projeto `fitness-production`. Resources: APP, PostgreSQL, Redis (futuro). App: Git → Dockerfile → Coolify → HTTPS. PostgreSQL como recurso independente, sem porta pública, rede interna.

## 47. Object storage

S3-compatible (R2, S3, MinIO, outro). Interface `ObjectStorageProvider`; nunca acoplar a fornecedor.

## 48. Backup

PostgreSQL diário, segunda cópia em S3. Retenção: 7 diários, 4 semanais, 6 mensais. **Teste de restore** obrigatório; backup sem restore testado não é backup validado.

## 49. CI

GitHub Actions: install → lint → typecheck → unit → integration → build → e2e → security checks. Merge só com green gate.

## 50. Migrations

Versionadas. Nunca `db push` em produção; usar `migrate deploy`. Deploy não pode perder dados.

## 51. Ambientes

development, staging, production com banco, buckets e chaves separados. Sem dados reais em staging.

## 52. Observabilidade

Logs estruturados: request_id, user_id mascarado/hash, route, duration, status, error_code. Nunca logar senha, token, fotos, payload completo da IA com dados pessoais.

## 53. Eventos de domínio

WorkoutStarted, WorkoutCompleted, SetCompleted, PersonalRecordAchieved, BodyWeightRecorded, ProgramStarted, ProgramCompleted, ProgramAdjusted, DeloadRecommended, ExerciseStalled — para analytics, notificações, IA, relatórios, integrações.

## 54. UX mobile-first

Projetar para 360-430 px, uso com uma mão, botões grandes. Evitar tabelas desktop espremidas, modal dentro de modal, formulários enormes, dropdown pequeno, interação que exija precisão.

## 55. Tela de treino

Registrar uma série em ~2-3 interações. Sempre mostrar a última execução:

```
ANTERIOR  80 × 10 @2
HOJE      [82] kg  [8] reps  [2] RIR
          [ CONCLUIR SÉRIE ]
```

## 56. Design

Nada de "dashboard genérico de IA": sem glassmorphism, gradientes excessivos, glow, 20 cards iguais, layout SaaS genérico. Limpo, esportivo, rápido, alto contraste, dark mode excelente, light mode, foco nos números do treino.

## 57. Acessibilidade

WCAG relevante: contraste, navegação por teclado, labels, foco, touch target, reduced motion, leitor de tela.

## 58. Internacionalização

pt-BR primeiro, en-US preparado. Evitar textos hardcoded em componentes.

## 59. Métricas internas do produto

Sem violar privacidade: signup completed, onboarding completed, program created, workout started/completed, week completed, abandoned workout, retention, workouts/user/week. Eventos sem detalhes de exercício/carga.

## 60. MVP

Ciclo completo. O usuário consegue: 1) criar conta; 2) completar onboarding; 3) escolher academia/equipamentos; 4) receber/criar programa; 5) iniciar treino; 6) registrar séries offline; 7) ver treino anterior; 8) concluir treino; 9) ver histórico; 10) ver evolução; 11) registrar peso; 12) registrar medidas; 13) ver PRs; 14) receber próxima recomendação de carga; 15) instalar como PWA.

## 61. MVP+1

Fotos de progresso, body map, relatório semanal, readiness, deload, stalls, import Hevy/Strong, AI coach, AI program generator.

## 62. V2

Nutrição, cardio avançado, portal do treinador, compartilhamento, Health Connect, HealthKit, wrapper nativo, notificações avançadas.

## 63. Algoritmos

Fora da UI, módulos testáveis: `calculateE1RM()`, `calculateWorkoutVolume()`, `calculateWeeklyVolume()`, `calculateMuscleVolume()`, `detectPR()`, `detectStall()`, `calculateProgression()`, `recommendNextLoad()`, `recommendDeload()`, `calculateAdherence()`, `calculateWeightTrend()`. Cada um com documentação, unidade, edge cases e testes.

## 64. Princípio fundamental da IA

**IA explica. Domínio calcula.** O LLM nunca é a única fonte de volume, frequência, e1RM, carga, PR, tendência, aderência, stall.

## 65. Motor científico

`TrainingGuideline` em tabela/configuração (ex.: `guidelines.hypertrophy.volume.{beginner,intermediate,advanced}`), com version, source, updated_at. Nada de números científicos espalhados como constantes.

## 66. Segurança das recomendações

Treino ≠ diagnóstico médico. Não diagnosticar lesão, doença, deficiência hormonal ou condição médica. Se o usuário reportar dor/lesão: marcar exercício como indisponível/preferência e orientar adequadamente na interface. Sem diagnóstico automático.

## 67. Testes críticos

Progressão, deload, stall, PR, e1RM, timezone, offline sync, duplicação, idempotência, permission boundaries, IDOR, upload, exclusão, importação, isolamento de dados multiusuário.

## 68. Documentação obrigatória

```
docs/
  00_OPEN_SOURCE_AUDIT.md   01_PRODUCT_SPEC.md      02_ARCHITECTURE.md
  03_DOMAIN_MODEL.md        04_DATABASE.md          05_TRAINING_ENGINE.md
  06_PROGRESSIVE_OVERLOAD.md 07_OFFLINE_SYNC.md     08_AI_ARCHITECTURE.md
  09_SECURITY_PRIVACY.md    10_COOLIFY_DEPLOYMENT.md 11_TEST_STRATEGY.md
  12_OBSERVABILITY.md       13_ROADMAP.md           14_CONTINUATION_PLAN.md
```

## 69. ADR

`docs/adr/`. Iniciais: ADR-001 Fork GymCoach vs greenfield; 002 PostgreSQL; 003 Prisma vs Drizzle; 004 Offline-first; 005 Exercise dataset; 006 Object storage; 007 Training engine; 008 LLM abstraction; 009 PWA first; 010 Future native strategy.

## 70. Primeira execução no Claude Code — PHASE 0 (Discovery)

Não começar programando. 1) auditar GymCoach; 2) mapear funcionalidades; 3) rodar testes; 4) analisar schema; 5) arquitetura; 6) licenças; 7) offline mode; 8) motor de progressão; 9) IA; 10) uploads; 11) segurança; 12) Docker; 13) comparar com esta especificação. Produzir **GAP MATRIX**: FEATURE | CURRENT | TARGET | GAP | PRIORITY | EFFORT | RISK.

## 71. Gate G0

Só prosseguir com: auditoria, arquitetura, schema atual, schema futuro, gap matrix, decisão fork/greenfield, ADRs iniciais, plano de migração, plano do MVP.

## 72. Gate G1 — core funcional

Auth, onboarding, exercise database, programs, logger, offline, workout history.

## 73. Gate G2 — inteligência determinística

Progression, PR, e1RM, volume, analytics, body tracking.

## 74. Gate G3 — produto completo inicial

PWA, fotos, relatórios, import/export, Coolify production, backup, security audit.

## 75. Gate G4 — IA

Context builder, weekly coach, program generator, explicar recomendações, validação, preview, confirmação.

## 76. Gate G5 — expansão

Trainer, nutrição, wearables, nativo.

## 77. Definition of Done

Nenhuma feature está pronta só porque "funciona na tela". Precisa: types, validation, migration, authorization, loading, empty state, error handling, mobile, tests, docs, acessibilidade básica, telemetria quando aplicável.

## 78. Princípio final

Sistema baseado em **HISTÓRICO + PLANO + EXECUÇÃO + PROGRESSÃO + ANÁLISE + ADAPTAÇÃO**, e não "uma lista onde o usuário anota peso e repetições".

Diferencial: **o sistema sabe o que o usuário deveria fazer hoje, sabe o que ele fez anteriormente, registra o que realmente aconteceu e usa esse histórico para preparar a próxima sessão de maneira explicável.**
