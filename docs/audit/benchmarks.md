# Benchmark de projetos de referência (estudo de conceito; proibido copiar)

> Fase 0 / Gate G0, frente "benchmarks". Análise apenas estática dos clones rasos em `_audit/repos/`. Nada foi instalado, executado ou modificado.
>
> **Como ler as marcas de evidência**
> - **[V]**: conferi no código, em `repo/caminho:linha`.
> - **[V\*]**: veio de uma varredura auxiliar estática e foi conferido só por amostragem.
> - **[R]**: é alegação de README ou docs, sem verificação no código.
>
> Todo o texto abaixo descreve conceitos com palavras próprias. Os blocos de pseudocódigo foram escritos por nós.
>
> Último commit de cada clone (`git log -1`): wger 2026-10-08, liftosaur 2026-10-07, openGym 2026-10-08, granite 2026-09-10, forge 2026-09-13. Todos são clones com um único commit, então não dá para avaliar histórico.

## Tabela-resumo

| Projeto | Licença verificada | Stack | Maturidade | Uso permitido para nós |
|---|---|---|---|---|
| **wger** | Código: AGPL-3.0 [V] (`wger/LICENSE.txt:1-2`, cabeçalhos em ~490 .py [V\*]). Dados: licença por linha, com padrão CC-BY-SA 4 [V] (`wger/wger/utils/models.py:70`). Fixtures de exercícios são majoritariamente CC-BY-SA 3/4 e parte CC0. Ingredientes ODbL/CC0 [V\*] | Python, Django 6, DRF, PostgreSQL + PowerSync; apps Flutter e React à parte | **Alta**: desde 2013, ~160 arquivos de teste, 37 locales, CI em 3 versões de Python | Só estudo de conceito. Dados importáveis apenas com atribuição TASL e *share-alike*, e só após parecer jurídico |
| **liftosaur** | AGPL-3.0 [V] (`liftosaur/LICENSE:1-2`, texto FSF padrão). Ilustrações de exercício compradas da Gym visual e hospedadas fora do repo [V] (`liftosaur/src/imageExtractorGymVisual.ts:11-16`) | TypeScript; web, iOS, Android e relógio; Lambda/AWS | **Alta**: desde 2020, CHANGELOG com 1.807 linhas | Só estudo de conceito. Nenhum código, nenhuma gramática, nenhum texto de exercício |
| **openGym** | Código: AGPL-3.0-or-later [V] (`openGym/LICENSE:1-2`, `openGym/api/package.json:7`), com exceção extra para lojas de apps (`openGym/NOTICE.md:6-13`). Mídia de exercícios com titularidade **não resolvida** [V] (`openGym/NOTICE.md:92-117`) | React 19 + Vite + Capacitor; API em Node puro, sem banco (arquivos JSON por usuário); MCP somente leitura | **Baixa e instável**: v1.0 em 2026-07-20, v1.3.10 em 2026-10-07, 33 versões em ~11 semanas. Código declaradamente gerado em grande parte por IA (`openGym/README.md:304-307`) | Só estudo de UX. Mídia, dados e traduções pt-BR proibidos |
| **granite** | AGPL-3.0 [V] (`granite/LICENSE:1-2`). CLA dá ao mantenedor direito de relicenciar (`granite/CLA.md:8-12`), mas o texto ainda tem TODO de revisão jurídica (`:25-26`) | Go (chi + huma/OpenAPI) + SQLite; SvelteKit SPA estática como PWA; IndexedDB; MCP em Node via stdio | **Baixa**: criado 2026-06, versões 0.0.x. Bons testes de sync (Go + Playwright offline) [V\*] | Só estudo do desenho offline-first |
| **forge** | **Sem licença** [V]: nenhum LICENSE/COPYING. O JSON-LD do site declara AGPL (`forge/website/src/layouts/BaseLayout.astro:58`), mas isso não é concessão de licença. Tratar como todos os direitos reservados | FastAPI + SQLAlchemy + SQLite; React 19 + Recharts; app iOS nativo em SwiftUI | **Baixa a média**: projeto pessoal, ~151 testes de backend [V\*], sem testes de frontend | **Nenhum** uso de código ou ativos. Apenas observação de UX descrita com palavras próprias |

---

## 1. liftosaur: motor de progressão e linguagem de programas

### 1.1 Licença e ativos
- **Código sob AGPL-3.0** [V] (`liftosaur/LICENSE:1-2`).
- **Ilustrações dos exercícios:** são compradas de um fornecedor comercial (gymvisual.com), recortadas por script e enviadas a um bucket S3. Elas não ficam no repositório [V] (`liftosaur/src/imageExtractorGymVisual.ts:11-16`; também o doc interno `liftosaur/.claude/skills/add-exercise/SKILL.md:24` [R]).
- **Lição para nós:** mídia de exercício de qualidade é **licenciada comercialmente**, não coletada da internet.
- **Catálogo:** 218 exercícios-base (`liftosaur/src/models/exercise.ts:47-2016`), cada um combinável com equipamentos. Os metadados trazem músculos-alvo e sinergistas e partes do corpo (`exercise.ts:2017+`). Há 374 arquivos de descrição em `liftosaur/exercises/`. **Tudo isso é AGPL. Não reutilizar.**

### 1.2 Como um programa é expresso
- **O programa é texto.** O objeto persistido guarda semanas → dias → um bloco de texto com os exercícios do dia [V] (`liftosaur/src/types.ts:1147-1191`: `IPlannerProgram.weeks[].days[].exerciseText`).
  - Esse texto é a **fonte da verdade**. Uma etapa de avaliação o converte em estrutura (`liftosaur/src/models/program.ts:928`).
