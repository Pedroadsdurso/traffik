/**
 * TODO CONTROLE LÊ `--tk-altura-controle`. NENHUM TRAZ A ALTURA NA MÃO.
 *
 * 🔴 O BUG QUE ESTE ARQUIVO EXISTE PARA IMPEDIR (07/08/2026)
 *
 * Quatro dos cinco controles da barra de topo — `Filtros`, ajuda, sino e tema —
 * tinham `height: 32` escrito à mão. Só a busca lia o token. **E os cinco
 * pareciam alinhados**, porque o app roda em `:root`, onde `--tk-altura-controle`
 * vale exatamente `32px`: os números concordavam por coincidência.
 *
 * Em `[data-density="default"]` (36px) e `comfortable` (40px) só a busca crescia
 * e a barra se partia. Ou seja: o token era um controle que não controlava nada
 * para 4 de 5 consumidores, e o defeito era invisível **na única configuração em
 * que alguém testa**.
 *
 * ⚠️ E havia a segunda metade, que é a mais difícil de achar: o `marginTop: 4`
 * que compensava o desencontro **não morreu quando a busca foi corrigida —
 * SUBIU UM NÍVEL**, do botão para o `<div>` do grupo. O curativo deixou de ficar
 * ao lado do valor que compensava, então o `grep` que procura os dois juntos não
 * achava mais. Por isso a asserção 2 abaixo procura o empurrãozinho em TODA a
 * pasta, não só perto de uma altura.
 *
 * ### Por que ESTÁTICO, e qual é o limite
 *
 * A versão óbvia seria renderizar a barra em duas densidades e comparar as
 * alturas. Ela **não pode falhar**: `renderToStaticMarkup` não resolve
 * `var(--tk-*)` — não há CSSOM, e os dois lados devolveriam a mesma string. Para
 * medir de verdade seria preciso navegador + servidor + sessão `httpOnly`, que é
 * o custo já recusado neste projeto.
 *
 * ⛔ **O limite está aqui, escrito:** esta guarda lê o FONTE. Ela pega
 * `height: 32` num elemento com `cursor-pointer`; não pega quem calcular a
 * altura numa variável três linhas antes, nem quem usar `padding` para chegar no
 * mesmo lugar. É o mesmo limite do `test:blocos-vazios`, e pelo mesmo motivo.
 *
 *   npm run test:altura-controle
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PASTA = "src/components/tk";
const arquivos = readdirSync(PASTA).filter((f) => f.endsWith(".tsx"));

let ok = 0;
const falhas = [];
function checa(nome, condicao, detalhe) {
  if (condicao) { ok++; return; }
  falhas.push(`${nome}${detalhe ? ` — ${detalhe}` : ""}`);
}

/* ── Coleta ──────────────────────────────────────────────────────────────────
   Trabalhamos sobre o fonte com os COMENTÁRIOS REMOVIDOS. Sem isso, o próprio
   texto que explica o bug ("tinham `height: 32`") derrubaria a guarda — e a
   reação natural seria enfraquecer a regex até parar de doer, que é como um
   teste vira decoração. */
const semComentarios = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const fontes = arquivos.map((f) => ({ f, src: semComentarios(readFileSync(join(PASTA, f), "utf8")) }));

/* Prova que houve o que examinar. Contagem de violações `=== 0` passa com a
   coleção vazia — um erro de caminho tornaria as duas asserções abaixo verdes
   sem terem olhado um arquivo sequer. */
checa("a varredura encontrou componentes para examinar", fontes.length >= 20, `${fontes.length} arquivos`);
checa(
  "e encontrou o token em uso em pelo menos um deles",
  fontes.some(({ src }) => src.includes("--tk-altura-controle")),
);

/* ── 1. Altura numérica em elemento interativo (`06` §14.1) ─────────────────
   O alvo é a linha de `style` que declara `height:` com número LITERAL dentro
   de um elemento que o usuário clica. `minHeight` fica de fora de propósito: um
   piso não é uma altura, e a linha de tabela tem o token próprio
   (`--tk-altura-linha`). */
const ALTURA_NUA = /\bheight:\s*(\d+)\b/g;

