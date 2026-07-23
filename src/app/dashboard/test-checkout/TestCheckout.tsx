"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { sx } from "@/lib/sx";

declare global {
  interface Window {
    getTrackingData?: () => Record<string, unknown>;
    traffik?: { data?: Record<string, unknown> };
  }
}

const DEMO_UTMS = {
  utm_source: "facebook",
  utm_medium: "cpc",
  utm_campaign: "lancamento-metodo-foco",
  utm_content: "criativo-vsl-ana",
  utm_term: "emagrecer-rapido",
  fbclid: "IwAR-demo-" + Math.random().toString(36).slice(2, 10),
};

interface Props {
  trackingId: string;
  appUrl: string;
  webhookUrl: string | null;
}

export function TestCheckout({ trackingId, appUrl, webhookUrl }: Props) {
  const [clickId, setClickId] = useState<string | null>(null);
  const [product, setProduct] = useState("Produto de teste");
  const [value, setValue] = useState("497");
  const [status, setStatus] = useState("aprovada");
  const [payment, setPayment] = useState("pix");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const injected = useRef(false);

  // Garante UTMs demo na URL antes do pixel ler window.location, depois injeta o script.
  useEffect(() => {
    if (injected.current) return;
    injected.current = true;

    const url = new URL(window.location.href);
    if (!url.searchParams.get("utm_source")) {
      for (const [k, val] of Object.entries(DEMO_UTMS)) url.searchParams.set(k, val);
      window.history.replaceState(null, "", url.toString());
    }

    const script = document.createElement("script");
    script.src = `${appUrl}/pixel.js`;
    script.setAttribute("data-account", trackingId);
    script.async = true;
    document.body.appendChild(script);

    // O pixel devolve o click_id de forma assíncrona; fazemos um polling curto.
    const timer = setInterval(() => {
      const data = window.getTrackingData?.();
      if (data?.click_id) {
        setClickId(String(data.click_id));
        clearInterval(timer);
      }
    }, 400);
    const stop = setTimeout(() => clearInterval(timer), 8000);
    return () => {
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [appUrl, trackingId]);

  async function simulate() {
    if (!webhookUrl) return;
    setBusy(true);
    setResult(null);
    try {
      const payload = {
        transaction_id: "TEST-" + Date.now(),
        product,
        value: Number(value) || 0,
        email_comprador: "comprador.teste@example.com",
        nome_comprador: "Comprador de Teste",
        status,
        forma_pagamento: payment,
        click_id: clickId,
        pais: "BR",
      };
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setResult(
          `✅ Venda registrada — status: ${json.status}, origem do clique: ${
            { direct: "match direto pelo click_id", ip: "match por IP", none: "sem clique vinculado" }[
              json.match as string
            ] ?? json.match
          }`,
        );
      } else {
        setResult(`⚠️ ${json.error ?? "Falha ao registrar venda."}`);
      }
    } catch (e) {
      setResult(`⚠️ Erro de rede: ${String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={sx("min-height:100vh;background:var(--color-bg);color:var(--color-text);padding:var(--space-8);font-family:var(--font-body)")}>
      <div style={sx("max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:var(--space-4)")}>
        <div>
          <Link href="/dashboard" style={sx("font-size:13px")}>← Voltar ao dashboard</Link>
          <h2 style={sx("margin:var(--space-3) 0 0")}>Checkout de teste</h2>
          <p className="text-muted" style={sx("font-size:14px")}>
            Esta página carrega o pixel real como se fosse o seu site e dispara uma venda de teste no seu
            webhook, para você validar o fluxo clique → venda ponta a ponta.
          </p>
        </div>

        <div className="card">
          <div className="card-kicker">Passo 1 · Rastreamento</div>
          <div className="card-title" style={sx("font-size:16px")}>Clique capturado pelo pixel</div>
          <div style={sx("display:flex;align-items:center;gap:8px;margin-top:var(--space-2)")}>
            {clickId ? (
              <>
                <span className="tag tag-accent">click_id</span>
                <code style={sx("font-size:12px")}>{clickId}</code>
              </>
            ) : (
              <span className="text-muted" style={sx("font-size:13px")}>Capturando clique…</span>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Passo 2 · Venda</div>
          <div className="card-title" style={sx("font-size:16px")}>Simular compra</div>

          {!webhookUrl ? (
            <p className="card-body" style={sx("color:#ffce8a")}>
              Nenhum webhook ativo. Crie um em Integrações → Webhooks antes de testar.
            </p>
          ) : (
            <>
              <div style={sx("display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);margin-top:var(--space-2)")}>
                <div className="field">
                  <label>Produto</label>
                  <input className="input" value={product} onChange={(e) => setProduct(e.target.value)} />
                </div>
                <div className="field">
                  <label>Valor (R$)</label>
                  <input className="input" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" />
                </div>
                <div className="field">
                  <label>Status</label>
                  <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="aprovada">Aprovada</option>
                    <option value="pendente">Pendente</option>
                    <option value="reembolsada">Reembolsada</option>
                  </select>
                </div>
                <div className="field">
                  <label>Pagamento</label>
                  <select className="input" value={payment} onChange={(e) => setPayment(e.target.value)}>
                    <option value="pix">Pix</option>
                    <option value="cartao">Cartão</option>
                    <option value="boleto">Boleto</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary btn-block" type="button" onClick={simulate} disabled={busy}>
                {busy ? "Enviando…" : "Simular Compra"}
              </button>
            </>
          )}

          {result && (
            <p style={sx("margin:var(--space-3) 0 0;font-size:13px;padding:10px;border-radius:var(--radius-md);background:var(--color-bg)")}>
              {result}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
