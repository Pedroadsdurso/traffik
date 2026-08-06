"use client";

import * as React from "react";

/**
 * Button — primitivo da Fase 2.
 *
 * Mora em `components/tk/` e não em `components/dashboard/ui/` de propósito: a
 * pasta antiga consome `--color-*` (o sistema legado, vivo em 21 rotas) e esta
 * consome `--tk-*`. Um componente que consumisse os dois seria o lugar exato
 * onde a isolação do `@theme inline` morre sem ninguém ver.
 *
 * ⛔ AS DUAS REGRAS QUE ESTE ARQUIVO EXISTE PARA SEGURAR
 *
 * 1. `bg-primary` NÃO é botão. O preenchimento é `bg-primary-solid` com rótulo
 *    `text-on-primary` (4.94:1 no escuro, 5.17:1 no claro). `bg-primary` com
 *    rótulo claro rende 3.52:1 — é o par que a correção de 05/08/2026 removeu, e
 *    `npm run test:contraste` reprova se ele voltar.
 *
 * 2. O GRADIENTE DA MARCA NÃO PREENCHE BOTÃO COM RÓTULO. Isto ficou em aberto na
 *    Fase 1 ("decidir ao desenhar o botão") e a medição fecha a questão: nenhuma
 *    cor de rótulo atravessa o gradiente inteiro.
 *
 *      rótulo    #2563EB (início)   #3B82F6 (meio)   #22D3EE (fim)
 *      claro          4.94               3.52             1.73
 *      escuro         3.76               5.29            10.77
 *
 *    O rótulo claro morre no ciano e o escuro morre no azul — e note que o MEIO
 *    do gradiente já entrega 3.52:1 para o rótulo claro, exatamente o número que
 *    a Fase 1 corrigiu. Não é calibragem: é a mesma impossibilidade de antes, a
 *    de um preenchimento só ter de servir a dois extremos.
 *
 *    A saída é a variante `cta`: o gradiente vira um ANEL de 1,5px e o interior
 *    continua sólido. A assinatura da marca aparece, e o rótulo nunca encosta no
 *    ciano. (A tela de referência mostra o CTA "Entrar" preenchido de gradiente;
 *    é o mockup que não passa em AA, não este componente.)
 *
 * Tamanho vem da DENSIDADE (`--tk-altura-controle`), nunca de uma prop: a
 * preferência é do usuário e global. Componente nenhum conhece densidade.
 */

export type VarianteBotao =
  | "primario"    // ação principal da tela — no máximo uma por tela
  | "secundario"  // ação de apoio, com contorno
  | "fantasma"    // ação terciária, sem contorno (barra de ferramentas, linha de tabela)
  | "destrutivo"  // irreversível ou que gasta dinheiro — regra da ferramenta
  | "cta";        // entrada/conversão, com o anel da marca. Um por tela, no máximo.

type Props = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variante?: VarianteBotao;
  /** Mostra o giro e bloqueia o clique — sem trocar a largura do botão. */
  carregando?: boolean;
  iconeInicio?: React.ReactNode;
  iconeFim?: React.ReactNode;
  /** Só ícone: vira quadrado e EXIGE `aria-label`. */
  apenasIcone?: boolean;
  blocoInteiro?: boolean;
  /**
   * Navega em vez de executar. Renderiza `<a>`, nao `<button>`.
   *
   * 🔴 Existe porque a alternativa era pior: envolver um `<button>` num `<a>`
   * aninha dois controles interativos — o leitor de tela anuncia dois, o Tab
   * para duas vezes e o comportamento do Enter fica indefinido. E copiar o
   * estilo do botao num link solto criaria a sexta variante visual da base.
   *
   * ⚠️ `carregando` e `disabled` NAO se aplicam: link nao tem estado ocupado
   * nem desabilitado no HTML. Se precisar bloquear, o certo e nao renderizar o
   * link — por isso os dois sao ignorados aqui em vez de fingirem funcionar.
   */
  href?: string;
};

const BASE =
  "inline-flex items-center justify-center gap-2 text-label whitespace-nowrap select-none " +
  "border cursor-pointer rounded-controle " +
  "transition-[background-color,border-color,color,opacity] " +
  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 " +
  "disabled:opacity-45 disabled:cursor-not-allowed";

const PELA_VARIANTE: Record<VarianteBotao, string> = {
  // `primary-solid`, nunca `primary` — ver a regra 1 no topo.
  primario:
    "bg-primary-solid text-on-primary border-transparent hover:bg-primary-solid-hover",
  secundario:
    "bg-transparent text-text border-border hover:bg-surface-hover",
  fantasma:
    "bg-transparent text-text-secondary border-transparent hover:bg-surface-hover hover:text-text",
  // Contorno, e não preenchimento: a ação destrutiva precisa ser encontrável sem
  // ser o alvo mais convidativo da tela.
  destrutivo:
    "bg-transparent text-danger border-danger hover:bg-tint-danger",
  /* Sem padding aqui: no `cta` o padding do botão É a espessura do anel, e ele é
     definido junto das medidas. Duas fontes para o mesmo padding foi exatamente
     o defeito — ver o comentário em `medidas`. */
  cta: "border-transparent",
};

