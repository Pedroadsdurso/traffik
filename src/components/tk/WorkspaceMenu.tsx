"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import type { WorkspaceDTO } from "@/lib/actions/workspaces";
import { Icone } from "@/components/dashboard/ui/Icone";
import { DropdownMenu, type ItemMenu } from "./DropdownMenu";

/**
 * Seletor de Área de Trabalho — agora no RODAPÉ do rail.
 *
 * ⛔ Ele SAIU DO TOPO por decisão de 06/08/2026. Ocupava a posição mais nobre da
 * sidebar — acima da navegação inteira — para um controle que quase nunca muda.
 * Quem troca de área faz isso uma vez por sessão; quem navega faz isso o tempo
 * todo.
 *
 * ⛔ **Não existe "Todas as áreas"**, e a ausência é regra do produto, não
 * esquecimento: as áreas são isoladas e toda métrica é de UMA operação. Não há
 * visão consolidada em lugar nenhum.
 *
 * Áreas arquivadas não aparecem — arquivar existe para tirar da troca do dia a
 * dia sem perder a configuração. A principal nunca pode ser arquivada, então a
 * lista nunca fica vazia.
 *
 * "Gerenciar áreas" mora AQUI dentro, e não na navegação: `/dashboard/areas` é
 * onde se edita a área, e o momento em que se quer isso é o momento em que se
 * está olhando a lista delas.
 */
export function WorkspaceMenu({
  areas,
  ativa,
  aoTrocar,
  colapsado,
}: {
  areas: WorkspaceDTO[];
  ativa: string | null;
  aoTrocar: (id: string) => void;
  colapsado: boolean;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);

  const router = useRouter();
  const visiveis = areas.filter((a) => !a.archived);
  const atual = ativa ? (visiveis.find((a) => a.id === ativa) ?? null) : null;

  const itens: ItemMenu[] = [
    ...visiveis.map<ItemMenu>((a) => ({
      rotulo: a.name,
      selecionado: a.id === ativa,
      icone: <Ponto cor={a.color} />,
      // Redundante quando a área ainda se chama "Principal".
      apoio: a.isDefault && a.name.trim().toLowerCase() !== "principal" ? "principal" : undefined,
      aoEscolher: () => aoTrocar(a.id),
    })),
    { tipo: "separador" },
    {
      rotulo: "Gerenciar áreas",
      icone: <Icone nome="automacao" tamanho={15} cor="suave" />,
      aoEscolher: () => router.push("/dashboard/areas"),
    },
  ];

  return (
    <>
      <button
        ref={setGatilho}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        title={atual ? `Área de trabalho: ${atual.name}` : "Carregando áreas…"}
        className="hover:bg-surface-hover flex w-full cursor-pointer items-center gap-2.5 rounded-controle border-0 bg-transparent px-2 py-2 text-left focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
      >
        <Ponto cor={atual?.color ?? null} />
        {!colapsado && (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-micro text-text-muted block">
                {atual?.isDefault ? "Área principal" : "Área"}
              </span>
              <span className="text-label text-text block truncate">{atual?.name ?? "…"}</span>
            </span>
            <Icone nome="chevronCima" tamanho={14} cor="suave" />
          </>
        )}
      </button>

      <DropdownMenu
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        gatilho={gatilho}
        itens={itens}
        // Para CIMA: o gatilho vive no rodapé do rail, e o padrão "baixo" abriria
        // a lista para fora da janela toda vez.
        lado="cima"
        larguraDoGatilho={!colapsado}
        rotuloAcessivel="Trocar de área de trabalho"
      />
    </>
  );
}

function Ponto({ cor }: { cor: string | null }) {
  return (
    <span
      aria-hidden
      className="flex-none rounded-controle"
      style={{ width: 9, height: 9, background: cor || "var(--tk-text-muted)" }}
    />
  );
}
