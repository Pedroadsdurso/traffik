# Criador de regras visual — ESPECIFICAÇÃO, não implementação

> ## ⛔ ESTE DOCUMENTO NÃO DESCREVE CÓDIGO QUE EXISTE
>
> Escrito em 05/08/2026, por decisão do usuário: o criador de regras **saiu do
> escopo do redesign** e foi registrado como especificação para não se perder.
> Nada aqui está implementado, e **nada aqui deve ser implementado** sem uma
> decisão nova de construir o motor.
>
> A regra do PROCEDIMENTO vale ao contrário aqui: normalmente o risco é achar que
> algo escrito está funcionando. Neste arquivo o risco é o inverso — alguém ler
> uma especificação detalhada e supor que ela descreve o sistema. **Não descreve.**
> Se você chegou aqui procurando como as regras funcionam hoje, o lugar é
> `src/lib/rules/engine.ts` e `docs/temas/regras-de-automacao.md`.

## Por que ficou de fora do redesign

O redesign é **linguagem visual**: token, primitivo, tela retematizada. O criador
de regras é outra coisa —

| | |
|---|---|
| **Motor próprio** | avaliar um grafo de nós não é o que `rules/engine.ts` faz hoje (condição → ação, plana) |
| **Tabelas próprias** | um grafo precisa de nós, arestas e versão; nada disso existe no schema |
| **Risco assimétrico** | uma regra mal montada **age em produção com dinheiro real** — pausa campanha, muda orçamento |
| **Risco de atribuição** | é o ponto abaixo, e é o que mais pesou |

### 🔴 O risco que decidiu a questão: envenenar atribuição em silêncio

O motor de regras **escreve na Meta**. Uma regra que pausa, ativa ou muda
orçamento altera a veiculação — e a veiculação é o que produz clique, que é o que
produz atribuição de venda. Uma regra errada não devolve um número errado na
tela: ela muda **o dado que entra**, e o estrago não tem como ser distinguido
depois de "a campanha foi mal".

É a mesma família do caso `Sale.apiCredentialId` — seis leitores, zero escritores,
e nada acusando —, com um agravante: ali o dado ficava nulo, aqui o dado fica
**plausível e errado**. `tsc`, `lint`, `build` e teste de função pura passam com
a regra fazendo a coisa errada, porque a função está certa; o que está errado é o
que ela foi mandada fazer.

## O que ENTRA do redesign, quando entrar

Só a **linguagem visual** da tela, e ela se apoia no que as Fases 1–2 já
entregaram:

| Elemento | Token / primitivo |
|---|---|
| Canvas (fundo da área de montagem) | `--tk-background` |
| Nó (caixa de condição ou de ação) | `Card` da Fase 2 — borda `--tk-border` e `--tk-shadow-card` (a nota "sem sombra" era a regra revertida em 07/08) |
| Nó selecionado | anel `--tk-glow-live`, **sem pulso** |
| Nó de CONDIÇÃO ("se o CPA passar de X") | selo `tom="primary"` |
| Nó de AÇÃO ("pausar") | selo `tom="danger"` — ação que gasta ou é irreversível |
| Nó de AÇÃO branda ("notificar") | selo `tom="neutral"` |
| Conector | `--tk-border`; ramo verdadeiro em `--tk-success`, falso em `--tk-text-muted` |
| Rótulo do conector | `.text-micro` |
| Barra de ferramentas | `Button` variante `fantasma` |
| Salvar | `Button` variante `primario` |

⛔ **Nenhuma cor de canal e nenhum `--tk-category` no canvas.** Um nó é um
controle: a cor ali é lida como estado, e é exatamente a fronteira que a decisão
do Conflito 1 traçou.

## O que a especificação precisaria responder ANTES de virar código

Não são detalhes de implementação — são as perguntas que, sem resposta, produzem
um motor que age errado com a tela mostrando certo.

1. **Um grafo pode ter ciclo?** Se pode, o que impede a regra de rodar em laço
   contra a Graph API? Se não pode, quem recusa — a tela, o salvamento, ou o motor?
2. **Duas regras que agem no mesmo objeto, na mesma execução.** Quem ganha? Hoje
   a corrida se resolve com reserva no banco (o padrão "quem decide o vencedor é o
   BANCO"); um grafo multiplica os caminhos até a mesma campanha.
3. **O `workspaceId` do grafo pode ser nulo?** Em `AutomationRule`, nulo significa
   **GLOBAL — age em TODAS as contas**, e `onDelete: SetNull` é uma *promoção de
   escopo*. Uma tabela nova de grafo herdaria o significado errado por acidente se
   ninguém decidir e documentar no schema.
4. **Prévia obrigatória?** O motor atual tem prévia e clamp de teto, os dois
   exercidos em produção. Um grafo precisa de prévia do **caminho inteiro**, não
   de cada nó — prévia por nó daria confiança sem cobrir a composição.
5. **Versão do grafo.** Uma regra editada enquanto executa é a armadilha "mudar
   QUANDO o estado é gravado muda o significado de todo erro no caminho".
6. **O que o teste ponta a ponta semeia?** Métrica e automação desta base exigem
   teste que semeia o caso e lê o resultado no fim da cadeia — e, para automação,
   **asserção sobre o que ficou de FORA do escopo**, não só sobre o alvo.

## Estado

**Não implementado. Não iniciado. Sem tabela, sem rota, sem componente.**
Reabrir exige decisão explícita do usuário sobre construir o motor.
