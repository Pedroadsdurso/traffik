"use client";

import * as React from "react";

/**
 * CATÁLOGO LATERAL — o que está fora do painel, e a lixeira de quem sai.
 *
 * ⛔ ELE SUBSTITUIU A ROTA `/dashboard/blocos`. Aquela tela existia para provar
 * que nenhum bloco do catálogo desenha vazio, e o lugar definitivo dessa prova é
 * aqui: quem escolhe é o usuário, e é a ele que a lista precisa ser honesta.
 *
 * ### ⛔ OS BOTÕES `+ Principais` / `+ Resumo` SAÍRAM — 07/08/2026
 *
 * Motivo do dono, e ele é o julgamento que importa: *"achei confuso e quase não
 * descobri sozinho"*. O modelo era clicar para adicionar e responder uma
 * pergunta para trocar — duas mecânicas diferentes para a mesma intenção, e
 * nenhuma delas visível antes do clique.
 *
 * Agora é um gesto só: **arrasta daqui para a zona; arrasta de volta para cá
 * para remover.** O destino compatível acende no instante em que o gesto começa,
 * então a regra deixa de ser algo que se descobre errando.
 *
 * ### 🔴 O PAINEL É O ALVO QUE REMOVE
 *
 * E ele só acende para item que JÁ ESTÁ no painel. Aceitar o que veio do próprio
 * catálogo produziria um gesto que atravessa a tela e não muda nada — o usuário
 * ficaria procurando o que fez de errado.
 *
 * ⚠️ Todo item listado aqui é POSICIONÁVEL. Nada entra nesta lista sem uma zona
 * que o receba: opção que não tem destino é a versão de catálogo do botão
 * inerte, e o usuário só descobre depois de tentar.
 */

export interface MetricaDisponivel {
  chave: string;
  rotulo: string;
}

export interface PainelDisponivel {
  id: string;
  titulo: string;
  descricao: string;
}

