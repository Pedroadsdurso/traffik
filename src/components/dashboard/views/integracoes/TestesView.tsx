"use client";

import { plural } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

import {
  analyzeTrackingUrl,
  getInstallChecklist,
  listTestablePixels,
  listWebhookLogs,
  resumoEspelhos,
  type ChecklistItemDTO,
  type EspelhoResumoDTO,
  type PixelOptionDTO,
  type TrackingTestDTO,
  type WebhookLogDTO,
} from "@/lib/actions/diagnostics";
import { estadoDoEspelho, type TomDoEspelho } from "@/lib/pixel/espelho";
import { sx } from "@/lib/sx";
import { TestadorPayloadCard } from "./TestadorPayloadCard";
import { Select } from "../../ui/Select";

const STATUS_TAG: Record<string, { label: string; cls: string }> = {
  RECEBIDO: { label: "Recebido", cls: "tag tag-neutral" },
  PROCESSADO: { label: "Processado", cls: "tag tag-accent" },
  REJEITADO: { label: "Rejeitado", cls: "tag tag-neutral" },
  ERRO: { label: "Erro", cls: "tag tag-neutral" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR");
}

// ───────────────────────── 1. Teste de Pixel ─────────────────────────

function PixelTestCard() {
  const [pixels, setPixels] = useState<PixelOptionDTO[]>([]);
  const [pixelId, setPixelId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    listTestablePixels()
      .then((list) => {
        setPixels(list);
        if (list[0]) setPixelId(list[0].id);
      })
      .catch(() => {});
  }, []);

  async function run() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/pixel/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixelConfigId: pixelId, testEventCode: code.trim() || undefined }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string; testEventCode?: string | null };
      if (res.ok && data.ok) {
        setResult({
          ok: true,
          msg: data.testEventCode
            ? `O Facebook confirmou o recebimento. Procure pelo código ${data.testEventCode} em "Testar eventos" no Gerenciador de Eventos.`
            : "O Facebook confirmou o recebimento do evento.",
        });
      } else {
        setResult({ ok: false, msg: data.error ?? "O Facebook recusou o evento." });
      }
    } catch {
      setResult({ ok: false, msg: "Não foi possível fazer o teste agora. Tente de novo em instantes." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-kicker">Conversions API</div>
      <div className="card-title">Teste de Pixel</div>
      <p className="card-body" style={sx("margin:4px 0 0")}>
        Envia um evento <strong>Purchase</strong> de verdade (R$ 1) para a Conversions API e mostra se o
        Facebook confirmou. Informe um <em>test_event_code</em> para vê-lo em &quot;Testar eventos&quot;.
      </p>

      {pixels.length === 0 ? (
        <p className="card-body" style={sx("color:var(--color-warning,#fbbf24);margin:var(--space-2) 0 0")}>
          Nenhum pixel conectado. Cadastre um na aba Pixel.
        </p>
      ) : (
        <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap;align-items:flex-end")}>
          <div className="field" style={sx("width:auto;min-width:200px")}>
            <label>Pixel</label>
            <Select
              label=""
              minWidth={230}
              value={pixelId}
              onChange={setPixelId}
              options={pixels.map((p) => ({
                value: p.id,
                label: `${p.name} (${plural(p.metaCount, "pixel da Meta", "pixels da Meta")})`,
              }))}
            />
          </div>
          <div className="field" style={sx("width:180px")}>
            <label>test_event_code (opcional)</label>
            <input className="input" placeholder="TEST12345" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <button className="btn btn-primary" type="button" onClick={run} disabled={busy || !pixelId}>
            {busy ? "Enviando…" : "Disparar evento de teste"}
          </button>
        </div>
      )}

      {result && (
        <p
          style={sx(
            `margin:var(--space-3) 0 0;font-size:13px;padding:10px;border-radius:var(--radius-md);background:var(--color-bg);color:${result.ok ? "var(--color-success,#4ade80)" : "var(--color-danger,#f87171)"}`,
          )}
        >
          {result.ok ? "✓ " : "✗ "}
          {result.msg}
        </p>
      )}
    </div>
  );
}

// ─────────────────── 2. Espelho no pixel do navegador ───────────────────

const COR_DO_TOM: Record<TomDoEspelho, string> = {
  bom: "var(--color-success,#4ade80)",
  atencao: "var(--color-warning,#fbbf24)",
  ruim: "var(--color-danger,#f87171)",
  neutro: "var(--color-text-muted,#9ca3af)",
};

/**
 * O espelho no `fbq` é o que faz a Meta juntar o evento do navegador com o
 * nosso, da CAPI. Sem este card, "os espelhos estão saindo?" só se respondia
 * abrindo o DevTools na página — o que não escala com vários clientes.
 */
function EspelhoCard() {
  const [dados, setDados] = useState<EspelhoResumoDTO | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    resumoEspelhos(7)
      .then(setDados)
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` busca no servidor e guarda o resultado
  useEffect(load, [load]);

  // Só os estados que pedem ação viram destaque. O resto explica o número.
  const problemas = dados?.porEstado.filter((e) => estadoDoEspelho(e.estado).tom === "ruim") ?? [];

  return (
    <div className="card">
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Pixel do navegador</div>
          <div className="card-title">Espelho no pixel da sua página</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Para a Meta contar uma conversão em vez de duas, o mesmo evento precisa sair pelo nosso
            servidor <em>e</em> pelo pixel da sua página, com o mesmo identificador. Aqui é onde se vê
            se isso está acontecendo.
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={busy} style={sx("white-space:nowrap")}>
          {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {!dados ? (
        <p className="card-body text-muted" style={sx("margin:var(--space-3) 0 0")}>Verificando…</p>
      ) : dados.total === 0 ? (
        <p className="card-body text-muted" style={sx("margin:var(--space-3) 0 0")}>
          Nenhum evento de pixel nos últimos {dados.dias} dias. Assim que uma página com o script
          receber visita, os números aparecem aqui.
        </p>
      ) : (
        <>
          <div style={sx("display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--space-3)")}>
            {dados.porEstado.map(({ estado, n }) => {
              const e = estadoDoEspelho(estado);
              return (
                <span
                  key={estado}
                  title={e.ajuda}
                  style={sx(
                    `display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:4px 10px;border-radius:999px;` +
                      `border:1px solid var(--color-border);color:${COR_DO_TOM[e.tom]}`,
                  )}
                >
                  <strong style={sx("font-variant-numeric:tabular-nums")}>{n}</strong>
                  {e.rotulo}
                </span>
              );
            })}
          </div>

          <p className="card-body text-muted" style={sx("margin:var(--space-2) 0 0;font-size:11.5px")}>
            {plural(dados.total, "evento", "eventos")} nos últimos {dados.dias} dias. Passe o mouse em
            cada situação para ver o que ela significa.
          </p>

          {/* ⚠️ O aviso só aparece com problema de verdade. Um alerta permanente
              vira ruído que se aprende a ignorar — inclusive quando muda. */}
          {problemas.length > 0 && (
            <div
              style={sx(
                "margin-top:var(--space-3);font-size:12px;line-height:1.5;color:var(--color-warning,#fbbf24);" +
                  "border-left:2px solid var(--color-warning,#fbbf24);padding-left:10px",
              )}
            >
              {problemas.map(({ estado, n }) => (
                <div key={estado} style={sx("margin-bottom:4px")}>
                  <strong>
                    {n} {estadoDoEspelho(estado).rotulo}
                  </strong>{" "}
                  — {estadoDoEspelho(estado).ajuda}
                </div>
              ))}
            </div>
          )}

          <div style={sx("display:flex;flex-direction:column;gap:2px;margin-top:var(--space-3)")}>
            {dados.porEvento.map((ev) => (
              <div
                key={ev.event}
                style={sx(
                  "display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding:8px 0;border-bottom:1px solid var(--color-border)",
                )}
              >
                <span style={sx("font-size:13px;font-weight:600;min-width:130px")}>{ev.event}</span>
                <span className="text-muted" style={sx("font-size:11.5px;font-variant-numeric:tabular-nums")}>
                  {ev.total}
                </span>
                <span style={sx("display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px")}>
                  {ev.estados.map(({ estado, n }) => {
                    const e = estadoDoEspelho(estado);
                    return (
                      <span key={estado} title={e.ajuda} style={sx(`color:${COR_DO_TOM[e.tom]}`)}>
                        {n} {e.rotulo}
                      </span>
                    );
                  })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ───────────────────────── 3. Teste de Webhook ─────────────────────────

function WebhookLogsCard() {
  const [logs, setLogs] = useState<WebhookLogDTO[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    listWebhookLogs(20)
      .then(setLogs)
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` busca no servidor e guarda o resultado
  useEffect(load, [load]);

  const gateways = [...new Set(logs.map((l) => l.gateway))];

  return (
    <div className="card">
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Webhooks</div>
          <div className="card-title">Teste de Webhook</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Últimos payloads recebidos, exatamente como chegaram — inclusive os recusados. Clique para ver o corpo cru.
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={busy} style={sx("white-space:nowrap")}>
          {busy ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

      {gateways.length > 0 && (
        <div style={sx("display:flex;gap:6px;flex-wrap:wrap;margin-top:var(--space-2)")}>
          {gateways.map((g) => (
            <span key={g} className="tag tag-neutral">
              {g} · {logs.filter((l) => l.gateway === g).length}
            </span>
          ))}
        </div>
      )}

      {logs.length === 0 ? (
        <p className="card-body text-muted" style={sx("margin:var(--space-3) 0 0")}>
          Nenhum payload recebido ainda. Assim que o gateway disparar um evento, ele aparece aqui.
        </p>
      ) : (
        <div style={sx("display:flex;flex-direction:column;gap:6px;margin-top:var(--space-3)")}>
          {logs.map((log) => {
            const tag = STATUS_TAG[log.status] ?? STATUS_TAG.RECEBIDO;
            const open = openId === log.id;
            return (
              <div key={log.id} style={sx("border:1px solid var(--color-border);border-radius:8px;overflow:hidden")}>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : log.id)}
                  style={sx(
                    "width:100%;display:flex;align-items:center;gap:10px;justify-content:space-between;padding:10px 12px;background:transparent;border:0;cursor:pointer;text-align:left;color:inherit;flex-wrap:wrap",
                  )}
                >
                  <span style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                    <span className="tag tag-neutral">{log.gateway}</span>
                    <span className={tag!.cls}>{tag!.label}</span>
                    {log.httpStatus && <span className="text-muted" style={sx("font-size:11.5px")}>HTTP {log.httpStatus}</span>}
                  </span>
                  <span className="text-muted" style={sx("font-size:11.5px")}>{fmtDate(log.createdAt)}</span>
                </button>
                {log.message && (
                  <div style={sx("padding:0 12px 8px;font-size:12px;color:var(--color-danger,#f87171)")}>{log.message}</div>
                )}
                {open && (
                  <pre
                    style={sx(
                      "margin:0;padding:12px;background:var(--color-bg,#0b0b0f);border-top:1px solid var(--color-border);font-size:11px;font-family:ui-monospace,monospace;overflow:auto;max-height:280px",
                    )}
                  >
                    {log.payload}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── 3. Teste de Tracking ─────────────────────────

function TrackingTestCard() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TrackingTestDTO | null>(null);

  async function run() {
    if (!url.trim()) return;
    setBusy(true);
    try {
      setRes(await analyzeTrackingUrl(url));
    } catch {
      setRes(null);
    } finally {
      setBusy(false);
    }
  }

  const linhas: { label: string; value: string | null }[] = res
    ? [
        { label: "Campanha (nome)", value: res.parsed.campaignName },
        { label: "Campanha (id)", value: res.parsed.campaignId },
        { label: "Conjunto (nome)", value: res.parsed.adsetName },
        { label: "Conjunto (id)", value: res.parsed.adsetId },
        { label: "Anúncio (nome)", value: res.parsed.adName },
        { label: "Anúncio (id)", value: res.parsed.adId },
        { label: "Posicionamento", value: res.parsed.placement },
      ]
    : [];

  return (
    <div className="card">
      <div className="card-kicker">Tracking</div>
      <div className="card-title">Teste de Tracking</div>
      <p className="card-body" style={sx("margin:4px 0 0")}>
        Cole uma URL com UTMs (ou só a querystring) e veja como ela seria interpretada e a qual
        campanha/anúncio a venda seria vinculada.
      </p>

      <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-3);align-items:flex-end;flex-wrap:wrap")}>
        <div className="field" style={sx("flex:1;min-width:260px")}>
          <label>URL com UTMs</label>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="https://seusite.com/?utm_campaign=Campanha|120210...&utm_content=Anuncio|238..."
          />
        </div>
        <button className="btn btn-primary" type="button" onClick={run} disabled={busy || !url.trim()}>
          {busy ? "Analisando…" : "Analisar"}
        </button>
      </div>

      {res && !res.ok && (
        <p style={sx("margin:var(--space-3) 0 0;font-size:13px;color:var(--color-danger,#f87171)")}>{res.error}</p>
      )}

      {res?.ok && (
        <div style={sx("margin-top:var(--space-3);display:flex;flex-direction:column;gap:var(--space-3)")}>
          <div>
            <div style={sx("font-size:12px;font-weight:600;margin-bottom:6px")}>Parâmetros extraídos</div>
            <div style={sx("display:flex;flex-direction:column;gap:2px")}>
              {linhas.map((l) => (
                <div key={l.label} style={sx("display:flex;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--color-border)")}>
                  <span className="text-muted" style={sx("min-width:140px")}>{l.label}</span>
                  <span style={sx(`font-family:ui-monospace,monospace;${l.value ? "" : "opacity:.5"}`)}>
                    {l.value ?? "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={sx("font-size:12px;font-weight:600;margin-bottom:6px")}>Onde este link foi reconhecido</div>
            <div style={sx("display:flex;flex-direction:column;gap:4px;font-size:12.5px")}>
              <div>
                Campanha:{" "}
                {res.match.campaign ? (
                  <strong>
                    {res.match.campaign.name}{" "}
                    <span className="tag tag-accent">por {res.match.campaign.by}</span>
                  </strong>
                ) : (
                  <span className="text-muted">não vinculada</span>
                )}
              </div>
              <div>
                Anúncio:{" "}
                {res.match.ad ? (
                  <strong>
                    {res.match.ad.name} <span className="tag tag-accent">por {res.match.ad.by}</span>
                  </strong>
                ) : (
                  <span className="text-muted">não vinculado</span>
                )}
              </div>
            </div>
          </div>

          {res.notes.length > 0 && (
            <ul style={sx("margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px;font-size:12px")} className="text-muted">
              {res.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── 4. Checklist ─────────────────────────

function ChecklistCard() {
  const [items, setItems] = useState<ChecklistItemDTO[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setBusy(true);
    getInstallChecklist()
      .then(setItems)
      .catch(() => {})
      .finally(() => setBusy(false));
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- `load` busca no servidor e guarda o resultado
  useEffect(load, [load]);

  const okCount = items.filter((i) => i.ok).length;

  return (
    <div className="card">
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Instalação</div>
          <div className="card-title">Checklist</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            {items.length > 0 ? `${okCount} de ${items.length} itens prontos.` : "Verificando…"}
          </p>
        </div>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={busy} style={sx("white-space:nowrap")}>
          {busy ? "Verificando…" : "Reverificar"}
        </button>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:2px;margin-top:var(--space-3)")}>
        {items.map((it) => (
          <div
            key={it.key}
            style={sx("display:flex;align-items:flex-start;gap:10px;padding:8px 0;border-bottom:1px solid var(--color-border)")}
          >
            <span
              style={sx(
                `font-size:14px;line-height:1.3;color:${it.ok ? "var(--color-success,#4ade80)" : "var(--color-danger,#f87171)"}`,
              )}
            >
              {it.ok ? "✓" : "✗"}
            </span>
            <div style={sx("flex:1")}>
              <div style={sx("font-size:13px;font-weight:600")}>{it.label}</div>
              <div className="text-muted" style={sx("font-size:11.5px")}>{it.detail}</div>
            </div>
            {!it.ok && it.href && (
              <a className="btn btn-ghost" href={it.href} style={sx("padding:4px 10px;font-size:11.5px;white-space:nowrap")}>
                Resolver
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────── View ─────────────────────────

export function TestesView() {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3);max-width:920px")}>
      <ChecklistCard />
      <PixelTestCard />
      <EspelhoCard />
      <WebhookLogsCard />
      <TrackingTestCard />
      <TestadorPayloadCard />
    </div>
  );
}
