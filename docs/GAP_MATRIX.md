# Gap matrix — GymCoach (fork) × especificação GYM Peg

Base: auditoria de 2026-10-08 ([00_OPEN_SOURCE_AUDIT.md](00_OPEN_SOURCE_AUDIT.md)).

**Legenda**
- **Prioridade:** P0 = MVP/G1 · P1 = G2/G3 · P2 = G4 (IA) · P3 = G5.
- **Esforço:** S ≤ 2 dias · M ≤ 1 semana · L ≤ 3 semanas · XL > 3 semanas.
- **Risco:** A/M/B = alto/médio/baixo, sobre dados, segurança ou prazo.
- **Estado:** ✓ = feito neste fork · ⏳ = em andamento.

## Progresso desde a auditoria

| Data | Item | Commit |
|---|---|---|
| 2026-10-08 | pt-BR padrão + UI "GYM Peg" | `69a45f3` |
| 2026-10-08 | Providers Gemini/DeepSeek + fallback, JSON nativo, usage | `77a0843` |
| 2026-10-08 | `/api/health` + imagem que aplica migrations | `3e1924d` |
| 2026-10-08 | Imagens não licenciadas removidas | `f7febeb` |
| 2026-10-08 | Cadastro por convite em produção, limite de corpo JSON, headers de segurança (CSP parcial) | `b53eaf1` |
| 2026-10-08 | Índices em FKs quentes (M1) | `57d61ac` |
| 2026-10-08 | Sessões revogáveis, troca de senha, sair dos outros dispositivos, logout limpa dados locais (M3) | `e316c49` |
| 2026-10-09 | Fuso horário do usuário em semanas, streaks, PRs, coach e datas (M2 parcial) | `0347b01` |
| 2026-10-09 | Sync offline idempotente: `clientMutationId`, horário do aparelho, série tardia aceita, hidratação sem duplicar, finalizar só com fila vazia | `d0ee1bc` |
| 2026-10-09 | Catálogo global curado (229 exercícios, 19 músculos), busca pt-BR por aliases, ficha do exercício, fusão das cópias por conta (M5) | `1aa05a5` |
| 2026-10-09 | Onboarding em 5 passos: objetivo, experiência, disponibilidade, academia e equipamentos, músculos prioritários, exercícios a evitar, dados opcionais (M2) | `9c83af1` |
| 2026-10-09 | Logger único: a tabela de séries é o fluxo principal, já preenchida com a progressão do motor (pirâmides deslocadas pela mudança de carga do dia); `Set.type` (aquecimento, trabalho, drop, AMRAP, falha, back-off), RPE opcional, alvo congelado na série, peso corporal no registro; aquecimentos fora da numeração; backup e import preservam os campos novos (M7 parcial) | `1a4355b` |
| 2026-10-09 | Treino sem rede (1.4 parte 2): iniciar e finalizar offline com id UUIDv7 do aparelho (início e fim idempotentes no servidor, horários do aparelho limitados); outbox por usuário (sessão → séries → fim, fim só depois das séries); pacote de treino no IndexedDB; página offline do service worker que roda a sessão a partir do aparelho; SW sem cache de HTML nem de `/api` autenticados (M6) | `45fd4a8`, `3f38b85` |
| 2026-10-09 | Versões de programa (1.6 fatia A): `ProgramRevision` com snapshot e hash de conteúdo, gravada por todo caminho de escrita (REST, template, IA, coach, MCP, backup; trava em teste), edições em sequência agrupadas até um treino usar a versão, diff entre versões, restaurar como nova versão sem apagar histórico, treino ligado à versão que executou, linha de base para programas antigos na inicialização (M8 parcial) | `a54c278` |
| 2026-10-09 | Próximo treino (1.6 fatia B): modo de agenda do programa (rotação em sequência ou por dia da semana no fuso do usuário), cartão "Próximo treino" no painel com início direto e motivo, treino sugerido em `/session/new`; o modo entra nas versões do programa | `60157ce` |
| 2026-10-09 | Substituir só nesta sessão (1.6 fatia C): no menu do exercício, "Só neste treino" ou "também no programa"; a troca vale na hora, inclusive sem rede (outbox: início → trocas → séries → fim), últimos valores seguem o exercício novo e a série congela o alvo da linha substituída; programa e versões intactos | `2916626` |
| 2026-10-09 | Templates por catálogo (1.6 fatia D): os 32 exercícios usados nos 11 templates apontam para `slug` do catálogo, resolvido antes do nome ao montar o programa; o programa gerado aceita `catalogSlug` | `0fa2e30` |
| 2026-10-09 | Mesociclo (1.6 fatia E): ciclo de 2 a 12 semanas por calendário no fuso do usuário, "estou na semana X" posiciona o ciclo, semana de descarga com metade das séries, RIR +2 e carga reduzida; o treino guarda a semana, a série congela o alvo da descarga, o pacote offline aplica o mesmo; ciclo nas versões; semana atual no painel e no programa | `3885d4a` |
| 2026-10-09 | App em produção no Coolify: projeto, PostgreSQL sem porta pública com 3 backups agendados, app com healthcheck, volume das fotos e deploy automático por push (criados pela API do Coolify) | `36824e8`, `79cf379` |
| 2026-10-09 | Exclusão de conta e export (1.7, LGPD): excluir conta com senha e e-mail digitado, apagando todas as linhas e as fotos em disco e guardando só um registro anônimo (hash do id e contagens); export ZIP com `data.json` de todas as tabelas do usuário, CSVs e imagens, sem hashes de credenciais; registro único dos modelos do usuário com trava em teste (M4) | `bfa1be7` |
| 2026-10-09 | Histórico com filtros (1.8): programa, academia, exercício e músculo, combináveis, preservados ao trocar de mês e ao voltar do detalhe; um só parser para página, calendário e CSV; CSV com os mesmos filtros (exercício/músculo exportam só as linhas deles) e mês e data no fuso do usuário | este commit |

