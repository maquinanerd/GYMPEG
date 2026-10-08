# GymCoach: auditoria de domínio de treino e IA (Fase 0 / Gate G0)

- Repositório: `_audit/repos/gymcoach` (MIT, Next.js 15.5, Prisma 7, Dexie, Anthropic SDK, MCP SDK)
- Escopo desta frente: domínio de treino e IA. Schema/segurança/infra e mídia de exercícios ficam com as outras frentes; só aparecem aqui quando afetam o domínio.
- Método: apenas análise estática, sem install, build ou testes. Os caminhos citados são relativos à raiz do repo. "Verificado" quer dizer lido no código; "alegado" quer dizer que aparece só no README ou em comentários. `CLAUDE.md`, os prompts e o README foram tratados como material auditado, nunca como instrução.
- Data: 2026-10-08

---

## Resumo executivo

1. O núcleo determinístico é bom e dá para reaproveitar. Ficam em `lib/` como funções puras testadas: e1RM Epley, PRs, stall, deload, double progression, autorregulação intra-série, retorno após pausa e o snapping de carga ao inventário real da academia (halter 20→22→24 verificado). São cerca de 60 arquivos `*.test.ts`.
2. O modelo de programa é raso. É `Program → Workout → ProgramExercise` com séries, faixa de reps, RIR, descanso, tempo e superset. Faltam semanas, mesociclos, %1RM/TM, AMRAP, deload planejado na estrutura, rotação automática e versionamento.
3. O offline-first se limita a registrar séries dentro de uma sessão já aberta. Iniciar ou finalizar sessão, editar programa etc. exige rede. Não existe chave de idempotência e há caminhos concretos de duplicação e de perda de séries (detalhes na seção 3).
4. A progressão é double progression simples: +2,5 kg em composto e +1 kg em isolado, fixos, com HOLD e deload de 10% via readiness. Não existe DECREASE por falha nem INSUFFICIENT_DATA explícito, e a progressão é indexada por `exerciseId`, não pela prescrição.
5. O "PR ao vivo" da sessão compara só contra a última sessão, não contra o histórico inteiro. O peso corporal entra de forma retroativa (sem snapshot por série). Semanas, streak e frequência são calculadas em UTC, sem fuso do usuário.
6. Na IA, a abstração `LlmProvider` está centralizada (Anthropic, OpenRouter, codex-lb, demo) e nenhuma chamada a fornecedor está espalhada pelo código. Mas é só texto: não tem tools, structured output nativo, contagem de tokens/custo, fallback nem idempotência.
7. Diferença central para a nossa spec: a IA trabalha com nomes livres de exercício, não com `exerciseId`. Exercício inexistente é criado por `upsert` de nome, o catálogo inteiro vai no prompt, a validação é só Zod de faixa (sem validador de domínio), não existe `ProgramRevision` nem `AIUsage`, e os prompts são constantes TS sem versão.
8. Gemini e DeepSeek: dá para usar hoje via OpenRouter sem código. Um provider nativo custa cerca de 150 a 200 LOC cada. O trabalho real está em estender a interface para structured output, tools e usage, e refatorar 4 pontos de chamada.
9. O MCP expõe 22 ferramentas: contexto completo do usuário, CRUD de programas, inventário da academia e backfill. Usa token pessoal com flag `canWrite`, aceita token em query string, não tem rate limit, e a "confirmação" é um literal `true` que o agente externo preenche.
10. Recomendação: reaproveitar (com adaptação) as libs puras de métricas, progressão e carga. Não reaproveitar o fluxo de sync offline, a camada de IA de geração/ajuste, nem o modelo de programa sem versionamento.

---

## 1. Programas

### Modelo (verificado)
- `Program` tem `name`, `description`, `phase` (string livre), `isActive`, `startDate`, `endDate`, `workouts` (`prisma/schema.prisma:212-226`). Não há semanas, blocos ou mesociclos nem progressão planejada por semana.
- `Workout` tem `name`, `dayOfWeek Int?` e `order` (`schema.prisma:228-237`). `dayOfWeek` funciona só como rótulo: o usuário escolhe o treino manualmente (`app/(app)/session/new/page.tsx:99`, `app/(app)/page.tsx:156`). Não existe lógica de "próximo treino" nem de rotação (busca por `dayOfWeek` só encontra exibição e CRUD).
- `ProgramExercise` (`schema.prisma:239-264`) tem `order`, `targetSets`, `targetRepsMin/Max`, `targetRIR` (Int), `restSec`, `tempo` (string livre), `notes`, `supersetGroup` (1-9, `lib/supersets.ts:18-19`), `autoregulationMode` (PRESERVE_RIR/PRESERVE_REPS) e `fatigueRate` / `loadAdjustmentPct`.
- O que falta na prescrição:
  - RPE alvo: só existe RIR. O RPE aparece apenas no atalho `100x8@9`, convertido para RIR em `lib/set-shorthand.ts`.
  - %1RM ou training max: não existe. A tabela `% do e1RM` é só exibição (`lib/loading-table.ts:1-59`).
  - AMRAP: não existe; aparece só em texto nas notas dos templates (`lib/programs/templates.ts:61`).
  - Drop set e warm-up: são flags na série executada (`Set.isDropSet`/`isWarmup`, `schema.prisma:393-394`), não na prescrição.
  - Giant set: funciona de forma implícita, porque um `supersetGroup` pode ter N membros (`lib/supersets.ts:1-9`).
- Deload planejado: não faz parte da estrutura do programa. É um interruptor do usuário, `User.deloadUntil = now + 7d` (`app/api/deload/route.ts`, `lib/deload.ts:37`), que só reduz a sugestão de carga em 10% (`lib/progression.ts:132-144`). Séries e volume ficam iguais e o motivo não é registrado.
- Templates embutidos: 11 (5/3/1 BBB, GZCLP, PPL, Upper/Lower, nSuns, Starting Strength, StrongLifts, Madcow, PHUL, PHAT, Full Body 3x), validados com Zod ao carregar o módulo (`lib/programs/templates.ts:846-871`).
- Problemas de domínio nos templates (verificados):
  - Os templates usam nomes como `'Bench Press'`, `'Deadlift'` e `'Back Squat'`, enquanto o catálogo semeado usa `'Barbell bench press'` etc. (`lib/exercise-catalog.ts:27`). A materialização faz `upsert` por nome exato (`lib/program-generation.ts:134-147`), então cria exercícios duplicados e fragmenta o histórico. O catálogo semeado nem tem squat livre nem deadlift.
  - Nenhum template define `equipmentType` (zero ocorrências em `templates.ts`). Os exercícios são criados como `OTHER` (`lib/program-generation.ts:144`) e por isso não recebem snapping ao inventário.
  - 5/3/1 coloca o mesmo exercício duas vezes no mesmo treino, como principal e como BBB (`templates.ts:52-73`). Como as séries só carregam `exerciseId`, as duas linhas compartilham o mesmo pool de séries (`components/session/session-runner.tsx:433-435`), e a sugestão do BBB usa a carga máxima da última sessão, ou seja, o top set do principal (`lib/progression.ts:103`).
