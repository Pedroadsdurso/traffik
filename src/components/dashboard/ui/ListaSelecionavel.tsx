"use client";

import { useState } from "react";

import { sx } from "@/lib/sx";

export interface ItemSelecionavel {
  id: string;
  label: string;
  /** Segunda linha, menor: `act_123` · perfil, plataforma do gateway, etc. */
  detalhe?: string;
  /** Quando presente, o item fica desabilitado e o texto explica por quê. */
  bloqueio?: string;
}

/** Acima disto a lista ganha campo de busca — abaixo, rolar é mais rápido. */
const LIMIAR_BUSCA = 8;

/**
 * Lista de seleção múltipla com busca.
 *
 * Existe porque um `<select multiple>` nativo não aceita o tema escuro, não
 * mostra por que um item está indisponível e obriga a segurar Ctrl para marcar
 * o segundo item — que é justamente o caso comum aqui (uma área costuma ter
 * mais de uma conta).
 *
 * `bloqueio` desabilita o item **sem escondê-lo**: uma conta que já pertence a
 * outra área precisa aparecer com o nome da área que a ocupa, senão o usuário
 * procura uma conta que sumiu da lista e não descobre o motivo.
 */
export function ListaSelecionavel({
  itens,
  selecionados,
  onChange,
  vazio = "Nada para escolher.",
  altura = 190,
  onDesbloquear,
  rotuloDesbloquear = "Mover para cá",
}: {
  itens: ItemSelecionavel[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  vazio?: string;
  altura?: number;
  /**
   * Saída para um item bloqueado. Sem ela o bloqueio vira beco sem saída — e
   * com a área principal nascendo dona de todas as contas, criar a primeira
   * área secundária esbarraria sempre nele.
   *
   * Continua sendo um ato explícito: o item não é selecionável até o clique.
   */
  onDesbloquear?: (id: string) => void;
  rotuloDesbloquear?: string;
}) {
  const [busca, setBusca] = useState("");

  // Um id já selecionado que sumiu das opções (produto renomeado no gateway,
  // webhook excluído) continua **filtrando de verdade** — precisa aparecer, ou
  // vira um filtro invisível que não dá para desmarcar.
  const conhecidos = new Set(itens.map((i) => i.id));
  const orfaos: ItemSelecionavel[] = selecionados
    .filter((id) => !conhecidos.has(id))
    .map((id) => ({ id, label: id, detalhe: "Não está mais na lista — desmarque para remover o filtro" }));
  const todos = [...itens, ...orfaos];

  const termo = busca.trim().toLowerCase();
  const visiveis = termo
    ? todos.filter((i) => `${i.label} ${i.detalhe ?? ""}`.toLowerCase().includes(termo))
    : todos;

  const alternar = (id: string) =>
    onChange(selecionados.includes(id) ? selecionados.filter((s) => s !== id) : [...selecionados, id]);

  if (todos.length === 0) {
    return (
      <div className="text-muted" style={sx("border:1px dashed var(--color-border);border-radius:var(--radius-md);padding:var(--space-3);font-size:12.5px;text-align:center")}>
        {vazio}
      </div>
    );
  }

  return (
    <div style={sx("display:flex;flex-direction:column;gap:6px")}>
      {todos.length >= LIMIAR_BUSCA && (
        <input className="input" placeholder="Buscar…" value={busca} onChange={(e) => setBusca(e.target.value)}
          style={sx("font-size:12.5px;min-height:32px")} />
      )}

      <div style={sx(`max-height:${altura}px;overflow:auto;border:1px solid var(--color-border);border-radius:var(--radius-md);padding:4px;display:flex;flex-direction:column;gap:2px`)}>
        {visiveis.map((i) => {
          const marcado = selecionados.includes(i.id);
          const bloqueado = Boolean(i.bloqueio) && !marcado;
          return (
            <label key={i.id} title={i.bloqueio}
              style={sx(
                `display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:var(--radius-sm);font-size:12.5px;` +
                  `cursor:${bloqueado ? "not-allowed" : "pointer"};opacity:${bloqueado ? ".5" : "1"};` +
                  `background:${marcado ? "color-mix(in srgb, var(--color-accent) 16%, transparent)" : "transparent"}`,
              )}>
              <input type="checkbox" checked={marcado} disabled={bloqueado} onChange={() => alternar(i.id)}
                style={sx("margin-top:2px;flex:none;accent-color:var(--color-accent)")} />
              <span style={sx("min-width:0;flex:1")}>
                <span style={sx("display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{i.label}</span>
                {(i.bloqueio || i.detalhe) && (
                  <span className="text-muted" style={sx(`display:block;font-size:11px;margin-top:1px;${i.bloqueio ? "color:var(--color-warning,#fbbf24)" : ""}`)}>
                    {i.bloqueio ?? i.detalhe}
                  </span>
                )}
                {bloqueado && onDesbloquear && (
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); onDesbloquear(i.id); }}
                    style={sx(
                      "margin-top:5px;padding:3px 9px;border-radius:var(--radius-sm);cursor:pointer;font-size:11px;" +
                        "background:transparent;color:var(--color-accent-300);border:1px solid var(--color-accent)",
                    )}
                  >
                    {rotuloDesbloquear}
                  </button>
                )}
              </span>
            </label>
          );
        })}

        {visiveis.length === 0 && (
          <div className="text-muted" style={sx("font-size:12px;padding:8px")}>Nada encontrado.</div>
        )}
      </div>

      <div className="text-muted" style={sx("font-size:11px")}>
        {selecionados.length === 0
          ? "Nada selecionado — este campo não filtra."
          : `${selecionados.length} selecionado(s).`}
      </div>
    </div>
  );
}
