# ROTEIRO DE EXECUÇÃO — Redesign TrackHub

> Oito fases, na ordem. Cada uma tem prompt pronto para colar, critério de aceite objetivo e a armadilha conhecida. `01-PROMPT-MASTER.md` precisa estar salvo como `CLAUDE.md` na raiz antes de qualquer prompt daqui.
>
> **A ordem importa.** Cada fase depende da anterior. Pular a Fase 0 ou a Fase 1 significa refazer as fases 4 a 6 inteiras depois.

---

## Fase 0 — Auditoria e renomeação

**Por que primeiro:** você não sabe o tamanho do problema. E a renomeação Traffik → TrackHub precisa acontecer antes de qualquer trabalho visual, senão você reescreve componentes que ainda carregam o nome antigo e retrabalha.

```
Parte A — auditoria. Não modifique nenhum arquivo ainda.

Produza docs/auditoria.md com:

1. Árvore de rotas e páginas, com contagem de linhas de cada uma.
2. Inventário de componentes: caminho, número de usos, e se é shadcn original,
   shadcn modificado ou componente próprio.
3. Toda cor hexadecimal, rgb() ou hsl() escrita direto em componente — arquivo,
   linha, valor, contagem total e as 10 mais repetidas.
4. Todo tamanho de fonte em uso, agrupado por valor, com contagem.
5. Componentes duplicados ou quase idênticos que deveriam ser um só.
6. Onde o estado de filtro global vive hoje (contexto, props, URL, local).
7. Os 10 arquivos maiores, com uma frase sobre o que cada um faz demais.
8. Toda ocorrência de "Traffik", "traffik" e "TRAFFIK": arquivo, linha e contexto
   (nome de componente, texto de interface, rota, metadado, pacote, asset).

Termine com os 5 problemas estruturais que mais vão atrapalhar o redesign,
em ordem de gravidade.

Parte B — renomeação. Depois que eu revisar a auditoria:

Troque Traffik por TrackHub em todo o repositório, respeitando a caixa de cada
ocorrência. Inclui nome de pacote, título de aba, metadados de Open Graph,
textos de interface, nomes de componente e de arquivo, e-mails transacionais
e comentários. Não troque dentro de dados históricos ou migrações já aplicadas.
Liste os arquivos alterados e sinalize qualquer ocorrência ambígua em vez de
adivinhar. Os assets de logo e favicon eu substituo manualmente — apenas
aponte os caminhos.
```

**Aceite:** você consegue dizer o número exato de cores hardcoded — essa é a métrica que vai a zero na Fase 1 — e `grep -ri traffik` retorna vazio fora de dados históricos.

---

## Fase 1 — Fundação de tokens

**Por que agora:** todo o resto se apoia nisso. Um token errado aqui vira quinhentos ajustes na Fase 5.

```
Implemente a fundação de tokens da seção 5 do prompt master. Só a fundação —
nenhuma tela, nenhum componente de domínio.

1. Em app/globals.css, defina os tokens em OKLCH sob :root (claro) e .dark
   (escuro), nas camadas: superfície (background, background-alt, surface,
   surface-hover), border, texto (text, text-secondary, text-muted), marca
   (primary, primary-hover, accent), semântica (success, warning, danger) e
   canal (meta, tiktok, google, outros).
   Use OKLCH e não HSL, para que a diferença de luminosidade percebida entre
   os dois temas se mantenha consistente. Mantenha os hexadecimais originais
   em comentário ao lado de cada token, para conferência.

2. Defina os dois gradientes: --gradient-brand (90deg, azul → ciano, para logo,
   CTA e estado ativo) e --gradient-chart (180deg, derivado, para preenchimento
   de área). E o token --glow-live conforme a seção 6.2.

3. Estenda tailwind.config.ts mapeando cada token para utilitário. Depois disso
   deve ser possível escrever bg-surface, text-secondary, border-border,
   text-success, bg-channel-meta, shadow-live.

4. Configure Instrument Sans e JetBrains Mono via next/font com display swap e
   as variáveis --font-sans e --font-mono.

5. Implemente a escala tipográfica como utilitários compostos (.text-display,
   .text-metric-xl, .text-title, .text-label, .text-micro etc.), cada um já
   embutindo tamanho, altura, peso e tracking. Os de número incluem
   font-variant-numeric: tabular-nums.

6. Tokens de raio, elevação e duração de transição.

7. Densidade como atributo no elemento raiz
   ([data-density="compact"|"default"|"comfortable"]) sobrescrevendo variáveis
   de padding, altura de linha e escala de fonte de dado. Componente nenhum
   deve conhecer densidade — só consome as variáveis.

8. Crie a rota /design-system exibindo todos os tokens: swatches com nome e
   valor, os dois gradientes, o glow, a escala tipográfica renderizada, raios e
   elevações. É a página de verificação visual de todas as fases seguintes.

9. Rode um teste de contraste sobre a paleta e reporte qualquer par
   texto/fundo abaixo de 4.5:1 nos dois temas, antes de eu aprovar.

Não toque em nenhuma tela existente nesta fase.
```

