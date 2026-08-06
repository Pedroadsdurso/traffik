"use client";

import * as React from "react";
import Globe, { type GlobeMethods } from "react-globe.gl";
import { Color, MeshPhongMaterial } from "three";
import { WORLD_LAND } from "@/lib/worldGeo";

/**
 * GlobeView — o globo de dados. **Nunca importe este arquivo direto.**
 * Ele é carregado por `next/dynamic` a partir do `CountryPanel`: `react-globe.gl`
 * arrasta o three.js inteiro, e estático ele entraria no bundle de quem só quer
 * ver o faturamento do dia.
 *
 * ⛔ NÃO EXISTEM ARCOS AQUI, E A AUSÊNCIA É A REGRA.
 * Arco representa TRAJETO de A para B — voo, remessa, rota. Uma venda no Chile
 * não vem de lugar nenhum: ela é um ponto, não um caminho. Arco aqui seria
 * decoração se passando por dado, que é o defeito mais caro que uma ferramenta
 * de atribuição pode ter. Venda nova emite um **anel que expande e some**
 * (`ringsData`) no próprio país: mesma função de chamar atenção, sem inventar
 * geografia.
 *
 * ⚠️ ESCALA LOGARÍTMICA na altura das colunas. Com o dado real (o maior país
 * fatura ~60× o menor) uma escala linear deixaria um pilar e seis pontos
 * invisíveis — o gráfico passaria a dizer "só existe o Brasil", que é falso.
 */

export type PontoPais = {
  code: string;
  nome: string;
  lat: number;
  lng: number;
  vendas: number;
  receita: number;
};

type Props = {
  pontos: PontoPais[];
  aoEscolher?: (code: string) => void;
  altura: number;
  tema: "dark" | "light";
  formatar: (n: number) => string;
};

/* Paleta do globo. Fora dos tokens de propósito: o three.js precisa de cores
   resolvidas (ele não entende `var(--tk-*)`), e estes valores SÃO os tokens —
   `success` para o dado, superfícies da escada de elevação para a esfera. */
const CORES = {
  dark: {
    oceano: "#111c2e",          // um degrau ACIMA do fundo do card, não preto puro
    continente: "#1e2f4a",      // polígono PREENCHIDO — sem isto a Terra é esqueleto
    contorno: "#40608c",
    halo: "#22d3ee",
    haloAlt: 0.09,              // discreto: percebido de canto de olho
    coluna: "#22c55e",
  },
  light: {
    oceano: "#eef4fb",
    continente: "#cbd8e8",      // continente MAIS ESCURO que o oceano — invertido
    contorno: "#8ea6c4",
    halo: "#60a5fa",
    haloAlt: 0.06,
    coluna: "#15803d",          // verde escuro: o claro pede mais peso
  },
} as const;

