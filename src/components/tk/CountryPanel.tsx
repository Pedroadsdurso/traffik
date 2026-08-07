"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Segmented } from "./Segmented";
import { EmptyState } from "./EmptyState";
import type { PontoPais } from "./GlobeView";

/* O `dynamic` mora no escopo do MÓDULO, não dentro do componente. Criado no
   render (mesmo via `useMemo`), ele vira um componente NOVO a cada recriação e o
   React remonta o globo do zero — perdendo a rotação, a câmera e o estado do
   three.js. O lint pega isso; a tela mostraria como "o globo pisca sozinho". */
const GloboLazy = dynamic(() => import("./GlobeView"), { ssr: false, loading: () => null });

/**
 * CountryPanel — "Vendas por país", em duas visões no mesmo bloco.
 *
 * 🔴 O GLOBO É `next/dynamic` COM `ssr: false`, e as duas coisas são
 * obrigatórias:
 *
 *   - `dynamic` porque `react-globe.gl` arrasta o three.js. Estático, ele
 *     entraria no bundle de quem abre o Dashboard só para ver o faturamento, e
 *     atrasaria o primeiro paint dos KPIs — que são a razão da tela existir.
 *   - `ssr: false` porque three.js toca `window` na importação: renderizado no
 *     servidor, derruba a rota inteira.
 *
 * Enquanto o pedaço carrega, o `loading` mostra o RANKING — não um esqueleto.
 * A informação está disponível o tempo todo; o globo é a versão bonita dela.
 *
 * ⚠️ O padrão segue a quantidade de países: **5 ou menos → Ranking**. Um globo
 * com dois pontos é decoração cara; a lista responde "de onde vem meu dinheiro"
 * na hora. Acima de cinco, o globo passa a mostrar distribuição que a lista não
 * mostra. A escolha do usuário vence o padrão e persiste enquanto a tela viver.
 */

export type LinhaPais = {
  code: string;
  nome: string;
  bandeira: string;
  vendas: number;
  receita: number;
  lat: number | null;
  lng: number | null;
};

const LIMIAR_GLOBO = 5;

export type VisaoPais = "ranking" | "globo";

/**
 * O padrão segue a quantidade de países; a escolha do usuário vence e persiste.
 * Fica aqui, e não dentro do painel, porque o ALTERNADOR mora no cabeçalho do
 * card — flutuando no meio do bloco ele parecia um controle solto sem dono.
 */
export function useVisaoPais(quantidade: number) {
  const [escolha, setEscolha] = React.useState<VisaoPais | null>(null);
  return {
    visao: escolha ?? (quantidade > LIMIAR_GLOBO ? "globo" : "ranking"),
    setVisao: setEscolha,
  } as const;
}

/** O alternador, para o slot `acao` do Card. */
export function AlternadorPais({ visao, aoTrocar }: { visao: VisaoPais; aoTrocar: (v: VisaoPais) => void }) {
  return (
    <Segmented
      rotuloAcessivel="Visão de vendas por país"
      valor={visao}
      aoTrocar={aoTrocar}
      opcoes={[
        { valor: "ranking", rotulo: "Ranking" },
        { valor: "globo", rotulo: "Globo" },
      ]}
    />
  );
}

