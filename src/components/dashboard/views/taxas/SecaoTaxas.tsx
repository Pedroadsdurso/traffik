"use client";

import * as React from "react";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";

import {
  AVISO_UNICA,
  CALC_PADRAO,
  FORMAS_DE_PAGAMENTO,
  FREQUENCIAS,
  FREQUENCIA_PADRAO,
  GRUPOS,
  MODOS_CALC,
  TODAS_AS_FORMAS,
  aceitaCalc,
  aceitaFormaDePagamento,
  formaParaServidor,
  type DespesaLinha,
  type Grupo,
  foraDoCalculo,
  incidencia,
} from "@/lib/taxas/apresentacao";
import { Button } from "@/components/tk/Button";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";
import type { TraffikView } from "@/components/dashboard/useTraffikState";

/**
 * A seção de TAXAS E DESPESAS, e a moldura compartilhada da tela.
 *
 * ⛔ ESTE ARQUIVO NÃO IMPORTA NENHUMA SERVER ACTION, e a separação não é
 * estética: `lib/actions/profile.ts` puxa o `prisma`, e **importar o prisma já
 * lança sem `DATABASE_URL`**. Com os dois cartões de configuração aqui dentro,
 * `test:taxas` não conseguiria renderizar a tela — teria de virar teste de texto,
 * e aí ele deixaria de responder "como ficou".
 *
 * É o mesmo MOVE que `lib/areas/escopoWhere.ts` fez pelo `test:pixel-tela`.
 *
 * ⚠️ Quem consome as ações é `TaxasScreen`, que compõe as duas seções.
 */

/* ── moldura ────────────────────────────────────────────────────────────────── */

export function Secao({ titulo, apoio, children }: { titulo: string; apoio: string; children: React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {/* `text-micro` é o eyebrow de seção — um dos dois usos que a escala
            permite para ele (o outro é cabeçalho de tabela). */}
        <h2 className="text-micro text-text-secondary" style={{ margin: 0 }}>
          {titulo}
        </h2>
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          {apoio}
        </p>
      </div>
      {children}
    </section>
  );
}

export function Cartao({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      className="bg-surface"
      style={{
        border: "1px solid var(--tk-border)",
        borderRadius: "var(--tk-radius-card)",
        boxShadow: "var(--tk-shadow-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minWidth: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CabecalhoCartao({
  icone,
  titulo,
  apoio,
}: {
  icone: React.ReactNode;
  titulo: string;
  apoio: string;
}) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      {/* Quadrado arredondado NEUTRO de 36px — a forma do `06` §13 para ícone que
          ILUSTRA um bloco. Tingir por categoria faria ele se ler como selo de
          estado, e aqui não há estado nenhum a comunicar. */}
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
  );
}

/**
 * A caixa de consequência.
 *
 * ⚠️ Tom de ATENÇÃO, não de perigo: nada está quebrado e nada foi perdido — há
 * um custo que não está sendo contado. Vermelho pediria uma ação que o usuário
 * não tem (a migration do `ocorreEm` é nossa).
 */
export function Aviso({ children }: { children: React.ReactNode }) {
  return (
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
      <AlertTriangle
        size={15}
        strokeWidth={1.75}
        aria-hidden="true"
        className="text-on-tint-warning"
        style={{ flex: "none", marginTop: 1 }}
      />
      <div
        className="text-caption text-on-tint-warning"
        style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── a seção ────────────────────────────────────────────────────────────────── */

export function SecaoTaxas({ v }: { v: TraffikView }) {
  return (
    <Secao titulo="Taxas e despesas" apoio="Tudo que é descontado do faturamento antes de sobrar lucro.">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {GRUPOS.map((g) => (
          <GrupoDeDespesas key={g.tipo} grupo={g} v={v} />
        ))}
      </div>
    </Secao>
  );
}

function GrupoDeDespesas({ grupo, v }: { grupo: Grupo; v: TraffikView }) {
  const linhas = (v.despesasCruas as DespesaLinha[]).filter((d) => d.type === grupo.tipo);
  const recorrente = grupo.tipo === "DESPESA_RECORRENTE";
  const temUnica = linhas.some(foraDoCalculo);

  return (
    <Cartao>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span className="text-title text-text">{grupo.titulo}</span>
        <span className="text-caption text-text-muted">{grupo.apoio}</span>
      </div>

      {linhas.length === 0 ? (
        /* ⚠️ O vazio diz a CONSEQUÊNCIA de não cadastrar, nunca "nenhum item".
           A frase é dado (`GRUPOS`), não template. */
        <p className="text-caption text-text-muted" style={{ margin: 0 }}>
          {grupo.vazio}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
          {linhas.map((d) => (
            <LinhaDespesa key={d.id} d={d} v={v} />
          ))}
        </ul>
      )}

      {/* 🔴 O AVISO APARECE PORQUE EXISTE LINHA `UNICA` — não porque alguém tocou
          num seletor, e o seletor nem oferece a opção. Estas linhas vieram de
          antes, e são justamente as que ninguém sabe que não contam. */}
      {recorrente && temUnica && <Aviso>{AVISO_UNICA}</Aviso>}

      <FormNovaDespesa grupo={grupo} v={v} />
    </Cartao>
  );
}

function LinhaDespesa({ d, v }: { d: DespesaLinha; v: TraffikView }) {
  const fora = foraDoCalculo(d);
  return (
    <li
      className="tk-linha"
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 8px", borderRadius: 8, minWidth: 0 }}
    >
      <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0, flex: 1 }}>
        <span className="text-body text-text" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
          {d.name}
        </span>
        {/* 🔴 A FRASE DE INCIDÊNCIA — o entregável desta tela. "R$ 2,50 por venda
            no Pix" e "3,5% sobre toda venda" são grandezas diferentes, e a lista
            antiga mostrava as duas como número solto. */}
        <span className={fora ? "text-caption text-warning" : "text-caption text-text-muted"}>
          {incidencia(d)}
          {fora && " · fora do cálculo"}
        </span>
      </span>

      <Button
        variante="fantasma"
        apenasIcone
        aria-label={`Remover ${d.name}`}
        onClick={() => void v.removerDespesa(d.id)}
      >
        <Trash2 size={15} strokeWidth={1.75} />
      </Button>
    </li>
  );
}

