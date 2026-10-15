# Prompt para o Claude Code — front do GYM Peg (v2)

Cole o bloco abaixo no Claude Code, aberto na raiz do repositório.

```text
Você vai reimplementar o front do GYM Peg (Next.js + Tailwind + shadcn, PWA offline-first, pt-BR) seguindo o design v2.

CONTEXTO: a Rodada 1 já está no código (tokens em app/globals.css, Urbanist em app/layout.tsx, tema claro padrão). A v2 SUBSTITUI a Rodada 1. Onde a v1 e a v2 divergirem, vale a v2: Archivo no lugar de Urbanist, barra inferior encostada no lugar da flutuante, sem botão flutuante e sem esfera ou sparkle da IA, raios 4/8/12/16 no lugar das pílulas.

LEIA ANTES DE TOCAR EM QUALQUER ARQUIVO, nesta ordem:
1. DESIGN-RULES.md (raiz). São regras obrigatórias. Releia antes de cada tela.
2. docs/design/tokens.css e docs/design/tailwind.gympeg.ts.
3. docs/design/mocks/: abra "GYM Peg v2.dc.html" num servidor estático (npx serve docs/design/mocks) e cada tela .dc.html. Os mocks são a referência visual, pixel a pixel, no tema claro. Não copie o código deles: reimplemente em React/Tailwind com os componentes do projeto.

NÃO MUDE: regras de domínio, cálculos (sugestão de carga, 1RM, volume, PR, MEV/MRV), API, schema, outbox/offline, autenticação, rotas existentes. Só apresentação, navegação e componentes visuais.

PASSO 1 — Fundamentos
- app/globals.css: substitua os blocos :root e .dark pelos de tokens.css. Mantenha o resto do arquivo.
- tailwind.config.ts: faça merge de gympegTheme em theme.extend.
- Fonte única: Archivo. Em app/layout.tsx, troque Urbanist por Archivo({ subsets: ['latin','latin-ext'], axes: ['wdth'], style: ['normal','italic'], variable: '--font-archivo', display: 'swap' }) e aplique a variável no <html>. Remova --font-urbanist e qualquer import de Urbanist (rg -i urbanist). Texto em largura 100% (pesos 500/600); números com font-num + font-stretch 112–125% + tabular-nums. Crie <Num> em components/ui/num.tsx (prop stretch: 112 | 118 | 125, default 125) para padronizar.
- Tema: next-themes com defaultTheme="light", enableSystem={false}, attribute="class". O escuro só é ativado em Perfil › Tema. theme-color #F9F9F9.
- Ícones: troque lucide-react por @phosphor-icons/react, peso "regular" por padrão, "fill" só no item ativo da navegação, "bold" para chevrons, check e +.
- Marca: corrija todo "GymCoach" (rg -i gymcoach) para "GYM Peg". Wordmark: "GYM" Urbanist 600 + "Peg" Urbanist 400. Símbolo: public/brand/mark.svg. Ícones do PWA: public/icons/* no manifest e no <head>.

PASSO 2 — Navegação
- Remova as duas faixas fixas do topo e a barra de 8 abas.
- components/nav/tab-bar.tsx: barra encostada embaixo (NÃO flutuante), fundo card, fio superior, padding-bottom env(safe-area-inset-bottom), 5 itens: Início (/), Treinos (/programs), Evolução (/progress), Coach (/coach), Perfil (/settings). Item ativo: ícone fill num retângulo 52×28 raio 8 bg-primary, rótulo 12/600 foreground. Inativo: ícone regular, rótulo 12/500 muted-foreground. aria-current="page".
- Treinos: abas com sublinhado (Programas · Histórico · Exercícios) apontando para /programs, /history e /exercises.
- Coach: /coach com abas Conversa · Análises; /chat redireciona para /coach.
- Idioma, tema e sair vão para /settings. O estado offline vira <SyncStatus> (etiqueta raio 4: "Salvo" cinza, "N a enviar" bg-warning, "Sem conexão" cinza), ligado à outbox existente.
- Em /session/[id] a barra some. Remova top-[97px] de components/session/session-runner.tsx.

PASSO 3 — Componentes (components/ui/, todos com tokens, sem defaults do shadcn)
- Button: primary (bg-primary, h-btn, rounded-md, 17/600), ink (bg-ink text-ink-foreground), outline (border-input), ghost; size "session" = h-touch-session. Estados: hover (escurece 4% via filter brightness), active (translateY 1px), focus-visible (ring 2px), disabled (opacity .4), loading (rótulo mantido + spinner 16px).
- Tag: h-6, rounded-xs, px-2, 12/600, variantes primary, pr, warmup, deload, warning, muted.
- Highlight (marca-texto de recorde): span bg-pr rounded-xs px-1.5 py-0.5 com <Num>.
- Tabs (sublinhado 2px foreground, 16px, role=tablist), FilterChip (h-10 rounded-sm border-input; selecionado bg-ink text-ink-foreground; aria-pressed).
- ListRow (fio superior, min-h 52–68px, grid título/meta/valor). Section (h2 20/600 + conteúdo, separada por fio, sem caixa).
- LimeBlock (full bleed, bg-primary, padding 20) para o "agora".
- ProgressBar (4–6px, track/ink). WeekStrip (7 casas 38px raio 6: feito bg-ink, hoje bg-primary com borda ink, planejado tracejado). Calendar do mês no mesmo padrão.
- SetTable (ficha do treino), SetCheck (64px redondo; pendente borda input; feito bg-primary com check), WheelPicker em BottomSheet (vaul) para editar carga/reps/RIR.
- MuscleMap: porte docs/design/mocks/MuscleMap.dc.html para components/progress/muscle-map.tsx (props active | levels, size, theme light|lime). Substitua a rampa âmbar→vermelho de components/progress/muscle-map-card.tsx pelos tokens heat-0..3 com legenda.
- CoachText: parágrafo itálico com rótulo "Coach". ProposedChange: superfície branca com antes riscado → depois e botão "Revisar ajuste" (leva à pré-visualização existente; nunca aplica direto).

PASSO 4 — Telas (siga o mock correspondente)
- Início (mocks/Inicio.dc.html): saudação + SyncStatus → LimeBlock do treino do dia (semana do ciclo, título em 2 linhas, MuscleMap theme lime, lista dos exercícios com séries, botão ink "Iniciar treino"/"Retomar treino", motivo + "Trocar treino") → Esta semana (WeekStrip + 2 números com ProgressBar) → 1 alerta calculado (Tag warning + texto) → Recordes recentes (Highlight) → Peso com sparkline. Use os dados reais que a home já recebe; os estados sem programa e conta nova seguem o mesmo LimeBlock com outro texto.
- Mídia do exercício (usar as imagens que o sistema já tem, free-exercise-db, quadros 0 = início e 1 = fim): no Treino ativo, imagem grande no topo do exercício, largura total, aspect-ratio 3/2, raio 12, quadros alternando a cada 1,5 s (parado por padrão com prefers-reduced-motion), etiqueta lime "Início"/"Fim", botões 44px brancos raio 8 para pausar e ampliar; tocar na imagem também amplia. O visualizador ampliado (reaproveite o diálogo atual) ocupa a tela: imagem com object-fit contain, controles 64px (início · pausar · fim), miniaturas dos dois quadros, equipamento e crédito da fonte. Miniaturas: 52px na lista de Exercícios e 64px no Treino do programa, raio 8, object-fit cover. Sem imagem: fundo muted com o MuscleMap.
- Treino ativo (mocks/TreinoAtivo.dc.html): cabeçalho (minimizar, título, SyncStatus compacto, coach, menu) → segmentos por exercício → abas de exercício (A1·A2 para superset) → nome, prescrição, último treino → nota de sugestão bg-accent com motivo e "Como foi calculado" → SetTable com aquecimento (Tag warmup "Aq") e séries; PR ao vivo como Highlight "PR" → "Adicionar série" → "A seguir". Rodapé fixo: anterior 64 · botão primary "Registrar série N" com "82,5 kg × 7" embaixo · próximo 64. "Finalizar treino" fica no menu. Mantenha toda a lógica atual (tipos de série, RPE/RIR, substituição, anilhas, cardio, registro por texto).
- Descanso (mocks/Descanso.dc.html): tela cheia; um bloco lime sobe do rodapé com altura = tempo restante / total (transition height 1s linear; reduced-motion: sem transição); timer text-timer font-num; próxima série com motivo; −15 s · Pausar · +15 s (64px, bg-card) e "Pular descanso" ink 64px. Fim: flash lime 300ms + vibração (já existentes).
- Treino concluído (mocks/Resumo.dc.html): LimeBlock com data/hora, título, duração · séries · volume → aviso offline quando aplicável → recordes (Highlight) → por exercício com variação (text-brand quando subiu) → observação → rodapé "Copiar treino" outline + "Salvar e sair" primary.
- Treinos: Programas, Treino do programa, Histórico, Exercícios (mocks com os mesmos nomes).
- Evolução (mocks/Evolucao.dc.html): abas Semana · Treino · Corpo · Recordes. Gráficos em SVG próprio ou Recharts estilizado: linha ink 2.5px, grade com fio, sem área preenchida, sem degradê; ponto de recorde bg-pr com borda ink.
- Coach (mocks/Coach.dc.html) e Perfil (mocks/Perfil.dc.html). "Excluir conta" em text-destructive-text, com confirmação digitando o e-mail.

PASSO 5 — Estados
Para cada tela: vazio (texto específico + uma ação), carregando (skeleton nas formas reais, cor muted, sem pulse: use opacidade estática), erro (mensagem + "Tentar de novo"), offline ("Você pode treinar normalmente. Tudo fica salvo neste aparelho.").

PASSO 6 — Auditoria final (obrigatória)
- rg por: urbanist, lucide-react, GymCoach, rounded-full (exceto SetCheck/avatar), shadow- (exceto sheet/dialog), bg-gradient, backdrop-blur, transition-all, animate-pulse, text-(amber|emerald|red|green|yellow|orange|slate|zinc)-, border-primary/40. Zero ocorrências fora das exceções.
- Rode lint, typecheck e testes. Confira 320/375/390/430 px e desktop (coluna de 672px).
- Aplique o teste final do DESIGN-RULES.md em cada tela e corrija o que falhar.

Commits pequenos e nesta ordem: fundamentos · marca/PWA · navegação · componentes · Início · Treino ativo + Descanso + Concluído · Treinos · Evolução · Coach + Perfil · estados · auditoria.
```