export function CatalogoLateral({
  metricas,
  paineis,
  faixaCheia,
  arrastando,
  ehAlvo,
  destino,
  aoArrastarMetrica,
  aoArrastarPainel,
  aoTerminarArrasto,
}: {
  metricas: MetricaDisponivel[];
  paineis: PainelDisponivel[];
  /** Só para a frase do teto — o arrasto para o hero continua valendo. */
  faixaCheia: boolean;
  arrastando: boolean;
  /** O ponteiro está sobre este painel agora. */
  ehAlvo: boolean;
  /** Handlers de remoção. `null` = não aceita a carga atual (cursor proibido). */
  destino: { onDragOver: (e: React.DragEvent) => void; onDrop: (e: React.DragEvent) => void } | null;
  aoArrastarMetrica: (chave: string, rotulo: string) => void;
  aoArrastarPainel: (id: string, titulo: string) => void;
  aoTerminarArrasto: () => void;
}) {
  const aceitaRemocao = arrastando && destino !== null;

  return (
    <aside
      aria-label="Blocos disponíveis"
      {...(destino ?? {})}
      className="bg-surface border"
      /* Superfície de conteúdo = sombra de card (`06` §1). Ela ficou de fora
         quando o modo de edição foi escrito, que foi ANTES do `06` existir. */
      style={{
        borderColor: ehAlvo ? "var(--tk-danger)" : aceitaRemocao ? "var(--tk-primary)" : "var(--tk-border)",
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        boxShadow: "var(--tk-shadow-card)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--tk-gap-grid)",
        position: "sticky",
        top: "var(--tk-gap-grid)",
        maxHeight: "calc(100vh - 2 * var(--tk-gap-grid))",
        overflowY: "auto",
        transition: "border-color 120ms",
      }}
    >
      {/* 🔴 A INSTRUÇÃO FICA NA TELA, não numa tooltip. Arrastar é descobrível
          por acidente; arrastar DE VOLTA para remover não é — ninguém tenta um
          gesto que nunca viu. Uma linha de texto é mais barata que um recurso
          que existe e não é encontrado. */}
      {aceitaRemocao ? (
        <p className="text-caption text-danger" style={{ margin: 0, lineHeight: 1.45 }}>
          Solte aqui para remover do painel.
        </p>
      ) : (
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
          Arraste daqui para o painel. Arraste de volta para cá para remover.
        </p>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 className="text-label text-text" style={{ margin: 0 }}>
          Métricas disponíveis
        </h3>
        {faixaCheia && (
          /* ⚠️ Aviso, não bloqueio. O Resumo está cheio, mas Principais continua
             aceitando — dizer "não cabe" sem qualificar seria falso, e o arrasto
             mostraria o contrário meio segundo depois. */
          <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
            Resumo está no limite de 8. Para o Resumo, remova uma antes; Principais aceita por troca.
          </p>
        )}
        {metricas.length === 0 ? (
          <p className="text-caption text-text-muted" style={{ margin: 0 }}>
            Todas as métricas já estão no painel.
          </p>
        ) : (
          metricas.map((m) => (
            <Ficha
              key={m.chave}
              titulo={m.rotulo}
              aoIniciar={() => aoArrastarMetrica(m.chave, m.rotulo)}
              aoTerminar={aoTerminarArrasto}
            />
          ))
        )}
      </section>

      <hr style={{ border: 0, borderTop: "1px solid var(--tk-border)", margin: 0 }} />

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* 🔴 O CONTADOR EXISTE PARA QUE O BLOCO NOVO SEJA DESCOBERTO SEM QUE
            NINGUÉM MEXA NO ARRANJO DE NINGUÉM (decisão do dono, 07/08/2026).

            Três blocos entraram no catálogo naquele dia e **não aparecem para
            quem já tem layout salvo** — injetá-los seria alterar um arranjo que
            o usuário montou. Sem nenhum aviso, porém, eles seriam recurso que
            existe e não é encontrável. O contador é o meio-termo: a informação
            fica a um clique em "Editar painel", e a decisão continua sendo dele.

            ### ⚠️ DIZ "DISPONÍVEIS", NÃO "NOVOS" — e a diferença é de verdade

            O pedido era "3 novos disponíveis". O produto **não sabe o que é
            novo**: a única coisa que ele consegue calcular é "está no catálogo e
            não está no layout", e isso inclui o bloco que o usuário REMOVEU de
            propósito ontem. Chamar de novo o que ele acabou de tirar é o produto
            afirmando algo que não mediu — a distinção "ausência de observação ≠
            observação" na camada da microcópia.

            ⛔ Saber o que é novo exigiria persistir os ids já vistos, e para os
            layouts que já existem não há resposta: eles foram gravados antes do
            campo. O default teria de ser uma lista datada no código — cicatriz
            esperando para virar anatomia. Não vale o preço de uma palavra. */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <h3 className="text-label text-text" style={{ margin: 0 }}>
            Painéis disponíveis
          </h3>
          {paineis.length > 0 && (
            <span
              className="text-caption bg-tint-primary text-on-tint-primary"
              style={{ padding: "1px 8px", borderRadius: "var(--tk-radius-pill)", lineHeight: 1.5, whiteSpace: "nowrap", flex: "none" }}
            >
              {paineis.length} {paineis.length === 1 ? "disponível" : "disponíveis"}
            </span>
          )}
        </div>
        {paineis.length === 0 ? (
          <p className="text-caption text-text-muted" style={{ margin: 0 }}>
            Todos os painéis já estão no painel.
          </p>
        ) : (
          paineis.map((p) => (
            <Ficha
              key={p.id}
              titulo={p.titulo}
              /* A descrição diz o que o bloco RESPONDE. Sem ela a lista vira
                 sete nomes, e a escolha vira adivinhação. */
              descricao={p.descricao}
              aoIniciar={() => aoArrastarPainel(p.id, p.titulo)}
              aoTerminar={aoTerminarArrasto}
            />
          ))
        )}
      </section>
    </aside>
  );
}

/**
 * Uma ficha arrastável do catálogo.
 *
 * ⚠️ Ela é `draggable` INTEIRA, ao contrário dos itens já posicionados, que só
 * arrastam pela alça. A diferença é intencional: dentro da zona há conteúdo para
 * selecionar e botões para clicar, e o arrasto acidental atrapalharia. Aqui não
 * há nada além do próprio item — exigir uma alça seria um alvo menor sem ganho.
 */
function Ficha({
  titulo,
  descricao,
  aoIniciar,
  aoTerminar,
}: {
  titulo: string;
  descricao?: string;
  aoIniciar: () => void;
  aoTerminar: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", titulo);
        e.dataTransfer.effectAllowed = "move";
        aoIniciar();
      }}
      onDragEnd={aoTerminar}
      className="border border-border hover:bg-surface-hover"
      style={{
        borderRadius: "var(--tk-radius-card)",
        padding: 8,
        cursor: "grab",
        display: "flex",
        alignItems: "flex-start",
        gap: 6,
        transition: "background-color 120ms",
      }}
    >
      <span aria-hidden="true" className="text-text-muted" style={{ lineHeight: 1.4 }}>
        ⠿
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="text-caption text-text" style={{ display: "block" }}>
          {titulo}
        </span>
        {descricao && (
          <span className="text-caption text-text-muted" style={{ display: "block", marginTop: 2, lineHeight: 1.4 }}>
            {descricao}
          </span>
        )}
      </span>
    </div>
  );
}