Pendentes nos mesmos épicos: reset de senha por e-mail; CSP com `script-src` (nonce); aquecimento gerado como séries WARMUP; exclusões com tombstone e push por agregado com resultado por item (ADR-004).

## Fundação e plataforma

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Idioma pt-BR padrão | en/fr/ru | pt-BR padrão, en em paridade | ⏳ catálogos pt-BR + default | P0 | M | B |
| Fuso horário do usuário | UTC/servidor nas agregações | `User.timezone`, semanas/streak/PR no fuso local | Campo + refatorar `lib/stats.ts`, `records.ts` | P0 | M | M |
| Sessão revogável | JWT 30 d stateless | Sessões em banco, logout real, "sair de todos" | Tabela `Session`/`AuthSession`, middleware | P0 | M | A |
| Troca/reset de senha | Ausente | Troca autenticada + reset por e-mail | Fluxos + provedor de e-mail | P0 | M | M |
| Controle de cadastro | Aberto | Convite/allowlist até o lançamento | Flag `SIGNUP_MODE` | P0 | S | A |
| Exclusão de conta (LGPD) | Ausente; FKs RESTRICT | Exclusão completa e auditável | ✓ `lib/account-deletion` (ordem explícita onde não há cascade, fotos em disco, `AccountDeletion` anônimo) | P0 | M | A |
| Export completo (LGPD) | Parcial | Todos os dados em JSON/CSV | ✓ `GET /api/account/export`: ZIP com todas as tabelas do usuário, CSVs e imagens | P1 | M | M |
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
| Next 16 + Serwist | Next 15.5 + next-pwa | Next 16, Serwist, sem cache de `/api` autenticado | Upgrade + trocar plugin PWA (o cache de `/api` e de HTML já saiu no 1.4) | P1 | L | M |
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
| Hierarquia de programa | Program → Workout → ProgramExercise | Program → Phase → Week → Template → Prescription | ⏳ mesociclo leve feito (ciclo de N semanas com semana de descarga sobre a estrutura atual); fases e semanas com prescrições próprias ficam para depois | P0 | L | A |
| `ProgramRevision` | Ausente (sobrescreve) | Versões imutáveis, diff, rollback | ✓ snapshot por versão em todo caminho de escrita (trava em teste), diff, restaurar como nova versão, `Session.programRevisionId` | P0 | M | A |
| Próximo treino / rotação | Escolha manual | Sequência rotativa ou dias fixos | ✓ `Program.scheduleMode` (rotação ou dia da semana, no fuso do usuário), cartão "Próximo treino" no painel, sugestão em `/session/new` | P0 | M | M |
| Prescrição completa | sets, faixa, RIR, descanso, tempo, superset | + RPE, %1RM, AMRAP, drop/warm-up planejados, giant set | Campos + UI | P1 | M | B |
| Substituir só nesta sessão | Sempre altera o programa | `WorkoutExercise` da sessão | ✓ `Session.exerciseSwaps` (linha do programa → exercício), funciona offline pelo outbox; a série herda o alvo da linha | P0 | M | M |
| Onboarding | Perfil mínimo | Objetivo, experiência, disponibilidade, academia, preferências, evitados | Fluxo + `UserProfile`/`UserPreference` | P0 | M | B |
| Templates de programa | 11, nomes divergentes do catálogo | Templates por `exerciseId` | ✓ cada exercício dos 11 templates aponta para um `slug` do catálogo (teste garante), resolvido antes do nome | P1 | S | M |

## Treino ativo e offline

| Feature | Atual | Alvo | Gap | Prio | Esforço | Risco |
|---|---|---|---|---|---|---|
| Registrar série em 2-3 toques | 1 toque, mas 2 loggers divergentes | Um logger, sugestão do motor pré-preenchida | ✓ tabela como fluxo principal; cartão detalhado (atalhos, IA) recolhido | P0 | M | M |
| `WorkoutSet` completo | weight, reps, rir Int, isWarmup/isDropSet | + type, rpe, clientMutationId, performedAt, alvo×realizado | ✓ `type`, `rpe`, alvo, `bodyweightKgSnapshot` (flags legadas em sincronia até o *contract*) | P0 | M | A |
| Sync offline idempotente | Sem idempotência (O1-O7) | Outbox, UUIDv7 do cliente, dedupe no servidor, resultado por item | ✓ outbox por usuário, `clientMutationId` nas séries, UUIDv7 nas sessões; falta push por agregado e tombstones | P0 | L | A |
| Iniciar/finalizar offline | Exige rede | Sessão criada no cliente | ✓ `localSessions` + pacote de treino + página offline (`app/~offline`) | P0 | M | A |
| Logout limpa dados locais | Não limpa | Limpar IndexedDB + Cache Storage | ✓ (o outbox pendente fica, escopado ao dono; o pacote de treino sai sempre) | P0 | S | A |
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
