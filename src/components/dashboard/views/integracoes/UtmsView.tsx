"use client";

import { useEffect, useState } from "react";

import { getUtmCodes, type UtmCodesDTO } from "@/lib/actions/utm";
import { getPublicAppUrl } from "@/lib/appUrl";
import { backRedirectScript, utmScript } from "@/lib/utm/scripts";
import { CONFIG } from "@/lib/explicacoes";
import { sx } from "@/lib/sx";
import { Icone, type NomeIcone } from "../../ui/Icone";
import { Drawer } from "../../ui/Drawer";
import { InfoTip } from "../../ui/InfoTip";
import { LogoGateway } from "../../ui/LogoGateway";
import { Modal } from "../../ui/Modal";
import { SnippetBox } from "../../ui/SnippetBox";

type Destino = "hotmart" | "cartpanda" | "outros";
const DESTINOS: { id: Destino; label: string }[] = [
  { id: "hotmart", label: "Hotmart" },
  { id: "cartpanda", label: "Cartpanda" },
  { id: "outros", label: "Outros" },
];

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/javascript;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─────────────────────────── Bloco 1: Códigos ───────────────────────────

/** Legenda de cada destino: o que muda de um para o outro, em uma linha. */
const DESTINO_DICA: Record<Destino, string> = {
  hotmart: "Usa o xcod, com o separador único da sua conta",
  cartpanda: "Usa o cid para identificar a sua conta",
  outros: "UTMs no formato padrão, para qualquer plataforma",
};

function CodigosBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<Destino>("hotmart");
  const [copied, setCopied] = useState(false);
  /** Qual LINHA acabou de ser copiada — separado do `copied` do modal. */
  const [copiedRow, setCopiedRow] = useState<Destino | null>(null);

  const code = codes ? codes[dest] : "";

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyRow(d: Destino) {
    if (!codes) return;
    navigator.clipboard.writeText(codes[d]);
    setCopiedRow(d);
    setTimeout(() => setCopiedRow(null), 1500);
  }

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div>
        <div className="card-kicker">Códigos</div>
        <div className="card-title">Parâmetros para o Facebook Ads</div>
        <p className="card-body" style={sx("margin:4px 0 0")}>
          Cole estes parâmetros no campo <strong>“Parâmetros de URL”</strong> do seu anúncio. O Facebook
          preenche campanha/conjunto/anúncio automaticamente, e nós cruzamos a venda com o criativo.
        </p>
      </div>

      {/**
       * As três plataformas ficam NA TELA, não atrás de um botão "Ver opções".
       *
       * Este card era um título e um botão: a escolha do destino e o código viviam
       * inteiros dentro do modal, então sobrava um card vazio de 500px. Agora a
       * escolha — que é a informação — está aqui, com o "Copiar" na própria linha
       * (um clique a menos no caminho principal).
       *
       * ⚠️ O CÓDIGO em si continua atrás do modal, por decisão do projeto: bloco
       * verboso não aparece na listagem. "Ver" abre o modal já naquela plataforma.
       */}
      <div style={sx("display:flex;flex-direction:column;border:1px solid var(--color-divider);border-radius:var(--radius-md);overflow:hidden")}>
        {DESTINOS.map((d, i) => (
          <div
            key={d.id}
            style={sx(
              "display:flex;align-items:center;gap:10px;padding:var(--space-3);" +
                (i > 0 ? "border-top:1px solid var(--color-divider);" : ""),
            )}
          >
            {d.id === "outros" ? (
              <Icone nome="link" tamanho={22} cor="suave" />
            ) : (
              <LogoGateway id={d.id} nome={d.label} tamanho={22} />
            )}
            <div style={sx("min-width:0;flex:1")}>
              <div style={sx("font-size:13.5px;font-weight:600")}>{d.label}</div>
              <div className="text-muted" style={sx("font-size:11.5px;line-height:1.4")}>{DESTINO_DICA[d.id]}</div>
            </div>
            <button className="btn btn-secondary" type="button" disabled={!codes} onClick={() => copyRow(d.id)}
              style={sx("white-space:nowrap;font-size:12px;padding:5px 10px")}>
              {copiedRow === d.id ? "Copiado!" : "Copiar"}
            </button>
            <button className="btn btn-ghost" type="button" disabled={!codes}
              onClick={() => { setDest(d.id); setOpen(true); }}
              style={sx("white-space:nowrap;font-size:12px")}>
              Ver
            </button>
          </div>
        ))}
      </div>

      {open && codes && (
        <Modal
          aberta
          onClose={() => setOpen(false)}
          largura={640}
          titulo="Parâmetros de URL"
          descricao="Cole no campo “Parâmetros de URL” do seu anúncio no Facebook Ads."
          rodape={
            <>
              <button className="btn btn-secondary" type="button" onClick={() => setOpen(false)}>Fechar</button>
              <button className="btn btn-primary" type="button" onClick={copy}>{copied ? "Copiado!" : "Copiar"}</button>
            </>
          }
        >
          <div style={sx("display:flex;gap:8px")}>
            {DESTINOS.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDest(d.id)}
                style={sx(
                  `flex:1;display:flex;align-items:center;justify-content:center;gap:8px;padding:9px;border-radius:9px;font-size:13px;cursor:pointer;border:1px solid ${dest === d.id ? "var(--color-accent,#a78bfa)" : "var(--color-border)"};background:${dest === d.id ? "var(--color-accent-soft,rgba(139,92,246,.12))" : "transparent"};color:var(--color-text)`,
                )}
              >
                {d.id !== "outros" && <LogoGateway id={d.id} nome={d.label} tamanho={22} />}
                {d.label}
              </button>
            ))}
          </div>
          <pre
            style={sx("background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:11.5px;font-family:ui-monospace,monospace;white-space:pre-wrap;word-break:break-all;margin:0;max-height:260px;overflow:auto")}
          >
            {code}
          </pre>
          <p className="text-muted" style={sx("font-size:11.5px;margin:0;line-height:1.5")}>
            {dest === "hotmart"
              ? "O xcod concatena tudo com um separador único da sua conta, usado no parsing reverso."
              : dest === "cartpanda"
                ? "O cid identifica sua conta na Traffik para atribuição."
                : "Formato genérico de UTMs para qualquer plataforma."}
          </p>
        </Modal>
      )}
    </div>
  );
}

