# Gap matrix — GymCoach (fork) × especificação GYM Peg

Base: auditoria de 2026-10-08 ([00_OPEN_SOURCE_AUDIT.md](00_OPEN_SOURCE_AUDIT.md)).

**Legenda**
- **Prioridade:** P0 = MVP/G1 · P1 = G2/G3 · P2 = G4 (IA) · P3 = G5.
- **Esforço:** S ≤ 2 dias · M ≤ 1 semana · L ≤ 3 semanas · XL > 3 semanas.
- **Risco:** A/M/B = alto/médio/baixo, sobre dados, segurança ou prazo.
- **Estado:** ✓ = feito neste fork · ⏳ = em andamento.

## Fundação e plataforma

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Idioma pt-BR padrão | en/fr/ru | pt-BR padrão, en em paridade | ⏳ catálogos pt-BR + default | P0 | M | B |
| Fuso horário do usuário | UTC/servidor nas agregações | `User.timezone`, semanas/streak/PR no fuso local | Campo + refatorar `lib/stats.ts`, `records.ts` | P0 | M | M |
| Sessão revogável | JWT 30 d stateless | Sessões em banco, logout real, "sair de todos" | Tabela `Session`/`AuthSession`, middleware | P0 | M | A |
| Troca/reset de senha | Ausente | Troca autenticada + reset por e-mail | Fluxos + provedor de e-mail | P0 | M | M |
| Controle de cadastro | Aberto | Convite/allowlist até o lançamento | Flag `SIGNUP_MODE` | P0 | S | A |
| Exclusão de conta (LGPD) | Ausente; FKs RESTRICT | Exclusão completa e auditável | Migrar FKs para Cascade + rota + storage | P0 | M | A |
| Export completo (LGPD) | Parcial | Todos os dados em JSON/CSV | Incluir medidas, fotos, metas, notas, track | P1 | M | M |
| Consentimento IA/dados de saúde | Ausente | Consentimento versionado antes de enviar dados à IA | `Consent` + gate nas rotas de IA | P1 | S | A |
| Headers de segurança/CSP | Ausente | CSP, HSTS, frame-ancestors, Referrer-Policy | `headers()` no Next | P1 | S | M |
| Limite de corpo JSON | Só em algumas rotas | `maxBytes` obrigatório | Tornar obrigatório em `parseJsonBody` | P1 | S | M |
| Rate limit | Em memória, por processo | Compartilhado (Redis/Postgres) | Store compartilhado | P1 | S | M |
| Índices em FKs quentes | Faltam (`Set.sessionId` etc.) | Índices em todas as FKs consultadas | Migration | P0 | S | B |
| Camada de serviço | Rotas acessam Prisma direto; REST e MCP divergem | `lib/services/*` compartilhado | Extrair por agregado conforme cada área é tocada | P1 | L | M |
| Healthcheck + migrations no start | Ausente | `/api/health` + migrate no CMD | ✓ | P0 | S | B |
| Deploy Coolify | — | App + Postgres separado + backups | ✓ guia; criação dos recursos pelo usuário | P0 | S | M |
| Backup com cópia S3 + restore testado | Só local | 7d/4s/6m + S3 + teste de restore | Configurar S3 no Coolify + script de restore | P1 | S | A |
| Ambiente staging | — | Banco/bucket/chaves separados | Novo ambiente Coolify | P1 | S | M |
| Logs estruturados | `console.error` cru | JSON com request_id, user hash, sem PII | Logger + middleware | P1 | M | M |
| Next 16 + Serwist | Next 15.5 + next-pwa | Next 16, Serwist, sem cache de `/api` autenticado | Upgrade + trocar plugin PWA | P1 | L | M |
| Zod 4 / Tailwind 4 / ESLint 9 | v3 / v3 / v8 | Versões atuais | Upgrades | P1 | M | B |