- A progressão é indexada por exercício, não por prescrição: `getLastPerformances` pega a última sessão do exercício em qualquer treino (`lib/last-performance.ts:35-44`) e a compara com o `targetRepsMax` da linha atual. Num programa com dia pesado (3-5) e dia leve (8-12) do mesmo exercício, um contamina o outro.
- Versionamento: não existe. Edições sobrescrevem o registro (`app/api/coach/[id]/apply/route.ts:111-117`, `components/session/session-exercise-menu.tsx:156-188`). Excluir um programa apaga em cascata os workouts e desanexa as sessões históricas (`Session.workoutId ON DELETE SET NULL`, `prisma/migrations/20260430180630_lot_1_initial_schema/migration.sql:150-153`; `app/api/programs/[id]/route.ts:57-69`), e o histórico perde a prescrição.

## 2. Treino ativo / logger

- Iniciar treino: `POST /api/sessions` exige rede e reaproveita a sessão aberta do mesmo workout (`app/api/sessions/route.ts:53-69`). Faz check-then-insert sem constraint, o que dá corrida em duplo clique concorrente. A sessão sempre exige `workoutId` (`app/(app)/session/[id]/page.tsx:44`), então não existe treino livre sem programa.
- Interações para registrar uma série (verificado):
  - Tabela inline (`components/session/editable-sets-table.tsx`): linha pré-preenchida e um toque em ✓ (`confirmRow`, `:417-435`). Alterar peso ou reps custa 2 toques (célula e picker); alterar RIR custa um select.
  - Card `SetInput` (`components/session/set-input.tsx`): botões ±, atalho `100x8@9`, "Parse with AI" opcional (`:200-257`) e "Log set" com um toque. O RIR selecionável vai só de 0 a 3 (`:74`).
  - Os dois loggers aparecem juntos (`session-runner.tsx:834-877`) e com pré-preenchimentos diferentes:
    - a tabela espelha a série N da última sessão (`editable-sets-table.tsx:114-118`, teste "prefills ... from matching previous-session sets" em `editable-sets-table.test.tsx:644`);
    - o `SetInput` usa a sugestão de double progression (`set-input.tsx:713-732`).
    - No caminho de um toque, portanto, a progressão (+2,5 kg) não vem preenchida. Isso é inconsistente e tende a gerar erro de registro.
- Última execução: mostrada no card como top set (`maxWeight × repsAtMaxWeight`) e data (`components/session/exercise-card.tsx:204-224`), além da sugestão com "por quê" expansível (`:99-118`, `:226-276`).
- Timer de descanso:
  - Começa sozinho após cada série (`session-runner.tsx:499-518`) e é ancorado em `endsAt` de relógio de parede (`lib/rest-timer.ts:1-42`).
  - Tem ±15 s, pausa/retoma e pular (`components/session/rest-timer.tsx:117-149`).
  - Ao terminar: vibração (`lib/vibrate.ts`, padrão `restEnd`), beep via WebAudio (`lib/sound.ts`) e flash opcional de tela.
  - Não tem Notification API nem push (grep sem ocorrências). Com o app em segundo plano ou a tela desligada, o fim do descanso pode passar despercebido.
  - Não sobrevive à troca de tela: o estado `mode` vive no React do `SessionRunner` (`session-runner.tsx:129-140`, `:213`) e se perde ao navegar (ex.: abrir a página do exercício em `:780-785`) ou recarregar.
  - Durante o descanso a entrada fica bloqueada (`disabled={!hydrated || mode.kind !== 'input'}`, `:850`).
  - Superset: descanso curto de 20 s na transição A1→A2 (`lib/supersets.ts:171`).
- Substituir, adicionar ou remover exercício: possível, mas sempre reescreve o programa salvo (PUT/POST/DELETE em `program-exercises`, `components/session/session-exercise-menu.tsx:156-238`; comentário em `:184-185`). Não existe a opção "só nesta sessão".
- Adicionar série: basta registrar além de `targetSets` (`components/session/sets-list.tsx:31`). Remover: apaga a série (`session-runner.tsx:572-599`). Depois de finalizar a sessão, PATCH e POST de série são recusados (`app/api/sets/[id]/route.ts:35-37`, `app/api/sessions/[id]/sets/route.ts:26-28`), mas DELETE continua permitido. Não dá para corrigir o histórico, só apagar.
- Calculadora de anilhas (`lib/plates.ts`, usa o inventário da academia) e rampa de aquecimento 40/60/80% (`lib/warmup.ts:27-31`): só exibição, não criam séries de aquecimento.
- PR ao vivo: badge por série via `detectPRs` (`components/session/editable-sets-table.tsx:226-231`), mas a base de comparação é só a sessão anterior mais as séries anteriores da sessão atual (`sets-list.tsx:17-22`, `session-summary.tsx:19-22`). O próprio comentário admite que não é PR histórico.
- Notas: por série (`set-input.tsx:602-617`), por sessão (no resumo) e por exercício (dica sempre visível, `exercise-card.tsx:174-179`).
- Extras: autorregulação intra-série, que recomenda a próxima série com motivo e confiança (`lib/intra-set-autoregulation.ts`), check-in de prontidão antes do treino, Wake Lock e "Ask coach" contextual à sessão.
- Bug menor: o Wake Lock não é readquirido depois de uma liberação automática do navegador, porque `currentLock` não é zerado no evento `release` e o handler checa `currentLock === null` (`lib/wake-lock.ts:5-10`, `:33`).

## 3. Offline-first

O que existe (verificado):
- O Dexie guarda apenas a fila de séries, tabela `pendingSets` (`lib/indexeddb.ts:1-11`, `:64-75`). Programas, exercícios e páginas ficam no cache HTTP do service worker (Workbox NetworkFirst para `navigate` e para `GET /api/*`, `next.config.js:15-47`).
- Escrita otimista: `queueSet` grava `status: 'pending'` e dispara o flush sem `await` (`lib/sync.ts:214-234`). O flush roda no startup, no evento `online`, após cada série e no botão manual (`lib/sync.ts:295-306`, `components/shared/offline-indicator.tsx`).
- Não existe Background Sync (nenhum plugin de background sync em `next.config.js`) nem timer de retry (`lib/sync.ts:10-12`).
- Exige rede: iniciar sessão (`components/session/start-workout-button.tsx:25-36`), finalizar (`session-runner.tsx:608-612`), editar programa ou corpo, IA e imports. A navegação client-side (`router.push`) usa requisições RSC que não batem com a regra `request.mode === 'navigate'` do SW. Inferência: uma sessão nova não abre offline.
- Idempotência: não existe. Não há `clientMutationId`, o POST não envia o `localId` (`lib/sync.ts:101-122`), não há constraint única em `Set(sessionId, exerciseId, setNumber)` (`schema.prisma:359-403`) e a rota não deduplica (`app/api/sessions/[id]/sets/route.ts:48-76`).
- Conflito: last-write-wins por PATCH, com uma proteção local contra edição concorrente durante o PATCH (`lib/sync.ts:152-171`).

Riscos concretos (verificados por leitura e não reproduzidos em execução, pois a regra proíbe rodar o projeto):