- **Gramática** própria, em Lezer (`liftosaur/src/pages/planner/plannerExercise.grammar`):
  - **Semanas e dias:** `#` abre uma semana e `##` abre um dia (`:70-71`).
  - **Uma linha por exercício:** nome (com equipamento opcional), depois seções separadas por `/` (`:5`, `:74`). As seções podem ser:
    - conjuntos de séries, como `3x8`, `3x8-12`, `1x5, 1x3, 1x1`;
    - AMRAP, marcado com `+` após as repetições;
    - carga absoluta em kg/lb ou percentual de 1RM;
    - RPE alvo `@8`, com `+` após o RPE para pedir o registro;
    - descanso em segundos e rótulo da série (`:16`, `:42-48`);
    - `?+`, que pede o peso ao usuário (`:61`);
    - propriedades `nome: valor`, como `warmup:`, `progress:`, `update:` e `used: none` (`:19`);
    - `superset: X` (`:18`);
    - reuso de outra linha com `...Agachamento` (`:15`).
  - **Variações de esquema:** várias alternativas de séries separadas por `/`, com `!` marcando a atual (`:23`; doc em `liftosaur/llms/liftoscript.md:1077-1100`). Isso modela, por exemplo, a troca de 5x3 → 6x2 → 10x1 do GZCLP após falha.
  - **Repetição semanal:** `Agachamento[1-4]` repete a linha nas semanas 1 a 4 (`grammar:26`; doc em `liftoscript.md:507`).
- **Linguagem de script** embutida para progressão customizada, entre `{~ ~}` (`liftosaur/liftoscript.grammar:1-95`). Tem:
  - aritmética com unidades (`5lb`, `2.5kg`, `%`);
  - `if`/`else`, `for (var.i in arr)` e ternário;
  - variáveis de estado `state.x` e temporárias `var.x`;
  - funções embutidas: arredondar ao equipamento, calcular 1RM, `sum`/`min`/`max`, incrementar ou decrementar ao próximo peso possível (`liftosaur/src/models/progress.ts:290-340`).

### 1.3 Duas fases de execução
| Fase | Quando roda | O que pode alterar | Evidência |
|---|---|---|---|
| **update** | No início do treino e após **cada série concluída** | Só as séries restantes da sessão atual (autorregulação intra-sessão) | `liftosaur/src/models/progress.ts:875-925` |
| **progress** | Ao **finalizar** o treino, para cada exercício do programa com ao menos uma série concluída | A prescrição **futura** no programa, além do estado do exercício | `liftosaur/src/models/program.ts:650-715` |

**Entrada do script ("bindings")** [V] (`liftosaur/src/models/progress.ts:197-288`):
- **Arrays por série:** prescrição (peso, reps máx/mín, RPE, timer) e realizado (reps, peso, RPE, concluída, tempo).
- **Escalares:** dia, semana, dia da semana, número de séries prescritas, feitas e concluídas, peso corporal (média móvel), 1RM do exercício e índices das variações ativas.

**Semântica que importa reimplementar** [V]:
- **Comparar arrays é "para todas as posições".** `completedReps >= reps` só é verdadeiro se **cada** série atingir o alvo, com valores ausentes tratados como 0 (`liftosaur/src/liftoscriptEvaluator.ts:135-141`).
- **Escrever em `weights`, `reps`, `RPE`, `timers`, `numberOfSets` ou nos índices de variação gera uma lista de "atualizações".**
  - Cada atualização tem um **alvo endereçável** `[semana:dia:variação:série]`, com curinga `*` (`liftoscriptEvaluator.ts:155-174`).
  - Elas são aplicadas a **todas as ocorrências daquele exercício no programa** que casam com o alvo (`liftosaur/src/models/programExercise.ts:145-230`).
- **O estado é um dicionário por exercício** de números, pesos ou percentuais (`liftosaur/src/types.ts:527-528`).
  - Um script pode **escrever** no estado de outro exercício (por tag), mas **não pode ler** (`liftoscriptEvaluator.ts:1329`).
  - Variáveis marcadas com `+` são pedidas ao usuário ao finalizar (`liftosaur/src/models/programToPlanner.ts:888-897`).

**Onde o estado de progressão é guardado** [V]: no próprio texto do programa.
- Depois de rodar os scripts, o programa avaliado (já com pesos novos e estado novo) é **serializado de volta para texto**, e o ponteiro do próximo dia avança (`liftosaur/src/models/program.ts:704-712`).
- Exemplo: `progress: lp(5lb, 3, 1, 10lb, 2, 0)` carrega incremento, sucessos exigidos, contador de sucessos, decremento, falhas toleradas e contador de falhas (`programToPlanner.ts:902-926`).
- Cada registro de histórico guarda um **snapshot do diff** de estado e variáveis aplicado naquela sessão. É uma trilha de auditoria (`liftosaur/src/types.ts:530-545`, gerado em `liftosaur/src/models/history.ts:152-166`).

### 1.4 Progressões embutidas
Definidas em `liftosaur/src/pages/planner/models/plannerProgramExercise.ts:593-790`.

**Regra transversal: o próximo peso parte do peso realizado, não do prescrito.**
- O ajuste é `alvo += (realizado − alvo) + incremento`.
- Se o programa não tinha peso (0) e o usuário informou um, esse peso é adotado como base.

**Linear (`lp`)** (`:680-729`)
- **Estado:** incremento, sucessos exigidos (padrão 1), contador de sucessos, decremento, falhas toleradas (padrão 1 se houver decremento) e contador de falhas.
- **Sucesso:** todas as séries com reps ≥ alvo **e** RPE ≤ alvo.
- **Falha:** não atingiu reps mínimas ou excedeu o RPE.

```
// pseudocódigo nosso
se sucesso:
    sucessos += 1
    se sucessos >= exigidos: peso_alvo = peso_realizado + incremento; zera ambos os contadores
se decremento > 0 e falha:
    falhas += 1
    se falhas >= toleradas: peso_alvo -= decremento; zera ambos os contadores
```

**Dupla progressão (`dp`)**
- **Parâmetros:** incremento, reps mínimas e reps máximas (`:731-746`; regra em `:608-633`).
- **Se todas as séries atingirem o alvo dentro do RPE:**
  - com reps ≥ máximo: as reps voltam ao mínimo e o peso sobe pelo incremento;
  - caso contrário: as reps de cada série passam a ser o mínimo entre (realizadas + 1) e o máximo.
- Não há deload embutido. Existe também uma variante com faixa de reps em `:635-657`.

**Soma de reps (`sum`)** (`:749-772`)
- Se a soma das reps feitas atingir o limiar, peso = realizado + incremento.

**Custom**
- Estado e script livres, reaproveitáveis entre exercícios com `{ ...Outro }`.
- Os argumentos padrão de cada tipo estão em `:593-606`.

