"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";

import type { OpcoesExclusao, PreviaExclusao, WorkspaceDTO } from "@/lib/actions/workspaces";
import { consequenciasDaExclusao, ampliaEscopo, type Consequencia } from "@/lib/areas/consequencia";
import { Button } from "@/components/tk/Button";
import { Gaveta } from "@/components/tk/Gaveta";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";
import { Checkbox } from "@/components/tk/Controles";

/**
 * GavetaExcluir — o único fluxo irreversível das doze telas.
 *
 * ══════════════════════════════════════════════════════════════════════════════
 * 🔴 ELA DIZ O QUE A EXCLUSÃO **PROMOVE**, NÃO SÓ O QUE APAGA
 * ══════════════════════════════════════════════════════════════════════════════
 *
 * `AutomationRule.workspaceId` e `Expense.workspaceId` NULOS significam
 * **GLOBAL** — e `onDelete: SetNull` não é estado neutro ali, é promoção de
 * escopo. Foi assim que excluir uma área transformou "pause as campanhas desta
 * operação" em "pause as de TODAS as contas", com a regra ainda ativa.
 *
 * ⛔ A CONTAGEM É REAL, buscada ANTES de o diálogo aparecer. Um número genérico
 * não faz ninguém parar; "3 regras vão passar a pausar campanhas de todas as
 * operações" faz. Quem monta as frases é `lib/areas/consequencia.ts`, puro e
 * testado.
 *
 * ⚠️ E O TEXTO SEGUE A ESCOLHA. Os padrões de `OpcoesExclusao` já são os
 * seguros (`regras` e `despesas` nascem em `excluir`), então **na configuração
 * padrão não há promoção nenhuma** — e o bloco de alarme não aparece. Alarmar
 * ali seria alarme que grita sem motivo, e alarme que grita sem motivo envenena
 * o único sinal que existe.
 * ══════════════════════════════════════════════════════════════════════════════
 */

/** As opções seguras. ⛔ São as mesmas do servidor — ver `OpcoesExclusao`. */
const PADRAO: OpcoesExclusao = {
  contas: "mover",
  webhooks: "mover",
  pixels: "mover",
  regras: "excluir",
  despesas: "excluir",
  apagarDados: false,
};

export function GavetaExcluir({
  area,
  previa,
  carregando,
  aoFechar,
  aoConfirmar,
}: {
  area: WorkspaceDTO;
  previa: PreviaExclusao | null;
  carregando: boolean;
  aoFechar: () => void;
  aoConfirmar: (opcoes: OpcoesExclusao) => Promise<void>;
}) {
  const [opcoes, setOpcoes] = React.useState<OpcoesExclusao>(PADRAO);
  const [nome, setNome] = React.useState("");
  const [enviando, setEnviando] = React.useState(false);

  const consequencias = previa ? consequenciasDaExclusao(previa, opcoes) : [];
  const promove = previa ? ampliaEscopo(previa, opcoes) : false;
  const nomeConfere = nome.trim() === area.name;

  const trocar = (campo: keyof OpcoesExclusao) => (valor: string) =>
    setOpcoes((o) => ({ ...o, [campo]: valor }));

  return (
    <Gaveta
      aberta
      titulo={`Excluir “${area.name}”`}
      descricao="Escolha o destino de cada coisa que pertence a esta área. Nada acontece por omissão."
      aoFechar={aoFechar}
      rodape={
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variante="destrutivo"
            disabled={!previa || !nomeConfere}
            carregando={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await aoConfirmar({ ...opcoes, nomeDigitado: nome.trim() });
              } finally {
                setEnviando(false);
              }
            }}
          >
            Excluir área
          </Button>
        </div>
      }
    >
      {carregando || !previa ? (
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          Contando o que pertence a esta área…
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* 🔴 O bloco de promoção vem PRIMEIRO e só existe quando há promoção.
              É a única consequência que volta a AGIR sozinha depois que a tela
              fecha — as outras são perda, e perda não age. */}
          {promove && (
            <BlocoConsequencia
              tom="promocao"
              itens={consequencias.filter((c) => c.tom === "promocao")}
              titulo="Isto passa a valer para TODAS as áreas"
            />
          )}

          <Destinos previa={previa} opcoes={opcoes} trocar={trocar} setOpcoes={setOpcoes} />

          {consequencias.some((c) => c.tom === "perda") && (
            <BlocoConsequencia
              tom="perda"
              itens={consequencias.filter((c) => c.tom === "perda")}
              titulo="Isto é apagado e não volta"
            />
          )}

          {consequencias.some((c) => c.tom === "neutro") && (
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
              {consequencias
                .filter((c) => c.tom === "neutro")
                .map((c) => (
                  <li key={c.texto} className="text-caption text-text-muted">
                    {c.texto}
                  </li>
                ))}
            </ul>
          )}

          {/* ⚠️ Confirmação por DIGITAÇÃO, e o servidor confere de novo
              (`nomeDigitado`). O campo aqui é o atrito; a validação de verdade é
              lá, porque a tela pode ser contornada. */}
          <Input
            rotulo={`Digite ${area.name} para confirmar`}
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={area.name}
            apoio="A exclusão não pode ser desfeita."
          />
        </div>
      )}
    </Gaveta>
  );
}

