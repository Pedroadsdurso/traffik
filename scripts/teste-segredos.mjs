/**
 * `encryptSecret` / `isEncrypted` — O ENVELOPE DAS CREDENCIAIS EM REPOUSO.
 *
 * O que passa por aqui: token da Marketing API, chave da CAPI, chave de API dos
 * gateways. **Nenhum erro deste módulo aparece como erro.** Um segredo gravado
 * errado volta como string, o app o manda para a Meta, e o que se vê do lado de
 * cá é *"a sincronização parou"* — indistinguível de token vencido.
 *
 * ### ⛔ E o custo de errar é IRREVERSÍVEL de dois jeitos
 *
 * O `CLAUDE.md` registra que **não existe rotação de `ENCRYPTION_KEY`**: o que
 * for gravado com a chave errada, ou gravado duas vezes, não tem de onde ser
 * recuperado por nenhum caminho que o produto conheça.
 *
 * ### 🔑 AS TRÊS PROPRIEDADES CONGELADAS SÃO RELAÇÕES, NÃO VALORES
 *
 * Nenhuma asserção aqui conhece um ciphertext — não poderia: o IV é aleatório,
 * então o valor muda a cada execução. O que se congela é o que tem de valer
 * entre as funções:
 *
 *   1. **ida e volta**  `decryptSecret(encryptSecret(x)) === x`
 *   2. **idempotência** `encryptSecret(encryptSecret(x)) === encryptSecret(x)`
 *   3. **IV aleatório** `encryptSecret(x) !== encryptSecret(x)`
 *
 * A 2 e a 3 parecem se contradizer e não se contradizem: a 2 vale porque o
 * `isEncrypted` faz a segunda chamada devolver a PRIMEIRA sem re-encriptar. É
 * exatamente essa guarda que o plantio A remove.
 *
 * ⚠️ E o par que explica por que as duas existem: `secretLookupHash` É
 * determinístico, de propósito — é ele que serve para PROCURAR no banco. Sem
 * essa metade, "tornar o `encryptSecret` determinístico para poder buscar" vira
 * um conserto plausível, e ele é o plantio B.
 */

/* A chave tem de existir ANTES do primeiro `encryptionKey()`. Ela é obviamente
   falsa e local: nada aqui toca banco, e um segredo de verdade num arquivo
   versionado é o que o `CLAUDE.md` proíbe pelo nome. */
process.env.ENCRYPTION_KEY = "teste-nao-e-a-chave-de-producao-0000000000";

