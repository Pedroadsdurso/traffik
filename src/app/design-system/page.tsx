"use client";

import { useEffect, useState } from "react";
import { lerOklch, oklchParaRgb, rgbParaHex, contraste, type Rgb } from "@/lib/cor";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Button } from "@/components/tk/Button";
import { Badge, type TomSelo } from "@/components/tk/Badge";
import { Card, CardMetrica } from "@/components/tk/Card";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";
import { Tooltip } from "@/components/tk/Tooltip";
import { Checkbox, Radio, Switch } from "@/components/tk/Controles";
import { Skeleton, AreaCarregando, Separator } from "@/components/tk/Skeleton";
import { DonutChart } from "@/components/tk/DonutChart";
import { Aprovacao } from "@/components/tk/Aprovacao";

/* ⛔ ANTES DO PRIMEIRO USO. Estavam no FIM do arquivo e eram consumidas ~950
   linhas acima: `const` em zona morta temporal. Aqui funcionava por acaso —
   o uso mora dentro de componentes, que só executam depois do módulo
   carregar. Mover uma daquelas chamadas para o corpo do módulo quebraria a
   página, e nada acusaria antes da tela. */
const mono: React.CSSProperties = { fontFamily: "var(--tk-font-mono)", fontSize: 12 };
const celula: React.CSSProperties = { padding: "8px 12px", verticalAlign: "middle" };

/**
 * /design-system — a página de verificação visual de todas as fases.
 *
 * Ela NÃO é uma vitrine bonita de swatches. O que ela existe para responder é
 * uma pergunta específica, e a pergunta tem um jeito conhecido de dar errado
 * nesta base: "passa no build" não prova que está em uso. Um utilitário novo que
 * silenciosamente pinta com a cor ANTIGA compila, passa no lint e parece certo.
 *
 * Por isso o primeiro bloco da página não é cor nenhuma: é a leitura do que o
 * NAVEGADOR resolveu para os quatro nomes de token que colidem com o sistema
 * legado. O valor exibido vem de `getComputedStyle`, não de uma constante deste
 * arquivo — se a isolação do `@theme inline` quebrar, quebra aqui, na tela.
 *
 * Fica fora de /dashboard de propósito: não lê dado nenhum do usuário, e precisa
 * abrir em qualquer estado de sessão para servir de referência nas fases 2 a 7.
 */

/* ── Leitura do que a página realmente pintou ─────────────────────────────── */

let pincel: CanvasRenderingContext2D | null | undefined;

/**
 * Converte o que o navegador devolveu em hexadecimal sRGB — rasterizando num
 * canvas de 1×1 pixel.
 *
 * 🔴 Por que não basta ler a string e converter aqui: **o OKLCH que eu escrevo
 * não é o que o navegador recebe.** O Lightning CSS (o transformador que o Next
 * usa) transpila `oklch()` para um hexadecimal de fallback MAIS um
 * `@supports (color: lab(...))` com o valor em `lab()`. No Chrome quem vale é o
 * ramo do `lab()`, e um parser de `oklch` aqui simplesmente não acharia nada —
 * a página exibiria "não resolveu" em todos os tokens, e o motivo não estaria
 * em lugar nenhum.
 *
 * Rasterizar resolve isso de um jeito que não envelhece: o pixel é o que a tela
 * pinta, seja qual for a sintaxe que o navegador aceite hoje ou amanhã. E
 * comparar STRINGS de cor seria pior que inútil — `lab(...)` e `rgb(...)` nunca
 * são iguais como texto, então a verificação de isolação passaria sempre, por
 * diferença de formato, sem nunca ter olhado a cor.
 *
 * (Conferido em 05/08/2026: os 21 hexadecimais que o Lightning CSS emitiu batem
 * com os que `lib/cor.ts` calcula a partir do OKLCH — 0 divergências.)
 */
