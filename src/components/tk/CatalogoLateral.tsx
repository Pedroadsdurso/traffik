"use client";

import * as React from "react";
import { Tooltip } from "./Tooltip";

/**
 * CATÁLOGO LATERAL — o que está fora do painel e pode entrar.
 *
 * ⛔ ELE SUBSTITUI A ROTA `/dashboard/blocos`. Aquela tela existia para provar
 * que nenhum bloco do catálogo desenha vazio, e o lugar definitivo dessa prova é
 * aqui: quem escolhe é o usuário, e é a ele que a lista precisa ser honesta.
 *
 * ### 🔴 A PERGUNTA DO HERO CHEIO
 *
 * `Principais` tem exatamente 4, sempre. Então **não existe "adicionar" ali —
 * existe TROCAR**, e a tela pergunta quem sai em vez de recusar calada.
 *
 * Recusar sem dizer nada é o pior dos três desfechos possíveis: o usuário clica,
 * nada acontece, e ele não descobre nem que há um limite nem o que fazer. A
 * segunda pior é aceitar e deixar a zona com 5 — a fileira quebra e a regra
 * morre. A pergunta é a única que informa **e** conclui a ação.
 *
 * ⚠️ Quem sai vai para o `Resumo`, se couber, e a tela DIZ isso antes do clique.
 * Sumir com a métrica que o usuário tinha escolhido seria perder a escolha dele
 * sem avisar — quem decide isso é o hook, e a frase aqui só descreve o que ele
 * faz.
 */

export interface MetricaDisponivel {
  chave: string;
  rotulo: string;
}

export interface PainelDisponivel {
  id: string;
  titulo: string;
  descricao: string;
}

export function CatalogoLateral({
  metricas,
  heroAtual,
  faixaCheia,
  aoAdicionarFaixa,
  aoTrocarHero,
  paineis,
  aoAdicionarPainel,
}: {
  metricas: MetricaDisponivel[];
  /** As 4 do hero, na ordem — é a lista que a pergunta oferece. */
  heroAtual: MetricaDisponivel[];
  faixaCheia: boolean;
  aoAdicionarFaixa: (chave: string) => void;
  aoTrocarHero: (chave: string, indice: number) => void;
  paineis: PainelDisponivel[];
  aoAdicionarPainel: (id: string) => void;
}) {
  /** A métrica cuja pergunta "quem sai do hero?" está aberta. */
  const [perguntando, setPerguntando] = React.useState<string | null>(null);

  return (
    <aside
      aria-label="Blocos disponíveis"
      className="bg-surface border border-border"
      style={{
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--tk-gap-grid)",
        position: "sticky",
        top: "var(--tk-gap-grid)",
        maxHeight: "calc(100vh - 2 * var(--tk-gap-grid))",
        overflowY: "auto",
      }}
    >
      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 className="text-label text-text" style={{ margin: 0 }}>Métricas disponíveis</h3>
        {metricas.length === 0 ? (
          <p className="text-caption text-text-muted" style={{ margin: 0 }}>
            Todas as métricas já estão no painel.
          </p>
        ) : (
          metricas.map((m) => (
            <div key={m.chave} className="border border-border" style={{ borderRadius: "var(--tk-radius-card)", padding: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span className="text-caption text-text" style={{ flex: 1, minWidth: 0 }}>{m.rotulo}</span>

                <BotaoAdd
                  rotulo="Principais"
                  aoClicar={() => setPerguntando((atual) => (atual === m.chave ? null : m.chave))}
                  expandido={perguntando === m.chave}
                />

                {faixaCheia ? (
                  /* ⚠️ Desabilitado COM MOTIVO, não desabilitado e mudo. O teto do
                     Resumo é do produto, não do dado — sem a frase, o botão
                     apagado parece defeito da ferramenta. */
                  <Tooltip texto="Resumo está no limite de 8. Remova uma métrica de lá para abrir espaço.">
                    <span tabIndex={0} style={{ display: "inline-flex" }}>
                      <BotaoAdd rotulo="Resumo" desabilitado />
                    </span>
                  </Tooltip>
                ) : (
                  <BotaoAdd rotulo="Resumo" aoClicar={() => aoAdicionarFaixa(m.chave)} />
                )}
              </div>

              {perguntando === m.chave && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.45 }}>
                    Principais tem sempre 4. Qual sai para <strong>{m.rotulo}</strong> entrar? Quem sair vai
                    para o Resumo, se houver espaço.
                  </p>
                  {heroAtual.map((h, i) => (
                    <button
                      key={h.chave}
                      type="button"
                      onClick={() => {
                        aoTrocarHero(m.chave, i);
                        setPerguntando(null);
                      }}
                      className="text-caption text-text border border-border rounded-controle cursor-pointer bg-transparent hover:bg-surface-hover text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
                      style={{ padding: "4px 8px" }}
                    >
                      {h.rotulo}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </section>

      <hr style={{ border: 0, borderTop: "1px solid var(--tk-border)", margin: 0 }} />

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 className="text-label text-text" style={{ margin: 0 }}>Painéis disponíveis</h3>
        {paineis.length === 0 ? (
          <p className="text-caption text-text-muted" style={{ margin: 0 }}>
            Todos os painéis já estão no painel.
          </p>
        ) : (
          paineis.map((p) => (
            <div key={p.id} className="border border-border" style={{ borderRadius: "var(--tk-radius-card)", padding: 8 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-caption text-text">{p.titulo}</div>
                  {/* A descrição diz o que o bloco RESPONDE. Sem ela a lista vira
                      sete nomes, e a escolha vira adivinhação. */}
                  <div className="text-caption text-text-muted" style={{ marginTop: 2, lineHeight: 1.4 }}>{p.descricao}</div>
                </div>
                <BotaoAdd rotulo="Adicionar" aoClicar={() => aoAdicionarPainel(p.id)} />
              </div>
            </div>
          ))
        )}
      </section>
    </aside>
  );
}

function BotaoAdd({
  rotulo,
  aoClicar,
  desabilitado = false,
  expandido,
}: {
  rotulo: string;
  aoClicar?: () => void;
  desabilitado?: boolean;
  expandido?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      aria-expanded={expandido}
      onClick={aoClicar}
      className="text-caption text-text-secondary border border-border rounded-controle cursor-pointer bg-transparent hover:bg-surface-hover hover:text-text disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1"
      style={{ padding: "2px 8px", flex: "none", lineHeight: 1.5 }}
    >
      + {rotulo}
    </button>
  );
}