**Detalhes que pegam desprevenido** [V]:
- **As progressões embutidas não têm motor próprio.** Na leitura do programa, elas viram scripts da linguagem genérica (`plannerProgramExercise.ts:661-799`). Um único avaliador cobre todos os casos.
- **Incremento percentual é sobre o 1RM, não sobre o peso atual.** Somar `X%` a um peso adiciona X% do 1RM do exercício (`liftosaur/src/models/weight.ts:636-647`). No nosso motor, a semântica do incremento em percentual precisa ser explícita.
- **Erro de script não bloqueia o fim do treino.** Só gera um alerta (`program.ts:700-707`).
- **Cada exercício tem uma única regra de progressão no programa inteiro.** Declarações conflitantes são erro [V\*] (`liftosaur/src/pages/planner/plannerEvaluator.ts:109-120`).
- **Não há RIR**, só RPE [V\*].
- **Programas prontos:** o repo traz 60 programas embutidos em Markdown (`liftosaur/programs/builtin/`). São conteúdo AGPL e não devem ser reutilizados.

### 1.5 Deload, RPE e 1RM
- **Deload** pode ser expresso de três formas:
  - pelo decremento após N falhas da `lp`;
  - por semanas com prescrição própria e `progress: none`, que desliga a progressão naquela semana (`liftosaur/llms/liftoscript.md:288-302`) [R];
  - por troca de variação de esquema após falha.
- **RPE**
  - Se a série tem RPE alvo mas não tem peso, o peso é **inferido** de uma tabela RPE × reps aplicada ao 1RM (`liftoscript.md:37-50`) [R].
  - O multiplicador é uma curva aproximada em duas partes, citada como vinda da calculadora de RPE do OpenPowerlifting (`liftosaur/src/models/weight.ts:704-728`).
  - e1RM = peso ÷ multiplicador(reps, RPE) (`weight.ts:244-252`).
  - Training max = 90% do e1RM (`weight.ts:264-266`).
  - **A documentação diz que o 1RM usa Epley** (`liftosaur/src/docs/content/docs.md:271`), **mas o código usa essa curva de RPE** [V]. Para nós: escolher e documentar uma fórmula própria (Epley ou Brzycki são de domínio público) e, se quisermos uma tabela de RPE, derivá-la de fonte com licença clara.
- **Arredondamento ao equipamento**
  - Cada equipamento tem: barra (lb/kg), inventário de anilhas, multiplicador (por exemplo, 2 lados), lista de pesos fixos (halteres) e unidade (`liftosaur/src/types.ts:1435-1449`).
  - "Incrementar" significa ir ao **próximo peso montável**, não somar um valor fixo (`weight.ts:183-215`).

### 1.6 Sincronização entre dispositivos
- **Relógio vetorial por campo** (`{dispositivo: contador}` + timestamp).
- **Coleções** guardam itens versionados, tombstones de exclusão e um marcador de compactação (`liftosaur/src/models/versionTracker/types.ts:1-29`).
- **Comparação** (`versionTracker/utils.ts:110-161`): resulta em mais novo, mais velho, igual ou concorrente.
- **Escritas concorrentes:** o desempate é pelo timestamp (`utils.ts:258-266`).

### 1.7 IA
- Há documentação da linguagem escrita para LLMs (`liftosaur/llms/liftoscript_llm.md`, `program_design.md`) [R].
- **A linguagem textual funciona como a interface para a IA gerar programas, e o parser determinístico os valida.** Esse é exatamente o papel que queremos para a nossa IA opcional.

---

## 2. wger: modelo de dados, API, multiusuário, i18n e base colaborativa

### 2.1 Licenciamento do conteúdo
- **Licença por linha (padrão TASL).** Um mixin abstrato adiciona a cada linha [V] (`wger/wger/utils/models.py:53-149`):
  - a licença, por FK (padrão CC-BY-SA 4);
  - título;
  - URL do objeto;
  - autor e URL do autor;
  - URL da obra de origem, para derivadas;
  - um método que monta a frase de atribuição.
- **Modelos que usam o mixin:** Exercise, Translation, ExerciseImage, ExerciseVideo e Ingredient [V] (`wger/wger/exercises/models/base.py:90`, `translation.py:44`, `image.py:46`, `video.py:95`).
- **Licenças cadastradas:** CC-BY-SA 3, CC-BY-SA 4, CC0 (Public Domain 1.0), CC-BY 4 e ODbL [V] (`wger/wger/core/fixtures/licenses.json:6-44`).
- **Fixtures de exercícios:**
  - 719 bases sob CC-BY-SA 4 [V] (`wger/wger/exercises/fixtures/exercise-base-data.json`);
  - o resto se divide entre CC-BY-SA 3 e CC0 [V\*].
- **Ingredientes:**
  - Open Food Facts como ODbL e USDA como CC0;
  - imagens do OFF como CC-BY-SA 3 [V\*] (`wger/wger/nutrition/extract_info/off.py:213-216`, `usda.py:118`).
- **Imagens geradas por IA:** são sinalizadas por um campo próprio, junto com o estilo (linha, 3D, foto…) [V] (`wger/wger/exercises/models/image.py:111-124`).
- **README:** código AGPL, dados Creative Commons por entrada, docs CC-BY-SA 4 [R] (`wger/README.md:98-101`).

### 2.2 Rotinas: programa → dias → slots → exercício → séries
Hierarquia [V]:
- **Routine** (`wger/wger/manager/models/routine.py:59-130`): dono, datas de início e fim, flags de template e público, opção "encaixar na semana".
- **Day** (`day.py:38-101`): ordem, nome, flag de descanso.
  - Tem a flag **"precisa de registro para avançar"**: o dia se repete até ser registrado.
  - Tipos: custom, EMOM, AMRAP, HIIT, Tabata, EDT, RFT, AFAP (`day.py:27-35`).
- **Slot** (`slot.py:15-47`): um grupo dentro do dia. Com mais de uma entrada, é um superset [V\*].
- **SlotEntry** (`slot_entry.py:208-299`): o exercício, unidades e arredondamentos de peso e reps, e o tipo da série.
  - Tipos de série: normal, warmup, dropset, myo, partial, forced, TUT, iso, jump (`slot_entry.py:56-73`).

