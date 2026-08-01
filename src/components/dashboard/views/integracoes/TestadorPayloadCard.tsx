"use client";

import { useEffect, useState } from "react";

import {
  carregarExemploDeGateway,
  listarGatewaysDoTestador,
  testarPayloadDeGateway,
} from "@/lib/actions/diagnostics";
import type { Diagnostico } from "@/lib/gateways/testador";
import { plural } from "@/lib/format";
import { sx } from "@/lib/sx";

import { Select } from "../../ui/Select";

/**
 * # Testador de payload — validar um gateway ANTES de ter conta nele
 *
 * Cola-se o JSON da documentação (ou um capturado de verdade) e a tela mostra o
 * que foi extraído, o que ficou vazio **e por quê**.
 *
 * ⚠️ O "por quê" é a razão de existir. Campo vazio tem duas causas opostas:
 * o gateway não enviou (nada a fazer) ou enviou com outro nome e o parser não
 * leu (🔴 corrigir). A segunda é invisível numa inspeção normal — o campo
 * aparece vazio, o payload parece completo, e ninguém liga um ao outro.
 *
 * Nada é gravado: nenhuma venda, nenhum log, nenhuma requisição ao gateway.
 */

const COR = {
  lido: "var(--color-success,#4ade80)",
  ausente: "var(--color-text-muted)",
  nao_mapeado: "var(--color-warning,#fbbf24)",
} as const;

const ROTULO_ESTADO = {
  lido: "lido",
  ausente: "o gateway não enviou",
  // ⚠️ A distinção entre estes dois é a razão de o testador existir: campo vazio
  // parece igual nos dois casos, e um deles é bug nosso. Mas dizer "payload" não
  // é o que diferencia — quem lê esta tela é gestor de tráfego, não quem
  // escreveu o parser.
  nao_mapeado: "o gateway mandou, e não lemos",
} as const;

