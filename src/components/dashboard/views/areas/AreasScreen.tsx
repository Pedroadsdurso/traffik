"use client";

import * as React from "react";
import { Copy, Pencil, Plus, Trash2 } from "lucide-react";

import {
  carregarOpcoesAreas,
  createWorkspace,
  deleteWorkspace,
  duplicateWorkspace,
  listWorkspaces,
  preverExclusaoDaArea,
  updateWorkspace,
  type ContaOcupada,
  type OpcoesAreas,
  type OpcoesExclusao,
  type PreviaExclusao,
  type WorkspaceDTO,
} from "@/lib/actions/workspaces";
import { resumoDoRecorte } from "@/lib/areas/apresentacao";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { GavetaArea } from "./GavetaArea";
import { GavetaExcluir } from "./GavetaExcluir";

/**
 * AreasScreen — o recorte de tudo que o painel mostra.
 *
 * ⛔ A EXCLUSÃO É O ÚNICO FLUXO IRREVERSÍVEL DAS DOZE TELAS, e a confirmação
 * dela diz o que a exclusão **promove**, não só o que apaga — ver `GavetaExcluir`.
 *
 * ⚠️ A prévia é buscada ANTES de o diálogo aparecer, e não enquanto ele já está
 * na tela: um diálogo destrutivo que abre vazio e depois preenche é um diálogo
 * em que se clica antes de ler.
 *
 * ⚠️ Autocontida (busca por server action, estado local), como `PixelScreen` e
 * `WebhooksScreen`. Nada disto pertence ao `useTraffikState`, que existe para o
 * estado COMPARTILHADO entre telas.
 */