**Aceite:** `/design-system` renderiza nos dois temas e alternar tema não quebra contraste em nada.

**Armadilha:** é tentador já ir consertando componente enquanto define token. Não vá. A Fase 1 termina sem nenhuma tela alterada.

---

## Fase 2 — Primitivos

```
Reestilize os primitivos do shadcn/ui para os tokens da Fase 1. Reestilizar,
não recriar — mantenha a API e o comportamento Radix de cada um.

Componentes: Button, Input, Select, Combobox, Switch, Checkbox, Radio, Badge,
Card, Tooltip, Popover, DropdownMenu, Tabs, Sheet, Dialog, Toast, Skeleton,
Separator, ScrollArea.

Regras:
- Button com variantes primary, secondary, ghost, danger e tamanhos sm/md/lg.
  Primary usa primary sólido. Danger usa danger. Nenhuma outra usa cor saturada.
  Existe uma variante cta que usa --gradient-brand, e ela é permitida no máximo
  uma vez por tela.
- Altura de controle: 32 compacto, 36 padrão, 40 confortável — via densidade.
- Foco: anel primary com offset 2px, visível em todos, inclusive dentro de tabela.
- Card com variantes de superfície (surface e surface-hover) e slots opcionais
  de cabeçalho e rodapé. Título de card usa .text-title — o nível tipográfico
  que não existe hoje.
- Popover, Dropdown, Dialog e Toast usam surface-hover e são os ÚNICOS com sombra.
- Skeleton usa surface-hover com pulso, e respeita prefers-reduced-motion.
- Nenhum primitivo usa accent. Ciano é dado, não controle.

Adicione cada componente a /design-system com todas as variantes, tamanhos e
estados (repouso, hover, foco, ativo, desabilitado, carregando).

Ao final rode npx tsc --noEmit e reporte a contagem de cores hardcoded restantes.
```

**Aceite:** nenhum primitivo contém hexadecimal, e nenhum usa `accent`.

---

## Fase 3 — Shell da aplicação

**A fase que devolve espaço.** Você recupera cerca de 100px de altura em todas as telas.

```
Reconstrua o shell conforme a seção 9 do prompt master.

1. Rail lateral de 56px que expande para 240px no hover, com fixação persistida
   em localStorage. Fundo background-alt. Ícone com tooltip em repouso, ícone e
   rótulo expandido. Item ativo: barra de 2px em primary na borda esquerda,
   fundo surface-hover, texto text. Nunca fundo azul sólido.
   Topo: logo TrackHub com --gradient-brand. Abaixo: seletor de área.
   Meio: navegação. Rodapé: conta e perfil.

2. Barra de contexto de 48px substituindo header e faixa de filtros, ambos
   removidos. Esquerda: nome da tela em .text-title. Centro: filtros globais
   (período, conta, produto, fonte). Direita: LiveIndicator com timestamp da
   última sincronização, notificações, tema, densidade.
   O título de página de 48px sai: consome altura e não informa nada que o item
   ativo do rail já não informe.

3. LiveIndicator usando --glow-live: ponto em accent com pulso de 2s e o anel
   do glow. Quando a sincronização falha, troca para danger e o glow some.
   Esta é a primeira aplicação do glow — trate-a como referência para as demais.

4. Estado dos filtros globais na URL como query params, via useGlobalFilters.
   Trocar de tela preserva. A URL é compartilhável.

5. Command palette em ⌘K / Ctrl+K: navegação, busca de campanha e criativo por
   nome, troca de período, ações rápidas. Agrupada por seção, atalho visível à
   direita de cada item, navegável só por teclado.

6. Remova a barra flutuante do canto inferior direito. Liste o que havia nela e
   para onde cada item foi.

7. Container de conteúdo com máximo de 1600px, centralizado acima disso.

Aplique o shell a todas as rotas sem alterar o conteúdo delas. As telas vão
ficar feias dentro do shell novo — é esperado, é a Fase 5.
```

**Aceite:** meça a distância do topo da janela até o primeiro pixel de dado. Precisa cair de ~150px para ~48px.

---

## Fase 4 — Componentes de dados

**A fase de maior valor.** É aqui que as duas assinaturas nascem.