**"Semanas" não são entidade.** São **iterações**: cada vez que o ciclo de dias passa por um dia, a iteração daquele dia sobe [V\*] (`routine.py:177-331`).

**Prescrição por iteração** (`wger/wger/manager/models/abstract_config.py:48-162`):
- Cada campo (séries, peso, reps, RIR, descanso, cada um com par mín/máx) é uma **lista de regras de mudança indexadas por iteração**.
- Cada regra tem:
  - operação: substituir, somar ou subtrair;
  - passo: absoluto ou percentual;
  - "repetir": a regra continua valendo nas iterações seguintes;
  - **requisitos**: regras que só disparam se o registro da iteração anterior atingiu a prescrição exibida em certos campos (`wger/wger/manager/dataclasses.py:267-282`).
- Com "todas as séries", **todas** as séries registradas têm de cumprir e pelo menos o número prescrito de séries precisa existir. É assim que se faz a dupla progressão estrita.

**Estado derivado, não guardado** [V] (`wger/wger/manager/models/slot_entry.py:417-580`):
- A prescrição de uma iteração é **recalculada percorrendo as iterações 1..N**, aplicando as regras e consultando os logs da iteração anterior.
- O resultado é cacheado.
- Existe um gancho para uma classe Python plugável de cálculo customizado (`slot_entry.py:441-465`).

**Registro de execução** [V] (`wger/wger/manager/models/log.py:48-228`):
- `WorkoutSession` e `WorkoutLog` usam **UUIDv7** como chave primária (`session.py:63-67`, `log.py:55-59`).
- O log guarda **valor realizado e valor alvo** (reps, peso, RIR, descanso) e a iteração.
- As FKs para rotina e slot usam SET_NULL, então o histórico sobrevive a edições da rotina [V\*].

**Volume e intensidade:** usam a fórmula de Brzycki [V\*] (`wger/wger/manager/helpers.py:214-216`).

### 2.3 Peso corporal e medidas
- **Peso corporal virou uma categoria oficial de "Measurement".** O modelo próprio foi removido em migração, e o endpoint legado foi mantido por compatibilidade [V] (`wger/wger/weight/api/views.py:28-75`).
- **Cada medida** tem [V] (`wger/wger/measurements/models/measurement.py:48-121`):
  - UUIDv7;
  - origem: usuário, Google, Apple ou calculada;
  - `external_id`;
  - unidade gravada por entrada.
- **Restrição única (categoria, origem, external_id):** importações de Health Connect ou Apple Health ficam idempotentes.

### 2.4 Exercícios e base colaborativa
- **Base de exercício neutra de idioma** (UUID global entre instalações, categoria, músculos primários e secundários, equipamentos, grupo de variação) mais **uma tradução por idioma**. A tradução tem nome, descrição em Markdown sanitizada, aliases e comentários [V] (`wger/wger/exercises/models/base.py:90-159`, `translation.py:44-132`).
- **Fallback de idioma:** pedido → inglês → primeira tradução disponível [V\*].
- **Músculos:** nome latino, nome em inglês, frente ou costas e SVG de sobreposição [V] (`wger/wger/exercises/models/muscle.py:29-49`).
- **Histórico completo de edições** via django-simple-history (`AbstractHistoryMixin`) [V].
- **Envio pela comunidade** [V\*]:
  - exige conta com mais de 21 dias e e-mail verificado;
  - throttling de 20 por hora.
- **DeletionLog** [V] (`wger/wger/exercises/models/deletion_log.py:20-60`):
  - registra base, tradução, imagem ou vídeo excluídos, com `replaced_by`;
  - instâncias auto-hospedadas aplicam exclusões e fusões ao sincronizar com o servidor central (`wger/wger/exercises/management/commands/sync-exercises.py`).

### 2.5 API REST e multiusuário
- **Estrutura:** DRF em `/api/v2/` com 50 rotas registradas [V] (`wger/wger/urls.py:59-256`, `:330`). OpenAPI via drf-spectacular (`wger/settings/settings_global.py:556`).
- **Autenticação** [V] (`settings_global.py:517-555`):
  - sessão, token e JWT (headless e SimpleJWT);
  - token OIDC opaco;
  - paginação limit/offset de 20;
  - throttling por escopo (login 10/min).
- **Autorização** [V] (`wger/wger/utils/permissions.py:22-58`):
  - Cada modelo expõe "qual é o objeto dono".
  - O dono tem acesso total; objetos sem dono (catálogo) são somente leitura.
  - Os `get_queryset` filtram por usuário.
  - Na escrita, as FKs do payload são verificadas: o usuário só pode referenciar o que é dele [V\*] (`wger/wger/utils/viewsets.py:35-95`).
- **Academias e treinadores** [V\*]:
  - app `gym` com contratos, papéis (gerente, treinador, membro) e notas administrativas;
  - "login como membro" restrito à mesma academia.

### 2.6 Offline (app móvel)
**Integração com PowerSync** [V]: replicação lógica do Postgres para o SQLite do app. As escritas sobem por handlers por tabela (`wger/wger/utils/powersync.py:43-275`).

- **Criação idempotente:** se a linha já existe e é do usuário, a entrega repetida é um "ok" sem efeito (`:153-156`, `:265-275`).
- **Atualizar ou apagar algo inexistente** também é "ok". O servidor é autoritativo (`:252-263`).
- **Verificação de FKs:** checa se as referências pertencem ao usuário (`:235-243`).
- **Recusa permanente:** responde **200 com campo de erro**, porque o cliente reenvia tudo que não for 2xx [V\*] (`wger/wger/core/api/views.py:423-480`).
- **Criação de rotina:** só via REST, porque o servidor atribui o ID inteiro (`wger/wger/manager/powersync.py:55-70`).

### 2.7 i18n
- 37 diretórios de locale [V] (`wger/wger/locale/`). Há `pt`, mas **não** `pt_BR`, apesar de `pt-br` aparecer em `AVAILABLE_LANGUAGES` [V\*].
- Traduções da interface feitas no Weblate [R].
- Traduções de exercícios em português: cerca de 68 linhas [V\*].

---

## 3. openGym: logger, supersets, passkeys, base de exercícios e direitos de mídia

