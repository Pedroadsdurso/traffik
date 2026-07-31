"use client";

import { useCallback, useEffect, useState } from "react";

import {
  conferirSnippet,
  createPixel,
  deletePixel,
  listPixels,
  listTrackedProducts,
  togglePixel,
  updatePixel,
  type DetectionType,
  type PixelConfigDTO,
  type PixelFormInput,
  type SnippetCheckDTO,
} from "@/lib/actions/pixels";
import { getPublicAppUrl } from "@/lib/appUrl";
import { pixelScript } from "@/lib/pixel/script";
import { elapsed, plural } from "@/lib/format";
import { CONFIG } from "@/lib/explicacoes";
import { sx } from "@/lib/sx";
import {
  EVENTOS_DO_PIXEL,
  EXPLICACAO_DONO,
  NOTA_DO_EVENTO,
  ROTULO_DONO,
  padraoDoEvento,
  type DonoDoEvento,
  type MapaDeDonos,
} from "@/lib/pixel/donos";
import { Select } from "../../ui/Select";
import { Icone } from "../../ui/Icone";
import { InfoTip } from "../../ui/InfoTip";
import { Drawer } from "../../ui/Drawer";
import { SnippetBox } from "../../ui/SnippetBox";

/** `savedToken` marca um pixel já persistido cujo token fica no servidor (nunca volta ao cliente). */
type MetaDraft = { pixelId: string; accessToken: string; nickname: string; savedToken?: boolean };
type Form = {
  name: string;
  metaPixels: MetaDraft[];
  lead: boolean;
  addToCart: boolean;
  ic: { enabled: boolean; type: DetectionType; value: string };
  purchase: { enabled: boolean; sendMode: string; valueMode: string; fixedValue: string; targetProduct: string };
  /** Quem envia cada evento para a Meta. */
  donos: MapaDeDonos;
};

const EMPTY_FORM: Form = {
  name: "",
  metaPixels: [],
  lead: false,
  addToCart: false,
  ic: { enabled: false, type: "clique_checkout", value: "" },
  purchase: { enabled: true, sendMode: "APENAS_APROVADAS", valueMode: "VALOR_DA_VENDA", fixedValue: "", targetProduct: "" },
  // Vazio = tudo da Traffik. O padrão nunca é "não envia".
  donos: {},
};

function formToInput(f: Form): PixelFormInput {
  return {
    name: f.name,
    metaPixels: f.metaPixels.map((m) => ({ pixelId: m.pixelId, accessToken: m.accessToken, nickname: m.nickname })),
    lead: f.lead,
    addToCart: f.addToCart,
    initiateCheckout: { enabled: f.ic.enabled, detectionType: f.ic.type, detectionValue: f.ic.value },
    purchase: {
      enabled: f.purchase.enabled,
      sendMode: f.purchase.sendMode as PixelFormInput["purchase"]["sendMode"],
      valueMode: f.purchase.valueMode as PixelFormInput["purchase"]["valueMode"],
      fixedValue: f.purchase.valueMode === "VALOR_FIXO" ? parseFloat(f.purchase.fixedValue) || 0 : null,
      targetProduct: f.purchase.targetProduct || null,
    },
    eventOwners: f.donos,
  };
}

function dtoToForm(px: PixelConfigDTO): Form {
  const ic = px.rules.find((r) => r.eventType === "INITIATE_CHECKOUT");
  const pu = px.rules.find((r) => r.eventType === "PURCHASE");
  return {
    name: px.name,
    metaPixels: px.metaPixels.map((m) => ({ pixelId: m.pixelId, accessToken: "", nickname: m.nickname ?? "", savedToken: m.hasToken })),
    lead: px.rules.find((r) => r.eventType === "LEAD")?.enabled ?? false,
    addToCart: px.rules.find((r) => r.eventType === "ADD_TO_CART")?.enabled ?? false,
    ic: { enabled: ic?.enabled ?? false, type: (ic?.detectionType as DetectionType) ?? "clique_checkout", value: ic?.detectionValue ?? "" },
    purchase: {
      enabled: pu?.enabled ?? true,
      sendMode: pu?.sendMode ?? "APENAS_APROVADAS",
      valueMode: pu?.valueMode ?? "VALOR_DA_VENDA",
      fixedValue: pu?.fixedValue != null ? String(pu.fixedValue) : "",
      targetProduct: pu?.targetProduct ?? "",
    },
    donos: px.eventOwners,
  };
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className="sw" role="switch" aria-checked={on} onClick={onClick} type="button" />;
}

