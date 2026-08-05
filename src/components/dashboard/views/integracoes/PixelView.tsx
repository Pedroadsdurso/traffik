"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

import {
  conferirSnippet,
  createPixel,
  deletePixel,
  gatewaysComPixelProprio,
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
import { EXEMPLOS_DE_TRECHO, analisarTrecho } from "@/lib/pixel/trechoUrl";
import { PASSOS_CHECKOUT_PROPRIO } from "@/lib/pixel/checkoutProprio";
import {
  EVENTOS_DO_PIXEL,
  EXPLICACAO_DONO,
  ROTULO_DONO,
  donoDoEvento,
  type DonoDoEvento,
  type MapaDeDonos,
} from "@/lib/pixel/donos";
import {
  REGRA_DE_CHECKOUT,
  donosDoPreset,
  seguePreset,
  type OndeSePaga,
  type PresetPixel,
} from "@/lib/pixel/preset";
import { Select } from "../../ui/Select";
import { Checkbox } from "../../ui/Checkbox";
import { Icone } from "../../ui/Icone";
import { InfoTip } from "../../ui/InfoTip";
import { Drawer } from "../../ui/Drawer";
import { Secao as SecaoBase, type SeloDeRegiao } from "../../ui/Secao";
import { SnippetBox } from "../../ui/SnippetBox";

/** `savedToken` marca um pixel já persistido cujo token fica no servidor (nunca volta ao cliente). */
type MetaDraft = { pixelId: string; accessToken: string; nickname: string; savedToken?: boolean };
type Form = {
  name: string;
  metaPixels: MetaDraft[];
  /** A pergunta do preset. Decide os donos E o comportamento do script. */
  temPixelNativo: boolean;
  /** 2ª pergunta do preset: alguem mais ja envia o Purchase? Decide so o dono. */
  outroEnviaPurchase: boolean;
  lead: boolean;
  addToCart: boolean;
  ic: { enabled: boolean; type: DetectionType; value: string };
  purchase: { enabled: boolean; sendMode: string; valueMode: string; fixedValue: string; targetProduct: string };
  /** Quem envia cada evento para a Meta. Derivado do preset, ajustável no avançado. */
  donos: MapaDeDonos;
};

const EMPTY_FORM: Form = {
  name: "",
  metaPixels: [],
  // O caso comum: infoprodutor com o pixel do Facebook já na página.
  temPixelNativo: true,
  lead: false,
  addToCart: false,
  ic: { enabled: true, type: "clique_checkout", value: "" },
  purchase: { enabled: true, sendMode: "APENAS_APROVADAS", valueMode: "VALOR_DA_VENDA", fixedValue: "", targetProduct: "" },
  outroEnviaPurchase: false,
  // `ondeSePaga` não entra no mapa de donos — ele decide a regra de detecção,
  // não quem envia. Vai aqui só para satisfazer o preset completo.
  donos: donosDoPreset({ temPixelNativo: true, outroEnviaPurchase: false, ondeSePaga: "gateway" }),
};

function formToInput(f: Form): PixelFormInput {
  return {
    name: f.name,
    metaPixels: f.metaPixels
      .filter((m) => m.pixelId.trim())
      .map((m) => ({ pixelId: m.pixelId, accessToken: m.accessToken, nickname: m.nickname })),
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
    preset: {
      temPixelNativo: f.temPixelNativo,
      outroEnviaPurchase: f.outroEnviaPurchase,
      // ⚠️ DERIVADO da regra, não um campo próprio do formulário. A regra é o
      // que fica gravado; um segundo estado para a mesma resposta divergiria
      // dela no primeiro ajuste pelo avançado.
      ondeSePaga: ondePaga(f.ic.type),
    },
  };
}

/** "Cakto" · "Cakto e Kirvano" · "Cakto, Kirvano e Hotmart". */
function listaEm(nomes: string[]): string {
  if (nomes.length <= 1) return nomes[0] ?? "";
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/** A resposta de "onde o comprador paga", lida da regra de detecção. */
function ondePaga(tipo: DetectionType): OndeSePaga {
  return tipo === "contem_url" ? "proprio_site" : "gateway";
}

/**
 * A regra é um dos dois modos manuais do avançado?
 *
 * A pergunta descreve `clique_checkout` e `contem_url`. `contem_texto` e
 * `contem_css` não são nenhum dos dois — e marcar um dos botões assim mesmo
 * seria a tela afirmando uma resposta que o usuário não deu. Ela diz isso.
 */
function regraManual(tipo: DetectionType): boolean {
  return tipo !== "clique_checkout" && tipo !== "contem_url";
}

function dtoToForm(px: PixelConfigDTO): Form {
  const ic = px.rules.find((r) => r.eventType === "INITIATE_CHECKOUT");
  const pu = px.rules.find((r) => r.eventType === "PURCHASE");
  return {
    name: px.name,
    metaPixels: px.metaPixels.map((m) => ({ pixelId: m.pixelId, accessToken: "", nickname: m.nickname ?? "", savedToken: m.hasToken })),
    temPixelNativo: px.preset.temPixelNativo,
    outroEnviaPurchase: px.preset.outroEnviaPurchase,
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
 * Os dois selos de região desta gaveta. O componente é o `ui/Secao`
 * compartilhado — ver lá a regra de que **o selo é da REGIÃO, nunca do campo**.
 *
 * ⚠️ Ao mover um campo de bloco, confira em qual lado ele cai: um campo que
 * muda o script parado num bloco `hora` faz o selo mentir.
 */
const SELO: Record<"script" | "hora", SeloDeRegiao> = {
  script: {
    texto: "⟳ muda o script",
    ajuda: "Mexer aqui muda o código do script. Depois de salvar, copie e substitua o que está no seu site.",
    tom: "aviso",
  },
  hora: {
    texto: "⚡ vale na hora",
    ajuda: "Vale assim que você salvar. Não precisa mexer no script instalado.",
  },
};

function Secao({ titulo, selo, children }: { titulo: string; selo?: "script" | "hora"; children: ReactNode }) {
  return (
    <SecaoBase titulo={titulo} selo={selo && SELO[selo]}>
      {children}
    </SecaoBase>
  );
}

/**
 * O script instalado bate com o que está configurado aqui?
 *
 * 🔴 Existe porque a divergência mais cara é MUDA: regra ligada na gaveta +
 * snippet velho no site = nenhum evento, e a tela dizia que estava tudo certo.
 * Ver `lib/pixel/detectores.ts`.
 */
/**
 * Os passos que só o desenvolvedor da página pode dar.
 *
 * 🔴 O script resolve o InitiateCheckout; ele NÃO resolve a atribuição. Quem
 * cria a cobrança é o site, e é lá que o `click_id` e o IP do comprador
 * entram. Sem eles a venda entra sem campanha e sem país — e continua
 * aparecendo no faturamento, que é o que impede alguém de perceber.
 */
function PassosCheckoutProprio() {
  return (
    <div
      style={sx(
        "margin-top:var(--space-3);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:var(--space-3)",
      )}
    >
      <div className="card-kicker">Para o desenvolvedor do seu site</div>
      <div className="card-title" style={sx("font-size:14px")}>Faltam dois envios ao criar a cobrança</div>
      <p className="card-body text-muted" style={sx("margin:4px 0 var(--space-3);font-size:11.5px;line-height:1.5")}>
        O script acima cuida do que acontece no navegador. Estes dois passos acontecem no seu
        código, na hora de criar a cobrança no gateway — repasse esta parte para quem cuida do site.
      </p>
      {PASSOS_CHECKOUT_PROPRIO.map((passo) => (
        <div key={passo.titulo} style={sx("margin-bottom:var(--space-3)")}>
          <div style={sx("font-size:12.5px;font-weight:600")}>{passo.titulo}</div>
          <div className="text-muted" style={sx("font-size:11.5px;line-height:1.5;margin-top:2px")}>
            <strong>Sem isso:</strong> {passo.semIsso}
          </div>
          {passo.atencao && (
            <div
              style={sx(
                "font-size:11.5px;line-height:1.5;margin-top:4px;color:var(--color-warning,#fbbf24)",
              )}
            >
              {passo.atencao}
            </div>
          )}
          {passo.codigo && <SnippetBox codigo={passo.codigo} />}
        </div>
      ))}
    </div>
  );
}

/**
 * O estado real de CADA evento.
 *
 * 🔴 É o que faltava quando o InitiateCheckout ficou morto: a gaveta dizia
 * "último evento recebido há 5min" — verdade, era o PageView — enquanto o IC
 * não disparava havia semanas. Um agregado esconde justamente o que parou.
 *
 * ⚠️ Só alarma o evento LIGADO e nunca recebido. Evento desligado sem registro
 * é o esperado, e pintá-lo de âmbar treinaria a ignorar o aviso.
 */
function EstadoPorEvento({ check }: { check: SnippetCheckDTO | null }) {
  if (!check || check.porEvento.length === 0) return null;
  const ligados = check.porEvento.filter((e) => e.ligado);
  if (ligados.length === 0) return null;

  return (
    <div style={sx("margin-top:var(--space-3)")}>
      <div className="card-kicker">O que está chegando</div>
      <div style={sx("display:flex;flex-direction:column;gap:4px;margin-top:6px")}>
        {ligados.map((e) => {
          const mudo = e.visto === null;
          return (
            <div
              key={e.evento}
              style={sx(
                "display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12px",
              )}
            >
              <span>{e.evento}</span>
              <span
                style={sx(
                  mudo
                    ? "color:var(--color-warning,#fbbf24);font-size:11.5px"
                    : "color:var(--color-text-muted,#9ca3af);font-size:11.5px",
                )}
              >
                {mudo
                  ? "nunca recebido"
                  : `há ${elapsed(new Date(e.visto!).getTime())} · ${e.total}`}
              </span>
            </div>
          );
        })}
      </div>
      {ligados.some((e) => e.visto === null) && (
        <p
          className="card-body"
          style={sx("margin:6px 0 0;font-size:11.5px;color:var(--color-warning,#fbbf24)")}
        >
          Evento ligado aqui e nunca recebido costuma ser script ausente na página onde ele deveria
          disparar — ou o trecho do endereço não casando com a URL real.
        </p>
      )}
    </div>
  );
}

function AvisoSnippet({ check }: { check: SnippetCheckDTO | null }) {
  if (!check) return null;

  const quando = check.visto ? `Último evento recebido ${elapsed(new Date(check.visto).getTime())}.` : "";

  // Elemento, não componente: um componente declarado dentro do render é criado
  // de novo a cada passagem, e o React remonta a subárvore inteira.
  const nota = check.nota ? (
    <div className="text-muted" style={sx("font-size:11.5px;line-height:1.45")}>{check.nota}</div>
  ) : null;

  if (check.estado === "ok") {
    return (
      <div style={sx("display:flex;flex-direction:column;gap:4px")}>
        <div className="text-muted" style={sx("display:flex;gap:7px;align-items:flex-start;font-size:11.5px;line-height:1.45")}>
          <Icone nome="ok" tamanho={13} />
          <span>O script instalado no seu site corresponde a esta configuração. {quando}</span>
        </div>
        {nota}
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
      {nota}
    </div>
  );
}

/**
 * 🔴 **Recebe o `workspaceId`.** `listPixels` é escopado por área e caía no
 * `getLastWorkspaceId()` do servidor; com a busca presa à montagem, trocar de
 * área com esta aba aberta continuava listando os pixels da área ANTERIOR —
 * `router.refresh()` re-renderiza o servidor mas **preserva estado de
 * componente cliente**. Quem refaz a consulta é a prop nas dependências.
 *
 * ⚠️ `listTrackedProducts` é global de propósito (é o seletor de produto do
 * Purchase, e uma venda não pertence a uma área de configuração). Ela viaja no
 * mesmo efeito só por conveniência — a refetch extra é inofensiva.
 */
export function PixelView({ workspaceId }: { workspaceId: string | null }) {
  const [pixels, setPixels] = useState<PixelConfigDTO[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [meta, setMeta] = useState<MetaDraft>({ pixelId: "", accessToken: "", nickname: "" });
  const [metaOpen, setMetaOpen] = useState(false);
  const [avancado, setAvancado] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<SnippetCheckDTO | null>(null);
  /**
   * Gateways conectados que têm painel de pixel próprio — os que podem estar
   * disparando `Purchase` por conta. Vem do REGISTRO, nunca de um `if` por
   * plataforma. Ver `gatewaysComPixelProprio`.
   */
  const [comPixelProprio, setComPixelProprio] = useState<string[]>([]);

  useEffect(() => {
    listPixels(workspaceId).then(setPixels).catch(() => {});
    listTrackedProducts().then(setProducts).catch(() => {});
    gatewaysComPixelProprio(workspaceId).then(setComPixelProprio).catch(() => {});
  }, [workspaceId]);

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

  function abrir(px: PixelConfigDTO | null) {
    setForm(px ? dtoToForm(px) : EMPTY_FORM);
    setEditId(px?.id ?? null);
    setMeta({ pixelId: "", accessToken: "", nickname: "" });
    setMetaOpen(false);
    setAvancado(false);
    setError(null);
    setModalOpen(true);
  }

  /**
   * A resposta do preset reescreve o mapa de donos.
   *
   * ⚠️ Ela **sobrescreve ajuste manual**, de propósito: responder de novo é um
   * pedido explícito de "reconfigure para este caso". Preservar o ajuste antigo
   * deixaria o usuário numa combinação que ele não escolheu e não vê, que é
   * exatamente o estado que esta reforma existe para eliminar. O caminho de
   * volta é o `↩ voltar ao padrão` do avançado.
   */
  function responderPreset(patch: Partial<Omit<PresetPixel, "ondeSePaga">>) {
    setForm((f) => {
      const preset: PresetPixel = {
        temPixelNativo: f.temPixelNativo,
        outroEnviaPurchase: f.outroEnviaPurchase,
        ondeSePaga: ondePaga(f.ic.type),
        ...patch,
      };
      return { ...f, ...preset, donos: donosDoPreset(preset) };
    });
  }

  /**
   * "Onde o comprador paga" — a resposta É a regra de detecção.
   *
   * ⚠️ O valor é LIMPO ao trocar: uma lista de domínios de checkout e um trecho
   * de URL da própria página não são a mesma coisa, e carregar o valor antigo
   * produziria uma regra que casa com nada (ou, pior, com tudo).
   */
  function responderOndePaga(onde: OndeSePaga) {
    setForm((f) =>
      ondePaga(f.ic.type) === onde && !regraManual(f.ic.type)
        ? f
        : { ...f, ic: { ...f.ic, type: REGRA_DE_CHECKOUT[onde], value: "" } },
    );
  }

  function addMeta() {
    if (!meta.pixelId.trim()) return;
    setForm((f) => ({ ...f, metaPixels: [...f.metaPixels, meta] }));
    setMeta({ pixelId: "", accessToken: "", nickname: "" });
    setMetaOpen(false);
  }
  function patchMeta(i: number, campo: keyof MetaDraft, valor: string) {
    setForm((f) => ({
      ...f,
      metaPixels: f.metaPixels.map((m, j) => (j === i ? { ...m, [campo]: valor } : m)),
    }));
  }
  function removeMeta(i: number) {
    setForm((f) => ({ ...f, metaPixels: f.metaPixels.filter((_, j) => j !== i) }));
  }

  const temPixel = form.metaPixels.some((m) => m.pixelId.trim());

  async function save() {
    if (!temPixel) {
      setError("Informe o ID do pixel da Meta.");
      return;
    }
    /**
     * ⚠️ O vazio não é o único jeito de casar com tudo.
     *
     * `/` e o próprio domínio produzem exatamente o mesmo estrago que a string
     * vazia — `location.href` sempre contém o host —, e a trava antiga só via
     * `!trim()`. Quem digitasse `meusite.com` salvava, e toda visita virava
     * checkout iniciado, em silêncio.
     */
    if (form.ic.enabled && form.ic.type === "contem_url") {
      const a = analisarTrecho(form.ic.value);
      if (a.grau === "vazio" || a.grau === "largo") {
        setError(a.aviso ?? "Informe um trecho do endereço da página de pagamento.");
        return;
      }
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
      temPixelNativo: px.preset.temPixelNativo,
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

  const primeiro = form.metaPixels[0];
  const noPadrao = seguePreset(
    {
      temPixelNativo: form.temPixelNativo,
      outroEnviaPurchase: form.outroEnviaPurchase,
      ondeSePaga: ondePaga(form.ic.type),
    },
    form.donos,
  );

  /**
   * A regra de URL sem trecho para comparar casa com TUDO.
   *
   * Travar o Salvar é o mesmo padrão do teto de orçamento obrigatório nas
   * Regras: o script já guarda contra isso e não dispararia, mas deixar salvar
   * criaria uma configuração que nunca funciona e não diz por quê.
   */
  const urlSemTrecho =
    form.ic.enabled &&
    form.ic.type === "contem_url" &&
    ["vazio", "largo"].includes(analisarTrecho(form.ic.value).grau);

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div className="card" style={sx("gap:var(--space-3)")}>
        <div style={sx("max-width:70ch")}>
          <div className="card-kicker">Pixel</div>
          <div className="card-title">Pixels da Meta + Conversions API</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Cadastre um pixel, configure quais eventos disparar e gere o script para instalar no seu site.
          </p>
        </div>

        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(265px,1fr));gap:var(--space-3);align-items:stretch")}>
          {pixels.map((px) => {
            const eventosAtivos = px.rules.filter((r) => r.enabled).length;
            const semDestino = px.metaPixels.length === 0 || px.metaPixels.every((m) => !m.hasToken);
            return (
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
                        : "Falta conectar — os eventos não chegam ao Facebook."}
                    </span>
                  </div>
                )}

                <div style={sx("display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:var(--space-2);border-top:1px solid var(--color-divider)")}>
                  <Toggle on={px.enabled} onClick={() => toggle(px.id)} />
                  <span style={sx("flex:1")} />
                  <button className="btn btn-secondary" type="button" onClick={() => abrir(px)}
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
            onClick={() => abrir(null)}
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
        descricao="Informe o pixel, responda uma pergunta sobre o seu site e copie o script."
        rodape={
          <>
            <button className="btn btn-secondary" type="button" onClick={() => setModalOpen(false)}>Cancelar</button>
            <button className="btn btn-primary" type="button" onClick={save} disabled={busy || !temPixel || urlSemTrecho}>
              {busy ? "Salvando…" : "Salvar"}
            </button>
          </>
        }
      >
        {/* ─────────────── 1. Dados do pixel — vale na hora ─────────────── */}
        {/* O campo "Tipo: Meta (Facebook)" saiu: era um select de uma opção só. */}
        <Secao titulo="Dados do pixel" selo="hora">
          <div className="field">
            <label>Nome</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Pixel principal" />
          </div>
          <div className="field">
            <label>ID do pixel</label>
            <input
              className="input"
              value={primeiro?.pixelId ?? ""}
              onChange={(e) =>
                primeiro
                  ? patchMeta(0, "pixelId", e.target.value)
                  : setForm((f) => ({ ...f, metaPixels: [{ pixelId: e.target.value, accessToken: "", nickname: "" }] }))
              }
              placeholder="Ex.: 1234567890123456"
            />
          </div>
          <div className="field">
            <label>Token da Conversions API</label>
            <input
              className="input"
              value={primeiro?.accessToken ?? ""}
              onChange={(e) => primeiro && patchMeta(0, "accessToken", e.target.value)}
              disabled={!primeiro}
              /* O token nunca volta do servidor: campo vazio num pixel salvo
                 significa "continua o mesmo", não "sem token". */
              placeholder={primeiro?.savedToken ? "•••••••••  conectado (deixe em branco para manter)" : "Cole o token gerado no Gerenciador de Eventos"}
            />
          </div>

          {form.metaPixels.slice(1).map((m, i) => (
            <div key={i + 1} style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;background:var(--color-bg);border-radius:8px;padding:8px 10px")}>
              <span style={sx("font-family:ui-monospace,monospace")}>
                {m.pixelId}{m.nickname ? ` · ${m.nickname}` : ""}{m.accessToken || m.savedToken ? " · conectado" : " · falta conectar"}
              </span>
              <button className="btn btn-ghost" type="button" onClick={() => removeMeta(i + 1)} style={sx("padding:4px 8px;font-size:11px")}>remover</button>
            </div>
          ))}

          {metaOpen ? (
            <div style={sx("display:flex;flex-direction:column;gap:8px;background:var(--color-bg);border-radius:8px;padding:10px")}>
              <input className="input" placeholder="ID do pixel" value={meta.pixelId} onChange={(e) => setMeta({ ...meta, pixelId: e.target.value })} />
              <input className="input" placeholder="Token da Conversions API" value={meta.accessToken} onChange={(e) => setMeta({ ...meta, accessToken: e.target.value })} />
              <input className="input" placeholder="Apelido (opcional)" value={meta.nickname} onChange={(e) => setMeta({ ...meta, nickname: e.target.value })} />
              <div style={sx("display:flex;gap:8px;justify-content:flex-end")}>
                <button className="btn btn-ghost" type="button" onClick={() => setMetaOpen(false)}>Fechar</button>
                <button className="btn btn-primary" type="button" onClick={addMeta} disabled={!meta.pixelId.trim()}>Confirmar</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost" type="button" onClick={() => setMetaOpen(true)} style={sx("align-self:flex-start;padding:4px 0;font-size:12px")}>
              + adicionar outro pixel da Meta
            </button>
          )}
        </Secao>

        {/* ─────────────── 2. Preset + eventos — muda o script ─────────────── */}
        <Secao titulo="Como é o seu site" selo="script">
          <div>
            <div style={sx("font-size:13px;font-weight:600;margin-bottom:6px")}>
              O código do Facebook (pixel) está instalado nesta página?
            </div>
            <div style={sx("display:flex;flex-direction:column;gap:4px")}>
              <Checkbox
                tipo="radio"
                checked={form.temPixelNativo}
                onChange={() => responderPreset({ temPixelNativo: true })}
                label="Sim, já tenho o pixel do Facebook no site"
                dica="Deixamos a visita (PageView) com ele e mandamos os outros eventos pelo nosso servidor, com o mesmo identificador. Assim a Meta conta uma conversão, não duas."
              />
              <Checkbox
                tipo="radio"
                checked={!form.temPixelNativo}
                onChange={() => responderPreset({ temPixelNativo: false })}
                label="Não, só a Trackhub vai enviar"
                dica="Enviamos tudo pelo nosso servidor, inclusive a visita. Chega mesmo com bloqueador de anúncios."
              />
            </div>
          </div>

          <div style={sx("margin-top:var(--space-2)")}>
            <div style={sx("font-size:13px;font-weight:600;margin-bottom:6px")}>Registrar também</div>
            <div style={sx("display:flex;flex-direction:column;gap:4px")}>
              <Checkbox
                checked={form.ic.enabled}
                onChange={(v) => setForm({ ...form, ic: { ...form.ic, enabled: v } })}
                label={
                  <span style={sx("display:inline-flex;align-items:center;gap:5px")}>
                    Início de checkout
                    <InfoTip conteudo={CONFIG.pixelIC!} tamanho={12} />
                  </span>
                }
                dica="Quando o visitante clica no link que leva ao pagamento."
              />
              <Checkbox
                checked={form.lead}
                onChange={(v) => setForm({ ...form, lead: v })}
                label="Lead"
                dica="Quando alguém envia um formulário na página."
              />
              <Checkbox
                checked={form.addToCart}
                onChange={(v) => setForm({ ...form, addToCart: v })}
                label="Carrinho"
                dica="Clique em botões com cara de carrinho. Só faz sentido se o seu site tiver carrinho."
              />
            </div>
          </div>

          {/*
            ── Onde o comprador paga ──

            🔴 Esta pergunta existe porque escolher errado NÃO dá erro: dá zero
            InitiateCheckout, para sempre. Ela fica aqui, colada no checkbox que
            ela faz funcionar, e não no avançado, porque é um fato sobre o
            negócio do usuário — ele responde sem saber o que é um detector.
          */}
          {form.ic.enabled && (
            <div style={sx("margin-top:var(--space-2);padding-left:var(--space-3);border-left:2px solid var(--color-divider)")}>
              <div style={sx("font-size:13px;font-weight:600;margin-bottom:6px")}>
                Onde o comprador paga?
              </div>
              <div style={sx("display:flex;flex-direction:column;gap:4px")}>
                <Checkbox
                  tipo="radio"
                  checked={!regraManual(form.ic.type) && ondePaga(form.ic.type) === "gateway"}
                  onChange={() => responderOndePaga("gateway")}
                  label="Em outro site (Kirvano, Hotmart, Cakto…)"
                  dica="A página de pagamento é do gateway, então não dá para instalar nada nela. Registramos o clique no link que leva até lá."
                />
                <Checkbox
                  tipo="radio"
                  checked={!regraManual(form.ic.type) && ondePaga(form.ic.type) === "proprio_site"}
                  onChange={() => responderOndePaga("proprio_site")}
                  label="No meu próprio site"
                  dica="A página de pagamento é sua e tem este script. Registramos quando ela é aberta."
                />
              </div>

              {ondePaga(form.ic.type) === "proprio_site" && !regraManual(form.ic.type) && (
                <div className="field" style={sx("margin-top:var(--space-2)")}>
                  <label>Um trecho do endereço da página de pagamento</label>
                  <input
                    className="input"
                    value={form.ic.value}
                    onChange={(e) => setForm({ ...form, ic: { ...form.ic, value: e.target.value } })}
                    /* ⚠️ Corrige ao SAIR do campo, não a cada tecla: normalizar
                       enquanto a pessoa digita reescreveria o texto debaixo do
                       cursor. */
                    onBlur={(e) => {
                      const a = analisarTrecho(e.target.value);
                      if (a.valor !== e.target.value) setForm({ ...form, ic: { ...form.ic, value: a.valor } });
                    }}
                    placeholder="Ex.: /checkout"
                  />
                  {/* Exemplos clicáveis: o formato é a dúvida real de quem
                      nunca viu esse campo, e descrever é pior que mostrar. */}
                  <div style={sx("display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 4px")}>
                    {EXEMPLOS_DE_TRECHO.map((ex) => (
                      <button
                        key={ex}
                        type="button"
                        className="btn btn-ghost"
                        style={sx("font-size:11.5px;padding:2px 8px;min-height:0")}
                        onClick={() => setForm({ ...form, ic: { ...form.ic, value: ex } })}
                      >
                        {ex}
                      </button>
                    ))}
                  </div>
                  {/*
                    ⚠️ O campo é OBRIGATÓRIO, e o vazio não é inofensivo: com ele
                    a comparação casa com qualquer endereço e TODA visita viraria
                    checkout iniciado. O Salvar fica travado — ver `save`.
                  */}
                  {(() => {
                    const a = analisarTrecho(form.ic.value);
                    return (
                      <p
                        className="card-body"
                        style={sx(
                          a.aviso
                            ? "margin:0;font-size:11.5px;color:var(--color-warning,#fbbf24)"
                            : "margin:0;font-size:11.5px",
                        )}
                      >
                        {a.aviso ?? "Vale para qualquer endereço que contenha este trecho."}
                      </p>
                    );
                  })()}
                </div>
              )}

              {regraManual(form.ic.type) && (
                <p className="card-body text-muted" style={sx("margin:6px 0 0;font-size:11.5px")}>
                  Você escolheu uma regra manual em “Configuração avançada”, então esta pergunta não
                  se aplica. Marque uma das duas opções acima para voltar ao modo simples.
                </p>
              )}
            </div>
          )}
        </Secao>

        {/* ── 3. O script vem LOGO ABAIXO do que o determina ──
             Antes das causas, cada caixa marcada acima deixaria o código
             silenciosamente velho — o defeito que esta reforma conserta. */}
        <Secao titulo="Script para instalar">
          {editId ? (
            (() => {
              const px = pixels.find((p) => p.id === editId);
              if (!px) return null;
              const local = getPublicAppUrl().includes("localhost");
              // A gaveta inteira do checkout próprio pende desta resposta.
              const ehProprioSite =
                form.ic.enabled && form.ic.type === "contem_url" && !regraManual(form.ic.type);
              return (
                <>
                  <AvisoSnippet check={check} />
                  <p className="card-body" style={sx("margin:0;font-size:12px")}>
                    Cole antes de <code>&lt;/head&gt;</code> do seu site. Dispara a visita em toda página,
                    mais o que você marcou acima.
                  </p>
                  {/*
                    🔴 Checkout próprio precisa do script em DUAS páginas, e a
                    instrução genérica ("do seu site") deixava isso implícito.
                    Sem o script na página de pagamento a regra `contém URL`
                    nunca é avaliada — a URL do checkout só existe onde o script
                    roda. É o mesmo erro de instalação invisível do checkout
                    hospedado, invertido.
                  */}
                  {ehProprioSite && (
                    <p
                      className="card-body"
                      style={sx(
                        "margin:0;font-size:12px;color:var(--color-warning,#fbbf24);" +
                          "border-left:2px solid var(--color-warning,#fbbf24);padding-left:8px",
                      )}
                    >
                      <strong>O mesmo script vai nas duas páginas:</strong> a de vendas e a de
                      pagamento. Sem ele na página de pagamento, o início de checkout nunca dispara —
                      o funil mostra visita e venda, e nada no meio.
                    </p>
                  )}
                  {local && (
                    <p className="card-body" style={sx("margin:0;font-size:12px;color:var(--color-warning,#fbbf24)")}>
                      O script aponta para <code>{getPublicAppUrl()}</code>, um endereço local. Defina{" "}
                      <code>NEXT_PUBLIC_APP_URL</code> com o domínio de produção e copie de novo antes de instalar.
                    </p>
                  )}
                  <SnippetBox codigo={scriptText(px)} />
                  {ehProprioSite && <PassosCheckoutProprio />}
                  <EstadoPorEvento check={check} />
                </>
              );
            })()
          ) : (
            /* Na criação não há script: ele embute o `PixelConfig.id`, que só
               existe depois do primeiro save. Dizer isso é melhor que um bloco
               vazio sem explicação. */
            <p className="card-body text-muted" style={sx("margin:0;font-size:12px")}>
              O script aparece aqui assim que você salvar — ele leva o identificador deste pixel,
              que é criado no momento em que você salva.
            </p>
          )}
        </Secao>

        {/* ─────────────── 4. Purchase — vale na hora ─────────────── */}
        {/*
          A 2ª pergunta do preset mora AQUI, e não junto da 1ª, por dois motivos:

          1. **O selo tem de continuar verdadeiro.** O bloco "Como é o seu site"
             é `⟳ muda o script`; o dono do Purchase NÃO muda o script (ele nunca
             sai do navegador). Colocá-lo lá faria o selo pedir "recole o
             snippet" para uma escolha que não mexe em uma linha do snippet.
          2. É a mesma pergunta que esta seção já faz — "quem avisa a Meta da
             venda?" —, só que respondida do outro lado.
        */}
        <Secao titulo="Envio das vendas" selo="hora">
          <Checkbox
            checked={form.purchase.enabled}
            onChange={(v) => setForm({ ...form, purchase: { ...form.purchase, enabled: v } })}
            label="Enviar a venda para a Meta quando ela for aprovada"
            dica="Sai do nosso servidor, a partir do webhook do gateway — não depende do navegador do comprador. Vale já na próxima venda, sem recolar o script."
          />

          {form.purchase.enabled && (
            <div style={sx("margin-top:var(--space-2)")}>
              <div style={sx("font-size:13px;font-weight:600;margin-bottom:6px")}>
                Alguém mais já avisa o Facebook quando a venda é aprovada?
              </div>
              <div style={sx("display:flex;flex-direction:column;gap:4px")}>
                <Checkbox
                  tipo="radio"
                  checked={!form.outroEnviaPurchase}
                  onChange={() => responderPreset({ outroEnviaPurchase: false })}
                  label="Não — quem avisa é a Trackhub"
                  dica="Enviamos a venda pelo nosso servidor, só quando ela é aprovada de verdade. É o recomendado: chega mesmo com bloqueador de anúncios e não dispara em PIX que ninguém pagou."
                />
                <Checkbox
                  tipo="radio"
                  checked={form.outroEnviaPurchase}
                  onChange={() => responderPreset({ outroEnviaPurchase: true })}
                  label="Sim — a página de obrigado ou o checkout do meu gateway já envia"
                  dica="A Trackhub para de enviar a venda para a Meta. Continua registrando tudo aqui: faturamento, funil e Gerenciador não mudam."
                />
              </div>

              {/*
                ⚠️ O aviso aparece na resposta PADRÃO, não na exceção — ao
                contrário de quase todo aviso do produto. A razão: é a resposta
                padrão que produz contagem dobrada quando está errada, e o
                usuário não tem como saber que o checkout do gateway dele dispara
                Purchase sem ir olhar. Um aviso só na outra opção deixaria o caso
                caro em silêncio.
              */}
              <div
                style={sx(
                  "margin-top:var(--space-2);display:flex;gap:8px;align-items:flex-start;padding:8px 10px;border-radius:var(--radius-sm);" +
                    "border-left:3px solid #f59e0b;background:color-mix(in srgb, #f59e0b 7%, var(--color-surface))",
                )}
              >
                <Icone nome="aviso" tamanho={15} cor="aviso" />
                <div style={sx("font-size:12px;line-height:1.55")} className="text-muted">
                  {form.outroEnviaPurchase ? (
                    <>
                      Confira no <strong>Gerenciador de Eventos</strong> da Meta que a venda continua
                      chegando. Se o outro lado parar de enviar, ela some — e nada aqui vai avisar,
                      porque do nosso lado está tudo certo.
                    </>
                  ) : comPixelProprio.length > 0 ? (
                    /*
                      🔴 NOMEIA o gateway conectado. "Confira se alguém mais
                      envia" pede uma investigação que o usuário não sabe por
                      onde começar; dizer em qual painel olhar é acionável.
                      A frase PERGUNTA em vez de afirmar: sabemos que o painel
                      tem o campo, não sabemos se ele preencheu.
                    */
                    <>
                      <strong>
                        Você usa {listaEm(comPixelProprio)} — e o painel {comPixelProprio.length > 1 ? "deles tem" : "dela tem"}{" "}
                        campo de pixel do Facebook.
                      </strong>{" "}
                      Se o seu ID de pixel está colado lá, {comPixelProprio.length > 1 ? "eles disparam" : "ela dispara"}{" "}
                      a venda na página de obrigado e a Meta vai contar{" "}
                      <strong>duas conversões para cada venda</strong>, otimizando a campanha com o
                      número inflado. Este é o único evento em que não dá para combinar os dois
                      lados: ou nós enviamos, ou {comPixelProprio.length > 1 ? "eles" : "ela"}. Se
                      preferir manter o envio por lá, apague o pixel no painel{" "}
                      {comPixelProprio.length > 1 ? "deles" : "dela"} ou marque “Sim” acima.
                    </>
                  ) : (
                    <>
                      <strong>Só marque “Não” se ninguém mais envia.</strong> Se a sua página de
                      obrigado ou o checkout do gateway também disparar a venda, a Meta vai contar{" "}
                      <strong>duas conversões para cada venda</strong> e otimizar a campanha com o
                      número inflado. Este é o único evento em que não dá para combinar os dois
                      lados: ou nós enviamos, ou ele.
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </Secao>

        {/* ─────────────── 5. Avançado ─────────────── */}
        <section style={sx("padding-top:var(--space-3);border-top:1px solid var(--color-divider)")}>
          <button
            type="button"
            onClick={() => setAvancado((v) => !v)}
            style={sx("display:flex;align-items:center;gap:6px;background:transparent;border:0;padding:0;cursor:pointer;color:inherit;font-size:12.5px")}
          >
            <Icone nome={avancado ? "chevronCima" : "chevronBaixo"} tamanho={14} />
            Configuração avançada
          </button>

          {avancado && (
            <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);margin-top:var(--space-3)")}>
              <Secao titulo="Quem envia cada evento" selo="script">
                <p className="card-body" style={sx("margin:0;font-size:11.5px")}>
                  Definido pela sua resposta acima. Mexa aqui só se souber o que está fazendo —
                  dois lados enviando o mesmo evento fazem a Meta contar duas vezes.
                </p>
                {!noPadrao && (
                  <button
                    type="button"
                    onClick={() => responderPreset({})}
                    className="btn btn-ghost"
                    style={sx("align-self:flex-start;padding:4px 0;font-size:12px")}
                  >
                    ↩ voltar ao padrão
                  </button>
                )}
                {EVENTOS_DO_PIXEL.map((ev) => {
                  const atual = donoDoEvento(form.donos, ev);
                  return (
                    <div key={ev} style={sx("display:flex;flex-direction:column;gap:3px")}>
                      <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap")}>
                        <span style={sx("font-size:13px")}>{ev}</span>
                        <Select
                          label=""
                          minWidth={215}
                          value={atual}
                          onChange={(v) => setForm({ ...form, donos: { ...form.donos, [ev]: v as DonoDoEvento } })}
                          options={(["traffik", "navegador", "gateway", "ninguem"] as DonoDoEvento[]).map((d) => ({
                            value: d,
                            label: ROTULO_DONO[d],
                          }))}
                        />
                      </div>
                      <div className="text-muted" style={sx("font-size:11px")}>{EXPLICACAO_DONO[atual]}</div>
                    </div>
                  );
                })}
              </Secao>

              <Secao titulo="Como detectar o início de checkout" selo="script">
                <Select
                  label=""
                  minWidth={290}
                  value={form.ic.type}
                  onChange={(v) => setForm({ ...form, ic: { ...form.ic, type: v as DetectionType } })}
                  options={[
                    { value: "clique_checkout", label: "Clique no link de checkout (recomendado)" },
                    { value: "contem_texto", label: "Contém texto" },
                    { value: "contem_css", label: "Contém CSS" },
                    { value: "contem_url", label: "Contém URL da página" },
                  ]}
                />
                <input
                  className="input"
                  value={form.ic.value}
                  onChange={(e) => setForm({ ...form, ic: { ...form.ic, value: e.target.value } })}
                  placeholder={
                    form.ic.type === "clique_checkout" ? "Domínios do checkout, separados por vírgula (vazio = os padrões)"
                    : form.ic.type === "contem_texto" ? "Ex.: COMPRAR AGORA"
                    : form.ic.type === "contem_css" ? "Ex.: .btn-checkout"
                    : "Ex.: /checkout"
                  }
                />
                <p className="card-body" style={sx("margin:0;font-size:11.5px")}>
                  {form.ic.type === "clique_checkout" ? (
                    <>Vazio já cobre Kirvano, Cakto, Hotmart, Cartpanda, Kiwify e Monetizze.</>
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
                <p className="card-body text-muted" style={sx("margin:0;font-size:11.5px")}>
                  Independente desta regra, todo pedido gerado e não pago que chega pelo webhook do
                  gateway também entra como checkout iniciado — sem duplicar quando o clique já foi capturado.
                </p>
              </Secao>

              <Secao titulo="Detalhes do envio de vendas" selo="hora">
                <div className="field">
                  <label>Enviar</label>
                  <Select
                    label=""
                    minWidth={210}
                    value={form.purchase.sendMode}
                    onChange={(v) => setForm({ ...form, purchase: { ...form.purchase, sendMode: v } })}
                    options={[
                      { value: "APENAS_APROVADAS", label: "Apenas aprovadas" },
                      { value: "TODAS", label: "Aprovadas e pendentes" },
                    ]}
                  />
                </div>
                <div className="field">
                  <label>Valor</label>
                  <Select
                    label=""
                    minWidth={210}
                    value={form.purchase.valueMode}
                    onChange={(v) => setForm({ ...form, purchase: { ...form.purchase, valueMode: v } })}
                    options={[
                      { value: "VALOR_DA_VENDA", label: "Valor da venda" },
                      { value: "VALOR_FIXO", label: "Comissão (valor fixo)" },
                    ]}
                  />
                </div>
                {form.purchase.valueMode === "VALOR_FIXO" && (
                  <div className="field">
                    <label>Valor fixo (R$)</label>
                    <input className="input" inputMode="decimal" value={form.purchase.fixedValue}
                      onChange={(e) => setForm({ ...form, purchase: { ...form.purchase, fixedValue: e.target.value } })} placeholder="Ex.: 47.00" />
                  </div>
                )}
                <div className="field">
                  <label>Produto</label>
                  <Select
                    label=""
                    minWidth={230}
                    value={form.purchase.targetProduct}
                    onChange={(v) => setForm({ ...form, purchase: { ...form.purchase, targetProduct: v } })}
                    options={[{ value: "", label: "Todos os produtos" }, ...products.map((p) => ({ value: p, label: p }))]}
                  />
                </div>
              </Secao>
            </div>
          )}
        </section>

        {error && <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{error}</p>}
      </Drawer>
    </div>
  );
}