### 3.1 Licença e mídia
- **Código:** AGPL-3.0-or-later, mais uma permissão adicional para distribuir nas lojas [V] (`openGym/NOTICE.md:3-13`).
- **Origem dos dados:** a base vem de `hasaneyldrm/exercises-dataset`, que é uma redistribuição do **ExerciseDB v1 (AscendAPI)**. Os nomes de arquivo embutem o ID do ExerciseDB [V] (`openGym/NOTICE.md:47-58`).
- **Texto e metadados:** declarados MIT. As traduções feitas pelo openGym são AGPL (`NOTICE.md:60-66`).
- **Imagens e GIFs:** fora de MIT e de AGPL, com titularidade **não resolvida** [V] (`NOTICE.md:92-117`).
  - A Gym visual é creditada, mas com permissão intransferível.
  - A AscendAPI alega ser a dona.
  - O próprio openGym diz para tratar a mídia como **não licenciada a ninguém**.
- **Como a mídia chega ao usuário:** não está no repositório. É baixada no primeiro `docker compose up` por `git clone` do dataset (`openGym/docker-compose.yml:5-27`), ou carregada de CDN no app e na demo [V\*].
- **Mudança anunciada:** o roadmap da v1.4.0 (2026-11-15) troca toda a base por "uma nova, licenciada", com **mudança de IDs** e migração de histórico [V] (`openGym/ROADMAP.md:140-152`). Isso confirma o risco.
- **Nomes e instruções em pt-BR:** gerados com LLM e explicitamente **não revisados por nativo** [V] (`openGym/scripts/exercise-name-sources/README.md:20-23`; `NOTICE.md:119-125`).

### 3.2 Base de exercícios
- **Contagem real: exatamente 1.324 registros** [V], todos com nome, imagem e GIF, em um único arquivo de ~888 KB (`openGym/frontend/src/lib/exercises-data.js:1`).
- **Campos:** parte do corpo, equipamento, alvo, músculo principal e secundários, passos de instrução, imagem e gif.
- **Correção de músculos:** há camadas de correção ("informadas por ExRx") para ~239 exercícios [V\*].

### 3.3 Arquitetura e sincronização
- **API em Node sem framework e sem banco.** Guarda um `db.json` para usuários e credenciais, mais **um documento JSON por usuário** com todo o estado do app [V] (`openGym/api/openapi.yaml:3222-3300`).
- **Gravação durável:** arquivo temporário, depois fsync, rename e fsync do diretório (`openGym/api/durable.js:1-38`).
- **Sincronização do documento inteiro com revisão** [V] (`openapi.yaml:1389-1440`):
  - GET devolve o estado e a revisão.
  - PUT com `baseRev` é condicional: em conflito devolve 409 com o documento atual, e o **cliente faz o merge** e reenvia.
  - Registros de exclusão (`deleted`) e de edição por campo (`edited`, `_ts`, `_f`) **nunca encolhem** no servidor. É o mecanismo contra "ressurreição" por aparelhos antigos (`openGym/api/sync-stamps.js:1-40`).
  - O treino em andamento (`active`) nunca vai ao servidor.
- **Problema reconhecido:** o perfil é reescrito inteiro a cada gravação e fica lento com histórico grande. A migração para banco está como "depois" [V\*].

### 3.4 Passkeys
- **Servidor:** usa `@simplewebauthn/server` [V] (`openGym/api/package.json:12-14`).
- **Cadastro** [V] (`openGym/api/server.js:1887-1907`):
  - gera um ID aleatório do usuário e exige **chave residente** (login sem digitar usuário);
  - verificação do usuário "preferida" e atestação "none";
  - código de convite opcional.
- **Login:** credencial "descobrível", sem lista de credenciais permitidas [V\*].
- **Sessão:** cookie assinado. "Sair de todos os lugares" incrementa uma versão de sessão [V\*].
- **Alternativas para quem não tem passkey** [V\*]:
  - senha opcional (scrypt);
  - código de reset emitido pelo admin;
  - **código de pareamento de 5 minutos** para o app móvel;
  - "link de dispositivo" para cadastrar passkey em outro aparelho;
  - modo convidado, só local.
- **OIDC:** não implementado.

### 3.5 UX do logger [V\*, conferido por amostragem]
- **Prefill:** as linhas vêm da última sessão daquela rotina (sem aquecimento). Editar um peso propaga para as linhas seguintes não editadas manualmente.
- **Linha de referência:** um toque alterna entre "última vez" e "melhor série".
- **Tipos de série inline:** drop set e rest-pause ficam **dentro da mesma linha** (sub-blocos), não como séries extras. Há séries por lado (E/D).
- **RIR/RPE:** coluna opcional em passos de 0,5, e "vazio" é diferente de "0".
- **Supersets:**
  - São um identificador de grupo compartilhado entre **entradas adjacentes**.
  - Marcar uma série **avança para o parceiro**.
  - O grupo descansa **uma vez por rodada**, com o **maior** descanso entre os membros [V] (`openGym/frontend/src/lib/supersetFlow.js:36-80`).
  - Há descanso após toda série, exceto a última do treino.
- **Timer de descanso:** roda, ±15 s, alerta por Web Push agendado no servidor ou por alarme nativo no Android.
- **Uso só com teclado ou botões:** espaço/enter marcam a próxima série e setas trocam de exercício, pensado para telas fixas na parede. A tela é mantida ligada (wake lock).
- **Calculadora de anilhas:** usa o inventário do usuário e mostra o que tirar ou pôr entre uma linha e outra.
- **PRs:** calculados **ao finalizar** e mostrados num resumo [V] (`openGym/frontend/src/sheets.jsx:2851-2860`). O README fala em detecção "durante", o que não confere.

### 3.6 Progressão
- **Políticas:** desligada, linear, Greyskull, dupla e "adicionar tempo" [V] (`openGym/frontend/src/lib/progression.js:25-46`).
- **Deload:** após 3 falhas (1 no Greyskull), com fator 0,9 configurável entre 0,5 e 0,95 [V] (`:51-56`).
- **Desenho declarado:** a prescrição é **função pura do histórico**, recalculada sempre, sem contadores guardados, e sempre mostra **o motivo** (`:1-17`) [V].
- **Leitura honesta da sessão:** série não marcada ou com menos séries que o prescrito conta como falha.
- **1RM:** fórmulas de Epley, Brzycki e Lombardi, limitadas a 12 reps [V\*].

