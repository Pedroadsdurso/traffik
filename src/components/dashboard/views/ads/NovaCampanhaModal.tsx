"use client";

import { sx } from "@/lib/sx";
import { Modal } from "../../ui/Modal";
import { Select } from "../../ui/Select";
import type { TraffikView } from "../../useTraffikState";

/**
 * # Criar campanha — a tela que nunca existiu
 *
 * `POST /api/ads/campaign`, `createCampaign` e todo o estado `newCampaign*`
 * estavam prontos desde a v1 e **nenhum `.tsx` os importava**. Sexto caso do
 * PROCEDIMENTO OBRIGATÓRIO nesta base: rota funcionando, estado montado,
 * componente nunca escrito — e nada falhava, porque código inerte compila.
 *
 * A dívida deixou de ser cosmética quando bloqueou trabalho: sem esta tela não
 * havia como criar uma campanha **crua** (sem conjunto), que é a única cobaia
 * segura para exercitar escrita na Graph API.
 *
 * ## 🔴 O que esta tela cria — e o que ela deliberadamente NÃO cria
 *
 * Uma chamada, uma aresta: `POST /act_<conta>/campaigns`. **Nenhum conjunto,
 * nenhum anúncio.** É o oposto do fluxo guiado do Gerenciador do Facebook, que
 * cria os três juntos — e foi exatamente por isso que uma campanha que se
 * acreditava crua apareceu entregando e gastando.
 *
 * ⚠️ **Nasce PAUSADA**, no Facebook e no nosso banco. Campanha nova ligada
 * sozinha é dinheiro saindo sem ninguém pedir.
 */

/**
 * Objetivos ODAX. São os que a Marketing API aceita hoje; os nomes antigos
 * (`LINK_CLICKS`, `CONVERSIONS`…) foram descontinuados.
 */
const OBJETIVOS = [
  { value: "OUTCOME_TRAFFIC", label: "Tráfego" },
  { value: "OUTCOME_SALES", label: "Vendas" },
  { value: "OUTCOME_LEADS", label: "Cadastros" },
  { value: "OUTCOME_ENGAGEMENT", label: "Engajamento" },
  { value: "OUTCOME_AWARENESS", label: "Reconhecimento" },
  { value: "OUTCOME_APP_PROMOTION", label: "Promoção de app" },
];

export function NovaCampanhaModal({ v }: { v: TraffikView }) {
  const contas = (v.adsRaw?.accounts ?? []).map((a) => ({ value: a.id, label: a.name }));
  const podeCriar = !!v.newCampaignAccount && v.newCampaignName.trim().length > 0 && !v.newCampaignBusy;

  return (
    <Modal aberta titulo="Nova campanha" onClose={v.closeNewCampaign}>
      <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
        <p className="card-body" style={sx("margin:0")}>
          Cria a campanha no Facebook e para por aí: <strong>sem conjunto e sem anúncio</strong>.
          Ela nasce <strong>pausada</strong> — para entregar, é preciso montar o conjunto no
          Gerenciador do Facebook.
        </p>

        <label style={sx("display:flex;flex-direction:column;gap:5px")}>
          <span style={sx("font-size:12px;font-weight:600")}>Conta de anúncio</span>
          {contas.length ? (
            <Select
              label=""
              value={v.newCampaignAccount}
              options={contas}
              onChange={v.setNewCampaignAccount}
              minWidth={260}
            />
          ) : (
            <span className="text-muted" style={sx("font-size:12.5px")}>
              Nenhuma conta nesta Área de Trabalho. Conecte um perfil em Integrações › Anúncios.
            </span>
          )}
        </label>

        <label style={sx("display:flex;flex-direction:column;gap:5px")}>
          <span style={sx("font-size:12px;font-weight:600")}>Nome</span>
          <input
            className="input"
            value={v.newCampaignName}
            placeholder="Ex.: Oferta Black — Tráfego"
            onChange={(e) => v.setNewCampaignName(e.target.value)}
          />
        </label>

        <label style={sx("display:flex;flex-direction:column;gap:5px")}>
          <span style={sx("font-size:12px;font-weight:600")}>Objetivo</span>
          <Select
            label=""
            value={v.newCampaignObjective}
            options={OBJETIVOS}
            onChange={v.setNewCampaignObjective}
            minWidth={260}
          />
        </label>

        <label style={sx("display:flex;flex-direction:column;gap:5px")}>
          <span style={sx("font-size:12px;font-weight:600")}>Orçamento diário (opcional)</span>
          <input
            className="input"
            style={sx("max-width:160px")}
            inputMode="decimal"
            value={v.newCampaignBudget}
            placeholder="R$ por dia"
            onChange={(e) => v.setNewCampaignBudget(e.target.value)}
          />
          {/* Preencher aqui é o que define CBO — e é o que o motor de regras
              exige para conseguir alterar orçamento no nível da campanha.
              Em branco, o orçamento vive nos conjuntos (ABO). */}
          <span className="text-muted" style={sx("font-size:11.5px;line-height:1.45")}>
            Com valor, o orçamento fica na campanha (CBO). Em branco, ele vive nos conjuntos (ABO)
            — e regras de orçamento no nível de campanha não conseguem alterá-lo.
          </span>
        </label>

        <div style={sx("display:flex;gap:var(--space-2);justify-content:flex-end;margin-top:var(--space-2)")}>
          <button className="btn btn-ghost" type="button" onClick={v.closeNewCampaign}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="button" onClick={v.createCampaign} disabled={!podeCriar}>
            {v.newCampaignBusy ? "Criando…" : "Criar campanha"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
