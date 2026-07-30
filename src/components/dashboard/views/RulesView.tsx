"use client";

import { useEffect, useState } from "react";

import { listAdProfiles } from "@/lib/actions/facebook";
import { listTrackedProducts } from "@/lib/actions/pixels";
import {
  createRule,
  deleteRule,
  duplicateRule,
  listRules,
  toggleRule,
  updateRule,
  type RuleDTO,
} from "@/lib/actions/rules";
import { brl, elapsed, plural } from "@/lib/format";
import { sx } from "@/lib/sx";
import { Icone } from "../ui/Icone";
import { Drawer } from "../ui/Drawer";
import { Modal } from "../ui/Modal";
import { RASCUNHO_REGRA, RuleDrawer, deRegra, paraInput, type RascunhoRegra } from "./rules/RuleDrawer";

/**
 * Regras de Automação (Bloco 8).
 *
 * Autocontida — busca por server action e mantém estado local, mesmo padrão de
 * `UtmsView`/`PixelView`/`AreasView`. Só recebe a área ativa.
 *
 * ⚠️ **Sem `<select>` nativo.** Tudo pelo `ui/Select` e `ui/Checkbox`, para a
 * padronização visual não precisar refazer esta tela.
 *
 * ⛔ **Import/export ficou FORA**, por decisão do usuário: não havia regra
 * nenhuma cadastrada, então exportar não tinha o que exportar. Se voltar, o
 * formato natural é o `RuleDTO` em JSON, e a validação crítica na importação é
 * **conta de anúncio que não existe nesta conta** — ids são por usuário.
 */

const VERMELHO = "#ef4444";
const AMARELO = "#f59e0b";
const VERDE = "#22c55e";

const STATUS_COR: Record<string, string> = { SUCESSO: VERDE, SEM_ACAO: "var(--color-text)", ERRO: VERMELHO };
const STATUS_LABEL: Record<string, string> = { SUCESSO: "Agiu", SEM_ACAO: "Sem ação", ERRO: "Erro" };