export function CountryPanel({
  linhas,
  /** Vendas cujo país NÃO foi identificado. Aparece explicitamente — ver abaixo. */
  semPais,
  formatar,
  tema,
  altura = 300,
  visao,
}: {
  linhas: LinhaPais[];
  semPais: number;
  formatar: (n: number) => string;
  tema: "dark" | "light";
  altura?: number;
  /** Controlado por quem chama: o alternador mora no CABEÇALHO do card. */
  visao: VisaoPais;
}) {
  const efetiva = visao;

  const pontos: PontoPais[] = React.useMemo(
    () =>
      linhas
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({ code: l.code, nome: l.nome, lat: l.lat!, lng: l.lng!, vendas: l.vendas, receita: l.receita })),
    [linhas],
  );

  /* ⛔ O ESTADO VAZIO COLAPSA. Ele sai do `flex` com altura reservada e vira só
     a mensagem — a mesma regra dos painéis do catálogo. Um bloco que ocupa 420px
     para dizer "não há venda com país" é a versão de layout de afirmar o que não
     se mediu, e é o que os testadores mais veem. */
  if (linhas.length === 0) {
    return (
      <EmptyState
        titulo="Nenhuma venda com país no período"
        causa={
          <>
            O país vem do <strong>gateway</strong> ou do <strong>clique rastreado</strong>. Se há
            vendas mas nenhuma com país, a integração não está devolvendo essa informação.
          </>
        }
        acao={{ texto: "Conferir integrações", href: "/dashboard/integracoes" }}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
      {efetiva === "globo" ? (
        /* 🔴 GLOBO + RANKING LADO A LADO. O three.js dimensiona a esfera pela
           MENOR dimensão do canvas, então num bloco largo e baixo o globo fica
           pequeno e sobra vazio dos dois lados — foi o "ícone perdido" do print.
           A lista ao lado ocupa essa largura com informação em vez de ar, e
           ainda responde o que o globo não responde: a ordem exata e o valor. */
        /* 🔴 O GLOBO DIMENSIONA PELA ALTURA, e é por isso que ele tem largura
           FIXA igual à altura em vez de `flex: 1 1 380px`.
           
           O three.js encaixa a esfera na MENOR dimensão do canvas. Com o globo
           esticando na horizontal, um bloco largo e baixo dava uma esfera do
           tamanho da altura e duas faixas de vazio nas laterais DENTRO do canvas
           — o "ícone perdido no meio do nada" do print. Reservando exatamente a
           largura que a esfera vai usar, o vazio deixa de existir e a lista
           recebe o resto. */
        <div
          className="tk-paises"
          style={{ display: "flex", gap: "var(--tk-gap-grid)", alignItems: "stretch", minHeight: altura }}
        >
          <div className="tk-paises-globo" style={{ flex: `0 0 ${altura}px`, maxWidth: "100%" }}>
            <GloboCarregado pontos={pontos} altura={altura} tema={tema} formatar={formatar} linhas={linhas} />
          </div>
          {/* `overflowY: auto` — a lista rola dentro da altura do globo em vez de
              esticar o bloco. Sem isto, dez países fariam o card crescer e o
              globo ficaria com uma faixa de vazio embaixo. */}
          <div style={{ flex: "1 1 0", minWidth: 0, overflowY: "auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <Ranking linhas={linhas} formatar={formatar} />
          </div>
        </div>
      ) : (
        <Ranking linhas={linhas} formatar={formatar} />
      )}

      {/* 🔴 ATRIBUIÇÃO INCOMPLETA APARECE. Esconder o que não foi atribuído é o
          erro central desta ferramenta: o usuário compara com o KPI, vê que não
          fecha, e conclui que um dos dois está errado. */}
      {semPais > 0 && (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          <strong className="text-warning">{semPais}</strong>{" "}
          {semPais === 1 ? "venda sem país identificado" : "vendas sem país identificado"} — não
          entram no {efetiva === "globo" ? "globo" : "ranking"}.
        </p>
      )}
    </div>
  );
}

/**
 * Enquanto o pedaço do globo não chegou, mostra o RANKING — não um esqueleto.
 * A informação já está disponível; o globo é a versão bonita dela, e trocar
 * informação por uma caixa cinza durante o download é uma piora.
 */
function GloboCarregado(props: {
  pontos: PontoPais[];
  linhas: LinhaPais[];
  altura: number;
  tema: "dark" | "light";
  formatar: (n: number) => string;
}) {
  const [pronto, setPronto] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    // Segunda chamada é instantânea: o módulo já está no cache do bundler.
    import("./GlobeView").then(() => vivo && setPronto(true)).catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (props.pontos.length === 0) {
    return (
      <EmptyState
        compacto
        titulo="Nenhum país com posição conhecida"
        causa="Há vendas com país, mas o código recebido não está na base de centroides."
      />
    );
  }

  if (!pronto) return <Ranking linhas={props.linhas} formatar={props.formatar} />;

  return (
    <GloboLazy
      pontos={props.pontos}
      altura={props.altura}
      tema={props.tema}
      formatar={props.formatar}
    />
  );
}

function Ranking({ linhas, formatar }: { linhas: LinhaPais[]; formatar: (n: number) => string }) {
  const max = Math.max(...linhas.map((l) => l.receita), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 340, overflowY: "auto" }}>
      {linhas.map((l) => (
        <div key={l.code} style={{ display: "flex", alignItems: "center", gap: 10, position: "relative", padding: "5px 8px" }}>
          {/* Barra de proporção ATRÁS do conteúdo: compara a olho sem gastar uma
              coluna a mais numa lista que já tem quatro. */}
          <span
            aria-hidden="true"
            style={{
              position: "absolute", left: 0, top: 2, bottom: 2,
              width: `${(l.receita / max) * 100}%`,
              background: "var(--tk-tint-primary)",
              borderRadius: 4,
            }}
          />
          <span aria-hidden="true" style={{ position: "relative", fontSize: 15, flex: "none" }}>{l.bandeira}</span>
          <span className="text-caption text-text" style={{ position: "relative", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {l.nome}
          </span>
          <span className="text-caption text-text-muted" style={{ position: "relative", fontVariantNumeric: "tabular-nums", flex: "none" }}>
            {l.vendas}
          </span>
          <span className="text-caption text-text-secondary" style={{ position: "relative", fontVariantNumeric: "tabular-nums", flex: "none", minWidth: 88, textAlign: "right" }}>
            {formatar(l.receita)}
          </span>
        </div>
      ))}
    </div>
  );
}
