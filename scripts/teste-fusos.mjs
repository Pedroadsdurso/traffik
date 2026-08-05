/**
 * `fusosDiscordam` — o fuso da conta bate com o do aparelho?
 *
 * Alimenta o aviso do card "Fuso horário" (Taxas e Despesas), que existe porque
 * `User.timezone` é `@default("America/Sao_Paulo")` e **não é nulo nunca**: no
 * banco, "escolhi Brasília" e "nunca abri esta tela" são indistinguíveis. Quem
 * se cadastra em Lisboa começa com o dia virando 4h cedo, sempre, e nada na tela
 * denuncia.
 *
 * ## O que este teste protege, e são duas coisas opostas
 *
 * | # | Risco | Asserções |
 * |---|---|---|
 * | 1 | **Alarme FALSO** — avisar quando nenhum número muda | as de `false` |
 * | 2 | **Silêncio** — não avisar quando o dia vira em outra hora | as de `true` |
 *
 * O risco 1 é o mais caro dos dois a longo prazo: aviso que aparece sem motivo
 * se aprende a ignorar, e aí o aviso legítimo também é ignorado. É por isso que
 * a maioria das asserções aqui é do lado *"NÃO deve avisar"*.
 *
 * Puro: sem banco, sem rede.
 *
 *   npm run test:fusos
 */
import assert from "node:assert/strict";

const { fusosDiscordam, tzOffsetMs } = await import("../src/lib/timezone.ts");

let ok = 0;
const falhas = [];
function checar(nome, fn) {
  try {
    fn();
    ok++;
    console.log(`  \x1b[32m✓\x1b[0m ${nome}`);
  } catch (e) {
    falhas.push(nome);
    console.log(`  \x1b[31m✗\x1b[0m ${nome}\n      ${e.message}`);
  }
}

console.log("\n\x1b[1m1. NÃO deve avisar — o dia começa no mesmo instante\x1b[0m\n");

checar("o mesmo fuso não discorda de si mesmo", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "America/Sao_Paulo"), false);
});

checar("Sao_Paulo × Bahia: nomes diferentes, MESMO offset (-03 o ano todo)", () => {
  // É o alarme falso que a comparação por NOME produziria. Nenhum número da
  // ferramenta muda entre estes dois, então não há o que avisar.
  assert.equal(fusosDiscordam("America/Sao_Paulo", "America/Bahia"), false);
});

checar("Sao_Paulo × Recife: idem", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "America/Recife"), false);
});

checar("UTC × Etc/UTC: apelidos do mesmo fuso", () => {
  assert.equal(fusosDiscordam("UTC", "Etc/UTC"), false);
});

checar("fuso inválido não gera aviso (quem trata dado corrompido é getUserTimezone)", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "Marte/Olympus"), false);
  assert.equal(fusosDiscordam("", "America/Sao_Paulo"), false);
  assert.equal(fusosDiscordam("America/Sao_Paulo", "  "), false);
});

console.log("\n\x1b[1m2. DEVE avisar — a fronteira do dia está em outra hora\x1b[0m\n");

checar("Sao_Paulo × Lisboa: o caso que motivou o aviso", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "Europe/Lisbon"), true);
});

checar("Sao_Paulo × Manaus: -03 × -04, dentro do próprio Brasil", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "America/Manaus"), true);
});

checar("Sao_Paulo × UTC: é o par que reproduz o bug original (Vercel em UTC)", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "UTC"), true);
});

checar("Sao_Paulo × Nova York", () => {
  assert.equal(fusosDiscordam("America/Sao_Paulo", "America/New_York"), true);
});

console.log("\n\x1b[1m3. Horário de verão — o que UMA sonda só deixaria passar\x1b[0m\n");

/**
 * ⛔ Este é o bloco que justifica sondar quatro instantes em vez de um.
 *
 * Em JANEIRO, `UTC` e `Europe/London` têm o MESMO offset (+00): uma comparação
 * feita só "agora" concluiria que os dois concordam. Mas em julho Londres entra
 * em BST (+01) e o dia passa a virar uma hora antes — a divergência apareceria
 * sozinha meses depois, sem nada ter mudado na configuração.
 */
const JANEIRO = new Date("2027-01-15T12:00:00Z");
const JULHO = new Date("2027-07-15T12:00:00Z");

checar("em janeiro UTC e Londres têm o mesmo offset (a armadilha)", () => {
  assert.equal(tzOffsetMs(JANEIRO, "UTC"), tzOffsetMs(JANEIRO, "Europe/London"));
});

checar("em julho eles divergem (Londres em BST)", () => {
  assert.notEqual(tzOffsetMs(JULHO, "UTC"), tzOffsetMs(JULHO, "Europe/London"));
});

checar("mesmo consultado EM JANEIRO, fusosDiscordam acha a divergência", () => {
  // Uma sonda única em janeiro devolveria `false` e o usuário só descobriria em
  // março, quando os números mudassem sem explicação.
  assert.equal(fusosDiscordam("UTC", "Europe/London", JANEIRO), true);
});

checar("e consultado em julho também", () => {
  assert.equal(fusosDiscordam("UTC", "Europe/London", JULHO), true);
});

checar("Lisboa × Londres seguem juntos o ano inteiro — não avisa", () => {
  // Offsets idênticos e as MESMAS datas de virada: nenhuma sonda os separa.
  assert.equal(fusosDiscordam("Europe/Lisbon", "Europe/London", JANEIRO), false);
  assert.equal(fusosDiscordam("Europe/Lisbon", "Europe/London", JULHO), false);
});

checar("Sao_Paulo × Lisboa é detectado em qualquer época do ano", () => {
  // O offset entre os dois muda (3h ou 4h) conforme o DST europeu, mas nunca é
  // zero — então a resposta não pode depender de quando a tela foi aberta.
  assert.equal(fusosDiscordam("America/Sao_Paulo", "Europe/Lisbon", JANEIRO), true);
  assert.equal(fusosDiscordam("America/Sao_Paulo", "Europe/Lisbon", JULHO), true);
});

console.log(`\n\x1b[1m${ok} asserções, ${falhas.length} falha(s)\x1b[0m\n`);
if (falhas.length) console.log("Falharam:\n  - " + falhas.join("\n  - ") + "\n");
process.exit(falhas.length === 0 ? 0 : 1);
