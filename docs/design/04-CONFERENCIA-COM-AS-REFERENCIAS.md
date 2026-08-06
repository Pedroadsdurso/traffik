# 04 — CONFERÊNCIA COM AS REFERÊNCIAS

> **A regra:** a imagem de referência é o padrão. Um elemento só sai dela, ou entra sem estar nela, se estiver marcado 🔧 neste documento — o que significa decisão explícita do dono do produto.
>
> Este documento tem precedência sobre o `03-ARQUITETURA-DE-TELAS.md` em qualquer divergência. O `03` descreve estrutura; este descreve o inventário do que precisa existir.

**Legenda**

| | |
|---|---|
| ✅ | já está no plano ou já foi feito |
| ❌ | está na referência e **não** estava no plano — entra |
| 🔧 | diverge da referência por **decisão do dono**, com o motivo |

**Decisões tomadas que valem para tudo:**

1. **Sub-navegação na sidebar vence abas horizontais.** Onde a referência mostra abas na página para trocar de seção (`Todas / Meta Ads / Google Ads`), usamos filhos expansíveis na sidebar. Abas **dentro** de um painel de detalhe continuam existindo (ex.: `Visão geral / Configurações / Sincronização / Logs`) — essas não são navegação, são detalhe.
2. **Mesclagem no Dashboard:** tudo da imagem 1 **mais** o que já construímos.
3. **Heatmap e break-even ficam**, mesmo não estando nas referências.

---

## SHELL — sidebar e header

Referências: todas as 11 imagens. **✅ FEITO em 06/08/2026.** Os 4 arquivos antigos
(`Sidebar` 173 · `Header` 122 · `DashboardShell` 125 · `integracoes/layout` 43 =
**463 linhas**) foram **deletados**, não editados. Reescrito em 9 arquivos novos
em `components/tk/`.

### Sidebar

| Elemento | Status |
|---|---|
| Logo no topo | ✅ **feito** — wordmark expandido, símbolo quando colapsado |
| Botão de recolher (`«` / `Recolher`) — colapsa para ícones | ✅ **feito** — 236px → 60px, estado em `localStorage`. 🔧 botão explícito, **não** hover: o `01` pede hover, o `04` vence, e abrir sozinho ao passar o mouse de raspão é pior |
| Grupos rotulados na navegação | ✅ **feito** — colapsado o rótulo vira um traço, senão os 3 grupos viram um bloco só |
| Item ativo com **fundo sólido** e marcador, não só cor de texto | ✅ **feito** — tingimento + barra de 2px + `aria-current` |
| Item pai expansível com filhos inline e filho ativo marcado | ✅ **feito** — 🔧 o pai da seção aberta fica com **barra e cor, sem preenchimento**; o preenchimento marca a PÁGINA, e ela é uma. Com os dois preenchidos, "Integrações" e "Webhooks" ficavam idênticos |
| Badge de contagem no item (Notificações `3`) | ✅ **feito** — lê o mesmo `notifUnread` do sino; colapsado vira um ponto |
| Rodapé: seletor de área de trabalho | ✅ **feito** — saiu do topo. "Gerenciar áreas" mora dentro dele |
| Rodapé: bloco de perfil — avatar, nome, e-mail, menu `⋮` | ✅ **feito** |
| Rodapé: **medidor de plano e uso de eventos** (`Pro · 1.250 / 5.000` com barra) | ⛔ **FORA — não há backend.** `grep -iE "plan\|billing\|subscription\|quota\|usage"` no `schema.prisma` devolve 4 acertos e os quatro são `PENDING_BILLING_INFO`, status de conta da Meta. Registrado no CLAUDE.md |
| Ícone próprio por item de menu | ✅ **feito** |

> 🔧 **Saiu o card "Conta de anúncios"** (`Conectado · 2 contas`) que existia no rodapé
> antigo. Não está em nenhuma referência, e a informação **não se perdeu**: o rodapé de
> estado do Dashboard já diz `Integrações · 2 contas conectadas · 2 com erro`, com o
> detalhe do erro que o selo não tinha.

### Header