| # | Cenário | Efeito | Evidência |
|---|---|---|---|
| O1 | O POST foi gravado no servidor, mas a resposta se perdeu (timeout ou rede caiu) | O `catch` devolve a série para `pending` e ela é reenviada: série duplicada no servidor | `lib/sync.ts:193-201`; rota sem dedupe |
| O2 | Reload ou remontagem do `SessionRunner` no meio da sessão (inclusive ida e volta pela página do exercício) | A hidratação grava `srv_<id>` enquanto a linha `loc_*` já sincronizada continua (mesmo `serverId`). O `liveQuery` não deduplica, então aparecem séries duplicadas na tela, contagens infladas, auto-advance e PR distorcidos | `lib/sync-hydration.ts:18`, `:39`; `session-runner.tsx:270`, `:307-316`; a poda só remove `synced` com mais de 7 dias (`lib/sync.ts:284-292`). Nos testes a hidratação é mockada (`session-runner.test.tsx:63`) e nenhum E2E faz reload ou offline (grep vazio em `tests/e2e`) |
| O3 | Aba fechada ou recarregada durante o fetch, ou fetch pendurado (sem timeout) | O item fica preso em `syncing` para sempre, porque o flush só seleciona `pending`/`failed`. Fetch pendurado também prende o `inFlight` e trava toda a fila até o reload. Resultado: perda silenciosa (o contador mostra "syncing N" eternamente) | `lib/sync.ts:60-67`, `:71-74`, `:85` |
| O4 | "Finalizar" com séries ainda pendentes (ex.: resposta 5xx) | O resultado do flush é ignorado e a sessão é finalizada. As séries restantes recebem 400 "Session already finished" e viram `failed` permanentemente: perda | `session-runner.tsx:601-623`; `lib/sync.ts:131-141`; rota `:26-28` |
| O5 | Duas abas abertas | O `inFlight` é por aba; as duas leem o mesmo `pending` antes de marcar `syncing` e há POST duplo | `lib/sync.ts:56`, `:71-85` |
| O6 | Edição offline sincronizada depois de a sessão ser finalizada | O PATCH responde 400, o item fica `failed` e o valor local diverge do servidor (o rollback só acontece no fluxo em primeiro plano) | `app/api/sets/[id]/route.ts:35-37`; `session-runner.tsx:555-558` |
| O7 | Itens `failed` | São reenviados a cada flush, contrariando o comentário, porque a seleção inclui `failed` | `lib/sync.ts:71-74` vs `:133-136` |

## 4. Progressão e autorregulação

Algoritmo exato de sessão a sessão (`lib/progression.ts:88-236`, verificado):

```
suggestNextWeight(pe, lastSets, readiness?, plannedDeload?, gym?):
  se lastSets vazio -> {weight:null, reason:'no-history'}
  W = max(lastSets.weight)                     # série mais pesada da última sessão do exercício
  working = séries com weight == W              # drop sets ignorados por serem mais leves
  allTop = todas(working.reps >= pe.targetRepsMax)   # ignora RIR real e nº de séries feitas
  delta = COMPOUND ? 2.5 : 1   (kg, constante)       # :234-236
  baseline = allTop ? (W+delta,'progression') : (W,'same-as-last')
  se plannedDeload: return snap(W*0.9,'planned-deload')            # :132-144
  rec = assess(readiness <= 36h; readiness geral; dor do grupo PRIMÁRIO)
     'deload' se readiness<=1 ou dor>=5 ; 'hold' se readiness<=2 ou dor>=4   # :209-230
  ok -> snap(baseline) ; deload -> snap(W*0.9,'readiness-deload') ; hold -> snap(W,'readiness-hold')
snap(target, ref, gym):                                             # lib/gym-loads.ts:78-151
  sem inventário -> round(target,2)
  opções = halteres | barra+pares de anilhas (subset-sum por DP) | stack de máquina/cabo
  target>ref -> opção mais próxima ACIMA de ref (ou ref) ; target<ref -> mais próxima ABAIXO ; senão mais próxima
```

- Incrementos reais de equipamento: sim, quando o inventário da academia está cadastrado (`lib/gym-loads.ts:47-72`). Teste "steps up to the next available dumbbell" (`lib/gym-loads.test.ts:20`): 20 + 2,5 = 22,5 vira 22 entre [20, 22, 24]. Sem inventário, sugere valores que podem não existir (22,5 kg).
- Unidades: o incremento é em kg. Para quem usa LB, a sugestão vira +5,51 lb exibida com 2 casas (`exercise-card.tsx:239-243`). Só os botões ± usam passos limpos de 5/2,5 lb (`lib/units.ts:79-82`).
- Saídas: `no-history | same-as-last | progression | readiness-hold | readiness-deload | planned-deload` (`progression.ts:18-24`). Não existem DECREASE por falha (reps abaixo do mínimo levam a HOLD), INSUFFICIENT_DATA além de no-history, nem ação ligada a stall.
- Motivo e dados usados: o resultado inclui `reason`, `workingWeight`, `delta` e `targetRepsMax` (`:26-35`), e a UI mostra uma explicação (`exercise-card.tsx:99-118`). Os dados de entrada não são persistidos e não há trilha auditável.
- Autorregulação intra-série (`lib/intra-set-autoregulation.ts:115-207`). É o módulo mais sofisticado e expõe `predictedRepsAtSameLoad`, `fatigueLoss`, `confidence` e `reason`:

```
cap = last.reps + (last.rir ?? targetRIR)
loss = fatigueRate(padrão por categoria/grupo, :68-89) * clamp(restPlanejado/restReal, .75, 1.5) * (1.25 se superset mesmo músculo)
predicted = round(max(0,cap-loss) - targetRIR)
PRESERVE_REPS: gap = clamp(last.reps,min,max) - predicted
PRESERVE_RIR : gap = min-predicted (se abaixo) | max-predicted (se acima) | 0
se !allowIncrease (deload/readiness ruim): gap = max(gap,0)
pct = clamp(gap*loadAdjustmentPct, -5, 10) ; peso = arredonda ao incremento, força >= 1 passo ; snap ao inventário ; teto de retorno
confidence = low (sem RIR) | high (>=3 séries) | medium
```

- Retorno após pausa (`lib/return-to-training.ts:15-110`): modos `normal / exercise-reintro / muscle-reintro`, com teto de carga, `startFraction`, `historyBasis` e `confidence`. É heurístico mas bem documentado e é o que mais se aproxima de "recomendação com dados usados".
- Stall (`lib/stats.ts:186-225`):

```
isStalled(série de e1RM por sessão — e1RM do TOP SET, não o melhor e1RM, stats.ts:163-172; lookback=3; tol=0,5%):
  len < 3 -> false (dado insuficiente, silencioso)
  baseline = melhor antes da janela (ou 1º valor se não há histórico anterior)
  stalled = nenhuma sessão da janela supera baseline*(1,005) (com melhor corrente)
```

  A janela é móvel nas últimas 3 sessões, dentro de 12 semanas (`app/(app)/progress/page.tsx:57-60`, `:339`). Dá falso positivo em ondulação (5/3/1) e em deload voluntário.