### 3.7 Outros
- **MCP somente leitura** (9 ferramentas, stdio) que lê os arquivos de estado diretamente [V\*].
- **Importação CSV:** Strong, Hevy, FitNotes e Lyfta [V\*].
- **Idiomas:** 17 arquivos de locale além do inglês, incluindo `pt-BR`, que é uma sobreposição sobre `pt` [V] (`openGym/frontend/src/locales/`).
- **Testes:** cerca de 348 arquivos no frontend e 66 na API [V\*].

---

## 4. granite: offline-first, REST e MCP

### 4.1 Decisões documentadas
Lidas nas ADRs [R], com confirmação no código quando indicado.

- **ADR-0003** (`granite/docs/decisions/0003-offline-first-sync.md:10-30`):
  - armazenamento local como fonte da verdade no aparelho;
  - protocolo pull/push;
  - **last-write-wins por registro** usando `updated_at`;
  - exclusão por tombstone e IDs gerados no cliente;
  - cursor de pull por número de sequência do servidor.
  - CRDT foi rejeitado por ser complexo demais para app de um único usuário.
- **ADR-0008** (`0008-sync-engine-v1.md:35-84`):
  - Sincronização por **agregado**: rotina e treino viajam inteiros, com filhos dentro do payload, substituídos atomicamente.
  - Aplicação em **ordem de dependência de FK**.
  - O cursor `updated_at` foi trocado por um **`server_seq` monotônico por usuário**, atribuído por trigger. Assim registros retroativos ou importados não são pulados.

### 4.2 Verificado no código
- **IDs gerados no cliente** com `crypto.randomUUID()`, ou seja v4, embora a ADR diga v7 [V] (`granite/apps/mobile/src/lib/repo/workouts.ts:115-130`).
  - Exercícios embutidos usam UUIDv5 determinístico a partir do nome, então os IDs são estáveis entre instalações [V\*].
- **Upsert idempotente com guarda de LWW** [V] (`granite/apps/api/internal/db/queries/sync.sql:12-19`): inserir; em conflito de ID, atualizar **somente se** o `updated_at` recebido for ≥ o atual.
- **Sequência por usuário** mantida por triggers após cada insert/update [V] (`granite/apps/api/internal/db/migrations/00009_server_seq.sql:40-56`). O pull usa "seq > cursor" dentro de uma única transação de leitura [V\*].
- **Proteção contra relógio adiantado:** o servidor limita o `updated_at` a no máximo agora + 5 min [V] (`granite/apps/api/internal/sync/service.go:23-26`).
- **Outbox local que se coalesce por `entidade:id`** [V] (`granite/apps/mobile/src/lib/local/idb-store.ts:67-94`).
  - É um conjunto de registros sujos, não um log de operações.
  - Só sai do outbox se o `updated_at` enviado ainda for o atual, então uma edição feita durante o envio não se perde.
  - Ao aplicar dados remotos, o local mais novo é preservado.
- **Detecção de servidor resetado:** o servidor tem um ID de instância. Se o ID mudar, o cliente tenta enviar, avisa e limpa [V\*].
- **Importação é um push em lote:** um único caminho de escrita [V\*].
- **REST:** `/api/v1` com 33 operações e OpenAPI gerado a partir do código; o CI falha se o spec divergir [V\*].
- **Tokens pessoais:** prefixados, guardados como hash, **somente leitura por padrão** [V\*].
- **MCP via stdio**, como cliente HTTP da própria API [V\*]:
  - ferramentas de leitura sempre ativas;
  - ferramentas de escrita só com uma flag de ambiente **e** token com escopo de escrita.
- **Sem programas e sem progressão automática.** Há só "deload rápido" de 5–20% e calculadoras [V\*].

### 4.3 Armadilhas encontradas (evitar no nosso desenho)
1. **Um registro inválido trava toda a sincronização** [V].
   - O cliente oferece tipos de série "top" e "backoff" (`granite/apps/mobile/src/lib/sets.ts:5`).
   - O servidor aceita só normal, warmup, drop e failure (`service.go:30`) e rejeita o **lote inteiro** (`granite/apps/api/internal/sync/apply.go:42-53`).
   - O motor de sync lança erro antes de liberar o outbox e antes do pull (`granite/packages/shared/src/sync/engine.ts:10-22`).
   - **Correção para nós:** schema de validação único entre cliente e servidor, resultado por item e quarentena.
2. **Dados não sincronizados apagados ao expirar a sessão** [V].
   - Um 401 definitivo chama a rotina que limpa o banco local inteiro, incluindo o outbox (`granite/apps/mobile/src/lib/stores/auth.svelte.ts:124-137`).
   - A intenção (não vazar dados entre contas) é boa, mas o efeito é perda de treinos.
3. **Criação via REST e MCP não é idempotente.** O servidor gera o ID, então um retry duplica o treino [V\*].
4. **IDs dos filhos regenerados a cada edição.** Nada consegue referenciar uma série específica de forma estável [V\*].
5. **Push sem paginação nem tamanho máximo** [V\*].

---

## 5. forge: UX do logger (sem licença; somente observação)

### 5.1 Licença
- **Sem LICENSE em todo o repositório** [V].
  - Os `package.json` não têm o campo `license` (`forge/frontend/package.json:1-5`).
  - Só o JSON-LD do site menciona AGPL (`forge/website/src/layouts/BaseLayout.astro:58`).
- **Conclusão:** tratar como todos os direitos reservados. Mesmo se fosse AGPL, não copiaríamos.
- **Mapa corporal:** declara vir de `react-native-body-highlighter` (MIT) [V] (`forge/frontend/src/lib/bodyPaths.ts:1`). Se quisermos usá-lo, a fonte é o upstream MIT, nunca o forge.

### 5.2 Registrar uma série com poucas interações
- **Repetir a última vez custa 1 toque** [V] (`forge/frontend/src/components/SetRow.tsx:196-228`).
  - Cada linha mostra valores "fantasma".
  - Marcar a série grava esses valores.
  - A ordem do fantasma é:
    1. sugestão de progressão;
    2. série correspondente da sessão anterior (pareada pela posição entre as séries de trabalho);
    3. última série preenchida hoje.
  - **Série AMRAP nunca pré-preenche reps**, porque o número é a própria medição (`:199-204`).
  - Com peso ou reps faltando, o botão fica desabilitado.