| Elemento | Status |
|---|---|
| Busca global central com `⌘K` | ✅ **feito** — 🔧 **paleta própria, sem `cmdk`.** Decisão de 06/08: a dependência não estava instalada, o estilo por atributo `[cmdk-*]` briga com a fronteira "arquivo é Tailwind ou é `sx()`", e o peer dep no React 19 era risco por ~180 linhas. Grupos **Telas · Campanhas · Criativos · Integrações**; setas navegam, Enter abre, Esc fecha, foco preso, ⌘K/Ctrl+K de qualquer tela |
| Título da tela + linha de apoio à esquerda | ✅ **feito** — 🔧 o `01` §9 manda REMOVER o título; o `04` vence e ele fica. O rail colapsado não tem rótulo nenhum, e o subtítulo é a única frase que diz o que a tela faz |
| Seletor de período no header | 🔧 **fica na faixa de filtros** — ver nota |
| Botão `Filtros` | ✅ **feito** — 🔧 **só existe na tela que tem faixa de filtros**, e isso é verificado em execução: a tela REGISTRA a faixa (`useRegistrarFaixaDeFiltros`) e o header só desenha o botão se alguém registrou. Provado pelo lado negativo: no Gerenciador o botão não existe |
| `Central de ajuda` com ícone `?` | ✅ **feito — só atalhos de teclado.** Hoje ⌘K é o único, e o painel tem um item por isso, não por preguiça. 🔧 **Não** é índice de "o que cada tela faz" (doc que ninguém lê e envelhece sozinha), e 🔧 **não** leva link para tela fora do menu — ver a pendência abaixo. Guia de verdade entra aqui quando existir |
| Sino de notificações com badge numérico | ✅ **feito** |
| Alternador de tema | ✅ **feito** |
| Avatar com dropdown `⌄` | ✅ **feito** — mesmo componente do rodapé do rail, duas aparências. 🔧 só itens com destino real (Áreas, Taxas, Sair): não existe tela de perfil, e item que promete tela inexistente é affordance mentindo |
| Indicador `Ao vivo` | ✅ **feito** — 🔧 discreto |

**Nota sobre o seletor de período:** nas referências ele fica no header. No nosso Dashboard ele está na faixa de filtros abaixo do título, junto de Conta / Produto / Fonte — o que é melhor, porque nossos filtros são quatro e não caberiam no header. **Mantém como está.** 🔧

### Global

| Elemento | Status |
|---|---|
| Cartão `Precisa de ajuda?` no rodapé das telas, com link para guia | ❌ imagem 5 — **não é do shell**, é rodapé de tela. Volta no passo de cada tela |
| Barra flutuante de ícones no canto inferior direito | ✅ **não era nossa.** Varredura de `position:fixed` em `src/` e no `globals.css`: os 4 acertos são backdrop de modal, barra de progresso do topo e dois overlays. Nada ancorado naquele canto — é extensão do navegador do usuário. **Nada a remover** |

### 🔜 PENDÊNCIAS do shell — trabalho adiado, não decisão de escopo

| | Item |
|---|---|
| 🔜 | **`Integrações › Visão geral` fora dos filhos da sidebar.** A tela não existe (`integracoes/page.tsx` é `redirect` para `anuncios`), e item de menu que promete uma tela e entrega outra é affordance mentindo. Entra como **PRIMEIRO filho** quando a Visão geral for construída, no passo de Integrações. Os filhos hoje são **Anúncios · Webhooks · UTMs · Pixel/Eventos** |
| ⏳ | **`Integrações › Testes` está fora da navegação de propósito, com prazo.** Saiu do rail pelo `03`; o link de socorro que existia na Central de ajuda **foi removido** em 06/08 por decisão do dono — tela inteira acessível só por dentro de um popover de **atalhos** é PIOR que tela fora do menu: parece disponível e não é encontrável. ⛔ Não religue aquele link. Ela **continua achável pela paleta ⌘K** ("testes"), que é busca global e não esconderijo. **Morre no passo de Integrações** — não agora, para não deletar 911 linhas no meio da entrega de outra tela |

---

## DASHBOARD — mesclagem

Referência: imagem 1. **Decisão: tudo da imagem 1 + tudo que já construímos.**

### O que já está de pé

