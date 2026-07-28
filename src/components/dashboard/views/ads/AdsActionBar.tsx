"use client";

import { useEffect, useRef, useState } from "react";

import { sx } from "@/lib/sx";
import { Modal } from "../../ui/Modal";

export type Nivel = "campaign" | "adset" | "ad";
export type Acao = "activate" | "pause" | "budget" | "bidcap" | "duplicate" | "delete";

export interface AlvoSelecionado {
  id: string;
  nome: string;
  /** Campanha com orçamento próprio ⇒ CBO. */
  cbo?: boolean;
  /** Nome da campanha-mãe, para explicar onde o orçamento será aplicado. */
  campanha?: string;
}

interface ItemMenu {
  acao: Acao | "fixar" | "copiarId";
  label: string;
  perigo?: boolean;
  /** Níveis em que a ação faz sentido. */
  niveis: Nivel[];
}

const MENU: ItemMenu[] = [
  { acao: "duplicate", label: "Duplicar campanha", niveis: ["campaign"] },
  { acao: "activate", label: "Ativar", niveis: ["campaign", "adset", "ad"] },
  { acao: "pause", label: "Desativar", niveis: ["campaign", "adset", "ad"] },
  { acao: "budget", label: "Alterar orçamento", niveis: ["campaign", "adset"] },
  { acao: "bidcap", label: "Alterar bid cap", niveis: ["adset"] },
  { acao: "fixar", label: "Fixar no topo", niveis: ["campaign", "adset", "ad"] },
  { acao: "copiarId", label: "Copiar ID", niveis: ["campaign", "adset", "ad"] },
  { acao: "delete", label: "Excluir", perigo: true, niveis: ["campaign", "adset", "ad"] },
];

