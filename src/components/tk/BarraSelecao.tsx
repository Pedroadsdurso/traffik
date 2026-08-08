"use client";

import * as React from "react";

import { plural } from "@/lib/format";
import { Modal } from "@/components/dashboard/ui/Modal";
import { Icone } from "@/components/dashboard/ui/Icone";

import { Button } from "./Button";
import { DropdownMenu, type ItemMenu } from "./DropdownMenu";
import { Input } from "./Input";
import { Segmented } from "./Segmented";

/**
 * # BarraSelecao — as ações em massa do Gerenciador
 *
 * ⚠️ **Ela só existe quando há seleção.** A barra antiga ficava na tela sempre,
 * com um botão "Ações" desabilitado ocupando o topo da página o tempo todo —
 * controle presente e inerte em 99% das visitas. Aqui a fileira aparece com a
 * primeira marcação e diz, em palavras, o que vai ser afetado.
 *
 * ## ⛔ TODA AÇÃO ESCREVE NA CONTA DO FACEBOOK, e por isso todas confirmam
 *
 * Não é excesso de zelo: o `delete` é **irreversível** (a Meta não desfaz), e
 * `activate` **começa a gastar dinheiro**. As duas confirmações mostram a lista
 * do que foi selecionado antes de perguntar — quem selecionou 40 linhas por
 * engano descobre no diálogo, não no extrato.
 */

export type Nivel = "campaign" | "adset" | "ad";
export type Acao = "activate" | "pause" | "budget" | "bidcap" | "duplicate" | "delete";

/**
 * Como cada nível se chama na tela, com gênero — o diálogo dizia
 * `"1 item(ns) como excluídos"`, que é código vazando na tela mais perigosa do
 * produto. E "item" não é o vocabulário de ninguém: o que se exclui é campanha,
 * conjunto ou anúncio.
 */
export const NOME_DO_NIVEL: Record<Nivel, { um: string; varios: string; genero: "a" | "o" }> = {
  campaign: { um: "campanha", varios: "campanhas", genero: "a" },
  adset: { um: "conjunto", varios: "conjuntos", genero: "o" },
  ad: { um: "anúncio", varios: "anúncios", genero: "o" },
};

export interface AlvoSelecionado {
  id: string;
  nome: string;
  /** Campanha com orçamento próprio ⇒ CBO. */
  cbo?: boolean;
}

const ROTULO: Record<Acao, string> = {
  activate: "Ativar",
  pause: "Pausar",
  budget: "Alterar orçamento",
  bidcap: "Alterar bid cap",
  duplicate: "Duplicar campanha",
  delete: "Excluir",
};

/** Em que níveis cada ação existe. Fora deles a Meta recusaria a chamada. */
const NIVEIS: Record<Acao, Nivel[]> = {
  activate: ["campaign", "adset", "ad"],
  pause: ["campaign", "adset", "ad"],
  budget: ["campaign", "adset"],
  bidcap: ["adset"],
  duplicate: ["campaign"],
  delete: ["campaign", "adset", "ad"],
};