- Recomendação de deload (`lib/deload.ts:84-107`): dispara com 2 ou mais lifts estagnados, ou com média de readiness ≤ 2 em pelo menos 3 check-ins (últimos 5, até 14 dias). Os motivos têm texto legível (`:58-70`). Ao aceitar o deload o motivo não é persistido (`app/api/deload/route.ts`).
- A cola de stall/deload está duplicada em 3 lugares (`app/(app)/progress/page.tsx:339`/`:448`, `lib/coach.ts:802`/`:808`, `lib/home-insight.ts:208`/`:223`). As funções puras são compartilhadas; a orquestração não.

## 5. Métricas

- e1RM: apenas Epley, `w*(1+reps/30)` (`lib/stats.ts:66-71`). Não guarda fórmula nem origem, não tem limite de reps (série de 30 reps dobra o "1RM") e não tem fórmula alternativa. A inversa é usada para 10RM (`:77-84`).
- PRs (`lib/records.ts`): só dois tipos, `weight` e `e1rm` (`:22`, `:45-66`), mais o quadro de recordes com data (`:116-156`). Faltam PR de reps em dado peso, de volume por série, de tonelagem por treino ou semana e de melhor sessão. Ver também a seção 2: o PR ao vivo usa só a última sessão como base.
- Volume:
  - tonelagem por série, sessão e semana por grupo muscular (`stats.ts:52-64`, `:237-266`);
  - séries por semana por grupo (`:339-367`), com faixa MEV/MRV padrão de 10 a 20, personalizável (`:283-309`, `VolumeTarget`);
  - frequência por grupo, em dias distintos (`:385-423`).
  - Cada exercício tem um único grupo muscular primário (`schema.prisma:150`), sem secundários. Na contagem de séries, drop sets entram como séries de trabalho e o RIR é ignorado (`:348`); não existe conceito de "série efetiva".
- Aderência e streak: `trainingConsistency` conta dias treinados por semana contra a meta `weeklyFrequency`, e o streak é de semanas consecutivas (`stats.ts:576-638`). Não é aderência ao plano (planejado vs feito).
- Peso corporal: gráfico cru, sem média móvel nem tendência (`components/progress/bodyweight-card.tsx:64-74`).
- Peso corporal é aplicado retroativamente: o peso atual (`User.bodyweight`) é somado a todo o histórico em exercícios com o próprio corpo (`stats.ts:40-47`; `lib/coach.ts:298`, `:413-425`). Quando o peso muda, e1RM e PRs passados de barra fixa mudam junto, porque não existe snapshot por série.
- Relatório semanal: existe só como debrief de LLM (`app/api/coach/route.ts`). O cartão "o que o coach vê" é determinístico (`lib/coach-context.ts`), mas não é um relatório.
- Onde vive a lógica:
  - Em `lib/` puro e testado: stats, records, deload, progression, goals, intra-set, return-to-training, gym-loads, supersets, warmup, plates, loading-table, rest-timer.
  - Em componentes: `computeSessionPRs` (`components/session/session-summary.tsx:51-94`), `initialDraft` (`editable-sets-table.tsx:106-148`), `computeInitial` (`set-input.tsx:633-746`), `recommendationFor` (`session-runner.tsx:335-380`).
  - Agregações com N+1 queries por exercício na página de progresso (`app/(app)/progress/page.tsx:287-339`).
- Fuso horário:
  - Semanas ISO, streak, frequência, datas de PR e o "dia" de cardio são todos UTC (`stats.ts:105-126`, `:406`; `records.ts:106-108`).
  - Só o calendário de histórico respeita o fuso, recebido via `?tz=` (`lib/history-calendar.ts:17-22`, `:99-105`).
  - O `User` não tem campo de fuso, e o next-intl usa o fuso do servidor (`i18n/request.ts:14`).
  - Para o Brasil (UTC-3), um treino de domingo à noite cai na semana seguinte.

## 6. Corpo

- Peso corporal: histórico `BodyweightEntry` (kg, `measuredAt`, `note`) e `User.bodyweight` como valor corrente sincronizado (`schema.prisma:455-465`, `lib/bodyweight.ts:17-27`).
- Medidas: `BodyMeasurement` em cm com 13 pontos (pescoço, ombros, peito, cintura, quadril e braço, antebraço, coxa e panturrilha esquerdos e direitos) (`schema.prisma:471-498`, `lib/measurement.ts:43-57`). Não tem % de gordura nem dobras cutâneas.
- Fotos (só domínio): `takenAt`, `note`, comparação antes/depois lado a lado (`components/progress/photos-card.tsx:38-53`, `:198-205`). Não tem pose ou ângulo. O storage é local (`lib/progress-photo.ts`) e cabe à outra frente.
- Cardio: série com `durationSec`, `distanceM`, `avgHr`, `maxHr` e `track` JSON (`schema.prisma:376-391`). Importa TCX, GPX e FIT. Volume semanal é comparado com 150 min da OMS (`stats.ts:431`, `:446-495`), e cardio fica fora de tonelagem, e1RM e PR (`stats.ts:7-13`).
- Prontidão: `ReadinessCheckin` com prontidão e sono de 1 a 5 e dor por grupo (`schema.prisma:537-553`).

## 7. Import / Export

- Import:
  - Strong CSV, Hevy CSV, CSV nativo GymCoach, TCX, GPX e FIT, além de restore de backup JSON.
  - Fluxo `preview` → `confirm` com contagens, erros por linha, novos exercícios e datas já treinadas (`app/api/import/strong/route.ts:112-123`).
  - Uma transação por import (`:133-136`).
  - Detecção de duplicados por chave (data | exercício | ordem | peso | reps) (`lib/import/strong-import.ts:100`).
- Limitações:
  - Mapping é só automático, por nome sem diferenciar maiúsculas (`strong-import.ts:110`). Não há tela para mapear "Bench Press (Barbell)" para "Barbell bench press".
  - Exercícios desconhecidos são criados como `OTHER`/`ISOLATION` (`strong-import.ts:229-251`). Compostos importados passam a progredir +1 kg e ficam fora dos gráficos por grupo.
  - O Strong não traz horário: a sessão é fixada ao meio-dia UTC (`strong-import.ts:205-207`).
  - RPE do Strong e do Hevy é descartado (sem ocorrência de "rpe" em `lib/import/strong-csv.ts` e `hevy-csv.ts`).
- Export:
  - Backup JSON v5 (`app/api/backup/route.ts:34-64`), CSV de histórico e TCX.
  - O backup **não** inclui `BodyMeasurement`, `ProgressPhoto`, `VolumeTarget`, `User.coachNote` nem `Set.track` (grep sem ocorrência em `backup/route.ts`). Portanto não é export completo dos dados do usuário.
  - O restore apaga os dados existentes antes de reimportar (`:641-660`).

## 8. IA: comparação com o alvo (adendo de IA)

### Arquitetura atual (verificado)
- Interface `LlmProvider { complete(req): {text, modelUsed}; stream(req): AsyncIterable<string> }`, onde `req = {system, messages, maxTokens?, temperature?}` (`lib/llm/types.ts:8-51`).
- Seleção por `LLM_PROVIDER` (`lib/llm/index.ts:13-27`): `anthropic` (padrão, modelo padrão `claude-opus-4-7`, `lib/llm/anthropic.ts:11`), `openrouter` (qualquer modelo, `lib/llm/openrouter.ts:9`, `:57`), `codex-lb` e `demo`.
- Usos:
  - debrief semanal: `lib/coach.ts:996-1008`;
  - chat em streaming: `app/api/coach/chat/route.ts`;
  - geração de programa: `lib/program-generation.ts:14-59`;
  - parse de série por texto: `lib/set-parse.ts`.