```
Construa os componentes de domínio da seção 10. Comece pelos quatro que
aparecem em toda tela:

1. DeltaValue — variação com seta e cor, com semântica invertível. Prop
   polarity: "higher-is-better" | "lower-is-better". Faturamento, ROAS e Lucro
   usam a primeira; Gasto, CPA e CPC usam a segunda — uma queda de 20% no CPA
   é verde. Cor nunca sozinha: sempre acompanha seta.

2. BreakEvenBar — barra de 3px sob um número, com entalhe marcando o equilíbrio,
   preenchida em success ou danger conforme o lado. Props: value, breakEven, max.

3. MetricCard — rótulo em .text-label caixa de frase (não maiúscula), número em
   .text-metric-xl tabular, DeltaValue, sparkline opcional, BreakEvenBar
   opcional, tooltip com a fórmula. Estados de carregando, vazio e erro.

4. Tema de gráficos Recharts em um único arquivo: eixo, grade, tooltip, legenda
   e cursor derivados dos tokens. Grade em border, sem linha vertical. Tooltip
   na superfície de overlay. Nenhum gráfico define cor própria.
   Série única usa accent com preenchimento --gradient-chart. Série múltipla por
   plataforma usa as cores de canal. warning nunca aparece como série.

Depois, a assinatura estrutural:

5. BreakEvenChart — envelope sobre AreaChart e LineChart que adiciona a
   ReferenceLine tracejada de break-even, preenche a área acima em success a
   12% e abaixo em danger a 12%, e rotula a linha em .text-micro na ponta
   direita. Todo gráfico de ROAS, CPA e Lucro passa por ele.

Depois:

6. DataTable — primeira coluna fixa, cabeçalho fixo, densidade, ordenação,
   seleção múltipla, rodapé de totais fixo, seletor de colunas com persistência,
   zebra sutil por surface-hover a baixa opacidade, hover de linha, estado vazio.
   Cabeçalho em .text-micro maiúscula (um dos dois lugares permitidos).
   Números em mono, alinhados à direita. Texto à esquerda.
   Linha selecionada usa a variante estática do glow, sem pulso.

7. ChannelBadge, StatusPill, SourceAttribution, LiveIndicator, EmptyState.

Adicione todos a /design-system com dados realistas em reais, incluindo caso de
prejuízo, caso de zero e caso de valor ausente.
```

**Aceite:** um `MetricCard` de ROAS com valor 0,19 e break-even 1,0 comunica prejuízo instantaneamente, sem que você leia o número.

**Armadilha:** deixar cada gráfico escolher a própria cor. Se isso acontecer, você reconstruiu o problema #2 do diagnóstico com azul no lugar do roxo.

---

## Fase 5 — Telas

Uma tela por PR. **Nesta ordem**, do mais usado para o menos:

| # | Tela | O problema específico dela |
|---|---|---|
| 1 | Dashboard | 12 KPIs achatados; funil e globo brigam por atenção; o gradiente vive aqui e só aqui |
| 2 | Gerenciador de Anúncios | tabela de 20 colunas ilegível; hierarquia conta → campanha → conjunto → anúncio |
| 3 | Criativos | grade de miniaturas sem hierarquia de ranking; métrica pequena demais |
| 4 | Regras | canvas de nós Quando → E → Então; glow durante execução |
| 5 | Integrações | 85% de tela vazia; fluxo de conexão de gateway; glow no disparo de webhook |
| 6 | Notificações | agrupamento por severidade e ação direta |
| 7 | Taxas e Despesas | onde o break-even é configurado — alimenta a assinatura |

Prompt padrão, trocando o nome da tela:

```
Reconstrua a tela [NOME] usando exclusivamente os componentes das fases 2 a 4.
Nenhum componente novo sem justificar por que nenhum existente serve.

1. Antes de codar, descreva em texto a hierarquia de informação da tela: o que
   precisa ser lido em 2 segundos, o que em 10, e o que só sob demanda.
   Espere minha confirmação.

2. Implemente em grid de 12 colunas. Peso visual proporcional à importância —
   não é permitido que 12 KPIs tenham o mesmo tamanho.

3. Os quatro estados: carregando com skeleton no formato do conteúdo real,
   vazio com direção e ação, erro com causa e caminho de saída, e sucesso.

4. Reveja a copy conforme a seção 11. Rótulo em caixa de frase. Botão nomeia o
   que acontece.

5. Verifique antes de fechar: nenhum hexadecimal; nenhum .text-micro fora de
   cabeçalho de tabela e eyebrow; nenhuma cor primary dentro de gráfico ou
   célula; nenhum accent em botão ou navegação; glow apenas nos casos da lista
   fechada; proporção aproximada de 80/15/5 mantida.
```

