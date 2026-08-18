"use client";

import * as React from "react";

import { frasedoOculto, frasedoRecorte, seloDoToken } from "@/lib/facebook/apresentacao";
import { plural } from "@/lib/format";

import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { Card } from "@/components/tk/Card";
import { EmptyState } from "@/components/tk/EmptyState";
import { Switch } from "@/components/tk/Controles";
import { Icone } from "@/components/dashboard/ui/Icone";
import type { TraffikView } from "@/components/dashboard/useTraffikState";

/**
 * INTEGRAÇÕES › ANÚNCIOS — a vitrine de PERFIS.
 *
 * ## 🔑 POR PERFIL, não por conta — e o que decide é a AÇÃO
 *
 * O painel de `Integrações › Visão geral` é **por integração**. Esta é **por
 * perfil**: o objeto que conecta, expira e reconecta é o perfil. É a terceira
 * da família por-usuário, junto de Pixel e Webhooks.
 *
 * **Reconectar é a coisa mais importante que se faz aqui**, e ela pertence ao
 * perfil. Numa lista achatada de contas não haveria onde pendurá-la —
 * apareceria repetida em cada linha, ou fora de lugar num cabeçalho.
 *
 * ## 🔴 O RECORTE POR ÁREA É INDIRETO, e por isso ele é DITO
 *
 * `AdProfile` não tem `workspaceId`: o escopo entra nas CONTAS, e o perfil some
 * por ficar sem nenhuma. Duas consequências, e as duas são informação:
 *
 * - o perfil aparece com um SUBCONJUNTO das contas → `3 de 8 contas nesta área`
 * - um perfil sem conta nesta área **não aparece** → a frase do rodapé o declara
 *
 * ⛔ Numa lista achatada as contas de outra área simplesmente **somem**.
 *
 * ## ⚠️ A MICROCÓPIA DOS ERROS VEIO VERBATIM DA `AnunciosView`
 *
 * Ela codifica **erro pago**, como a da gaveta do Pixel: o `mesmoErroDoPerfil`
 * que evita seis blocos idênticos, o contador que separa "falhou agora" de
 * "falha há dias", o "vamos tentar de novo" que evita o clique repetido, e o
 * `temporario` que cala o contador em rate limit.
 *
 * ⛔ **Encurtar qualquer uma dessas frases devolve o bug.** Esta base já pagou
 * por isso duas vezes.
 */