- Todos passam por `getLlmProvider()`. O SDK e a URL do fornecedor só aparecem em `lib/llm/` (verificado por grep).

### Item a item

| Alvo da spec | Estado | Evidência |
|---|---|---|
| Interface `AIProvider { generateWorkoutPlan; adjustWorkoutPlan }` | **Parcial.** A interface é genérica de texto (`complete`/`stream`), não de domínio. A lógica de geração e ajuste fica fora do provider | `lib/llm/types.ts:40-51` |
| GeminiProvider / DeepSeekProvider, Flash-Lite inicial | **Ausente** como provider nativo. **Possível hoje via OpenRouter** apontando `OPENROUTER_MODEL` para um modelo Gemini/DeepSeek (o provider aceita qualquer string de modelo); a qualidade com os prompts atuais não foi testada | `lib/llm/openrouter.ts:57`, `:71-79` |
| Config por env | **Existe** (`LLM_PROVIDER`; o nome difere de `AI_PROVIDER`) | `lib/llm/index.ts:13-19` |
| Nenhuma chamada de fornecedor espalhada | **Existe** | grep: só `lib/llm/*` |
| `TrainingContextBuilder` com JSON compacto | **Parcial.** `buildCoachPayload` calcula no backend perfil, semana atual e anterior com séries, programa ativo, readiness, metas, fadiga (stalls e deload), condicionamento, 20 recordes e série de e1RM de 8 semanas. **Faltam** disponibilidade, prioridades, equipamentos (o inventário só entra pelo MCP), aderência ao plano, tendência de peso e tendência de e1RM calculada (só a série crua vai). O JSON é *pretty-printed* (`null, 2`) e inclui `generatedAt` | `lib/coach.ts:34-106`, `:275-476`, `:449`, `:998` |
| Backend calcula, IA interpreta | **Existe em boa parte** para o debrief (stalls, deload, recordes e metas vêm calculados e o prompt manda não inventar). O prompt pede "Cite studies", o que abre risco de citação inventada | `lib/prompts/coach-system-prompt.ts:99` |
| `ExerciseRetrievalService.findExercises(...)` e tool `searchExercises()` | **Ausente.** A geração manda **o catálogo inteiro** do usuário. O mais próximo é a tool MCP `list_exercises`, que só filtra por substring de nome com limite de 500 | `lib/program-generation.ts:28-44`; `lib/mcp/server.ts:436-466` |
| IA retorna só `exerciseId` existentes | **Ausente (oposto).** O schema exige `name` livre, o prompt diz que pode criar exercício novo, e a persistência faz `upsert` por nome exato (que diferencia maiúsculas), criando qualquer nome que o modelo inventar. Os ajustes do coach casam por `exerciseName` | `lib/schemas/program-generation.ts:23-28`; `lib/prompts/program-system-prompt.ts:8`; `lib/program-generation.ts:134-147`; `app/api/coach/[id]/apply/route.ts:49-57` |
| Structured output com schema Zod | **Parcial.** Zod existe (`generatedProgramSchema`, `adjustmentSchema`, `setParse`), mas a saída é texto livre com extração de `{...}` ou de `<adjustments>`; não usa JSON schema nativo do provider. Não há retry em falha de parse (dá erro 502) | `lib/schemas/program-generation.ts:69-103`; `lib/coach-adjustments.ts:26-76`; `lib/program-generation.ts:54-57` |
| `WorkoutPlanValidator` (domínio) | **Ausente.** Só limites Zod: séries 1-20, reps 1-50, RIR 0-5, descanso 15-600 s, 1-7 treinos, 1-15 exercícios. Não verifica id existente/ativo, equipamento disponível na academia, bloqueio, nº de dias × frequência, duração, cobertura de grupos nem volume semanal | `lib/schemas/program-generation.ts:23-61` |
| GENERATE → schema → domain → id → análise → PREVIEW → confirma → SAVE | **Parcial.** Hoje é GENERATE → Zod → PREVIEW editável (remover treino ou exercício, editar campos) → SAVE (`/api/programs/build`, que revalida só com Zod). Faltam validação de domínio, de ids e análise. Não sinaliza quais exercícios serão criados. **Pelo MCP existe IA → banco**: `create_program`, `add_program_exercise` e `remove_program_exercise` gravam direto, e a "confirmação" é `confirmed: z.literal(true)` preenchido pelo agente | `components/programs/program-generator.tsx:41`, `:59-78`, `:109-121`; `app/api/programs/build/route.ts:1-15`; `lib/mcp/server.ts:59-61`, `:629-647`, `:712-776` |
| Ajuste pontual sem regenerar tudo | **Parcial.** O debrief propõe ajustes por exercício (séries, reps, RIR, descanso, nota e carga informativa); o prompt proíbe troca de exercício. Não existe ajuste "trocar só um exercício" via IA (só manual ou MCP) | `lib/prompts/coach-system-prompt.ts` (bloco `<adjustments>`); `lib/coach-adjustments.ts:10-22` |
| Diff antes/depois/motivo com aceitar/cancelar | **Parcial.** A UI mostra resumo, motivo (`rationale`) e campos editáveis com o valor sugerido; o "antes" só aparece para carga ("versus"). Aceite seletivo por linha. O apply **não é transacional**, **não é idempotente** (aplicar de novo duplica a nota) e só inverte min/max quando os dois vêm (min sugerido maior que o max atual passa) | `components/coach/coach-adjustments.tsx:38-52`, `:120-185`; `app/api/coach/[id]/apply/route.ts:63-117`, `:90-98` |
| `ProgramRevision` (versões nunca destruídas) | **Ausente.** Os updates sobrescrevem `ProgramExercise`; só sobra uma linha `[Coach yyyy-mm-dd]` nas notas | `apply/route.ts:111-117`, `:141-153` |
| `AIUsage` (provider, model, op, tokens, latência, custo, sucesso) | **Ausente.** `LlmCompletionResult` não tem `usage`. `CoachSession` guarda prompt e resposta, mas não modelo nem tokens | `lib/llm/types.ts:24-27`; `app/api/coach/route.ts:23-31`; `schema.prisma:522-531` |
| Idempotency key contra cobrança duplicada | **Ausente** | grep sem ocorrência |
| Fallback Gemini↔DeepSeek com retry | **Ausente.** Um provider por processo, sem retry | `lib/llm/index.ts:21-27` |
| Feature flags `ai.*` | **Ausente.** O único controle é ter chave configurada (`isConfigured`) | `lib/llm/types.ts:47` |
| Rate limit e custo | **Parcial.** Rate limit em memória por instância: chat 30/min, geração 10/min, parse 20/min. **O debrief semanal (`POST /api/coach`) não tem rate limit**, com Opus e 8000 tokens por padrão | `lib/rate-limit.ts:1-7`; `app/api/coach/route.ts:11-38` |
| Prompts versionados em arquivo (`/prompts/.../v1.md`) | **Ausente.** São constantes TS em `lib/prompts/*.ts`, sem identificador de versão gravado junto da resposta | `lib/prompts/*.ts` |
| IA nunca é a única fonte de volume, e1RM, carga, PR, tendência, aderência e stall | **Existe em boa parte.** Todas essas métricas são determinísticas em `lib/`; a carga sugerida pela IA é "informational only" e vira apenas nota (`apply/route.ts:141-153`) | `lib/stats.ts`, `lib/records.ts`, `lib/progression.ts` |
| Sem diagnóstico médico | **Parcial.** O prompt do debrief proíbe conselho médico só no trecho de cardio e trata `coachNote` (dor) com cautela; o prompt do chat não tem regra médica | `lib/prompts/coach-system-prompt.ts:84-85`, `:28-40`; `lib/prompts/chat-system-prompt.ts` |

