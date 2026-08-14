/**
 * A LINHA DECLARATIVA DO NÓ DE ICs — função pura, e o motivo de ela existir.
 *
 * 🔴 ELA VIVIA NUMA IIFE DENTRO DO `catalogoRender.tsx`, e por isso nunca foi
 * testada. A asserção que parecia cobri-la (`"as três parcelas do nó de ICs
 * moram em UMA linha"`, em `teste-desenho.mjs`) **montava a string à mão** e a
 * passava pronta para o componente: ela media o DESENHO de uma composição, não
 * a construção dela.
 *
 * ⛔ É a família *FIXTURE QUE CRIA O REGISTRO FINAL DIRETO*: o estado final
 * ficava certo, a suíte ficava verde, e o código que deveria tê-lo produzido
 * nunca rodava. Provado em 14/08/2026 — mudei a regra da linha inteira e as 38
 * asserções seguiram passando.
 *
 * ## O que a linha precisa dizer, e por quê
 *
 * O nó da cadeia é `icsComJornada` (decisão de 14/08/2026). Então a linha tem
 * DOIS trabalhos, e eles são diferentes:
 *
 *   1. DECOMPOR o nó por dentro — quanto veio do navegador, quanto o gateway
 *      carimbou. A segunda parcela é o que torna o trecho seguinte
 *      parcialmente circular, e escondê-la esconderia a circularidade.
 *   2. DECLARAR a entrada lateral por FORA — os checkouts sem jornada, que são
 *      DISJUNTOS de `Sessões` e não pertencem à cadeia.
 *
 * ⛔ **A entrada lateral NUNCA entra na soma.** Um `= 73 checkouts` afirmaria
 * que a etapa vale 73 quando a geometria mede 38 — e foi exatamente essa soma
 * que produziu a pílula de **128,1%**, o impossível apresentado como ganho.
 */

export type ParcelasDoNoDeICs = {
  /** O valor da etapa: `icsComJornada`. Já CONTÉM os derivados da venda. */
  valor: number;
  /** Parcela de DENTRO de `valor`, carimbada pelo webhook do gateway. */
  derivadosDaVenda?: number;
  /** FORA da cadeia: `PixelEvent` sem `clickId`, disjunto de `Sessões`. */
  entradaLateral?: number;
};

const n = (x: number) => x.toLocaleString("pt-BR");

/**
 * Devolve a linha, ou `undefined` quando não há o que declarar.
 *
 * ⚠️ `undefined` com tudo do navegador e sem entrada lateral é DELIBERADO: uma
 * linha dizendo "0 carimbados · 0 sem jornada" seria ruído sobre a boa notícia,
 * e o nó ficaria com duas ancoragens dizendo a mesma coisa.
 */
export function composicaoDoNoDeICs({
  valor,
  derivadosDaVenda = 0,
  entradaLateral = 0,
}: ParcelasDoNoDeICs): string | undefined {
  /* ⛔ O TETO EM `valor` NÃO É ZELO — sem ele a linha imprime parcela NEGATIVA.
     `derivadosDaVenda` é subconjunto de `valor` por construção, mas os dois
     chegam do servidor como números independentes: basta uma janela em que o
     `Click` foi carimbado e a sessão saiu do recorte para `der > valor`. Medido
     em 14/08/2026 pela própria asserção: `valor: 20, der: 24` desenhava
     **"-4 vistos no navegador"** — um número impossível, com cara de medição. */
  const der = Math.min(Math.max(0, derivadosDaVenda), Math.max(0, valor));
  const sem = Math.max(0, entradaLateral);
  if (der === 0 && sem === 0) return undefined;

  /* A decomposição só aparece quando há DUAS parcelas de verdade lá dentro, e
     `valor - der` é a do navegador — nunca negativa, pelo teto acima. */
  const navegador = valor - der;
  const cabeca =
    der > 0 && navegador > 0
      ? `${n(valor)} com jornada (${n(navegador)} vistos no navegador · ${n(der)} carimbados pelo gateway)`
      : `${n(valor)} com jornada`;

  /* ⛔ "e" — não "·", e nunca "=". O separador carrega a distinção: o que vem
     depois dele NÃO é parcela do número, é população de fora. */
  return sem > 0 ? `${cabeca} · e ${n(sem)} sem jornada, fora da cadeia` : cabeca;
}