export function RulesView({ workspaceId }: { workspaceId: string | null }) {
  const [regras, setRegras] = useState<RuleDTO[]>([]);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [contas, setContas] = useState<{ id: string; label: string; detalhe?: string }[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [rascunho, setRascunho] = useState<RascunhoRegra | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [logDe, setLogDe] = useState<RuleDTO | null>(null);
  const [excluir, setExcluir] = useState<RuleDTO | null>(null);

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    Promise.all([listRules(workspaceId), listTrackedProducts(), listAdProfiles(workspaceId)])
      .then(([rs, ps, perfis]) => {
        if (!vivo) return;
        setRegras(rs);
        setProdutos(ps);
        // As contas vêm da ÁREA ativa (`listAdProfiles` já é escopado), então o
        // formulário nunca oferece conta de outra operação.
        setContas(
          perfis.flatMap((p) =>
            p.accounts.map((a) => ({ id: a.id, label: a.name, detalhe: `${a.fbAccountId} · ${p.name}` })),
          ),
        );
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [workspaceId]);

  const salvar = async () => {
    if (!rascunho) return;
    setSalvando(true);
    setErro(null);
    try {
      const input = paraInput(rascunho, workspaceId);
      if (rascunho.id) {
        const r = await updateRule(rascunho.id, input);
        if (r) setRegras((rs) => rs.map((x) => (x.id === r.id ? r : x)));
      } else {
        const r = await createRule(input);
        setRegras((rs) => [r, ...rs]);
      }
      setRascunho(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar a regra.");
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (r: RuleDTO) => {
    // Otimista: o toggle tem de responder no clique. Se falhar, volta ao estado
    // anterior — uma regra que parece ligada e não está é pior que um erro.
    setRegras((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)));
    try {
      await toggleRule(r.id);
    } catch {
      setRegras((rs) => rs.map((x) => (x.id === r.id ? { ...x, active: r.active } : x)));
    }
  };

  const duplicar = async (r: RuleDTO) => {
    const c = await duplicateRule(r.id).catch(() => null);
    if (c) setRegras((rs) => [c, ...rs]);
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    await deleteRule(excluir.id).catch(() => {});
    setRegras((rs) => rs.filter((x) => x.id !== excluir.id));
    setExcluir(null);
  };

  if (carregando) return <div className="card skeleton" style={sx("height:180px")} />;

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      {regras.length === 0 ? (
        <div
          className="card"
          style={sx("display:flex;flex-direction:column;align-items:center;gap:12px;padding:var(--space-6) var(--space-4);text-align:center")}
        >
          <Icone nome="automacao" tamanho={34} cor="marca" />
          <div>
            <div className="card-title">Nenhuma regra ainda</div>
            <p className="card-body" style={sx("margin:6px auto 0;max-width:46ch")}>
              Uma regra observa suas métricas e age sozinha — pausa a campanha que passou do CPA, ou
              aumenta o orçamento da que está performando. Você define os limites.
            </p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setRascunho(RASCUNHO_REGRA)}>
            Criar regra
          </button>
        </div>
      ) : (
        <>
          <div style={sx("display:flex;justify-content:flex-end")}>
            <button className="btn btn-primary" type="button" onClick={() => setRascunho(RASCUNHO_REGRA)}>
              Criar regra
            </button>
          </div>

          <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
            {regras.map((r) => (
              <CardRegra
                key={r.id}
                r={r}
                contas={contas}
                onToggle={() => alternar(r)}
                onEditar={() => setRascunho(deRegra(r))}
                onDuplicar={() => duplicar(r)}
                onLog={() => setLogDe(r)}
                onExcluir={() => setExcluir(r)}
              />
            ))}
          </div>
        </>
      )}

      {rascunho && (
        <RuleDrawer
          aberta
          rascunho={rascunho}
          setRascunho={setRascunho}
          produtos={produtos}
          contas={contas}
          salvando={salvando}
          erro={erro}
          onSalvar={salvar}
          onFechar={() => {
            setRascunho(null);
            setErro(null);
          }}
        />
      )}

      {logDe && <GavetaLog r={logDe} onClose={() => setLogDe(null)} />}

      {excluir && (
        <Modal aberta titulo="Excluir regra" onClose={() => setExcluir(null)}>
          <p className="card-body" style={sx("margin:0")}>
            A regra <strong>{excluir.name}</strong> será removida, junto com o histórico de execuções dela.
          </p>
          <p className="text-muted" style={sx("margin:8px 0 0;font-size:12.5px")}>
            O que ela já fez nas campanhas <strong>não é desfeito</strong> — a Meta não oferece desfazer.
            Se o objetivo é só parar de agir, o toggle desativa e preserva o histórico.
          </p>
          <div style={sx("display:flex;gap:var(--space-2);justify-content:flex-end;margin-top:var(--space-4)")}>
            <button className="btn btn-ghost" type="button" onClick={() => setExcluir(null)}>Cancelar</button>
            <button className="btn btn-danger" type="button" onClick={confirmarExclusao}>Excluir</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CardRegra({
  r, contas, onToggle, onEditar, onDuplicar, onLog, onExcluir,
}: {
  r: RuleDTO;
  contas: { id: string; label: string }[];
  onToggle: () => void;
  onEditar: () => void;
  onDuplicar: () => void;
  onLog: () => void;
  onExcluir: () => void;
}) {
  const nomeContas =
    r.adAccountIds.length === 0
      ? "Todas as contas da área"
      : r.adAccountIds.map((id) => contas.find((c) => c.id === id)?.label ?? "conta removida").join(", ");
  const nomeProdutos = r.targetProducts.length === 0 ? "Todos os produtos" : r.targetProducts.join(", ");
  const ultimo = r.logs[0];

  // ⚠️ Regra de aumento SEM teto é recusada pelo motor. Sem este aviso ela
  // pareceria ligada e funcionando, e nunca agiria — falha silenciosa na tela.
  const aumentaSemTeto =
    r.action === "AJUSTAR_ORCAMENTO" && (r.actionParams?.valor ?? 0) > 0 && r.maxBudget == null;

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:10px")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3)")}>
        <div style={sx("min-width:0")}>
          <div style={sx("font-size:15px;font-weight:600")}>{r.name}</div>
          <div className="text-muted" style={sx("font-size:12.5px;margin-top:2px")}>{r.summary}</div>
        </div>
        {/* ⚠️ `.sw` é estilizado para `<button role="switch">`, NÃO para
            `<input type="checkbox">`. Com o input, o `::after` do CSS desenhava a
            bolinha do switch EM CIMA do checkbox nativo. Todos os outros toggles
            da ferramenta usam este mesmo padrão de botão. */}
        <button
          className="sw"
          role="switch"
          aria-checked={r.active}
          onClick={onToggle}
          aria-label={`${r.active ? "Desativar" : "Ativar"} ${r.name}`}
          style={sx("flex:none")}
        />
      </div>

      {aumentaSemTeto && (
        <div style={sx(`display:flex;gap:8px;align-items:flex-start;font-size:12px;color:${AMARELO}`)}>
          <Icone nome="aviso" tamanho={15} cor="aviso" />
          <span>
            Aumento <strong>sem teto de orçamento</strong> — o motor recusa esta ação por segurança.
            Edite a regra e informe o teto para ela voltar a agir.
          </span>
        </div>
      )}

      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;font-size:12px")}>
        <Info rotulo="Produtos" valor={nomeProdutos} />
        <Info rotulo="Contas" valor={nomeContas} />
        <Info rotulo="Frequência" valor={`a cada ${r.frequencyMin} min`} />
        <Info
          rotulo="Janela"
          valor={
            r.windowStartHour == null || r.windowEndHour == null
              ? "qualquer hora"
              : `${String(r.windowStartHour).padStart(2, "0")}h–${String(r.windowEndHour).padStart(2, "0")}h`
          }
        />
        <Info rotulo="Limite diário" valor={r.dailyRunLimit >= 9999 ? "sem limite" : String(r.dailyRunLimit)} />
        <Info rotulo="Teto de orçamento" valor={r.maxBudget == null ? "—" : brl(r.maxBudget)} />
      </div>

      <div
        style={sx(
          "display:flex;align-items:center;justify-content:space-between;gap:var(--space-2);flex-wrap:wrap;" +
            "padding-top:8px;border-top:1px solid var(--color-divider)",
        )}
      >
        <div className="text-muted" style={sx("font-size:12px;display:flex;align-items:center;gap:7px")}>
          {ultimo ? (
            <>
              <span style={sx(`width:7px;height:7px;border-radius:50%;background:${STATUS_COR[ultimo.status] ?? "var(--color-text)"}`)} />
              <span>{STATUS_LABEL[ultimo.status] ?? ultimo.status} · {elapsed(new Date(ultimo.ranAt).getTime())}</span>
            </>
          ) : (
            <span>Nunca executou</span>
          )}
        </div>
        <div style={sx("display:flex;gap:4px;flex-wrap:wrap")}>
          <button className="btn btn-ghost" type="button" onClick={onLog} style={sx("font-size:12px")}>
            Histórico ({r.logs.length})
          </button>
          <button className="btn btn-ghost" type="button" onClick={onEditar} style={sx("font-size:12px")}>Editar</button>
          <button className="btn btn-ghost" type="button" onClick={onDuplicar} style={sx("font-size:12px")}>Duplicar</button>
          <button className="btn btn-ghost" type="button" onClick={onExcluir} style={sx(`font-size:12px;color:${VERMELHO}`)}>Excluir</button>
        </div>
      </div>
    </div>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={sx("min-width:0")}>
      <div className="text-muted" style={sx("font-size:10.5px;text-transform:uppercase;letter-spacing:.08em")}>{rotulo}</div>
      <div style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")} title={valor}>{valor}</div>
    </div>
  );
}

/**
 * Histórico de execuções.
 *
 * Mostra **os valores que a regra viu**, não só "sem ação" — é a diferença
 * entre um log que serve para auditar e um que apenas informa que algo rodou.
 * Quem pergunta "por que ela não disparou?" precisa do número.
 */
function GavetaLog({ r, onClose }: { r: RuleDTO; onClose: () => void }) {
  return (
    <Drawer aberta titulo="Histórico de execuções" descricao={r.name} largura={560} onClose={onClose}>
      {r.logs.length === 0 ? (
        <p className="card-body" style={sx("margin:0")}>
          Esta regra ainda não executou. Quando ativa, ela roda pelo cron a cada {r.frequencyMin} minutos.
        </p>
      ) : (
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
          {r.logs.map((l) => (
            <div key={l.id} style={sx("padding-bottom:var(--space-3);border-bottom:1px solid var(--color-divider)")}>
              <div style={sx("display:flex;align-items:center;gap:8px;font-size:12.5px;flex-wrap:wrap")}>
                <span style={sx(`width:7px;height:7px;border-radius:50%;background:${STATUS_COR[l.status] ?? "var(--color-text)"}`)} />
                <strong>{STATUS_LABEL[l.status] ?? l.status}</strong>
                <span className="text-muted">{new Date(l.ranAt).toLocaleString("pt-BR")}</span>
                {l.affected > 0 && <span className="tag tag-neutral" style={sx("font-size:11px")}>{plural(l.affected, "campanha afetada", "campanhas afetadas")}</span>}
              </div>

              {l.message && <div className="text-muted" style={sx("font-size:12px;margin-top:4px")}>{l.message}</div>}

              {l.details?.condicoes && (
                <div style={sx("font-size:11.5px;margin-top:6px")}>
                  <span className="text-muted">Condição: </span>
                  <code>{l.details.condicoes}</code>
                </div>
              )}

              {l.details?.avaliado && l.details.avaliado.length > 0 && (
                <div style={sx("margin-top:6px;display:flex;flex-direction:column;gap:2px")}>
                  {l.details.avaliado.map((a, i) => (
                    <div key={i} style={sx("display:flex;gap:7px;font-size:11.5px;align-items:baseline")}>
                      <span aria-hidden style={sx(`flex:none;color:${a.bateu ? VERDE : "var(--color-text)"};opacity:${a.bateu ? 1 : 0.4}`)}>
                        {a.bateu ? "✓" : "·"}
                      </span>
                      <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{a.nome}</span>
                      <span className="text-muted" style={sx("flex:none;font-variant-numeric:tabular-nums")}>
                        {Object.entries(a.valores)
                          .map(([k, v]) => `${k}=${v == null ? "—" : Number(v).toFixed(2)}`)
                          .join(" · ")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {l.details?.aplicado && l.details.aplicado.length > 0 && (
                <div style={sx("margin-top:6px;display:flex;flex-direction:column;gap:2px")}>
                  {l.details.aplicado.map((a, i) => (
                    <div key={i} style={sx(`font-size:11.5px;color:${a.ok ? "inherit" : VERMELHO}`)}>
                      {a.ok ? "✓" : "✗"} {a.name} — {a.action}
                      {a.error && <span className="text-muted"> ({a.error})</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
}