Outros achados de IA (verificados):
- Cache de prompt no chat: o README diz que o cache é reaproveitado entre turnos. Na prática a requisição seguinte não aproveita o cache, porque o payload inteiro, incluindo `generatedAt` com a hora atual, é concatenado ao `system` dentro do mesmo bloco com `cache_control` (`app/api/coach/chat/route.ts:77`; `lib/llm/anthropic.ts:44-50`; `lib/coach.ts:449`).
- O chat reenvia o histórico inteiro da conversa sem truncar (`app/api/coach/chat/route.ts:59-67`), então o custo cresce sem limite.
- Dados pessoais enviados ao fornecedor: `displayName`, sexo, altura, peso, `coachNote` e notas das séries (`lib/coach.ts:450-458`, `:545`). O `CoachSession.prompt` guarda o payload completo (`app/api/coach/route.ts:23-31`).
- Idioma: o chat responde no idioma do usuário (`chat-system-prompt.ts:11`). O debrief não define idioma. A UI só tem `en`, `fr` e `ru` (`messages/`); não há pt-BR.

### Dificuldade de adicionar Gemini e DeepSeek em `lib/llm`
- Rota mais barata, sem código: `LLM_PROVIDER=openrouter` com `OPENROUTER_MODEL` de Gemini Flash-Lite ou DeepSeek. Serve para avaliar a qualidade de imediato.
- Provider nativo: uma classe de cerca de 150 a 200 LOC cada (o modelo a copiar é `openrouter.ts`, já que DeepSeek tem API compatível com OpenAI), mais estender a união `id` (`types.ts:41`) e `resolveProviderId` (`index.ts:13-19`), mais testes. Estimativa: **baixo, 1 a 2 dias cada** para paridade de texto.
- O que exige trabalho de verdade (estimativa média, 1 a 2 semanas): estender o contrato com `responseSchema`/JSON mode, `tools` (para `searchExercises`), `usage` (tokens), latência, erro tipado para fallback, retry/backoff e idempotency key, e depois refatorar os 4 pontos de chamada (`lib/coach.ts`, `lib/program-generation.ts`, `lib/set-parse.ts`, `app/api/coach/chat/route.ts`) e as páginas `app/(app)/coach/page.tsx:81` e `app/(app)/chat/page.tsx:66`. O streaming do chat também teria de propagar usage.

### MCP server (o que expõe)
- Transporte Streamable HTTP stateless em `/mcp` (`app/mcp/route.ts:20-53`). São 22 ferramentas (`lib/mcp/server.ts:112-149`, `:203-865`), além de um recurso de instruções e um prompt `build-training-program`.
  - Leitura: `get_mcp_capability_index`, `get_training_context` (payload completo do coach mais academia ativa), `list_exercises`, `list_gyms`, `get_gym_inventory`, `get_gym_equipment_image`, `list_programs`, `get_program`, `preview_historical_equipment_backfill` e `list_historical_equipment_backfills`.
  - Escrita (exige `canWrite`): `create_program`, `update_program_metadata`, `add_workout`, `add_program_exercise`, `update_program_exercise`, `remove_program_exercise`, `activate_program`, `update_gym_free_weights`, `upsert_gym_equipment`, `set_gym_equipment_image`, `apply_historical_equipment_backfill` e `undo_historical_equipment_backfill`.
  - Não há leitura nem escrita de sessões e séries individuais além do resumo do contexto.
- Escopo de dados: o usuário dono do token. O contexto inclui perfil, notas, readiness e recordes.
- Auth:
  - Token pessoal `gmc_…` com hash SHA-256, flag binária `canWrite` e revogação (`lib/mcp/auth.ts:12-54`).
  - O token é aceito via `Authorization`, `x-gymcoach-token` **ou `?token=` na URL** (`auth.ts:24-34`), o que deixa o token vazar em logs (detalhe para a frente de segurança).
  - Sem OAuth, sem escopos finos, sem rate limit.
  - As escritas MCP também usam nome livre e `upsert` (`lib/mcp/server.ts:737-748`).

## 9. Qualidade dos algoritmos e testes

Os módulos de domínio são funções puras e determinísticas, sem relógio (o `now` é injetado) e testadas. Arquivos de teste de domínio, com contagem aproximada de `it(`:

| Teste | Cobre |
|---|---|
| `lib/stats.test.ts` (~67) | volume, Epley e inversa, best1RM, semana ISO, exerciseProgress, volume/séries/frequência semanais, MEV/MRV, peso efetivo, consistência e streak, isStalled, exclusão de cardio, condicionamento |
| `lib/progression.test.ts` (~30) | incrementos, progression/hold, drop sets, peso corporal 0 kg, readiness hold/deload, janela de 36 h, "nunca sobe", preferência, deload planejado com precedência e sem empilhar |
| `lib/gym-loads.test.ts` (~16) | snapping de halter, barra (pares de anilhas), stack, teto, fallback sem inventário, herança de stack |
| `lib/intra-set-autoregulation.test.ts` (~9) | padrões e recomendação intra-série |
| `lib/return-to-training.test.ts` (~19) | modos de retorno, tetos, confiança |
| `lib/records.test.ts` (~18) | PR de peso e e1RM, empate, cardio, quadro de recordes |
| `lib/deload.test.ts` (~15) | gatilhos, texto dos motivos, isDeloadActive |
| `lib/goals.test.ts` (12), `lib/warmup.test.ts` (12), `lib/plates.test.ts` (20), `lib/loading-table.test.ts` (6), `lib/supersets.test.ts` (19), `lib/rest-timer.test.ts` (8), `lib/set-shorthand.test.ts` (23), `lib/units.test.ts` (8), `lib/bodyweight.test.ts` (4), `lib/measurement.test.ts` (6), `lib/cardio.test.ts` (34), `lib/muscle-map.test.ts` (8) | auxiliares de domínio |
| `lib/sync.test.ts` (~13) | estados de atualização, retry sem equipamento, PATCH em vez de POST duplicado, aviso de equipamento descartado. **Não cobre** O1 a O5 |
| `lib/import/*.test.ts` | parsers Strong, Hevy, CSV nativo, TCX, GPX, FIT, track, plano de import |
| `lib/coach-adjustments.test.ts` (6), `lib/coach-context.test.ts`, `lib/prompts/*.test.ts`, `lib/llm/*.test.ts` | parse de `<adjustments>`, seleção de provider, SSE, demo |
| Integração: `tests/integration/core.test.ts` (27) etc. | `buildProgramFromGenerated`, templates materializam, isolamento e conteúdo do payload do coach. O apply do coach só tem teste de ownership (`route-ownership.test.ts`) |

