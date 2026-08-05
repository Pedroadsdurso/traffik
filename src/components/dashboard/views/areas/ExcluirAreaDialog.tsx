"use client";

import { useEffect, useState } from "react";

import {
  exportarDadosDaArea,
  preverExclusaoDaArea,
  type OpcoesExclusao,
  type PreviaExclusao,
} from "@/lib/actions/workspaces";
import { brl } from "@/lib/format";
import { sx } from "@/lib/sx";
import { Checkbox } from "../../ui/Checkbox";
import { Drawer } from "../../ui/Drawer";

/**
 * Exclusão de área de trabalho, com escolha por grupo.
 *
 * ## Por que deixou de ser um clique
 *
 * Antes, tudo que pertencia à área era transferido para a Principal
 * automaticamente. Isso protegia integração instalada e viva, mas poluía a
 * Principal com coisas que o usuário não reconhecia mais.
 *
 * ## ⛔ O padrão de cada grupo é o de MENOR RISCO — que não é sempre "mover"
 *
 * Conta, gateway e pixel: **mover**, porque excluir mataria integração
 * instalada. Vendas e visitas: **manter**.
 *
 * **Automação: EXCLUIR.** É a única coisa aqui que volta a AGIR sozinha, com
 * dinheiro real. Movida para a Principal ela chega desligada, mas a um clique de
 * distância — e regra sem conta específica vale para TODAS as contas da área onde
 * está, então religá-la por engano age em tudo que existe na Principal,
 * inclusive no que está otimizado e escalando. A auditoria é preservada pelo
 * **download do histórico**, que resolve a perda sem carregar o risco.
 *
 * **Taxa: EXCLUIR.** Uma taxa criada para uma operação encerrada continuaria
 * descontando do lucro da Principal.
 *
 * **Não existe "excluir tudo" num clique** — cada grupo é uma decisão
 * consciente, e apagar dados exige baixar o arquivo e digitar o nome da área.
 *
 * ⚠️ Os avisos falam da **consequência**, nunca do mecanismo: "a URL para de
 * funcionar e as vendas deixam de chegar", não "a FK vira nula".
 */

const VERMELHO = "#ef4444";
const AMBAR = "#f59e0b";

type Escolha = { valor: string; titulo: string; aviso?: string; perigo?: boolean };

function Grupo({
  titulo,
  itens,
  escolhas,
  valor,
  onChange,
}: {
  titulo: string;
  itens: string[];
  escolhas: Escolha[];
  valor: string;
  onChange: (v: string) => void;
}) {
  if (itens.length === 0) return null;
  const ativa = escolhas.find((e) => e.valor === valor);

  return (
    <div style={sx("padding:var(--space-3);border:1px solid var(--color-divider);border-radius:var(--radius-md);display:flex;flex-direction:column;gap:8px")}>
      <div>
        <div style={sx("font-size:13px;font-weight:600")}>{titulo}</div>
        <div className="text-muted" style={sx("font-size:12px;margin-top:2px")}>{itens.join(" · ")}</div>
      </div>

      <div style={sx("display:flex;flex-direction:column")}>
        {escolhas.map((e) => (
          <Checkbox
            key={e.valor}
            tipo="radio"
            checked={valor === e.valor}
            onChange={() => onChange(e.valor)}
            label={e.titulo}
          />
        ))}
      </div>

      {ativa?.aviso && (
        <div
          style={sx(
            `font-size:12px;line-height:1.5;padding:8px 10px;border-radius:var(--radius-sm);` +
              `background:color-mix(in srgb, ${ativa.perigo ? VERMELHO : AMBAR} 10%, transparent);` +
              `border:1px solid color-mix(in srgb, ${ativa.perigo ? VERMELHO : AMBAR} 40%, transparent)`,
          )}
        >
          {ativa.aviso}
        </div>
      )}
    </div>
  );
}

