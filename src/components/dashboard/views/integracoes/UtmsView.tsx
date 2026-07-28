"use client";

import { useEffect, useState } from "react";

import { getUtmCodes, type UtmCodesDTO } from "@/lib/actions/utm";
import { getPublicAppUrl } from "@/lib/appUrl";
import { backRedirectScript, utmLoaderJs, utmLoaderSnippet } from "@/lib/utm/scripts";
import { sx } from "@/lib/sx";
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

function CodigosBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [open, setOpen] = useState(false);
  const [dest, setDest] = useState<Destino>("hotmart");
  const [copied, setCopied] = useState(false);

  const code = codes ? codes[dest] : "";

  function copy() {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Códigos</div>
          <div className="card-title">Parâmetros para o Facebook Ads</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Cole estes parâmetros no campo <strong>“Parâmetros de URL”</strong> do seu anúncio. O Facebook
            preenche campanha/conjunto/anúncio automaticamente, e nós cruzamos a venda com o criativo.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen(true)} disabled={!codes} style={sx("white-space:nowrap")}>
          Ver opções
        </button>
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

function ScriptsBlock({ codes }: { codes: UtmCodesDTO | null }) {
  const [backUrl, setBackUrl] = useState("");

  const snippet = codes ? utmLoaderSnippet(codes.accountId, getPublicAppUrl()) : "";
  const snippetJs = codes ? utmLoaderJs(codes.accountId, getPublicAppUrl()) : "";

  function baixarBack() {
    download("traffik-back-redirect.js", backRedirectScript(backUrl));
  }

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div>
        <div className="card-kicker">Scripts</div>
        <div className="card-title">Instale na sua página de vendas</div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:var(--space-2)")}>
        <div style={sx("font-size:14px;font-weight:600")}>Script de UTMs</div>
        <p className="card-body" style={sx("margin:0")}>
          Captura UTMs + fbclid, salva em cookie de 30 dias, propaga para os links de checkout e envia o
          clique para a Traffik. Cole no <code>&lt;head&gt;</code> do seu site.
        </p>
        <p className="card-body" style={sx("margin:0;font-size:12px")}>
          É uma linha só: o resto do código fica hospedado na Traffik e é carregado de forma assíncrona, sem
          atrasar o carregamento da sua página. Melhorias no rastreamento chegam sozinhas, sem reinstalar.
        </p>
        <p className="card-body" style={sx("margin:0;font-size:12px")}>
          Os cliques serão enviados para{" "}
          <code style={sx("font-family:ui-monospace,monospace")}>{getPublicAppUrl()}</code>
          {getPublicAppUrl().includes("localhost") && (
            <span style={sx("color:var(--color-warning,#fbbf24)")}>
              {" "}— é um endereço local. Defina <code>NEXT_PUBLIC_APP_URL</code> com o domínio de produção
              e copie o snippet de novo antes de instalar no site.
            </span>
          )}
        </p>
        <SnippetBox codigo={snippet} alternativo={snippetJs} />
      </div>

      <div style={sx("border-top:1px solid var(--color-border);padding-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)")}>
        <div style={sx("font-size:14px;font-weight:600")}>Script de Back Redirect</div>
        <p className="card-body" style={sx("margin:0")}>
          Ao clicar em “voltar”, redireciona o visitante para a URL abaixo preservando os UTMs.
        </p>
        <div className="field">
          <label>URL de destino</label>
          <input className="input" value={backUrl} onChange={(e) => setBackUrl(e.target.value)} placeholder="https://seusite.com/oferta-especial" />
        </div>
        <button className="btn btn-secondary" type="button" onClick={baixarBack} disabled={!backUrl.trim()} style={sx("width:fit-content")}>
          Baixar traffik-back-redirect.js
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────── View ───────────────────────────

export function UtmsView() {
  const [codes, setCodes] = useState<UtmCodesDTO | null>(null);

  useEffect(() => {
    let alive = true;
    getUtmCodes()
      .then((c) => {
        if (alive) setCodes(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:var(--space-4);align-items:start")}>
      <CodigosBlock codes={codes} />
      <ScriptsBlock codes={codes} />
    </div>
  );
}
