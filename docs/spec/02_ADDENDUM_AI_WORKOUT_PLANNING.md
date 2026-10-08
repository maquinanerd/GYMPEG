# Adendo 02 — IA para criação e adaptação dos treinos

> Recebido em 2026-10-08. Complementa e atualiza `00_MASTER_SPEC.md` (seções 10, 30-32, 64). Em caso de conflito sobre providers de IA, este adendo prevalece.

Camada de IA que monta e adapta programas usando **exclusivamente os exercícios cadastrados no nosso sistema**. A IA analisa os dados do usuário, consulta o banco de exercícios e devolve um treino estruturado. Ela **não** gera nomes de exercícios em texto livre.

```
PERFIL + HISTÓRICO + OBJETIVO + EQUIPAMENTOS + EXERCÍCIOS EXISTENTES
        ↓
        IA
        ↓
PROGRAMA ESTRUTURADO → VALIDAÇÃO DO BACKEND → PREVIEW → SALVAR
```

## 1. Provider de IA

Arquitetura desacoplada:

```ts
interface AIProvider {
  generateWorkoutPlan(input: WorkoutGenerationInput): Promise<WorkoutGenerationResult>
  adjustWorkoutPlan(input: WorkoutAdjustmentInput): Promise<WorkoutGenerationResult>
}
```

Implementações: `GeminiProvider`, `DeepSeekProvider`. Inicial recomendado: **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`). Alternativa: **DeepSeek Flash** (`deepseek-flash`). *(IDs de modelo a confirmar na documentação oficial dos fornecedores antes da implementação.)*

```
AI_PROVIDER=gemini
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.5-flash-lite
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-flash
```

Nenhuma chamada Gemini/DeepSeek espalhada pelo código: tudo passa por `AIProvider`.

## 2. Dados no onboarding

- **Básicos:** sexo (opcional), idade ou data de nascimento (opcional), altura, peso atual, unidade de peso, experiência.
- **Objetivo:** hipertrofia, ganho de força, recomposição corporal, emagrecimento com preservação muscular, condicionamento, manutenção, retorno aos treinos.
- **Experiência:** `BEGINNER | INTERMEDIATE | ADVANCED` — não confiar só na autodeclaração; inferir parcialmente pelo histórico depois.

## 3. Disponibilidade

Dias por semana (2-7), quais dias, tempo por treino, horário preferido (opcional). A IA respeita: não gera programa de 90 min para quem informou 45.

## 4. Academia e equipamentos

A IA conhece os equipamentos disponíveis (ex.: `{"gym":"Academia principal","equipment":["BARBELL","DUMBBELL","BENCH","SMITH_MACHINE","CABLE","LEG_PRESS","LEG_EXTENSION","LEG_CURL"]}`) e **não pode** selecionar equipamento indisponível.

## 5. Preferências

Exercícios preferidos, que não gosta, músculos prioritários, exercícios a manter, exercícios a evitar. Ex.: Prioridade peitoral e ombros; prefere supino com halteres; não gosta de terra convencional.

## 6. Restrições

Usuário marca limitações (evitar exercício X, evitar movimento Y). A aplicação **não diagnostica** doenças ou lesões. Com limitações importantes, a IA age conservadoramente e deixa claro que está apenas adaptando com base no que o usuário informou.

## 7. Histórico

Com histórico, a IA recebe: treinos recentes, exercícios usados, cargas, reps, RIR, RPE, volume, PRs, frequência, faltas, progressões, stalls, duração média, substituições frequentes. Sem histórico bruto inteiro: **`TrainingContextBuilder`** transforma histórico em contexto compacto.

## 8. Contexto para a IA (exemplo)

```json
{
  "profile": { "heightCm": 178, "weightKg": 82.4, "experience": "INTERMEDIATE", "goal": "HYPERTROPHY" },
  "availability": { "sessionsPerWeek": 4, "sessionDurationMinutes": 60 },
  "priorities": ["CHEST", "DELTOIDS"],
  "equipment": ["BARBELL", "DUMBBELL", "CABLE", "MACHINE"],
  "recentTraining": { "sessionsLast30Days": 15, "adherence": 0.88 }
}
```

## 9. Não mandar o catálogo inteiro

Não enviar 800 exercícios por request (tokens, custo, latência). Seleção de candidatos:

```
UserProfile → objetivo → split candidato → músculos do dia → equipamentos disponíveis
→ busca no banco → 50-100 candidatos → IA escolhe
```

## 10. Exercise retrieval

`ExerciseRetrievalService.findExercises({ muscles, equipment, movementPatterns, difficulty, excludedExercises, limit })`. A IA trabalha sobre esses resultados.

## 11. Tool calling

Preferencialmente a IA consulta via tool `searchExercises()`:

```json
// entrada
{ "primaryMuscle": "PECTORAL", "equipment": ["BARBELL","DUMBBELL"], "movementPattern": "HORIZONTAL_PUSH", "limit": 20 }
// resposta
[
  { "id": "ex_0192", "name": "Supino reto com barra", "primaryMuscles": ["PECTORAL"], "secondaryMuscles": ["TRICEPS","ANTERIOR_DELTOID"], "equipment": ["BARBELL","BENCH"] },
  { "id": "ex_0193", "name": "Supino reto com halteres", "primaryMuscles": ["PECTORAL"], "secondaryMuscles": ["TRICEPS","ANTERIOR_DELTOID"], "equipment": ["DUMBBELL","BENCH"] }
]
```

A IA escolhe um dos IDs retornados.

## 12. Regra crítica

Nunca `{ "exercise": "Supino mágico inclinado" }`. Sempre `{ "exerciseId": "ex_0193" }`. O exercício precisa existir.

## 13. Structured output

Toda geração usa JSON/schema estruturado com Zod; nunca interpretar texto livre.

```ts
const GeneratedWorkoutPlanSchema = z.object({
  title: z.string(),
  rationale: z.string(),
  daysPerWeek: z.number().int().min(1).max(7),
  workouts: z.array(z.object({
    name: z.string(),
    estimatedDurationMinutes: z.number(),
    exercises: z.array(z.object({
      exerciseId: z.string(),
      order: z.number(),
      sets: z.number(),
      repMin: z.number(),
      repMax: z.number(),
      targetRir: z.number().nullable(),
      targetRpe: z.number().nullable(),
      restSeconds: z.number(),
      notes: z.string().optional(),
    })),
  })),
})
```

## 14. Exemplo de resposta

```json
{
  "title": "Hipertrofia Upper/Lower 4x",
  "rationale": "Programa de quatro sessões semanais priorizando peitoral e deltoides dentro do limite de 60 minutos.",
  "daysPerWeek": 4,
  "workouts": [{
    "name": "Upper A",
    "estimatedDurationMinutes": 58,
    "exercises": [
      { "exerciseId": "ex_bench_press", "order": 1, "sets": 3, "repMin": 6, "repMax": 8, "targetRir": 2, "targetRpe": null, "restSeconds": 180 },
      { "exerciseId": "ex_lat_pulldown", "order": 2, "sets": 3, "repMin": 8, "repMax": 12, "targetRir": 2, "targetRpe": null, "restSeconds": 120 }
    ]
  }]
}
```

## 15. Backend validator

Nunca salvar direto o resultado da IA. **`WorkoutPlanValidator`** verifica:
- **Exercícios:** exerciseId existe? ativo? equipamentos existem na academia? usuário não bloqueou?
- **Programa:** nº correto de dias? duração compatível? duplicados indevidos? séries absurdas? grupos principais contemplados? frequência adequada? combinações obviamente inválidas?
- **Valores:** limites de sets, reps, RIR, RPE, descanso, duração.

## 16. Fluxo obrigatório

```
AI GENERATE → JSON SCHEMA VALIDATION → DOMAIN VALIDATION → EXERCISE ID VALIDATION
→ PROGRAM ANALYSIS → PREVIEW → USER CONFIRMS → SAVE
```

Nunca `IA → banco`.

## 17. Preview

```
Seu treino sugerido
SEGUNDA — Upper A — 58 min
  Supino reto 3 × 6-8
  Puxada alta 3 × 8-12
