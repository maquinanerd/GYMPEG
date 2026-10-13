# GYM Peg — handoff de design (Rodada 1)

Data: 2026-10-13 · Escopo: marca, tokens, navegação, Início e Treino ativo.

## Como extrair
Extraia o zip na raiz do repositório. Ele só cria arquivos novos:
- `docs/design/` — tokens, extensão do Tailwind, prompt do Claude Code, mocks
- `public/icons/` — ícones do PWA (símbolo 1c, "Ciclo")
- `public/brand/mark.svg` — símbolo em traço único (`currentColor`)

Nenhum arquivo existente é sobrescrito, exceto `public/icons/*` se já existirem com o mesmo nome.

## Decisões
- **Tema claro é o padrão.** O escuro fica disponível só em Perfil › Tema (`.dark`).
- **Fonte:** Urbanist (OFL). Escala: Timer 72 · Display 32 · Número 28 · Title 24 · Heading 22 · Subtitle 17 · Body 16 · Caption 14 · Small 12. Pesos: 600 nos títulos, 500 no texto.
- **Ícones:** Phosphor (MIT), peso fill.
- **Lime `#CCFF00`** só como preenchimento, com `#111111` por cima. Para texto da marca no claro, use `#637F00`.
- **Acentos:** PR amarelo `#FFD509` · info/sync ciano `#32D7FF` · aquecimento salmão `#FF9459` · descarga lavanda `#C99EFE` · atenção laranja `#FF9F0A` · erro vermelho `#FF443B`. No tema claro, todos só como preenchimento, com texto `#111111`.
- **Mapa de calor:** heat-0 não treinado · heat-1 abaixo do MEV · heat-2 na faixa · heat-3 acima do MRV. Sempre acompanhado de rótulo.
- **IA:** a esfera/botão lime com sombra suave marca só conteúdo da IA.
- **Medidas:** raios 28 (card dominante) / 24 (card) / 16 (miniatura) / pílula. Botões 56 px (64 px no treino). Barra inferior 68 px, flutuante.

## Mocks
Abra `docs/design/mocks/GYM Peg Rodada 1.dc.html` no navegador (precisa de um servidor estático, ex.: `npx serve docs/design/mocks`). Os mocks são referência visual, não código de produção.

## Pendente
- Rodada 2: protótipo do fluxo de treino (descanso, conclusão, resumo).
- Rodada 3–4: Evolução, Treinos, Coach, Perfil e estados.
- Confirmar o direito de uso do layout das pranchas PulseFit antes do lançamento comercial.