export function TestadorPayloadCard() {
  const [gateways, setGateways] = useState<{ id: string; nome: string; exemplos: { nome: string }[] }[]>([]);
  const [gateway, setGateway] = useState("CAKTO");
  const [json, setJson] = useState("");
  const [d, setD] = useState<Diagnostico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    listarGatewaysDoTestador().then((g) => setGateways(g));
  }, []);

  const atual = gateways.find((g) => g.id === gateway);

  async function usarExemplo(indice: number) {
    const texto = await carregarExemploDeGateway(gateway, indice);
    if (texto) {
      setJson(texto);
      setD(null);
      setErro(null);
    }
  }

  async function analisar() {
    setOcupado(true);
    setErro(null);
    try {
      const r = await testarPayloadDeGateway({ gateway, json });
      if (r.ok) {
        setD(r.diagnostico);
      } else {
        setD(null);
        setErro(r.erro);
      }
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="card">
      <div className="card-kicker">Gateways</div>
      {/* "payload" está na lista de fora junto com POST, endpoint e cabeçalho:
          é o vocabulário de quem escreveu o parser, não de quem lê esta tela.
          O que se cola aqui é o aviso que o gateway manda a cada venda. */}
      <div className="card-title">Testar um aviso de venda</div>
      <p className="card-body" style={sx("margin:4px 0 0;max-width:70ch")}>
        Cole o exemplo de webhook da documentação do gateway e veja o que a Traffik entenderia dele.
        Nada é salvo — nenhuma venda é criada.
      </p>

      <div style={sx("display:flex;flex-wrap:wrap;gap:var(--space-2);align-items:flex-end;margin-top:var(--space-3)")}>
        <Select
          label="Gateway"
          value={gateway}
          onChange={(v) => {
            setGateway(v);
            setD(null);
          }}
          options={gateways.map((g) => ({ value: g.id, label: g.nome }))}
          minWidth={190}
        />
        {(atual?.exemplos ?? []).map((e, i) => (
          <button key={e.nome} className="btn btn-secondary" type="button" onClick={() => usarExemplo(i)}
            style={sx("font-size:12px;padding:6px 10px")}>
            {e.nome}
          </button>
        ))}
      </div>

      <textarea
        className="input"
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='Cole aqui o que o gateway envia, por exemplo: {"event":"purchase_approved","data":{…}}'
        rows={8}
        style={sx("margin-top:var(--space-2);font-family:ui-monospace,monospace;font-size:12px;resize:vertical")}
      />

      <div style={sx("display:flex;gap:8px;margin-top:var(--space-2)")}>
        <button className="btn btn-primary" type="button" onClick={analisar} disabled={ocupado || !json.trim()}>
          {ocupado ? "Analisando…" : "Analisar"}
        </button>
      </div>

      {erro && (
        <p style={sx("margin:var(--space-2) 0 0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{erro}</p>
      )}

      {d && <Resultado d={d} />}
    </div>
  );
}

function Resultado({ d }: { d: Diagnostico }) {
  const formaTexto =
    d.forma === "lista"
      ? "lista (disparo agrupado)"
      : d.forma === "objeto"
        ? "objeto (disparo individual)"
        : "sem o campo “data”";

  return (
    <div style={sx("margin-top:var(--space-3);border-top:1px solid var(--color-divider);padding-top:var(--space-3)")}>
      {d.erro && (
        <p style={sx("margin:0 0 var(--space-2);font-size:12.5px;color:var(--color-warning,#fbbf24)")}>{d.erro}</p>
      )}

      {/* O resumo responde de uma vez: quantas vendas, quantas conversões, e a
          forma do payload — que é onde um parser que assume objeto quebra. */}
      <div style={sx("display:flex;flex-wrap:wrap;gap:var(--space-3);margin-bottom:var(--space-3)")}>
        <Resumo rotulo="Formato" valor={formaTexto} />
        <Resumo rotulo="Itens" valor={String(d.itens)} />
        <Resumo
          rotulo="Conversões"
          valor={String(d.pedidos)}
          nota={d.itens > d.pedidos ? `${plural(d.itens - d.pedidos, "item do mesmo carrinho", "itens do mesmo carrinho")}` : undefined}
        />
      </div>

      {d.avisos.length > 0 && (
        <div
          style={sx(
            "border:1px solid var(--color-warning,#fbbf24);border-radius:8px;padding:var(--space-2);" +
              "margin-bottom:var(--space-3);font-size:12.5px;line-height:1.6",
          )}
        >
          <strong style={sx("display:block;margin-bottom:4px")}>Confira antes de usar</strong>
          {d.avisos.map((a) => (
            <div key={a}>· {a}</div>
          ))}
        </div>
      )}

      {d.vendas.map((v) => (
        <div key={v.indice} style={sx("margin-bottom:var(--space-3)")}>
          <div className="card-kicker" style={sx("margin-bottom:6px")}>
            {plural(d.vendas.length, "Venda", "Venda")} {v.indice + 1} · {v.itemTipo} · status {v.status}
            {v.pedidoId ? ` · pedido ${v.pedidoId}` : ""}
          </div>
          <div style={sx("display:grid;gap:2px")}>
            {v.campos.map((c) => (
              <div
                key={c.campo}
                style={sx(
                  "display:grid;grid-template-columns:minmax(0,180px) minmax(0,1fr);gap:8px;" +
                    "font-size:12px;padding:3px 0;border-bottom:1px solid var(--color-divider)",
                )}
              >
                <span className="text-muted" style={sx("min-width:0")}>{c.rotulo}</span>
                <span style={sx(`min-width:0;color:${COR[c.estado]};word-break:break-word`)}>
                  {c.estado === "lido" ? (
                    <span style={sx("font-family:ui-monospace,monospace")}>{c.valor}</span>
                  ) : (
                    <>
                      {ROTULO_ESTADO[c.estado]}
                      {c.chaveNoPayload && (
                        <span style={sx("display:block;font-family:ui-monospace,monospace;font-size:11px;opacity:.85")}>
                          {c.chaveNoPayload}
                        </span>
                      )}
                    </>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* O que o registro PROMETE × o que este payload trouxe. Divergência aqui
          é o que faz a tela avisar coisa errada ao usuário depois. */}
      <div className="card-kicker" style={sx("margin-bottom:6px")}>O que este gateway entrega</div>
      <div style={sx("display:grid;gap:2px;font-size:12px")}>
        {d.capacidades.map((c) => (
          <div key={c.nome} style={sx("display:flex;gap:8px;align-items:baseline")}>
            <span style={sx(`color:${c.observada ? COR.lido : COR.ausente}`)}>{c.observada ? "✓" : "—"}</span>
            <span style={sx("flex:1;min-width:0")}>{c.nome}</span>
            {c.divergente && (
              <span className="text-muted" style={sx("font-size:11px")}>
                {c.declarada ? "esperávamos, e não veio" : "veio, mas não estava previsto"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Resumo({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div>
      <div className="card-kicker">{rotulo}</div>
      <div style={sx("font-size:15px")}>{valor}</div>
      {nota && <div className="card-meta">{nota}</div>}
    </div>
  );
}