export default function GlobeView({ pontos, aoEscolher, altura, tema, formatar }: Props) {
  const ref = React.useRef<GlobeMethods | undefined>(undefined);
  const box = React.useRef<HTMLDivElement>(null);
  const [lado, setLado] = React.useState(0);
  const [sel, setSel] = React.useState<PontoPais | null>(null);
  const c = CORES[tema];

  const semMovimento = React.useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  );

  /* 🐛 `globeMaterial` é PROP e recebe um Material DE VERDADE do three.
     Duas tentativas anteriores erraram por caminhos opostos, e as duas
     derrubavam a tela:
       1. passar `{color, opacity}` como prop → o react-globe.gl chama
          `.dispose()` no que recebe, objeto simples não tem, e a aba congelava;
       2. tentar `g.globeMaterial()` pelo ref → o método NÃO EXISTE nesta versão,
          a exceção estourava dentro do `onGlobeReady` e levava junto a câmera,
          as luzes e o próprio canvas — o globo simplesmente não aparecia.
     Um `MeshPhongMaterial` resolve as duas: tem `dispose` e é a API documentada.

     🔴 O `emissive` é o que ACABA COM O TERMINADOR DIA/NOITE. Sem ele a
     direcional deixa metade da esfera preta, e o país que estivesse do lado
     escuro sumia — num globo de DADOS isso é perder informação por estética. */
  const material = React.useMemo(
    () =>
      new MeshPhongMaterial({
        color: new Color(c.oceano),
        emissive: new Color(c.oceano),
        emissiveIntensity: 0.55,
        shininess: 0,
      }),
    [c.oceano],
  );

  const paises = React.useMemo(
    () => [{ type: "Feature" as const, geometry: WORLD_LAND, properties: {} }],
    [],
  );

  /* 🔴 O CANVAS É QUADRADO. O three.js dimensiona a esfera pela MENOR dimensão do
     canvas: num bloco de 1400×300 ele desenhava uma bolinha de 300px perdida no
     meio — os "~15% da largura" do print. Aqui o canvas é um quadrado do lado da
     altura disponível e fica centralizado, então a esfera preenche o bloco. */
  /* 🐛 MEDIÇÃO SÍNCRONA NO LAYOUT, e só DEPOIS o observer.
     Com apenas `ResizeObserver` num `useEffect`, o `lado` ficava preso em 0 e o
     componente devolvia para sempre o div de placeholder — 1291×420 e nenhum
     canvas. O observer é ótimo para MUDANÇAS de tamanho e péssimo como fonte da
     PRIMEIRA medida: ele depende de um disparo inicial que aqui não chegava.
     `useLayoutEffect` + `getBoundingClientRect` dá a medida antes da pintura. */
  React.useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const medir = (largura: number) =>
      setLado(Math.max(0, Math.floor(Math.min(largura, altura))));

    medir(el.getBoundingClientRect().width);

    const ro = new ResizeObserver((entradas) => {
      const largura = entradas[0]?.contentRect.width;
      if (largura) medir(largura);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [altura]);

  const [rodando, setRodando] = React.useState(!semMovimento);
  React.useEffect(() => {
    const aoTrocar = () => setRodando(!semMovimento && !document.hidden);
    document.addEventListener("visibilitychange", aoTrocar);
    return () => document.removeEventListener("visibilitychange", aoTrocar);
  }, [semMovimento]);

  React.useEffect(() => {
    const g = ref.current;
    if (!g) return;
    const ctrl = g.controls() as { autoRotate: boolean; autoRotateSpeed: number };
    ctrl.autoRotate = rodando;
    ctrl.autoRotateSpeed = 0.3;
  }, [rodando, lado]);

  const maxReceita = Math.max(...pontos.map((p) => p.receita), 1);

  /* 🔴 TETO DE ALTURA. `pointAltitude` é em unidades do RAIO da esfera: o valor
     anterior (0.04 + 0.30) punha a maior coluna a 34% do raio, e o globo virava
     um ouriço. Pior, um espinho tão alto saindo do Brasil cruza visualmente o
     Atlântico em perspectiva — foi isso, e não coordenada errada, que fez as
     colunas parecerem estar no oceano. Os 7 centroides foram conferidos e estão
     todos em terra.

     Agora a faixa INTEIRA cabe entre 1,5% e 12% do raio: alfinete espetado, não
     antena. A compressão logarítmica continua e dá para checar na tela — com o
     seed, o Chile fatura ~1/60 do Brasil e a coluna dele fica em torno de
     metade da brasileira. Se um dia a razão visual virar 60×, a escala voltou a
     ser linear. */
  const ALT_MIN = 0.015;
  const ALT_MAX = 0.12;

  const colunas = React.useMemo(
    () =>
      pontos.map((p) => ({
        ...p,
        alt:
          ALT_MIN +
          (Math.log1p(Math.max(p.receita, 0)) / Math.log1p(maxReceita)) * (ALT_MAX - ALT_MIN),
      })),
    [pontos, maxReceita],
  );

  /* ⛔ O ANEL DE VENDA NOVA FOI REMOVIDO, e a remoção é deliberada.
     Ele dependia de "qual país teve a venda mais recente", e esse dado NÃO
     EXISTE: `byCountry` é um agregado sem carimbo de tempo, e o feed não traz
     país. Ligar não era uma linha — era uma agregação nova em `metrics.ts`.
     Deixar o código implementado e inerte seria criar mais um caso do
     "controle que não controla nada", que é problema-raiz registrado nesta base.
     Quando houver o dado, isto volta como `ringsData` — nunca como arco. */

  if (lado === 0) return <div ref={box} style={{ width: "100%", height: altura }} />;

  return (
    <div
      ref={box}
      style={{ width: "100%", height: altura, position: "relative", display: "grid", placeItems: "center" }}
      onMouseEnter={() => setRodando(false)}
      onMouseLeave={() => setRodando(!semMovimento && !document.hidden)}
    >
      <Globe
        ref={ref}
        width={lado}
        height={lado}
        backgroundColor="rgba(0,0,0,0)"
        showGlobe
        globeMaterial={material}
        showAtmosphere
        atmosphereColor={c.halo}
        atmosphereAltitude={c.haloAlt}
        polygonsData={paises}
        polygonCapColor={() => c.continente}
        polygonSideColor={() => "rgba(0,0,0,0)"}
        polygonStrokeColor={() => c.contorno}
        polygonAltitude={0.008}
        pointsData={colunas}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="alt"
        /* Fina: a coluna marca ONDE, a altura diz QUANTO. Grossa, ela cobre o
           próprio país que deveria apontar. */
        pointRadius={0.13}
        pointResolution={12}
        /* UMA cor só, a de valor positivo. Gradiente por país seria arco-íris
           sem significado: a grandeza já está na ALTURA da coluna. */
        pointColor={() => c.coluna}
        /* 🔴 CABEÇA CLICÁVEL no topo de cada coluna. Sem ela o alvo é um
           cilindro de 0,13 de raio, e acertar com o mouse é sorte — testado:
           o popover simplesmente não abria. O marcador HTML é um nó do DOM,
           então ganha área de clique, cursor e foco de graça, e ainda é o
           "disco no topo" que a coluna precisava para ter cabeça. */
        htmlElementsData={colunas}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={(d: object) => (d as { alt: number }).alt}
        htmlElement={(d: object) => {
          const p = d as PontoPais;
          const el = document.createElement("div");
          el.style.cssText =
            `width:14px;height:14px;border-radius:999px;cursor:pointer;` +
            `background:${c.coluna};box-shadow:0 0 0 3px ${c.coluna}33;` +
            `transition:box-shadow 120ms;pointer-events:auto`;
          el.title = `${p.nome} — ${formatar(p.receita)}`;
          el.onmouseenter = () => { el.style.boxShadow = `0 0 0 6px ${c.coluna}44`; };
          el.onmouseleave = () => { el.style.boxShadow = `0 0 0 3px ${c.coluna}33`; };
          el.onclick = () => {
            setSel(p);
            aoEscolher?.(p.code);
            ref.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.8 }, 700);
          };
          return el;
        }}
        pointLabel={(d) => {
          const p = d as PontoPais;
          return `<div style="font:500 12px/1.5 system-ui;padding:6px 9px;border-radius:6px;background:${
            tema === "light" ? "#fff" : "#151d2d"
          };color:${tema === "light" ? "#0f172a" : "#f8fafc"};border:1px solid ${
            tema === "light" ? "#e2e8f0" : "#243044"
          }"><strong>${p.nome}</strong><br/>${formatar(p.receita)}</div>`;
        }}
        onPointClick={(d) => {
          const p = d as PontoPais;
          setSel(p);
          aoEscolher?.(p.code);
          ref.current?.pointOfView({ lat: p.lat, lng: p.lng, altitude: 1.8 }, 700);
        }}
        onGlobeReady={() => {
          /* Blindado: qualquer erro aqui rodava DENTRO do ciclo de init do
             three-globe e derrubava o canvas inteiro. Uma câmera que não
             centraliza é um detalhe; um globo que não aparece, não. */
          try {
            const g = ref.current;
            if (!g) return;
            // Câmera no país de MAIOR faturamento — abrir no meridiano zero é
            // abrir no meio do Atlântico, onde não há dado.
            const maior = pontos.reduce((a, b) => (b.receita > a.receita ? b : a), pontos[0]!);
            if (maior) g.pointOfView({ lat: maior.lat, lng: maior.lng, altitude: 2.0 }, 0);
          } catch {
            /* sem centralização; o globo continua de pé */
          }
        }}
      />

      {sel && (
        <div
          className="bg-surface border border-border"
          style={{
            position: "absolute", right: 8, top: 8, zIndex: 2,
            padding: 12, borderRadius: "var(--tk-radius-card)",
            boxShadow: "var(--tk-shadow-overlay)", minWidth: 190,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start" }}>
            <span className="text-title text-text">{sel.nome}</span>
            <button
              type="button"
              onClick={() => setSel(null)}
              aria-label="Fechar"
              className="text-text-muted"
              style={{ background: "none", border: 0, cursor: "pointer", lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
          <dl style={{ margin: "8px 0 0", display: "grid", gap: 4 }}>
            <Linha rotulo="Faturamento" valor={formatar(sel.receita)} />
            <Linha rotulo="Vendas" valor={String(sel.vendas)} />
            <Linha rotulo="Ticket médio" valor={formatar(sel.vendas ? sel.receita / sel.vendas : 0)} />
          </dl>
        </div>
      )}
    </div>
  );
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <dt className="text-caption text-text-muted">{rotulo}</dt>
      <dd className="text-caption text-text" style={{ margin: 0, fontVariantNumeric: "tabular-nums" }}>{valor}</dd>
    </div>
  );
}