| Elemento | |
|---|---|
| 4 KPIs hero com sparkline e variação | ✅ feito |
| Faixa compacta com os KPIs secundários | ✅ feito — 🔧 não está na referência, fica |
| Receita vs Gasto com seletor Diário/Semanal | ✅ feito |
| Canais (donut, com fallback de canal único) | ✅ feito |
| Alertas com ícone de severidade e tempo relativo | ✅ feito |
| Rodapé de estado com 4 blocos | ✅ feito |
| Saudação com nome e horário | ✅ feito — 🔧 pedido seu |
| Vendas por país: globo + ranking | ✅ feito — 🔧 **não existe em nenhuma referência**, pedido seu |
| Estados vazios que explicam a causa e linkam a solução | ✅ feito — 🔧 não visível em mockup, fica |

### O que falta para bater com a imagem 1

| Elemento | Status |
|---|---|
| **Top Campanhas** — tabela com ícone da plataforma, receita, gasto, ROI, conversões, badge de status, menu `⋮`, link `Ver todas` | ❌ depende de `metrics.ts` |
| **Performance por hora** — heatmap hora × dia com seletor de métrica e escala lateral `Alta / Baixa` | ❌ depende de `metrics.ts` — 🔧 fica por decisão sua |
| **Break-even** no gráfico Receita vs Gasto | ❌ depende de `metrics.ts` — 🔧 fica por decisão sua |
| Link `Ver todos` no painel de Alertas + contador `+2 alertas` | ❌ |
| Sparkline no card de Lucro | ❌ série `lucroLiquido` não existe no servidor |
| Ícone em caixa colorida ao lado de cada KPI | ❌ imagens 8 e 9 — ver nota |

**Nota sobre ícone em caixa nos KPIs:** aparece nas imagens 8 e 9 (Snippets e Criativos), não na imagem 1 (Dashboard). Aplicar **nas telas onde a referência mostra**, não no Dashboard. Consistência com a referência vence consistência interna aqui.

### Modo de edição — 🔧 inteiramente seu, não está nas referências

| Elemento | |
|---|---|
| Botão `Editar dashboard` | ❌ |
| Três zonas com contorno e rótulo no modo de edição | ❌ |
| Zona 1 — hero: exatamente 4, escolha de quais e ordem | ❌ |
| Zona 2 — faixa: quantidade e ordem livres, máx. 8 | ❌ |
| Zona 3 — painéis: reordenar, ocultar, larguras declaradas | ❌ |
| Painel lateral `Métricas disponíveis` / `Painéis disponíveis` | ❌ |
| `Salvar` · `Cancelar` · `Redefinir configurações` | ❌ |
| Migração dos layouts salvos | ❌ |
| Catálogo completo de blocos (ver `03`) | ❌ |
| `BreakdownPanel` único parametrizado por dimensão | ❌ |

---

## INTEGRAÇÕES

Referências: imagens 3, 5 e 6. É a tela com mais material de referência e a mais rica.

### Sub-navegação (imagem 3)

`Integrações` vira seção com: **Visão geral · Anúncios · Webhooks · UTMs · Pixel/Eventos** 🔧 *(as referências mostram isso como abas horizontais; decisão sua foi sidebar)*

### Visão geral

| Elemento | Status |
|---|---|
| Faixa de estado: `Conectadas 12` · `Com erro 2` · `Inativas 1` · `Total 15` | ❌ |
| Cada card da faixa com ícone em caixa e linha de contexto (`100% operacionais`, `Precisam de atenção`, `+1 este mês`) | ❌ |
| Filtro de texto + `Status: Todos` + `Ordenar: Recentes` | ❌ |
| Tabela: INTEGRAÇÃO · CATEGORIA · STATUS · ÚLTIMA SINCRONIZAÇÃO · `⋮` | ❌ |
| Ícone real de cada plataforma na linha | ❌ |
| Badge de categoria colorido (`Anúncios`, `Webhooks`, `Pixel`, `UTMs`) | ❌ |
| Linha selecionada com borda e destaque persistente | ❌ |
| Paginação `Mostrando 1 a 10 de 15` + `‹ 1 2 ›` | ❌ |
| Botão `+ Nova integração` | ❌ |
| **Painel de detalhe** à direita | ❌ |
| Painel: cabeçalho com ícone, nome, `Conta principal · ID`, badge de status, `⋮` | ❌ |
| Painel: abas `Visão geral / Configurações / Sincronização / Logs / Webhooks` | ❌ |
| Painel: descrição da integração em caixa | ❌ |
| Painel: grade de metadados (Conta, Tipo, Moeda, Criada em, Fuso, Última atualização) com ícone por campo | ❌ |
| Painel: `Dados sincronizados` — 6 itens com ✓ e uma linha de descrição cada | ❌ |
| Painel: rodapé `Testar conexão` + `Desconectar integração` (destrutivo) | ❌ |