export function BarraSelecao({
  nivel,
  selecionados,
  ocupado,
  resultado,
  aoExecutar,
  aoLimpar,
  aoFixar,
  aoCopiarId,
  aoAbrirNoFacebook,
}: {
  nivel: Nivel;
  selecionados: AlvoSelecionado[];
  ocupado: boolean;
  resultado: string | null;
  aoExecutar: (acao: Acao, valor?: number, ativar?: boolean) => Promise<void>;
  aoLimpar: () => void;
  aoFixar: () => void;
  aoCopiarId: () => void;
  aoAbrirNoFacebook: () => void;
}) {
  const [menu, setMenu] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);
  const [confirmar, setConfirmar] = React.useState<Acao | null>(null);
  const [valor, setValor] = React.useState("");
  /** Duplicar: a cópia nasce ativa? Padrão pausada, para não gastar sem revisão. */
  const [duplicarAtiva, setDuplicarAtiva] = React.useState(false);

  const n = selecionados.length;
  const nome = NOME_DO_NIVEL[nivel];
  const permitida = (a: Acao) => NIVEIS[a].includes(nivel);

  // ── CBO/ABO ──────────────────────────────────────────────────────────────
  // Campanha com orçamento próprio é CBO: o orçamento se edita NELA. Sem
  // orçamento próprio é ABO, e quem manda são os conjuntos.
  const cbos = selecionados.filter((s) => s.cbo);
  const abos = selecionados.filter((s) => !s.cbo);
  const orcamentoBloqueado = nivel === "campaign" && abos.length > 0;

  function abrir(a: Acao) {
    setMenu(false);
    setValor("");
    setDuplicarAtiva(false);
    setConfirmar(a);
  }

  async function confirmarExecucao() {
    if (!confirmar) return;
    const precisaValor = confirmar === "budget" || confirmar === "bidcap";
    const num = precisaValor ? parseFloat(valor.replace(",", ".")) : undefined;
    if (precisaValor && (!num || num <= 0)) return;
    await aoExecutar(confirmar, num, confirmar === "duplicate" ? duplicarAtiva : undefined);
    setConfirmar(null);
  }

  const itens: ItemMenu[] = [
    ...(permitida("duplicate")
      ? [{ rotulo: ROTULO.duplicate, aoEscolher: () => abrir("duplicate") }]
      : []),
    ...(permitida("budget") ? [{ rotulo: ROTULO.budget, aoEscolher: () => abrir("budget") }] : []),
    ...(permitida("bidcap") ? [{ rotulo: ROTULO.bidcap, aoEscolher: () => abrir("bidcap") }] : []),
    { tipo: "separador" as const },
    { rotulo: "Fixar no topo", aoEscolher: () => { setMenu(false); aoFixar(); } },
    { rotulo: "Copiar ID do Facebook", aoEscolher: () => { setMenu(false); aoCopiarId(); } },
    {
      rotulo: "Abrir no Facebook",
      apoio: n === 1 ? undefined : "uma por vez",
      aoEscolher: n === 1 ? () => { setMenu(false); aoAbrirNoFacebook(); } : undefined,
    },
    { tipo: "separador" as const },
    { rotulo: ROTULO.delete, perigo: true, aoEscolher: () => abrir("delete") },
  ];

  return (
    <div
      className="bg-tint-primary"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
        padding: "8px 12px",
        borderRadius: "var(--tk-radius-card)",
      }}
    >
      <span className="text-label text-text">
        {plural(n, `${nome.um} selecionad${nome.genero}`, `${nome.varios} selecionad${nome.genero}s`)}
      </span>

      <Button variante="secundario" onClick={() => abrir("activate")} disabled={ocupado}>
        Ativar
      </Button>
      <Button variante="secundario" onClick={() => abrir("pause")} disabled={ocupado}>
        Pausar
      </Button>

      <span ref={setGatilho} style={{ display: "inline-flex" }}>
        <Button
          variante="secundario"
          onClick={() => setMenu((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={menu}
          iconeFim={<Icone nome="chevronBaixo" tamanho={13} />}
          disabled={ocupado}
        >
          Mais ações
        </Button>
      </span>
      <DropdownMenu
        aberto={menu}
        aoFechar={() => setMenu(false)}
        gatilho={gatilho}
        itens={itens}
        rotuloAcessivel={`Ações em massa para ${nome.varios}`}
      />

      {/* O resultado fica NA BARRA, não num toast: ele pode listar falha por
          linha, e um aviso que some sozinho levaria junto o nome de qual falhou. */}
      {resultado && <span className="text-caption text-text-secondary">{resultado}</span>}

      <span style={{ marginLeft: "auto" }}>
        <Button variante="fantasma" onClick={aoLimpar}>
          Limpar seleção
        </Button>
      </span>

      {confirmar && (
        <Modal
          aberta
          onClose={() => setConfirmar(null)}
          largura={480}
          titulo={ROTULO[confirmar]}
          rodape={
            <>
              <Button variante="secundario" onClick={() => setConfirmar(null)}>
                Cancelar
              </Button>
              <Button
                variante={confirmar === "delete" ? "destrutivo" : "primario"}
                onClick={() => void confirmarExecucao()}
                carregando={ocupado}
                disabled={
                  (confirmar === "budget" && orcamentoBloqueado && cbos.length === 0) ||
                  ((confirmar === "budget" || confirmar === "bidcap") && !valor.trim())
                }
              >
                {confirmar === "delete" ? "Excluir mesmo assim" : "Confirmar"}
              </Button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p className="text-body text-text" style={{ margin: 0 }}>
              {confirmar === "delete" ? (
                <>
                  Isto marca <strong>{plural(n, nome.um, nome.varios)}</strong> como excluíd{nome.genero}
                  {n === 1 ? "" : "s"} <strong>na sua conta do Facebook</strong>. A Meta não oferece
                  desfazer — a ação é <strong>irreversível</strong>.
                </>
              ) : confirmar === "duplicate" ? (
                <>
                  Serão duplicadas <strong>{plural(n, "campanha", "campanhas")}</strong>, com conjuntos e anúncios.
                </>
              ) : confirmar === "activate" ? (
                <>
                  {plural(n, `${nome.um} volta`, `${nome.varios} voltam`)} a entregar no Facebook — e a{" "}
                  <strong>gastar</strong>.
                </>
              ) : (
                <>
                  A ação será aplicada a <strong>{plural(n, nome.um, nome.varios)}</strong> direto no Facebook.
                </>
              )}
            </p>

            {confirmar === "budget" && (
              <>
                {nivel === "campaign" && cbos.length > 0 && (
                  <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
                    {plural(cbos.length, "campanha é", "campanhas são")} <strong>CBO</strong> — têm orçamento
                    próprio, então ele é alterado <strong>no nível da campanha</strong>.
                  </p>
                )}
                {orcamentoBloqueado && (
                  <p className="text-caption" style={{ margin: 0, lineHeight: 1.5, color: "var(--tk-warning)" }}>
                    {plural(abos.length, "campanha é", "campanhas são")} <strong>ABO</strong>: o orçamento vive
                    nos <strong>conjuntos</strong>, não na campanha. Troque o agrupamento para{" "}
                    <strong>Conjunto</strong> e altere por lá — a Meta recusaria a alteração aqui.
                  </p>
                )}
                {nivel === "adset" && (
                  <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
                    Alterando no nível do <strong>conjunto</strong>. Se a campanha for CBO, a Meta ignora este valor.
                  </p>
                )}
              </>
            )}

            {confirmar === "duplicate" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="text-label text-text">Como a cópia deve nascer?</span>
                <Segmented
                  rotuloAcessivel="Estado da cópia"
                  valor={duplicarAtiva ? "ativa" : "pausada"}
                  aoTrocar={(v) => setDuplicarAtiva(v === "ativa")}
                  opcoes={[
                    { valor: "pausada", rotulo: "Pausada", titulo: "Recomendado — revise antes de gastar" },
                    { valor: "ativa", rotulo: "Ativada", titulo: "Começa a gastar assim que o Facebook aprovar" },
                  ]}
                />
              </div>
            )}

            {(confirmar === "budget" || confirmar === "bidcap") && (
              <Input
                rotulo={confirmar === "budget" ? "Novo orçamento diário" : "Novo bid cap"}
                sufixo="R$"
                inputMode="decimal"
                value={valor}
                autoFocus
                onChange={(e) => setValor(e.target.value)}
                placeholder="Ex.: 50,00"
              />
            )}

            <div className="text-caption text-text-muted" style={{ maxHeight: 120, overflow: "auto" }}>
              {selecionados.slice(0, 12).map((s) => (
                <div key={s.id}>· {s.nome}</div>
              ))}
              {n > 12 && <div>… e mais {n - 12}</div>}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
