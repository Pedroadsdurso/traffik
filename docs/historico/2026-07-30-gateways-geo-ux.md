# Histórico — 2026-07-30-gateways-geo-ux

> Registro de sessão, mantido inteiro. Não é regra e não precisa estar
> carregado a cada sessão — mas é onde está o "por que ficou assim" de
> cada decisão do período, e várias delas voltaram a importar.

> ⬆️ **Regras que valem sempre** (PROCEDIMENTO, ordem de migration, guarda de
> escrita em produção, padrões nomeados, estado atual e fila) estão no
> **`CLAUDE.md`** na raiz. Este arquivo é o detalhe de um tema.

---

## 🚦 (histórico) estado em 30/07/2026

Tudo até `3bc1cda` está **em produção**. **A padronização visual terminou** — os
dois itens que faltavam (aproveitamento do espaço das 4 telas + os SVGs legados)
foram feitos em 30/07/2026 e estão **na árvore de trabalho, ainda SEM COMMIT**,
aguardando o teste do usuário.

> 🔴 **HÁ MIGRATION PENDENTE (31/07/2026): `20260731020000_effective_status`.**
> Ordem obrigatória: `npx prisma migrate deploy` na produção **e só então**
> `git push`. Ela é aditiva (3 colunas nullable), então o build antigo continua
> funcionando — mas o código novo faz `SELECT` delas em toda carga do
> Gerenciador. Depois do primeiro sync, rode **`npm run ads:sonda`**.

### ⚠️ Fila da próxima sessão

**GEOLOCALIZAÇÃO — passos 1 a 4 FEITOS e o backfill APLICADO em produção.**
As rotas resolvem o país, a base cobre IPv4 **e IPv6**, o mapa foi de 32 para
**252 países**, e o histórico foi preenchido: **237 cliques · 15 vendas** (eram
0 e 2). 11 vendas são perda definitiva — nunca tiveram IP no payload.

⚠️ **Dois achados mudaram a ordem, e os dois BLOQUEIAM o hash do IP** (que é
irreversível): a marcação de bot e o **navegador embutido do app da Meta**, que
responde por **55,6% do tráfego humano** e falseia o país do clique. Ver as
seções próprias.

✅ **Passo 5 (marcação de bot) FEITO** — tem **migration**, então o deploy é
`migrate deploy` → `npm run bot:reclassificar --aplicar` → `push`, nessa ordem.

✅ **Passo 6 FEITO** — desempate pela segmentação da campanha + `countrySource`.
Tem **migration**: `migrate deploy` → `push`, nessa ordem (sem script no meio).

⚠️ **Confirme no primeiro sync que `AdSet.geoCountries` vem preenchido.** Se
vier vazio para todos, o desempate fica **inerte em silêncio** — o mesmo estado
em que a base de países ficou antes do passo 1.

**A fila completa está em "📋 FILA DE TRABALHO PENDENTE"** — referência por
item (*"vamos para o 3d"*). O próximo é o **item 1: Cakto + arquitetura
universal de gateways**.

**Concluído nesta sessão, nesta ordem:**
1. Aguardar o sync e rodar **`npm run geo:sonda`** — obrigatória, prova se o
   desempate está ativo ou inerte.
2. **Fase B** do passo 7: purga progressiva do `Click.ip` (7 dias) + retenção do
   `WebhookLog`. Aprovada, nada escrito ainda.
3. **Fase A ADIADA** — limpar o IP dos payloads só depois da arquitetura de
   parsers estar estável, e na versão que remove **só o IP**.

⚠️ **O plano original do passo 7 estava errado** e a investigação salvou: hashear
o `Click.ip` quebraria o `client_ip_address` da CAPI **em silêncio**, degradando
a otimização de campanha com dinheiro real. Ver a seção "🔐 Passo 7".

Fora isso: **faxina de código morto** (lista em "Pendências abertas") e o
**import/export do Bloco 8**, que ficou de fora de propósito. O lint está em
zero e não há item de padronização visual pendente.

⚠️ **As ações em massa e o duplicar nunca foram exercidos.** Pausar e alterar
orçamento já foram, por uso real; o **motor de regras** rodou em produção em
31/07/2026, com escopo confirmado. Ver "Escrita na Graph API" e "O ENSAIO A SECO
DISPAROU".

### O que NÃO está pendente (não refaça)

| Item | Situação |
|---|---|
| Microcópia | ✅ ~30 textos + tooltips. `lib/explicacoes.ts` é o catálogo — **confira antes de "adicionar tooltip"**, ele é mais completo do que parece |
| Selects e checkboxes nativos | ✅ **zero**, fora de 2 exceções documentadas (mês/ano do `DateRangePicker`, `test-checkout`) |
| Emojis | ✅ trocados por `ui/Icone` (`lucide-react`). Emoji de **bandeira** no `CountryMap` fica — ali é bandeira, não ícone |
| Scripts expostos | ✅ UTMs e Pixel em gaveta |
| Bloco 8 (Regras) | ✅ completo, menos import/export (fora de propósito) |
| Áreas de Trabalho | ✅ sessões 1–4 + exclusão com escolha |
| Aproveitamento do espaço | ✅ as 4 telas refeitas em 30/07 — ver a seção própria |
| SVGs em 256×256 | ✅ **zero**. `Icon.tsx` (`NavIcon`) foi deletado |
| Lint | ✅ **zero problemas**. Os `eslint-disable` que restam são deliberados e levam o motivo na linha — **não os remova sem ler o motivo** |
| Texto esticado nos gráficos | ✅ resolvido por `ui/useTamanho` — ver a seção própria |
| Layout padrão do Dashboard | ✅ 21 blocos, em `PADRAO_KPIS`/`PADRAO_GRAFICOS` |

### 🔴 Cinco regras que custaram caro — não reabra

1. **`NULL` não significa a mesma coisa em toda coluna.** Ver a tabela na seção
   própria. Em `AutomationRule` e `Expense`, nulo **amplia escopo**.
2. **Campo de formulário mora na VIEW, nunca no `useTraffikState`.** Cada tecla
   ali re-renderiza o dashboard inteiro.
3. **Não devolva `onClose` às dependências do efeito de `useOverlay`.** Era a
   causa do campo perder o foco a cada tecla, em toda gaveta e modal.
4. **`useTraffikState` sincroniza as props do servidor por efeito.** O
   inicializador de `useState` só roda na montagem — sem o efeito, trocar de área
   mostrava a integração da área ANTERIOR.
5. **Helper consumido pela UI não pode morar em módulo que importa Prisma.**
   `FeesView` é client component; o import arrastou o driver `pg` (`dns`, `fs`)
   para o bundle e quebrou o build. Ver `lib/areas/taxas.ts`.
6. **`useTamanho` usa callback ref + nó em estado.** Com `useRef` + deps `[]` o
   observer nunca se anexa quando o elemento ainda não existe (gráfico que abre
   vazio) e a largura fica 0 para sempre.
7. **`align-items:start` num grid de cards mata o rodapé alinhado.** Com `start`
   cada card fica só com a altura do próprio conteúdo, o `margin-top:auto` do
   rodapé não tem folga, e um nome que quebra em 3 linhas desalinha os botões de
   toda a fileira. Grade de cards com rodapé usa `stretch`.