### Saúde e plataformas (imagem 6)

| Elemento | Status |
|---|---|
| Painel `Saúde da integração`: API Meta, Pixel, Webhook, CAPI, Conversões Offline, Permissões, Token de acesso | ❌ |
| **`Tokens expiram em N dias`** em cor de atenção | ❌ |
| Bloco de plataforma em destaque: contas, campanhas, pixels, business managers, última sincronização | ❌ |
| `Plataformas conectadas` — cards horizontais selecionáveis com contagem e status | ❌ |
| `Contas conectadas` — linha com BM / Contas / Campanhas / Pixels / status de sync | ❌ |
| Badge `Principal` na conta primária | ❌ |
| Painel `Atividade recente` com timestamp, ícone e descrição | ❌ |
| `Ver todas as N contas ⌄` | ❌ |

Nossos gateways brasileiros (Kirvano, Cakto, OnyxPag, Hotmart, Kiwify) entram nesse mesmo padrão de `Plataformas conectadas`.

---

## REGRAS

Referência: imagem 2. Tela inteiramente nova.

| Elemento | Status |
|---|---|
| Cabeçalho: `‹ Voltar`, nome da regra, badge `Ativa` com ponto | ❌ |
| Subtítulo `Criada em … · Atualizada há …` | ❌ |
| `Modo de teste` (toggle) · `Mais opções ⋯` · `Salvar regra ⌄` | ❌ |
| **Paleta** à esquerda com abas `Gatilhos / Condições / Ações` | ❌ |
| Item da paleta: ícone, nome, uma linha de descrição | ❌ |
| `+ Solicitar novo gatilho — Não encontrou o que precisa?` | ❌ |
| **Canvas** com fundo pontilhado | ❌ |
| Controles: `− 100% +` · ajustar à tela · desfazer · refazer | ❌ |
| Indicador `✓ Validação` com dropdown | ❌ |
| Nó de gatilho, condição, ação e fim — visuais distintos | ❌ |
| Nó de condição com operador `E` entre as linhas e chips de valor | ❌ |
| Ramificação com rótulos `Sim` (positivo) e `Não` (negativo) | ❌ |
| Botão `+` **na aresta**, entre nós | ❌ |
| Nó selecionado com borda destacada | ❌ |
| **Inspector** à direita: `Propriedades do componente` + `ID: cond_1` | ❌ |
| Inspector: operador lógico, lista de condições com `🗑` por linha | ❌ |
| Inspector: `+ Adicionar condição` | ❌ |
| Inspector: `Se verdadeiro (Sim)` / `Se falso (Não)` | ❌ |
| Inspector: seção `Informações` recolhível — criado, atualizado, executada N vezes, taxa de sucesso | ❌ |
| Inspector: `🗑 Excluir componente` | ❌ |
| Rodapé: `Execuções (7 dias)` · `Taxa de sucesso` · `Última execução` · `Ver logs de execução` | ❌ |

Biblioteca: `@xyflow/react`, importação dinâmica.

---

## CAMPANHAS / GERENCIADOR

Referência: imagem 4.

