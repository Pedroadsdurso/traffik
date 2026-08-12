"use client";

import * as React from "react";
import { X } from "lucide-react";

import type { ContaOcupada, OpcoesAreas, WorkspaceDTO } from "@/lib/actions/workspaces";
import { Button } from "@/components/tk/Button";
import { Gaveta } from "@/components/tk/Gaveta";
import { Input } from "@/components/tk/Input";
import { Checkbox, Switch } from "@/components/tk/Controles";
import { CORES_DE_AREA, CAMPOS_DE_RECORTE, type CampoDeRecorte } from "@/lib/areas/apresentacao";

/**
 * GavetaArea — criar e editar.
 *
 * ⛔ ELA ESCREVE OS DEZ CAMPOS QUE `AreaInput` ACEITA, e a lista não é
 * decorativa: `test:areas-tela` confere um por um contra o que `updateWorkspace`
 * persiste. É a conferência de escrita que a família *"a tela nova apresenta o
 * que não consegue criar"* obriga — e ela foi feita AQUI, na hora, e não numa
 * varredura depois.
 *
 *   name · color · description · archived
 *   accountIds · webhookIds · pixelConfigIds
 *   products · sources
 *   moverContas
 *
 * ⚠️ `pixelConfigIds` é gravado e **não tem consumidor conhecido** (medido em
 * 12/08/2026: 0 referências fora de `actions/workspaces.ts`). Ele FICA, por
 * decisão do dono: remover o controle de um campo que persiste é a regressão
 * que esta sessão acabou de cometer em Taxas, e "zero leitores hoje" não é
 * "ninguém depende". O `04` o marca como NÃO VERIFICADO, que é diferente de ✅.
 */