Bugs e casos de borda (verificados por leitura):
- Divisão por zero: as proteções existem (`goalProgress`, `progressPct`, `isStalled` com baseline 0, barra de progresso do timer). Nada crítico encontrado.
- Unidades kg/lb: o incremento da sugestão é sempre em kg, o que dá 5,51 lb em vez de 5 (`progression.ts:234-236`). O inventário fica em kg. O limite `weight ≤ 500 kg` (`lib/schemas/set.ts:16`) barra leg press muito pesado.
- Série sem reps: `reps` aceita 0 (`lib/schemas/set.ts:17`). Isso dá volume e e1RM iguais a 0 e progressão em hold, sem crash. Não existe o conceito de "falha".
- e1RM sem teto de reps: séries de 20 reps ou mais inflam o e1RM e geram PR de "e1RM" (`stats.ts:68-71`).
- e1RM do stall vem do top set, não do melhor e1RM da sessão (`stats.ts:163-172`).
- Timezone: tudo em UTC; ver a seção 5.
- Peso corporal retroativo: ver a seção 5.
- `upsert` por nome diferencia maiúsculas (unique do Postgres) na geração por IA, enquanto o import ignora maiúsculas (`strong-import.ts:110`). É inconsistente e gera duplicatas.
- Apply do coach: `targetRepsMin` sugerido sem `targetRepsMax` pode gravar min > max (`apply/route.ts:90-98`).
- Duas linhas do mesmo exercício num workout compartilham séries (`session-runner.tsx:433-435`).

---

## Tabela final

| Funcionalidade | Estado atual no GymCoach | Evidência | Qualidade (1-5) | Reaproveitar? |
|---|---|---|---|---|
| Modelo de programa (treinos, prescrição) | Plano: séries, faixa de reps, RIR, descanso, tempo, superset; sem semanas, mesociclo, %1RM, AMRAP | `schema.prisma:212-264` | 2 | adaptar |
| Templates embutidos | 11 templates; nomes não batem com o catálogo; sem `equipmentType`; exercício repetido compartilha séries | `lib/programs/templates.ts` | 2 | adaptar (conteúdo) |
| Rotação ou dias fixos | `dayOfWeek` é só rótulo; escolha manual | `session/new/page.tsx:99` | 1 | não |
| Logger (registrar série) | 1 toque com pré-preenchimento; dois loggers com pré-preenchimentos divergentes | `editable-sets-table.tsx:106-148`, `:417-435`; `set-input.tsx:633-746` | 3 | adaptar |
| Última execução na sessão | Top set e data; tabela espelha as séries anteriores | `exercise-card.tsx:204-224` | 4 | sim |
| Timer de descanso | Automático, ±15 s, pausa, pular, vibração, beep; sem notificação; não sobrevive à troca de tela | `lib/rest-timer.ts`, `session-runner.tsx:129-140` | 3 | adaptar (lib sim) |
| Substituir, adicionar ou remover exercício na sessão | Sempre altera o programa salvo | `session-exercise-menu.tsx:156-238` | 2 | adaptar |
| Calculadora de anilhas e aquecimento | Puras e testadas; só exibição | `lib/plates.ts`, `lib/warmup.ts` | 4 | sim |
| PR ao vivo | Base é só a última sessão | `sets-list.tsx:17-22` | 2 | adaptar |
| Offline-first / sync | Só a fila de séries; sem idempotência; duplicação e perda possíveis (O1 a O7) | `lib/sync.ts`, `lib/sync-hydration.ts` | 1 | não (reescrever) |
| Double progression | Simples, +2,5 ou +1 kg fixos; HOLD e deload via readiness | `lib/progression.ts:88-236` | 3 | adaptar |
| Incrementos reais de equipamento | Snapping a halteres, barra com anilhas e stack | `lib/gym-loads.ts:47-151` | 5 | sim |
| Autorregulação intra-série | Modelo de fadiga com motivo e confiança | `lib/intra-set-autoregulation.ts` | 4 | sim (calibrar) |
| Retorno após pausa | Heurístico, rico em metadados | `lib/return-to-training.ts` | 4 | sim |
| Stall | 3 sessões e tolerância de 0,5%, e1RM do top set | `lib/stats.ts:186-225` | 3 | adaptar |
| Deload (recomendação e planejado) | Recomendação com motivos; deload planejado de 7 dias e -10% sem motivo persistido | `lib/deload.ts`, `app/api/deload/route.ts` | 3 | adaptar |
| e1RM | Só Epley, sem teto de reps e sem origem | `lib/stats.ts:66-71` | 3 | adaptar |
| PRs e recordes | Peso e e1RM | `lib/records.ts` | 3 | adaptar (ampliar tipos) |
| Volume, séries e frequência por músculo | Por semana ISO em UTC; grupo único; MEV/MRV | `lib/stats.ts:237-423` | 3 | adaptar (TZ, secundários) |
| Aderência e streak | Dias por semana contra meta; não é aderência ao plano | `lib/stats.ts:576-638` | 2 | adaptar |
| Peso corporal e tendência | Histórico; sem média móvel; aplicado retroativamente | `lib/bodyweight.ts`, `bodyweight-card.tsx:64-74` | 2 | adaptar |
| Medidas corporais | 13 pontos em cm | `schema.prisma:471-498` | 3 | sim |
| Fotos (domínio) | Data, nota, antes/depois | `photos-card.tsx` | 3 | adaptar |
| Cardio | Duração, distância, FC, track; import TCX/GPX/FIT; meta 150 min | `lib/cardio.ts`, `lib/import/*` | 4 | sim |
| Import Strong/Hevy/CSV | Preview, dedupe, transação; sem mapping manual; RPE descartado; novos viram `OTHER`/`ISOLATION` | `app/api/import/strong/route.ts`, `lib/import/strong-import.ts` | 3 | adaptar |
| Export | JSON, CSV e TCX; backup incompleto (medidas, fotos, `VolumeTarget`, `coachNote`, `track`) | `app/api/backup/route.ts` | 2 | adaptar |
| Abstração de provider de IA | Centralizada, só texto, sem usage, tools nem structured output | `lib/llm/*` | 3 | adaptar |
| Construtor de contexto | `buildCoachPayload` amplo, mas sem disponibilidade, equipamento, aderência e tendências calculadas | `lib/coach.ts:275-476` | 3 | adaptar |
| Busca de exercícios para IA | Ausente (catálogo inteiro no prompt) | `lib/program-generation.ts:28-44` | 1 | não |
| IA retorna `exerciseId` | Ausente (nome livre e `upsert`) | `lib/program-generation.ts:134-147` | 1 | não |
| Validação do plano gerado | Só Zod de faixas | `lib/schemas/program-generation.ts` | 2 | adaptar (schema base) |
| Preview e confirmação | Existe na UI; MCP grava direto | `program-generator.tsx`; `lib/mcp/server.ts:629-647` | 3 | adaptar |
| Ajuste pontual com diff | Ajustes de parâmetros com motivo; sem "antes" completo; não transacional | `coach-adjustments.tsx`, `apply/route.ts` | 2 | adaptar |
| `ProgramRevision` | Ausente | — | 0 | não |
| `AIUsage`, idempotência, fallback, flags | Ausentes | `lib/llm/types.ts:24-27` | 0 | não |
| Prompts versionados | Constantes TS, sem versão | `lib/prompts/*.ts` | 2 | adaptar (conteúdo) |
| MCP server | 22 tools, token pessoal, escrita direta | `lib/mcp/*`, `app/mcp/route.ts` | 3 | adaptar (fase 2) |