function BlocoConsequencia({
  tom,
  titulo,
  itens,
}: {
  tom: "promocao" | "perda";
  titulo: string;
  itens: Consequencia[];
}) {
  /* ⚠️ Promoção é ATENÇÃO (âmbar) e perda é PERIGO (vermelho), e a distinção é
     real: a promoção é reversível editando a regra depois; a perda, não. */
  const cor = tom === "promocao" ? "warning" : "danger";
  return (
    <div
      className={`bg-tint-${cor}`}
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        borderRadius: "var(--tk-radius-controle)",
        border: `1px solid color-mix(in oklch, var(--tk-${cor}) 32%, transparent)`,
        padding: "10px 12px",
      }}
    >
      <AlertTriangle
        size={15}
        strokeWidth={1.75}
        aria-hidden="true"
        className={`text-on-tint-${cor}`}
        style={{ flex: "none", marginTop: 2 }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
        <span className={`text-label text-on-tint-${cor}`}>{titulo}</span>
        <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
          {itens.map((c) => (
            <li key={c.texto} className={`text-caption text-on-tint-${cor}`}>
              {c.texto}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Um seletor por grupo, e cada um só aparece se houver o que decidir. */
function Destinos({
  previa,
  opcoes,
  trocar,
  setOpcoes,
}: {
  previa: PreviaExclusao;
  opcoes: OpcoesExclusao;
  trocar: (c: keyof OpcoesExclusao) => (v: string) => void;
  setOpcoes: React.Dispatch<React.SetStateAction<OpcoesExclusao>>;
}) {
  const grupos = [
    {
      campo: "contas" as const,
      rotulo: `Contas de anúncio (${previa.contas.length})`,
      n: previa.contas.length,
      opcoes: [
        { valor: "mover", rotulo: "Mover para a Principal" },
        { valor: "remover", rotulo: "Apagar da ferramenta" },
      ],
    },
    {
      campo: "webhooks" as const,
      rotulo: `Webhooks (${previa.webhooks.length})`,
      n: previa.webhooks.length,
      opcoes: [
        { valor: "mover", rotulo: "Mover para a Principal" },
        { valor: "excluir", rotulo: "Excluir" },
      ],
    },
    {
      campo: "pixels" as const,
      rotulo: `Pixels (${previa.pixels.length})`,
      n: previa.pixels.length,
      opcoes: [
        { valor: "mover", rotulo: "Mover para a Principal" },
        { valor: "excluir", rotulo: "Excluir" },
      ],
    },
    {
      campo: "regras" as const,
      rotulo: `Regras de automação (${previa.regras.length})`,
      n: previa.regras.length,
      opcoes: [
        { valor: "excluir", rotulo: "Excluir" },
        { valor: "mover", rotulo: "Mover para a Principal" },
      ],
    },
    {
      campo: "despesas" as const,
      rotulo: `Despesas (${previa.despesas.length})`,
      n: previa.despesas.length,
      opcoes: [
        { valor: "excluir", rotulo: "Excluir" },
        { valor: "mover", rotulo: "Mover para a Principal" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {grupos
        /* ⛔ Grupo vazio não desenha seletor: uma escolha sobre zero itens é
           controle que não controla nada, e ainda faz o diálogo parecer mais
           perigoso do que é. */
        .filter((g) => g.n > 0)
        .map((g) => (
          <Select
            key={g.campo}
            rotulo={g.rotulo}
            valor={(opcoes[g.campo] as string) ?? g.opcoes[0].valor}
            aoEscolher={trocar(g.campo)}
            opcoes={g.opcoes}
          />
        ))}

      <Checkbox
        marcado={opcoes.apagarDados === true}
        aoMudar={(v) => setOpcoes((o) => ({ ...o, apagarDados: v }))}
        rotulo="Apagar também vendas, cliques e eventos desta área"
        apoio={`${previa.dados.vendas} vendas, ${previa.dados.cliques} cliques e ${previa.dados.eventos} eventos. Sem isto, eles vão para a Principal.`}
      />
    </div>
  );
}