export function AnunciosScreen({ v }: { v: TraffikView }) {
  /* ⚠️ `agora` no estado, nunca `Date.now()` no corpo: o selo do token é
     derivado dele, e um valor lido no render produziria HTML diferente do da
     hidratação — a regra do `elapsed()`, que já derrubou a navegação inteira. */
  const [agora] = React.useState(() => new Date());
  const [ocultos, setOcultos] = React.useState(0);
  const [confirmando, setConfirmando] = React.useState<string | null>(null);

  /* 🔴 O `ocultos` é o único dado desta tela que o hook não tem. Ele sai de
     graça no servidor (a consulta já carrega todos os perfis e o recorte é o
     `.filter` depois), e sem ele não há como declarar os que não aparecem. */
  React.useEffect(() => {
    let vivo = true;
    void import("@/lib/actions/facebook")
      .then((m) => m.listAdProfilesDaArea(v.workspaceAtiva))
      .then((r) => {
        if (vivo) setOcultos(r.ocultos);
      })
      /* ⛔ Falha aqui não derruba a tela e não inventa zero com ar de medição:
         a frase simplesmente não aparece, que é o estado de antes. */
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [v.workspaceAtiva, v.adProfiles]);

  const perfis = v.adProfiles ?? [];
  const aviso = frasedoOculto(perfis.length, perfis.length + ocultos);

  if (!v.fbConnected || perfis.length === 0) {
    return (
      <div style={{ padding: "var(--tk-s-6)" }}>
        {/* ⛔ O vazio diz o que se PERDE, não "nada aqui": sem perfil não há
            gasto, e sem gasto não há ROAS, ROI nem CPA — três números que o
            Dashboard mostra vazios sem explicar por quê. */}
        <EmptyState
          titulo="Nenhum perfil de anúncio nesta área"
          causa="Sem um perfil conectado não há gasto de anúncio — e sem gasto, o ROAS, o ROI e o custo por venda ficam vazios no Dashboard."
          acao={{ texto: "Conectar Facebook Ads", href: v.connectHref }}
        />
        {aviso && (
          <p className="text-caption text-text-muted" style={{ marginTop: "var(--tk-s-4)", textAlign: "center" }}>
            {aviso}
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-s-4)", padding: "var(--tk-s-6)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--tk-s-3)" }}>
        <div>
          <h1 className="text-h4 text-text" style={{ margin: 0 }}>
            Perfis de anúncio
          </h1>
          <p className="text-caption text-text-muted" style={{ margin: "2px 0 0" }}>
            {plural(perfis.length, "perfil conectado", "perfis conectados")} nesta área
          </p>
        </div>
        <Button href={v.connectHref} variante="secundario" iconeInicio="mais">
          Adicionar perfil
        </Button>
      </div>

      {v.syncResult && (
        <p className="text-caption text-text-muted" style={{ margin: 0 }} role="status">
          {v.syncResult}
        </p>
      )}

      {/* ⛔ GRADE `auto-fit`, não `auto-fill` — a inconsistência medida em
          17/08/2026: com `auto-fill`, poucos cards não esticam e a tela fica
          com trilhas vazias à direita, diferente das telas irmãs. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "var(--tk-s-4)", alignItems: "start" }}>
        {perfis.map((p) => (
          <CardPerfil
            key={p.id}
            p={p}
            connectHref={v.connectHref}
            agora={agora}
            confirmando={confirmando === p.id}
            aoConfirmar={() => setConfirmando(p.id)}
            aoCancelar={() => setConfirmando(null)}
          />
        ))}
      </div>

      {/* 🔴 A DECLARAÇÃO DO QUE NÃO APARECE. Sem ela, quem conectou um perfil
          cujas contas estão todas em outra área procura um bug que não existe. */}
      {aviso && (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          <Icone nome="aviso" tamanho={13} cor="suave" /> {aviso}
        </p>
      )}
    </div>
  );
}

type Perfil = NonNullable<TraffikView["adProfiles"]>[number];

function CardPerfil({
  p,
  connectHref,
  agora,
  confirmando,
  aoConfirmar,
  aoCancelar,
}: {
  p: Perfil;
  connectHref: string;
  agora: Date;
  confirmando: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  /* 🔑 O SELO DO TOKEN, JUNTO DO NOME — não numa aba.
     Reconectar é a ação principal, e o selo é o gatilho dela: uma tela com o
     botão e sem o estado faz a ação existir sem o motivo. */
  const token = seloDoToken(p.tokenExpiresAt, agora);
  const recorte = frasedoRecorte(p.accountCount, p.contasNoTotal);

  return (
    <Card>
      <div style={{ display: "flex", gap: "var(--tk-s-3)", alignItems: "flex-start" }}>
        {p.pictureUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.pictureUrl} alt="" width={40} height={40} style={{ borderRadius: "var(--tk-radius-pill)", flex: "none" }} />
        ) : (
          <span
            aria-hidden="true"
            className="bg-tint-primary text-on-tint-primary"
            style={{ width: 40, height: 40, borderRadius: "var(--tk-radius-pill)", display: "grid", placeItems: "center", flex: "none" }}
          >
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        )}

        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--tk-s-2)", flexWrap: "wrap" }}>
            <span className="text-label text-text">{p.name}</span>
            {/* ⚠️ `desconhecido` é PERIGO, não atenção: são os perfis conectados
                antes de guardarmos a data — os mais antigos, logo os mais
                prováveis de já estarem vencidos. "Não sabemos" ≠ "está ok". */}
            <Badge tom={token.tom === "perigo" ? "danger" : token.tom === "atencao" ? "warning" : "neutral"}>
              {token.rotulo}
            </Badge>
          </div>
          {p.email && (
            <p className="text-caption text-text-muted" style={{ margin: "2px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.email}
            </p>
          )}
          {token.detalhe && (
            <p className="text-caption text-text-muted" style={{ margin: "4px 0 0", lineHeight: 1.5 }}>
              {token.detalhe}
            </p>
          )}
        </div>
      </div>

      {/* O recorte DECLARADO. `null` quando não há o que declarar — "8 de 8"
          seria ruído que se aprende a ignorar. */}
      {recorte && (
        <p className="text-caption text-text-muted" style={{ margin: "var(--tk-s-3) 0 0" }}>
          {recorte}
        </p>
      )}

      <p className="text-caption text-text-muted" style={{ margin: "var(--tk-s-2) 0 0" }}>
        {p.trackedCount} de {plural(p.accountCount, "conta rastreada", "contas rastreadas")}
      </p>

      {p.erroDescoberta && (
        <div
          className="text-caption"
          style={{
            marginTop: "var(--tk-s-3)",
            padding: "8px 10px",
            borderRadius: "var(--tk-radius-controle)",
            borderLeft: "3px solid var(--tk-danger)",
            background: "color-mix(in srgb, var(--tk-danger) 7%, var(--tk-surface))",
            lineHeight: 1.5,
          }}
        >
          {/* ⚠️ VERBATIM da view antiga: é o que explica `accountStatus` nulo em
              MASSA — sem esta frase o sintoma é "Status não informado" em todas
              as contas, e o usuário culpa cada uma. */}
          <strong>{p.erroDescoberta.mensagem}</strong>
          {p.erroDescoberta.acao && (
            <div className="text-text-muted" style={{ marginTop: 2 }}>{p.erroDescoberta.acao}</div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "var(--tk-s-2)", marginTop: "var(--tk-s-4)", flexWrap: "wrap" }}>
        {/* 🔑 RECONECTAR é a ação principal, e ela vira PRIMÁRIA quando o selo
            pede. Um botão discreto ao lado de "token expirado" seria a tela
            sabendo do problema e não pedindo a solução. */}
        {/* ⚠️ O `href` de reconectar é o MESMO da conexão inicial: o OAuth da
            Meta reconecta o perfil já existente pelo `fbUserId`. Não há rota
            própria, e inventar uma seria caminho que não existe. */}
        <Button href={connectHref} variante={token.pedeAcao ? "primario" : "secundario"} iconeInicio="atualizar">
          Reconectar
        </Button>
        <Button variante="fantasma" onClick={() => void p.setAllTracking()}>
          {p.allTracked ? "Desativar todas" : "Ativar todas"}
        </Button>
        <Button variante="fantasma" onClick={confirmando ? aoCancelar : aoConfirmar}>
          {confirmando ? "Cancelar" : "Desconectar"}
        </Button>
      </div>

      {/* ⛔ A confirmação NOMEIA o que se perde E o que NÃO se perde. Sem a
          segunda metade o usuário supõe o pior e não desconecta nunca — ou
          desconecta achando que apaga o histórico. */}
      {confirmando && (
        <div
          role="alertdialog"
          aria-label="Confirmar desconexão"
          style={{
            marginTop: "var(--tk-s-3)",
            padding: "10px 12px",
            borderRadius: "var(--tk-radius-controle)",
            border: "1px solid var(--tk-borda)",
            background: "var(--tk-surface-hover)",
          }}
        >
          <p className="text-caption text-text" style={{ margin: 0, lineHeight: 1.5 }}>
            Desconectar <strong>{p.name}</strong> para a sincronização com a Meta. As campanhas, os gastos e as vendas já
            registrados <strong>continuam no histórico</strong> — o que para é a atualização deles.
          </p>
          <div style={{ display: "flex", gap: "var(--tk-s-2)", marginTop: "var(--tk-s-3)" }}>
            {/* ⚠️ Não há variante `perigo` no `Button` — o peso vem da
                confirmação nomeando o efeito, não da cor do botão. */}
            <Button variante="primario" onClick={() => void p.disconnect()}>
              Desconectar
            </Button>
            <Button variante="fantasma" onClick={aoCancelar}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <ContasDoPerfil p={p} />
    </Card>
  );
}

function ContasDoPerfil({ p }: { p: Perfil }) {
  if (p.accounts.length === 0) return null;

  return (
    <div style={{ marginTop: "var(--tk-s-4)", borderTop: "1px solid var(--tk-borda)", paddingTop: "var(--tk-s-3)" }}>
      <button
        type="button"
        onClick={() => p.toggleExpanded()}
        aria-expanded={p.expanded}
        className="text-caption text-primary"
        style={{ background: "none", border: 0, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 5 }}
      >
        {p.expanded ? "Ocultar contas" : `Ver ${plural(p.accounts.length, "conta", "contas")}`}
        <Icone nome={p.expanded ? "chevronCima" : "chevronBaixo"} tamanho={13} cor="marca" />
      </button>

      {p.expanded && (
        <ul style={{ listStyle: "none", margin: "var(--tk-s-3) 0 0", padding: 0, display: "flex", flexDirection: "column", gap: "var(--tk-s-3)" }}>
          {p.accounts.map((ac) => (
            <li key={ac.id} style={{ display: "flex", gap: "var(--tk-s-2)", alignItems: "flex-start", flexWrap: "wrap" }}>
              <Switch ligado={ac.trackingOn} aoMudar={() => void ac.toggleTracking()} rotulo={`Rastrear ${ac.name}`} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <span className="text-caption text-text">{ac.name}</span>
                <span className="text-caption text-text-muted"> · {ac.fbAccountId}</span>
                {ac.currency && <span className="text-caption text-text-muted"> · {ac.currency}</span>}
                {/* ⚠️ `Status não informado` é distinto de `Desabilitada`: o
                    primeiro é ausência de medição, o segundo é medição. */}
                {ac.statusLabel && (
                  <span className={ac.statusTag} style={{ marginLeft: 6 }}>
                    {ac.statusLabel}
                  </span>
                )}
              </div>

              <Button variante="fantasma" onClick={() => void ac.sync()} disabled={ac.syncBusy}>
                {ac.syncBusy ? "Sincronizando…" : "Sincronizar"}
              </Button>
              {ac.syncMsg && (
                <span className="text-caption text-text-muted" style={{ flexBasis: "100%" }}>
                  {ac.syncMsg}
                </span>
              )}

              {/* ⚠️ Primeira sincronização busca histórico e demora — dizer isso
                  evita que a espera pareça travamento. */}
              {ac.buscandoHistorico && !ac.erroSync && (
                <span className="text-caption text-text-muted" style={{ flexBasis: "100%" }}>
                  Buscando o histórico dos últimos dias — a primeira sincronização demora mais.
                </span>
              )}

              {/* 🔴 VERBATIM: conta que falha pela MESMA causa do perfil ganha
                  uma LINHA, não um bloco. Com 5 contas e um token sem permissão
                  a tela mostrava 6 blocos idênticos — a causa é uma só. */}
              {ac.erroSync && ac.mesmoErroDoPerfil && (
                <span
                  className="text-caption text-text-muted"
                  style={{ flexBasis: "100%", display: "flex", gap: 6, alignItems: "center" }}
                >
                  <Icone nome="erro" tamanho={12} cor="perigo" />
                  Não sincroniza — mesmo motivo do aviso acima.
                  {ac.falhasSeguidas > 1 && <span>· {plural(ac.falhasSeguidas, "tentativa", "tentativas")}</span>}
                  {ac.esperaLabel && <span>· {ac.esperaLabel}</span>}
                </span>
              )}

              {ac.erroSync && !ac.mesmoErroDoPerfil && (
                <div
                  className="text-caption"
                  style={{
                    flexBasis: "100%",
                    marginTop: 2,
                    padding: "8px 10px",
                    borderRadius: "var(--tk-radius-controle)",
                    lineHeight: 1.5,
                    borderLeft: `3px solid ${ac.erroSync.tom === "erro" ? "var(--tk-danger)" : "var(--tk-warning)"}`,
                    background: `color-mix(in srgb, ${ac.erroSync.tom === "erro" ? "var(--tk-danger)" : "var(--tk-warning)"} 7%, var(--tk-surface))`,
                  }}
                >
                  <strong>{ac.erroSync.mensagem}</strong>
                  {ac.erroSync.acao && (
                    <div className="text-text-muted" style={{ marginTop: 2 }}>
                      {ac.erroSync.acao}
                    </div>
                  )}
                  {/* O contador separa "falhou agora" de "falha há dias", que é
                      a diferença entre esperar e agir. Erro temporário (rate
                      limit) não mostra: ele passa sozinho e o número assustaria
                      à toa. */}
                  {!ac.erroSync.temporario && ac.falhasSeguidas > 1 && (
                    <div className="text-text-muted" style={{ marginTop: 2 }}>
                      {plural(ac.falhasSeguidas, "tentativa seguida sem sucesso", "tentativas seguidas sem sucesso")}
                      {/* ⚠️ Dizer que vai tentar de novo evita que a espera
                          pareça abandono — e evita o clique repetido em
                          "Sincronizar", que ignora o backoff de propósito. */}
                      {ac.esperaLabel && ` · ${ac.esperaLabel}`}
                      {ac.trackingOn && " · desligue o rastreamento para parar de tentar"}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