import assert from "node:assert/strict";
import { createCipheriv, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

let n = 0;
const ok = (nome, cond, extra) => {
  assert.ok(cond, nome + (extra ? " — " + extra : ""));
  console.log("  ✓ " + nome + (extra ? " — " + extra : ""));
  n++;
};

const {
  encryptSecret,
  decryptSecret,
  decryptSecretSafe,
  isEncrypted,
  secretLookupHash,
  encryptionKey,
} = await import("@/lib/crypto/secrets");

const PREFIXO = "trkenc.v1.";

/**
 * Segredos com a forma dos de verdade, mais os casos de borda.
 *
 * ⛔ **A string VAZIA não está aqui, e não é esquecimento** — ela quebra a ida e
 * volta. O achado tem seção própria (§1b) e é congelado.
 */
const SEGREDOS = [
  "EAAG1ZBv8ZCkQBO9ZBxZAxZDZD",                    // token da Meta
  "sk_live_51H8xKzJq2mNpQr7T",                     // chave de gateway
  "a",                                             // 1 caractere
  "x".repeat(4096),                                // token longo
  "chave com espaço e acentuação: coração",        // utf-8 multibyte
  "linha1\nlinha2\ttab",                           // controle
  "trkenc.v0.parece-envelope-mas-nao-e",           // parecido com o prefixo
];

/* ═══════════════════════════════════════════════════════════════════════
 * 0 · LINHA DE BASE — o módulo está de fato encriptando
 *
 * ⛔ Sem isto, uma implementação que devolvesse a entrada intacta passaria em
 * "ida e volta" com nota máxima. Ida-e-volta sozinha NÃO prova encriptação:
 * a identidade também dá ida e volta.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n0 · linha de base — há encriptação, não identidade");

  ok("a chave resolve para 32 bytes", encryptionKey().length === 32);

  const claro = "EAAG1ZBv8ZCkQBO9ZBxZAxZDZD";
  const cifrado = encryptSecret(claro);
  ok("o cifrado NÃO é a entrada", cifrado !== claro);
  ok("o cifrado carrega o envelope", cifrado.startsWith(PREFIXO), cifrado.slice(0, 24) + "…");
  ok("o texto claro NÃO aparece dentro do cifrado", !cifrado.includes(claro));
  ok("o envelope tem iv.tag.ct", cifrado.slice(PREFIXO.length).split(".").length === 3);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 · IDA E VOLTA — a relação, sobre os 8 segredos
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1 · ida e volta");

  const falharam = SEGREDOS.filter((s) => decryptSecret(encryptSecret(s)) !== s);
  ok(
    "os " + SEGREDOS.length + " segredos voltam idênticos",
    falharam.length === 0,
    JSON.stringify(falharam),
  );

  /* Fuzz de 200, semente FIXA: aleatório de verdade dá teste que falha uma vez
     por semana e ninguém reproduz. */
  let semente = 7;
  const rnd = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let quebrou = null;
  /* `1 +` no comprimento: o vazio é o caso da §1b, e deixá-lo cair aqui faria o
     fuzz reprovar por um defeito que já está medido e nomeado noutro lugar. */
  for (let i = 0; i < 200 && !quebrou; i++) {
    const len = 1 + Math.floor(rnd() * 120);
    let s = "";
    for (let j = 0; j < len; j++) s += String.fromCodePoint(32 + Math.floor(rnd() * 0x2000));
    if (decryptSecret(encryptSecret(s)) !== s) quebrou = s;
  }
  ok("fuzz de 200 (semente 7) volta idêntico", quebrou === null, quebrou === null ? "" : JSON.stringify(quebrou));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1b · 🔴 ACHADO: O SEGREDO VAZIO PRODUZ UM ENVELOPE QUE NÃO SE LÊ
 *
 * Medido em 14/08/2026, e ele apareceu **porque o `""` estava na lista da §1**.
 *
 *   encryptSecret("")  ->  "trkenc.v1.<iv>.<tag>."      <- ciphertext VAZIO
 *   isEncrypted(...)   ->  true                          <- parece válido
 *   decryptSecret(...) ->  LANÇA "Segredo encriptado malformado."
 *
 * A causa é uma guarda de forma que confunde ausente com vazio:
 * `if (!ivB64 || !tagB64 || !ctB64)` — e `""` é falsy. Um ciphertext vazio é a
 * codificação **correta** de um texto claro vazio, e a guarda o lê como
 * envelope truncado. É a distinção central deste projeto (ausência × zero) na
 * camada de string.
 *
 * ### 🔴 O CUSTO REAL NÃO É A EXCEÇÃO — É A MENSAGEM
 *
 * `decryptSecretSafe` engole e registra:
 *
 *   > [secrets] falha ao decriptar — a ENCRYPTION_KEY mudou?
 *
 * ⛔ **Ela acusa a causa errada**, e acusa a mais assustadora que existe neste
 * módulo: não há rotação de chave, então "a chave mudou" se lê como *"todo
 * segredo do banco está ilegível"*. Alguém seguiria essa pista por horas.
 *
 * ### ✅ POR QUE ISTO NÃO ESTÁ EM PRODUÇÃO — e por que é ASSERÇÃO, não nota
 *
 * Os dois únicos chamadores de produção guardam o vazio, cada um do seu jeito:
 *
 *   apiCredentials.ts  key = `trk_live_${randomBytes(24)…}`   <- nunca vazio
 *   pixels.ts          token ? encryptSecret(token) : null    <- ternário
 *
 * ⛔ Isso é **proteção acidental**: o que segura não é uma propriedade do
 * módulo, é uma circunstância escrita nos chamadores — e ela some no dia em que
 * aparecer um terceiro. Por isso as guardas viram asserção: um chamador novo
 * sem guarda reprova aqui, em vez de gravar no banco um segredo que ninguém
 * consegue ler de volta.
 *
 * ⛔ **NÃO CORRIGIDO.** `secrets.ts` é de `51362f2`, 24/07/2026 — anterior a
 * `4e6aa9e`, congelado. MEDE · REGISTRA · AVISA.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n1b · 🔴 o segredo VAZIO quebra a ida e volta");

  const vazio = encryptSecret("");
  ok("o vazio produz um envelope", vazio.startsWith(PREFIXO), JSON.stringify(vazio));
  ok("e ele TERMINA em ponto — o ciphertext é vazio", vazio.endsWith("."));
  ok("`isEncrypted` diz que é válido", isEncrypted(vazio) === true);
  ok(
    "mas `decryptSecret` LANÇA 'malformado'",
    (() => { try { decryptSecret(vazio); return false; } catch (e) { return /malformado/.test(e.message); } })(),
  );
  ok("e `decryptSecretSafe` devolve null", decryptSecretSafe(vazio) === null);

  /* A mensagem que o `Safe` imprime acusa a chave. Congelada como texto porque
     é ELA o custo — se alguém a melhorar, este teste é onde se vê o porquê. */
  {
    const fonte = readFileSync("src/lib/crypto/secrets.ts", "utf8").replace(/\r\n/g, "\n");
    ok(
      "linha de base: a mensagem enganosa está no arquivo",
      fonte.includes("a ENCRYPTION_KEY mudou?"),
      "ela é impressa para um caso que NÃO é chave trocada",
    );
  }

  /* ── AS DUAS GUARDAS DE CHAMADOR, que é o que torna isto inalcançável hoje.
     ⚠️ Miram SINTAXE, não palavra solta: os dois arquivos citam `encryptSecret`
     na prosa, e uma âncora de nome pegaria o comentário. */
  {
    const semComentario = (s) =>
      s.replace(/\r\n/g, "\n")
        .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
        .replace(/\/\/[^\n]*/g, "");

    const pixels = semComentario(readFileSync("src/lib/actions/pixels.ts", "utf8"));
    ok(
      "linha de base: `pixels.ts` chama `encryptSecret` no CÓDIGO",
      /encryptSecret\(/.test(pixels),
    );
    ok(
      "GUARDA: `pixels.ts` só encripta o token quando ele é truthy",
      /token\s*\?\s*encryptSecret\(token\)\s*:\s*null/.test(pixels),
      "sem o ternário, um token em branco gravaria envelope ilegível",
    );

    const cred = semComentario(readFileSync("src/lib/actions/apiCredentials.ts", "utf8"));
    ok(
      "linha de base: `apiCredentials.ts` chama `encryptSecret` no CÓDIGO",
      /encryptSecret\(/.test(cred),
    );
    ok(
      "GUARDA: a chave é gerada, nunca recebida",
      /const key = `trk_live_\$\{randomBytes\(/.test(cred),
      "chave gerada não tem como ser vazia",
    );

    /* E o denominador: se aparecer um terceiro chamador, ele não passou por
       guarda nenhuma acima — e a contagem é o que denuncia. */
    const { globSync } = await import("node:fs");
    /* ⚠️ `globSync` devolve `\` no Windows. Sem normalizar, o filtro por
       `crypto/secrets.ts` não casa e o PRÓPRIO módulo entra na contagem — foi o
       que esta asserção pegou de mim em 14/08, e é por isso que ela IMPRIME a
       lista em vez de só contar. */
    const chamadores = globSync("src/**/*.{ts,tsx}")
      .map((f) => f.replace(/\\/g, "/"))
      .filter((f) => !f.includes("generated") && !f.endsWith("lib/crypto/secrets.ts"))
      .filter((f) => /encryptSecret\(/.test(semComentario(readFileSync(f, "utf8"))));
    ok(
      "os chamadores de produção continuam sendo os DOIS guardados",
      chamadores.length === 2,
      chamadores.join(" · "),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 · IDEMPOTÊNCIA — e o PLANTIO A, que é o `encrypt-secrets.mjs` rodado 2×
 *
 * 🔴 O consumidor real é um BACKFILL. Um backfill é rodado de novo quando dá
 * erro no meio, quando alguém não tem certeza se rodou, quando o banco é
 * restaurado. "Rodar duas vezes" não é caso de borda: é o caso.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n2 · idempotência");

  const claro = "sk_live_51H8xKzJq2mNpQr7T";
  const uma = encryptSecret(claro);
  const duas = encryptSecret(uma);

  ok("encriptar o já-encriptado devolve a MESMA string", duas === uma);
  ok("e ele continua voltando ao claro", decryptSecret(duas) === claro);

  const naoIdempotentes = SEGREDOS.filter((s) => {
    const e = encryptSecret(s);
    return encryptSecret(e) !== e;
  });
  ok("idempotente nos " + SEGREDOS.length + " segredos", naoIdempotentes.length === 0);

  /* ── PLANTIO A: remover a guarda de idempotência.
     É o "conserto" de quem lê `if (isEncrypted(plain)) return plain;` como
     early-return morto — o `encryptSecret` "obviamente" deveria encriptar. */
  {
    const semGuarda = (plain) => {
      const iv = Buffer.from(crypto.getRandomValues(new Uint8Array(12)));
      const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
      const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
      return PREFIXO + [iv, cipher.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
    };

    const dupla = semGuarda(semGuarda(claro));
    const voltou = decryptSecret(dupla);

    /* ⚠️ Esta asserção nasceu com um `|| true` — que a torna incapaz de falhar,
       e é o defeito que este arquivo existe para não cometer. Reescrita para
       comparar o que ela alega: o envelope duplo NÃO é o simples. */
    ok("PLANTIO A: a segunda passada produz OUTRO envelope", dupla !== semGuarda(claro) && dupla.length > semGuarda(claro).length);
    ok(
      "PLANTIO A: decriptar UMA vez devolve o ENVELOPE, não o segredo",
      voltou !== claro && voltou.startsWith(PREFIXO),
      "o app mandaria isto para a Meta como se fosse o token",
    );
    ok("PLANTIO A: e nada lança — o erro é MUDO", typeof voltou === "string");
    ok("PLANTIO A: a asserção da idempotência DERRUBA", semGuarda(encryptSecret(claro)) !== encryptSecret(claro));

    /* ── PAR NEGATIVO, e é ele que explica por que o defeito é invisível:
       para um valor que NUNCA foi encriptado, as duas versões fazem a mesma
       coisa. Elas só divergem no valor JÁ encriptado — ou seja, o backfill
       passa perfeito na primeira execução e corrompe na segunda. */
    ok(
      "PAR NEGATIVO: sobre texto CLARO as duas versões concordam",
      decryptSecret(semGuarda(claro)) === decryptSecret(encryptSecret(claro)),
      "é por isso que a primeira execução do backfill não denuncia nada",
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 · O IV É ALEATÓRIO — e o PLANTIO B é o conserto "para poder buscar"
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n3 · IV aleatório × hash determinístico");

  const claro = "EAAG1ZBv8ZCkQBO9ZBxZAxZDZD";
  const a = encryptSecret(claro);
  const b = encryptSecret(claro);

  ok("duas encriptações do MESMO segredo diferem", a !== b);
  ok("e as duas voltam ao mesmo claro", decryptSecret(a) === claro && decryptSecret(b) === claro);

  /* A outra metade do par: quem PROCURA no banco usa o hash, e ele é estável. */
  ok("`secretLookupHash` é determinístico", secretLookupHash(claro) === secretLookupHash(claro));
  ok("e ele separa segredos diferentes", secretLookupHash(claro) !== secretLookupHash(claro + "x"));
  ok(
    "o hash leva sal da própria chave (não é sha256 puro do segredo)",
    secretLookupHash(claro) !== createHash("sha256").update(claro, "utf8").digest("hex"),
  );

  /* ── PLANTIO B: IV fixo, "para o ciphertext ficar determinístico e dar para
     procurar no banco". Ele é plausível justamente porque a busca é um problema
     real — e a resposta certa a ele é o `secretLookupHash` acima.

     Em AES-GCM, IV repetido com a mesma chave reusa o keystream. Medido: o XOR
     de dois ciphertexts revela o XOR dos dois textos claros, então quem conhece
     UM segredo recupera o outro. */
  {
    const IV_FIXO = Buffer.alloc(12, 7);
    const fixo = (plain) => {
      const c = createCipheriv("aes-256-gcm", encryptionKey(), IV_FIXO);
      return Buffer.concat([c.update(plain, "utf8"), c.final()]);
    };

    const s1 = "token-da-conta-A-123";
    const s2 = "token-da-conta-B-456";
    const c1 = fixo(s1);
    const c2 = fixo(s2);

    ok("PLANTIO B: o mesmo segredo passa a produzir o MESMO ciphertext", fixo(s1).equals(c1));

    /* A recuperação: conhecendo s1, sai s2 sem a chave. */
    const recuperado = Buffer.from(
      c1.map((byte, i) => byte ^ c2[i] ^ Buffer.from(s1, "utf8")[i]),
    ).toString("utf8");
    ok(
      "PLANTIO B: conhecendo UM segredo, o outro sai SEM A CHAVE",
      recuperado === s2,
      JSON.stringify(recuperado),
    );
    ok("PLANTIO B: a asserção do IV aleatório DERRUBA", fixo(s1).equals(fixo(s1)));
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 · `isEncrypted` — o discriminador, e ele decide o caminho LEGADO
 *
 * ⚠️ Ele não é um predicado cosmético: é ele que faz `decryptSecret` devolver
 * texto puro intacto em vez de tentar decriptar. Errar para um lado corrompe o
 * backfill (§2); errar para o outro faz o legado explodir na leitura.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n4 · isEncrypted");

  ok("reconhece o envelope de verdade", isEncrypted(encryptSecret("x")) === true);
  ok("texto puro não é envelope", isEncrypted("EAAG1ZBv8ZCkQBO9") === false);
  ok("null não é envelope", isEncrypted(null) === false);
  ok("undefined não é envelope", isEncrypted(undefined) === false);
  ok("string vazia não é envelope", isEncrypted("") === false);
  ok("versão diferente do envelope não conta", isEncrypted("trkenc.v0.abc") === false);

  /* O prefixo tem de estar NO COMEÇO. Um segredo que só CONTÉM a marca é texto
     puro, e tratá-lo como envelope faria `decryptSecret` lançar na leitura de
     uma credencial válida. */
  ok("o prefixo NO MEIO não conta", isEncrypted("sk_live_trkenc.v1.abc") === false);

  /* ── PLANTIO C: `includes` no lugar de `startsWith` — o afrouxamento de quem
     quer "tolerar" espaço ou prefixo antes do envelope. */
  {
    const frouxo = (v) => typeof v === "string" && v.includes(PREFIXO);
    const meio = "sk_live_trkenc.v1.abc";
    ok("PLANTIO C: o segredo que só CONTÉM a marca vira 'encriptado'", frouxo(meio) === true);
    ok("PLANTIO C: a asserção do prefixo-no-meio DERRUBA", frouxo(meio) !== isEncrypted(meio));

    /* PAR NEGATIVO: sobre envelope de verdade e sobre texto puro comum, as duas
       versões concordam em TODOS os casos — o afrouxamento só aparece no
       segredo que por acaso carrega a marca. */
    const comuns = [encryptSecret("x"), "EAAG1ZBv8", "", "trkenc.v0.abc"];
    ok(
      "PAR NEGATIVO: nas " + comuns.length + " entradas comuns as duas concordam",
      comuns.every((v) => frouxo(v) === isEncrypted(v)),
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 · GCM AUTENTICA — adulterar no banco FALHA, não devolve lixo
 *
 * É a afirmação literal do cabeçalho do módulo, e ela é testável.
 * ═════════════════════════════════════════════════════════════════════ */
{
  console.log("\n5 · adulteração falha alto");

  const claro = "sk_live_51H8xKzJq2mNpQr7T";
  const bom = encryptSecret(claro);
  const [iv, tag, ct] = bom.slice(PREFIXO.length).split(".");

  /* Vira um bit do ciphertext, como uma escrita errada no banco faria. */
  const bytes = Buffer.from(ct, "base64url");
  bytes[0] ^= 0x01;
  const adulterado = PREFIXO + [iv, tag, bytes.toString("base64url")].join(".");

  ok("o adulterado ainda PARECE um envelope válido", isEncrypted(adulterado) === true);
  ok("mas decriptar LANÇA", (() => { try { decryptSecret(adulterado); return false; } catch { return true; } })());
  ok("e não devolve lixo", (() => { try { return decryptSecret(adulterado) === undefined; } catch { return true; } })());
  ok("`decryptSecretSafe` devolve null em vez de lançar", decryptSecretSafe(adulterado) === null);
  ok("`decryptSecretSafe` de null é null", decryptSecretSafe(null) === null);

  /* Legado: texto puro atravessa intacto, que é o que torna a migração possível. */
  ok("texto puro legado atravessa intacto", decryptSecret("token-antigo-em-texto-puro") === "token-antigo-em-texto-puro");
  ok("e o `Safe` também", decryptSecretSafe("token-antigo-em-texto-puro") === "token-antigo-em-texto-puro");

  /* ── PLANTIO D: tratar a falha de autenticação como "é legado, devolve como
     está". Plausível porque a função JÁ tem um caminho de legado logo acima. */
  {
    const tolerante = (armazenado) => {
      if (!isEncrypted(armazenado)) return armazenado;
      try { return decryptSecret(armazenado); } catch { return armazenado; }
    };
    const devolvido = tolerante(adulterado);
    ok(
      "PLANTIO D: o adulterado volta como se fosse o segredo",
      devolvido === adulterado,
      "e é ISTO que iria para a Meta como token",
    );
    ok("PLANTIO D: a asserção do 'decriptar LANÇA' DERRUBA", typeof devolvido === "string");
  }
}

console.log("\n\x1b[32m" + n + " asserções, 0 falha(s).\x1b[0m\n");
