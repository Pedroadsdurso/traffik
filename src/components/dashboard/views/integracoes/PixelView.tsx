"use client";

import { useEffect, useState } from "react";

import {
  createPixel,
  deletePixel,
  listPixels,
  listTrackedProducts,
  togglePixel,
  updatePixel,
  type DetectionType,
  type PixelConfigDTO,
  type PixelFormInput,
} from "@/lib/actions/pixels";
import { getPublicAppUrl } from "@/lib/appUrl";
import { pixelScript } from "@/lib/pixel/script";
import { sx } from "@/lib/sx";
import { Drawer } from "../../ui/Drawer";

/** `savedToken` marca um pixel já persistido cujo token fica no servidor (nunca volta ao cliente). */
type MetaDraft = { pixelId: string; accessToken: string; nickname: string; savedToken?: boolean };
type Form = {
  name: string;
  metaPixels: MetaDraft[];
  lead: boolean;
  addToCart: boolean;
  ic: { enabled: boolean; type: DetectionType; value: string };
  purchase: { enabled: boolean; sendMode: string; valueMode: string; fixedValue: string; targetProduct: string };
};

const EMPTY_FORM: Form = {
  name: "",
  metaPixels: [],
  lead: false,
  addToCart: false,
  ic: { enabled: false, type: "contem_texto", value: "" },
  purchase: { enabled: true, sendMode: "APENAS_APROVADAS", valueMode: "VALOR_DA_VENDA", fixedValue: "", targetProduct: "" },
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
    ic: { enabled: ic?.enabled ?? false, type: (ic?.detectionType as DetectionType) ?? "contem_texto", value: ic?.detectionValue ?? "" },
    purchase: {
      enabled: pu?.enabled ?? true,
      sendMode: pu?.sendMode ?? "APENAS_APROVADAS",
      valueMode: pu?.valueMode ?? "VALOR_DA_VENDA",
      fixedValue: pu?.fixedValue != null ? String(pu.fixedValue) : "",
      targetProduct: pu?.targetProduct ?? "",
    },
  };
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className="sw" role="switch" aria-checked={on} onClick={onClick} type="button" />;
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
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    listPixels().then(setPixels).catch(() => {});
    listTrackedProducts().then(setProducts).catch(() => {});
  }, []);

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
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:920px")}>
      <div className="card">
        <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
          <div>
            <div className="card-kicker">Pixel</div>
            <div className="card-title">Pixels da Meta + Conversions API</div>
            <p className="card-body" style={sx("margin:4px 0 0")}>
              Cadastre um pixel, configure quais eventos disparar e gere o script para instalar no seu site.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={openNew} style={sx("white-space:nowrap")}>
            + Adicionar Pixel
          </button>
        </div>
      </div>

      {pixels.length === 0 ? (
        <div className="card text-muted" style={sx("font-size:13px")}>Nenhum pixel cadastrado ainda.</div>
      ) : (
        pixels.map((px) => (
          <div className="card" key={px.id}>
            <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
              <div>
                <div style={sx("display:flex;align-items:center;gap:8px")}>
                  <span className="card-title" style={sx("font-size:15px")}>{px.name}</span>
                  <span className={px.enabled ? "tag tag-accent" : "tag tag-neutral"}>{px.enabled ? "Ativo" : "Inativo"}</span>
                </div>
                <div className="card-meta">
                  {px.metaPixels.length} pixel(s) da Meta ·{" "}
                  {px.rules.filter((r) => r.enabled).length} evento(s) ativo(s)
                </div>
              </div>
              <div style={sx("display:flex;align-items:center;gap:10px")}>
                <Toggle on={px.enabled} onClick={() => toggle(px.id)} />
                <button className="btn btn-secondary" type="button" onClick={() => openEdit(px)}>Editar / ver</button>
                <button className="btn btn-ghost" type="button" onClick={() => remove(px.id)}>Remover</button>
              </div>
            </div>
          </div>
        ))
      )}

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
                <select className="input" value="META" disabled>
                  <option value="META">Meta (Facebook)</option>
                </select>
              </div>

              {/* Pixels da Meta */}
              <div style={sx("border:1px solid var(--color-border);border-radius:10px;padding:var(--space-3);display:flex;flex-direction:column;gap:8px")}>
                <div style={sx("display:flex;align-items:center;justify-content:space-between")}>
                  <span style={sx("font-weight:600;font-size:13px")}>Pixels da Meta</span>
                  {!metaOpen && <button className="btn btn-secondary" type="button" onClick={() => setMetaOpen(true)} style={sx("padding:6px 10px;font-size:12px")}>Adicionar</button>}
                </div>
                {form.metaPixels.map((m, i) => (
                  <div key={i} style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;background:var(--color-bg);border-radius:8px;padding:8px 10px")}>
                    <span style={sx("font-family:ui-monospace,monospace")}>{m.pixelId}{m.nickname ? ` · ${m.nickname}` : ""}{m.accessToken ? " · token" : m.savedToken ? " · token salvo" : " · sem token"}</span>
                    <button className="btn btn-ghost" type="button" onClick={() => removeMeta(i)} style={sx("padding:4px 8px;font-size:11px")}>remover</button>
                  </div>
                ))}
                {metaOpen && (
                  <div style={sx("display:flex;flex-direction:column;gap:8px;background:var(--color-bg);border-radius:8px;padding:10px")}>
                    <input className="input" placeholder="ID do pixel" value={meta.pixelId} onChange={(e) => setMeta({ ...meta, pixelId: e.target.value })} />
                    <input className="input" placeholder="Token de acesso (CAPI)" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} />
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
                  <span style={sx("font-weight:600;font-size:13px")}>Regra de Initiate Checkout</span>
                  <Toggle on={form.ic.enabled} onClick={() => setForm({ ...form, ic: { ...form.ic, enabled: !form.ic.enabled } })} />
                </div>
                {form.ic.enabled && (
                  <>
                    <div className="field">
                      <label>Regra de detecção</label>
                      <select className="input" value={form.ic.type} onChange={(e) => setForm({ ...form, ic: { ...form.ic, type: e.target.value as DetectionType } })}>
                        <option value="contem_texto">Contém texto</option>
                        <option value="contem_css">Contém CSS</option>
                        <option value="contem_url">Contém URL</option>
                      </select>
                    </div>
                    <input className="input" value={form.ic.value} onChange={(e) => setForm({ ...form, ic: { ...form.ic, value: e.target.value } })}
                      placeholder={form.ic.type === "contem_texto" ? "Ex.: COMPRAR AGORA" : form.ic.type === "contem_css" ? "Ex.: .btn-checkout" : "Ex.: /checkout"} />
                  </>
                )}
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
                      <select className="input" value={form.purchase.sendMode} onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, sendMode: e.target.value } })}>
                        <option value="APENAS_APROVADAS">Apenas aprovadas</option>
                        <option value="TODAS">Aprovadas e pendentes</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Valor do envio</label>
                      <select className="input" value={form.purchase.valueMode} onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, valueMode: e.target.value } })}>
                        <option value="VALOR_DA_VENDA">Valor da venda</option>
                        <option value="VALOR_FIXO">Comissão (valor fixo)</option>
                      </select>
                    </div>
                    {form.purchase.valueMode === "VALOR_FIXO" && (
                      <div className="field">
                        <label>Valor fixo (R$)</label>
                        <input className="input" inputMode="decimal" value={form.purchase.fixedValue} onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, fixedValue: e.target.value } })} placeholder="Ex.: 47.00" />
                      </div>
                    )}
                    <div className="field">
                      <label>Produto</label>
                      <select className="input" value={form.purchase.targetProduct} onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, targetProduct: e.target.value } })}>
                        <option value="">Todos os produtos</option>
                        {products.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </>
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
              <p className="card-body" style={sx("margin:0;font-size:12px")}>
                Cole antes do <code>&lt;/head&gt;</code> do seu site. Os eventos vão para{" "}
                <code style={sx("font-family:ui-monospace,monospace")}>{getPublicAppUrl()}</code>
                {local && (
                  <span style={sx("color:var(--color-warning,#fbbf24)")}>
                    {" "}— endereço local. Defina <code>NEXT_PUBLIC_APP_URL</code> com o domínio de produção
                    e gere o script de novo antes de instalar.
                  </span>
                )}
              </p>
              <pre style={sx("background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:10.5px;font-family:ui-monospace,monospace;overflow:auto;max-height:220px;margin:0")}>
                {codigo}
              </pre>
              <button className="btn btn-secondary" type="button" style={sx("align-self:flex-start")}
                onClick={() => { navigator.clipboard.writeText(codigo); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
                {copied ? "Copiado!" : "Copiar script"}
              </button>
            </div>
          );
        })()}
      </Drawer>

    </div>
  );
}
