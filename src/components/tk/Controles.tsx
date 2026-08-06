"use client";

import * as React from "react";

/**
 * Checkbox, Radio e Switch — os três controles binários.
 *
 * 🔴 OS TRÊS SIGNIFICAM COISAS DIFERENTES, e trocá-los é um erro de sentido, não
 * de estilo. Vale escrever porque na tela eles parecem intercambiáveis:
 *
 * | | quando usar | quando o efeito acontece |
 * |---|---|---|
 * | **Checkbox** | escolher VÁRIOS de uma lista, ou um aceite | ao confirmar o formulário |
 * | **Radio** | escolher UM de poucos (2 a 5), todos visíveis | ao confirmar o formulário |
 * | **Switch** | ligar/desligar algo que já existe | **NA HORA**, sem confirmar |
 *
 * ⚠️ O Switch é o único que age sozinho — é o que o usuário espera dele, e é por
 * isso que ele não pode aparecer dentro de um formulário com botão "Salvar".
 * Nesta base isso já importa de verdade: o toggle de pausar/ativar campanha
 * escreve na Graph API no clique, com dinheiro real em jogo.
 *
 * ⛔ E "controle que não controla nada é pior que código morto": um Switch
 * inerte produz uma CRENÇA — a pessoa desliga, vê a tela confirmar, e decide com
 * base nisso. Ao entregar um destes, a pergunta não é "salva?", é **"quem LÊ o
 * que ele salvou?"**.
 *
 * O `input` nativo fica presente e transparente por cima do desenho: é ele que
 * entrega foco, teclado, formulário e leitor de tela de graça. O que se pinta é
 * só a aparência.
 */

const ENVOLTORIO = "inline-flex items-start gap-2 cursor-pointer select-none";
const NATIVO: React.CSSProperties = {
  position: "absolute",
  opacity: 0,
  width: 0,
  height: 0,
  pointerEvents: "none",
};

type Base = {
  rotulo?: React.ReactNode;
  /** Segunda linha explicando a consequência. */
  apoio?: React.ReactNode;
  desabilitado?: boolean;
};

/* ── Checkbox ──────────────────────────────────────────────────────────────── */

export function Checkbox({
  marcado,
  aoMudar,
  rotulo,
  apoio,
  desabilitado = false,
  /** Estado de "alguns marcados" — só para o checkbox que comanda uma lista. */
  indeterminado = false,
  ...resto
}: Base & {
  marcado: boolean;
  aoMudar: (v: boolean) => void;
  indeterminado?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked" | "type">) {
  const ref = React.useRef<HTMLInputElement>(null);

  /* `indeterminate` NÃO é atributo de HTML — só existe como propriedade do nó.
     Escrever `indeterminate={...}` no JSX não faz nada e não avisa. */
  React.useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminado && !marcado;
  }, [indeterminado, marcado]);

  return (
    <label className={ENVOLTORIO} style={{ opacity: desabilitado ? 0.45 : undefined, cursor: desabilitado ? "not-allowed" : undefined }}>
      <input
        {...resto}
        ref={ref}
        type="checkbox"
        checked={marcado}
        disabled={desabilitado}
        onChange={(e) => aoMudar(e.target.checked)}
        style={NATIVO}
      />
      <Caixa marcado={marcado} indeterminado={indeterminado && !marcado} />
      <Legenda rotulo={rotulo} apoio={apoio} />
    </label>
  );
}

