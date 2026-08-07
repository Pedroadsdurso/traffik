"use client";

import * as React from "react";
import Link from "next/link";

import { Icone, type NomeIcone } from "@/components/dashboard/ui/Icone";
import { Popover } from "./Popover";

export type ItemNotificacao = {
  id: string;
  title: string;
  content: string;
  timeLabel: string;
  read: boolean;
  icone: { nome: NomeIcone; cor: "neutro" | "suave" | "marca" | "aviso" | "perigo" | "ok" };
};

/**
 * Sino + painel de notificações.
 *
 * Usa `Popover` (e não `useOverlay`) de propósito: é um painel ancorado ao sino,
 * o fundo continua rolando e o foco não fica preso. É a definição de dropdown —
 * ao contrário da paleta ⌘K, que é diálogo.
 *
 * O badge conta as NÃO LIDAS. Ele existe em dois lugares — aqui e no item
 * "Notificações" do rail —, e os dois leem o mesmo `naoLidas`. Duas contagens
 * derivadas separadamente é como elas divergem.
 */
export function NotificationsBell({
  itens,
  naoLidas,
  aoMarcarTodasLidas,
}: {
  itens: ItemNotificacao[];
  naoLidas: number;
  aoMarcarTodasLidas: () => void;
}) {
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);
  const fechar = React.useCallback(() => setAberto(false), []);

  return (
    <>
      <button
        ref={setGatilho}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label={naoLidas > 0 ? `Notificações, ${naoLidas} não lidas` : "Notificações"}
        className="text-text-secondary hover:bg-surface-hover hover:text-text relative grid cursor-pointer place-items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        /* Lado = `--tk-altura-controle`, como todo controle da barra de topo. */
        style={{ width: "var(--tk-altura-controle)", height: "var(--tk-altura-controle)" }}
      >
        <Icone nome="sino" tamanho={17} />
        {naoLidas > 0 && (
          <span
            aria-hidden
            className="bg-danger text-on-primary grid place-items-center rounded-pill"
            style={{
              position: "absolute",
              top: -2,
              right: -2,
              minWidth: 15,
              height: 15,
              padding: "0 4px",
              fontSize: 9.5,
              fontWeight: 700,
            }}
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      <Popover
        aberto={aberto}
        aoFechar={fechar}
        gatilho={gatilho}
        alinhamento="fim"
        larguraDoGatilho={false}
        papel="dialog"
      >
        <div style={{ width: "min(340px, calc(100vw - 32px))" }}>
          <div className="flex items-center justify-between px-2 pt-1.5 pb-2">
            <span className="text-title text-text">Notificações</span>
            {naoLidas > 0 && (
              <button
                type="button"
                onClick={aoMarcarTodasLidas}
                className="text-caption text-primary cursor-pointer border-0 bg-transparent hover:underline"
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {itens.length === 0 ? (
            <p className="text-body text-text-secondary px-2 pb-3 text-center">
              Nenhuma notificação ainda. Elas chegam quando uma venda entra, uma regra age sozinha ou
              o relatório do dia fica pronto — você escolhe quais em{" "}
              <Link href="/dashboard/notificacoes" onClick={fechar} className="text-primary">
                Notificações
              </Link>
              .
            </p>
          ) : (
            <div style={{ maxHeight: 380, overflowY: "auto" }}>
              {itens.map((n) => (
                <div
                  key={n.id}
                  className={`flex gap-2.5 rounded-controle px-2 py-2 ${n.read ? "" : "bg-surface-hover"}`}
                >
                  <Icone nome={n.icone.nome} tamanho={16} cor={n.icone.cor} />
                  <div className="min-w-0 flex-1">
                    <div className="text-label text-text">{n.title}</div>
                    <div className="text-caption text-text-secondary">{n.content}</div>
                    <div className="text-caption text-text-muted mt-0.5">{n.timeLabel}</div>
                  </div>
                  {!n.read && (
                    <span
                      aria-hidden
                      className="bg-primary flex-none rounded-pill"
                      style={{ width: 7, height: 7, marginTop: 6 }}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </Popover>
    </>
  );
}
