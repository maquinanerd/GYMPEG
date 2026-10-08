# Adendo 01 — Imagens e mídia dos exercícios

> Recebido em 2026-10-08. Complementa `00_MASTER_SPEC.md` (seções 6, 7, 17, 28).

Subsistema completo de mídia para exercícios. O sistema não mostra só nome, séries e reps: cada exercício pode exibir visualmente como o movimento é executado. **A biblioteca visual é parte estrutural do produto, não decoração.**

## 1. Objetivo

Cada exercício suporta: imagem de capa, posição inicial, posição final, sequência de imagens, GIF/animação, vídeo demonstrativo, diagrama anatômico dos músculos trabalhados.

Ex.: Supino reto — imagem inicial, imagem final, músculo principal peitoral, secundários tríceps e deltoide anterior, instruções de execução, erros comuns.

## 2. Dataset inicial

Avaliar `yuhonas/free-exercise-db` (https://github.com/yuhonas/free-exercise-db) como dataset inicial para exercícios, imagens, equipamentos, músculos, instruções e categorias. **Não assumir que tudo será importado.** Auditar: licença, estrutura, quantidade, qualidade das imagens, duplicidades, exercícios ausentes, nomenclatura, consistência, resolução, possibilidade de uso comercial.

Entregável: `docs/EXERCISE_MEDIA_AUDIT.md`.

## 3. Regra de licenciamento

Não importar imagens/GIFs aleatórios da internet. Não copiar mídia de Hevy, Fitbod, Boostcamp, MuscleWiki, sites comerciais ou outros apps sem licença explícita compatível. **Toda mídia guarda origem e licença.**

## 4. Modelo de dados

```ts
ExerciseMedia {
  id: string
  exerciseId: string
  type: "COVER" | "START_POSITION" | "END_POSITION" | "IMAGE_SEQUENCE"
      | "GIF" | "VIDEO" | "MUSCLE_DIAGRAM"
  objectKey: string
  thumbnailKey?: string
  source?: string
  sourceUrl?: string
  license?: string
  attribution?: string
  width?: number
  height?: number
  durationMs?: number
  sortOrder: number
  isPrimary: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
```

URL externa não é fonte principal permanente. Mídia aprovada fica no nosso Object Storage.

## 5. Storage

S3-compatible (R2, S3, MinIO ou outro). Não depender do filesystem local do container. Estrutura sugerida:

```
exercise-media/
  bench-press/
    cover.webp
    start.webp
    end.webp
    sequence-01.webp
    sequence-02.webp
    muscle-diagram.svg
```

## 6. Processamento

Ao importar: validar MIME, validar dimensões, gerar thumbnail, converter para WebP/AVIF quando apropriado, manter SVG quando vetor, eliminar duplicados por hash, gerar metadata, otimizar tamanho. Pipeline **idempotente**:

```
SOURCE → VALIDATE → HASH → DEDUPLICATE → OPTIMIZE → UPLOAD → CREATE ExerciseMedia
```

## 7. Tela do exercício (ficha visual)

Nome, imagem principal, início/fim do movimento, músculo principal, secundários, equipamento, instruções, erros comuns, dicas, histórico do usuário naquele exercício.

```
SUPINO RETO
[ imagem inicial ] → [ imagem final ]
Peitoral
Secundários: Tríceps, Deltoide anterior
Equipamento: Barra + banco
COMO EXECUTAR
1. posicionar as escápulas;
2. retirar a barra;
3. descer de maneira controlada;
4. pressionar até retornar à posição inicial.
```

## 8. Durante o treino

Não ocupar espaço com imagens. Mostrar apenas thumbnail, nome, séries, carga, reps. Botão **`Ver execução`** abre bottom sheet/modal/página com imagens grandes, sequência, instruções, músculos, vídeo se existir.

## 9. Image sequence

Mais de duas imagens (ex.: 1 posição inicial, 2 fase excêntrica, 3 ponto inferior, 4 fase concêntrica, 5 posição final), permitindo animação controlada pela UI no futuro.

## 10. Animação

Preparar GIF, WebP animado, MP4, WebM e sequência controlada pela UI. Preferir formatos eficientes; não obrigar GIF (WebM/MP4 tende a ser bem mais eficiente).

## 11. Diagrama muscular

Tipo `MUSCLE_DIAGRAM`, idealmente SVG próprio com vistas frontal e traseira, destacando primário e secundários. **Preferível** montar dinamicamente:

```
Exercise → ExerciseMuscle → Muscle SVG IDs → frontend colore dinamicamente
```

## 12. Mapa anatômico

Conjunto próprio de SVGs anatômicos. IDs de exemplo: `pectoralis_major, anterior_deltoid, lateral_deltoid, posterior_deltoid, biceps, triceps, forearm, trapezius, latissimus_dorsi, erector_spinae, rectus_abdominis, obliques, gluteus, quadriceps, hamstrings, adductors, calves`. Reutilizado em ficha do exercício, dashboard, volume por músculo, treino do dia, mapa corporal.

## 13. Tradução

Exercícios importados com nome PT-BR (ex.: Barbell Bench Press → Supino reto com barra; Dumbbell Lateral Raise → Elevação lateral com halteres; Lat Pulldown → Puxada alta). Guardar nome original para busca, importação e compatibilidade.

## 14. Busca

Considerar nome PT-BR, nome inglês, aliases, músculo, equipamento. Ex.: "puxada" encontra puxada alta, puxada neutra, puxada supinada etc.

## 15. Administração (futuro)

Painel para alterar/adicionar/remover mídia, mudar ordem, definir capa, editar attribution e license, adicionar vídeo, substituir mídia ruim — sem alterar código.

## 16. Exercícios customizados

Usuário cria exercício com nome, músculo, equipamento, imagem opcional, vídeo opcional, notas. **Mídia customizada é privada por padrão.**

## 17. Performance

Não carregar mídia pesada no treino sem necessidade: thumbnail, lazy loading, responsive images, Next/Image quando apropriado, CDN/cache do object storage. Treino rápido mesmo com milhares de exercícios.

## 18. Offline

Cachear a mídia do treino atual: `Workout → exercícios → thumbnails → imagens principais → cache local`. **Não** baixar a biblioteca inteira no dispositivo.

## 19. Fase 1

Importar dataset aprovado; exercícios; imagem inicial e final; thumbnail; músculos; equipamentos; PT-BR; S3; `ExerciseMedia`; ficha do exercício; botão `Ver execução`.

## 20. Fase 2

SVG anatômico; muscle diagram dinâmico; animações; vídeos; painel administrativo; substituição gradual das imagens do dataset por mídia própria.

## 21. Mídia própria

Qualquer imagem open source pode ser substituída por material próprio. `Exercise.id` nunca depende da mídia (`Exercise → ExerciseMedia[]`). Trocar mídia não altera histórico, programas, workout sets, analytics, PRs.

## 22. Prioridade visual

P0: supino, agachamento, leg press, levantamento terra, puxadas, remadas, desenvolvimento, elevação lateral, roscas, tríceps, extensora, flexora, panturrilha, abdominais. Depois expandir.

Métrica `exercise_media_coverage`, ex.: Total 850 · Com capa 820 · Com início/fim 790 · Com diagrama muscular 850 · Com vídeo 120.

## 23. Resultado esperado

O usuário abre qualquer exercício relevante e entende visualmente onde começar, como executar, qual equipamento usar e quais músculos são trabalhados.