**Sobre o Dashboard:** os 12 KPIs atuais não são iguais em importância. Sugira uma linha primária com 4 (Faturamento, Gasto, ROAS, Lucro) em `MetricCard` grande com sparkline e break-even, e os 8 restantes em faixa secundária compacta sem sparkline. O gráfico de Desempenho é o único lugar da aplicação com `--gradient-chart`.

**Sobre o Gerenciador:** 20 colunas simultâneas é ilegível por definição. Proponha conjuntos pré-definidos (Performance, Custo, Conversão, Tudo) com o seletor de colunas guardando escolha própria. Nome e status fixos à esquerda.

---

## Fase 6 — Tema claro e acessibilidade

```
1. Audite o tema claro em todas as telas. Ele foi definido na Fase 1 mas nunca
   verificado em uso real. Procure especificamente: sombra fraca demais em fundo
   branco, borda invisível, o ciano accent com contraste insuficiente sobre
   branco, e as cores de canal saturadas demais.

2. Verifique contraste de tudo nos dois temas. 4.5:1 em texto corrente, 3:1 em
   texto grande e em elemento gráfico portador de informação. Liste o que
   reprovou com o valor medido e corrija ajustando o token — nunca com exceção
   local.

3. O glow de Live Data precisa de tratamento próprio no tema claro: ciano a 38%
   sobre branco quase não aparece. Proponha uma variante com anel mais opaco e
   menos difusão, e valide comigo antes de aplicar.

4. Confirme que nenhuma informação depende só de cor. Variação leva seta, status
   leva ícone, série leva rótulo. Teste as quatro cores de canal em deuteranopia
   e protanopia.

5. Navegação completa por teclado: ordem de tabulação lógica, foco visível, trap
   em modal, Esc fecha, tabela navegável por setas.

6. prefers-reduced-motion: reduce desliga toda animação, inclusive o pulso do
   LiveIndicator (mantendo o anel) e o pulso de skeleton.

7. Semântica de leitor de tela: rótulo em ícone-botão, live region em valor que
   atualiza sozinho, resumo textual alternativo em cada gráfico.
```

---

## Fase 7 — Acabamento

```
1. Passe a copy inteira conforme a seção 11: todo rótulo, botão, estado vazio,
   mensagem de erro, tooltip e toast. Liste antes e depois.

2. Estados vazios: cada um com uma frase de direção e um botão. Nenhum pode ser
   só constatação de ausência.

3. Skeletons no formato do conteúdo real, nunca retângulo genérico.

4. Erros que dizem o que houve e como resolver, com ação quando existir.

5. Varredura final: hexadecimais restantes; .text-micro fora dos dois lugares
   permitidos; primary dentro de dado; accent em controle; --gradient-brand em
   mais de um elemento por tela; --gradient-chart fora do gráfico primário do
   Dashboard; glow fora da lista fechada; sombra fora de overlay; qualquer
   ocorrência remanescente de "Traffik". Liste tudo e corrija.

6. Escreva docs/design-system.md: como usar cada token, quando criar componente
   novo, as regras duras de cor e tipografia, e a lista fechada do glow.
```

---

## Painel de controle

Cole isto ao final de cada fase para pegar desvio cedo:

```
Antes de fechar a fase, responda objetivamente:

1. Quantas cores hardcoded restam? (era N na Fase 0)
2. Algum componente novo duplica um existente?
3. .text-micro maiúscula aparece fora de cabeçalho de tabela e eyebrow? Onde?
4. primary aparece dentro de gráfico ou célula de tabela? Onde?
5. accent aparece em botão ou item de navegação? Onde?
6. O glow de Live Data aparece fora da lista fechada da seção 6.2? Onde?
7. --gradient-brand aparece mais de uma vez na mesma tela? Onde?
8. Sombra aparece fora de popover, dropdown, modal e toast? Onde?
9. Algum estado assíncrono sem os quatro casos desenhados?
10. Sobrou alguma ocorrência de "Traffik"?
11. Decisões que você tomou e que não estavam especificadas — uma frase cada.
```

---

## Sequenciamento

Fases 0 a 2 são pré-requisito absoluto. A Fase 3 pode correr em paralelo com a 4 se houver duas pessoas — o shell e os componentes de dados não se tocam. A Fase 5 depende das duas. As fases 6 e 7 são sequenciais e finais.

Se o tempo apertar, corte da Fase 5 para baixo: entregue Dashboard e Gerenciador redesenhados e deixe as outras cinco telas no shell novo com componentes antigos. Fica inconsistente mas funcional, e as duas telas que importam ficam prontas.

O que **não** dá para cortar: as fases 0, 1 e 2. Sem elas você recria exatamente a bagunça que está tentando desfazer, só que em azul.