/**
 * O formulário de cada grupo.
 *
 * ⛔ O SELETOR OFERECE QUATRO FREQUÊNCIAS, e `UNICA` não é uma delas — decisão do
 * dono, 12/08/2026; o motivo está em `FREQUENCIAS`. O padrão é `MENSAL`, que é
 * **exatamente o que o código já fazia** antes de existir seletor: nada muda
 * para quem não mexer nele, e `test:taxas` prova a igualdade com o fallback da
 * ação.
 *
 * ⛔ E `criarDespesa` carrega a ÁREA ATIVA. `Expense.workspaceId` NULO significa
 * "vale para TODAS as áreas", não "sem dono" — a despesa de uma operação passaria
 * a ser descontada do lucro de todas, com número plausível nas duas pontas.
 */
function FormNovaDespesa({ grupo, v }: { grupo: Grupo; v: TraffikView }) {
  const recorrente = grupo.tipo === "DESPESA_RECORRENTE";
  const escolheCalc = aceitaCalc(grupo.tipo);
  const escolheForma = aceitaFormaDePagamento(grupo.tipo);

  const [nome, setNome] = React.useState("");
  const [valor, setValor] = React.useState("");
  const [calc, setCalc] = React.useState<string>(CALC_PADRAO);
  const [forma, setForma] = React.useState<string>(TODAS_AS_FORMAS);
  const [frequencia, setFrequencia] = React.useState<string>(FREQUENCIA_PADRAO);
  const [enviando, setEnviando] = React.useState(false);

  /* ⛔ Quem NÃO escolhe tem o modo cravado, e os dois cravam por razão de
     domínio: imposto sobre venda é percentual por natureza, e despesa fixa em %
     do faturamento não é despesa fixa — ela deixaria de ser o custo que existe
     mesmo sem vender, que é o que faz dela a base do break-even. É exatamente o
     que a tela antiga fazia. */
  const calcEfetivo = (escolheCalc ? calc : recorrente ? "FIXO" : "PERCENTUAL") as DespesaLinha["calc"];

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(valor.replace(",", ".")) || 0;
    if (!nome.trim() || !amount) return;
    setEnviando(true);
    try {
      await v.criarDespesa({
        name: nome,
        type: grupo.tipo,
        calc: calcEfetivo,
        amount,
        /* 🔴 O SENTINELA VIRA `null` AQUI, na fronteira com o servidor.
           `__TODAS__` só existe na interface: no banco, "todas as formas" é
           `null`. Gravar a string faria a taxa não casar com forma nenhuma — a
           linha apareceria na tela e não entraria em cálculo algum. */
        paymentMethod: escolheForma ? formaParaServidor(forma) : undefined,
        recurrence: recorrente ? (frequencia as DespesaLinha["recurrence"]) : undefined,
      });
      setNome("");
      setValor("");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        flexWrap: "wrap",
        paddingTop: 12,
        borderTop: "1px solid var(--tk-border)",
        marginTop: 4,
      }}
    >
      <div style={{ flex: "2 1 180px", minWidth: 0 }}>
        <Input rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Hotmart" />
      </div>
      <div style={{ flex: "1 1 110px", minWidth: 0 }}>
        <Input
          rotulo="Valor"
          value={valor}
          inputMode="decimal"
          onChange={(e) => setValor(e.target.value)}
          /* ⚠️ O sufixo segue o modo ESCOLHIDO, não o tipo do grupo — senão o
             campo diria "%" enquanto o servidor grava reais. */
          sufixo={calcEfetivo === "FIXO" ? "R$" : "%"}
          placeholder={calcEfetivo === "FIXO" ? "2,50" : "3,5"}
        />
      </div>
      {escolheCalc && (
        <div style={{ flex: "1 1 210px", minWidth: 0 }}>
          {/* ⚠️ O rótulo de cada opção diz o EFEITO, não o nome do modo: `%` e
              `R$` sozinhos são símbolos, e o campo ao lado aceita os dois — é
              exatamente ali que alguém cadastra R$ 3,50 achando que são 3,5%. */}
          <Select
            rotulo="Como incide"
            valor={calc}
            aoEscolher={setCalc}
            opcoes={MODOS_CALC.map((m) => ({ valor: m.valor as string, rotulo: m.rotulo }))}
          />
        </div>
      )}
      {escolheForma && (
        <div style={{ flex: "1 1 180px", minWidth: 0 }}>
          <Select
            rotulo="Forma de pagamento"
            valor={forma}
            aoEscolher={setForma}
            opcoes={FORMAS_DE_PAGAMENTO.map((f) => ({ valor: f.valor, rotulo: f.rotulo }))}
          />
        </div>
      )}
      {recorrente && (
        <div style={{ flex: "1 1 150px", minWidth: 0 }}>
          <Select
            rotulo="Frequência"
            valor={frequencia}
            aoEscolher={setFrequencia}
            opcoes={FREQUENCIAS.map((f) => ({ valor: f.valor as string, rotulo: f.rotulo }))}
          />
        </div>
      )}
      <Button type="submit" variante="secundario" carregando={enviando} iconeInicio={<Plus size={15} strokeWidth={2} />}>
        Adicionar
      </Button>
    </form>
  );
}
