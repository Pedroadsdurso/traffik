"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { logoutAction } from "@/lib/actions/session";
import { Icone } from "@/components/dashboard/ui/Icone";
import { DropdownMenu, type ItemMenu } from "./DropdownMenu";

export type UsuarioShell = { name?: string | null; email?: string | null };

/**
 * UserMenu — avatar com dropdown. **Um componente, duas aparências**, e não dois
 * componentes: a referência pede o bloco de perfil no rodapé do rail (avatar +
 * nome + e-mail + `⋮`) e o avatar solto no header, mas o MENU é o mesmo. Dois
 * arquivos divergiriam no dia em que um item novo entrasse só num deles.
 *
 * ⛔ O QUE NÃO ENTRA AQUI, e o motivo:
 *
 * Não existe tela de perfil, de conta nem de preferências neste produto —
 * `grep` nas rotas de `dashboard/(app)` confirma. Um item "Meu perfil" apontando
 * para lugar nenhum seria affordance mentindo, que é a regra que matou a
 * interação do globo. Os itens são só os que têm destino real: áreas de trabalho
 * (tela existe), taxas (tela existe) e sair (server action existe).
 */
export function UserMenu({
  usuario,
  variante,
}: {
  usuario?: UsuarioShell;
  /** `bloco`: rodapé do rail, com nome e e-mail. `avatar`: header, só o círculo. */
  variante: "bloco" | "avatar";
}) {
  const router = useRouter();
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);

  const nome = usuario?.name ?? "Sem nome";
  const inicial = (usuario?.name || usuario?.email || "?").charAt(0).toUpperCase();

  const itens: ItemMenu[] = [
    {
      rotulo: "Áreas de trabalho",
      icone: <Icone nome="camadas" tamanho={15} cor="suave" />,
      aoEscolher: () => router.push("/dashboard/areas"),
    },
    {
      rotulo: "Taxas e despesas",
      icone: <Icone nome="taxas" tamanho={15} cor="suave" />,
      aoEscolher: () => router.push("/dashboard/taxas"),
    },
    { tipo: "separador" },
    {
      rotulo: "Sair",
      icone: <Icone nome="sair" tamanho={15} cor="perigo" />,
      perigo: true,
      // Server action, e não um POST montado à mão: é a mesma que o rail antigo
      // usava, e ela é quem invalida a sessão do NextAuth do lado do servidor.
      aoEscolher: () => void logoutAction(),
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
        aria-label={`Conta de ${nome}`}
        title={variante === "avatar" ? nome : undefined}
        className={
          "hover:bg-surface-hover flex cursor-pointer items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 " +
          (variante === "bloco" ? "w-full gap-2.5 px-2 py-2 text-left" : "justify-center p-0.5")
        }
      >
        <Avatar inicial={inicial} />
        {variante === "bloco" && (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-label text-text block truncate">{nome}</span>
              <span className="text-caption text-text-muted block truncate">{usuario?.email}</span>
            </span>
            <Icone nome="ajustes" tamanho={15} cor="suave" />
          </>
        )}
      </button>

      <DropdownMenu
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        gatilho={gatilho}
        itens={itens}
        // No rail o menu abre para cima (o gatilho está no rodapé); no header,
        // para baixo e alinhado à direita, senão vaza pela borda da janela.
        lado={variante === "bloco" ? "cima" : "baixo"}
        alinhamento={variante === "bloco" ? "inicio" : "fim"}
        rotuloAcessivel="Conta"
        cabecalho={
          variante === "avatar" ? (
            <div className="border-b border-border mb-1 px-2.5 pt-1.5 pb-2">
              <div className="text-label text-text truncate">{nome}</div>
              <div className="text-caption text-text-muted truncate">{usuario?.email}</div>
            </div>
          ) : undefined
        }
      />
    </>
  );
}

function Avatar({ inicial }: { inicial: string }) {
  return (
    <span
      aria-hidden
      className="bg-tint-primary text-on-tint-primary text-label grid flex-none place-items-center rounded-pill"
      style={{ width: 28, height: 28 }}
    >
      {inicial}
    </span>
  );
}
