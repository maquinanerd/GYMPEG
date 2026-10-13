# Prompt para o Claude Code — front do GYM Peg (Rodada 1)

Cole o bloco abaixo no Claude Code, na raiz do repositório, depois de extrair o zip.

```text
Você vai implementar a nova identidade visual e o novo front do GYM Peg (Next.js + Tailwind + shadcn, PWA, pt-BR). A referência está em docs/design/. Leia antes de começar:
- docs/design/README.md (decisões e regras)
- docs/design/tokens.css (tokens HSL: :root = claro, .dark = escuro opcional)
- docs/design/tailwind.gympeg.ts (extensão do theme)
- docs/design/mocks/*.dc.html (mocks de referência; abra no navegador para ver. São referência visual, NÃO copie o código deles para o app)

REGRAS GERAIS
1. Tema CLARO é o padrão e é o que todo mundo vê. O escuro existe só como opção em Perfil › Tema. No ThemeProvider (next-themes): defaultTheme="light", enableSystem={false}, attribute="class". Remova qualquer forçar-dark atual. themeColor do manifest e <meta name="theme-color"> = #F9F9F9.
2. Não use cores soltas do Tailwind (amber-600, emerald-700 etc.). Toda cor sai de um token. Procure e substitua no repositório inteiro (rg "text-(amber|emerald|red|green|yellow|orange)-").
3. Sem glassmorphism, sem glow, sem gradiente. Única exceção: a sombra "shadow-ai" no botão/esfera lime que marca conteúdo da IA. Números calculados pelo app nunca usam a esfera.
4. Lime (#CCFF00, token primary) só como PREENCHIMENTO, com texto primary-foreground (#111111) por cima. Texto/ícone na cor da marca sobre fundo claro usa o token brand (#637F00). Texto secundário usa muted-foreground (#646464 no claro).
5. Alvo de toque: 64 px (h-btn-session) em todo controle do treino ativo e do descanso; 44 px mínimo no resto.
6. Números que mudam ao vivo: font-variant-numeric: tabular-nums (classe tabular-nums).
7. Textos em pt-BR, números no formato brasileiro (82,5 kg; 18.420 kg), datas "qui., 09/10". Use Intl.NumberFormat("pt-BR").

PASSO 1 — Fundamentos
- app/globals.css: substitua os blocos :root e .dark do shadcn pelo conteúdo de docs/design/tokens.css (mantenha os @tailwind e qualquer outra regra existente que não seja de cor).
- tailwind.config.ts: importe gympegTheme de docs/design/tailwind.gympeg.ts (ou copie o objeto) e faça merge em theme.extend. Mantenha os nomes shadcn existentes (background, card, primary…). Remova o token antigo text-timer e use text-timer novo (72px).
- Fonte: next/font/google Urbanist (pesos 400, 500, 600, 700), variable "--font-urbanist", aplicada no <html>.
- Ícones: troque lucide-react por @phosphor-icons/react, peso "fill" por padrão ("bold" só para chevrons, check e +/-). Crie components/ui/icon.tsx como wrapper para centralizar o peso e o tamanho.
- Marca: corrija "GymCoach" em app/(app)/layout.tsx:22 e em qualquer outro lugar (rg -i gymcoach). Wordmark = "GYM" Urbanist 600 + "Peg" Urbanist 400. Símbolo = public/brand/mark.svg (traço único, currentColor). Crie components/brand/logo.tsx.
- PWA: use os ícones em public/icons/ (icon-192, icon-512, icon-maskable-512 com purpose "maskable", apple-touch-icon 180, favicon.svg + favicon-32). Atualize o manifest e o <head>.

PASSO 2 — Navegação (corrige o achado 3 da auditoria)
- Remova as duas faixas fixas do topo (barra de offline/idioma/tema/sair + 8 abas).
- Crie components/nav/bottom-nav.tsx: barra flutuante, left/right 16px, bottom 28px + safe-area, altura 68px (h-nav), raio pill, fundo bg-nav, 4 itens: Início (/), Treinos (/programs, com segmentado Programas · Histórico · Exercícios no topo, linkando /programs, /history, /exercises), Evolução (/progress), Perfil (/settings). Item ativo = pílula bg-nav-active com texto nav-active-foreground, ícone 22px + label 12px/600. Inativos nav-foreground.
- Botão flutuante da IA (components/coach/coach-fab.tsx): 56px, redondo, bg-primary, shadow-ai, ícone Sparkle, acima da barra (bottom 110px, right 20px), abre /coach. Presente em todas as telas principais.
- Coach e Chat viram uma seção só (/coach com abas Conversa · Análises); /chat redireciona.
- Idioma, tema e sair vão para Perfil. Offline vira o indicador de sync (abaixo).
- No treino ativo (/session/[id]) a barra e o FAB somem; o FAB vai para o cabeçalho do treino.
- Ao fim do conteúdo de cada tela principal deixe padding-bottom ≥ 140px para não ficar sob a barra.

PASSO 3 — Componentes base (components/ui/, estilizados com tokens)
- Button: variantes primary (bg-primary, h-btn, rounded-pill, text-subtitle), secondary (bg-secondary), ghost; tamanho "session" = h-btn-session.
- IconButton redondo 48px (64px no treino): fundo card com borda border.
- SyncIndicator (components/offline/sync-indicator.tsx) no lugar onde estaria um sino: nuvem CloudCheck + ponto brand (sincronizado), CloudArrowUp + badge warning com o número da outbox (pendente), CloudSlash cinza (offline). Ligue na outbox existente.
- Segmented, Chip, Tag (pílula 28px bg-pill com ponto colorido), StatTile (com anel SVG: trilho track, progresso primary), ListRow, ProgressSegments (barras 4px, primary feito/atual, track restante), BottomSheet (vaul ou Radix Dialog), WheelPicker (seletor de rolagem para carga/reps/peso).
- MuscleMap (components/progress/muscle-map.tsx): portar docs/design/mocks/MuscleMap.dc.html para React. Props: active (lista de músculos), levels (mapa músculo → 0..3 para o mapa de calor), size. Cores pelos tokens heat-0..heat-3; regiões com aria-label. Substituir a rampa âmbar→vermelho de components/progress/muscle-map-card.tsx por esses 4 níveis (achado 6).

PASSO 4 — Telas desta rodada (siga os mocks pixel a pixel no tema claro)
A) Início (/) — mocks/HomeScreen.dc.html
   Cabeçalho (avatar com iniciais, "Bom dia," + nome, SyncIndicator) → "Esta semana" (7 pílulas 46×88, hoje em primary, treinado com ponto brand, planejado com contorno) → card dominante "Próximo treino" (rounded-lg, Tag com semana do ciclo ou "Descarga" em deload, título text-title, meta com ícones, motivo, MuscleMap à direita, botão primary largura total, link secundário) com variantes: próximo, em andamento ("Retomar treino"), sem programa, conta nova → "Sua semana" (2 StatTiles: treinos e séries) → 1 insight calculado (ícone em círculo warning/info, sem esfera) → "Recordes recentes" (ListRow com troféu bg-pr, antes → depois) → tile de peso (média 7 dias). O card de próximo treino deve ser o elemento visualmente dominante (spec §56). Use os dados reais que já alimentam a home hoje.
B) Treino ativo (/session/[id]) — mocks/WorkoutScreen.dc.html
   - Cabeçalho fixo único (sem os 97px de cromo atuais): voltar 48px, "Treino A" + "Superiores · Exercício 1 de 6", FAB do coach (abre o chat com o treino anexado), SyncIndicator; abaixo ProgressSegments por exercício. Remova top-[97px] de components/session/session-runner.tsx:796.
   - Faixa horizontal de chips de exercício (48px; atual em primary; A1/A2 para superset).
   - Card do exercício: nome text-title, meta "3 × 6‑8 • RIR 2 • 180 s" (use hífen não-quebrável U+2011 nas faixas), "Último treino (02/10): …" em caption, bloco de sugestão bg-suggestion/text-suggestion-foreground com carga, motivo e "Como foi calculado ›"; tags deload/prontidão quando houver; botão "…" abre BottomSheet (substituir só neste treino / também no programa, adicionar, remover, ver execução, calculadora de anilhas).
   - Aquecimento: pílulas 64px com borda warmup; ao registrar ficam preenchidas bg-warmup.
   - Séries: linha com número em círculo (borda border; brand quando feita), três campos 64px bg-pill com carga/reps/RIR em text-number tabular-nums (tocar abre BottomSheet com WheelPicker, −/+ e "Aplicar"), botão de concluir 64px (contorno quando pendente; bg-primary com check quando feito). Série atual com borda primary. PR ao vivo = Tag bg-pr "PR 1RM est.". Mantenha toda a lógica atual (sugestão pré-preenchida, tipos de série, RPE/RIR, PR, supersets, cardio, registro por texto/IA): só a apresentação muda.
   - Rodapé fixo: anterior 64px, "Concluir" primary flex-1 64px, próximo 64px, + safe-area.
   - O descanso continua funcionando como hoje; só troque cores para tokens (anel primary sobre track, texto text-timer). A tela de descanso completa é da Rodada 2.

PASSO 5 — Limpeza e verificação
- rg por cores hardcoded, "GymCoach", lucide-react e border-primary/40 bg-primary/5 (achado 4: cada tipo de card tem seu estilo; não reaproveite esse).
- Verifique contraste AA no tema claro (texto ≥ 4.5:1), respeito a prefers-reduced-motion e navegação por teclado.
- Rode lint, typecheck e testes. Confira em 390×844 e numa coluna central de até 672px no desktop.
- Não mude regras de domínio, cálculos, rotas de API nem o outbox. Não desenhe telas fora desta rodada.

Entregue em commits pequenos: (1) tokens+fonte+ícones, (2) marca+PWA, (3) navegação, (4) componentes base, (5) Início, (6) Treino ativo, (7) limpeza.
```