export function AdsActionBar({
  nivel,
  selecionados,
  ordemGasto,
  onOrdenar,
  onSincronizar,
  sincronizando,
  ultimaSync,
  onFixar,
  onCopiarId,
  onAbrirNoFacebook,
  onExecutar,
  busy,
  resultado,
}: {
  nivel: Nivel;
  selecionados: AlvoSelecionado[];
  ordemGasto: "desc" | "asc";
  onOrdenar: () => void;
  onSincronizar: () => void;
  sincronizando: boolean;
  ultimaSync: string | null;
  onFixar: () => void;
  onCopiarId: () => void;
  onAbrirNoFacebook: () => void;
  onExecutar: (acao: Acao, valor?: number, ativar?: boolean) => Promise<void>;
  busy: boolean;
  resultado: string | null;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [confirmar, setConfirmar] = useState<{ acao: Acao; label: string } | null>(null);
  const [valor, setValor] = useState("");
  /** Duplicar: a cópia nasce ativa? Padrão pausada, para não gastar sem revisão. */
  const [duplicarAtiva, setDuplicarAtiva] = useState(false);
  const raizRef = useRef<HTMLDivElement>(null);

  const n = selecionados.length;
  const nada = n === 0;

  useEffect(() => {
    if (!menuAberto) return;
    const onDown = (e: MouseEvent) => {
      if (!raizRef.current?.contains(e.target as Node)) setMenuAberto(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuAberto]);

  // ── Detecção CBO/ABO (Bloco 7, item 3) ──
  // Campanha com orçamento próprio é CBO: o orçamento se edita NELA. Sem
  // orçamento próprio é ABO, e quem manda são os conjuntos.
  const cbos = selecionados.filter((s) => s.cbo);
  const abos = selecionados.filter((s) => !s.cbo);
  const orcamentoBloqueado = nivel === "campaign" && abos.length > 0;

  function abrir(item: ItemMenu) {
    setMenuAberto(false);
    if (item.acao === "fixar") return onFixar();
    if (item.acao === "copiarId") return onCopiarId();
    setValor("");
    setDuplicarAtiva(false);
    setConfirmar({ acao: item.acao, label: item.label });
  }

  async function confirmarExecucao() {
    if (!confirmar) return;
    const precisaValor = confirmar.acao === "budget" || confirmar.acao === "bidcap";
    const num = precisaValor ? parseFloat(valor.replace(",", ".")) : undefined;
    if (precisaValor && (!num || num <= 0)) return;
    await onExecutar(confirmar.acao, num, confirmar.acao === "duplicate" ? duplicarAtiva : undefined);
    setConfirmar(null);
  }

  const itens = MENU.filter((m) => m.niveis.includes(nivel));

  return (
    <div ref={raizRef} className="card" style={sx("gap:var(--space-2);padding:var(--space-3)")}>
      <div style={sx("display:flex;align-items:center;gap:var(--space-2);flex-wrap:wrap")}>
        {/* Menu de ações em massa */}
        <div style={sx("position:relative")}>
          <button className="btn btn-secondary" type="button" disabled={nada}
            onClick={() => setMenuAberto((o) => !o)} aria-haspopup="menu" aria-expanded={menuAberto}
            style={sx("display:inline-flex;align-items:center;gap:7px")}>
            {nada ? "Ações" : `${n} selecionada${n > 1 ? "s" : ""}`}
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2}
              strokeLinecap="round" strokeLinejoin="round" aria-hidden
              style={{ transform: menuAberto ? "rotate(180deg)" : "none", transition: "transform var(--dur-fast) var(--ease-out)" }}>
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {menuAberto && (
            <div className="tk-pop" role="menu" style={sx("min-width:210px")}>
              {itens.map((m) => (
                <button key={m.acao} type="button" role="menuitem" className="tk-opt"
                  onClick={() => abrir(m)}
                  style={sx(`width:100%;text-align:left;background:none;border:0;cursor:pointer;font:inherit;${m.perigo ? "color:#f87171" : "color:inherit"}`)}>
                  {m.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-secondary" type="button" onClick={onOrdenar}
          title="Alternar ordenação por gasto">
          Gasto {ordemGasto === "desc" ? "↓" : "↑"}
        </button>

        <button className="btn btn-secondary" type="button" onClick={onAbrirNoFacebook} disabled={n !== 1}
          title={n === 1 ? "Abrir no Gerenciador de Anúncios do Facebook" : "Selecione exatamente uma linha"}>
          Abrir no Facebook ↗
        </button>

        {/* O botão "Sincronizar métricas" saiu daqui: a sincronização manual é
            uma só, no "Atualizar" do Dashboard. Continua havendo sincronização
            automática (polling + crons), então o que faltava aqui não era o
            botão e sim saber a IDADE do dado — que é o que fica. */}
        <div style={sx("margin-left:auto;display:flex;align-items:center;gap:var(--space-2)")}>
          {ultimaSync && <span className="text-muted" style={sx("font-size:11.5px")}>{ultimaSync}</span>}
        </div>
      </div>

      {resultado && <p style={sx("margin:0;font-size:12.5px")}>{resultado}</p>}

      {/* Confirmação — obrigatória para tudo que muda algo no Facebook */}
      {confirmar && (
        <Modal
          aberta
          onClose={() => setConfirmar(null)}
          largura={480}
          titulo={confirmar.label}
          rodape={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setConfirmar(null)}>Cancelar</button>
              <button
                className="btn btn-primary"
                type="button"
                onClick={confirmarExecucao}
                disabled={
                  busy ||
                  (confirmar.acao === "budget" && orcamentoBloqueado && cbos.length === 0) ||
                  ((confirmar.acao === "budget" || confirmar.acao === "bidcap") && !valor.trim())
                }
                style={sx(confirmar.acao === "delete" ? "color:#f87171;border-color:#f87171" : "")}
              >
                {busy ? "Aplicando…" : confirmar.acao === "delete" ? "Excluir mesmo assim" : "Confirmar"}
              </button>
            </>
          }
        >




              <p style={sx("margin:0;font-size:13px")}>
                {confirmar.acao === "delete" ? (
                  <>
                    Isto marca <strong>{n} item(ns)</strong> como excluídos <strong>na sua conta do Facebook</strong>.
                    A Meta não oferece desfazer — a ação é <strong>irreversível</strong>.
                  </>
                ) : confirmar.acao === "duplicate" ? (
                  <>Serão duplicadas <strong>{n} campanha(s)</strong>, com conjuntos e anúncios.</>
                ) : (
                  <>A ação será aplicada a <strong>{n} item(ns)</strong> direto no Facebook.</>
                )}
              </p>

              {/* Orçamento: explica em que nível está sendo mexido */}
              {confirmar.acao === "budget" && (
                <>
                  {nivel === "campaign" && cbos.length > 0 && (
                    <p className="text-muted" style={sx("margin:0;font-size:12px;line-height:1.5")}>
                      {cbos.length} campanha(s) são <strong>CBO</strong> — têm orçamento próprio, então ele é
                      alterado <strong>no nível da campanha</strong>.
                    </p>
                  )}
                  {orcamentoBloqueado && (
                    <p style={sx("margin:0;font-size:12px;line-height:1.5;color:var(--color-warning,#fbbf24)")}>
                      {abos.length} campanha(s) são <strong>ABO</strong>: o orçamento vive nos <strong>conjuntos</strong>,
                      não na campanha. Abra a aba <strong>Conjuntos</strong> e altere por lá — a Meta recusaria a
                      alteração no nível da campanha.
                    </p>
                  )}
                  {nivel === "adset" && (
                    <p className="text-muted" style={sx("margin:0;font-size:12px;line-height:1.5")}>
                      Alterando no nível do <strong>conjunto</strong>. Se a campanha for CBO, a Meta ignora este valor.
                    </p>
                  )}
                </>
              )}

              {confirmar.acao === "duplicate" && (
                <div className="field">
                  <label>Como a cópia deve nascer?</label>
                  <div style={sx("display:flex;gap:8px")}>
                    {[
                      { ativa: false, titulo: "Desativada", dica: "Recomendado — revise antes de gastar" },
                      { ativa: true, titulo: "Ativada", dica: "Começa a gastar assim que o Facebook aprovar" },
                    ].map((o) => (
                      <button
                        key={String(o.ativa)}
                        type="button"
                        className="opcao-tile"
                        aria-pressed={duplicarAtiva === o.ativa}
                        onClick={() => setDuplicarAtiva(o.ativa)}
                        style={sx("flex:1;align-items:flex-start;text-align:left;gap:3px")}
                      >
                        <span style={sx("font-weight:600")}>{o.titulo}</span>
                        <span className="text-muted" style={sx("font-size:11px;line-height:1.4")}>{o.dica}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {(confirmar.acao === "budget" || confirmar.acao === "bidcap") && (
                <div className="field">
                  <label>{confirmar.acao === "budget" ? "Novo orçamento diário (R$)" : "Novo bid cap (R$)"}</label>
                  <input className="input" inputMode="decimal" value={valor} autoFocus
                    onChange={(e) => setValor(e.target.value)} placeholder="Ex.: 50,00" />
                </div>
              )}

              <div style={sx("max-height:110px;overflow:auto;font-size:12px")} className="text-muted">
                {selecionados.slice(0, 12).map((s) => <div key={s.id}>· {s.nome}</div>)}
                {n > 12 && <div>… e mais {n - 12}</div>}
              </div>
        </Modal>
      )}
    </div>
  );
}