- **Superar a última vez custa 2+ toques:** digitar e confirmar. O teclado é decimal no peso e numérico nas reps; Enter passa de peso para reps. Não há steppers na linha [V\*].
- **Feedback e gestos:** animação curta ao concluir, deslizar para excluir com "desfazer", tocar no número da série para mudar o tipo (aquecimento, drop, falha, AMRAP) [V\*].

### 5.3 Timer de descanso
- **Guardado como "horário de término"**, persistido localmente. Assim sobrevive a recarregar e trocar de aba, e ±15 s é trivial [V] (`forge/frontend/src/lib/timer.ts:25-50`).
- **Começa sozinho ao marcar a série.** A duração vem do exercício, senão do padrão do usuário, senão 120 s. **Em superset, só começa após o último exercício do grupo** [V\*].
- **Ao terminar:** vibração, bipe sintetizado (desativável) e notificação se a aba estiver oculta.
- **Com tela bloqueada:** o servidor agenda um Web Push com o horário de término [V\*].
- **No iOS nativo:** Live Activity na tela de bloqueio e na Dynamic Island, com botões +15 s, Pular e Série feita [V\*].

### 5.4 PRs e gráficos
- **Detecção ao finalizar, não durante a sessão** [V] (`forge/backend/serializers.py:250-262`). Tipos de PR: maior peso, e1RM (Epley, `serializers.py:8-13`) e reps em exercícios de peso corporal. Aquecimento é excluído.
- **Recálculo cronológico** de todos os PRs após editar o histórico ou importar [V\*].
- **Tela de fim de treino:** confete, número do treino, duração, volume, variação de volume contra o último treino de mesmo nome e lista de PRs. Se finalizado offline, avisa que os PRs aparecem após sincronizar [V\*].
- **Gráficos (Recharts):** e1RM, melhor peso, reps e volume por exercício, com sobreposição de RPE médio; volume semanal [V\*].

### 5.5 Progressão e offline
- **Sugestões, não imposições** [V\*]:
  - Se todas as séries de trabalho bateram o topo da faixa, sugere peso + incremento.
  - Depois de **3 sessões estagnadas**, sugere deload de ~90%.
  - Aparecem como banners ignoráveis.
- **Treino com `client_id` UUID** [V] (`forge/backend/models/workout.py:31-34`). O sync faz upsert por (dono, client_id), então reenviar não duplica.
- **Fila offline em localStorage** [V\*], com nova tentativa ao voltar online e a cada 15 s.
- **Catálogo:** 278 exercícios no seed (146 "pais" e 132 variações de pegada, largura ou acessório) [V] (`forge/backend/seed.py:25`, contagem por AST). O README diz 108, defasado.

---

## 6. Requisitos e ideias a incorporar no nosso produto (lista priorizada)

Tudo descrito com palavras próprias. A inspiração está entre parênteses.

### P0: fundamentos (definem a arquitetura)
1. **Motor de progressão determinístico baseado em regras declarativas por exercício, com estado derivado do histórico** (openGym, wger; contraste com liftosaur).
   - A prescrição da próxima sessão é uma função pura de três coisas: regra configurada, histórico de logs imutáveis e configuração de equipamento.
   - Editar um log errado ou mudar a regra recalcula tudo, sem contadores divergentes.
   - Guardar só um cache materializado e um **snapshot da decisão** por sessão: regra aplicada, entradas, resultado e motivo legível em pt-BR (liftosaur, openGym).
   - Regras do MVP:
     - **linear** (incremento, sucessos exigidos, falhas até deload, fator ou valor de deload);
     - **dupla progressão** (faixa mín–máx);
     - **soma de reps**;
     - **progressão de tempo**.
   - Sucesso é definido por "todas as séries prescritas feitas com reps ≥ alvo e esforço ≤ alvo". Série não marcada conta como falha.
   - O próximo peso parte do peso realmente realizado (liftosaur).
2. **Log com alvo e realizado lado a lado** (wger, openGym).
   - Cada série registrada guarda a prescrição do momento (peso, reps, RIR/RPE, descanso) e o executado.
   - O histórico sobrevive a edições ou exclusões do programa.
3. **Offline-first com IDs gerados no cliente e operações idempotentes** (granite, wger, forge).
   - **IDs:** UUIDv7 gerados no cliente para treino, exercício do treino e série, **estáveis entre edições**. UUIDv5 determinístico para itens de catálogo.
   - **Push:** agregado "treino" enviado inteiro, com upsert no Postgres guardado por `updated_at` (LWW) mais um **número de sequência por usuário** atribuído no servidor e usado como cursor de pull.
   - **Exclusões:** tombstones.
   - **Relógio do cliente:** limitado a no máximo alguns minutos no futuro.
   - **Resposta do push:** **resultado por item**, sem rejeitar o lote. O servidor devolve a versão canônica dos itens recusados ou ajustados.
   - **Validação:** **schema único** compartilhado entre cliente e servidor.
   - **Outbox:** coalescido por entidade, liberado só se a versão enviada ainda é a atual. **Nunca apagado por expiração de sessão** (granite 4.3).
   - **Criação repetida:** é "ok" sem efeito (wger).
   - **Banco local:** escopado por usuário.
4. **Segurança multiusuário por "objeto dono"** (wger).
   - Toda consulta é filtrada pelo usuário.
   - Toda FK recebida numa escrita (REST, sync ou MCP) tem a posse verificada.
   - O catálogo global é somente leitura para usuários comuns.
5. **Catálogo de exercícios com proveniência e licença por linha** (wger).
   - Campos: título, autor, fonte, licença, obra de origem e flag de "gerado por IA" para mídia.
   - Estrutura: base neutra de idioma + tradução por idioma (pt-BR primeiro), com aliases para busca.
   - **Registro de exclusão e fusão com "substituído por"**, que repontua o histórico do usuário.
   - Mídia só própria ou **licenciada comercialmente com contrato** (lição do liftosaur e do openGym).
   - Traduções pt-BR com **status de revisão humana** explícito.