/** Espessura do anel de gradiente do `cta`, em px. */
const ANEL = 1.5;

export function Button({
  variante = "secundario",
  carregando = false,
  iconeInicio,
  iconeFim,
  apenasIcone = false,
  blocoInteiro = false,
  href,
  disabled,
  children,
  style,
  type = "button",
  ...resto
}: Props) {
  const bloqueado = disabled || carregando;
  const ehCta = variante === "cta";
  const padRotulo = apenasIcone ? 0 : "0 14px";

  const medidas: React.CSSProperties = {
    height: "var(--tk-altura-controle)",
    /* 🐛 CORRIGIDO ao abrir a página no navegador, e invisível para o build.
       Isto era `padding: apenasIcone ? 0 : "0 14px"` para TODAS as variantes,
       inline — e estilo inline vence classe. A variante `cta` declarava
       `p-[1.5px]` na classe, então o botão de gradiente ficava com 14px de
       padding lateral e 0 vertical: medido na tela, o <span> interno ocupava
       65,8px dentro de um botão de 95,8px, ou seja **30px de gradiente cru
       aparecendo nas laterais**, sem anel nenhum em cima e embaixo.
       `tsc`, `lint` e `build` passavam — é layout, e só a tela responde. */
    padding: ehCta ? ANEL : padRotulo,
    width: apenasIcone ? "var(--tk-altura-controle)" : blocoInteiro ? "100%" : undefined,
    // O gradiente do `cta` é o FUNDO do botão; o miolo sólido vem do <span>.
    background: ehCta ? "var(--tk-gradient-brand)" : undefined,
    /* 🐛 CARREGANDO NÃO É DESABILITADO, aos olhos. O `disabled` do HTML é o
       jeito certo de bloquear o clique, mas ele arrasta o `disabled:opacity-45`
       — e na tela o botão "Sincronizando" ficava idêntico ao "Indisponível".
       São dois estados opostos: um está trabalhando, o outro não vai funcionar.
       A opacidade volta ao normal e quem comunica a espera é o giro + o cursor. */
    opacity: carregando ? 1 : undefined,
    cursor: carregando ? "wait" : undefined,
    ...style,
  };

  const glifo = carregando ? <Giro /> : iconeInicio;

  const miolo = (
    <>
      {glifo}
      {/* 🐛 `apenasIcone` engolia o children e o botão saía VAZIO na tela (32px
          de nada, `textContent` string vazia) quando o ícone vinha como filho em
          vez de `iconeInicio`. Agora o children É o ícone quando não há outro:
          as duas escritas funcionam, em vez de uma funcionar e a outra sumir. */}
      {(!apenasIcone || !glifo) && children}
      {!carregando && iconeFim}
    </>
  );

  const comum = {
    style: medidas,
    className: `${BASE} ${PELA_VARIANTE[variante]}`,
  };

  if (href !== undefined) {
    return (
      <a {...(resto as React.AnchorHTMLAttributes<HTMLAnchorElement>)} href={href} {...comum}>
        {ehCta ? <MioloCta padRotulo={padRotulo}>{miolo}</MioloCta> : miolo}
      </a>
    );
  }

  return (
    <button
      {...resto}
      type={type}
      disabled={bloqueado}
      aria-busy={carregando || undefined}
      {...comum}
    >
      {ehCta ? (
        /* O rótulo mora sobre `primary-solid`, nunca sobre o gradiente. O raio
           interno desconta a espessura do anel para as duas curvas ficarem
           concêntricas. */
        <span
          className="inline-flex h-full w-full items-center justify-center gap-2 bg-primary-solid text-on-primary"
          style={{
            padding: padRotulo,
            borderRadius: `calc(var(--tk-radius-controle) - ${ANEL}px)`,
          }}
        >
          {miolo}
        </span>
      ) : (
        miolo
      )}
    </button>
  );
}

/** O interior do CTA — extraido para o `<a>` e o `<button>` usarem o MESMO. */
function MioloCta({ padRotulo, children }: { padRotulo: string | number; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex h-full w-full items-center justify-center gap-2 bg-primary-solid text-on-primary"
      style={{ padding: padRotulo, borderRadius: `calc(var(--tk-radius-controle) - ${ANEL}px)` }}
    >
      {children}
    </span>
  );
}

/**
 * O giro herda `currentColor`, então ele funciona nas cinco variantes sem
 * ninguém escolher a cor — e continua legível quando a variante muda.
 * `--tk-dur-*` zera com `prefers-reduced-motion`; aqui a duração é fixa de
 * propósito: um indicador de espera que para de girar vira um ícone travado, que
 * é pior que o movimento que a preferência queria evitar.
 */
function Giro() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ flex: "none" }}>
      <circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" />
      <path d="M7 1.5A5.5 5.5 0 0 1 12.5 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="0 7 7"
          to="360 7 7"
          dur="0.7s"
          repeatCount="indefinite"
        />
      </path>
    </svg>
  );
}