## Arquivos de domínio

### Reaproveitáveis (sim ou adaptação leve), com testes
- `lib/gym-loads.ts` (+ teste): snapping a inventário real. É o melhor ativo.
- `lib/intra-set-autoregulation.ts` (+ teste)
- `lib/return-to-training.ts` (+ teste; `lib/return-to-training-history.ts` acessa o DB)
- `lib/progression.ts` (+ teste): base para o nosso motor INCREASE/HOLD/DECREASE/DELOAD/INSUFFICIENT_DATA.
- `lib/stats.ts` (+ teste): trocar UTC por fuso do usuário e acrescentar séries efetivas e músculos secundários.
- `lib/records.ts`, `lib/deload.ts`, `lib/goals.ts`, `lib/loading-table.ts` (+ testes)
- `lib/plates.ts`, `lib/warmup.ts`, `lib/rest-timer.ts`, `lib/supersets.ts`, `lib/set-shorthand.ts`, `lib/units.ts`, `lib/cardio.ts`, `lib/measurement.ts`, `lib/bodyweight.ts` (+ testes)
- `lib/import/strong-csv.ts`, `lib/import/hevy-csv.ts`, `lib/import/strong-import.ts`, `lib/import/gymcoach-csv.ts`, `lib/import/tcx.ts`, `lib/import/gpx.ts`, `lib/import/fit.ts`, `lib/import/track.ts` (+ testes): parsers sólidos; precisam de mapping manual e de preservar RPE.
- `lib/coach-context.ts`; partes de `lib/coach.ts` (a montagem do payload serve de referência para o `TrainingContextBuilder`).
- `lib/llm/openrouter.ts`, `lib/llm/types.ts`: ponto de partida, a reescrever com usage, tools e schema.
- `lib/schemas/*` (Zod de entrada): reaproveitáveis como base.

### Não reaproveitáveis (ou só como referência)
- `lib/sync.ts`, `lib/sync-hydration.ts`, `lib/indexeddb.ts`: o desenho de sync não tem idempotência e tem os bugs O1 a O7. Reescrever com `clientMutationId`, outbox e dedupe no servidor.
- `components/session/session-runner.tsx` (940 linhas, estado de descanso volátil, dois loggers), `components/session/set-input.tsx` e `editable-sets-table.tsx`: só como referência de UX.
- `lib/program-generation.ts`, `lib/prompts/program-system-prompt.ts`, `app/api/programs/generate|build|from-template`: o modelo de nome livre e `upsert` contradiz a spec.
- `app/api/coach/[id]/apply/route.ts`, `lib/coach-adjustments.ts`: sem revisão, sem transação, casa por nome.
- `lib/prompts/coach-system-prompt.ts`, `chat-system-prompt.ts`: o conteúdo serve de inspiração, mas precisa versionamento, pt-BR, regras médicas e remoção de "Cite studies".
- `lib/programs/templates.ts`: o conteúdo é útil; a forma (nomes livres, sem equipamento, exercício repetido) não.
- `lib/mcp/server.ts`: útil como referência para uma fase posterior, mas grava direto e usa nome livre.
- `app/api/backup/route.ts`: incompleto e destrutivo no restore.

## Riscos

1. **Integridade de dados no treino (alto).** Duplicação e perda de séries em cenários comuns: reload ou navegação no meio da sessão (O2), perda de resposta (O1), aba fechada durante o envio (O3) e finalizar com pendências (O4). Para um produto comercial, o sync precisa ser reescrito antes do lançamento.
2. **IA com nome livre (alto).** O caminho atual cria exercícios inventados pelo modelo e fragmenta o histórico. É incompatível com o requisito de `exerciseId` e com o validador. O fluxo de geração precisa ser refeito do zero sobre retrieval mais ids.
3. **Sem versionamento de programa (alto).** Ajustes da IA e trocas na sessão sobrescrevem a prescrição, e excluir um programa desanexa o histórico. Isso inviabiliza auditoria, diff e rollback exigidos pela spec.
4. **Custo e abuso de IA (médio-alto).** O debrief não tem rate limit e usa Opus por padrão; o chat reenvia o histórico inteiro e não aproveita o cache; não há `AIUsage` nem idempotência. Isso dá risco de cobrança duplicada e de custo sem controle.
5. **Métricas enviesadas (médio).** UTC para usuários no Brasil, peso corporal retroativo, Epley sem teto, músculo único sem secundários, drop sets contados como séries de trabalho e PR "ao vivo" que não é PR. Os números mostrados ao usuário e à IA ficam errados.
6. **Progressão rígida (médio).** Incrementos fixos em kg (ruim para LB e para quem não cadastrou inventário), indexação por exercício e não por prescrição (contamina dias pesado e leve), sem DECREASE e sem INSUFFICIENT_DATA.
7. **Privacidade (médio, cruza com a frente de segurança).** O payload enviado ao fornecedor tem nome, sexo, altura, peso e notas livres; o prompt completo é persistido; o token MCP é aceito em query string; as escritas MCP são "confirmadas" pelo próprio agente.
8. **Localização (médio).** Não há pt-BR; o debrief não define idioma; os nomes do catálogo e dos templates estão em inglês e divergem entre si.
9. **Débito de manutenção (baixo-médio).** A orquestração de stall/deload está triplicada, a página de progresso faz N+1 queries e o `session-runner` é monolítico. O repositório é mantido por "loops autônomos" (`CLAUDE.md`, `docs/loops/`), então a autoria e a revisão humana do código precisam ser consideradas na decisão de fork.

### Alegado no README × verificado
- "Offline-first logging": **parcial**. Vale só para séries numa sessão já aberta, sem idempotência e com os riscos O1 a O7 (README `:56`, `:262`).
- "Double-progression suggestions ... (and explained)": **verdadeiro**, mas o caminho de um toque da tabela não aplica a sugestão (README `:124-126`).
- "Fix a set ... offline included": **verdadeiro** enquanto a sessão está aberta; depois de finalizada a correção é recusada (README `:129-131`).
- "Full export, nothing paywalled": **falso para "full"**. O backup omite medidas, fotos, `VolumeTarget`, `coachNote` e `track` (README `:57`).
- "Validated with Zod before anything touches your program": **verdadeiro só como validação de faixas**; não há validação de domínio (README `:269-271`).
- "multi-turn chats reuse [the cached prompt]": **não se sustenta** para o chat, porque o payload com timestamp vai junto no `system` (README `:272`).
- "Every [MCP] write asks for confirmation": **depende do agente externo**, já que é um literal `confirmed: true` (README `:230`).