export function GavetaArea({
  area,
  opcoes,
  ocupadas,
  aoFechar,
  aoSalvar,
}: {
  /** `null` = criar. */
  area: WorkspaceDTO | null;
  opcoes: OpcoesAreas;
  /** Contas que pertencem a outra área — vindas do servidor após um conflito. */
  ocupadas: ContaOcupada[];
  aoFechar: () => void;
  aoSalvar: (input: {
    name: string;
    color: string | null;
    description: string | null;
    archived: boolean;
    accountIds: string[];
    products: string[];
    sources: string[];
    webhookIds: string[];
    pixelConfigIds: string[];
    moverContas: string[];
  }) => Promise<void>;
}) {
  const [name, setName] = React.useState(area?.name ?? "");
  const [color, setColor] = React.useState<string | null>(area?.color ?? CORES_DE_AREA[0]);
  const [description, setDescription] = React.useState(area?.description ?? "");
  const [archived, setArchived] = React.useState(area?.archived ?? false);
  const [accountIds, setAccountIds] = React.useState<string[]>(area?.accountIds ?? []);
  const [webhookIds, setWebhookIds] = React.useState<string[]>(area?.webhookIds ?? []);
  const [pixelConfigIds, setPixelConfigIds] = React.useState<string[]>(area?.pixelConfigIds ?? []);
  const [products, setProducts] = React.useState<string[]>(area?.products ?? []);
  const [sources, setSources] = React.useState<string[]>(area?.sources ?? []);
  const [moverContas, setMoverContas] = React.useState<string[]>([]);
  const [salvando, setSalvando] = React.useState(false);

  const alterna = (set: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) =>
    set((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));

  return (
    <Gaveta
      aberta
      titulo={area ? `Editar “${area.name}”` : "Nova área de trabalho"}
      descricao="Uma área recorta tudo que o painel mostra. O que não estiver aqui não aparece nela."
      aoFechar={aoFechar}
      rodape={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variante="primario"
            disabled={!name.trim()}
            carregando={salvando}
            onClick={async () => {
              setSalvando(true);
              try {
                await aoSalvar({
                  name: name.trim(),
                  color,
                  description: description.trim() || null,
                  archived,
                  accountIds,
                  products,
                  sources,
                  webhookIds,
                  pixelConfigIds,
                  moverContas,
                });
              } finally {
                setSalvando(false);
              }
            }}
          >
            {area ? "Salvar" : "Criar área"}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <Input rotulo="Nome" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Operação Black" />

        <Input
          rotulo="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Para que serve esta área"
          apoio="Opcional. Aparece na lista, para distinguir áreas parecidas."
        />

        <Cores valor={color} aoEscolher={setColor} />

        {/* 🔴 O CONFLITO DE CONTA, quando o servidor recusou o salvamento.
            ⛔ Nada troca de área em silêncio: a mudança só acontece para os ids
            que o usuário marcar aqui, e é isso que `moverContas` carrega. */}
        {ocupadas.length > 0 && (
          <div
            className="bg-tint-warning"
            style={{
              borderRadius: "var(--tk-radius-controle)",
              border: "1px solid color-mix(in oklch, var(--tk-warning) 32%, transparent)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <span className="text-label text-on-tint-warning">
              {ocupadas.length === 1
                ? "Uma conta já pertence a outra área"
                : `${ocupadas.length} contas já pertencem a outras áreas`}
            </span>
            {ocupadas.map((c) => (
              <Checkbox
                key={c.accountId}
                marcado={moverContas.includes(c.accountId)}
                aoMudar={() => alterna(setMoverContas)(c.accountId)}
                rotulo={`Trazer de “${c.workspaceName}”`}
                apoio={opcoes.accounts.find((a) => a.id === c.accountId)?.name ?? c.accountId}
              />
            ))}
          </div>
        )}

        <Lista
          titulo="Contas de anúncio"
          apoio="Só as marcadas contam para as métricas desta área."
          itens={opcoes.accounts.map((a) => ({ id: a.id, rotulo: a.name, apoio: `${a.profileName} · ${a.fbAccountId}` }))}
          marcados={accountIds}
          aoAlternar={alterna(setAccountIds)}
          vazio="Nenhuma conta conectada. Conecte um perfil em Integrações › Anúncios."
        />

        <Lista
          titulo="Webhooks"
          apoio="As vendas que chegarem por eles pertencem a esta área."
          itens={opcoes.webhooks.map((w) => ({ id: w.id, rotulo: w.name, apoio: w.platform }))}
          marcados={webhookIds}
          aoAlternar={alterna(setWebhookIds)}
          vazio="Nenhum webhook cadastrado."
        />

        <Lista
          titulo="Pixels"
          apoio="⚠️ Este recorte é gravado, e hoje nenhuma tela o consome. Ver a nota no 04."
          itens={opcoes.pixels.map((p) => ({ id: p.id, rotulo: p.name }))}
          marcados={pixelConfigIds}
          aoAlternar={alterna(setPixelConfigIds)}
          vazio="Nenhum pixel cadastrado."
        />

        {CAMPOS_DE_RECORTE.map((campo) => (
          <Chips
            key={campo.chave}
            campo={campo}
            valores={campo.chave === "products" ? products : sources}
            aoMudar={campo.chave === "products" ? setProducts : setSources}
          />
        ))}

        {/* ⛔ A Principal não arquiva — o servidor recusa (`principal-nao-arquiva`),
            e esconder o controle evita oferecer o que vai ser negado. */}
        {!area?.isDefault && (
          <Switch
            ligado={archived}
            aoMudar={setArchived}
            rotulo="Arquivar esta área"
            apoio="Ela sai do seletor do painel, e os dados continuam onde estão."
          />
        )}
      </div>
    </Gaveta>
  );
}

function Cores({ valor, aoEscolher }: { valor: string | null; aoEscolher: (c: string) => void }) {
  /* 🐛 A COR GRAVADA ENTRA NA PALETA MESMO FORA DO CATÁLOGO, e é conserto de
     tela: a área Principal do dev tem `#8B5CF6` (roxo do sistema antigo), que
     não está entre as sete. Sem isto o seletor abria com NENHUMA selecionada —
     a tela afirmando que a área não tem cor enquanto o ponto ao lado a
     desenhava.

     ⚠️ É o MESMO defeito que eu já tinha previsto no seletor de fuso da tela de
     Taxas ("o fuso GRAVADO entra na lista mesmo fora do catálogo") e não
     apliquei aqui — o que mostra que a nota de lá descrevia UM caso em vez de
     nomear o padrão. O padrão é: *seletor de valor fechado precisa admitir o
     valor que já está gravado, senão ele mente sobre o estado atual.* */
  const paleta = valor && !CORES_DE_AREA.includes(valor) ? [valor, ...CORES_DE_AREA] : CORES_DE_AREA;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="text-label text-text-secondary">Cor</span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {paleta.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => aoEscolher(c)}
            aria-label={`Cor ${c}`}
            aria-pressed={valor === c}
            className="focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 cursor-pointer"
            style={{
              width: 26,
              height: 26,
              borderRadius: "var(--tk-radius-pill)",
              background: c,
              /* ⚠️ O selecionado tem ANEL, não só cor — a cor é o próprio dado
                 aqui, então ela não pode ser também o indicador de seleção. */
              border: valor === c ? "2px solid var(--tk-text)" : "1px solid var(--tk-border)",
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Lista({
  titulo,
  apoio,
  itens,
  marcados,
  aoAlternar,
  vazio,
}: {
  titulo: string;
  apoio: string;
  itens: { id: string; rotulo: string; apoio?: string }[];
  marcados: string[];
  aoAlternar: (id: string) => void;
  vazio: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="text-label text-text">{titulo}</span>
        <span className="text-caption text-text-muted">{apoio}</span>
      </div>
      {itens.length === 0 ? (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          {vazio}
        </p>
      ) : (
        <div
          style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 200, overflowY: "auto" }}
        >
          {itens.map((i) => (
            <Checkbox
              key={i.id}
              marcado={marcados.includes(i.id)}
              aoMudar={() => aoAlternar(i.id)}
              rotulo={i.rotulo}
              apoio={i.apoio}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Lista livre de texto — produtos e fontes de tráfego. */
function Chips({
  campo,
  valores,
  aoMudar,
}: {
  campo: CampoDeRecorte;
  valores: string[];
  aoMudar: React.Dispatch<React.SetStateAction<string[]>>;
}) {
  const [rascunho, setRascunho] = React.useState("");

  const acrescentar = () => {
    const v = rascunho.trim();
    if (!v || valores.includes(v)) return;
    aoMudar((a) => [...a, v]);
    setRascunho("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="text-label text-text">{campo.titulo}</span>
        <span className="text-caption text-text-muted">{campo.apoio}</span>
      </div>

      {valores.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {valores.map((v) => (
            <span
              key={v}
              className="bg-surface-hover text-caption text-text"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                borderRadius: "var(--tk-radius-pill)",
                border: "1px solid var(--tk-border)",
                padding: "3px 6px 3px 10px",
              }}
            >
              {v}
              <button
                type="button"
                onClick={() => aoMudar((a) => a.filter((x) => x !== v))}
                aria-label={`Remover ${v}`}
                className="text-text-muted hover:text-text cursor-pointer focus-visible:outline-2 focus-visible:outline-primary rounded-pill"
                style={{ background: "none", border: 0, padding: 2, display: "flex" }}
              >
                <X size={12} strokeWidth={2} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                acrescentar();
              }
            }}
            placeholder={campo.exemplo}
            aria-label={`Acrescentar em ${campo.titulo}`}
          />
        </div>
        <Button variante="secundario" onClick={acrescentar}>
          Acrescentar
        </Button>
      </div>
    </div>
  );
}