export function AreasScreen() {
  const [areas, setAreas] = React.useState<WorkspaceDTO[] | null>(null);
  const [opcoes, setOpcoes] = React.useState<OpcoesAreas>({ accounts: [], webhooks: [], pixels: [] });
  const [editando, setEditando] = React.useState<{ area: WorkspaceDTO | null } | null>(null);
  const [ocupadas, setOcupadas] = React.useState<ContaOcupada[]>([]);
  const [excluindo, setExcluindo] = React.useState<WorkspaceDTO | null>(null);
  const [previa, setPrevia] = React.useState<PreviaExclusao | null>(null);
  const [carregandoPrevia, setCarregandoPrevia] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);

  const recarregar = React.useCallback(async () => {
    const [lista, ops] = await Promise.all([listWorkspaces(), carregarOpcoesAreas()]);
    setAreas(lista);
    setOpcoes(ops);
  }, []);

  /* ⚠️ A guarda `vivo` é o padrão das telas novas (`PixelScreen`,
     `WebhooksScreen`): sem ela, sair da tela antes de a busca voltar deixa um
     `setState` em componente desmontado. E o `.then` no lugar de `await` direto
     é o que mantém o efeito síncrono aos olhos do lint — o `setState` só roda
     depois da promessa, que é exatamente o que a regra quer garantir. */
  React.useEffect(() => {
    let vivo = true;
    void Promise.all([listWorkspaces(), carregarOpcoesAreas()]).then(([lista, ops]) => {
      if (!vivo) return;
      setAreas(lista);
      setOpcoes(ops);
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function abrirExclusao(area: WorkspaceDTO) {
    setExcluindo(area);
    setPrevia(null);
    setCarregandoPrevia(true);
    try {
      setPrevia(await preverExclusaoDaArea(area.id));
    } finally {
      setCarregandoPrevia(false);
    }
  }

  async function salvar(input: Parameters<React.ComponentProps<typeof GavetaArea>["aoSalvar"]>[0]) {
    setErro(null);
    const alvo = editando?.area;
    const r = alvo ? await updateWorkspace(alvo.id, input) : await createWorkspace(input);

    if (r && !r.ok) {
      /* 🔴 O conflito de conta NÃO fecha a gaveta. Fechar faria o usuário
         refazer o formulário inteiro para descobrir o mesmo conflito de novo —
         e a autorização de mover é justamente a resposta que falta. */
      if (r.conflitos.length > 0) {
        setOcupadas(r.conflitos);
        return;
      }
      setErro(
        r.motivo === "principal-nao-arquiva"
          ? "A área Principal não pode ser arquivada."
          : "Não foi possível salvar.",
      );
      return;
    }

    setOcupadas([]);
    setEditando(null);
    await recarregar();
  }

  async function excluir(opcoesExclusao: OpcoesExclusao) {
    if (!excluindo) return;
    const r = await deleteWorkspace(excluindo.id, opcoesExclusao);
    if (!r?.ok) {
      setErro(
        r?.motivo === "nome-nao-confere"
          ? "O nome digitado não confere."
          : r?.motivo === "principal"
            ? "A área Principal não pode ser excluída."
            : "Não foi possível excluir.",
      );
      return;
    }
    setExcluindo(null);
    setPrevia(null);
    await recarregar();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 900, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <p className="text-caption text-text-muted" style={{ margin: 0, maxWidth: "60ch" }}>
          Cada área recorta contas, webhooks, produtos e fontes. O painel inteiro passa a mostrar
          só o que pertence à área ativa.
        </p>
        <Button
          variante="primario"
          iconeInicio={<Plus size={15} strokeWidth={2} />}
          onClick={() => {
            setOcupadas([]);
            setEditando({ area: null });
          }}
        >
          Nova área
        </Button>
      </div>

      {erro && (
        <p role="alert" className="text-caption text-danger" style={{ margin: 0 }}>
          {erro}
        </p>
      )}

      {areas === null ? (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          Carregando as áreas…
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {areas.map((a) => (
            <CartaoArea
              key={a.id}
              area={a}
              aoEditar={() => {
                setOcupadas([]);
                setEditando({ area: a });
              }}
              aoDuplicar={async () => {
                await duplicateWorkspace(a.id);
                await recarregar();
              }}
              aoExcluir={() => void abrirExclusao(a)}
            />
          ))}
        </div>
      )}

      {editando && (
        <GavetaArea
          area={editando.area}
          opcoes={opcoes}
          ocupadas={ocupadas}
          aoFechar={() => {
            setEditando(null);
            setOcupadas([]);
          }}
          aoSalvar={salvar}
        />
      )}

      {excluindo && (
        <GavetaExcluir
          area={excluindo}
          previa={previa}
          carregando={carregandoPrevia}
          aoFechar={() => {
            setExcluindo(null);
            setPrevia(null);
          }}
          aoConfirmar={excluir}
        />
      )}
    </div>
  );
}

function CartaoArea({
  area,
  aoEditar,
  aoDuplicar,
  aoExcluir,
}: {
  area: WorkspaceDTO;
  aoEditar: () => void;
  aoDuplicar: () => Promise<void>;
  aoExcluir: () => void;
}) {
  return (
    <div
      className="bg-surface"
      style={{
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius-card)",
        boxShadow: "var(--tk-shadow-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        alignItems: "center",
        gap: 14,
        minWidth: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 10,
          height: 10,
          flex: "none",
          borderRadius: "var(--tk-radius-pill)",
          background: area.color ?? "var(--tk-text-muted)",
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0, flex: 1 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <span className="text-title text-text" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {area.name}
          </span>
          {area.isDefault && <Badge tom="neutral">Principal</Badge>}
          {area.archived && <Badge tom="neutral">Arquivada</Badge>}
        </span>
        {area.description && (
          <span className="text-caption text-text-muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
            {area.description}
          </span>
        )}
        {/* ⚠️ O resumo diz o EFEITO do recorte, não a contagem crua: recorte
            vazio significa "sem filtro", que é o oposto do que `0 contas`
            sugere a quem bate o olho. */}
        <span className="text-caption text-text-muted">{resumoDoRecorte(area)}</span>
      </div>

      <div style={{ display: "flex", gap: 4, flex: "none" }}>
        <Button variante="fantasma" apenasIcone aria-label={`Editar ${area.name}`} onClick={aoEditar}>
          <Pencil size={15} strokeWidth={1.75} />
        </Button>
        <Button
          variante="fantasma"
          apenasIcone
          aria-label={`Duplicar ${area.name}`}
          onClick={() => void aoDuplicar()}
        >
          <Copy size={15} strokeWidth={1.75} />
        </Button>
        {/* ⛔ A Principal não tem ✕, e o servidor recusa de qualquer forma
            (`motivo: "principal"`). Oferecer o botão para negar depois é pior
            que não oferecer. */}
        {!area.isDefault && (
          <Button variante="fantasma" apenasIcone aria-label={`Excluir ${area.name}`} onClick={aoExcluir}>
            <Trash2 size={15} strokeWidth={1.75} />
          </Button>
        )}
      </div>
    </div>
  );
}