TERÇA — Lower A …
QUINTA — Upper B …
SEXTA — Lower B …
```

Usuário pode: aceitar, regenerar, trocar exercício, mudar dias, mudar duração, informar preferência, pedir ajustes.

## 18. Conversa com a IA — "Ajustar meu treino"

Ex.: "Não gostei desse exercício." "Quero treinar peito duas vezes." "Tenho apenas 45 minutos terça-feira." "Troque o agachamento." "Quero mais prioridade para ombro." "Minha academia não tem essa máquina." A IA gera uma **revisão** do plano.

## 19. Nunca alterar sem permissão

```
ALTERAÇÃO PROPOSTA
Antes:  Leg Press 4 × 10
Depois: Agachamento Smith 3 × 8-10
Motivo: …
[ACEITAR] [CANCELAR]
```

Só salva depois do aceite.

## 20. Versionamento

`Program → ProgramRevision` (v1 gerado; v2 prioridade em peitoral; v3 ajuste após 4 semanas). Nunca destruir versões anteriores.

## 21. Aprender com o histórico

Contexto semanal, ex.: Planejado 4 / Realizado 3; Lower B pulado 3 semanas seguidas; duração prevista 70 min vs média real 52 min. Sugestão: "Seu treino de sexta frequentemente não é realizado. Posso redistribuir esse volume para os outros três dias."

## 22. Peso corporal

Tendência, não só último valor: `{ "currentWeight": 81.8, "weeklyAverage": 82.1, "change30Days": -1.4 }`.

## 23. Performance

Tendências calculadas pelo backend: `{ "benchPress": { "e1RM30DaysAgo": 84, "currentE1RM": 91, "changePercent": 8.33 } }`. A IA interpreta; o backend calcula.

## 24. Divisão de responsabilidade

- **Backend:** matemática, estatísticas, histórico, e1RM, volume, progressão, PR, tendências, catálogo, validação.
- **IA:** raciocinar sobre os dados, selecionar exercícios, estruturar programa, explicar escolhas, propor mudanças, responder ao usuário.

## 25. Prompt de sistema versionado

Salvar em `/prompts/workout-planner/v1.md`. Conteúdo conceitual: a IA é o motor de planejamento; usa exclusivamente exercícios fornecidos por ferramentas/catálogo; nunca inventa exerciseId nem exercícios; respeita disponibilidade, equipamentos, experiência, objetivo, duração, preferências, excluídos e histórico; prioriza programas simples, executáveis e progressivos; não faz diagnóstico médico; toda criação/alteração obedece ao JSON schema da aplicação.

## 26. Geração inicial (onboarding)

Perguntas: objetivo, peso, altura, experiência, dias, tempo por treino, onde treina, equipamentos, músculos prioritários, exercícios a evitar → botão **[ MONTAR MEU TREINO COM IA ]**.

## 27. Loading

Etapas visíveis: "Analisando seu perfil… Selecionando exercícios… Distribuindo o volume… Montando os treinos… Validando o programa…". Sem spinner infinito.

## 28. Resultado visual

```
SEU PROGRAMA
Upper / Lower · 4 dias por semana · ≈ 55 min por sessão
Foco: Hipertrofia · Prioridades: Peitoral, Ombros
SEGUNDA — UPPER A
[imagem] Supino reto 3 × 6-8 · RIR 2 · Descanso 3 min
[imagem] Remada baixa 3 × 8-10 · RIR 2
[ COMEÇAR PROGRAMA ]
```

Imagens vêm de `ExerciseMedia`, **não da IA**.

## 29. Relação IA + imagens

`exerciseId → Exercise → ExerciseMedia → imagem/animação/vídeo`. A IA nunca gera imagens; apenas seleciona exercícios existentes.

## 30. Ajuste automático futuro

```
Workout completed → Training Analytics → TrainingContextBuilder → AI review → Recommendation
```

Ex.: "Você completou o topo da faixa no supino nas duas últimas sessões. Sugestão: 70 → 72,5 kg." A progressão de carga vem preferencialmente do **motor determinístico**; a IA explica e pode usá-la para reorganizar o programa.

## 31. Reavaliação

"Reavaliar meu treino" a cada 4, 6 ou 8 semanas, ou manual. A IA recebe o desempenho do ciclo e sugere: manter, trocar exercícios, alterar volume, mudar divisão, redistribuir músculos, iniciar novo mesociclo.

## 32. Não regenerar tudo sem motivo

"Não gostei da extensora" → analisar alternativas para extensora → trocar só aquele exercício → preservar o resto. Nunca criar um programa completamente diferente.

## 33. Custo da IA — `AIUsage`

Campos: id, userId, provider, model, operation, inputTokens, outputTokens, latencyMs, estimatedCost, success, createdAt. Operações: `GENERATE_PROGRAM | ADJUST_PROGRAM | WEEKLY_REVIEW | EXPLAIN_RECOMMENDATION | CHAT`. Base para decidir Gemini vs DeepSeek por custo real.

## 34. Cache

Não chamar IA sem necessidade. Retry com os mesmos dados em poucos segundos → **idempotency key**, sem cobrança duplicada.

## 35. Fallback

`Gemini → erro → retry controlado → erro → DeepSeek` (ou inverso, configurável). Nunca executar dois modelos simultaneamente para toda solicitação.

## 36. Feature flags

`ai.workout_generation`, `ai.workout_adjustment`, `ai.weekly_review`, `ai.chat`.

## 37. Objetivo final

```
PESO, ALTURA, OBJETIVO, EXPERIÊNCIA, DISPONIBILIDADE, EQUIPAMENTOS, PREFERÊNCIAS, HISTÓRICO
→ IA → CATÁLOGO REAL DE EXERCÍCIOS → TREINO PERSONALIZADO → VALIDAÇÃO
→ USUÁRIO TREINA → HISTÓRICO REAL → PRÓXIMA ADAPTAÇÃO
```

A IA não é só um chatbot: em conjunto com os algoritmos determinísticos, transforma dados reais de treino em programa individualizado e adaptável.