| Elemento | Status |
|---|---|
| 5 KPIs com sparkline: Gasto, Receita, Lucro, ROI, Conversões | ❌ |
| Painel `Status das campanhas` — donut com Ativas / Pausadas / Rascunhos e % | ❌ |
| Abas `Todas / Ativas / Pausadas / Rascunhos / Arquivadas` | ❌ |
| `Agrupar por: Campanha ⌄` | ❌ |
| `⤓ Exportar` | ❌ |
| `+ Nova campanha` | ❌ |
| Busca + `Plataforma` + `Status` + `Objetivo` + `Mais filtros` | ❌ |
| Tabela com **checkbox de seleção múltipla** | ❌ |
| Cabeçalhos com ícone `ⓘ` de ajuda nas colunas ambíguas | ❌ |
| Nome da campanha como link + subtítulo `Objetivo \| Plataforma` | ❌ |
| Ícone da plataforma por linha | ❌ |
| Badge de status colorido por estado | ❌ |
| Coluna de Lucro em cor de valor positivo | ❌ |
| Linhas de rascunho com `—` nas métricas e ação `▷` | ❌ |
| Ações por linha: gráfico + `⋮` | ❌ |
| **Painel `Insights`** com 4 cartões: melhor campanha, maior volume, menor custo por conversão, atenção necessária | ❌ |
| Painel `Distribuição por plataforma` com barra e valor | ❌ |
| Paginação `‹ 1 2 3 … 6 ›` + `10 por página ⌄` + `Mostrando 1 a 7 de 40` | ❌ |
| Conjuntos de colunas nomeados + colunas congeladas | 🔧 nosso, não está na referência — resolve as ~20 colunas ilegíveis |

---

## UTM & SNIPPETS

Referências: imagens 7 e 8. Vira área de primeiro nível.

### UTM Builder (imagem 7)

| Elemento | Status |
|---|---|
| Abas `UTM Builder` / `Snippets` | ❌ |
| `⤒ Importar` + `+ Novo UTM ⌄` | ❌ |
| Formulário: Fonte, Mídia, Campanha, Termo, Conteúdo, ID da campanha | ❌ |
| Ícone da plataforma dentro do campo Fonte | ❌ |
| `🗑 Limpar campos` + `🔗 Gerar URL` | ❌ |
| Painel `URL gerada` com badge `● Válida` | ❌ |
| URL em fonte mono com botão copiar | ❌ |
| `Visualização` — **um chip colorido por parâmetro** | ❌ |
| `Salvar como modelo` com campo e botão | ❌ |
| `Histórico recente` — hora, ícone da plataforma, `fonte / mídia`, campanha | ❌ |
| `Modelos favoritos` — com marcador de favorito e `⋮` | ❌ |
| Cartão `Como usar UTMs e Snippets` com `Ver guia completo ↗` | ❌ |
| Montagem da URL por função pura testada (mata o `[object Object]`) | 🔧 nosso |

### Snippets (imagem 8)

| Elemento | Status |
|---|---|
| Abas `Meus snippets` / `Biblioteca pública` / `Templates` | ❌ ver nota |
| 4 KPIs com ícone em caixa: total, utilizados em N contas, execuções 30d, atualizados 30d | ❌ |
| Busca + `Todas as categorias` + `Filtros` | ❌ |
| Tabela: NOME (com ID) · CATEGORIA · TIPO · USADO EM · ATUALIZADO (com autor) · **toggle ativo** · `⋮` | ❌ |
| Colunas ordenáveis com indicador | ❌ |
| Painel de detalhe: cabeçalho com `Editar` / `Duplicar` / `Mais ações ⌄` | ❌ |
| Painel: `Visão geral` — tipo, categoria, criado, atualizado, usado em, status | ❌ |
| Painel: **`Prévia do código` com destaque de sintaxe** + `⧉ Copiar` | ❌ |
| Painel: `Tags` com chips e `+` | ❌ |
| `Atividade recente` — com nome do autor (`por João Silva`) | ❌ |
| `Templates populares` com botão `Usar template` | ❌ |

**Nota:** `Biblioteca pública` e `Templates` implicam conteúdo compartilhado entre contas, que não existe no backend. Construa as abas; se não houver dado, use estado vazio honesto. **Não invente conteúdo.**

---

## CRIATIVOS

Referência: imagem 9.