export function ExcluirAreaDialog({
  areaId,
  onFechar,
  onExcluida,
}: {
  areaId: string;
  onFechar: () => void;
  onExcluida: (apagouDados: boolean) => void;
}) {
  const [previa, setPrevia] = useState<PreviaExclusao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Padrões seguros. Nenhum deles apaga nada.
  const [contas, setContas] = useState("mover");
  const [webhooks, setWebhooks] = useState("mover");
  const [pixels, setPixels] = useState("mover");
  const [regras, setRegras] = useState("excluir");
  const [despesas, setDespesas] = useState("excluir");

  const [apagarDados, setApagarDados] = useState(false);
  const [baixou, setBaixou] = useState(false);
  const [baixouHistorico, setBaixouHistorico] = useState(false);
  const [nomeDigitado, setNomeDigitado] = useState("");

  useEffect(() => {
    let vivo = true;
    preverExclusaoDaArea(areaId)
      .then((p) => {
        if (!vivo) return;
        setPrevia(p);
        setCarregando(false);
      })
      .catch(() => setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [areaId]);

  const baixarArquivo = async () => {
    const json = await exportarDadosDaArea(areaId).catch(() => null);
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `traffik-${(previa?.nome ?? "area").replace(/[^\w-]+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBaixou(true);
  };

  const baixarHistorico = async () => {
    const { exportarHistoricoDasRegrasDaArea } = await import("@/lib/actions/workspaces");
    const json = await exportarHistoricoDasRegrasDaArea(areaId).catch(() => null);
    if (!json) return;
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `traffik-automacoes-${(previa?.nome ?? "area").replace(/[^\w-]+/g, "-").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBaixouHistorico(true);
  };

  const executar = async () => {
    setExecutando(true);
    setErro(null);
    const opcoes: OpcoesExclusao = {
      contas: contas as OpcoesExclusao["contas"],
      webhooks: webhooks as OpcoesExclusao["webhooks"],
      pixels: pixels as OpcoesExclusao["pixels"],
      regras: regras as OpcoesExclusao["regras"],
      despesas: despesas as OpcoesExclusao["despesas"],
      apagarDados,
      nomeDigitado: apagarDados ? nomeDigitado : undefined,
    };
    // Import dinâmico para o diálogo não puxar a action no bundle inicial.
    const { deleteWorkspace } = await import("@/lib/actions/workspaces");
    const r = await deleteWorkspace(areaId, opcoes).catch(() => null);
    setExecutando(false);
    if (!r?.ok) {
      setErro(
        r?.motivo === "nome-nao-confere"
          ? "O nome não confere. Digite exatamente como aparece acima."
          : r?.motivo === "principal"
            ? "A área principal não pode ser excluída."
            : "Não foi possível excluir. Tente novamente.",
      );
      return;
    }
    onExcluida(apagarDados);
  };

  const nomeConfere = previa != null && nomeDigitado.trim() === previa.nome.trim();
  // Excluir automação COM histórico exige baixar o registro antes: é a troca que
  // resolve a auditoria sem manter a regra viva.
  const precisaHistorico = previa != null && regras === "excluir" && previa.regras.some((r) => r.execucoes > 0);
  const podeExcluir =
    !executando && (!apagarDados || (baixou && nomeConfere)) && (!precisaHistorico || baixouHistorico);

  // Resumo em linguagem simples, montado a partir das escolhas.
  const resumo: string[] = [];
  if (previa) {
    if (previa.contas.length > 0)
      resumo.push(
        contas === "mover"
          ? "As contas de anúncio passam para a área Principal."
          : "As contas de anúncio saem da Trackhub, junto com o histórico de investimento delas.",
      );
    if (previa.webhooks.length > 0)
      resumo.push(webhooks === "mover" ? "Os gateways continuam recebendo vendas, agora na Principal." : "Os gateways são removidos e param de receber vendas.");
    if (previa.pixels.length > 0)
      resumo.push(pixels === "mover" ? "Os pixels continuam enviando eventos, agora na Principal." : "Os pixels são removidos e param de enviar eventos.");
    if (previa.regras.length > 0)
      resumo.push(
        regras === "mover"
          ? "As automações passam para a Principal, desligadas."
          : "As automações são removidas e param de agir.",
      );
    if (previa.despesas.length > 0)
      resumo.push(despesas === "mover" ? "As taxas passam para a Principal e descontam do lucro de lá." : "As taxas desta operação são removidas.");
    resumo.push(
      apagarDados
        ? `${previa.dados.vendas} vendas e ${previa.dados.cliques} visitas são apagadas para sempre.`
        : "Suas vendas, visitas e eventos continuam no histórico.",
    );
    resumo.push("O investimento já feito em anúncios continua no histórico.");
  }

  return (
    <Drawer
      aberta
      titulo="Excluir área de trabalho"
      descricao={previa?.nome}
      largura={580}
      onClose={onFechar}
      rodape={
        <div style={sx("display:flex;flex-direction:column;gap:10px")}>
          {erro && <p style={sx(`margin:0;font-size:12.5px;color:${VERMELHO}`)}>{erro}</p>}
          <div style={sx("display:flex;gap:var(--space-2);justify-content:flex-end")}>
            <button className="btn btn-ghost" type="button" onClick={onFechar}>Cancelar</button>
            <button className="btn btn-danger" type="button" disabled={!podeExcluir} onClick={executar}>
              {executando ? "Excluindo…" : "Excluir área"}
            </button>
          </div>
        </div>
      }
    >
      {carregando ? (
        <div className="skeleton" style={sx("height:140px;border-radius:var(--radius-md)")} />
      ) : !previa ? (
        <p className="card-body" style={sx("margin:0")}>Não foi possível carregar esta área.</p>
      ) : (
        <>
          <p className="card-body" style={sx("margin:0")}>
            Escolha o que fazer com o que está configurado aqui. Tudo já vem na opção mais segura —
            você só muda o que quiser.
          </p>

          <Grupo
            titulo="Contas de anúncio"
            itens={previa.contas.map((c) => c.nome)}
            valor={contas}
            onChange={setContas}
            escolhas={[
              { valor: "mover", titulo: "Mover para a área Principal" },
              {
                valor: "remover",
                titulo: "Remover da ferramenta",
                perigo: true,
                aviso:
                  "A conta sai da Trackhub junto com a área, e o histórico de investimento dela vai embora — todo o gasto já registrado, de todos os períodos. ROAS, ROI e CPA do passado deixam de existir para essas campanhas. Nada muda no Facebook: a conta continua lá, intacta.",
              },
            ]}
          />

          <Grupo
            titulo="Gateways de pagamento"
            itens={previa.webhooks.map((w) => `${w.nome} (${w.vendasRecebidas} vendas recebidas)`)}
            valor={webhooks}
            onChange={setWebhooks}
            escolhas={[
              { valor: "mover", titulo: "Mover para a área Principal" },
              {
                valor: "excluir",
                titulo: "Excluir",
                perigo: true,
                aviso:
                  "O endereço configurado no painel do seu gateway vai parar de funcionar, e as vendas dele deixam de chegar na Trackhub. As vendas que já entraram continuam no histórico, mas deixam de aparecer ligadas a esse gateway.",
              },
            ]}
          />

          <Grupo
            titulo="Pixels"
            itens={previa.pixels.map((p) => `${p.nome} (${p.eventosRegistrados} eventos)`)}
            valor={pixels}
            onChange={setPixels}
            escolhas={[
              { valor: "mover", titulo: "Mover para a área Principal" },
              {
                valor: "excluir",
                titulo: "Excluir",
                perigo: true,
                aviso:
                  "O código instalado na sua página de vendas vai parar de registrar eventos. Os eventos já registrados continuam no histórico, mas deixam de aparecer ligados a esse pixel.",
              },
            ]}
          />

          {previa.regras.length > 0 && (
            <div style={sx("padding:var(--space-3);border:1px solid var(--color-divider);border-radius:var(--radius-md);display:flex;flex-direction:column;gap:8px")}>
              <div>
                <div style={sx("font-size:13px;font-weight:600")}>Automações</div>
                <div className="text-muted" style={sx("font-size:12px;margin-top:2px")}>
                  {previa.regras
                    .map((r) => `${r.nome}${r.execucoes > 0 ? ` — ${r.execucoes} ${r.execucoes === 1 ? "execução" : "execuções"}` : " — nunca rodou"}`)
                    .join(" · ")}
                </div>
              </div>

              <div style={sx("display:flex;flex-direction:column")}>
                <Checkbox
                  tipo="radio"
                  checked={regras === "excluir"}
                  onChange={() => setRegras("excluir")}
                  label="Excluir junto com a área"
                  dica="Recomendado."
                />
                <Checkbox
                  tipo="radio"
                  checked={regras === "mover"}
                  onChange={() => setRegras("mover")}
                  label="Mover para a Principal, desligada"
                />
              </div>

              {regras === "excluir" && previa.regras.some((r) => r.execucoes > 0) && (
                <div>
                  <button className="btn btn-secondary" type="button" onClick={baixarHistorico} style={sx("font-size:12px")}>
                    {baixouHistorico ? "✓ Histórico baixado" : "Baixar o histórico antes"}
                  </button>
                  <div className="text-muted" style={sx("font-size:11.5px;margin-top:5px")}>
                    Guarda o registro do que cada automação já fez nas suas campanhas.
                  </div>
                </div>
              )}

              {/* 🔴 O aviso mais importante do diálogo. Regra sem conta específica
                  vale para TODAS as contas da área onde está — movida para a
                  Principal, ela chega apta a agir sobre tudo que existe lá. */}
              {regras === "mover" && (
                <div
                  style={sx(
                    "font-size:12px;line-height:1.5;padding:8px 10px;border-radius:var(--radius-sm);" +
                      `background:color-mix(in srgb, ${VERMELHO} 10%, transparent);border:1px solid color-mix(in srgb, ${VERMELHO} 40%, transparent)`,
                  )}
                >
                  {previa.regras.some((r) => r.semContaEspecifica) ? (
                    <>
                      <strong>Atenção:</strong> {previa.regras.filter((r) => r.semContaEspecifica).length === 1 ? "uma destas automações não está limitada" : "algumas destas automações não estão limitadas"}{" "}
                      a contas específicas. Se você religá-{previa.regras.filter((r) => r.semContaEspecifica).length === 1 ? "la" : "las"} na Principal,{" "}
                      {previa.regras.filter((r) => r.semContaEspecifica).length === 1 ? "ela vai agir" : "elas vão agir"} em <strong>todas as campanhas de lá</strong> —
                      inclusive nas que estão otimizadas e escalando.
                    </>
                  ) : (
                    <>
                      Vão para a Principal desligadas. Confira o que cada uma faz antes de religar:
                      as campanhas de lá são outras.
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          <Grupo
            titulo="Taxas e custos"
            itens={previa.despesas.map((d) => d.nome)}
            valor={despesas}
            onChange={setDespesas}
            escolhas={[
              {
                valor: "excluir",
                titulo: "Excluir junto com a área",
                aviso: "Recomendado. Uma taxa criada para esta operação continuaria descontando do lucro da Principal.",
              },
              { valor: "mover", titulo: "Mover para a área Principal" },
            ]}
          />

          <div style={sx("height:1px;background:var(--color-divider)")} />

          {/* ── Parte 2: os dados ──────────────────────────────────────────── */}
          <div style={sx("display:flex;flex-direction:column;gap:8px")}>
            <div style={sx("font-size:13px;font-weight:600")}>Suas vendas e visitas</div>
            <div className="text-muted" style={sx("font-size:12px;line-height:1.5")}>
              Esta área tem <strong>{previa.dados.vendas} vendas</strong> ({brl(previa.dados.faturamento)}),{" "}
              <strong>{previa.dados.cliques} visitas</strong> e <strong>{previa.dados.eventos} eventos</strong>.
              Por padrão tudo continua no seu histórico.
            </div>

            <Checkbox
              checked={apagarDados}
              onChange={(v) => {
                setApagarDados(v);
                setNomeDigitado("");
              }}
              label="Também quero apagar esses dados"
              dica="Não dá para desfazer."
            />

            {apagarDados && (
              <div
                style={sx(
                  "display:flex;flex-direction:column;gap:10px;padding:var(--space-3);border-radius:var(--radius-md);" +
                    `background:color-mix(in srgb, ${VERMELHO} 8%, transparent);border:1px solid color-mix(in srgb, ${VERMELHO} 45%, transparent)`,
                )}
              >
                <div style={sx("font-size:12.5px;line-height:1.55")}>
                  Você vai apagar <strong>{previa.dados.vendas} vendas</strong>, somando{" "}
                  <strong>{brl(previa.dados.faturamento)}</strong> de faturamento. Isso muda seu histórico
                  para sempre e <strong>não tem como voltar atrás</strong>.
                </div>

                <div>
                  <button className="btn btn-secondary" type="button" onClick={baixarArquivo} style={sx("font-size:12px")}>
                    {baixou ? "✓ Arquivo baixado" : "1. Baixar uma cópia antes"}
                  </button>
                  {!baixou && (
                    <div className="text-muted" style={sx("font-size:11.5px;margin-top:5px")}>
                      Guarde este arquivo. É a única forma de recuperar esses dados depois.
                    </div>
                  )}
                </div>

                <div style={sx(baixou ? "" : "opacity:.45;pointer-events:none")}>
                  <div style={sx("font-size:12px;margin-bottom:5px")}>
                    2. Para confirmar, digite <strong>{previa.nome}</strong>
                  </div>
                  <input
                    className="input"
                    value={nomeDigitado}
                    placeholder={previa.nome}
                    onChange={(e) => setNomeDigitado(e.target.value)}
                    style={sx(`max-width:280px${nomeDigitado && !nomeConfere ? `;border-color:${VERMELHO}` : ""}`)}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={sx("height:1px;background:var(--color-divider)")} />

          {/* ── Resumo ────────────────────────────────────────────────────── */}
          <div>
            <div style={sx("font-size:13px;font-weight:600;margin-bottom:6px")}>O que vai acontecer</div>
            <ul style={sx("margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px")}>
              {resumo.map((r, i) => (
                <li key={i} style={sx("font-size:12.5px;line-height:1.5")}>{r}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </Drawer>
  );
}
