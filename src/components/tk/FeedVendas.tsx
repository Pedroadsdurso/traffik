"use client";

import * as React from "react";

import { useTamanho } from "@/components/dashboard/ui/useTamanho";

/**
 * Atividade recente — os últimos eventos de venda e rastreamento.
 *
 * ⚠️ **NÃO CONFUNDIR com o "Atividade recente" de Integrações.** Aquele é a
 * união de `WebhookLog` + notificação + falha de sincronização, e responde "o
 * que aconteceu com as minhas conexões". Este é o feed de EVENTOS DE NEGÓCIO —
 * clique, checkout, venda, reembolso. Mesmo título, telas diferentes, dados
 * diferentes; por isso são dois componentes e não um com prop de fonte.
 *
 * ⚠️ `timeLabel` vem PRONTO do hook e é seguro **por timing**, não por
 * estrutura: `dashData` nasce `null` e a lista está vazia na passagem do
 * servidor. Se um dia o Dashboard receber `initialDashData`, este componente
 * passa a precisar de `<Desde>` — está anotado no hook, no ponto que quebraria.
 */

export interface ItemFeed {
  id: string;
  typeLabel: string;
  cor: string;
  valueLabel: string;
  timeLabel: string;
  source?: string | null;
  campaign?: string | null;
}

/** A linha do `+N`: uma `text-caption` com a margem de cima. Medida uma vez. */
const ALTURA_RODAPE = 26;

/**
 * 🔴 F3 — QUANTAS LINHAS CABEM É MEDIDO, NÃO UM `limite = 12`.
 *
 * `limite` era 12, fixo. Num slot de 4 células (368px) cabem ~9, e as três que
 * sobravam vazavam pela borda do card — medido: **+36px**, nas duas larguras.
 *
 * §4 do `07`: `linhas visíveis = floor((ch − rodapé) / altura da linha)`, e **o
 * excedente vira `+N` no rodapé, não rolagem interna**. A distinção é do
 * documento e não é estética: rolagem dentro de um card de painel esconde que há
 * mais — o usuário só descobre se pensar em rolar ali. O `+N` diz.
 *
 * ⚠️ A ALTURA DA LINHA É MEDIDA, não uma constante. Um `44` escrito aqui é a
 * mesma família dos três limiares que a F0b reprovou: a linha muda com a
 * densidade (`--tk-b-linha` vai de 40 a 52) e com a quebra do texto.
 *
 * ⛔ E não realimenta: `ch` é a altura do SLOT, que não depende de quantas
 * linhas são desenhadas. Menos linhas não encolhem o card — encolher o card é o
 * que a F1 tirou do conteúdo.
 */
function useQuantasCabem(qtd: number, teto: number) {
  const { ref, altura: ch } = useTamanho<HTMLDivElement>();
  const [hLinha, setHLinha] = React.useState(0);
  const medirLinha = React.useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    setHLinha((atual) => (Math.abs(atual - h) < 0.5 ? atual : h));
  }, []);

  /* Antes da primeira medida, o teto: a passagem do servidor não tem caixa, e
     desenhar zero linha faria o bloco piscar de vazio para cheio. */
  if (ch <= 0 || hLinha <= 0) return { ref, medirLinha, visiveis: Math.min(qtd, teto) };

  /* O rodapé do `+N` só ocupa lugar quando ele existe — e ele só existe se
     alguma linha ficar de fora, que é o que se está calculando. Reservar sempre
     tiraria uma linha de quem não precisa do aviso. */
  const semRodape = Math.max(1, Math.floor(ch / hLinha));
  if (semRodape >= qtd) return { ref, medirLinha, visiveis: Math.min(qtd, teto) };
  const comRodape = Math.max(1, Math.floor((ch - ALTURA_RODAPE) / hLinha));
  return { ref, medirLinha, visiveis: Math.min(qtd, teto, comRodape) };
}

export function FeedVendas({ itens, limite = 12 }: { itens: ItemFeed[]; limite?: number }) {
  const { ref, medirLinha, visiveis } = useQuantasCabem(itens.length, limite);

  if (itens.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
        Nenhum evento no período. Cliques e vendas aparecem aqui assim que chegarem.
      </p>
    );
  }

  return (
    <div ref={ref} className="tk-feed" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, overflow: "hidden" }}>
      {itens.slice(0, visiveis).map((f, i) => (
        <div
          key={f.id}
          /* A PRIMEIRA linha é a medida — todas têm a mesma altura, e observar
             uma basta. Observar todas custaria N observers para um número só. */
          ref={i === 0 ? medirLinha : undefined}
          className="tk-linha"
          style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 8px", borderRadius: 8, flex: "none" }}
        >
          {/* 🔴 A cor do evento vem com PONTO, e o tipo vem por EXTENSO ao lado.
              Nove tipos distinguidos só por cor seriam nove cores que ninguém
              memoriza — e para quem não distingue cores, nenhuma informação.
              A cor acelera; o texto é quem informa. */}
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: f.cor, flex: "none" }} />
          <span className="text-caption text-text" style={{ flex: "none" }}>{f.typeLabel}</span>
          <span
            className="text-caption text-text-muted tk-feed-origem"
            style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {f.campaign || f.source || ""}
          </span>
          <span className="text-caption text-text" style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
            {f.valueLabel}
          </span>
          <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>{f.timeLabel}</span>
        </div>
      ))}
      {itens.length > visiveis && (
        /* ⚠️ O `+N` diz quantos FICARAM DE FORA, e não "mostrando X de Y". A
           segunda forma obriga o leitor a subtrair para saber se vale procurar o
           resto — e é a pergunta que ele tem ao ver a lista cortada. */
        /* 🔴 C6 — `marginTop: auto` ANCORA O RODAPÉ NO FIM DO CARD.
           Sem ele o `+N` ficava colado na última linha e sobrava vão morto
           embaixo — medido em 13/08/2026: **29px** no `atividade`, num bloco que
           tinha `+32` eventos escondidos.

           ⛔ E a distinção é a regra do dono: vão com `+N` é DEFEITO (a tela
           afirma que não cabe mais e deixa espaço sobrando); vão SEM `+N` fica,
           porque é a altura que o usuário escolheu na alça e a lista acabou.
           `produtos`, `alertas` e `top-campanhas` mostram tudo que têm — o vão
           deles não é nosso para consertar. */
        <p className="text-caption text-text-muted" style={{ margin: "8px 0 0", marginTop: "auto", flex: "none" }}>
          + {itens.length - visiveis} {itens.length - visiveis === 1 ? "evento" : "eventos"} — aumente o bloco para ver mais
        </p>
      )}
    </div>
  );
}