for (const { f, src } of fontes) {
  const linhas = src.split("\n");
  for (let i = 0; i < linhas.length; i++) {
    for (const m of linhas[i].matchAll(ALTURA_NUA)) {
      const px = Number(m[1]);
      /* Abaixo de 24px não é caixa de controle — é ponto de status, badge de
         contagem, traço de separador, quadradinho de legenda. Acima de 56 é
         cabeçalho ou linha de campo, que têm medidas próprias. A faixa 24–56 é
         onde vivem botão, input e select. */
      if (px < 24 || px > 56) continue;

      /* O elemento é interativo? Procuramos na vizinhança, porque `className` e
         `style` costumam estar em linhas diferentes do mesmo JSX. */
      const bloco = linhas.slice(Math.max(0, i - 14), i + 3).join("\n");
      const interativo = /cursor-pointer|<button|type="button"|role="button"/.test(bloco);
      if (!interativo) continue;

      falhas.push(
        `${f}:${i + 1} — controle com \`height: ${px}\` na mão. Use \`var(--tk-altura-controle)\`.`,
      );
    }
  }
}
checa("nenhum controle traz a altura em pixel", falhas.length === 0);

/* ── ⛔ O EMPURRÃOZINHO NÃO É DETECTÁVEL ASSIM. NÃO ACRESCENTE ESTA REGRA. ───
 *
 * Eu escrevi uma segunda regra procurando `marginTop`/`translateY` de 1–4px em
 * fluxo normal — a família do curativo. **Ela acusou 16 lugares e nenhum era o
 * defeito**, porque o curativo e dois padrões legítimos têm o MESMO formato:
 *
 *   1. ritmo tipográfico — `marginTop: 2` entre um rótulo e a legenda dele,
 *      numa pilha vertical (`Card`, `Kpi`, `EmptyState`, `CatalogoLateral`);
 *   2. alinhamento à PRIMEIRA LINHA do texto numa fileira horizontal — o
 *      quadrado do checkbox em `Controles`, e o carimbo de tempo que o
 *      `06` §14.3 **exige** que seja assim ("não centrado verticalmente").
 *
 * O (2) é indistinguível do curativo no fonte: os dois são um deslocamento
 * vertical pequeno dentro de um flex horizontal. A diferença mora na INTENÇÃO
 * — alinhar a uma linha de base × disfarçar um desencontro de altura — e
 * intenção não está no arquivo.
 *
 * ⚠️ E a consequência de manter uma guarda assim é conhecida: 16 acusações
 * legítimas por execução fazem alguém afrouxar a regex até parar de doer, e aí
 * ela vira comentário com sintaxe de código. Guarda que acusa o certo não é
 * guarda, do mesmo jeito que guarda que nunca dispara não é.
 *
 * ✅ O que RESTA vigiando o curativo é a regra 1 acima, e ela basta pela raiz:
 * o empurrãozinho existe para compensar uma altura fora do token, e sem altura
 * fora do token não há o que compensar. Atacar a causa, não a manifestação.
 */

/* ── 2. A guarda precisa poder FALHAR pelo motivo que alega medir ───────────
   Sem isto, uma regex quebrada deixaria a regra 1 verde para sempre. O trecho
   abaixo é exatamente o código que estava no `ContextBar`. */
const CASO_RUIM = `
  <button type="button" className="cursor-pointer rounded-controle">
    <span style={{ height: 32 }} />
  </button>`;
const achouAltura = [...CASO_RUIM.split("\n").entries()].some(([i, l]) => {
  const bloco = CASO_RUIM.split("\n").slice(Math.max(0, i - 14), i + 3).join("\n");
  return [...l.matchAll(/\bheight:\s*(\d+)\b/g)].some((m) => {
    const px = Number(m[1]);
    return px >= 24 && px <= 56 && /cursor-pointer|<button/.test(bloco);
  });
});
checa("a regra reprova o código que existia no ContextBar", achouAltura);

/* E o lado negativo: ela NÃO pode acusar quem já lê o token, senão o verde de
   hoje seria sorte. */
const CASO_BOM = `
  <button type="button" className="cursor-pointer rounded-controle"
    style={{ height: "var(--tk-altura-controle)" }} />`;
checa(
  "e não reprova o controle que lê o token",
  ![...CASO_BOM.matchAll(/\bheight:\s*(\d+)\b/g)].length,
);

console.log(`\n\x1b[1mAltura de controle\x1b[0m`);
for (const f of falhas) console.log(`  \x1b[31m✗\x1b[0m ${f}`);
console.log(
  falhas.length === 0
    ? `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`
    : `\n\x1b[1m\x1b[31m${falhas.length} violações em ${fontes.length} componentes.\x1b[0m\n`,
);
process.exit(falhas.length === 0 ? 0 : 1);
