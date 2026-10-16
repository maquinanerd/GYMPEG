# Base de conhecimento da IA

A base de conhecimento é a fonte de evidência científica do coach do GYM Peg. Ela existe para a IA não inventar números, estudos nem recomendações: toda afirmação de ciência do treino que o coach faz deve vir de uma ficha desta base ou dos dados do próprio usuário.

## O que entra na base

- **Fichas de conhecimento** (`lib/knowledge/cards/*.json`; 141 fichas na primeira versão, de 2026-10-14). Cada ficha responde a uma pergunta de treino, em pt-BR e com texto nosso: o que a evidência mostra, números e faixas quando fazem sentido, força da evidência (`strong`, `moderate`, `limited`), recomendações práticas e as fontes.
- **Fontes**: só meta-análises, revisões sistemáticas, ensaios bem desenhados, posicionamentos (ACSM, NSCA, ISSN, ACOG) e diretrizes oficiais (OMS). Cada DOI foi conferido no Crossref (`https://api.crossref.org/works/<doi>`). Se a fonte não foi confirmada, a ficha não entrou.
- **O que não entra**: texto copiado de artigos, matérias ou livros, e transcrições de vídeos do YouTube. Isso é direito autoral de terceiros, e o GYM Peg é um produto comercial. Fatos científicos não têm dono: escrevemos a síntese com nossas palavras e citamos a fonte. Os bons canais de divulgação citam os mesmos estudos primários que estão aqui.

| Arquivo                     | Prefixo | Assunto                                                                                                                                      |
| --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `training-variables.json`   | `tv-`   | volume, frequência, carga, falha, descanso, cadência, amplitude, técnicas avançadas                                                          |
| `progression-recovery.json` | `pr-`   | progressão, periodização, RIR/RPE, 1RM estimado, platô, deload, destreino, sono, recuperação, aquecimento                                    |
| `exercise-selection.json`   | `ex-`   | escolha de exercícios por músculo, máquina × peso livre, comprimento muscular, técnica e segurança                                           |
| `populations-health.json`   | `ph-`   | iniciantes, mulheres, idosos, jovens, gestação, hipertensão, diabetes, ossos, dor lombar, dor e lesão, treino concorrente, diretrizes da OMS |
| `nutrition.json`            | `nu-`   | proteína, superávit, déficit, recomposição, creatina, cafeína e outros suplementos                                                           |
| `myths.json`                | `my-`   | mitos comuns de academia e o que a evidência diz                                                                                             |

## Como a IA usa a base

1. A cada mensagem do chat, `chatKnowledgeQuery` (`lib/chat.ts`) junta a última pergunta do usuário (com peso dobrado) e a anterior.
2. `findKnowledge` (`lib/knowledge/index.ts`) busca as fichas mais relevantes com BM25 (`lib/knowledge/retrieve.ts`). A busca é determinística, roda em memória, ignora acentos e plurais, dá mais peso a título e palavras-chave e dá um bônus para expressões de várias palavras ("dor nas costas"). Pergunta fora do tema ("que IA você é?") não traz ficha nenhuma.
3. `formatKnowledgeSection` (`lib/knowledge/format.ts`) monta a seção "Knowledge cards" do prompt com as regras de citação: citar no formato curto (Autor et al., ano), citar só fontes das fichas, nunca inventar estudo ou número, dizer quando não há fonte curada, e encaminhar dor, lesão, doença, gestação e remédio para um profissional.
4. A análise semanal (`callCoach` em `lib/coach.ts`) usa as mesmas fichas, buscadas pelos temas fixos do debrief (progressão, platô, deload, volume, RIR) mais o objetivo e a nota do usuário.

O prompt do chat (`buildChatSystemPrompt` em `lib/prompts/chat-system-prompt.ts`) segue a ordem que aproveita o cache da DeepSeek. A parte do começo que se repete idêntica entre as mensagens custa cerca de 50 vezes menos. A ordem é:

1. o texto fixo, igual para todo usuário;
2. "About this assistant", com o modelo em uso e a data de hoje, que só muda uma vez por dia;
3. os dados do usuário em JSON compacto, sem o `generatedAt`, porque um horário mudaria o começo do prompt a cada requisição; o treino em andamento (`currentSession`) vai por último dentro do JSON;
4. as fichas da pergunta, a única parte que muda a cada mensagem.

O chat pede a resposta sem raciocínio interno (`reasoning: 'off'`, que na DeepSeek vira `thinking: { type: "disabled" }`). Medido em 2026-10-16 com o `deepseek-flash`:

- a primeira palavra aparece em ~1 s em vez de ~2 s;
- a resposta completa chega em ~4 s em vez de ~10 s;
- cada mensagem custa de 27% a 36% menos;
- as respostas continuaram usando os números do usuário e citando só as fichas.

A análise semanal e o gerador de treino continuam com o raciocínio ligado.

## O que a IA sabe do usuário

Além do que já ia no payload do coach (perfil, semana atual e anterior, programa ativo, progressão de 8 semanas, recordes, metas e sinais de fadiga), o chat recebe `trainingHistory` (`buildTrainingHistoryContext` em `lib/coach.ts`):

- total de sessões e datas da primeira e da última;
- dias treinados por semana nas últimas 12 semanas (`trainingConsistency`, a mesma conta da página de progresso);
- até 5 programas salvos, o ativo primeiro, com treinos, exercícios e metas;
- as últimas 20 sessões (até 120 dias), série a série em texto compacto (`80 kg x 8 @RIR 2`).

Todos os números vêm do domínio (`lib/`), nunca do modelo.

## Como acrescentar ou corrigir uma ficha

1. Edite o arquivo do assunto em `lib/knowledge/cards/`, mantendo o prefixo do arquivo no `id`.
2. Escreva o resumo com suas palavras (60 a 180 palavras), sem citação literal longa.
3. Confira cada DOI no Crossref antes de salvar.
4. Rode `npx vitest run lib/knowledge`: o teste valida o formato, ids únicos, citações curtas e se as perguntas típicas ainda acham a ficha certa.

## Limites conhecidos

- A busca é lexical: sinônimos que não estão nas palavras-chave não casam. Quando uma pergunta real não achar a ficha certa, acrescente o termo em `keywords`.
- A base cobre o que as fichas cobrem. Fora disso o coach deve dizer que não tem fonte curada e ficar no conservador.
- Revisar a base uma vez por ano, ou quando sair meta-análise grande sobre um tema.
