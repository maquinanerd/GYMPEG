# Auditoria da base de exercícios e da mídia — Fase 0 / Gate G0

- **Data:** 2026-10-08
- **Escopo:** `free-exercise-db` (candidato a dataset inicial), mídia e base do `gymcoach` (candidato a base do produto), comparação de licenciamento com `wger` e `openGym` (somente referência, sem reaproveitamento).
- **Fontes locais:** `_audit/repos/free-exercise-db` (clone raso, 1 commit, `f00c92c` de 2026-09-27), `_audit/repos/gymcoach`, `_audit/repos/wger`, `_audit/repos/openGym`.
- **Método:** todas as contagens abaixo foram **medidas** por scripts Python somente com stdlib (`_audit/scripts/`, ver Anexo A), sem instalar pacotes nem executar código dos repositórios. A proveniência foi checada nas issues públicas do GitHub (via API) e por busca de trechos do texto das instruções na web. O conteúdo dos repositórios foi tratado como dado auditado, nunca como instrução.
- **Aviso:** este documento aponta riscos jurídicos com base em evidências técnicas. Não é parecer jurídico; a decisão final de uso comercial deve passar por validação jurídica (ver §13).

---

## 1. Resumo executivo e recomendação

**Recomendação: importar do free-exercise-db apenas os _metadados_ (nomes, taxonomia, músculos e equipamento), como semente curada e reescrita na nossa taxonomia. Não importar as imagens para produção. Não importar, nem traduzir, o texto das instruções.**

Por quê:

1. **As imagens têm origem de terceiros não licenciada.** O repositório declara Unlicense, mas:
   - o dataset de origem (`wrkout/exercises.json`) diz no próprio CONTRIBUTING que as imagens "have been scrapped off the internet". O mantenedor diz ainda que não detém os direitos e desaconselha o uso comercial;
   - o mantenedor do free-exercise-db disse na issue #2 (jun/2023) que não sabe de onde as imagens vieram e que o uso é por conta e risco de quem usa;
   - um terceiro fez busca reversa e apontou o Bodybuilding.com como origem (issue #305 do upstream, jun/2024);
   - o texto das instruções é **idêntico** ao das páginas de exercício do Bodybuilding.com, e os slugs batem com os ids do dataset. Verifiquei duas amostras independentes: `Barbell_Bench_Press_-_Medium_Grip` ↔ `bodybuilding.com/exercises/barbell-bench-press-medium-grip` e `Leverage_Iso_Row` ↔ `bodybuilding.com/exercises/leverage-iso-row`.

   A Unlicense não transfere direitos que quem publicou nunca teve. Isso se encaixa na nossa regra que proíbe copiar mídia de sites comerciais sem licença explícita compatível.
2. **Há risco adicional de direito de imagem.** As fotos mostram modelos identificáveis e, às vezes, pessoas ao fundo, sem termo de cessão conhecido (CF art. 5º, X; CC art. 20). Também aparecem logotipos de marcas de roupa e de equipamento.
3. **Os metadados valem a pena.** São 876 exercícios com músculo primário, equipamento e categoria completos. **116 de 127 variantes P0 distintas (91,3 %) estão cobertas por 211 exercícios do dataset.** O mapeamento automático para `movement_pattern` acerta 204 de 211 P0 (96,7 %). Nomes e classificações são fatos e frases curtas, então o risco é baixo, ainda mais depois de reorganizados na nossa taxonomia e traduzidos.
4. **A mídia do GymCoach é a mesma mídia, com o mesmo risco.** São 164 JPEGs (82 exercícios), **byte a byte idênticos** aos do free-exercise-db (sha256), rotulados como "Public domain (Unlicense)". O código do GymCoach (MIT) é reaproveitável. As imagens não. Se o GymCoach for a base do produto, `public/exercise-media/` precisa ser removido antes de qualquer distribuição comercial.

**Consequência para a Fase 1:** "imagem inicial/final + thumbnail" dos P0 vai exigir **mídia própria ou licenciada** (sessão de fotos com termo de cessão, ilustração/3D encomendada ou pacote comercial com licença explícita). Até lá, a ficha mostra instruções próprias em pt-BR, músculos e equipamento. **Sugestão:** antecipar o SVG anatômico próprio (hoje previsto para a Fase 2). Ele é o único visual juridicamente limpo que chega a 100 % de cobertura no primeiro dia, porque é gerado a partir de `ExerciseMuscle`.

Uso aceitável das imagens do free-exercise-db: só em ambiente **local** de desenvolvimento, como placeholder de layout, com `license = UNVERIFIED` e `isActive = false`. Nunca em build distribuído, staging público, material de marketing ou capturas de tela da loja.

---

## 2. Licença e proveniência

### 2.1 O que o repositório declara

| Item | Evidência (caminho) | Conteúdo |
|---|---|---|
| Licença | `free-exercise-db/LICENSE.md` | Unlicense (dedicação ao domínio público, "AS IS", sem garantia) |
| Origem dos dados | `free-exercise-db/README.md` ("Why?" e "Special Thanks") | Reestruturação do `wrkout/exercises.json` (Ollie Jennings) |
| Duplicatas conhecidas | `free-exercise-db/README.md` (TODO/Images) | `jdupes`: 25 arquivos duplicados em 22 conjuntos, 809 KB. **Confere exatamente com a minha medição (§5).** |
| Histórico local | `git rev-parse --is-shallow-repository` = `true` | Clone raso; o histórico foi consultado no GitHub |

### 2.2 O que a investigação de proveniência encontrou

| Fonte consultada | Achado |
|---|---|
| `wrkout/exercises.json` — CONTRIBUTING.md (seção Exercise Images) | O mantenedor diz que as duas imagens de cada exercício foram raspadas da internet, que não detém os direitos e que desaconselha o uso comercial. Pede ajuda para criar imagens livres. |
| `wrkout/exercises.json` — issue #305 (aberta) | Comentário de terceiro (2024-06-05): busca reversa aponta o Bodybuilding.com, cujos termos proíbem o uso da propriedade intelectual sem permissão escrita. O mantenedor não contesta. Diz que hoje vende outro dataset (wrkout.xyz), com imagens 3D próprias e pago. |
| `wrkout/exercises.json` — issue #308 (aberta, 2025-07) | Alguém pergunta a fonte original para uso comercial. Sem resposta. |
| `yuhonas/free-exercise-db` — issue #2 (fechada) | O mantenedor diz que não sabe de onde as imagens vieram, que usar é por conta e risco de quem usa, e que preferiria imagens comprovadamente livres. Comentário de 2025 aponta a issue #305 do upstream. |
| `yuhonas/free-exercise-db` — issues #12 e #13 | Mais perguntas sobre licença das imagens. O mantenedor remete à #2 e diz que ainda precisa documentar isso no README (até o commit auditado, não documentou). |
| Busca na web por trechos das instruções | O 1º passo de `Barbell_Bench_Press_-_Medium_Grip` e o de `Leverage_Iso_Row` aparecem **literalmente** em `bodybuilding.com/exercises/<slug>`, que tem o mesmo slug do id do dataset. A URL hoje redireciona (301) para uma página comercial da Bodybuilding.com, ou seja, a marca e o titular seguem ativos. |
| Metadados das imagens (`image_audit.py`) | Os 1.746 JPEGs só têm segmento JFIF: nenhum EXIF, XMP ou comentário. Os metadados foram removidos, então não há crédito nem copyright embutido que ajude a rastrear a origem. |
| Inspeção visual (§5.3) | Fotografia profissional de estúdio/academia, com o mesmo modelo em dezenas de exercícios e ambientação comercial. Bate com um banco de fotos produzido por um site comercial, não com material criado pela comunidade. |

### 2.3 Nível de risco para uso comercial

| Ativo | Licença declarada | Proveniência provável | Risco | Decisão proposta |
|---|---|---|---|---|
| Imagens (1.746 JPEG) | Unlicense | Bodybuilding.com, raspadas por terceiros | **ALTO** | Não usar em produção |
| Pessoas nas fotos | — | Modelos identificáveis, sem termo de cessão conhecido, pessoas ao fundo | **ALTO** (direito de imagem) | Não usar |
| Texto das instruções (103.207 palavras) | Unlicense | Cópia literal do Bodybuilding.com (2 amostras confirmadas) | **MÉDIO-ALTO** | Não importar. **Traduzir também não resolve:** tradução é obra derivada e depende de autorização (Lei 9.610/98, art. 29). Escrever instruções próprias. |
| Nomes, ids, enums (músculos, equipamento, categoria, nível, force, mechanic) | Unlicense | Mesma compilação | **BAIXO-MÉDIO** | Usar como semente. Ideias, métodos e procedimentos não são protegidos (Lei 9.610/98, art. 8º). Para mitigar a proteção de compilação (art. 7º, XIII): usar só um subconjunto curado, reorganizado na nossa taxonomia e com nomes pt-BR próprios. |
| Marcas visíveis (Nike, Under Armour, Adidas, Hoist, Nautilus, TuffStuff, Iron Grip, FlexFit…) | — | Incidentais nas fotos | BAIXO | Irrelevante se as fotos não forem usadas |

---

## 3. Estrutura dos dados (free-exercise-db)

Cada exercício é um JSON em `exercises/<id>.json`, com imagens em `exercises/<id>/0.jpg` e `1.jpg`. O `dist/exercises.json` combina tudo (876 registros, idênticos aos arquivos-fonte; verificado). Schema: `schema.json` (draft-04).

| Campo | Tipo | Valores / observações (medido) |
|---|---|---|
| `id` | string `^[0-9a-zA-Z_-]+$` | Derivado do nome (`Barbell_Bench_Press_-_Medium_Grip`). 0 violações; 0 ids duplicados; 215 ids com hífen; 64 com palavras minúsculas (`_with_`, `_and_`); 2 começam com dígito. **Acopla o id ao caminho da imagem.** |
| `name` | string | Inglês. 0 nomes duplicados exatos. 7 divergem do id só por apóstrofo (`Farmer's Walk` × `Farmers_Walk`). |
| `force` | enum/null | `pull` 371, `push` 371, `static` 104, **null 30** |
| `level` | enum | `beginner` 525, `intermediate` 294, `expert` 57 |
| `mechanic` | enum/null | `compound` 491, `isolation` 298, **null 87** |
| `equipment` | enum/null (valor único) | 12 valores + null (tabela §4). Não representa combinações (halter + banco). |
| `primaryMuscles` | array de enum (17 valores) | 875 exercícios com 1 músculo; 1 com 2 (`Kettlebell_Halo_With_Overhead_Extension`) |
| `secondaryMuscles` | array de enum | 0 a 10 por exercício; 272 sem secundário |
| `instructions` | array de strings (passos) | 3.738 passos; mediana de 4 por exercício (0–24); 307 passos com "Tip:"; 1.045 mencionam "starting position". **5 exercícios sem instruções:** `Iron_Cross`, `One-Arm_Kettlebell_Swings`, `Push_Press`, `Side_Bridge`, `Side_Jackknife`. |
| `category` | enum | 7 valores (tabela §4) |
| `images` | array de caminhos relativos | Sempre `<id>/0.jpg` (início) e `<id>/1.jpg` (fim) ou vazio |

Enum de músculos (17): `abdominals, abductors, adductors, biceps, calves, chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck, quadriceps, shoulders, traps, triceps`.

Lacunas do schema em relação ao nosso modelo: não há padrão de movimento, unilateralidade, pegada, ângulo de banco, múltiplos equipamentos, aliases, vídeo, licença nem autoria por imagem.

---

## 4. Números medidos

Fonte: `run/exercise-media-audit/fedb_dataset_stats.json` (script `fedb_dataset_stats.py`).

**Total: 876 exercícios.** Todos têm os 11 campos. 0 violações de enum. `dist/exercises.json` está consistente.

### 4.1 Por categoria

| Categoria | Qtde | % |
|---|---:|---:|
| strength | 584 | 66,7 % |
| stretching | 123 | 14,0 % |
| plyometrics | 61 | 7,0 % |
| powerlifting | 38 | 4,3 % |
| olympic weightlifting | 35 | 4,0 % |
| strongman | 21 | 2,4 % |
| cardio | 14 | 1,6 % |

### 4.2 Por equipamento

| Equipamento | Qtde | | Equipamento | Qtde |
|---|---:|---|---|---:|
| barbell | 170 | | kettlebells | 56 |
| dumbbell | 123 | | bands | 20 |
| other | 122 | | medicine ball | 17 |
| body only | 111 | | exercise ball | 12 |
| cable | 81 | | foam roll | 11 |
| **null** | **77** | | e-z curl bar | 9 |
| machine | 67 | | | |

Dentro de `machine` estão misturados 20 exercícios de Smith, 8 "Leverage" (máquinas de anilha tipo Hammer Strength) e máquinas de placa. O nosso modelo deve separar esses casos (§8.2).

### 4.3 Por músculo primário

| Músculo | Qtde | | Músculo | Qtde |
|---|---:|---|---|---:|
| quadriceps | 148 | | calves | 28 |
| shoulders | 129 | | lower back | 27 |
| abdominals | 93 | | forearms | 25 |
| chest | 84 | | glutes | 22 |
| hamstrings | 79 | | traps | 15 |
| triceps | 73 | | adductors | 13 |
| biceps | 53 | | neck | 8 |
| lats | 38 | | abductors | 8 |
| middle back | 34 | | | |

### 4.4 Por nível, força e mecânica

| Nível | Qtde | Força | Qtde | Mecânica | Qtde |
|---|---:|---|---:|---|---:|
| beginner | 525 | pull | 371 | compound | 491 |
| intermediate | 294 | push | 371 | isolation | 298 |
| expert | 57 | static | 104 | null | 87 |
| | | null | 30 | | |

### 4.5 Imagens

Fonte: `run/exercise-media-audit/fedb_image_audit.json` (script `image_audit.py`).

| Métrica | Valor medido |
|---|---|
| Imagens por exercício | **2 imagens: 873**; 0 imagens: 3 (`Kettlebell_Halo`, `Kettlebell_Halo_With_Overhead_Extension`, `Kettlebell_Overhead_Triceps_Extension`); nenhum com 1 ou com 3 ou mais |
| Arquivos no disco | 1.746 (= referenciados); 0 órfãos; 0 referências quebradas |
| Formato real (assinatura) | 100 % JPEG (1.721 progressivos, 25 baseline); subsampling 4:4:4 em 1.256 e 4:2:0 em 490; extensão sempre bate com o conteúdo |
| Integridade | 0 corrompidas (todas com marcador EOI e SOF legível); 0 de 0 bytes |
| Resolução (largura) | mín. 275 / **mediana 850** / máx. 5.184 px |
| Resolução (altura) | mín. 275 / mediana 567 / máx. 3.456 px |
| Resoluções mais comuns | 850×567: 1.399 (80,1 %); 850×569: 125; 500×750: 69; 750×500: 53; 850×1275: 50. São 18 resoluções distintas. |
| Orientação | paisagem 1.601; retrato 141; quadrada 4 |
| Abaixo de 600 px de largura | 75 (2 abaixo de 400 px: `Heavy_Bag_Thrust`, 275×275) |
| Pares início/fim com resolução diferente | 4 (`Bicycling`, `Calf_Stretch_Hands_Against_Wall`, `Close-Grip_EZ-Bar_Press`, `Skating`) |
| Tamanho em disco | **98.671.281 bytes (≈ 94,1 MiB)**; média de 56.513 B; mediana de 54.675 B; mín. 15.378 B; máx. 919.342 B (`Cable_Judo_Flip`, 5184×3456 sem redimensionar) |
| Subconjunto P0 (211 exercícios, 422 imagens) | 28.054.010 B; média de 66.479 B; 12 com menos de 600 px |
| Duplicatas exatas (sha256) | **22 conjuntos, 25 arquivos redundantes, 809.464 B**. 16 conjuntos cruzam exercícios diferentes (32 exercícios envolvidos). Em 6, o `0.jpg` é igual ao `1.jpg` do mesmo exercício (sem início/fim distintos). |
| EXIF, XMP ou comentários | 0. Só JFIF (§2.2). |

Duplicatas entre exercícios diferentes (todas em alongamento, exceto onde indicado): `90_90_Hamstring` = `Leg-Up_Hamstring_Stretch` (as duas imagens); `All_Fours_Quad_Stretch` = `Cat_Stretch` = `One_Half_Locust` = `Rear_Leg_Raises` (0.jpg); `Hamstring_Stretch` = `Quad_Stretch`; `Shoulder_Stretch` = `Tricep_Side_Stretch` = `Triceps_Stretch`; `Downward_Facing_Balance` = `Pyramid`; `Latissimus_Dorsi-SMR` = `Lower_Back-SMR`; entre outros (lista completa no JSON). Algumas são reaproveitamentos errados: a mesma foto ilustra alongamento de posterior e de quadríceps.

Início igual ao fim (0 = 1): `Brachialis-SMR`, `One_Arm_Against_Wall`, **`Reverse_Grip_Bent-Over_Rows` (P0, remada curvada supinada)**, `Seated_Floor_Hamstring_Stretch`, `Standing_Hamstring_and_Calf_Stretch`, `The_Straddle`.

---

## 5. Qualidade das imagens

### 5.1 Medida (resumo)

Uniformidade técnica razoável: 80 % das imagens estão em 850×567 (3:2) e 91 % em ~1,5:1. Porém:

- 850 px de largura é pouco para uma imagem em largura total num celular com DPR 3 (≈ 1.125 px). Serve para o bottom sheet em DPR 2 e sobra para thumbnail.
- A proporção é heterogênea (3:2, 2:3, 16:9 e 1:1), então o layout precisa de `object-fit: contain` com letterbox ou de recorte por capa.
- Há outliers: 5184×3456 com 0,9 MB e 275×275.

### 5.2 Mídia necessária × disponível

O dataset só tem início e fim (2 frames). Não há vídeo, GIF, sequência, diagrama muscular nem thumbnail.

### 5.3 Amostragem visual (14 imagens P0 inspecionadas)

Inspecionadas: `Barbell_Bench_Press_-_Medium_Grip` 0 e 1, `Barbell_Squat/0`, `Wide-Grip_Lat_Pulldown/0`, `Leg_Press/0`, `Hack_Squat/1`, `Seated_Cable_Rows/1`, `Butterfly/0`, `Dead_Bug/0`, `Triceps_Pushdown_-_Rope_Attachment/1`, `Side_Lateral_Raise/1`, `Reverse_Grip_Bent-Over_Rows/0`, `Barbell_Deadlift/1`, `Leg_Extensions/0`, `Smith_Machine_Bench_Press/0`, `Split_Squat_with_Dumbbells/0`.

| Aspecto | Observação |
|---|---|
| Fundo | Academias reais, não fundo neutro. Há pelo menos 4 ambientes distintos: sala de parede vermelha com racks, academia comercial ampla com máquinas e pessoas ao fundo, academia com parede de metal ondulado e janelas, e estúdio escuro (`Dead_Bug`, frame de vídeo 1280×720). |
| Consistência de estilo | Média. A maioria segue o mesmo padrão de foto (mesmo modelo masculino, iluminação de flash, ângulo 3/4). Há fugas: `Hack_Squat` (outra academia, outro modelo, 760×760, recorte quadrado) e `Dead_Bug` (modelo feminina, estúdio escuro, 16:9). |
| Início/fim | Na grande maioria, `0.jpg` é a posição inicial e `1.jpg` a final, com o mesmo enquadramento. Funciona para a alternância início/fim. Exceção medida: os 6 pares idênticos. |
| Modelo | Pessoas reais e identificáveis (rosto visível). Em `Smith_Machine_Bench_Press`, o rosto fica oculto pelo enquadramento. Terceiros aparecem ao fundo (`Wide-Grip_Lat_Pulldown`, `Triceps_Pushdown_-_Rope_Attachment`). |
| Marca d'água | Nenhuma marca d'água sobreposta. |
| Marcas visíveis | Logotipos em roupas (Nike, Under Armour, Adidas e um logo azul recorrente na bermuda e na regata do modelo principal) e em equipamentos (TuffStuff, Hoist, Nautilus, Iron Grip, URX). |
| Fidelidade técnica | Boa nos básicos (supino, agachamento, leg press 45°, extensora, peck deck). A remada supinada não mostra o fim do movimento. |
| Adequação ao público BR | As máquinas fotografadas são parecidas com as de academias brasileiras, mas há lacunas importantes (§7). |

**Conclusão de qualidade:** tecnicamente aproveitáveis como referência visual de início/fim, mas o conjunto é heterogêneo e datado. E, sobretudo, é juridicamente inutilizável para uso comercial (§2).

---

## 6. Duplicidades e nomenclatura

Fontes: `run/exercise-media-audit/fedb_names_dupes.json` (`fedb_names_dupes.py`) e `run/exercise-media-audit/instruction_similarity.json` (`instruction_similarity.py`).

### 6.1 Quase-duplicatas por nome

| Normalização | Grupos |
|---|---|
| N1: caixa + pontuação | 0 |
| N2: N1 + plural + aliases (`tricep→triceps`, `DB→dumbbell`, `flyes→fly`) + stopwords | 1: `Squat with Bands` × `Squats - With Bands` (equipamentos diferentes: barbell × bands) |
| N3: bag of words | 1 (o mesmo) |
| Similaridade ≥ 0,92 (difflib) | 13 pares. Todos são variantes legítimas: one-arm × two-arm, pronated × supinated, abductor × adductor, incline × decline. |

### 6.2 Duplicatas semânticas (mesmo exercício com nomes diferentes)

| Par | Evidência |
|---|---|
| `Hammer_Grip_Incline_DB_Bench_Press` × `Incline_Dumbbell_Bench_With_Palms_Facing_In` | Instruções 100 % idênticas |
| `Seated_Flat_Bench_Leg_Pull-In` × `Seated_Leg_Tucks` | Instruções 100 % idênticas |
| `Decline_Smith_Press` × `Smith_Machine_Decline_Press` | Mesmo exercício, textos diferentes |
| `Cable_Rope_Overhead_Triceps_Extension` × `Triceps_Overhead_Extension_with_Rope` | Mesmo exercício |
| `Incline_Dumbbell_Flyes` × `Incline_Dumbbell_Flyes_-_With_A_Twist` | Mesmo conjunto de palavras nas instruções (variante mal descrita) |
| `Close-Grip_Front_Lat_Pulldown` × `Wide-Grip_Lat_Pulldown` | Mesmo conjunto de palavras. A versão "close-grip" manda prender a barra larga: erro de dado. |
| `Pushups` × `Pushups_Close_and_Wide_Hand_Positions` × `Push-Up_Wide` | Sobreposição de variantes |

Pares com Jaccard ≥ 0,6 nas instruções: 462. A maioria são variantes que reaproveitam texto, o que confirma que o texto foi gerado em série pelo site de origem.

### 6.3 Inconsistências de nomenclatura e dados

- Grafia variável: `tricep` (6) × `triceps` (38); `bicep` (3) × `biceps` (5); `flye` (3) / `flyes` (10) / `fly` (1); `Pushups` / `Push-Ups` / `Push-Up`; `Pullups` / `Pull-Up`; singular × plural em `Curl(s)`, `Row(s)`, `Squat(s)`; `DB` (1) × `Dumbbell`.
- Sufixo de variante com " - " em 29 nomes (`Triceps Pushdown - Rope Attachment`) e parênteses em 15.
- Termos de marca ou jargão do site de origem: "Leverage" (8, equivale a máquina articulada de anilha), "Smith" (20), "Bosu".
- Equipamento suspeito: `Bodyweight_Flyes` = `e-z curl bar`; `Chair_Squat` = `machine`; `Close-Grip_EZ_Bar_Curl` e `Decline_EZ_Bar_Triceps_Extension` = `barbell`; `Trap_Bar_Deadlift` = `other`.
- Músculo primário questionável: `Cable_Incline_Pushdown` → `lats`; `Bench_Press_-_Powerlifting` → `triceps`; `Barbell_Deadlift` → `lower back`.
- Ids derivados do nome com caixa mista e hífen. **Não servem como chave do nosso domínio**: guardar só como `sourceRef`.

---

## 7. Cobertura P0

Mapeamento curado manualmente e validado por `p0_coverage.py` (todos os ids existem; saída em `run/exercise-media-audit/p0_coverage.json`).

**Totais:** 133 linhas de variante, sendo 127 distintas (6 se repetem na seção "máquinas BR"). **116 de 127 distintas cobertas (91,3 %).** São **211 exercícios distintos** do dataset; todos têm 2 imagens, 1 tem início = fim (`Reverse_Grip_Bent-Over_Rows`) e 1 não tem instruções (`Side_Bridge`). **11 lacunas distintas.**

| Item P0 | Coberto por (ids do free-exercise-db) | Faltando |
|---|---|---|
| **Supino** | Reto barra: `Barbell_Bench_Press_-_Medium_Grip`, `Wide-Grip_Barbell_Bench_Press`, `Close-Grip_Barbell_Bench_Press`. Reto halteres: `Dumbbell_Bench_Press`, `Dumbbell_Bench_Press_with_Neutral_Grip`. Reto máquina: `Machine_Bench_Press`, `Leverage_Chest_Press`. Reto Smith: `Smith_Machine_Bench_Press`. Inclinado: `Barbell_Incline_Bench_Press_-_Medium_Grip`, `Incline_Dumbbell_Press`, `Hammer_Grip_Incline_DB_Bench_Press`, `Leverage_Incline_Chest_Press`, `Smith_Machine_Incline_Bench_Press`. Declinado: `Decline_Barbell_Bench_Press`, `Wide-Grip_Decline_Barbell_Bench_Press`, `Decline_Dumbbell_Bench_Press`, `Leverage_Decline_Chest_Press`, `Smith_Machine_Decline_Press` (+ duplicata `Decline_Smith_Press`). Crucifixo: `Dumbbell_Flyes`, `Incline_Dumbbell_Flyes`. Crossover: `Cable_Crossover`, `Low_Cable_Crossover`, `Single-Arm_Cable_Crossover`. Peck deck: `Butterfly`. Flexão: `Pushups`, `Push-Up_Wide`, `Incline_Push-Up`, `Decline_Push-Up`. | Nenhuma variante essencial. Supino inclinado/declinado em máquina só existe como "Leverage" (articulada de anilha); não há versão em máquina de placa. |
| **Agachamento** | Livre: `Barbell_Squat`, `Barbell_Full_Squat`, `Wide_Stance_Barbell_Squat`. Frontal: `Front_Barbell_Squat`, `Front_Squat_Clean_Grip`. Goblet/halter: `Goblet_Squat`, `Dumbbell_Squat`. Sumô halter: `Plie_Dumbbell_Squat`. Smith: `Smith_Machine_Squat`. Hack: `Hack_Squat`, `Narrow_Stance_Hack_Squats`. Búlgaro: `Split_Squat_with_Dumbbells` (pé de trás elevado, confirmado nas instruções), `Smith_Single-Leg_Split_Squat`, `One_Leg_Barbell_Squat`. Afundo/passada: `Dumbbell_Lunges`, `Barbell_Lunge`, `Barbell_Walking_Lunge`, `Dumbbell_Rear_Lunge`. Máquina deitado: `Lying_Machine_Squat`. | Agachamento no pêndulo, belt squat, V-squat |
| **Leg press** | 45°: `Leg_Press` (a foto mostra o modelo 45°), `Narrow_Stance_Leg_Press`. Vertical: `Smith_Machine_Leg_Press`. | Leg press horizontal (sentado); leg press unilateral |
| **Levantamento terra** | Convencional: `Barbell_Deadlift`, `Deficit_Deadlift`. Sumô: `Sumo_Deadlift`. Romeno barra: `Romanian_Deadlift`. Stiff: `Stiff-Legged_Barbell_Deadlift`, `Stiff-Legged_Dumbbell_Deadlift`, `Smith_Machine_Stiff-Legged_Deadlift`. Trap bar: `Trap_Bar_Deadlift`. Bom-dia: `Good_Morning`. Hip thrust/ponte: `Barbell_Hip_Thrust`, `Barbell_Glute_Bridge`. Hiperextensão: `Hyperextensions_Back_Extensions`. | Romeno com halteres (só existe stiff com halteres); hip thrust em máquina |
| **Puxadas** | Pronada aberta: `Wide-Grip_Lat_Pulldown`, `Full_Range-Of-Motion_Lat_Pulldown`. Pronada fechada: `Close-Grip_Front_Lat_Pulldown`. Supinada: `Underhand_Cable_Pulldowns`. Neutra/triângulo: `V-Bar_Pulldown`. Unilateral: `One_Arm_Lat_Pulldown`. Nuca: `Wide-Grip_Pulldown_Behind_The_Neck`. Barra fixa pronada: `Pullups`, `Wide-Grip_Rear_Pull-Up`. Supinada: `Chin-Up`. Neutra: `V-Bar_Pullup`. Assistida com elástico: `Band_Assisted_Pull-Up`. Braços estendidos: `Straight-Arm_Pulldown`, `Rope_Straight-Arm_Pulldown`. Pullover: `Bent-Arm_Dumbbell_Pullover`, `Straight-Arm_Dumbbell_Pullover`. | Graviton (barra assistida em máquina); puxada em máquina articulada |
| **Remadas** | Curvada barra: `Bent_Over_Barbell_Row`, `Reverse_Grip_Bent-Over_Rows` (início = fim). Curvada halteres: `Bent_Over_Two-Dumbbell_Row`, `..._With_Palms_In`. Baixa: `Seated_Cable_Rows`, `Seated_One-arm_Cable_Pulley_Rows`. Cavalinho: `T-Bar_Row_with_Handle`, `Bent_Over_Two-Arm_Long_Bar_Row`, `Lying_T-Bar_Row` (apoiado). Unilateral/serrote: `One-Arm_Dumbbell_Row`. Máquina: `Leverage_Iso_Row`, `Leverage_High_Row`. Smith: `Smith_Machine_Bent_Over_Row`. Apoiada inclinada: `Dumbbell_Incline_Row`. Face pull: `Face_Pull`. Remada alta: `Upright_Barbell_Row`, `Upright_Cable_Row`, `Standing_Dumbbell_Upright_Row`. Encolhimento: `Barbell_Shrug`, `Dumbbell_Shrug`, `Cable_Shrugs`, `Leverage_Shrug`. | Remada sentada em máquina de placa (só existe a "Leverage"); a imagem da remada supinada precisa de substituição |
| **Desenvolvimento** | Barra: `Barbell_Shoulder_Press` (sentado), `Standing_Military_Press`, `Seated_Barbell_Military_Press`. Halteres: `Dumbbell_Shoulder_Press`, `Arnold_Dumbbell_Press`. Máquina: `Machine_Shoulder_Military_Press`, `Leverage_Shoulder_Press`. Smith: `Smith_Machine_Overhead_Shoulder_Press`. Cabo: `Cable_Shoulder_Press`, `Seated_Cable_Shoulder_Press`. | — |
| **Elevação lateral / deltoide** | Halteres: `Side_Lateral_Raise`, `Seated_Side_Lateral_Raise`, `One-Arm_Side_Laterals`. Cabo: `Cable_Seated_Lateral_Raise`. Frontal: `Front_Dumbbell_Raise`, `Front_Two-Dumbbell_Raise`, `Front_Cable_Raise`, `Front_Plate_Raise`. Crucifixo inverso: `Reverse_Flyes`, `Seated_Bent-Over_Rear_Delt_Raise`, `Reverse_Machine_Flyes` (voador invertido), `Cable_Rear_Delt_Fly`. | **Elevação lateral em máquina**; elevação lateral unilateral no cabo em pé |
| **Roscas** | Direta barra: `Barbell_Curl`, `Wide-Grip_Standing_Barbell_Curl`, `Close-Grip_Standing_Barbell_Curl`. Barra W: `EZ-Bar_Curl`, `Close-Grip_EZ_Bar_Curl`. Halteres: `Dumbbell_Bicep_Curl`, `Seated_Dumbbell_Curl`. Alternada: `Dumbbell_Alternate_Bicep_Curl`, `Alternate_Incline_Dumbbell_Curl`. Martelo: `Hammer_Curls`, `Alternate_Hammer_Curl`, `Cross_Body_Hammer_Curl`, `Cable_Hammer_Curls_-_Rope_Attachment`. Scott: `Preacher_Curl`, `One_Arm_Dumbbell_Preacher_Curl`, `Two-Arm_Dumbbell_Preacher_Curl`, `Machine_Preacher_Curls`, `Cable_Preacher_Curl`. Cabo: `Standing_Biceps_Cable_Curl`, `Standing_One-Arm_Cable_Curl`, `High_Cable_Curls`, `Overhead_Cable_Curl`. Concentrada: `Concentration_Curls`. Inclinada: `Incline_Dumbbell_Curl`. Inversa: `Reverse_Barbell_Curl`, `Reverse_Cable_Curl`. Máquina: `Machine_Bicep_Curl`. | — |
| **Tríceps** | Pulley barra: `Triceps_Pushdown`, `Triceps_Pushdown_-_V-Bar_Attachment`. Pulley corda: `Triceps_Pushdown_-_Rope_Attachment`. Pulley inverso: `Reverse_Grip_Triceps_Pushdown`. Francês: `Standing_Dumbbell_Triceps_Extension`, `Standing_One-Arm_Dumbbell_Triceps_Extension`, `Seated_Triceps_Press`, `Standing_Overhead_Barbell_Triceps_Extension`. Francês na polia: `Cable_Rope_Overhead_Triceps_Extension` (+ duplicata `Triceps_Overhead_Extension_with_Rope`). Testa: `EZ-Bar_Skullcrusher`, `Lying_Triceps_Press`, `Lying_Dumbbell_Tricep_Extension`. Mergulho: `Dips_-_Triceps_Version`, `Parallel_Bar_Dip`, `Bench_Dips`, `Dip_Machine`. Coice: `Tricep_Dumbbell_Kickback`. Máquina: `Machine_Triceps_Extension`. | Coice na polia |
| **Cadeira extensora** | `Leg_Extensions`, `Single-Leg_Leg_Extension` | — |
| **Mesa/cadeira flexora** | Mesa (deitado): `Lying_Leg_Curls`. Cadeira (sentado): `Seated_Leg_Curl`. Em pé: `Standing_Leg_Curl`. Nórdica/GHR: `Natural_Glute_Ham_Raise`, `Glute_Ham_Raise`. | — |
| **Panturrilha** | Em pé: `Standing_Calf_Raises` (máquina), `Standing_Barbell_Calf_Raise`, `Standing_Dumbbell_Calf_Raise`, `Smith_Machine_Calf_Raise`. Sentado: `Seated_Calf_Raise`, `Barbell_Seated_Calf_Raise`, `Dumbbell_Seated_One-Leg_Calf_Raise`. No leg press: `Calf_Press_On_The_Leg_Press_Machine`, `Calf_Press`. Burrinho: `Donkey_Calf_Raises`. | — |
| **Abdominais** | Crunch: `Crunches`, `Crunch_-_Hands_Overhead`, `Weighted_Crunches`, `Decline_Crunch`, `Oblique_Crunches`. Prancha: `Plank`, `Side_Bridge` (sem instruções), `Push_Up_to_Side_Plank`. Elevação de pernas: `Hanging_Leg_Raise`, `Knee_Hip_Raise_On_Parallel_Bars`, `Flat_Bench_Lying_Leg_Raise`, `Reverse_Crunch`. Cabo: `Cable_Crunch`, `Standing_Rope_Crunch`, `Cable_Seated_Crunch`. Máquina: `Ab_Crunch_Machine`. Roda: `Ab_Roller`, `Barbell_Ab_Rollout_-_On_Knees`. Rotação: `Pallof_Press`, `Russian_Twist`, `Standing_Cable_Wood_Chop`. | — |
| **Máquinas típicas BR** | Crossover (acima); cadeira abdutora: `Thigh_Abductor`; cadeira adutora: `Thigh_Adductor`; peck deck: `Butterfly`; voador invertido: `Reverse_Machine_Flyes`; hack: `Hack_Squat`; Smith: **20 exercícios**; glúteo na polia: `One-Legged_Cable_Kickback`; glúteo 4 apoios: `Glute_Kickback` (peso corporal). | **Leg press horizontal, elevação lateral em máquina, hip thrust em máquina, graviton, pêndulo/V-squat, puxada articulada, glúteo em máquina (kickback machine)** |

**Leitura:** os básicos de barra, halter, cabo e Smith estão muito bem cobertos. As lacunas estão concentradas justamente nas **máquinas modernas comuns em academias brasileiras** (pêndulo, hip thrust, elevação lateral, graviton, leg press horizontal, glúteo máquina, articuladas). Essas 11 lacunas teriam de ser criadas do zero de qualquer forma: nome, instruções e mídia próprios.

---

## 8. Mapeamento para o nosso modelo

Script: `enum_mapping.py` (regras heurísticas v0 sobre nome, force, mechanic, músculo e categoria). Saída: `run/exercise-media-audit/enum_mapping.json`, com proposta por exercício.

### 8.1 `movement_pattern`

| Nosso valor | Regra proposta (resumo) | Dataset completo | P0 (211) |
|---|---|---:|---:|
| squat | nome com squat, lunge, leg press, step-up, split, hack ou pistol (exceto olímpicos) | 66 | 22 |
| hinge | deadlift, good morning, hip thrust, bridge, swing, hyperextension, pull-through, romanian, stiff | 51 | 14 |
| horizontal_push | bench, chest press, push-up, floor press, supinos no Smith e em máquina | 59 | 23 |
| vertical_push | shoulder/military/overhead/Arnold/push press, handstand, jerk; **dips** (decisão pendente: dip como vertical_push ou elbow_extension) | 53 | 14 |
| horizontal_pull | row/rows, face pull, inverted row (exceto upright) | 35 | 15 |
| vertical_pull | pulldown, pull-up, chin-up | 20 | 14 |
| knee_flexion | leg curl, glute-ham | 7 | 5 |
| knee_extension | leg extension | 2 | 2 |
| elbow_flexion | curl com primário biceps/forearms | 64 | 27 |
| elbow_extension | triceps + pushdown, extension, kickback, skull, Tate, JM press | 41 | 14 |
| shoulder_abduction | lateral raise (exceto rear) | 8 | 4 |
| calf | calf, donkey, primário calves | 16 | 10 |
| core | primário abdominals, crunch, plank, sit-up, leg raise, rollout, Pallof, twist | 80 | 19 |
| carry | farmer's walk, yoke, carry, sled drag | 8 | 0 |
| isolation | demais isolados (crucifixo, elevação frontal, crucifixo inverso, encolhimento, abdutora/adutora, kickback) | 76 | 21 |
| cardio | categoria cardio, esteira, bike, elíptico, escada | 20 | 0 |
| **sem padrão** | | **270** | **7** |

Não mapeiam limpo (270 no total): 123 de **stretching** (sugestão: novo valor `mobility` ou ficar fora do catálogo na Fase 1), 50 de **plyometrics** (sugestão: `plyometric`), 24 de **olympic weightlifting** (sugestão: `olympic`), 12 de **strongman**, e 59 de strength sem padrão claro. No P0, sobram 7 sem regra: pullovers (2), remadas altas (3), `Incline_Dumbbell_Flyes` (mechanic null) e `Glute_Kickback`. Resolver na curadoria: remada alta → `shoulder_abduction`; pullover → `isolation`.

Observação: `isolation` mistura padrões biomecânicos distintos (adução horizontal, flexão de ombro, abdução horizontal). Se o produto precisar de balanceamento de volume por padrão, vale considerar `horizontal_adduction`, `shoulder_flexion` e `horizontal_abduction`.

### 8.2 Equipamento

| free-exercise-db | Proposta | Observação |
|---|---|---|
| barbell | `barbell` | Exceto nomes com "EZ" → `ez_bar` |
| dumbbell | `dumbbell` | |
| e-z curl bar | `ez_bar` | Corrigir `Bodyweight_Flyes` |
| kettlebells | `kettlebell` | |
| cable | `cable` | |
| machine | `machine` (de placa) / **`smith_machine`** (20) / **`plate_loaded_machine`** ("Leverage" e T-bar, 8) | Separação essencial para o público BR |
| body only | `bodyweight` | |
| bands | `band` | |
| medicine ball | `medicine_ball` | |
| exercise ball | `stability_ball` | |
| foam roll | `foam_roller` | |
| other (122) / null (77) | **curadoria manual** | 198 ficam sem equipamento após as regras: 85 são alongamentos; 48 são strength + `other` (barra fixa, paralelas, banco romano, landmine, trenó…) |

Sugestão: equipamento **multivalorado** (`ExerciseEquipment` N:N, com `isPrimary`) para cobrir "halter + banco inclinado", "barra fixa", "paralelas", "banco Scott", "banco romano" e "landmine", que hoje somem dentro de `other`.

### 8.3 Músculos → IDs do SVG anatômico

| free-exercise-db | ID SVG | Limpo? |
|---|---|---|
| chest | `pectoralis_major` | Sim |
| biceps | `biceps` | Sim |
| triceps | `triceps` | Sim |
| forearms | `forearm` | Sim |
| traps | `trapezius` | Sim |
| lats | `latissimus_dorsi` | Sim |
| lower back | `erector_spinae` | Sim |
| abdominals | `rectus_abdominis`; acrescentar `obliques` quando o nome tiver oblique, twist, side bend, wood chop, windmill, side bridge ou Pallof | Parcial (por regra de nome) |
| glutes | `gluteus` | Sim |
| quadriceps | `quadriceps` | Sim |
| hamstrings | `hamstrings` | Sim |
| adductors | `adductors` | Sim |
| calves | `calves` | Sim |
| **shoulders** (129 primário + 210 secundário) | `anterior_deltoid` / `lateral_deltoid` / `posterior_deltoid` | **Não.** Precisa de desambiguação por nome. A regra v0 resolve a maioria; **109 ocorrências** continuam sem cabeça definida e exigem curadoria. |
| **middle back** (34 + 66) | aproximação `trapezius` | **Não.** Romboides e trapézio médio/inferior não têm ID. Sugestão: adicionar `rhomboids` (ou `trapezius_middle`) ao SVG. |
| **abductors** (8 + 35) | aproximação `gluteus` (glúteo médio) | **Não.** Sugestão: adicionar `gluteus_medius` ou `hip_abductors`. |
| **neck** (8 + 1) | — | **Não.** Sugestão: `neck` ou deixar fora (exercícios de pescoço são raros em P0). |

Resultado: com a regra v0, 39 exercícios ficam sem nenhum ID primário no SVG (alongamentos, pescoço, olímpicos com kettlebell). **No P0, 0.** Todos os 211 ganham pelo menos um ID primário.

---

## 9. Estratégia PT-BR

### 9.1 Volume medido

| Conteúdo | Dataset inteiro | P0 (211) |
|---|---:|---:|
| Nomes | 876 nomes / 2.887 palavras | 211 nomes / 689 palavras |
| Instruções | 3.738 passos / 103.207 palavras / 571.706 caracteres | 30.027 palavras |
| Instruções em strength + powerlifting | 81.843 palavras | — |

### 9.2 Recomendação

1. **Nomes: tradução curada.** Nomes de exercício são frases curtas e funcionais, não protegidas. Curadoria manual dos 211 P0 + 11 lacunas, no vocabulário de academia brasileira e com revisão de profissional de Educação Física (CREF). Estimativa: 2 a 3 min por nome, ≈ 8 a 11 h para P0. Para o resto do catálogo, se for importado: tradução assistida por LLM e revisão por amostragem.
2. **Instruções: redação original, não tradução.** Como o texto-fonte é cópia do Bodybuilding.com, traduzi-lo gera obra derivada do mesmo texto. Proposta:
   - gerar as instruções a partir de um **template estruturado próprio** (posição inicial, execução, respiração, erros comuns, ajustes de máquina), preenchido por profissional ou rascunhado por LLM **sem receber o texto do dataset como entrada** (só nome, equipamento e músculos);
   - revisão obrigatória por profissional para os P0;
   - estimativa: 15 a 20 min por exercício P0, ≈ 55 a 75 h para 222 exercícios.

   Isso também resolve o tom: o texto de origem é prolixo (mediana de 105 palavras e "Tip:" em 307 passos) e usa unidades imperiais. Ex.: em `Smith_Single-Leg_Split_Squat`, o banco fica "2-3 feet" atrás da barra.
3. **Aliases de busca** (tabela `ExerciseAlias`, com `locale` e `kind`: `common`, `regional`, `abbreviation`, `english`). Exemplos: "supino reto" / "supino plano" / "bench press"; "puxada alta" / "pulley frente" / "lat pulldown"; "remada cavalinho" / "T-bar"; "stiff" / "levantamento terra stiff"; "RDL"; "peck deck" / "voador"; "tríceps corda" / "tríceps pulley corda". Guardar o nome inglês do dataset como alias `english` ajuda usuários que vêm de apps em inglês.
4. **Slug próprio em pt-BR**, independente do id do dataset (ex.: `supino-reto-barra`). O `id` do free-exercise-db fica só em `sourceRef`.

### 9.3 Trinta exemplos de nomes P0 (vocabulário de academia brasileira)

| free-exercise-db | Nome pt-BR proposto | Aliases sugeridos |
|---|---|---|
| Barbell Bench Press - Medium Grip | Supino reto com barra | supino plano, bench press |
| Incline Dumbbell Press | Supino inclinado com halteres | supino inclinado halter |
| Decline Barbell Bench Press | Supino declinado com barra | |
| Smith Machine Bench Press | Supino reto no Smith | supino guiado |
| Butterfly | Voador (peck deck) | crucifixo máquina, peck deck |
| Cable Crossover | Crossover na polia alta | cross over, crucifixo na polia |
| Barbell Squat | Agachamento livre com barra | agachamento costas, back squat |
| Hack Squat | Agachamento no hack | hack machine |
| Split Squat with Dumbbells | Agachamento búlgaro com halteres | búlgaro |
| Leg Press | Leg press 45° | leg 45 |
| Barbell Deadlift | Levantamento terra | terra, deadlift |
| Romanian Deadlift | Levantamento terra romeno | RDL, terra romeno |
| Stiff-Legged Barbell Deadlift | Stiff com barra | stiff |
| Wide-Grip Lat Pulldown | Puxada alta aberta (pronada) | pulley frente, puxada frente |
| Underhand Cable Pulldowns | Puxada alta supinada | puxada supinada |
| V-Bar Pulldown | Puxada alta com triângulo | puxada neutra |
| Bent Over Barbell Row | Remada curvada com barra | remada curvada pronada |
| Seated Cable Rows | Remada baixa na polia | remada sentada, remada triângulo |
| T-Bar Row with Handle | Remada cavalinho | T-bar |
| One-Arm Dumbbell Row | Remada unilateral com halter | serrote |
| Side Lateral Raise | Elevação lateral com halteres | elevação lateral |
| Preacher Curl | Rosca Scott com barra | rosca scott |
| Triceps Pushdown - Rope Attachment | Tríceps na polia com corda | tríceps corda |
| EZ-Bar Skullcrusher | Tríceps testa com barra W | tríceps testa |
| Leg Extensions | Cadeira extensora | extensora |
| Lying Leg Curls | Mesa flexora | flexora deitada |
| Seated Leg Curl | Cadeira flexora | flexora sentada |
| Seated Calf Raise | Panturrilha sentado | gêmeos sentado, sóleo |
| Thigh Abductor | Cadeira abdutora | abdutora |
| Cable Crunch | Abdominal na polia (ajoelhado) | abdominal corda |

---

## 10. Base e mídia do GymCoach

Fontes: `gymcoach/data/exercise-media.json`, `lib/exercise-media.ts`, `lib/exercise-catalog.ts`, `components/exercises/exercise-media-dialog.tsx`, `prisma/schema.prisma`, `i18n/`, `next.config.js`, `README.md`, `CHANGELOG.md`. Verificação: `gymcoach_media_check.py` → `run/exercise-media-audit/gymcoach_media_check.json`.

### 10.1 Base de exercícios

- **Não usa dataset externo como catálogo.** É uma lista própria de **55 exercícios** em `lib/exercise-catalog.ts` (MIT), com nomes em inglês ("Barbell bench press", "Leg press (45 deg)"), `muscleGroup` (15 grupos + `OTHER`), `category` (`COMPOUND`, `ISOLATION`, `CARDIO`), `equipmentType` (7 valores), descanso padrão e dicas técnicas próprias em `notes`.
- **É semeada por usuário:** `Exercise` tem `userId` e `@@unique([userId, name])`. Não existe biblioteca global. A identidade é o nome digitado, que pode ser renomeado ou importado de Hevy, Strong ou Alpha Progression.
- **Idiomas:** `en`, `fr`, `ru` (`i18n/config.ts`). Dicionários de nomes de exibição só para `ru` e `fr` (`i18n/exercise-names.ts`). **Não há pt-BR.**
- Inconsistência documental: o README credita a ideia da biblioteca a "an MIT-licensed dataset (#308)" e, na linha seguinte, atribui as fotos ao free-exercise-db (Unlicense).

### 10.2 Mídia

| Aspecto | Achado medido |
|---|---|
| Origem | `public/exercise-media/free-exercise-db/` com **164 JPEG em 82 pastas** (+ `LICENSE.md` e `README.md` copiados), **10.937.330 B**. **Os 164 arquivos são idênticos (sha256) aos do free-exercise-db.** |
| Licença registrada | `data/exercise-media.json` → `source.license = "Public domain (Unlicense)"`, só no nível do dataset (sem autor nem licença por imagem). Vale o risco do §2. |
| Mapeamento | 82 grupos `datasetId → names[]`, cobrindo **109 nomes** (os 55 do catálogo + 54 nomes de importação no formato "Bench Press · Barbell", vindos do Alpha Progression). **24 dos 82 grupos são `approximate`**, ou seja, outra variante mostrada com o selo "Similar variant" (ex.: "Hip adduction machine" → `Cable_Hip_Adduction`, embora exista `Thigh_Adductor`; "Dumbbell Romanian Deadlift" → `Stiff-Legged_Dumbbell_Deadlift`). |
| Cobertura | 55/55 do catálogo padrão têm mídia; exercício customizado não tem e cai num link de busca no Wikimedia Commons. |
| Modelagem | **Não há entidade de mídia no Prisma.** A mídia é resolvida em tempo de execução por **nome normalizado** (`toLocaleLowerCase`) → caminho estático `/exercise-media/free-exercise-db/<datasetId>/{0,1}.jpg`. Renomear o exercício faz perder a mídia. |
| Entrega | Arquivo estático do Next (`middleware.ts` exclui `/exercise-media/`), `next/image` com `unoptimized`. O JPEG inteiro (~56 KB, 850 px) é usado até no thumbnail de 64 px. Sem WebP, sem thumbnail, sem S3/CDN. |
| Offline | O service worker gerado pelo build de auditoria (`_audit/run/gymcoach/public/sw.js`) **precacheia os 166 arquivos de `exercise-media/`** (≈ 10,9 MB) na instalação do PWA. Isso contraria a nossa regra de cachear só a mídia do treino atual. |
| UI | `ExerciseMediaDialog`: alterna início/fim a cada 1,4 s, com play/pause, botões de início/fim, selo "Similar variant", disclaimer e link de fonte/licença. Bom padrão de UX para "Ver execução". |
| `docs/media/` | 4 MP4 (`chat`, `debrief`, `program`, `session`, 400 KB no total) **gravados do próprio app** por `scripts/record.mjs` (Playwright). Não são mídia de exercício. Porém `docs/screenshots/catalog.png` (e provavelmente GIFs de sessão) **mostram as fotos do free-exercise-db**, então material de divulgação derivado herda o risco. |
| Mapa muscular | `components/progress/body-paths.ts`: silhueta **esquemática própria** (elipses, MIT), sem anatomia. Serve de protótipo, não do SVG anatômico especificado. |

### 10.3 É reaproveitável?

| Peça | Reaproveitar? | Observação |
|---|---|---|
| Código (MIT): dialog de execução, padrão de selo "variante aproximada", exibição de fonte/licença | **Sim**, mantendo o aviso MIT | Adaptar para `ExerciseMedia` e bottom sheet |
| Catálogo de 55 exercícios e `notes` (texto próprio, MIT) | **Sim, como referência** | Inglês; as dicas podem inspirar o template pt-BR |
| `data/exercise-media.json` (crosswalk nome → id) | Valor baixo | Útil só se o free-exercise-db for usado como `sourceRef` |
| **164 imagens** | **Não** | Mesmo risco do §2. **Remover de `public/` e do build se o GymCoach for a base.** Avaliar também a limpeza do histórico git do fork caso o repositório venha a ser distribuído. |
| Screenshots e GIFs do README | Não | Contêm as fotos |
| Modelo de dados (exercício por usuário, mídia por nome) | **Não** | Incompatível com `Exercise` global + `ExerciseMedia` |

---

## 11. Comparação de licenciamento de mídia

| | free-exercise-db | GymCoach | wger | openGym |
|---|---|---|---|---|
| Licença do código | Unlicense | MIT | AGPL-3.0+ | AGPL-3.0 (+ exceção para lojas de apps) |
| Licença declarada dos dados | Unlicense (tudo) | Herda "Unlicense" do free-exercise-db | Creative Commons **por registro** (padrão CC-BY-SA 4.0; também CC0 e ODbL) | Metadados via `hasaneyldrm/exercises-dataset` (MIT), originados do ExerciseDB v1 (AscendAPI) |
| Licença da mídia | Declarada Unlicense, **sem cadeia de direitos** | Idem (cópia idêntica) | **Por imagem e por vídeo**, modelo TASL: `license`, `license_author`, `license_title`, `license_object_url`, `license_derivative_source_url` (`wger/utils/models.py`, `exercises/models/image.py` e `video.py`) | **Declarada "não resolvida"** em `NOTICE.md` (Gym visual × AscendAPI); o openGym **não redistribui** e baixa do upstream em tempo de execução |
| Proveniência | Raspagem (Bodybuilding.com, por evidências) | Idem | Contribuição comunitária com autor e licença registrados por item | Conflito de titularidade documentado |
| Atribuição registrada | Nenhuma por imagem | Só nível dataset | Sim, por item, com link do autor e da obra derivada | Sim, em NOTICE |
| pt-BR | Não | Não | Plataforma traduzida; dados por idioma com licença própria | Nomes e instruções pt-BR gerados por LLM (AGPL, derivados) |
| Uso comercial no nosso produto | **Não** (mídia); metadados com ressalvas | **Não** (mídia); código sim | Fora de escopo por decisão do projeto. Seria juridicamente o mais rastreável (CC-BY-SA permite uso comercial com atribuição e ShareAlike nas adaptações) | **Não** (AGPL + mídia sem dono claro) |
| Lição para o nosso modelo | Licença do repositório ≠ licença da mídia | Registrar fonte por item, não por dataset | **Modelo de referência para `ExerciseMedia`** (TASL por item, `is_main`, `style`: line/3D/low-poly/photo, largura/altura) | Notice honesto e não redistribuir o que não se pode licenciar |

---

## 12. Pipeline de importação e `exercise_media_coverage`

### 12.1 Importação dos metadados (catálogo)

1. **SOURCE:** fixar o commit do free-exercise-db (`f00c92c`) e guardar o sha256 do `dist/exercises.json`.
2. **SELECT:** subconjunto curado (211 P0 → ≈ 209 após remover as duplicatas semânticas `Decline_Smith_Press` e `Triceps_Overhead_Extension_with_Rope`) + 11 exercícios novos para as lacunas. Total ≈ 220 na Fase 1.
3. **TRANSFORM:**
   - `Exercise.id`: UUID/cuid próprio; `slug` pt-BR próprio;
   - `sourceRefs`: `[{source: 'free-exercise-db', ref: '<id>', commit}]`;
   - `movement_pattern`, equipamento N:N e `ExerciseMuscle` (primário/secundário com ID SVG) via `enum_mapping.py` v0, com **revisão manual obrigatória dos 211** (as 109 ocorrências de `shoulders` sem cabeça e os 7 sem padrão);
   - nome pt-BR, aliases e instruções originais (§9).
4. **LOAD:** upsert idempotente por `(source, sourceRef)`. Nunca por nome.
5. **Não importar:** `instructions` em inglês e `images`.

### 12.2 Pipeline de mídia (para mídia própria ou licenciada)

`SOURCE → VALIDATE → HASH → DEDUPLICATE → OPTIMIZE → UPLOAD → CREATE ExerciseMedia`, idempotente:

| Etapa | Proposta concreta (aprendizados da auditoria) |
|---|---|
| SOURCE | Toda entrada traz um manifesto: `source`, `sourceUrl`, `license` (SPDX ou contrato), `attribution`, `rightsHolder`, **termo de cessão de imagem do modelo**, data. Sem manifesto, rejeita. Mídia do free-exercise-db só entra com `license=UNVERIFIED` e `isActive=false`, e só no ambiente local. |
| VALIDATE | MIME pela **assinatura dos bytes**, não pela extensão (como em `image_audit.py`). Rejeitar arquivo truncado (sem EOI/IEND). Largura mínima de 1.080 px para `START/END_POSITION` (75 imagens do free-exercise-db reprovariam com 600 px). Proporção registrada. Rejeitar GIF animado em tipos estáticos. **SVG: sanitizar** (remover `<script>`, `on*`, `href` externos). |
| HASH | sha256 dos bytes de origem, guardado em `ExerciseMedia` (campo novo `checksumSha256`). Chave de idempotência: `(exerciseId, type, sortOrder, checksumSha256)`. |
| DEDUPLICATE | Exata por sha256 (o free-exercise-db teria barrado 25 arquivos e os 6 pares início = fim). Recomendado também hash perceptual (pHash) no pipeline real (sharp/libvips no Node), para pegar a mesma foto recomprimida. |
| OPTIMIZE | Remover EXIF/GPS. Converter para sRGB. WebP (AVIF opcional): `start.webp` e `end.webp` com no máx. 1.280 px no lado maior; `cover.webp` recortado 4:3 ou 1:1; thumbnails de 160 e 320 px. SVG mantido (minificado e sanitizado). |
| UPLOAD | S3-compatível em `exercise-media/<slug>/cover.webp`, `start.webp`, `end.webp`, `sequence-01.webp`, `muscle-diagram.svg` (convenção da especificação). **Atenção ao cache:** com nome fixo, substituir a mídia exige versionar a URL (`?v=<sha8>` gravado no banco) ou incluir o hash na chave. Recomendo `start.<sha8>.webp` + `Cache-Control: immutable`. |
| CREATE | Upsert de `ExerciseMedia`. Desativar (`isActive=false`) a versão anterior em vez de apagar. Histórico, programas e PRs não são afetados porque referenciam `Exercise.id`. |

Campos que sugiro adicionar à entidade `ExerciseMedia`: `checksumSha256`, `mimeType`, `bytes`, `reviewStatus` (`PENDING`/`APPROVED`/`REJECTED`), `rightsHolder`, `modelReleaseRef`, `licenseVerifiedAt`, `licenseVerifiedBy` e `style` (`photo`/`illustration`/`3d`/`line`, como no wger).

### 12.3 Métrica `exercise_media_coverage`

```sql
WITH m AS (
  SELECT e.id,
    COALESCE(bool_or(em.type = 'COVER'), false)                                        AS has_cover,
    COALESCE(bool_or(em.type = 'START_POSITION') AND bool_or(em.type = 'END_POSITION'), false) AS has_start_end,
    COALESCE(bool_or(em.type = 'MUSCLE_DIAGRAM'), false)
      OR EXISTS (SELECT 1 FROM "ExerciseMuscle" xm
                 WHERE xm."exerciseId" = e.id AND xm.role = 'PRIMARY' AND xm."svgId" IS NOT NULL) AS has_diagram,
    COALESCE(bool_or(em.type IN ('VIDEO','GIF','IMAGE_SEQUENCE')), false)              AS has_motion
  FROM "Exercise" e
  LEFT JOIN "ExerciseMedia" em ON em."exerciseId" = e.id AND em."isActive"
  GROUP BY e.id)
SELECT count(*) AS total,
       count(*) FILTER (WHERE has_cover)     AS com_capa,
       count(*) FILTER (WHERE has_start_end) AS com_inicio_fim,
       count(*) FILTER (WHERE has_diagram)   AS com_diagrama,
       count(*) FILTER (WHERE has_motion)    AS com_video
FROM m;
```

Decisão pendente: o diagrama dinâmico conta como coberto quando há `ExerciseMuscle` primário com ID SVG (proposta acima) ou só quando há arquivo `MUSCLE_DIAGRAM`?

**Projeção inicial** (catálogo Fase 1 ≈ 220 = 209 do free-exercise-db + 11 novos):

| Cenário | Total | Com capa | Com início/fim | Com diagrama | Com vídeo |
|---|---:|---:|---:|---:|---:|
| A: importar a mídia do free-exercise-db (**não recomendado**, só referência) | 220 | 209 (95,0 %) | 208 (94,5 %), por causa de `Reverse_Grip_Bent-Over_Rows` | 0 | 0 |
| B0: recomendado, no go-live, sem mídia própria ainda | 220 | 0 (0 %) | 0 (0 %) | 220 (100 %) se o SVG anatômico for antecipado; senão 0 | 0 |
| B1: recomendado + lote de mídia própria para N exercícios | 220 | N | N | 220 | 0 |

Exemplos de B1: N = 60 (os mais usados nos programas-modelo) → 27,3 %; N = 120 → 54,5 %. Fonte de N: foto própria com termo de cessão, ilustração encomendada ou pacote licenciado.

Volume de referência para o cache offline (medido no free-exercise-db): um par início/fim P0 pesa em média 2 × 66,5 KB ≈ 133 KB em JPEG. Um treino de 8 exercícios ≈ 1,06 MB antes da conversão para WebP. O GymCoach precacheia 10,9 MB, a biblioteca inteira.

---

## 13. Riscos e decisões pendentes

### Riscos

| # | Risco | Prob. | Impacto | Mitigação |
|---|---|---|---|---|
| R1 | Uso das fotos do free-exercise-db/GymCoach em produção gerar notificação extrajudicial, remoção da loja ou ação por direito autoral e de imagem | Alta, se usadas | Alto | Não usar; remover `public/exercise-media/` do fork do GymCoach; checklist de mídia no CI (falhar build se houver arquivo sem manifesto de licença) |
| R2 | Tradução das instruções gerar obra derivada de texto protegido | Média | Médio | Redação original a partir de template (§9.2) |
| R3 | Lançar a Fase 1 sem imagem de execução nos P0 | Alta (se mídia própria não for contratada a tempo) | Médio (UX) | Antecipar o SVG anatômico; instruções e dicas fortes; priorizar mídia própria dos ~60 mais usados |
| R4 | Curadoria de músculos e padrões subestimada (109 ocorrências de `shoulders` sem cabeça, 198 sem equipamento, 270 sem padrão) | Média | Médio | Restringir a Fase 1 ao subconjunto P0, onde a regra v0 já resolve 97 % |
| R5 | Lacunas de máquinas BR (11) percebidas como "app gringo" | Média | Médio | Criar os 11 do zero com mídia própria logo no primeiro lote |
| R6 | Cache de CDN servir mídia antiga após substituição (chave fixa) | Média | Baixo | Chave com hash ou `?v=` |
| R7 | SVG enviado por admin com script (XSS) | Baixa | Alto | Sanitização obrigatória no VALIDATE |
| R8 | Herdar o precache de 10,9 MB do GymCoach no PWA | Alta, se o fork for mantido como está | Médio (dados móveis, instalação) | Excluir `exercise-media` do precache; cache por treino |

### Decisões pendentes

1. **Jurídico:** validar a recomendação de usar só os metadados do free-exercise-db e definir a política de atribuição (manter `sourceRef` e crédito "taxonomia inicial derivada de free-exercise-db"?).
2. **Fonte da mídia da Fase 1:** foto própria (com termo de cessão de imagem e de local), ilustração/3D encomendada ou pacote comercial licenciado (ex.: o dataset pago do wrkout.xyz, ExerciseDB/AscendAPI ou Gym visual). Cada um exige contrato que permita embarcar e exibir comercialmente e armazenar em S3 próprio. Atenção: o openGym documenta um conflito de titularidade entre AscendAPI e Gym visual.
3. **Antecipar o SVG anatômico** para a Fase 1? E quais IDs acrescentar: `rhomboids` / `trapezius_middle`, `gluteus_medius`, `neck`?
4. **Enum `movement_pattern`:** incluir `mobility`, `plyometric` e `olympic`? Dips como `vertical_push` ou `elbow_extension`? Remada alta como `shoulder_abduction`? Desdobrar `isolation`?
5. **Equipamento N:N** com `isPrimary` e a lista final de equipamentos (incluindo `smith_machine`, `plate_loaded_machine`, `bench`, `pull_up_bar`, `dip_station`, `landmine`, `trap_bar`).
6. **Definição de "com diagrama"** na métrica (dinâmico × arquivo).
7. **Escopo do catálogo da Fase 1:** só os P0 (~220) ou também os 411 exercícios de strength/powerlifting fora do P0? Estes custariam ≈ 50 a 70 h a mais (7 a 10 min cada: nome assistido + instrução original assistida, com revisão por amostragem).
8. **Fork do GymCoach:** remover as imagens só do working tree ou também reescrever o histórico git antes de qualquer distribuição?

---

## Anexo A — Scripts e artefatos

Todos em Python 3.11, **somente stdlib**, executados com `python -I`, sem rodar código dos repositórios.

| Script (`_audit/scripts/`) | O que faz | Saída (`_audit/run/exercise-media-audit/`) |
|---|---|---|
| `fedb_dataset_stats.py <repo>` | Valida enums contra `schema.json`; distribuições; estatísticas de instruções; imagens referenciadas × disco; consistência com `dist/` | `fedb_dataset_stats.json` |
| `image_audit.py <dir>` | Assinatura real (JPEG/PNG/GIF/WebP); dimensões via SOF/IHDR/VP8; integridade (EOI); APPn/COM; sha256; duplicatas exatas entre e dentro de exercícios | `fedb_image_audit.json` |
| `fedb_names_dupes.py <repo>` | Quase-duplicatas por nome (3 normalizações + difflib); variações de grafia; ids/nomes inconsistentes | `fedb_names_dupes.json` |
| `instruction_similarity.py <repo> [limiar]` | Duplicatas semânticas por Jaccard das instruções | `instruction_similarity.json` |
| `p0_coverage.py <repo>` | Mapeamento curado P0 → ids; valida existência, imagens, início = fim e ausência de instruções | `p0_coverage.json` |
| `enum_mapping.py <repo>` | Regras v0 para `movement_pattern`, equipamento e IDs SVG; contagem do que não mapeia | `enum_mapping.json`, `enum_mapping_summary.txt` |
| `gymcoach_media_check.py <gymcoach> <fedb>` | Compara por sha256 a mídia vendorizada do GymCoach com o free-exercise-db; cobertura do catálogo | `gymcoach_media_check.json` |

Artefato auxiliar: `fedb_names.tsv` (lista id/nome/equipamento/categoria/músculo, gerada a partir de `dist/exercises.json` para a curadoria manual do P0).

Reprodução (a partir de `_audit/`):

```bash
python -I scripts/fedb_dataset_stats.py   repos/free-exercise-db            run/exercise-media-audit/fedb_dataset_stats.json
python -I scripts/image_audit.py          repos/free-exercise-db/exercises  run/exercise-media-audit/fedb_image_audit.json
python -I scripts/fedb_names_dupes.py     repos/free-exercise-db            run/exercise-media-audit/fedb_names_dupes.json
python -I scripts/instruction_similarity.py repos/free-exercise-db 0.6      run/exercise-media-audit/instruction_similarity.json
python -I scripts/p0_coverage.py          repos/free-exercise-db            run/exercise-media-audit/p0_coverage.json
python -I scripts/enum_mapping.py         repos/free-exercise-db            run/exercise-media-audit/enum_mapping.json
python -I scripts/gymcoach_media_check.py repos/gymcoach repos/free-exercise-db run/exercise-media-audit/gymcoach_media_check.json
```

## Anexo B — Referências externas consultadas (2026-10-08)

- `github.com/wrkout/exercises.json`: README, `CONTRIBUTING.md` (seção Exercise Images), issues #305 e #308 (comentários via API do GitHub).
- `github.com/yuhonas/free-exercise-db`: issues #2, #12 e #13 (via API do GitHub) e lista de issues e PRs.
- `bodybuilding.com/exercises/barbell-bench-press-medium-grip` e `bodybuilding.com/exercises/leverage-iso-row`: texto conferido por mecanismo de busca; acesso direto redireciona (301) para página comercial da Bodybuilding.com.
- `openGym/NOTICE.md` (local): procedência ExerciseDB/AscendAPI × Gym visual.
- `wger/utils/models.py`, `wger/exercises/models/image.py` e `video.py`, `wger/README.md` (local): modelo TASL por item e licença padrão CC-BY-SA 4.0.
