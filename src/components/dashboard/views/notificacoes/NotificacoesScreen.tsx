"use client";

import * as React from "react";
import { AlertTriangle, BellRing, Clock } from "lucide-react";

import type { NotificationSettingsDTO } from "@/lib/actions/notifications";
import {
  HORARIOS,
  O_QUE_MOSTRAR,
  PADROES_DE_RESUMO,
  QUANDO_AVISAR,
  nenhumHorarioLigado,
  type Interruptor,
} from "@/lib/notificacoes/apresentacao";
import { Select } from "@/components/tk/Select";
import { Switch } from "@/components/tk/Controles";
import type { TraffikView } from "@/components/dashboard/useTraffikState";

/**
 * NotificacoesScreen — os onze interruptores da mesma tabela.
 *
 * ⛔ TODOS OS CAMPOS PASSAM PELO MESMO CAMINHO (`v.salvarNotificacao`), e a
 * lista deles é DADO (`lib/notificacoes/apresentacao.ts`), não JSX repetido.
 * Onze blocos escritos à mão seriam onze lugares onde esquecer um — que é a
 * forma exata da regressão do `calc` na tela de Taxas, onde *"parece simples"*
 * foi o que a produziu.
 *
 * `test:notificacoes` cruza `CAMPOS_ESCRITOS` com o `NotificationSettingsDTO` da
 * própria ação e exige que os dois conjuntos sejam IGUAIS — nem campo a mais,
 * nem a menos.
 */
export function NotificacoesScreen({ v }: { v: TraffikView }) {
  /* ⚠️ `notifCru`, e não `notif`: o segundo é modelo de tela e não carrega os
     quatro horários. Ver a nota no hook. */
  const n = v.notifCru;
  const semHorario = nenhumHorarioLigado(n);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, width: "100%", maxWidth: 760, paddingBottom: 40 }}>
      <Secao
        icone={<BellRing size={18} strokeWidth={1.75} />}
        titulo="Notificações de venda"
        apoio="Chegam no navegador assim que a venda entra."
      >
        <Grupo titulo="Quando avisar" itens={QUANDO_AVISAR} n={n} salvar={v.salvarNotificacao} />
        <Grupo
          titulo="O que mostrar"
          itens={O_QUE_MOSTRAR}
          n={n}
          salvar={v.salvarNotificacao}
          /* ⚠️ Se nenhum dos dois avisos estiver ligado, escolher o CONTEÚDO da
             notificação é escolher o conteúdo de algo que não vai aparecer. */
          inerte={!n.notifyApprovedSale && !n.notifyPendingSale}
          motivoInerte="Nenhum aviso de venda está ligado — nada disto vai aparecer."
        />
      </Secao>

      <Secao
        icone={<Clock size={18} strokeWidth={1.75} />}
        titulo="Resumo por horário"
        apoio="Um apanhado do dia, nos horários que você escolher."
      >
        <Grupo titulo="Horários" itens={HORARIOS} n={n} salvar={v.salvarNotificacao} colunas />

        {/* 🔴 Sem horário ligado, o seletor de padrão pede uma escolha que não
            produz nada — controle inerte criado pelo ESTADO, não pelo código. A
            tela declara, em vez de deixar descobrir pela ausência. */}
        {semHorario && (
          <div
            className="bg-tint-warning"
            style={{
              display: "flex",
              gap: 9,
              alignItems: "flex-start",
              borderRadius: "var(--tk-radius-controle)",
              border: "1px solid color-mix(in oklch, var(--tk-warning) 30%, transparent)",
              padding: "9px 11px",
            }}
          >
            <AlertTriangle size={15} strokeWidth={1.75} aria-hidden="true" className="text-on-tint-warning" style={{ flex: "none", marginTop: 1 }} />
            <span className="text-caption text-on-tint-warning">
              Nenhum horário está ligado, então nenhum resumo vai ser enviado — o padrão abaixo não
              muda isso.
            </span>
          </div>
        )}

        <div style={{ maxWidth: 340 }}>
          <Select
            rotulo="Padrão do resumo"
            valor={n.reportPattern}
            aoEscolher={(p) => void v.salvarNotificacao({ reportPattern: p as NotificationSettingsDTO["reportPattern"] })}
            opcoes={PADROES_DE_RESUMO.map((p) => ({ valor: p.valor, rotulo: p.rotulo }))}
          />
          <p className="text-caption text-text-muted" style={{ margin: "6px 0 0" }}>
            {PADROES_DE_RESUMO.find((p) => p.valor === n.reportPattern)?.apoio}
          </p>
        </div>

        {/* ⚠️ O horário é o do FUSO DA CONTA, não o do aparelho — mesma regra que
            decide o que é "hoje" no painel inteiro. Sem dizer, quem viaja acha
            que o resumo atrasou. */}
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          Os horários seguem o fuso da conta, não o do aparelho. Você muda em{" "}
          <strong className="text-text">Taxas e Despesas</strong>.
        </p>
      </Secao>
    </div>
  );
}

function Secao({
  icone,
  titulo,
  apoio,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  apoio: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-surface"
      style={{
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius-card)",
        boxShadow: "var(--tk-shadow-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: 18,
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        {/* Quadrado arredondado NEUTRO — a forma do `06` §13 para ícone que
            ilustra um bloco. */}
        <span
          aria-hidden="true"
          className="text-text-secondary"
          style={{
            width: 36,
            height: 36,
            flex: "none",
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "color-mix(in oklch, var(--tk-text-secondary) 10%, transparent)",
          }}
        >
          {icone}
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span className="text-title text-text">{titulo}</span>
          <span className="text-caption text-text-muted">{apoio}</span>
        </div>
      </div>
      {children}
    </section>
  );
}

function Grupo({
  titulo,
  itens,
  n,
  salvar,
  colunas = false,
  inerte = false,
  motivoInerte,
}: {
  titulo: string;
  itens: readonly Interruptor[];
  n: NotificationSettingsDTO;
  salvar: (patch: Partial<NotificationSettingsDTO>) => void | Promise<void>;
  colunas?: boolean;
  /** O grupo continua funcionando — o que muda é que ele DIZ que não terá efeito. */
  inerte?: boolean;
  motivoInerte?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <span className="text-label text-text-secondary">{titulo}</span>

      {inerte && motivoInerte && (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          {motivoInerte}
        </p>
      )}

      <div
        style={
          colunas
            ? { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }
            : { display: "flex", flexDirection: "column", gap: 12 }
        }
      >
        {itens.map((i) => (
          <Switch
            key={i.campo}
            ligado={n[i.campo] === true}
            aoMudar={(valor) => void salvar({ [i.campo]: valor })}
            rotulo={i.rotulo}
            apoio={i.apoio}
            /* ⛔ NÃO desabilita quando `inerte`: o interruptor continua gravando,
               e desabilitar impediria de configurar antes de ligar o aviso. O
               que muda é a tela DIZER que não terá efeito agora. */
          />
        ))}
      </div>
    </div>
  );
}
