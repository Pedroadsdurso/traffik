import { Lock, ShieldCheck, Target, Zap } from "lucide-react";
import type { ComponentType } from "react";

import { APOIO, BADGE, HEADLINE, PROVAS, RODAPE_SEGURANCA, type Prova } from "@/lib/auth/conteudo";
import { MarcaAuth } from "./MarcaAuth";
import { PreviaProduto } from "./PreviaProduto";

/**
 * PainelMarca — a metade esquerda da tela de entrada.
 *
 * ⛔ É O MESMO EM `/login` E EM `/signup`, e não por economia: a marca não muda
 * porque o visitante está entrando ou se cadastrando. `test:login` prova que os
 * dois renderizam este painel IDÊNTICO — se um dia ele divergir, é decisão, e
 * decisão aparece no diff do teste.
 *
 * ⚠️ ESTE PAINEL SOME ABAIXO DE 1024px. É o único conteúdo da tela que pode
 * sumir sem perda funcional: ele não tem controle nenhum, só prova. O que não
 * pode sumir é o formulário — e ele passa a ocupar a tela inteira.
 */
export function PainelMarca() {
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        gap: 28,
        padding: "40px clamp(32px, 4vw, 64px)",
        minWidth: 0,
        /* Ocupa a coluna inteira: é o que empurra o rodapé de segurança para o
           pé da tela e deixa a prévia crescer. Depende de `.tk-auth-marca` ser
           `flex` — ver a nota lá. */
        flex: 1,
      }}
    >
      <ArcoDecorativo />

      {/* Tudo acima do arco. `position: relative` sem z-index: basta criar
          contexto de empilhamento na ordem do documento. */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 28, flex: 1, minHeight: 0 }}>
        <MarcaAuth variante="wordmark" largura={168} />

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Badge />
          <Headline />
          <p
            className="text-text-secondary"
            style={{ margin: 0, fontSize: 16, lineHeight: 1.55, maxWidth: "40ch" }}
          >
            {APOIO}
          </p>
        </div>

        <Provas />

        <PreviaProduto />
      </div>

      <p
        className="text-text-muted"
        style={{
          position: "relative",
          margin: 0,
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
        }}
      >
        <Lock size={13} strokeWidth={1.75} aria-hidden="true" style={{ flex: "none" }} />
        {RODAPE_SEGURANCA}
      </p>
    </div>
  );
}

function Badge() {
  return (
    <span
      className="bg-tint-primary text-on-tint-primary"
      style={{
        alignSelf: "flex-start",
        borderRadius: "var(--tk-radius-pill)",
        padding: "6px 14px",
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        border: "1px solid color-mix(in oklch, var(--tk-primary) 24%, transparent)",
      }}
    >
      {BADGE}
    </span>
  );
}

/**
 * ⚠️ A HEADLINE FICA FORA DA ESCALA DE 8 NÍVEIS, de propósito. Aquela escala
 * existe para um painel DENSO, onde o maior nível é o número do KPI a 30px —
 * um título de marketing a 30px não é headline, é subtítulo. Aqui o problema
 * tipográfico é outro, e o `clamp` resolve o que a escala não cobre: crescer com
 * a largura sem estourar em tela pequena.
 *
 * ⛔ A segunda linha é `<span>` dentro do mesmo `<h1>`, e não um segundo
 * elemento: são uma frase só. Quebrar em dois títulos daria dois cabeçalhos ao
 * leitor de tela, que ouviria "Transforme dados" e "em lucro real" como assuntos
 * diferentes.
 */
function Headline() {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: "var(--tk-font-sans)",
        fontSize: "clamp(38px, 4.2vw, 58px)",
        lineHeight: 1.08,
        letterSpacing: "-0.03em",
        fontWeight: 600,
        maxWidth: "16ch",
      }}
      className="text-text"
    >
      {HEADLINE.primeira}{" "}
      {/* ⚠️ `display: block` na segunda linha, e é conserto de tela: sem ele o
          texto quebrava onde coubesse — saiu "Transforme dados em / lucro
          real.", com a cor começando no meio da primeira linha. O par
          `primeira`/`destaque` só faz sentido se cada um for UMA linha. */}
      <span className="text-primary" style={{ display: "block" }}>
        {HEADLINE.destaque}
      </span>
    </h1>
  );
}

const GLIFO: Record<Prova["icone"], ComponentType<{ size?: number; strokeWidth?: number }>> = {
  raio: Zap,
  escudo: ShieldCheck,
  alvo: Target,
};

function Provas() {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
        gap: 20,
      }}
    >
      {PROVAS.map((p) => {
        const Icone = GLIFO[p.icone];
        return (
          <li key={p.titulo} style={{ display: "flex", gap: 10, alignItems: "flex-start", minWidth: 0 }}>
            {/* Quadrado arredondado de 36px — a forma do `06` §13 para ícone que
                ILUSTRA um bloco. O tingimento é o de DESTAQUE, e não um neutro:
                a proibição de §13 é contra tingir quadrado por SEVERIDADE
                (âmbar/vermelho/verde), porque aí ele se lê como selo de estado.
                Azul de marca não é categoria — é o destaque, e o par
                tint/on-tint é o mesmo medido em AA. */}
            <span
              className="bg-tint-primary text-on-tint-primary"
              aria-hidden="true"
              style={{
                width: 36,
                height: 36,
                flex: "none",
                borderRadius: 10,
                display: "grid",
                placeItems: "center",
              }}
            >
              <Icone size={18} strokeWidth={1.75} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="text-text" style={{ fontSize: 13.5, fontWeight: 600 }}>
                {p.titulo}
              </span>
              <span className="text-text-muted" style={{ fontSize: 12, lineHeight: 1.4 }}>
                {p.apoio}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * O arco de fundo. Traço com o gradiente da marca, largo e fraco.
 *
 * ⚠️ `aria-hidden` e `pointer-events: none`: é textura, não dado. E é a única
 * coisa da tela que usa `--tk-gradient-brand` em área grande — no botão o
 * gradiente vira ANEL, porque nenhuma cor de rótulo o atravessa em AA (ver o
 * cabeçalho de `tk/Button`). Aqui não há rótulo por cima, então ele pode ser
 * o que é.
 */
function ArcoDecorativo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 600 900"
      preserveAspectRatio="xMaxYMid slice"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: 0.55,
      }}
    >
      <defs>
        <linearGradient id="auth-arco" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--tk-primary)" stopOpacity="0" />
          <stop offset="55%" stopColor="var(--tk-primary)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--tk-accent)" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path d="M-60 760 C 240 700, 470 470, 560 60" fill="none" stroke="url(#auth-arco)" strokeWidth="2" />
      <path d="M-60 820 C 280 760, 520 520, 620 90" fill="none" stroke="url(#auth-arco)" strokeWidth="1" opacity="0.5" />
    </svg>
  );
}