function Caixa({ marcado, indeterminado }: { marcado: boolean; indeterminado: boolean }) {
  const aceso = marcado || indeterminado;
  return (
    <span
      aria-hidden="true"
      className={aceso ? "bg-primary-solid" : "bg-surface-hover"}
      style={{
        width: 16, height: 16, flex: "none", marginTop: 2,
        borderRadius: 4,
        border: `1px solid var(${aceso ? "--tk-primary-solid" : "--tk-border"})`,
        display: "grid", placeItems: "center",
        transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
      }}
    >
      {marcado && (
        <svg width="10" height="10" viewBox="0 0 12 12" className="text-on-primary">
          <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {indeterminado && (
        <span className="bg-on-primary" style={{ width: 8, height: 2, borderRadius: 1 }} />
      )}
    </span>
  );
}

/* ── Radio ─────────────────────────────────────────────────────────────────── */

export function Radio({
  marcado,
  aoEscolher,
  nome,
  rotulo,
  apoio,
  desabilitado = false,
  ...resto
}: Base & {
  marcado: boolean;
  aoEscolher: () => void;
  /** Mesmo `nome` no grupo — é o que faz a seta do teclado navegar entre eles. */
  nome: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked" | "type" | "name">) {
  return (
    <label className={ENVOLTORIO} style={{ opacity: desabilitado ? 0.45 : undefined, cursor: desabilitado ? "not-allowed" : undefined }}>
      <input
        {...resto}
        type="radio"
        name={nome}
        checked={marcado}
        disabled={desabilitado}
        onChange={aoEscolher}
        style={NATIVO}
      />
      <span
        aria-hidden="true"
        className={marcado ? "bg-primary-solid" : "bg-surface-hover"}
        style={{
          width: 16, height: 16, flex: "none", marginTop: 2,
          borderRadius: "var(--tk-radius-pill)",
          border: `1px solid var(${marcado ? "--tk-primary-solid" : "--tk-border"})`,
          display: "grid", placeItems: "center",
          transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
        }}
      >
        {marcado && <span className="bg-on-primary" style={{ width: 6, height: 6, borderRadius: "var(--tk-radius-pill)" }} />}
      </span>
      <Legenda rotulo={rotulo} apoio={apoio} />
    </label>
  );
}

/* ── Switch ────────────────────────────────────────────────────────────────── */

export function Switch({
  ligado,
  aoMudar,
  rotulo,
  apoio,
  desabilitado = false,
  /** Em curso: bloqueia o clique sem parecer desligado. */
  ocupado = false,
  ...resto
}: Base & {
  ligado: boolean;
  aoMudar: (v: boolean) => void;
  ocupado?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "checked" | "type">) {
  return (
    <label
      className={ENVOLTORIO}
      style={{
        opacity: desabilitado ? 0.45 : undefined,
        cursor: desabilitado ? "not-allowed" : ocupado ? "wait" : undefined,
        alignItems: "center",
      }}
    >
      <input
        {...resto}
        type="checkbox"
        role="switch"
        checked={ligado}
        disabled={desabilitado || ocupado}
        onChange={(e) => aoMudar(e.target.checked)}
        style={NATIVO}
      />
      <span
        aria-hidden="true"
        className={ligado ? "bg-primary-solid" : "bg-surface-hover"}
        style={{
          width: 34, height: 20, flex: "none",
          borderRadius: "var(--tk-radius-pill)",
          border: `1px solid var(${ligado ? "--tk-primary-solid" : "--tk-border"})`,
          position: "relative",
          transition: "background-color var(--tk-dur-padrao) var(--tk-ease-padrao)",
        }}
      >
        <span
          className={ligado ? "bg-on-primary" : "bg-text-muted"}
          style={{
            position: "absolute", top: 2, left: ligado ? 16 : 2,
            width: 14, height: 14, borderRadius: "var(--tk-radius-pill)",
            transition: "left var(--tk-dur-padrao) var(--tk-ease-padrao)",
            opacity: ocupado ? 0.6 : 1,
          }}
        />
      </span>
      <Legenda rotulo={rotulo} apoio={apoio} />
    </label>
  );
}

function Legenda({ rotulo, apoio }: { rotulo?: React.ReactNode; apoio?: React.ReactNode }) {
  if (!rotulo && !apoio) return null;
  return (
    <span style={{ minWidth: 0 }}>
      {rotulo && <span className="text-body text-text" style={{ display: "block" }}>{rotulo}</span>}
      {apoio && <span className="text-caption text-text-muted" style={{ display: "block" }}>{apoio}</span>}
    </span>
  );
}
