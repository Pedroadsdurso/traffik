"use client";

import * as React from "react";

/**
 * Segmented — alternador de VISÃO, curto (2 a 4 opções, todas visíveis).
 *
 * ⚠️ Não é o `Select`, e a diferença é de significado: o Select escolhe um
 * VALOR de uma lista que pode crescer (conta de anúncio, produto); o Segmented
 * troca a LENTE sobre o mesmo dado — Diário/Semanal, Ranking/Globo, Grade/Tabela.
 * Trocar um pelo outro esconde opções que precisavam estar à vista, ou enfia
 * quarenta contas numa fileira de botões.
 *
 * Usa `radiogroup` em vez de botões soltos: com radio, a seta do teclado navega
 * entre as opções e o leitor de tela anuncia "2 de 3".
 *
 * ⛔ A ALTURA SAI DE `--tk-altura-controle`, como todo controle do sistema, e
 * **não de padding solto**. Era 26px por acidente aritmético (2 de moldura + 4
 * de padding + a linha do `text-caption`) enquanto Select, Input e Button no
 * mesmo cabeçalho de cartão mediam 32. A diferença de 6px não se lê como
 * "componente diferente" — se lê como desalinhamento, que é o `06` §14.1.
 */

export function Segmented<T extends string>({
  opcoes,
  valor,
  aoTrocar,
  rotuloAcessivel,
}: {
  opcoes: readonly { valor: T; rotulo: React.ReactNode; titulo?: string }[];
  valor: T;
  aoTrocar: (v: T) => void;
  rotuloAcessivel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={rotuloAcessivel}
      className="bg-surface-hover border border-border"
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "var(--tk-altura-controle)",
        padding: 3,
        borderRadius: "var(--tk-radius-controle)",
        gap: 2,
        flex: "none",
      }}
    >
      {opcoes.map((o) => {
        const ativo = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={ativo}
            title={o.titulo}
            onClick={() => aoTrocar(o.valor)}
            className={`text-caption ${ativo ? "bg-primary-solid text-on-primary" : "text-text-secondary"}`}
            style={{
              display: "inline-flex",
              alignItems: "center",
              height: "100%",
              padding: "0 10px",
              // Raio interno = externo − padding, senão o botão ativo "vaza" do
              // canto da moldura e os dois arredondamentos brigam.
              borderRadius: "calc(var(--tk-radius-controle) - 3px)",
              border: 0,
              cursor: "pointer",
              fontWeight: 500,
              transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
            }}
          >
            {o.rotulo}
          </button>
        );
      })}
    </div>
  );
}