// ─────────────────────────── Bloco 2: Scripts ───────────────────────────

/**
 * Cartão de um script instalável.
 *
 * ⛔ **Nenhum código aparece de cara.** Um bloco de `<pre>` com 3 KB de
 * JavaScript minificado na tela assusta e polui — quem instala um pixel não
 * quer ler o pixel. O cartão diz o que o script faz numa linha; o código vive
 * atrás de "Ver script", numa gaveta com o botão de copiar em destaque e a
 * instrução de onde colar.
 */
function CartaoScript({
  titulo,
  descricao,
  icone,
  aviso,
  children,
}: {
  titulo: string;
  descricao: string;
  icone: NomeIcone;
  aviso?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={sx(
        "display:flex;flex-direction:column;gap:10px;padding:var(--space-3);" +
          "border:1px solid var(--color-divider);border-radius:var(--radius-md)",
      )}
    >
      <div style={sx("display:flex;gap:10px;align-items:flex-start")}>
        <Icone nome={icone} tamanho={20} cor="marca" />
        <div style={sx("min-width:0;flex:1")}>
          <div style={sx("font-size:14px;font-weight:600")}>{titulo}</div>
          <div className="text-muted" style={sx("font-size:12.5px;line-height:1.5;margin-top:2px")}>
            {descricao}
          </div>
        </div>
      </div>
      {aviso}
      <div style={sx("display:flex;gap:var(--space-2);flex-wrap:wrap")}>{children}</div>
    </div>
  );
}

function ScriptsBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [backUrl, setBackUrl] = useState("");
  const [gaveta, setGaveta] = useState<"utm" | "back" | null>(null);

  // O script leva a ÁREA ATIVA. Instalado na página de vendas daquela operação,
  // ele faz o tráfego não atribuível (orgânico/direto) cair nela em vez de na
  // Principal. Tráfego pago já era separado pela campanha.
  const snippet = codes ? utmScript(codes.accountId, getPublicAppUrl(), codes.workspaceId) : "";
  // Área secundária sem nenhum clique carimbado = o script dela ainda não foi
  // instalado. Na Principal isso é normal (ela é o catch-all do legado).
  const faltaInstalar = !!codes && !codes.ehPrincipal && codes.cliquesComArea === 0;
  const urlLocal = getPublicAppUrl().includes("localhost");

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div>
        <div className="card-kicker">Scripts</div>
        <div style={sx("display:flex;align-items:center;gap:5px")}>
          <span className="card-title">
            Instale na página de vendas de <strong>{codes?.workspaceName ?? "—"}</strong>
          </span>
          <InfoTip conteudo={CONFIG.utmPorArea!} tamanho={12} />
        </div>
      </div>

      {faltaInstalar && (
        <div
          style={sx(
            "display:flex;gap:10px;align-items:flex-start;padding:var(--space-3);border-radius:var(--radius-md);" +
              "background:color-mix(in srgb, #f59e0b 12%, transparent);border:1px solid color-mix(in srgb, #f59e0b 45%, transparent)",
          )}
        >
          <Icone nome="aviso" tamanho={16} cor="aviso" />
          <div style={sx("font-size:13px;line-height:1.55")}>
            <strong>Esta área ainda está no script antigo.</strong> Nenhuma visita chegou
            marcada com ela até agora.
            <div className="text-muted" style={sx("margin-top:4px")}>
              O script antigo continua funcionando — só que o tráfego dele cai na área
              Principal. Copie o script novo e substitua o que está na sua página de vendas.
            </div>
          </div>
        </div>
      )}

      <CartaoScript
        icone="link"
        titulo="Rastreamento de visitas"
        descricao="Identifica de qual anúncio cada visitante veio e leva essa informação até o checkout. É o que faz suas vendas aparecerem ligadas à campanha certa."
        aviso={
          urlLocal ? (
            <div style={sx("font-size:12px;line-height:1.5;color:var(--color-warning,#fbbf24)")}>
              O endereço configurado é local (<code>{getPublicAppUrl()}</code>). Publique a
              ferramenta e copie o script de novo antes de instalar.
            </div>
          ) : undefined
        }
      >
        <button className="btn btn-primary" type="button" onClick={() => setGaveta("utm")}>
          Ver script
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => download("traffik-utm.js", snippet)}
        >
          Baixar arquivo
        </button>
      </CartaoScript>

      {/* ⚠️ Este script NÃO faz o redirecionamento. Quem intercepta o "voltar"
          é a sua página de back redirect (ou o gateway); este snippet só leva o
          rastreamento até lá, para a visita não perder a origem do anúncio no
          caminho. O texto anterior prometia o redirecionamento e estava errado. */}
      <CartaoScript
        icone="voltar"
        titulo="Rastreamento da página de back redirect"
        descricao="Se você usa uma página de back redirect, instale este script nela também. Sem ele, quem passa por ali perde a origem do anúncio e a venda deixa de ser atribuída à campanha."
      >
        <button className="btn btn-primary" type="button" onClick={() => setGaveta("back")}>
          Ver script
        </button>
      </CartaoScript>

      {/* ── Gavetas: é onde o código aparece ─────────────────────────────── */}
      <Drawer
        aberta={gaveta === "utm"}
        titulo="Script de rastreamento"
        descricao={`Área ${codes?.workspaceName ?? ""}`}
        largura={620}
        onClose={() => setGaveta(null)}
      >
        <div style={sx("display:flex;gap:10px;align-items:flex-start")}>
          <Icone nome="local" tamanho={16} cor="marca" />
          <div style={sx("font-size:13px;line-height:1.55")}>
            <strong>Onde colar:</strong> no seu site, no campo de código do cabeçalho — o que
            costuma se chamar “Header” ou “antes de <code>&lt;/head&gt;</code>”.
            <div className="text-muted" style={sx("margin-top:4px")}>
              Vale em todas as páginas do funil, inclusive na de vendas. Instale uma vez por
              página desta operação.
            </div>
          </div>
        </div>
        <SnippetBox codigo={snippet} />
      </Drawer>

      <Drawer
        aberta={gaveta === "back"}
        titulo="Rastreamento da página de back redirect"
        descricao="Informe o endereço da sua página de back redirect"
        largura={620}
        onClose={() => setGaveta(null)}
        rodape={
          <button
            className="btn btn-primary"
            type="button"
            disabled={!backUrl.trim()}
            onClick={() => download("traffik-back-redirect.js", backRedirectScript(backUrl))}
          >
            Baixar arquivo
          </button>
        }
      >
        <div className="field">
          <label>Endereço da sua página de back redirect</label>
          <input
            className="input"
            value={backUrl}
            onChange={(e) => setBackUrl(e.target.value)}
            placeholder="https://seusite.com/oferta-especial"
          />
        </div>
        {backUrl.trim() && <SnippetBox codigo={backRedirectScript(backUrl)} />}
      </Drawer>
    </div>
  );
}

// ─────────────────────────── View ───────────────────────────

/**
 * 🔴 **Recebe o `workspaceId`, e aqui isso é mais grave que em outras telas.**
 *
 * Desde a Sessão 3 o script de UTM é **por área** (embute o `WS`). Com a busca
 * presa à montagem, trocar de área com esta aba aberta continuava exibindo o
 * script da área ANTERIOR — e o usuário copia esse bloco e instala no site. Não
 * é um número velho na tela: é uma instalação errada, que carimba os cliques
 * daquela página na área errada e só se descobre depois, no relatório.
 *
 * `router.refresh()` não resolve sozinho: ele re-renderiza o servidor e
 * **preserva o estado de componente cliente**. Quem refaz a consulta é a prop na
 * lista de dependências.
 */
export function UtmsView({ workspaceId }: { workspaceId: string | null }) {
  const [codes, setCodes] = useState<UtmCodesDTO | null>(null);

  useEffect(() => {
    let alive = true;
    getUtmCodes(workspaceId)
      .then((c) => {
        if (alive) setCodes(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  return (
    <div style={sx("display:grid;gap:var(--space-4);align-items:start")}>
      {/* ⚠️ O aviso "este script é o mesmo em todas as áreas" foi REMOVIDO em
          29/07/2026 — ele era da Sessão 2 e a Sessão 3 reverteu a decisão: o
          script passou a ser POR ÁREA (`ws` no payload do clique). Ficaram os
          dois na tela por um deploy, se contradizendo. Se um dia o script
          voltar a ser global, o aviso volta AQUI e sai do `ScriptsBlock` —
          nunca os dois. */}
      {/* Duas colunas de peso igual: agora que os Códigos listam as três
          plataformas, os dois cards têm massa parecida. O `minmax(0,…)` evita que
          uma linha longa de dica estoure o track. */}
      <div style={sx("display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-4);align-items:start")}>
        <CodigosBlock codes={codes} />
        <ScriptsBlock codes={codes} />
      </div>
    </div>
  );
}