### P1: experiência do logger
6. **Registrar série repetindo a última vez com 1 toque** (forge).
   - Valores fantasma na ordem: sugestão do motor → última sessão (pareada por posição entre as séries de trabalho) → série anterior de hoje.
   - AMRAP nunca pré-preenchido.
   - Teclado numérico ou decimal certo, com Enter avançando de campo.
   - Editar o peso de uma série propaga às seguintes não editadas manualmente (openGym).
7. **Timer de descanso como horário de término persistido** (forge, granite, openGym).
   - Inicia automaticamente ao marcar a série.
   - Duração por exercício ou padrão.
   - ±15 s e pular.
   - Vibração e som; notificação push agendada no servidor quando o app vai para segundo plano.
   - Em superset, descanso único ao fim da rodada, com o **maior** descanso do grupo (openGym).
8. **Supersets como grupo de entradas adjacentes** (openGym, wger "slot"). Marcar uma série avança para o parceiro.
9. **Aquecimento separado das séries de trabalho:** rampa gerada em 1 toque, fora de PR e de volume (forge, openGym).
10. **PRs calculados ao finalizar e recalculados cronologicamente ao editar ou importar** (forge, openGym). Tipos: peso, e1RM e reps (peso corporal). Tela de resumo com celebração e indicação "PRs após sincronizar" quando offline.
11. **Arredondamento ao equipamento real** (liftosaur, openGym). Considera barra, inventário de anilhas, multiplicador de lados e halteres fixos. "Incrementar" vai ao próximo peso montável. Calculadora de anilhas com "tirar/pôr" entre séries.
12. **Esforço opcional (RIR ou RPE)** em passos de 0,5, distinguindo "vazio" de "0" (openGym). Usar como critério de sucesso opcional na progressão (liftosaur).
13. **Linha de referência "última vez / melhor série"** e **nota fixada "para a próxima vez"** por exercício (openGym, forge).

### P2: diferenciais e evolução
14. **Programa com estrutura semana → dia → exercício e regras de deload explícitas** (liftosaur, wger). Inclui:
    - semana de deload com progressão desligada;
    - variações de esquema que trocam após falha (estilo GZCLP);
    - dia que só avança com registro (wger).
15. **IA opcional como autora, motor determinístico como juiz** (inspirado em liftosaur/llms).
    - A IA propõe um programa em formato estruturado (JSON validado por schema ou uma DSL nossa).
    - O parser e o motor validam e explicam.
    - Nada da IA altera cargas sem passar pelas regras determinísticas.
16. **API REST com OpenAPI gerado a partir do código, verificado no CI** (granite).
    - **Tokens pessoais com escopo**, leitura por padrão.
    - **Servidor MCP** começando somente leitura; escrita opt-in com token de escrita e criação idempotente com ID do cliente (granite, openGym).
17. **Login com passkeys (chave residente, sem senha), com alternativas** (openGym). Alternativas: senha opcional, pareamento por código curto para novo aparelho e "sair de todos os dispositivos".
18. **Importar e exportar** (forge, granite, openGym).
    - Importação CSV de Strong e Hevy, com mapa de aliases para o nosso catálogo.
    - Exportação JSON completa e CSV.
    - Importação implementada como push em lote pelo mesmo caminho do sync.
19. **Medidas corporais como categorias genéricas** (wger).
    - Peso corporal é uma delas.
    - Origem e `external_id` com restrição única tornam idempotente a importação de Health Connect ou Apple Health.
20. **Modo "mãos ocupadas":** teclas, botões e tela sempre ligada (openGym), para uso no celular apoiado no equipamento.

---

## 7. O que NÃO fazer

**Legal**
- **Não copiar código, gramáticas, schemas, estrutura literal de pastas, nomes de funções, textos de UI, docs ou comentários** de nenhum dos cinco.
  - Quatro são AGPL-3.0: qualquer derivado obrigaria a abrir o código do serviço inteiro, inclusive em uso via rede.
  - O forge não tem licença.
  - Reimplementar **conceitos** (regras de progressão, LWW com sequência, timer por horário de término) é permitido. Transcrever pseudocódigo deles linha a linha, não.
- **Não reproduzir a sintaxe Liftoscript nem os nomes `lp`/`dp`/`sum` como API pública nossa.** Se tivermos uma DSL, ela deve ser desenhada do zero.
- **Não usar mídia de exercícios do openGym, do `exercises-dataset`, do ExerciseDB/AscendAPI nem da Gym visual sem contrato próprio.** O openGym admite a titularidade em disputa (`openGym/NOTICE.md:92-117`) e vai trocar a base (`openGym/ROADMAP.md:140-152`).
- **Não importar textos, nomes ou traduções pt-BR do openGym.** São AGPL, gerados por LLM e não revisados.
- **Não importar dados do wger sem tratar a atribuição TASL e o *share-alike*** da CC-BY-SA, e a ODbL nos ingredientes. Isso exige parecer jurídico.
- **Não usar o mapa corporal de nenhum desses projetos.** Se quisermos um, avaliar direto os upstreams MIT (MuscleMap, react-native-body-highlighter), com atribuição.
- **Não usar as marcas** (wger, Liftosaur, Liftoscript, openGym, Granite, Forge, Strong, Hevy, ExerciseDB, Gym visual) em nome de produto, telas ou marketing comparativo sem revisão jurídica.
- **Não reproduzir layouts, capturas, paletas ou tipografia** desses apps.

**Técnico** (armadilhas observadas)
- **Não guardar o estado de progressão só como contadores mutáveis dentro do programa** (liftosaur). Dificulta auditoria e correção de logs. Preferir estado derivado + snapshot da decisão.
- **Não rejeitar um lote de sincronização inteiro por um item inválido** (granite).
- **Não ter validação divergente entre cliente e servidor** (granite: tipos de série "top" e "backoff").
- **Não apagar dados locais pendentes ao expirar a sessão** (granite).
- **Não aceitar criação não idempotente** em REST ou MCP. Exigir ID do cliente (granite).
- **Não regenerar IDs de filhos a cada edição** (granite).
- **Não modelar o perfil inteiro como um único documento JSON reescrito a cada gravação** (openGym). Não escala e torna o merge complexo.
- **Não prometer na documentação o que o código não faz.** Exemplos: PR "durante o treino" no openGym, UUIDv7 no granite, contagem de exercícios no forge. Manter docs e verificações de CI alinhados.