## Exercícios e mídia

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Catálogo global | Cópia por usuário (≈56 itens) | `Exercise` global + customizados do usuário, sem sobrescrever globais | Novo modelo + migração das cópias | P0 | L | A |
| Metadados do exercício | nome, 1 músculo, categoria, equipamento | slug, name_pt_br, aliases, movement_pattern, force, mechanic, difficulty, laterality, source, license | Campos + curadoria | P0 | M | M |
| Músculos normalizados | Enum único | `Muscle` + `ExerciseMuscle` (PRIMARY/SECONDARY/STABILIZER) | Tabelas + mapeamento | P0 | M | B |
| Seed curado (P0) | 55 exercícios em inglês | ≈220 exercícios P0 com nomes pt-BR e instruções próprias | Curadoria a partir dos metadados do free-exercise-db | P0 | L | M |
| Busca pt-BR/inglês/alias | Substring de nome | Busca por pt-BR, inglês, alias, músculo, equipamento | Índice de busca (trigram/unaccent) | P0 | S | B |
| `ExerciseMedia` | JSON estático por nome | Entidade com tipo, licença, objectKey | Tabela + resolver | P1 | M | B |
| Mídia visual licenciada | Removida (não licenciada) | Início/fim + thumbnail próprios ou licenciados | Produção/licenciamento de mídia | P1 | XL | A |
| SVG anatômico dinâmico | `muscle-map` simples | SVG próprio frente/costas colorido por `ExerciseMuscle` | Arte + componente | P1 | M | B |
| Pipeline de mídia S3 | — | validate → hash → dedupe → optimize → upload | Worker idempotente | P1 | M | M |
| Cobertura `exercise_media_coverage` | — | Métrica por tipo de mídia | Query + painel | P1 | S | B |

## Academias e equipamentos

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Várias academias | `Gym` por usuário | Idem | — | P0 | — | B |
| Incrementos reais | `weightOptions`, snapping em `gym-loads.ts` | Idem + incremento/mín/máx | Pequeno ajuste | P0 | S | B |
| Catálogo de tipos de equipamento | Enum de 7 tipos | Tipos da spec §5 (smith, crossover, rack, kettlebell…) | Ampliar enum/tabela | P0 | S | B |
| Imagens de equipamento | `bytea` no Postgres | Object storage | Migrar para S3 | P1 | S | M |

## Programas e treino

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Hierarquia de programa | Program → Workout → ProgramExercise | Program → Phase → Week → Template → Prescription | Novos níveis, migração | P0 | L | A |
| `ProgramRevision` | Ausente (sobrescreve) | Versões imutáveis, diff, rollback | Versionamento | P0 | M | A |
| Próximo treino / rotação | Escolha manual | Sequência rotativa ou dias fixos | Lógica de agenda | P0 | M | M |
| Prescrição completa | sets, faixa, RIR, descanso, tempo, superset | + RPE, %1RM, AMRAP, drop/warm-up planejados, giant set | Campos + UI | P1 | M | B |
| Substituir só nesta sessão | Sempre altera o programa | `WorkoutExercise` da sessão | Nova entidade | P0 | M | M |
| Onboarding | Perfil mínimo | Objetivo, experiência, disponibilidade, academia, preferências, evitados | Fluxo + `UserProfile`/`UserPreference` | P0 | M | B |
| Templates de programa | 11, nomes divergentes do catálogo | Templates por `exerciseId` | Reescrever referências | P1 | S | M |

## Treino ativo e offline

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Registrar série em 2-3 toques | 1 toque, mas 2 loggers divergentes | Um logger, sugestão do motor pré-preenchida | Unificar | P0 | M | M |
| `WorkoutSet` completo | weight, reps, rir Int, isWarmup/isDropSet | + type, rpe, clientMutationId, performedAt, alvo×realizado | Migração | P0 | M | A |
| Sync offline idempotente | Sem idempotência (O1-O7) | Outbox, UUIDv7 do cliente, dedupe no servidor, resultado por item | Reescrever `lib/sync.ts` | P0 | L | A |
| Iniciar/finalizar offline | Exige rede | Sessão criada no cliente | Parte do novo sync | P0 | M | A |
| Logout limpa dados locais | Não limpa | Limpar IndexedDB + Cache Storage | Ajuste | P0 | S | A |
| Timer de descanso | Automático, ±15 s, vibra; perde-se ao navegar | Persistido, notificação em segundo plano | Persistir `endsAt` + Notification API | P1 | M | B |
| Calculadora de anilhas / aquecimento | Existe (exibição) | Aquecimento gerado como séries WARMUP | Pequeno | P1 | S | B |
| Mídia "Ver execução" | Dialog existe (sem mídia) | Bottom sheet com imagens licenciadas | Depende da mídia | P1 | S | B |