| Elemento | Status |
|---|---|
| 6 KPIs com ícone em caixa colorida: total, CTR médio, CPC médio, taxa de conversão, ROAS médio, ativos | ❌ |
| `⤒ Importar` · `📁 Pastas` · `+ Novo criativo ⌄` | ❌ |
| Busca por nome ou ID com `⌘K` | ❌ |
| Filtros: Plataforma (com ícone) · Campanha · Formato · Tipo de mídia · Status · `Filtros` | ❌ |
| **Alternador grade / tabela** | ❌ |
| Abas com contador: `Todos 1.248` · `Análise` (badge `Novo`) · `Testes A/B 23` · `Top performers` · `Em queda` · `Inativos 936` | ❌ |
| Carrossel horizontal de miniaturas com seta `›` | ❌ |
| Card: thumbnail, botão play, badge de plataforma, ponto de status | ❌ |
| Card: nome + badge de estado + `ROAS / CTR / CPA` no rodapé | ❌ |
| Tabela `Desempenho dos criativos` com miniatura na primeira coluna | ❌ |
| Coluna CAMPANHA com prefixo de objetivo (`[CONV]`, `[TRÁFEGO]`) e status | ❌ |
| `Ordenar por: ROAS (maior) ⌄` + `⤓ Exportar` | ❌ |
| `Mostrar 20 ⌄` + `1-20 de 1.248` + paginação | ❌ |

`Testes A/B` e `Pastas` provavelmente não existem no backend. Mesma regra: construa, e se não houver dado, estado vazio honesto.

---

## LOGIN

Referências: imagens 10 e 11 (claro e escuro).

| Elemento | Status |
|---|---|
| Split-screen, marca à esquerda, formulário à direita | ❌ |
| Logo grande no topo esquerdo | ❌ |
| Badge `PLATAFORMA DE TRACKING E GESTÃO` | ❌ |
| Headline com **segunda linha em cor de destaque** | ❌ |
| Parágrafo de apoio em duas linhas | ❌ |
| Três provas com ícone: título + subtítulo | ❌ |
| **Preview da ferramenta** — mockup do dashboard com KPIs e gráfico | ❌ |
| Arco decorativo de fundo | ❌ |
| Rodapé esquerdo: `🔒 Dados criptografados e protegidos…` | ❌ |
| Cartão do formulário: `Bem-vindo de volta` + subtítulo | ❌ |
| Campos com ícone dentro (envelope, cadeado) | ❌ |
| Olho para revelar senha | ❌ |
| `Lembrar de mim` + `Esqueci minha senha` | ❌ |
| Botão `Entrar →` em gradiente | ❌ |
| Divisor `ou continue com` | ❌ |
| Social: `Google` · `Meta` · `Apple` | ❌ |
| `Ainda não tem uma conta? Criar conta` | ❌ |
| Rodapé com copyright | ❌ |
| Espelhar tudo em `/signup` | ❌ |

---

## O QUE ESTÁ NAS REFERÊNCIAS E NÃO EXISTE NO PRODUTO

Backend novo, não redesign. **Nenhum destes tem prazo até decisão explícita.**

| Área | Aparece em |
|---|---|
| `Campanhas` separada de `Anúncios` | imagens 1, 4, 5, 6 |
| `Relatórios` | imagens 1, 5 |
| `Conversões` | imagens 5, 6 |
| `Públicos` | imagens 5, 6 |
| `Fontes` | imagem 5 |
| `Ofertas` | (imagem trackhub anterior) |
| `Logs` | imagens 6, 7 |
| `Resumo` (separado de Dashboard) | imagens 6, 7 |
| `Equipe` — multiusuário | imagens 6, 7 |
| `Planos & Cobrança` | imagens 6, 7 |
| `Métricas` | imagem 5 |
| Biblioteca pública de snippets | imagem 8 |
| Testes A/B em criativos | imagem 9 |
| Pastas de criativos | imagem 9 |

---

## COMO USAR ESTE DOCUMENTO

Ao terminar cada tela, o Claude Code preenche a coluna de status desta lista e devolve. Um item ❌ que continue ❌ ao fim da tela é trabalho não feito, não é decisão — a menos que vire 🔧 com um motivo escrito e aprovado.

O teste do cinza continua valendo. Este documento é o complemento: o cinza prova que a **estrutura** mudou; esta lista prova que o **conteúdo** está completo.