function paraHex(css: string): string | null {
  const t = css.trim();
  if (!t || t === "transparent" || t === "none") return null;

  if (pincel === undefined) {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    pincel = canvas.getContext("2d", { willReadFrequently: true });
  }

  if (pincel) {
    // Sentinela: o canvas IGNORA em silêncio uma atribuição de cor inválida.
    // Sem ele, uma sintaxe que o navegador não entendesse voltaria como a cor
    // anterior — a página exibiria um hexadecimal plausível e falso.
    const SENTINELA = "#010203";
    pincel.fillStyle = SENTINELA;
    pincel.fillStyle = t;
    if (pincel.fillStyle === SENTINELA) return null;

    pincel.clearRect(0, 0, 1, 1);
    pincel.fillRect(0, 0, 1, 1);
    const d = pincel.getImageData(0, 0, 1, 1).data;
    if (d[3] > 0) return rgbParaHex([d[0] / 255, d[1] / 255, d[2] / 255]);
    return null;
  }

  // Sem canvas (ambiente sem 2d context), cai para a conversão de lib/cor.ts.
  const okl = lerOklch(t);
  if (okl) return rgbParaHex(oklchParaRgb(okl));
  const rgbLit = /rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(t);
  if (rgbLit) return rgbParaHex([+rgbLit[1] / 255, +rgbLit[2] / 255, +rgbLit[3] / 255]);
  if (/^#[0-9a-f]{6}$/i.test(t)) return t.toUpperCase();
  return null;
}

function hexParaRgbLocal(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

/** Lê uma custom property do `<html>` como o navegador a resolveu. */
function lerVar(nome: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
}

/** Cria um nó fora da tela com a classe/estilo pedido e lê a cor resultante. */
function corDe(classe: string, estilo: string, prop: "backgroundColor" | "color"): string {
  const el = document.createElement("div");
  el.className = classe;
  el.setAttribute("style", `position:fixed;left:-9999px;top:0;width:1px;height:1px;${estilo}`);
  document.body.appendChild(el);
  const valor = getComputedStyle(el)[prop];
  el.remove();
  return valor;
}

/* ── Dados dos blocos ─────────────────────────────────────────────────────── */

type Token = { nome: string; utilitario: string; uso: string };

const SUPERFICIE: Token[] = [
  { nome: "background", utilitario: "bg-background", uso: "fundo raiz da aplicação" },
  { nome: "background-alt", utilitario: "bg-background-alt", uso: "rail lateral, barra de contexto" },
  { nome: "surface", utilitario: "bg-surface", uso: "card, painel" },
  { nome: "surface-hover", utilitario: "bg-surface-hover", uso: "hover, cabeçalho de tabela, input, overlay" },
  { nome: "border", utilitario: "border-border", uso: "contorno e separador" },
];

const TEXTO: Token[] = [
  { nome: "text", utilitario: "text-text", uso: "número, título" },
  { nome: "text-secondary", utilitario: "text-text-secondary", uso: "rótulo, texto de apoio" },
  { nome: "text-muted", utilitario: "text-text-muted", uso: "placeholder, metadado, desabilitado" },
];

const MARCA: Token[] = [
  { nome: "primary", utilitario: "text-primary", uso: "TEXTO, link, ícone, nav, ativo — não é fundo de botão" },
  { nome: "primary-hover", utilitario: "text-primary-hover", uso: "hover do primary como texto" },
  { nome: "primary-solid", utilitario: "bg-primary-solid", uso: "FUNDO do botão primário" },
  { nome: "primary-solid-hover", utilitario: "bg-primary-solid-hover", uso: "hover do botão" },
  { nome: "on-primary", utilitario: "text-on-primary", uso: "rótulo sobre primary-solid" },
  { nome: "accent", utilitario: "bg-accent", uso: "série de gráfico, dado ao vivo, seleção — NÃO é cor de texto" },
  { nome: "on-accent", utilitario: "text-on-accent", uso: "rótulo sobre um preenchimento de accent" },
];

const SEMANTICA: Token[] = [
  { nome: "success", utilitario: "text-success", uso: "lucro, variação favorável" },
  { nome: "warning", utilitario: "text-warning", uso: "limite de orçamento, atenção, pendente" },
  { nome: "danger", utilitario: "text-danger", uso: "prejuízo, variação desfavorável, erro" },
];

const CANAL: Token[] = [
  { nome: "channel-meta", utilitario: "bg-channel-meta", uso: "série Meta" },
  { nome: "channel-tiktok", utilitario: "bg-channel-tiktok", uso: "série TikTok" },
  { nome: "channel-google", utilitario: "bg-channel-google", uso: "série Google" },
  { nome: "channel-outros", utilitario: "bg-channel-outros", uso: "série Outros" },
];

const TIPOGRAFIA = [
  { classe: "text-display", spec: "28/34 · 600 · -0.02em", uso: "título de página" },
  { classe: "text-metric-xl", spec: "30 × densidade · 600 · tabular", uso: "número principal de KPI" },
  { classe: "text-metric-md", spec: "20 × densidade · 600 · tabular", uso: "número secundário" },
  { classe: "text-title", spec: "15/20 · 600", uso: "título de card — o nível que falta hoje" },
  { classe: "text-body", spec: "14/20 · 400", uso: "texto corrente" },
  { classe: "text-label", spec: "13/18 · 500", uso: "rótulo de campo e de KPI" },
  { classe: "text-caption", spec: "12/16 · 400", uso: "apoio, metadado" },
  { classe: "text-micro", spec: "11/14 · 500 · +0.04em · caixa alta", uso: "RESTRITO: cabeçalho de tabela e eyebrow" },
];

/**
 * 🐛 O VALOR NÃO É MAIS ESCRITO AQUI — ele é LIDO do CSS em tempo de execução.
 *
 * Estava fixo em `"10px"` e `"14px"`, e em 07/08/2026 os tokens subiram para 16
 * e 20. A página que existe para documentar o sistema passou a documentar o
 * sistema ANTIGO, e ninguém percebeu porque `tsc`, `lint` e `build` não leem
 * string de documentação.
 *
 * É o mesmo defeito que esta sessão inteira perseguiu do outro lado — comentário
 * que afirma um efeito. A correção estrutural é a mesma: em vez de copiar o
 * valor, leia a fonte. Agora só dá para ficar errado se o próprio token sumir.
 */
const RAIOS = [
  { nome: "controle", uso: "botão, input, badge" },
  { nome: "card", uso: "card, painel de conteúdo" },
  { nome: "painel", uso: "modal, gaveta" },
  { nome: "pill", uso: "pill, avatar, indicador" },
];

/** Os quatro nomes que colidem com o sistema legado — o motivo do prefixo. */
const COLISOES = [
  { token: "surface", utilitario: "bg-surface", legado: "--color-surface", prop: "backgroundColor" as const },
  { token: "text", utilitario: "text-text", legado: "--color-text", prop: "color" as const },
  { token: "border", utilitario: "bg-border", legado: "--color-border", prop: "backgroundColor" as const },
  { token: "accent", utilitario: "bg-accent", legado: "--color-accent", prop: "backgroundColor" as const },
];

type LinhaColisao = {
  token: string;
  utilitario: string;
  doUtilitario: string | null;
  doToken: string | null;
  doLegado: string | null;
  isolado: boolean;
  distingue: boolean;
};

/** Tudo que a página LÊ do navegador — nunca escreve. */
type Leitura = {
  valores: Record<string, { resolvido: string; hex: string | null }>;
  colisoes: LinhaColisao[];
  fontes: { sans: string; mono: string };
  outras: Record<string, string>;
};

/* ── Página ───────────────────────────────────────────────────────────────── */

export default function DesignSystemPage() {
  const { theme, setTheme } = useTheme();
  const [densidade, setDensidade] = useState<"compact" | "default" | "comfortable">("compact");
  /* Uma leitura só, num estado só.
     - Estado, e não chamada durante o render, porque no render de HIDRATAÇÃO o
       `window` já existe: a página serviria um valor no HTML do servidor e
       outro no cliente, e o React acusaria a divergência.
     - Um objeto, e não quatro estados, porque são quatro recortes da MESMA
       leitura do DOM. Separados, seriam quatro setState em cascata — e poderiam
       ficar dessincronizados entre si, mostrando a cor de um tema ao lado da
       densidade de outro. */
  const [leitura, setLeitura] = useState<Leitura>({
    valores: {},
    colisoes: [],
    fontes: { sans: "", mono: "" },
    outras: {},
  });
  const { valores, colisoes, fontes, outras } = leitura;

  /* A densidade é atributo do elemento RAIZ — é assim que ela funciona de
     verdade, e componente nenhum a conhece. A limpeza na saída existe para a
     página não deixar a preferência grudada nas outras rotas. */
  useEffect(() => {
    document.documentElement.setAttribute("data-density", densidade);
    return () => document.documentElement.removeAttribute("data-density");
  }, [densidade]);

  /* Releitura a cada troca de tema ou densidade: os valores exibidos têm de ser
     os do tema que está na tela AGORA, senão a página confirmaria o tema errado. */
  useEffect(() => {
    const valores: Leitura["valores"] = {};
    for (const t of [...SUPERFICIE, ...TEXTO, ...MARCA, ...SEMANTICA, ...CANAL]) {
      const resolvido = lerVar(`--tk-${t.nome}`);
      valores[t.nome] = { resolvido, hex: paraHex(resolvido) };
    }

    const colisoes = COLISOES.map(({ token, utilitario, legado, prop }) => {
      const doUtilitario = paraHex(corDe(utilitario, "", prop));
      const doToken = paraHex(lerVar(`--tk-${token}`));
      const doLegado = paraHex(corDe("", `background:var(${legado});color:var(${legado})`, prop));
      return {
        token,
        utilitario,
        doUtilitario,
        doToken,
        doLegado,
        isolado: !!doUtilitario && doUtilitario === doToken,
        // Uma asserção que não pode falhar não mede nada: quando o token novo e o
        // legado calham de ter o MESMO valor neste tema, este par não distingue
        // os dois sistemas, e a página precisa dizer isso em vez de exibir um ✓
        // que teria aparecido de qualquer jeito.
        distingue: !!doToken && !!doLegado && doToken !== doLegado,
      };
    });

    const estilo = getComputedStyle(document.documentElement);
    const nomes = [
      "pad-card", "pad-hero", "gap-grid", "altura-linha", "altura-controle", "escala-dado",
      "dur-rapida", "dur-padrao", "dur-painel",
      // Lidos, e não escritos à mão — ver a nota do `RAIOS`.
      ...RAIOS.map((r) => `radius-${r.nome}`),
    ];

    // eslint-disable-next-line react-hooks/set-state-in-effect -- lê um sistema externo (o CSS que o navegador resolveu), que é exatamente o caso que a doc do React permite: o valor não existe até a página pintar
    setLeitura({
      valores,
      colisoes,
      fontes: {
        sans: estilo.getPropertyValue("--tk-font-sans").trim(),
        mono: estilo.getPropertyValue("--tk-font-mono").trim(),
      },
      outras: Object.fromEntries(nomes.map((n) => [n, lerVar(`--tk-${n}`)])),
    });
  }, [theme, densidade]);

  const razao = (a: string | null, b: string | null) =>
    a && b ? contraste(hexParaRgbLocal(a), hexParaRgbLocal(b)).toFixed(2) : "—";

  const fundoDaPagina = valores["background"]?.hex ?? null;
  const superficie = valores["surface"]?.hex ?? null;

  return (
    <div
      className="bg-background text-text"
      style={{ minHeight: "100vh", fontFamily: "var(--tk-font-sans)" }}
    >
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 96px" }}>
        {/* ── Cabeçalho ── */}
        <header style={{ marginBottom: 32 }}>
          <p className="text-micro text-text-muted" style={{ marginBottom: 8 }}>
            Banco de estados · não é vitrine de componente
          </p>
          <h1
            className="text-display"
            style={{
              background: "var(--tk-gradient-brand)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              margin: 0,
              width: "fit-content",
            }}
          >
            Design system do TrackHub
          </h1>
          {/* ⛔ O QUE ESTA PÁGINA É, e a definição é do dono (07/08/2026). Ela
              não é galeria: galeria de componente foi recusada, e com razão —
              vira trabalho que não entrega tela. */}
          <p className="text-body text-text-secondary" style={{ marginTop: 8, maxWidth: 640 }}>
            <strong>Banco de estados.</strong> Ela existe para exercitar estados que a tela real
            não consegue produzir com o dado disponível. <strong>Não é vitrine de componente</strong> —
            um componente só entra aqui se o Dashboard não conseguir mostrá-lo.
          </p>
          <p className="text-caption text-text-muted" style={{ marginTop: 6, maxWidth: 640 }}>
            Os valores de token são lidos do navegador com{" "}
            <code style={mono}>getComputedStyle</code>: se mudarem no{" "}
            <code style={mono}>globals.css</code>, mudam aqui.{" "}
            <strong>E é para continuar assim.</strong> Até 07/08/2026 o raio do card estava escrito
            à mão como <code style={mono}>&quot;10px&quot;</code> e seguiu dizendo isso depois de o token
            virar 16 — a página que documenta o sistema documentava o sistema antigo. Documentação
            que <em>afirma</em> um valor envelhece; documentação que <em>lê</em> o valor não.
          </p>
          <p className="text-caption text-text-muted" style={{ marginTop: 6, maxWidth: 640 }}>
            O valor cru abaixo de cada cor vem em <code style={mono}>lab()</code>, e não em{" "}
            <code style={mono}>oklch()</code>: o Lightning CSS transpila o OKLCH no build. Os
            hexadecimais que ele produz foram conferidos contra{" "}
            <code style={mono}>lib/cor.ts</code> — 21 tokens, 0 divergências.
          </p>

          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginTop: 20 }}>
            <Alternador
              rotulo="Tema"
              opcoes={[
                { valor: "dark", texto: "Escuro" },
                { valor: "light", texto: "Claro" },
              ]}
              atual={theme}
              aoTrocar={(v) => setTheme(v as "dark" | "light")}
            />
            <Alternador
              rotulo="Densidade"
              opcoes={[
                { valor: "compact", texto: "Compacta" },
                { valor: "default", texto: "Padrão" },
                { valor: "comfortable", texto: "Confortável" },
              ]}
              atual={densidade}
              aoTrocar={(v) => setDensidade(v as typeof densidade)}
            />
          </div>
        </header>

        {/* ── 0. A verificação que justifica a página ── */}
        <Secao
          titulo="Isolação do sistema novo"
          resumo="Quatro nomes de token colidem com os legados. Se a isolação quebrar, quebra aqui."
        >
          <p className="text-caption text-text-secondary" style={{ marginBottom: 12, maxWidth: 720 }}>
            O <code style={{ fontFamily: "var(--tk-font-mono)" }}>@theme inline</code> faz{" "}
            <code style={{ fontFamily: "var(--tk-font-mono)" }}>bg-surface</code> sair como{" "}
            <code style={{ fontFamily: "var(--tk-font-mono)" }}>var(--tk-surface)</code>. Sem o{" "}
            <code style={{ fontFamily: "var(--tk-font-mono)" }}>inline</code> ele sairia como{" "}
            <code style={{ fontFamily: "var(--tk-font-mono)" }}>var(--color-surface)</code>, que o
            bloco legado sobrescreve — e todo utilitário novo pintaria com a cor antiga, sem tsc,
            lint ou build acusarem.
          </p>

          <Tabela cabecalho={["Utilitário", "resolveu para", "--tk-*", "legado", "veredito"]}>
            {colisoes.map((c) => (
              <tr key={c.token} style={{ borderTop: "1px solid var(--tk-border)" }}>
                <td style={celula}>
                  <code style={mono}>{c.utilitario}</code>
                </td>
                <td style={celula}>
                  <Amostra hex={c.doUtilitario} />
                </td>
                <td style={celula}>
                  <Amostra hex={c.doToken} />
                </td>
                <td style={celula}>
                  <Amostra hex={c.doLegado} />
                </td>
                <td style={celula}>
                  {!c.isolado ? (
                    <span className="text-label text-danger">
                      ✗ pintou com outra coisa que não o token
                    </span>
                  ) : c.distingue ? (
                    <span className="text-label text-success">✓ isolado</span>
                  ) : (
                    <span className="text-label text-warning" title="Os dois sistemas têm o mesmo valor neste tema">
                      ✓ isolado · este par não distingue neste tema
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </Tabela>

          <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
            &quot;Não distingue&quot; quer dizer que o token novo e o legado calham de ter o mesmo
            valor neste tema — a linha passa, mas passaria de qualquer jeito. Troque para o tema
            escuro para ver as quatro com dente.
          </p>
        </Secao>

        {/* ── 1. Superfície e a escada de elevação ── */}
        <Secao
          titulo="Superfície"
          resumo="No tema escuro a elevação se faz com COR, não com sombra: background → surface → surface-hover."
        >
          <GradeTokens tokens={SUPERFICIE} valores={valores} fundo={fundoDaPagina} />
          <div
            style={{
              marginTop: 20,
              display: "flex",
              alignItems: "flex-end",
              gap: 0,
              borderRadius: "var(--tk-radius-card)",
              overflow: "hidden",
              border: "1px solid var(--tk-border)",
            }}
          >
            {["background", "background-alt", "surface", "surface-hover"].map((n, i) => (
              <div
                key={n}
                style={{
                  flex: 1,
                  background: `var(--tk-${n})`,
                  height: 56 + i * 14,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <span className="text-caption text-text-secondary">{n}</span>
              </div>
            ))}
          </div>
        </Secao>

        {/* ── 2. Texto ── */}
        <Secao
          titulo="Texto"
          resumo="O utilitário é text-text-secondary, e não text-secondary — o nome curto exigiria um token --color-secondary, e aí bg-secondary passaria a existir significando “fundo com a cor do texto de apoio”."
        >
          <GradeTokens tokens={TEXTO} valores={valores} fundo={superficie} amostraDeTexto />
        </Secao>

        {/* ── 3. Marca ── */}
        <Secao
          titulo="Marca"
          resumo="80% neutro · 15% azul (onde eu clico) · 5% ciano (o que está acontecendo). Regra dura: primary não entra em gráfico nem em célula de tabela; accent não entra em botão nem em navegação — e accent NÃO é cor de texto."
        >
          <div
            className="bg-surface"
            style={{
              padding: "var(--tk-pad-card)",
              borderRadius: "var(--tk-radius-card)",
              border: "1px solid var(--tk-danger)",
              marginBottom: 16,
            }}
          >
            <p className="text-title" style={{ margin: "0 0 4px" }}>
              Um azul só não pode ser texto E fundo de botão
            </p>
            <p className="text-caption text-text-secondary" style={{ margin: "0 0 12px", maxWidth: 760 }}>
              Não é preferência, é impossível: o rótulo claro em cima exige luminância ≤ 0.1730, e
              ser legível como texto sobre <code style={mono}>surface</code> exige ≥ 0.2302. O teto é
              menor que o piso. Por isso o botão sólido tem tokens próprios.
            </p>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                className="text-label bg-primary-solid text-on-primary"
                style={{ height: "var(--tk-altura-controle)", padding: "0 16px", borderRadius: "var(--tk-radius-controle)", border: "none", cursor: "pointer" }}
              >
                Botão certo · 4,94:1
              </button>
              <button
                type="button"
                className="text-label bg-primary text-text"
                style={{ height: "var(--tk-altura-controle)", padding: "0 16px", borderRadius: "var(--tk-radius-controle)", border: "none", cursor: "not-allowed" }}
                title="É este par que a correção de 05/08 removeu"
              >
                Botão errado · 3,52:1
              </button>
              <span className="text-label text-primary">primary como TEXTO · 4,59:1 ✓</span>
              <span
                className="text-label bg-accent text-on-accent"
                style={{ padding: "4px 10px", borderRadius: "var(--tk-radius-pill)" }}
              >
                chip de accent · 10,77:1
              </span>
            </div>
          </div>
          <GradeTokens tokens={MARCA} valores={valores} fundo={superficie} />
        </Secao>

        {/* ── 4. Semântica ── */}
        <Secao
          titulo="Semântica"
          resumo="Ficam fora da conta 80/15/5: não decoram, informam, e aparecem exatamente quando o dado exige."
        >
          <GradeTokens tokens={SEMANTICA} valores={valores} fundo={superficie} amostraDeTexto />
        </Secao>

        {/* ── 5. Canal ── */}
        <Secao
          titulo="Canal"
          resumo="Exclusivos de série de gráfico e identificação de plataforma. Meta não é azul e TikTok não é ciano de propósito: azul é primary e ciano é accent neste sistema."
        >
          <GradeTokens tokens={CANAL} valores={valores} fundo={superficie} />
          <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
            Consequência registrada: <strong>warning nunca aparece como série de gráfico</strong>,
            para o laranja do Google não ficar ambíguo.
          </p>
        </Secao>

        {/* ── 6. Gradientes ── */}
        <Secao titulo="Gradientes" resumo="Nunca como fundo de área grande, e nunca em mais de um elemento por tela.">
          <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <div>
              <p className="text-label" style={{ marginBottom: 6 }}>--tk-gradient-brand</p>
              <div style={{ height: 72, borderRadius: "var(--tk-radius-card)", background: "var(--tk-gradient-brand)" }} />
              <p className="text-caption text-text-muted" style={{ marginTop: 6 }}>
                logotipo, CTA principal, indicador de ativo, barra de progresso. Usa os primitivos:
                a marca não muda de cor quando o tema muda.
              </p>
            </div>
            <div>
              <p className="text-label" style={{ marginBottom: 6 }}>--tk-gradient-chart</p>
              <div
                style={{
                  height: 72,
                  borderRadius: "var(--tk-radius-card)",
                  background: "var(--tk-gradient-chart)",
                  border: "1px solid var(--tk-border)",
                }}
              />
              <p className="text-caption text-text-muted" style={{ marginTop: 6 }}>
                preenchimento de área. Derivado de accent/primary — no escuro é idêntico à
                especificação; no claro desce junto com a paleta em vez de virar neon sobre branco.
              </p>
            </div>
          </div>
        </Secao>

        {/* ── 7. Glow ── */}
        <Secao
          titulo="Glow de dado ao vivo"
          resumo="Lista FECHADA: LiveIndicator · linha entrando na Atividade Recente (2s) · card de webhook ao disparar · card de regra em execução · indicador de CAPI enviando · linha selecionada de tabela (só o anel). Qualquer uso fora dela é erro."
        >
          <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
            <div
              className="tk-live-pulso"
              style={{
                width: 12,
                height: 12,
                borderRadius: "var(--tk-radius-pill)",
                background: "var(--tk-accent)",
              }}
            />
            <div
              className="tk-live-pulso bg-surface"
              style={{
                padding: "10px 16px",
                borderRadius: "var(--tk-radius-controle)",
              }}
            >
              <span className="text-label">sincronizando agora</span>
            </div>
            <div
              className="bg-surface"
              style={{ padding: "10px 16px", borderRadius: "var(--tk-radius-controle)", boxShadow: "var(--tk-glow-live)" }}
            >
              <span className="text-label">só o anel (linha selecionada)</span>
            </div>
          </div>
          <p className="text-caption text-text-muted" style={{ marginTop: 12 }}>
            Com <code style={mono}>prefers-reduced-motion: reduce</code> o pulso sai e o anel fica —
            sem o anel, quem desliga movimento perderia a informação em vez de perder a animação.
          </p>
        </Secao>

        {/* ── 8. Tipografia ── */}
        <Secao
          titulo="Tipografia"
          resumo="Oito níveis compostos: cada classe já embute tamanho, altura, peso e tracking. A Fase 0 achou 19 tamanhos distintos nesta base porque tamanho e peso eram escolhidos separados, caso a caso."
        >
          <div className="bg-surface" style={{ padding: "var(--tk-pad-card)", borderRadius: "var(--tk-radius-card)", border: "1px solid var(--tk-border)" }}>
            {TIPOGRAFIA.map((t) => (
              <div
                key={t.classe}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 200px",
                  gap: 16,
                  alignItems: "baseline",
                  padding: "12px 0",
                  borderTop: "1px solid var(--tk-border)",
                }}
              >
                <div className={t.classe}>
                  {t.classe.includes("metric") ? "R$ 128.430,00" : "O gasto de hoje já passou do teto"}
                </div>
                <div>
                  <p className="text-caption" style={{ margin: 0 }}>
                    <code style={mono}>.{t.classe}</code>
                  </p>
                  <p className="text-caption text-text-muted" style={{ margin: 0 }}>{t.spec}</p>
                  <p className="text-caption text-text-muted" style={{ margin: 0 }}>{t.uso}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
            <FamiliaFonte titulo="Instrument Sans · --tk-font-sans" resolvido={fontes.sans} familia="var(--tk-font-sans)" />
            <FamiliaFonte titulo="JetBrains Mono · --tk-font-mono" resolvido={fontes.mono} familia="var(--tk-font-mono)" />
          </div>
          <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
            As duas estão registradas no <code style={mono}>next/font</code> e auto-hospedadas, mas o{" "}
            <code style={mono}>body</code> da aplicação continua em Inter. Trocar a fonte do body
            reflui as 21 rotas de uma vez — é da Fase 3, junto com o shell que a verifica.
          </p>
        </Secao>

        {/* ── 9. Raio ── */}
        {/* ── Rosca e medidor radial ──────────────────────────────────────────
            ⛔ ELES ESTÃO AQUI POR NECESSIDADE, NÃO POR VITRINE. O banco de
            desenvolvimento tem UM canal e UMA forma de pagamento, então no
            Dashboard real a rosca cai no atalho de fatia única e o medidor
            aparece sozinho. Os estados que este acabamento mudou — folga entre
            segmentos, ponta arredondada, fatia minúscula, vários medidores lado
            a lado — são literalmente invisíveis lá.

            É a regra do projeto aplicada: guarda que nunca disparou não é
            guarda, e raio que nunca foi visto não é raio. Aqui o caso é
            produzido de propósito. */}
        <Secao
          titulo="Rosca e medidor radial"
          resumo="Os dois têm estados que o banco de desenvolvimento não produz — um canal e uma forma de pagamento só. Aqui eles existem para serem CONFERIDOS, não para enfeitar."
        >
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ minWidth: 320, flex: "1 1 340px" }}>
              <p className="text-caption text-text-muted" style={{ marginTop: 0 }}>
                Rosca — 4 fatias, com uma minúscula (0,4%) para provar que ela vira ponto e não some.
              </p>
              <DonutChart
                fatias={[
                  { nome: "Meta Ads", valor: 54023, cor: "var(--tk-primary)"  },
                  { nome: "Google Ads", valor: 36828, cor: "var(--tk-accent)"  },
                  { nome: "TikTok Ads", valor: 21012, cor: "var(--tk-category)"  },
                  { nome: "Orgânico", valor: 520, cor: "var(--tk-text-muted)"  },
                ]}
                totalLabel="R$ 112.383"
                formatar={(n) => `R$ ${n.toLocaleString("pt-BR")}`}
              />
            </div>

            <div style={{ minWidth: 320, flex: "1 1 340px" }}>
              <p className="text-caption text-text-muted" style={{ marginTop: 0 }}>
                Medidor radial — os quatro tons, incluindo o NEUTRO de amostra pequena (1 de 1).
              </p>
              <Aprovacao
                linhas={[
                  { name: "Pix", geradas: 128, pagas: 118, rate: 92.2 },
                  { name: "Cartão", geradas: 96, pagas: 61, rate: 63.5 },
                  { name: "Boleto", geradas: 40, pagas: 11, rate: 27.5 },
                  { name: "PayPal", geradas: 1, pagas: 1, rate: 100 },
                ]}
              />
            </div>
          </div>
        </Secao>

        <Secao titulo="Raio" resumo="Quatro valores, um por classe de objeto.">
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {RAIOS.map((r) => (
              <div key={r.nome} style={{ textAlign: "center" }}>
                <div
                  className="bg-surface-hover"
                  style={{
                    width: 96,
                    height: 72,
                    borderRadius: `var(--tk-radius-${r.nome})`,
                    border: "1px solid var(--tk-border)",
                  }}
                />
                <p className="text-caption" style={{ marginTop: 6, marginBottom: 0 }}>
                  <code style={mono}>rounded-{r.nome}</code>
                </p>
                <p className="text-caption text-text-muted" style={{ margin: 0 }}>
                  {outras[`radius-${r.nome}`] || "—"}
                </p>
                <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: 110 }}>{r.uso}</p>
              </div>
            ))}
          </div>
        </Secao>

        {/* ── 10. Elevação ── */}
        <Secao
          titulo="Elevação"
          /* 🔄 ESTE RESUMO DIZIA "sombra existe APENAS em overlay", e a regra
             mudou em 07/08/2026 (`06` §1). Segunda documentação desta página
             pega desatualizada na mesma varredura — a outra era o raio do card,
             fixo em "10px" depois de o token virar 16. */
          resumo="Sombra existe em CARD e em overlay — e em mais nada. Faixa, rail, linha de tabela e header continuam sem: neles a elevação é a escada de cor da primeira seção."
        >
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div
              className="bg-surface"
              style={{
                padding: "var(--tk-pad-card)",
                borderRadius: "var(--tk-radius-card)",
                border: "1px solid var(--tk-border)",
                boxShadow: "var(--tk-shadow-card)",
                width: 240,
              }}
            >
              <p className="text-title" style={{ margin: 0 }}>Card</p>
              <p className="text-caption text-text-muted" style={{ margin: 0 }}>
                <code style={mono}>shadow-card</code> — mais forte no escuro, e não é engano: 6% de preto sobre o fundo escuro não existe
              </p>
            </div>
            <div
              className="bg-surface-hover"
              style={{
                padding: "var(--tk-pad-card)",
                borderRadius: "var(--tk-radius-painel)",
                border: "1px solid var(--tk-border)",
                boxShadow: "var(--tk-shadow-overlay)",
                width: 240,
              }}
            >
              <p className="text-title" style={{ margin: 0 }}>Overlay</p>
              <p className="text-caption text-text-muted" style={{ margin: 0 }}>
                <code style={mono}>shadow-overlay</code> — a única superfície com sombra
              </p>
            </div>
          </div>
        </Secao>

        {/* ── 11. Densidade ── */}
        <Secao
          titulo="Densidade"
          resumo="Componente nenhum conhece densidade — todos só consomem as variáveis. Troque no alternador do topo e veja o bloco abaixo responder."
        >
          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            {[
              { rotulo: "Faturamento", valor: "R$ 128.430" },
              { rotulo: "Lucro", valor: "R$ 41.207" },
              { rotulo: "ROAS", valor: "3,42×" },
            ].map((k) => (
              <div
                key={k.rotulo}
                className="bg-surface"
                style={{ padding: "var(--tk-pad-card)", borderRadius: "var(--tk-radius-card)", border: "1px solid var(--tk-border)" }}
              >
                <p className="text-label text-text-secondary" style={{ margin: 0 }}>{k.rotulo}</p>
                <p className="text-metric-xl" style={{ margin: 0 }}>{k.valor}</p>
              </div>
            ))}
          </div>

          <table style={{ width: "100%", marginTop: "var(--tk-gap-grid)", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Campanha", "Gasto", "Vendas"].map((c) => (
                  <th key={c} className="text-micro text-text-secondary" style={{ textAlign: "left", padding: "0 12px", height: "var(--tk-altura-linha)" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[["Escala — Público frio", "R$ 1.240", "38"], ["Retargeting 7d", "R$ 380", "22"]].map((linha) => (
                <tr key={linha[0]} style={{ borderTop: "1px solid var(--tk-border)" }}>
                  {linha.map((c, i) => (
                    <td key={i} className={i === 0 ? "text-body" : "text-body"} style={{ padding: "0 12px", height: "var(--tk-altura-linha)", fontVariantNumeric: i ? "tabular-nums" : "normal" }}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <Tabela cabecalho={["Variável", "valor agora"]}>
            {["pad-card", "gap-grid", "altura-linha", "altura-controle", "escala-dado"].map((v) => (
              <tr key={v} style={{ borderTop: "1px solid var(--tk-border)" }}>
                <td style={celula}><code style={mono}>--tk-{v}</code></td>
                <td style={celula}><code style={mono}>{outras[v] || "—"}</code></td>
              </tr>
            ))}
          </Tabela>
        </Secao>

        {/* ── 12. Movimento ── */}
        <Secao
          titulo="Movimento"
          resumo="Só três momentos merecem animação: pulso do LiveIndicator, hover de linha de tabela, entrada de painel lateral. prefers-reduced-motion zera as três durações."
        >
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {[
              { nome: "rapida", uso: "hover de linha" },
              { nome: "padrao", uso: "padrão do sistema" },
              { nome: "painel", uso: "entrada de painel lateral" },
            ].map((d) => (
              <div key={d.nome}>
                <div
                  className="bg-surface-hover"
                  style={{
                    width: 160,
                    height: 56,
                    borderRadius: "var(--tk-radius-card)",
                    border: "1px solid var(--tk-border)",
                    display: "grid",
                    placeItems: "center",
                    transition: `background var(--tk-dur-${d.nome}) var(--tk-ease-padrao), transform var(--tk-dur-${d.nome}) var(--tk-ease-padrao)`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--tk-primary)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "";
                    e.currentTarget.style.transform = "";
                  }}
                >
                  <span className="text-caption">passe o mouse</span>
                </div>
                <p className="text-caption" style={{ marginTop: 6, marginBottom: 0 }}>
                  <code style={mono}>--tk-dur-{d.nome}</code> · {outras[`dur-${d.nome}`] || "—"}
                </p>
                <p className="text-caption text-text-muted" style={{ margin: 0 }}>{d.uso}</p>
              </div>
            ))}
          </div>
        </Secao>

        {/* ── 13. Contraste ── */}
        <Secao
          titulo="Contraste"
          resumo="Medido aqui com o mesmo lib/cor.ts que o npm run test:contraste usa — duas implementações da mesma conta divergem sempre."
        >
          <Tabela cabecalho={["Texto", "sobre surface", "sobre background", "AA (4.5:1)"]}>
            {/* `accent` NÃO entra aqui: ele não é cor de texto, e medi-lo como
                texto seria medir um par que o sistema não produz. Ele aparece na
                seção Marca, com o rótulo que vai EM CIMA dele. */}
            {[...TEXTO, ...SEMANTICA, { nome: "primary", utilitario: "", uso: "" }].map((t) => {
              const sobreSurface = razao(valores[t.nome]?.hex ?? null, superficie);
              const sobreFundo = razao(valores[t.nome]?.hex ?? null, fundoDaPagina);
              const pior = Math.min(parseFloat(sobreSurface) || 99, parseFloat(sobreFundo) || 99);
              return (
                <tr key={t.nome} style={{ borderTop: "1px solid var(--tk-border)" }}>
                  <td style={celula}>
                    <span className="text-label" style={{ color: `var(--tk-${t.nome})` }}>{t.nome}</span>
                  </td>
                  <td style={celula}><code style={mono}>{sobreSurface}:1</code></td>
                  <td style={celula}><code style={mono}>{sobreFundo}:1</code></td>
                  <td style={celula}>
                    <span className={`text-label ${pior >= 4.5 ? "text-success" : "text-danger"}`}>
                      {pior >= 4.5 ? "✓ passa" : "✗ abaixo"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </Tabela>
          <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
            O relatório completo — 152 pares nos dois temas, incluindo o selo tingido e a
            composição alfa das assinaturas — sai em{" "}
            <code style={mono}>npm run test:contraste</code>, que lê o globals.css e não uma cópia
            dos hexadecimais.
          </p>
        </Secao>

        {/* ══════════════ FASE 6 · o tema claro ══════════════ */}
        <Secao
          titulo="Fase 6 — o tema claro, corrigido"
          resumo="Feita ANTES da Fase 2, porque 3 das 7 telas de referência são claras: um primitivo que nasce certo só no escuro é o padrão do detector congelado. Troque o tema no topo e compare."
        >
          <Card
            titulo="Duas previsões do documento estavam erradas"
            descricao="As duas só apareceram ao medir — nenhuma teria sido notada seguindo o plano."
          >
            <ol className="text-caption text-text-secondary" style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
              <li>
                <strong className="text-text">Escurecer o surface-hover era ao contrário.</strong>{" "}
                Fundo mais escuro <em>reduz</em> o contraste de texto escuro — é por isso que
                text-secondary e danger reprovavam justamente sobre <code style={mono}>surface-hover</code>.
                Clarear resolveria, mas a distinção do hover cairia de 1,096:1 para 1,055:1, ou seja,
                sumiria. Os dois textos desceram no lugar disso.
              </li>
              <li>
                <strong className="text-text">A hierarquia do claro não cabia.</strong>{" "}
                <code style={mono}>text-muted</code> precisava de L 0,5427 para chegar a 4,5:1 — mas
                o <code style={mono}>text-secondary</code> valia L 0,5544, então corrigir só o muted
                o deixaria <em>mais forte</em> que o secondary, invertendo os dois níveis em
                silêncio. O secondary desceu junto, para o mesmo degrau (0,0607 de L) que o tema
                escuro já usava.
              </li>
            </ol>
          </Card>

          <Tabela cabecalho={["Token", "era", "é", "pior fundo antes", "pior fundo agora"]}>
            {[
              ["text-muted", "#94A3B8", "#637184", "2.34:1", "4.56:1"],
              ["text-secondary", "#64748B", "#505F75", "4.34:1", "5.91:1"],
              ["warning", "#D97706", "#AA5B00", "2.91:1", "4.57:1"],
              ["success", "#16A34A", "#008136", "3.01:1", "4.56:1"],
              ["danger", "#DC2626", "#D92223", "4.41:1", "4.56:1"],
            ].map(([tok, antes, depois, a, d]) => (
              <tr key={tok} style={{ borderTop: "1px solid var(--tk-border)" }}>
                <td style={celula}><code style={mono}>{tok}</code></td>
                <td style={celula}><Amostra hex={antes} /></td>
                <td style={celula}><Amostra hex={depois} /></td>
                <td style={celula}><span className="text-caption text-danger">{a}</span></td>
                <td style={celula}><span className="text-caption text-success">{d}</span></td>
              </tr>
            ))}
          </Tabela>
          <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
            O custo é real: no tema claro o âmbar deixa de ser vivo e o verde deixa de ser
            brilhante. Não é timidez de calibragem — é o que 4,5:1 sobre branco permite, e o croma
            só desceu o que a gama do sRGB obrigou.
          </p>
        </Secao>

        {/* ══════════════ FASE 2 · primitivos ══════════════ */}
        <Secao
          titulo="Fase 2 — Button"
          resumo="bg-primary NÃO é botão: o preenchimento é primary-solid com rótulo on-primary. E o gradiente da marca não preenche botão com rótulo — nenhuma cor atravessa azul→ciano."
        >
          <Card semPadding>
            <div style={{ padding: "var(--tk-pad-card)", display: "grid", gap: 16 }}>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Button variante="primario">Salvar alterações</Button>
                <Button variante="secundario">Cancelar</Button>
                <Button variante="fantasma">Ver detalhes</Button>
                <Button variante="destrutivo">Pausar campanha</Button>
                <Button variante="cta">Entrar</Button>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <Button variante="primario" carregando>Sincronizando</Button>
                <Button variante="secundario" disabled>Indisponível</Button>
                <Button variante="secundario" apenasIcone aria-label="Recarregar">↻</Button>
                <Button variante="fantasma" iconeInicio={<span aria-hidden="true">↓</span>}>Exportar</Button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--tk-border)", padding: "var(--tk-pad-card)" }}>
              <p className="text-title" style={{ margin: "0 0 4px" }}>
                Por que o CTA é um anel, e não um preenchimento
              </p>
              <p className="text-caption text-text-secondary" style={{ margin: "0 0 12px", maxWidth: 760 }}>
                A tela de referência mostra o CTA “Entrar” preenchido com o gradiente. Medido, nenhum
                rótulo sobrevive aos dois extremos — e o <strong>meio</strong> do gradiente já entrega
                3,52:1 ao rótulo claro, que é exatamente o número que a Fase 1 corrigiu. É o mockup
                que não passa em AA, não o componente.
              </p>
              <Tabela cabecalho={["Rótulo", "#2563EB (início)", "#3B82F6 (meio)", "#22D3EE (fim)"]}>
                {[
                  ["claro · #F8FAFC", "4.94", "3.52", "1.73"],
                  ["escuro · #090D14", "3.76", "5.29", "10.77"],
                ].map(([r, a, b, c]) => (
                  <tr key={r} style={{ borderTop: "1px solid var(--tk-border)" }}>
                    <td style={celula}><code style={mono}>{r}</code></td>
                    {[a, b, c].map((n, i) => (
                      <td key={i} style={celula}>
                        <span className={`text-caption ${parseFloat(n) >= 4.5 ? "text-success" : "text-danger"}`}>
                          {n}:1
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </Tabela>
            </div>
          </Card>
        </Secao>

        <Secao
          titulo="Fase 2 — Badge (o selo tingido)"
          resumo="O padrão mais repetido das telas de referência, e o que mais reprovava. O tom é UM nome e o componente escolhe o par bg-tint-X + text-on-tint-X — não há prop para trocar a cor do texto, porque era essa liberdade que produzia o defeito."
        >
          <Card>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <Badge tom="success" ponto>Ativo</Badge>
              <Badge tom="warning" ponto>Pausado</Badge>
              <Badge tom="danger" ponto>Recusado</Badge>
              <Badge tom="primary">Em curso</Badge>
              <Badge tom="accent" aoVivo>Ao vivo</Badge>
              <Badge tom="neutral">Rascunho</Badge>
              <Badge tom="category">Analytics</Badge>
            </div>

            <p className="text-caption text-text-secondary" style={{ margin: "4px 0 0", maxWidth: 760 }}>
              A causa da reprovação era <strong>estrutural</strong>: texto e fundo da mesma cor não se
              separam mexendo na saturação — 10% dava 4,05:1 e 18% dava 3,62:1. Abaixo, os dois lados
              lado a lado, no tema que estiver ligado.
            </p>

            <Tabela cabecalho={["Tom", "com a cor pura (errado)", "com on-tint (certo)"]}>
              {(["primary", "accent", "success", "warning", "danger", "neutral", "category"] as TomSelo[]).map((t) => (
                <tr key={t} style={{ borderTop: "1px solid var(--tk-border)" }}>
                  <td style={celula}><code style={mono}>{t}</code></td>
                  <td style={celula}>
                    <span
                      className="text-caption font-medium"
                      style={{
                        padding: "2px 8px",
                        borderRadius: "var(--tk-radius-pill)",
                        background: `var(--tk-tint-${t})`,
                        color: `var(--tk-${t === "neutral" ? "text-secondary" : t})`,
                      }}
                    >
                      cor pura
                    </span>
                  </td>
                  <td style={celula}><Badge tom={t}>on-tint</Badge></td>
                </tr>
              ))}
            </Tabela>
            <p className="text-caption text-text-muted" style={{ marginTop: 10 }}>
              ⛔ Não há tom de <strong>canal</strong> aqui, e a ausência é a regra: Meta/TikTok/Google
              só colorem dentro da área de plotagem e da legenda. Num selo, a cor é lida como
              controle — e ali azul e ciano já significam “onde eu clico” e “o que está acontecendo”.
            </p>
          </Card>
        </Secao>

        <Secao
          titulo="Fase 2 — Card"
          resumo="Padding e espaçamento vêm da densidade — troque no alternador do topo e veja o bloco abaixo responder. (A sombra do card mora na seção Elevação.)"
        >
          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
            <CardMetrica
              rotulo="Faturamento"
              valor="R$ 128.430"
              variacao={{ texto: "+12,4% vs. período anterior", positiva: true }}
              icone={{ no: <span aria-hidden="true">R$</span>, tom: "primary" }}
            />
            <CardMetrica
              rotulo="Lucro"
              valor="R$ 41.207"
              variacao={{ texto: "−3,1% vs. período anterior", positiva: false }}
              icone={{ no: <span aria-hidden="true">↗</span>, tom: "success" }}
            />
            <CardMetrica
              rotulo="ROAS"
              valor="3,42×"
              icone={{ no: <span aria-hidden="true">◎</span>, tom: "accent" }}
            />
          </div>

          <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", marginTop: "var(--tk-gap-grid)" }}>
            <Card titulo="Card com cabeçalho" descricao="Título, descrição e ação no canto." acao={<Badge tom="neutral">6 contas</Badge>}>
              <p className="text-body text-text-secondary" style={{ margin: 0 }}>
                O corpo do card. Borda do sistema e a sombra de card.
              </p>
            </Card>
            <Card titulo="Card clicável" descricao="Vira <button>, não <div onClick>." aoClicar={() => {}}>
              <p className="text-body text-text-secondary" style={{ margin: 0 }}>
                Recebe foco pelo teclado e tem o hover da escada de cor.
              </p>
            </Card>
            <Card titulo="Card ao vivo" descricao="Só o anel do glow — sem pulso." aoVivo>
              <p className="text-body text-text-secondary" style={{ margin: 0 }}>
                Card inteiro piscando é ruído, não sinal. O pulso fica no selo.
              </p>
            </Card>
          </div>
        </Secao>

        <Secao
          titulo="Fase 2 — Input"
          resumo="O erro é string, e não booleano: borda vermelha sozinha é invisível para leitor de tela e para quem não distingue vermelho (WCAG 1.4.1). Presente = inválido, e a mensagem vira texto amarrado por aria-describedby."
        >
          <Card>
            <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
              <Input rotulo="Nome da campanha" placeholder="Escala — Público frio" apoio="Aparece no relatório e no filtro." />
              <Input rotulo="Orçamento diário" defaultValue="120,00" sufixo="R$" apoio="O teto que a regra não pode ultrapassar." />
              <Input rotulo="Token do webhook" defaultValue="tk_live_9f2c" erro="Este token já está em uso por outro webhook." />
              <Input rotulo="Conta de anúncio" placeholder="act_000000" disabled apoio="Definida pelo perfil conectado." />
            </div>
            <p className="text-caption text-text-muted" style={{ margin: "4px 0 0" }}>
              O placeholder usa <code style={mono}>text-muted</code>, que só passou a ser legível na
              Fase 6 — no tema claro ele rendia 2,34:1. Ele já é discreto pela hierarquia de
              luminosidade; não o clareie de novo.
            </p>
          </Card>
        </Secao>

        <Secao
          titulo="Fase 2 — Select, Tooltip e a camada flutuante"
          resumo="Os dois saem do mesmo Popover, que porta para o <body>. Sem o portal, o transform do .page-enter vira o bloco de contenção e a camada aparece colada no topo, cortada — é a causa raiz que a gaveta e o modal já tinham resolvido."
        >
          <Vitrine />
        </Secao>

        <Secao
          titulo="Fase 2 — Checkbox, Radio e Switch"
          resumo="Os três significam coisas diferentes: checkbox e radio valem ao confirmar o formulário; o Switch age NA HORA. Por isso o Switch não entra em formulário com botão Salvar."
        >
          <VitrineControles />
        </Secao>

        <Secao
          titulo="Fase 2 — Skeleton e Separator"
          resumo="O esqueleto tem de ter o tamanho do que vai chegar: um de altura errada faz a página saltar quando o dado entra, que é o que ele existia para evitar. E ele não é o estado de erro nem de vazio."
        >
          <Card>
            <AreaCarregando
              carregando
              esqueleto={
                <div style={{ display: "grid", gap: 8 }}>
                  <Skeleton largura={140} altura={13} />
                  <Skeleton largura={200} altura={30} />
                  <Skeleton largura={110} altura={12} />
                </div>
              }
            >
              <p>nunca aparece nesta vitrine</p>
            </AreaCarregando>
            <Separator />
            <div style={{ display: "flex", alignItems: "center" }}>
              <Skeleton largura={32} altura={32} circulo />
              <Separator vertical espaco={12} />
              <span className="text-caption text-text-muted">
                separador vertical entre dois blocos
              </span>
            </div>
          </Card>
        </Secao>
      </div>
    </div>
  );
}

/* ── Vitrines com estado (a página é client, então podem viver aqui) ───────── */

const CONTAS = [
  { valor: "act_1", rotulo: "Escala — Conta principal", apoio: "act_1029384756" },
  { valor: "act_2", rotulo: "Retargeting", apoio: "act_5647382910" },
  { valor: "act_3", rotulo: "Conta desabilitada", apoio: "act_1122334455", desabilitada: true },
  { valor: "act_4", rotulo: "Teste — Público frio", apoio: "act_9988776655" },
] as const;

function Vitrine() {
  const [conta, setConta] = useState<string | null>("act_1");

  return (
    <Card>
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
        <Select
          rotulo="Conta de anúncio"
          opcoes={CONTAS}
          valor={conta}
          aoEscolher={setConta}
          vazio="Todas as contas"
        />
        <Select rotulo="Gateway" opcoes={CONTAS} valor={null} aoEscolher={() => {}} vazio="Selecione" desabilitado />
        {/* Encostado na borda direita de propósito: é o caso que o `.tk-pop`
            legado admite não resolver ("ainda pode transbordar para fora"). */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "flex-end" }}>
          <Select rotulo="Colado na borda" opcoes={CONTAS} valor="act_4" aoEscolher={() => {}} blocoInteiro={false} />
        </div>
      </div>

      <Separator />

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "center" }}>
        <Tooltip texto="Receita menos taxas de gateway, imposto e gasto com anúncio. Não desconta produto.">
          <span className="text-label text-primary" style={{ cursor: "help", textDecoration: "underline dotted", textUnderlineOffset: 3 }}>
            o que entra no Lucro?
          </span>
        </Tooltip>
        <Tooltip texto="Abre no foco também — só no hover ela não existiria para quem navega por teclado (WCAG 1.4.13).">
          <Button variante="secundario">Dê Tab até aqui</Button>
        </Tooltip>
        <Tooltip texto="Tooltip não é onde se guarda informação necessária: ela não existe no toque e não é encontrável." lado="baixo">
          <Badge tom="neutral">abre para baixo</Badge>
        </Tooltip>
      </div>

      <p className="text-caption text-text-muted" style={{ margin: 0 }}>
        Abra o select de baixo e role a página: a camada <strong>fecha</strong> em vez de perseguir
        o gatilho. Encolha a janela até o select da direita não caber — ele gruda na borda em vez de
        criar rolagem horizontal, que é a limitação que o <code style={mono}>.tk-pop</code> legado
        tem documentada e não resolve.
      </p>
    </Card>
  );
}

function VitrineControles() {
  const [metricas, setMetricas] = useState({ roas: true, cpa: false, arpu: false });
  const [janela, setJanela] = useState("7d");
  const [auto, setAuto] = useState(true);

  const marcadas = Object.values(metricas).filter(Boolean).length;

  return (
    <Card>
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))" }}>
        <div style={{ display: "grid", gap: 10 }}>
          <p className="text-micro text-text-secondary" style={{ margin: 0 }}>Checkbox — vários</p>
          <Checkbox
            marcado={marcadas === 3}
            indeterminado={marcadas > 0}
            aoMudar={(v) => setMetricas({ roas: v, cpa: v, arpu: v })}
            rotulo="Todas as métricas"
            apoio={marcadas > 0 && marcadas < 3 ? "algumas marcadas" : undefined}
          />
          <div style={{ display: "grid", gap: 10, paddingLeft: 24 }}>
            {(["roas", "cpa", "arpu"] as const).map((k) => (
              <Checkbox
                key={k}
                marcado={metricas[k]}
                aoMudar={(v) => setMetricas((m) => ({ ...m, [k]: v }))}
                rotulo={k.toUpperCase()}
              />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <p className="text-micro text-text-secondary" style={{ margin: 0 }}>Radio — um só</p>
          {[
            { v: "1d", r: "Hoje" },
            { v: "7d", r: "Últimos 7 dias" },
            { v: "30d", r: "Últimos 30 dias" },
            { v: "custom", r: "Período personalizado", d: true },
          ].map((o) => (
            <Radio
              key={o.v}
              nome="janela-vitrine"
              marcado={janela === o.v}
              aoEscolher={() => setJanela(o.v)}
              rotulo={o.r}
              desabilitado={o.d}
            />
          ))}
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <p className="text-micro text-text-secondary" style={{ margin: 0 }}>Switch — age na hora</p>
          <Switch
            ligado={auto}
            aoMudar={setAuto}
            rotulo="Sincronizar automaticamente"
            apoio="Vale imediatamente — não há Salvar."
          />
          <Switch ligado={false} aoMudar={() => {}} rotulo="Em curso" ocupado apoio="Bloqueado sem parecer desligado." />
          <Switch ligado aoMudar={() => {}} rotulo="Indisponível" desabilitado apoio="Depende do perfil conectado." />
        </div>
      </div>
    </Card>
  );
}

/* ── Peças locais desta página (nada aqui é componente do sistema) ────────── */


function Secao({ titulo, resumo, children }: { titulo: string; resumo: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 44 }}>
      <h2 className="text-title" style={{ margin: 0 }}>{titulo}</h2>
      <p className="text-caption text-text-secondary" style={{ margin: "4px 0 16px", maxWidth: 760 }}>{resumo}</p>
      {children}
    </section>
  );
}

function Tabela({ cabecalho, children }: { cabecalho: string[]; children: React.ReactNode }) {
  return (
    <div
      className="bg-surface"
      style={{ borderRadius: "var(--tk-radius-card)", border: "1px solid var(--tk-border)", overflowX: "auto", marginTop: 12 }}
    >
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {cabecalho.map((c) => (
              <th key={c} className="text-micro text-text-secondary" style={{ textAlign: "left", padding: "10px 12px" }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Amostra({ hex }: { hex: string | null }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <span
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: hex ?? "transparent",
          border: "1px solid var(--tk-border)",
          flex: "none",
        }}
      />
      <code style={mono}>{hex ?? "não resolveu"}</code>
    </span>
  );
}

function GradeTokens({
  tokens,
  valores,
  fundo,
  amostraDeTexto,
}: {
  tokens: Token[];
  valores: Record<string, { resolvido: string; hex: string | null }>;
  fundo: string | null;
  amostraDeTexto?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>
      {tokens.map((t) => {
        const v = valores[t.nome];
        const c = v?.hex && fundo ? contraste(hexParaRgbLocal(v.hex), hexParaRgbLocal(fundo)) : null;
        return (
          <div
            key={t.nome}
            className="bg-surface"
            style={{ borderRadius: "var(--tk-radius-card)", border: "1px solid var(--tk-border)", overflow: "hidden" }}
          >
            {amostraDeTexto ? (
              <div style={{ height: 56, display: "grid", placeItems: "center", background: "var(--tk-surface)" }}>
                <span className="text-metric-md" style={{ color: `var(--tk-${t.nome})` }}>R$ 1.240</span>
              </div>
            ) : (
              <div style={{ height: 56, background: `var(--tk-${t.nome})` }} />
            )}
            <div style={{ padding: "10px 12px", borderTop: "1px solid var(--tk-border)" }}>
              <p className="text-label" style={{ margin: 0 }}>{t.nome}</p>
              <p className="text-caption text-text-muted" style={{ margin: "2px 0 0" }}>{t.uso}</p>
              <p style={{ margin: "6px 0 0" }}>
                <code style={mono}>{v?.hex ?? "—"}</code>
              </p>
              <p style={{ margin: 0 }}>
                <code style={{ ...mono, fontSize: 11, color: "var(--tk-text-muted)" }}>{v?.resolvido || "—"}</code>
              </p>
              <p style={{ margin: "6px 0 0" }}>
                <code style={mono}>.{t.utilitario}</code>
                {c !== null && (
                  <span className="text-caption text-text-muted"> · {c.toFixed(2)}:1</span>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FamiliaFonte({ titulo, resolvido, familia }: { titulo: string; resolvido: string; familia: string }) {
  const registrou = /var\(--font-/.test(resolvido) === false && resolvido.length > 0;
  return (
    <div
      className="bg-surface"
      style={{ padding: "var(--tk-pad-card)", borderRadius: "var(--tk-radius-card)", border: "1px solid var(--tk-border)" }}
    >
      <p className="text-label" style={{ margin: 0 }}>{titulo}</p>
      <p style={{ fontFamily: familia, fontSize: 22, margin: "8px 0 4px" }}>
        1234567890 · R$ 128.430,00
      </p>
      <p style={{ fontFamily: familia, fontSize: 14, margin: 0 }}>
        Gasto, ROAS, CPA e a data em que a venda entrou.
      </p>
      <p className="text-caption text-text-muted" style={{ margin: "8px 0 0", wordBreak: "break-word" }}>
        {registrou ? resolvido : "a variável do next/font não chegou ao <html>"}
      </p>
    </div>
  );
}

function Alternador({
  rotulo,
  opcoes,
  atual,
  aoTrocar,
}: {
  rotulo: string;
  opcoes: { valor: string; texto: string }[];
  atual: string;
  aoTrocar: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-label text-text-secondary" style={{ margin: "0 0 6px" }}>{rotulo}</p>
      <div
        className="bg-surface"
        style={{ display: "inline-flex", padding: 3, borderRadius: "var(--tk-radius-controle)", border: "1px solid var(--tk-border)", gap: 3 }}
      >
        {opcoes.map((o) => {
          const ativo = o.valor === atual;
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => aoTrocar(o.valor)}
              className="text-label"
              style={{
                height: "var(--tk-altura-controle)",
                padding: "0 14px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: ativo ? "var(--tk-primary)" : "transparent",
                color: ativo ? "var(--tk-text)" : "var(--tk-text-secondary)",
                transition: "background var(--tk-dur-padrao) var(--tk-ease-padrao)",
              }}
            >
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}
