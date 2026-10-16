# GYM Peg — regras de design (ler antes de qualquer mudança de front)

Referência visual: `docs/design/mocks/GYM Peg v2.dc.html`. Tokens: `docs/design/tokens.css`.

## Identidade: cinco regras
1. **Bloco lime de borda a borda** (`bg-primary`, sem raio, sem margem lateral) marca o que importa agora: treino do dia, descanso, treino concluído. No máximo um por tela.
2. **O treino é uma ficha.** Série, kg, reps e RIR ficam numa `<table>` de verdade. A linha atual usa `bg-row-current` e as células editáveis aparecem como campos brancos.
3. **Marca-texto amarelo = recorde.** `bg-pr` atrás do número (raio xs, padding 3×6). Nunca em ícone, card ou botão.
4. **Itálico = IA.** Tudo que a IA escreve vai em Archivo itálico, precedido do rótulo "Coach" (12px/600, `text-brand`). Número calculado nunca vai em itálico.
5. **Uma família só: Archivo.** Texto em largura normal (100%), pesos 500 e 600. Números (carga, reps, tempo, volume, datas da ficha) em Archivo expandida: `font-num`, `font-stretch:112%–125%`, `tabular-nums`. Não use outra fonte.

## Proibido
- Brilho, glow, `box-shadow` decorativo, degradê, glassmorphism, `backdrop-blur`, blobs, grid ou ruído de fundo.
- Sparkle, varinha, cérebro ou estrela para representar a IA.
- Botão pílula, `rounded-full` em botão, chip ou card. A única forma redonda é o botão de concluir série (64 px) e o avatar.
- Ícone dentro de quadrado ou círculo colorido. Ícone na frente de cada metadado.
- Card para tudo, card dentro de card, conjunto de tiles de KPI iguais, anel de progresso.
- Botão flutuante (FAB), barra inferior flutuante.
- Cor solta do Tailwind (`amber-600`, `emerald-700`, `slate-*`…). Toda cor vem de token.
- `transition-all`, `duration-300` por padrão, fade-up ao rolar, número contando a partir do zero, `animate-pulse` como loading.
- Texto genérico ("Desbloqueie", "Eleve", "Tudo o que você precisa", "Comece agora"). Número, depoimento ou estatística inventados.

## Forma
- Raios: 4 (etiqueta, marca-texto) · 8 (filtro, célula, miniatura) · 12 (botão, campo, nota de sugestão) · 16 (a única superfície branca da tela).
- Separação por fio (`border-border`, 1 px) e espaço, não por caixa. Uma superfície branca por tela, no máximo.
- Sombra só em bottom sheet e diálogo.
- Toque: 64 px (`h-touch-session`) em todo controle do treino ativo e do descanso; 44 px no resto.

## Cor
- Lime é sempre preenchimento, com texto `#111111`. Texto da marca sobre claro: `text-brand` (#637F00) ou `text-brand-strong`.
- Acentos (pr, warmup, deload, warning, info, destructive) são sempre fundo com texto `#111111`. Como texto, use `warning-text` e `destructive-text`.
- Texto secundário: `text-muted-foreground` (#646464). `#8D8D8D` (`subtle`) só em elementos não textuais.
- Mapa de calor: heat-0 não treinado · heat-1 abaixo do MEV · heat-2 na faixa · heat-3 acima do MRV. Sempre com legenda e rótulo.

## Movimento
- Curva `ease-out-quart`. 120 ms para toque, 200 ms para abrir/fechar sheet, 1 s linear só no esvaziamento do descanso.
- Fim do descanso: um flash lime de 300 ms. Com `prefers-reduced-motion`, sem animação: só a cor fixa e a vibração.

## Semântica e acessibilidade
- `<button>` para ações, `<a>` para navegação, `<nav>`, `<main>`, `<header>`, `<table>`, `<ol>`/`<ul>`, `<label>`. Nada de div clicável.
- `:focus-visible` com contorno de 2 px `ring`, offset 2.
- Botões só com ícone têm `aria-label`. Abas têm `role="tablist"`/`aria-selected`. O check da série tem `aria-pressed`.
- Contraste AA no tema claro. Testar em 320, 375, 390 e 430 px e numa coluna central de 672 px no desktop.

## Teste final de cada tela
Tire o logo e troque o lime por azul. Se a tela ainda servir para qualquer app, refaça.