## Inteligência determinística (G2)

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Motor de progressão | Dupla progressão, +2,5/+1 kg fixos | Regras por prescrição; INCREASE/HOLD/DECREASE/DELOAD/INSUFFICIENT_DATA; motivo + dados; snapshot | Reescrever sobre `progression.ts` + `gym-loads.ts` | P1 | L | M |
| Stall | 3 sessões, e1RM do top set | Janela móvel configurável, vários sinais | Ampliar | P1 | S | B |
| Deload | Interruptor de 7 dias, −10% | Recomendado/manual/planejado com `DELOAD_REASON` | Persistir motivo + estratégias | P1 | M | B |
| e1RM | Epley sem teto | Fórmula extensível, teto de reps, origem guardada | Ajuste | P1 | S | B |
| PRs | Peso e e1RM; "ao vivo" só vs última sessão | Peso, reps, volume, e1RM, tonelagem treino/semana, histórico completo | Ampliar + `PersonalRecord` | P1 | M | M |
| Volume por músculo | Grupo único, UTC | Primário/secundário, séries efetivas, fuso local | Depende de `ExerciseMuscle` | P1 | M | M |
| Peso corporal | Gráfico cru, retroativo | Média móvel, tendência 7/30/90 d, snapshot por série | Ajuste | P1 | S | M |
| Medidas | 13 locais | + % gordura, abdômen; tudo opcional | Pequeno | P1 | S | B |
| Relatório semanal determinístico | Só debrief por LLM | Relatório calculado pelo domínio | Novo | P1 | M | B |
| `TrainingGuideline` versionada | Constantes no código | Configuração com version/source | Novo | P1 | S | B |

## IA (G4)

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Providers Gemini/DeepSeek + fallback | Anthropic/OpenRouter | Gemini padrão, DeepSeek fallback | ✓ | P2 | — | B |
| JSON nativo + usage | Texto | Structured output + tokens | ✓ parcial (`responseFormat`, `usage`) | P2 | S | B |
| `AIProvider` de domínio | Ausente | `generateWorkoutPlan` / `adjustWorkoutPlan` | Camada sobre `LlmProvider` | P2 | M | M |
| `TrainingContextBuilder` | `buildCoachPayload` parcial | JSON compacto com tendências calculadas | Adaptar | P2 | M | M |
| `ExerciseRetrievalService` + tool `searchExercises` | Catálogo inteiro no prompt | 50-100 candidatos por busca | Novo + tool calling | P2 | M | M |
| Só `exerciseId` existentes | Nome livre + `upsert` | ids validados | Reescrever geração | P2 | M | A |
| `WorkoutPlanValidator` | Só faixas Zod | Validação de domínio completa | Novo | P2 | M | A |
| Preview → confirmação → revisão | Preview existe; MCP grava direto | Fluxo obrigatório + `ProgramRevision` | Reescrever apply/MCP | P2 | M | A |
| `AIUsage` + idempotency key | Ausente | Custo por operação, sem cobrança duplicada | Tabela + middleware | P2 | S | M |
| Feature flags `ai.*` | Ausente | 4 flags | Config | P2 | S | B |
| Prompts versionados em arquivo | Constantes TS | `prompts/<nome>/vN.md` | Migrar | P2 | S | B |

## Expansão (G5)

| Feature | Atual | Alvo | Prio | Esforço | Risco |
|---|---|---|---|---|---|
| Treinador/aluno | Ausente | `Trainer`, `TrainerClient`, permissões | P3 | XL | A |
| Nutrição | Ausente | Módulo separado (USDA/Open Food Facts) | P3 | XL | M |
| Wearables | Import de arquivos | Health Connect/HealthKit via shell nativo | P3 | XL | M |
| Notificações | Ausente | Push opt-in | P3 | M | B |