/**
 * O script instalado bate com o que está configurado aqui?
 *
 * 🔴 Existe porque a divergência mais cara é MUDA: regra ligada na gaveta +
 * snippet velho no site = nenhum evento, e a tela dizia que estava tudo certo.
 * Ver `lib/pixel/detectores.ts`.
 */
function AvisoSnippet({ check }: { check: SnippetCheckDTO | null }) {
  if (!check) return null;

  const quando = check.visto ? `Último evento recebido ${elapsed(new Date(check.visto).getTime())}.` : "";

  if (check.estado === "ok") {
    return (
      <div className="text-muted" style={sx("display:flex;gap:7px;align-items:flex-start;font-size:11.5px;line-height:1.45")}>
        <Icone nome="ok" tamanho={13} />
        <span>O script instalado no seu site corresponde a esta configuração. {quando}</span>
      </div>
    );
  }

  if (check.estado === "sem-dados") {
    return (
      <div className="text-muted" style={sx("display:flex;gap:7px;align-items:flex-start;font-size:11.5px;line-height:1.45")}>
        <Icone nome="info" tamanho={13} />
        {/* ⚠️ Não afirmamos "está tudo certo": sem evento nenhum não dá para
            distinguir script ausente de site sem tráfego. */}
        <span>
          Nenhum evento chegou deste pixel ainda, então não dá para conferir o script instalado.
          Ele aparece aqui na primeira visita à página.
        </span>
      </div>
    );
  }

  const titulo =
    check.estado === "script-antigo"
      ? "O script instalado é de uma versão anterior."
      : "O script instalado não corresponde ao que está configurado aqui.";

  return (
    <div
      style={sx(
        "display:flex;flex-direction:column;gap:6px;font-size:11.5px;line-height:1.45;" +
          "color:var(--color-warning,#fbbf24);border-left:2px solid var(--color-warning,#fbbf24);padding-left:9px",
      )}
    >
      <span style={sx("display:flex;gap:7px;align-items:flex-start;font-weight:600")}>
        <Icone nome="aviso" tamanho={13} cor="aviso" />
        {titulo}
      </span>
      {check.divergencias.length > 0 && (
        <ul style={sx("margin:0;padding-left:16px;display:flex;flex-direction:column;gap:3px")}>
          {check.divergencias.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      )}
      <span>
        Copie o script abaixo de novo e substitua o que está no seu site — o que o script detecta é
        decidido no momento em que ele é gerado, não agora. {quando}
      </span>
    </div>
  );
}

export function PixelView() {
  const [pixels, setPixels] = useState<PixelConfigDTO[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [meta, setMeta] = useState<MetaDraft>({ pixelId: "", accessToken: "", nickname: "" });
  const [metaOpen, setMetaOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<SnippetCheckDTO | null>(null);

  useEffect(() => {
    listPixels().then(setPixels).catch(() => {});
    listTrackedProducts().then(setProducts).catch(() => {});
  }, []);

  /**
   * Confere o snippet instalado sempre que a gaveta muda de pixel.
   *
   * ⚠️ Recarregado também depois de SALVAR (ver `save`): salvar muda o que a
   * ferramenta espera do script, então um resultado calculado antes do save
   * viraria uma afirmação sobre a configuração anterior — pior que nenhuma,
   * porque parece confirmação.
   */
  const carregarCheck = useCallback((id: string | null) => {
    setCheck(null);
    if (!id) return;
    conferirSnippet(id).then(setCheck).catch(() => {});
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `carregarCheck` busca no servidor e guarda o resultado
    if (modalOpen) carregarCheck(editId);
  }, [modalOpen, editId, carregarCheck]);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setMeta({ pixelId: "", accessToken: "", nickname: "" });
    setMetaOpen(false);
    setError(null);
    setModalOpen(true);
  }
  function openEdit(px: PixelConfigDTO) {
    setForm(dtoToForm(px));
    setEditId(px.id);
    setMeta({ pixelId: "", accessToken: "", nickname: "" });
    setMetaOpen(false);
    setError(null);
    setModalOpen(true);
  }
  function addMeta() {
    if (!meta.pixelId.trim()) return;
    setForm((f) => ({ ...f, metaPixels: [...f.metaPixels, meta] }));
    setMeta({ pixelId: "", accessToken: "", nickname: "" });
    setMetaOpen(false);
  }
  function removeMeta(i: number) {
    setForm((f) => ({ ...f, metaPixels: f.metaPixels.filter((_, j) => j !== i) }));
  }

  async function save() {
    if (form.metaPixels.length === 0) {
      setError("Adicione ao menos um pixel da Meta.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const input = formToInput(form);
      const saved = editId ? await updatePixel(editId, input) : await createPixel(input);
      setPixels((list) => (editId ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]));
      // Mantém a gaveta aberta no pixel recém-criado: é onde o script aparece.
      setEditId(saved.id);
      // O que a ferramenta espera do script acabou de mudar — reconferir aqui é
      // o que faz o aviso aparecer no exato momento em que ele passa a valer.
      carregarCheck(saved.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar. Saia e entre novamente se persistir.");
    } finally {
      setBusy(false);
    }
  }
  async function toggle(id: string) {
    const r = await togglePixel(id);
    setPixels((list) => list.map((p) => (p.id === id ? { ...p, enabled: r.enabled } : p)));
  }
  async function remove(id: string) {
    await deletePixel(id);
    setPixels((list) => list.filter((p) => p.id !== id));
  }

  function scriptText(px: PixelConfigDTO): string {
    const ic = px.rules.find((r) => r.eventType === "INITIATE_CHECKOUT");
    return pixelScript({
      configId: px.id,
      eventOwners: px.eventOwners,
      apiBase: getPublicAppUrl(),
      lead: px.rules.find((r) => r.eventType === "LEAD")?.enabled ?? false,
      addToCart: px.rules.find((r) => r.eventType === "ADD_TO_CART")?.enabled ?? false,
      initiateCheckout: {
        enabled: ic?.enabled ?? false,
        type: (ic?.detectionType as DetectionType) ?? undefined,
        value: ic?.detectionValue ?? undefined,
      },
    });
  }

  return (
    /* O `max-width:920px` saiu: num container de ~1390px ele deixava 470px de ar
       morto à direita, e cada pixel era uma linha de 35px dentro dele. */
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      {/* Intro e galeria dentro do MESMO card, como o bloco de Webhooks — assim as
          duas abas de Integrações lêem como irmãs. Em cards separados, a intro
          virava uma faixa de 2.200px com três linhas de texto e o resto vazio.

          ⚠️ Sem botão de adicionar no cabeçalho: quem adiciona é o tile tracejado
          no fim da grade. Os dois juntos seriam a mesma ação em dois lugares. */}
      <div className="card" style={sx("gap:var(--space-3)")}>
        <div style={sx("max-width:70ch")}>
          <div className="card-kicker">Pixel</div>
          <div className="card-title">Pixels da Meta + Conversions API</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Cadastre um pixel, configure quais eventos disparar e gere o script para instalar no seu site.
          </p>
        </div>

        {/* Grade de cards + tile tracejado de adicionar no fim, igual à vitrine de
            perfis de Integrações › Anúncios. */}
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:var(--space-3);align-items:stretch")}>
        {pixels.map((px) => {
          const eventosAtivos = px.rules.filter((r) => r.enabled).length;
          // Pixel sem nenhum pixel da Meta, ou com todos sem token, NÃO envia nada
          // — e aparecia como "Ativo" na listagem. O único jeito de descobrir era
          // abrir a gaveta.
          const semDestino = px.metaPixels.length === 0 || px.metaPixels.every((m) => !m.hasToken);
          return (
            /* Item da grade é div com borda, NÃO `.card`: dentro de um `.card` o
               fundo seria o mesmo do pai e o cartão desapareceria. Igual a Webhooks. */
            <div
              key={px.id}
              style={sx(
                "border:1px solid var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-3);" +
                  "display:flex;flex-direction:column;gap:var(--space-3)",
              )}
            >
              <div style={sx("display:flex;align-items:flex-start;gap:8px")}>
                <span className="card-title" style={sx("font-size:15px;line-height:1.25;min-width:0;flex:1;word-break:break-word")}>
                  {px.name}
                </span>
                <span className={px.enabled ? "tag tag-accent" : "tag tag-neutral"} style={sx("flex:none")}>
                  {px.enabled ? "Ativo" : "Inativo"}
                </span>
              </div>

              <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)")}>
                <div>
                  <div style={sx("font-size:17px;font-variant-numeric:tabular-nums;line-height:1.1")}>{px.metaPixels.length}</div>
                  <div className="card-meta">{plural(px.metaPixels.length, "pixel da Meta", "pixels da Meta")}</div>
                </div>
                <div>
                  <div style={sx("font-size:17px;font-variant-numeric:tabular-nums;line-height:1.1")}>{eventosAtivos}</div>
                  <div className="card-meta">{plural(eventosAtivos, "evento ativo", "eventos ativos")}</div>
                </div>
              </div>

              {semDestino && (
                <div style={sx("display:flex;gap:7px;align-items:flex-start;font-size:11.5px;line-height:1.45;color:var(--color-warning,#fbbf24)")}>
                  <Icone nome="aviso" tamanho={13} cor="aviso" />
                  <span>
                    {px.metaPixels.length === 0
                      ? "Nenhum pixel da Meta — os eventos não chegam ao Facebook."
                      : "Falta conectar: sem token, os eventos não chegam ao Facebook."}
                  </span>
                </div>
              )}

              <div style={sx("display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:var(--space-2);border-top:1px solid var(--color-divider)")}>
                <Toggle on={px.enabled} onClick={() => toggle(px.id)} />
                <span style={sx("flex:1")} />
                <button className="btn btn-secondary" type="button" onClick={() => openEdit(px)}
                  style={sx("font-size:12px;padding:5px 10px;white-space:nowrap")}>
                  Editar / ver
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => remove(px.id)}
                  style={sx("font-size:12px;white-space:nowrap")}>
                  Remover
                </button>
              </div>
            </div>
          );
        })}

          <button
            type="button"
            onClick={openNew}
            style={sx(
              "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px;" +
                "border:1px dashed var(--color-accent);border-radius:var(--radius-md,12px);background:transparent;" +
                "color:var(--color-accent);cursor:pointer;padding:var(--space-3);text-align:center",
            )}
          >
            <span style={sx("font-size:28px;line-height:1")}>+</span>
            <span style={sx("font-size:13px")}>
              {pixels.length === 0 ? "Cadastrar seu primeiro pixel" : "Adicionar pixel"}
            </span>
          </button>
        </div>
      </div>

      <Drawer
        aberta={modalOpen}
        onClose={() => setModalOpen(false)}
        largura={560}
        titulo={editId ? "Editar Pixel" : "Adicionar Pixel"}
        descricao="Configure os pixels da Meta e quais eventos disparar. O script de instalação fica no fim desta gaveta."
        rodape={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy || form.metaPixels.length === 0}>
              {busy ? "Salvando…" : "Salvar dados"}
            </button>
          </>
        }
      >
        <>
              <div className="field">
                <label>Nome do pixel</label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Pixel principal" />
              </div>
              <div className="field">
                <label>Tipo</label>
                {/* Uma opção só: um select com um item é ruído. Quando entrar um segundo
                    provedor, isto volta a ser `<Select>`. */}
                <div className="input" style={sx("display:flex;align-items:center;opacity:.7;cursor:default")}>
                  Meta (Facebook)
                </div>
              </div>

              {/* Pixels da Meta */}
              <div style={sx("border:1px solid var(--color-border);border-radius:10px;padding:var(--space-3);display:flex;flex-direction:column;gap:8px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={sx("font-weight:600;font-size:13px")}>Pixels da Meta</span>
                  {!metaOpen && <button className="btn btn-secondary" type="button" onClick={() => setMetaOpen(true)} style={sx("padding:6px 10px;font-size:12px")}>Adicionar</button>}
                </div>
                {form.metaPixels.map((m, i) => (
                  <div key={i} style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;background:var(--color-bg);border-radius:8px;padding:8px 10px")}>
                    <span style={sx("font-family:ui-monospace,monospace")}>{m.pixelId}{m.nickname ? ` · ${m.nickname}` : ""}{m.accessToken ? " · conectado" : m.savedToken ? " · conectado" : " · falta conectar"}</span>
                    <button className="btn btn-ghost" type="button" onClick={() => removeMeta(i)} style={sx("padding:4px 8px;font-size:11px")}>remover</button>
                  </div>
                ))}
                {metaOpen && (
                  <div style={sx("display:flex;flex-direction:column;gap:8px;background:var(--color-bg);border-radius:8px;padding:10px")}>
                    <input className="input" placeholder="ID do pixel" value={meta.pixelId} onChange={(e) => setMeta({ ...meta, pixelId: e.target.value })} />
                    <input className="input" placeholder="Token de acesso do pixel" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} />
                    <input className="input" placeholder="Apelido (opcional)" value={meta.nickname} onChange={(e) => setMeta({ ...meta, nickname: e.target.value })} />
                    <div style={sx("display:flex;gap:8px;justify-content:flex-end")}>
                      <button className="btn btn-ghost" type="button" onClick={() => setMetaOpen(false)}>Fechar</button>
                      <button className="btn btn-primary" type="button" onClick={addMeta} disabled={!meta.pixelId.trim()}>Confirmar</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Regras simples */}
              <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                <div><div style={sx("font-weight:600;font-size:13px")}>Regra de Lead</div><div className="text-muted" style={sx("font-size:11.5px")}>Dispara no envio de formulários</div></div>
                <Toggle on={form.lead} onClick={() => setForm({ ...form, lead: !form.lead })} />
              </div>
              <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                <div><div style={sx("font-weight:600;font-size:13px")}>Regra de Add To Cart</div><div className="text-muted" style={sx("font-size:11.5px")}>Clique em botões de carrinho/comprar</div></div>
                <Toggle on={form.addToCart} onClick={() => setForm({ ...form, addToCart: !form.addToCart })} />
              </div>

              {/* Initiate Checkout */}
              <div style={sx("border:1px solid var(--color-border);border-radius:10px;padding:var(--space-3);display:flex;flex-direction:column;gap:8px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={sx("display:flex;align-items:center;gap:5px;font-weight:600;font-size:13px")}>
                    Regra de Initiate Checkout
                    <InfoTip conteudo={CONFIG.pixelIC!} tamanho={12} />
                  </span>
                  <Toggle on={form.ic.enabled} onClick={() => setForm({ ...form, ic: { ...form.ic, enabled: !form.ic.enabled } })} />
                </div>
                {form.ic.enabled && (
                  <>
                    <div className="field">
                      <label>Regra de detecção</label>
                      <Select
                        label=""
                        minWidth={290}
                        value={form.ic.type}
                        onChange={(vv) => setForm({ ...form, ic: { ...form.ic, type: vv as DetectionType } })}
                        options={[
                        { value: "clique_checkout", label: "Clique no link de checkout (recomendado)" },
                        { value: "contem_texto", label: "Contém texto" },
                        { value: "contem_css", label: "Contém CSS" },
                        { value: "contem_url", label: "Contém URL da página" },
                        ]}
                      />
                    </div>
                    <input className="input" value={form.ic.value} onChange={(e) => setForm({ ...form, ic: { ...form.ic, value: e.target.value } })}
                      placeholder={
                        form.ic.type === "clique_checkout" ? "Domínios do checkout, separados por vírgula (deixe vazio para os padrões)"
                        : form.ic.type === "contem_texto" ? "Ex.: COMPRAR AGORA"
                        : form.ic.type === "contem_css" ? "Ex.: .btn-checkout"
                        : "Ex.: /checkout"
                      } />
                    <p className="card-body" style={sx("margin:0;font-size:11.5px")}>
                      {form.ic.type === "clique_checkout" ? (
                        <>
                          Dispara quando o visitante clica num link que leva ao checkout, ainda no seu site.
                          Vazio já cobre Kirvano, Hotmart, Cartpanda, Kiwify e Monetizze.
                        </>
                      ) : form.ic.type === "contem_url" ? (
                        <span style={sx("color:var(--color-warning,#fbbf24)")}>
                          Este modo compara a URL da página onde o script está rodando. Se o seu checkout é
                          hospedado pelo gateway (ex.: <code>pay.kirvano.com</code>), não há como instalar o
                          script lá — use “Clique no link de checkout”.
                        </span>
                      ) : (
                        <>Dispara no clique em um elemento que casa com o valor acima, no seu site.</>
                      )}
                    </p>
                  </>
                )}
                <p className="card-body" style={sx("margin:0;font-size:11.5px")}>
                  Independente desta regra, todo pedido gerado e não pago que chega pelo webhook do gateway
                  (Pix/boleto gerado, carrinho abandonado) também entra como checkout iniciado — sem
                  duplicar quando o clique já foi capturado.
                </p>
              </div>

              {/* Purchase */}
              <div style={sx("border:1px solid var(--color-border);border-radius:10px;padding:var(--space-3);display:flex;flex-direction:column;gap:8px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={sx("font-weight:600;font-size:13px")}>Regra de Purchase</span>
                  <Toggle on={form.purchase.enabled} onClick={() => setForm({ ...form, purchase: { ...form.purchase, enabled: !form.purchase.enabled } })} />
                </div>
                {form.purchase.enabled && (
                  <>
                    <div className="field">
                      <label>Configuração de envio</label>
                      <Select
                        label=""
                        minWidth={210}
                        value={form.purchase.sendMode}
                        onChange={(vv) => setForm({ ...form, purchase: { ...form.purchase, sendMode: vv as "APENAS_APROVADAS" | "TODAS" } })}
                        options={[
                        { value: "APENAS_APROVADAS", label: "Apenas aprovadas" },
                        { value: "TODAS", label: "Aprovadas e pendentes" },
                        ]}
                      />
                    </div>
                    <div className="field">
                      <label>Valor do envio</label>
                      <Select
                        label=""
                        minWidth={210}
                        value={form.purchase.valueMode}
                        onChange={(vv) => setForm({ ...form, purchase: { ...form.purchase, valueMode: vv as "VALOR_DA_VENDA" | "VALOR_FIXO" } })}
                        options={[
                        { value: "VALOR_DA_VENDA", label: "Valor da venda" },
                        { value: "VALOR_FIXO", label: "Comissão (valor fixo)" },
                        ]}
                      />
                    </div>
                    {form.purchase.valueMode === "VALOR_FIXO" && (
                      <div className="field">
                        <label>Valor fixo (R$)</label>
                        <input className="input" inputMode="decimal" value={form.purchase.fixedValue} onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, fixedValue: e.target.value } })} placeholder="Ex.: 47.00" />
                      </div>
                    )}
                    <div className="field">
                      <label>Produto</label>
                      <Select
                        label=""
                        minWidth={230}
                        value={form.purchase.targetProduct}
                        onChange={(vv) => setForm({ ...form, purchase: { ...form.purchase, targetProduct: vv } })}
                        options={[{ value: "", label: "Todos os produtos" }, ...products.map((p) => ({ value: p, label: p }))]}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Quem envia cada evento para a Meta */}
              <div style={sx("border:1px solid var(--color-neutral-800);border-radius:var(--radius-md);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)")}>
                <div>
                  <span style={sx("font-weight:600;font-size:13px")}>Quem envia cada evento</span>
                  <div className="text-muted" style={sx("font-size:12px;margin-top:2px")}>
                    Quando o pixel da sua página ou o checkout do seu gateway mandam o
                    mesmo evento que nós, ele chega duas vezes na Meta e ela conta os
                    dois. Escolha um responsável por evento.
                  </div>
                </div>
                {EVENTOS_DO_PIXEL.map((ev) => {
                  const atual: DonoDoEvento = form.donos[ev] ?? padraoDoEvento(ev);
                  const nota = NOTA_DO_EVENTO[ev];
                  return (
                    <div key={ev} style={sx("display:flex;flex-direction:column;gap:4px;padding-bottom:var(--space-2);border-bottom:1px solid var(--color-neutral-800)")}>
                      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap")}>
                        <span style={sx("font-size:13px")}>{ev}</span>
                        <div style={sx("display:flex;gap:4px;flex-wrap:wrap")}>
                          {(["traffik", "navegador", "gateway", "ninguem"] as DonoDoEvento[]).map((d) => (
                            <button
                              key={d}
                              type="button"
                              className={atual === d ? "btn btn-primary" : "btn btn-secondary"}
                              style={sx("padding:2px 9px;font-size:11.5px")}
                              onClick={() => setForm({ ...form, donos: { ...form.donos, [ev]: d } })}
                            >
                              {ROTULO_DONO[d]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-muted" style={sx("font-size:11.5px")}>{EXPLICACAO_DONO[atual]}</div>
                      {nota && (
                        <div style={sx("font-size:11.5px;color:var(--color-warning,#fbbf24);border-left:2px solid var(--color-warning,#fbbf24);padding-left:8px")}>
                          {nota}
                        </div>
                      )}
                    </div>
                  );
                })}
                {Object.values(form.donos).some((d) => d === "gateway") && (
                  <div style={sx("font-size:12px;color:var(--color-warning,#fbbf24);border-left:2px solid var(--color-warning,#fbbf24);padding-left:8px")}>
                    Só escolha &ldquo;O checkout do gateway&rdquo; se ele tiver API de Conversões
                    configurada — senão o evento deixa de ser enviado pelo servidor, e passa
                    a depender do navegador do comprador.
                  </div>
                )}
                {Object.values(form.donos).some((d) => d === "ninguem") && (
                  <div className="text-muted" style={sx("font-size:12px")}>
                    Evento com &ldquo;Ninguém&rdquo; não vai para a Meta. Ele continua sendo
                    registrado aqui e aparece normalmente no seu funil e no painel.
                  </div>
                )}
              </div>

          {error && <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{error}</p>}
        </>

        {/* Script na própria gaveta: fora dela, nada de despejar código na tela. */}
        {editId && (() => {
          const px = pixels.find((p) => p.id === editId);
          if (!px) return null;
          const codigo = scriptText(px);
          const local = getPublicAppUrl().includes("localhost");
          return (
            <div style={sx("border-top:1px solid var(--color-divider);padding-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)")}>
              <div style={sx("font-weight:600;font-size:13px")}>Script de instalação</div>
              <AvisoSnippet check={check} />
              <p className="card-body" style={sx("margin:0;font-size:12px")}>
                Cole antes de <code>&lt;/head&gt;</code> do seu site (ou no campo de script do seu
                gateway/checkout). Dispara PageView em toda página, mais os eventos habilitados acima.
              </p>
              {local && (
                <p className="card-body" style={sx("margin:0;font-size:12px;color:var(--color-warning,#fbbf24)")}>
                  O script aponta para <code>{getPublicAppUrl()}</code>, um endereço local. Defina{" "}
                  <code>NEXT_PUBLIC_APP_URL</code> com o domínio de produção e copie de novo antes de instalar.
                </p>
              )}
              <SnippetBox codigo={codigo} />
            </div>
          );
        })()}
      </Drawer>

    </div>
  );
}
