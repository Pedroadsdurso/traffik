"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  carregarOpcoesAreas,
  produtosDescobertos,
  type ProdutoDescoberto,
  contasOcupadas,
  createWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  updateWorkspace,
  type ContaOcupada,
  type OpcoesAreas,
  type WorkspaceDTO,
} from "@/lib/actions/workspaces";
import { brl, palavra } from "@/lib/format";
import { getPendenciasDasAreas, type PendenciasDTO } from "@/lib/actions/diagnostics";
import { CONFIG } from "@/lib/explicacoes";
import { sx } from "@/lib/sx";
import { Icone } from "../ui/Icone";
import { ExcluirAreaDialog } from "./areas/ExcluirAreaDialog";
import { Drawer } from "../ui/Drawer";
import { InfoTip, type ConteudoInfo } from "../ui/InfoTip";
import { ListaSelecionavel, type ItemSelecionavel } from "../ui/ListaSelecionavel";

/** Cores do marcador. Poucas e distintas — o ponto tem 8px, gradação não se lê. */
const CORES = ["#8b5cf6", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4", "#84cc16"];

const AMARELO = "var(--color-warning,#fbbf24)";
const VERMELHO = "var(--color-danger,#f87171)";

/** Produtos DESCOBERTOS por área — informação, não configuração. */
type ChecksPorArea = Record<string, ProdutoDescoberto[]>;

interface Rascunho {
  id: string | null; // null = criando
  isDefault: boolean;
  name: string;
  color: string | null;
  description: string;
  accountIds: string[];
  webhookIds: string[];
  pixelConfigIds: string[];
  /** Contas que o usuário mandou SAIR de outra área para vir para esta. */
  moverContas: string[];
}

const RASCUNHO_VAZIO: Rascunho = {
  id: null, isDefault: false, name: "", color: CORES[0]!, description: "",
  accountIds: [], webhookIds: [], pixelConfigIds: [], moverContas: [],
};

const deArea = (a: WorkspaceDTO): Rascunho => ({
  id: a.id, isDefault: a.isDefault, name: a.name, color: a.color, description: a.description ?? "",
  accountIds: [...a.accountIds],
  webhookIds: [...a.webhookIds], pixelConfigIds: [...a.pixelConfigIds], moverContas: [],
});

// ──────────────────────────── Pendências ────────────────────────────

interface Pendencia {
  texto: string;
  /** `aviso` = configurado mas provavelmente quebrado; `info` = só não configurado. */
  nivel: "aviso" | "info";
}

/**
 * O que falta configurar numa área, dito em consequência e não em jargão.
 *
 * A regra que vale para todos os campos: **lista vazia não filtra**. Uma área
 * sem nenhum vínculo vê TUDO — e passa a mostrar dados que pertencem às outras
 * áreas. É o único jeito de o isolamento falhar, e por isso é o primeiro aviso.
 */
/**
 * Pendências do card.
 *
 * ⚠️ **A fonte é `getPendenciasDaArea` (servidor), não as listas do
 * `Workspace`.** Esta função lia `a.accountIds`/`a.webhookIds` — os arrays que
 * a Sessão 1 substituiu por FK. O resultado era um card dizendo "Sem webhook"
 * para uma área com webhook vinculado, porque criar dentro da área grava a FK e
 * não o array. Duas fontes para a mesma pergunta divergem sempre; agora existe
 * uma, e esta função só a apresenta.
 */
function pendencias(
  a: WorkspaceDTO,
  pend: PendenciasDTO | undefined,
  totalDeAreas: number,
): Pendencia[] {
  // A PRINCIPAL não tem pendência de configuração: é o catch-all, e o escopo
  // dela é derivado das outras áreas em vez de configurado à mão.
  if (a.isDefault) {
    return [
      {
        nivel: "info",
        texto:
          totalDeAreas <= 1
            ? "Sua operação principal. O que você mover para outras áreas deixa de aparecer aqui."
            : "Sua operação principal. Recebe tudo o que não pertence às outras áreas — inclusive visitas sem UTM e vendas sem origem identificada.",
      },
    ];
  }

  if (!pend) return [];
  if (pend.faltando.length === 0) {
    return [{ nivel: "info", texto: `Configurada — ${pend.ok} de ${pend.total} itens prontos.` }];
  }
  return pend.faltando.map((i) => ({
    nivel: "aviso" as const,
    texto: `${i.label} — ${i.detail}`,
  }));
}


// ──────────────────────────── Tela ────────────────────────────

export function AreasView() {
  const router = useRouter();

  const [areas, setAreas] = useState<WorkspaceDTO[]>([]);
  const [opcoes, setOpcoes] = useState<OpcoesAreas | null>(null);
  const [checks, setChecks] = useState<ChecksPorArea>({});
  /** Pendências por área — fonte única, vinda do servidor. */
  const [pends, setPends] = useState<Record<string, PendenciasDTO>>({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [ocupadas, setOcupadas] = useState<ContaOcupada[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<WorkspaceDTO | null>(null);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

  const recarregar = useCallback(async () => {
    try {
      const [as, op, ck] = await Promise.all([listWorkspaces(), carregarOpcoesAreas(), produtosDescobertos()]);
      // As pendências vêm depois porque dependem da lista de áreas.
      const pd = await getPendenciasDasAreas(as.map((a) => a.id)).catch(() => ({}));
      setAreas(as);
      setOpcoes(op);
      setChecks(ck);
      setPends(pd as Record<string, PendenciasDTO>);
      setErro(null);
    } catch {
      setErro("Não foi possível carregar as áreas.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega as áreas do servidor
    void recarregar();
  }, [recarregar]);

  /** Depois de mutar: recarrega a tela E o layout, porque o seletor da sidebar
   *  vem do server component e não saberia da mudança sozinho. */
  const aposMutar = useCallback(async () => {
    await recarregar();
    router.refresh();
  }, [recarregar, router]);

  async function abrir(area: WorkspaceDTO | null) {
    setRascunho(area ? deArea(area) : { ...RASCUNHO_VAZIO });
    setOcupadas([]);
    setErro(null);
    // Quem decide o que está ocupado é o SERVIDOR, mesmo tendo a lista de áreas
    // aqui: duplicar a regra no cliente é como ela passa a divergir.
    if (opcoes) {
      const r = await contasOcupadas(opcoes.accounts.map((a) => a.id), area?.id ?? null).catch(() => []);
      setOcupadas(r);
    }
  }

  async function salvar() {
    if (!rascunho) return;
    if (!rascunho.name.trim()) {
      setErro("Dê um nome à área.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const payload = {
        name: rascunho.name,
        color: rascunho.color,
        description: rascunho.description,
        accountIds: rascunho.accountIds,
        webhookIds: rascunho.webhookIds,
        pixelConfigIds: rascunho.pixelConfigIds,
        moverContas: rascunho.moverContas,
      };
      const r = rascunho.id ? await updateWorkspace(rascunho.id, payload) : await createWorkspace(payload);
      if (!r) {
        setErro("Área não encontrada.");
        return;
      }
      if (!r.ok) {
        if (r.motivo === "principal-nao-arquiva") {
          setErro("A área principal não pode ser arquivada — ela é a operação padrão da conta.");
          return;
        }
        const nomes = [...new Set(r.conflitos.map((c) => c.workspaceName))].join(", ");
        setErro(`Conta de anúncio já vinculada a outra área (${nomes}). Use “Mover para cá” ou remova-a de lá primeiro.`);
        return;
      }
      setRascunho(null);
      await aposMutar();
    } catch {
      setErro("Falha ao salvar a área.");
    } finally {
      setSalvando(false);
    }
  }

  async function duplicar(id: string) {
    await duplicateWorkspace(id).catch(() => null);
    await aposMutar();
  }

  async function arquivar(a: WorkspaceDTO) {
    await updateWorkspace(a.id, { archived: !a.archived }).catch(() => null);
    await aposMutar();
  }

  const ativas = areas.filter((a) => !a.archived);
  const arquivadas = areas.filter((a) => a.archived);
  const listadas = mostrarArquivadas ? arquivadas : ativas;

  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-4)")}>
      <div className="card" style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-3);flex-wrap:wrap")}>
        <div style={sx("min-width:260px;flex:1")}>
          <div className="card-kicker">Áreas de Trabalho</div>
          <div className="card-title">Separe suas operações sem misturar os números</div>
          <p className="card-body" style={sx("margin:4px 0 0;max-width:70ch")}>
            Cada área é uma operação sua — uma oferta, um nicho, um cliente. Ao entrar numa delas, o painel
            inteiro passa a mostrar só o que é dela: vendas, gasto, campanhas e integrações.
          </p>
          <p className="text-muted" style={sx("margin:6px 0 0;max-width:70ch;font-size:12.5px")}>
            Ao excluir uma área, você escolhe o que fazer com cada coisa configurada nela. Suas vendas e
            visitas ficam no histórico por padrão.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => void abrir(null)} style={sx("white-space:nowrap")}>
          + Nova área
        </button>
      </div>

      {/* ⚠️ A condição inclui `mostrarArquivadas`, e não só `arquivadas.length`.
          Desarquivar a última área estando nesta aba zerava a contagem, a barra
          desaparecia e o usuário ficava preso numa lista vazia sem botão de
          voltar — reportado em teste. */}
      {(arquivadas.length > 0 || mostrarArquivadas) && (
        <div style={sx("display:flex;gap:6px")}>
          <button className={mostrarArquivadas ? "btn btn-ghost" : "btn btn-secondary"} type="button" onClick={() => setMostrarArquivadas(false)}>
            Ativas ({ativas.length})
          </button>
          <button className={mostrarArquivadas ? "btn btn-secondary" : "btn btn-ghost"} type="button" onClick={() => setMostrarArquivadas(true)}>
            Arquivadas ({arquivadas.length})
          </button>
        </div>
      )}

      {mostrarArquivadas && arquivadas.length === 0 && (
        <div className="card" style={sx("text-align:center;padding:var(--space-5) var(--space-4)")}>
          <div className="card-body">Nenhuma área arquivada.</div>
          <button className="btn btn-secondary" type="button" onClick={() => setMostrarArquivadas(false)} style={sx("margin-top:var(--space-3)")}>
            Voltar para as áreas ativas
          </button>
        </div>
      )}

      {erro && !rascunho && <div className="card" style={sx(`color:${VERMELHO};font-size:13px`)}>{erro}</div>}

      {carregando ? (
        <div className="card text-muted" style={sx("font-size:13px")}>Carregando áreas…</div>
      ) : listadas.length === 0 ? (
        <div className="card text-muted" style={sx("text-align:center;font-size:13px;padding:var(--space-6)")}>
          {mostrarArquivadas
            ? "Nenhuma área arquivada."
            : <>Nenhuma área criada. Clique em <strong>Nova área</strong> para separar uma operação das demais.</>}
        </div>
      ) : (
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:var(--space-4);align-items:start")}>
          {listadas.map((a) => (
            <AreaCard
              key={a.id}
              area={a}
              opcoes={opcoes}
              checks={checks[a.id]}
              pend={pends[a.id]}
              totalDeAreas={areas.length}
              onEditar={() => void abrir(a)}
              onDuplicar={() => void duplicar(a.id)}
              onArquivar={() => void arquivar(a)}
              onExcluir={() => setExcluindo(a)}
            />
          ))}
        </div>
      )}

      {rascunho && opcoes && (
        <AreaDrawer
          rascunho={rascunho}
          setRascunho={setRascunho}
          opcoes={opcoes}
          ocupadas={ocupadas}
          salvando={salvando}
          erro={erro}
          onSalvar={() => void salvar()}
          onFechar={() => { setRascunho(null); setErro(null); }}
        />
      )}

      {excluindo && (
        <ExcluirAreaDialog
          areaId={excluindo.id}
          onFechar={() => setExcluindo(null)}
          onExcluida={() => {
            setExcluindo(null);
            void aposMutar();
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────── Card ────────────────────────────

function Chips({ titulo, itens, vazio }: { titulo: string; itens: string[]; vazio: string }) {
  return (
    <div>
      <div className="text-muted" style={sx("font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px")}>
        {titulo}
      </div>
      {itens.length === 0 ? (
        <div className="text-muted" style={sx("font-size:12px")}>{vazio}</div>
      ) : (
        <div style={sx("display:flex;flex-wrap:wrap;gap:4px")}>
          {itens.map((t) => (
            <span key={t} className="tag tag-neutral" style={sx("font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap")}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function AreaCard({
  area, opcoes, checks, pend: pendDto, totalDeAreas, onEditar, onDuplicar, onArquivar, onExcluir,
}: {
  area: WorkspaceDTO;
  opcoes: OpcoesAreas | null;
  checks: ProdutoDescoberto[] | undefined;
  pend: PendenciasDTO | undefined;
  totalDeAreas: number;
  onEditar: () => void;
  onDuplicar: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
}) {
  // Ids que não têm mais nome (webhook/pixel excluído depois de vinculado)
  // aparecem como o próprio id em vez de sumir — sumir esconderia um filtro
  // ativo que continua restringindo a tela.
  const nome = (id: string, lista: { id: string; name: string }[] | undefined) =>
    lista?.find((x) => x.id === id)?.name ?? `${id.slice(0, 8)}… (removido)`;

  const contas = area.accountIds.map((id) => nome(id, opcoes?.accounts));
  const webhooks = area.webhookIds.map((id) => nome(id, opcoes?.webhooks));
  const pixels = area.pixelConfigIds.map((id) => nome(id, opcoes?.pixels));
  const pend = pendencias(area, pendDto, totalDeAreas);

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:flex-start;gap:10px")}>
        <span aria-hidden style={sx(`width:10px;height:10px;border-radius:3px;margin-top:5px;flex:none;background:${area.color || "var(--color-neutral-400)"}`)} />
        <div style={sx("min-width:0;flex:1")}>
          <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
            <span className="card-title" style={sx("font-size:15px")}>{area.name}</span>
            {area.isDefault && <span className="tag tag-accent" title="Área padrão da conta. Não pode ser excluída nem arquivada.">Principal</span>}
            {area.archived && <span className="tag tag-neutral">Arquivada</span>}
          </div>
          {area.description && (
            <p className="card-body" style={sx("margin:3px 0 0;font-size:12.5px")}>{area.description}</p>
          )}
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:10px")}>
        <Chips titulo="Contas de anúncio" itens={contas} vazio="Todas as contas" />
        {/* Produtos DESCOBERTOS — informativo, nunca configurável. A ferramenta
            só conhece um produto depois que ele vende; pedir para escolher numa
            oferta nova era um campo sem opção. Renomear no gateway agora só faz
            aparecer um produto novo aqui, sem quebrar filtro nenhum. */}
        <div>
          <div className="text-muted" style={sx("font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px")}>
            Produtos detectados · 30 dias
          </div>
          {(checks ?? []).length === 0 ? (
            <div className="text-muted" style={sx("font-size:12px")}>
              Nenhuma venda ainda — os produtos aparecem sozinhos conforme entrarem.
            </div>
          ) : (
            <div style={sx("display:flex;flex-direction:column;gap:3px")}>
              {(checks ?? []).slice(0, 5).map((pr) => (
                <div key={pr.produto} style={sx("display:flex;align-items:baseline;justify-content:space-between;gap:8px;font-size:12px")}>
                  <span style={sx("overflow:hidden;text-overflow:ellipsis;white-space:nowrap")} title={pr.produto}>{pr.produto}</span>
                  <span className="text-muted" style={sx("flex:none;font-variant-numeric:tabular-nums")}>
                    {pr.vendas} · {brl(pr.faturamento)}
                  </span>
                </div>
              ))}
              {(checks ?? []).length > 5 && (
                <div className="text-muted" style={sx("font-size:11px")}>+{(checks ?? []).length - 5} {palavra((checks ?? []).length - 5, "outro", "outros")}</div>
              )}
            </div>
          )}
        </div>
        <Chips titulo="Webhooks" itens={webhooks} vazio="Todos os webhooks" />
        <Chips titulo="Pixels" itens={pixels} vazio="Todos os pixels" />
      </div>

      {pend.length > 0 && (
        <div style={sx("display:flex;flex-direction:column;gap:5px;padding-top:var(--space-2);border-top:1px solid var(--color-divider)")}>
          {pend.map((p, i) => (
            <div key={i} style={sx(`font-size:11.5px;line-height:1.5;display:flex;gap:6px;color:${p.nivel === "aviso" ? AMARELO : "var(--color-text-muted)"}`)}>
              <span aria-hidden style={sx("flex:none")}>{p.nivel === "aviso" ? "⚠" : "•"}</span>
              <span>{p.texto}</span>
            </div>
          ))}
        </div>
      )}

      <div style={sx("display:flex;gap:6px;flex-wrap:wrap;padding-top:var(--space-2);border-top:1px solid var(--color-divider)")}>
        <button className="btn btn-secondary" type="button" onClick={onEditar}>Editar</button>
        <button className="btn btn-ghost" type="button" onClick={onDuplicar} title="Cria uma cópia da configuração, sem as contas de anúncio">Duplicar</button>
        {/* A principal é a operação padrão e o fallback do seletor: sem ela o
            usuário ficaria sem área ao abrir a ferramenta. O servidor recusa as
            duas ações de qualquer jeito — aqui só evitamos oferecer o que não
            vai acontecer. */}
        {!area.isDefault && (
          <button className="btn btn-ghost" type="button" onClick={onArquivar}>{area.archived ? "Desarquivar" : "Arquivar"}</button>
        )}
        {area.isDefault ? (
          <span className="text-muted" style={sx("margin-left:auto;font-size:11.5px;align-self:center")}>
            A área principal não pode ser excluída
          </span>
        ) : (
          <button className="btn btn-ghost" type="button" onClick={onExcluir} style={sx(`margin-left:auto;color:${VERMELHO}`)}>Excluir</button>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────── Gaveta de criar/editar ────────────────────────────

/**
 * ⚠️ Explicação longa vai no `info` (tooltip ⓘ), não no `dica`. Parágrafo de
 * ajuda embaixo de cada campo empilha ruído; `dica` fica para a linha curta.
 */
function Campo({
  label, dica, info, children,
}: {
  label: string;
  dica?: string;
  info?: ConteudoInfo;
  children: React.ReactNode;
}) {
  return (
    <div className="field">
      <label style={sx("display:flex;align-items:center;gap:5px")}>
        <span>{label}</span>
        {info && <InfoTip conteudo={info} tamanho={12} />}
      </label>
      {dica && <p className="text-muted" style={sx("margin:0 0 6px;font-size:11.5px;line-height:1.5")}>{dica}</p>}
      {children}
    </div>
  );
}

/**
 * Criar uma área numa TELA SÓ: nome, cor, descrição e as cinco dimensões de
 * filtro, todas visíveis de uma vez. É deliberadamente o contrário de um
 * assistente por passos — a área é um formulário curto, e paginá-lo esconderia
 * de quem já sabe o que quer exatamente os campos que ele veio preencher.
 */
function AreaDrawer({
  rascunho, setRascunho, opcoes, ocupadas, salvando, erro, onSalvar, onFechar,
}: {
  rascunho: Rascunho;
  setRascunho: (r: Rascunho) => void;
  opcoes: OpcoesAreas;
  ocupadas: ContaOcupada[];
  salvando: boolean;
  erro: string | null;
  onSalvar: () => void;
  onFechar: () => void;
}) {
  const patch = (p: Partial<Rascunho>) => setRascunho({ ...rascunho, ...p });
  const ocupadaPor = new Map(ocupadas.map((o) => [o.accountId, o.workspaceName]));
  /** `id` nulo = área nova. Criar não pede vínculo nenhum. */
  const criando = rascunho.id === null;

  const itensContas: ItemSelecionavel[] = opcoes.accounts.map((a) => {
    const dona = ocupadaPor.get(a.id);
    const movida = rascunho.moverContas.includes(a.id);
    return {
      id: a.id,
      label: a.name,
      detalhe: movida ? `Será movida de “${dona}” para esta área ao salvar` : `${a.fbAccountId} · ${a.profileName}`,
      ...(dona && !movida ? { bloqueio: `Já vinculada à área “${dona}”` } : {}),
    };
  });

  /** Autoriza a conta a sair da área atual e já a marca nesta. */
  const moverParaCa = (id: string) =>
    setRascunho({
      ...rascunho,
      moverContas: [...rascunho.moverContas, id],
      accountIds: rascunho.accountIds.includes(id) ? rascunho.accountIds : [...rascunho.accountIds, id],
    });

  return (
    <Drawer
      aberta
      largura={600}
      titulo={rascunho.id ? "Editar área" : "Nova área de trabalho"}
      descricao="Campo em branco vale para todos."
      onClose={onFechar}
      rodape={
        <>
          <button className="btn btn-ghost" type="button" onClick={onFechar} disabled={salvando}>Cancelar</button>
          <button className="btn btn-primary" type="button" onClick={onSalvar} disabled={salvando}>
            {salvando ? "Salvando…" : rascunho.id ? "Salvar" : "Criar área"}
          </button>
        </>
      }
    >
      <Campo label="Nome">
        <input className="input" autoFocus value={rascunho.name} placeholder="Ex.: Oferta de emagrecimento"
          onChange={(e) => patch({ name: e.target.value })} />
      </Campo>

      <Campo label="Cor">
        <div style={sx("display:flex;gap:7px;flex-wrap:wrap")}>
          {CORES.map((c) => (
            <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={rascunho.color === c}
              onClick={() => patch({ color: c })}
              style={sx(`width:26px;height:26px;border-radius:8px;cursor:pointer;background:${c};border:2px solid ${rascunho.color === c ? "var(--color-text)" : "transparent"}`)} />
          ))}
        </div>
      </Campo>

      <Campo label="Descrição" dica="Uma nota para você. Não muda nada nos números.">
        <textarea className="input" rows={2} value={rascunho.description}
          placeholder="Ex.: Oferta de emagrecimento — tráfego BR, gateway Kirvano"
          onChange={(e) => patch({ description: e.target.value })} />
      </Campo>

      {criando ? (
        // ⛔ CRIAR ÁREA NÃO PEDE VÍNCULO NENHUM. A área nasce ZERADA.
        //
        // A tela antiga mandava escolher contas, webhooks, produtos e pixels de
        // uma lista do que já existia — isso é um seletor de FILTROS, não a
        // criação de uma operação nova. E era um beco: numa oferta nova não há
        // o que selecionar, e o texto mandava o usuário para fora ("conecte um
        // perfil em Integrações"). A configuração acontece DENTRO da área,
        // pela própria sidebar, exatamente como na Principal.
        <div
          style={sx(
            "display:flex;gap:10px;align-items:flex-start;padding:var(--space-3);border-radius:var(--radius-md);" +
              "background:var(--color-bg);border:1px solid var(--color-divider)",
          )}
        >
          <Icone nome="bussola" tamanho={17} cor="marca" />
          <div style={sx("font-size:13px;line-height:1.6")}>
            <strong>A área nasce vazia — e é assim mesmo.</strong>
            <div className="text-muted" style={sx("margin-top:5px")}>
              Depois de criar, entre nela pelo seletor da barra lateral e configure pela própria
              sidebar: conecte o perfil do Facebook em <strong>Integrações › Anúncios</strong>,
              cadastre o gateway em <strong>Webhooks</strong> e crie o pixel em{" "}
              <strong>Pixel</strong>. O que você criar lá dentro já nasce vinculado a esta área.
            </div>
            <div className="text-muted" style={sx("margin-top:5px")}>
              Os <strong>produtos são detectados sozinhos</strong> conforme as vendas entram — não
              há nada para configurar.
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={sx("height:1px;background:var(--color-divider)")} />

          {/* Na EDIÇÃO sobra só a conta de anúncio, e por um motivo específico:
              é a única dimensão em que "mover entre áreas" é uma operação real
              (uma conta pertence a exatamente uma área). Webhook e pixel se
              vinculam na criação, dentro da área. */}
          <Campo label="Contas de anúncio" info={CONFIG.contaUnicaPorArea}>
            <ListaSelecionavel
              itens={itensContas}
              selecionados={rascunho.accountIds}
              onChange={(accountIds) => patch({ accountIds })}
              onDesbloquear={moverParaCa}
              vazio="Nenhuma conta de anúncio conectada. Conecte um perfil em Integrações › Anúncios, de dentro desta área."
            />
          </Campo>
        </>
      )}

      {erro && <p style={sx(`margin:0;font-size:12.5px;color:${VERMELHO}`)}>{erro}</p>}
    </Drawer>
  );
}
