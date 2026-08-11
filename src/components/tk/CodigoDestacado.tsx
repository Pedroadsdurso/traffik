"use client";

import * as React from "react";

/**
 * Destaque de sintaxe para JavaScript, HTML e JSON — escrito à mão, de propósito.
 *
 * > ### ⛔ A SAÍDA SEGURA É CÓDIGO SEM COR, NUNCA CÓDIGO COLORIDO ERRADO
 * >
 * > Isto pinta um artefato que o usuário **copia e instala no site dele**. Um
 * > destaque que perde, reordena ou duplica um caractere não deixa o código
 * > feio: deixa o código diferente do que a ferramenta gerou, e o usuário não
 * > tem como saber. É a família "tela que ENTREGA artefato", na camada de
 * > apresentação.
 * >
 * > Por isso o contrato é uma INVARIANTE, não um conjunto de casos:
 * >
 * > **concatenar o texto de todos os tokens devolve a entrada, caractere por
 * > caractere.**
 * >
 * > `npm run test:destaque` a verifica contra os snippets reais e contra entrada
 * > adversária (aspas sem fechar, comentário sem fim, `<script>` sem `</script>`).
 * > Um scanner que não sabe classificar cai em `texto` — que é o pior caso
 * > aceitável e o único que ele pode produzir.
 *
 * ## Por que não uma dependência
 *
 * Decisão do dono, 11/08/2026: o código colorido aqui é **gerado por nós**
 * (`lib/utm/scripts.ts`, `lib/pixel/script.ts`, `lib/actions/utm.ts`), então o
 * vocabulário é fechado e a entrada é controlada. `shiki`/`highlight.js` trazem
 * gramáticas completas, tema próprio e peso de bundle para colorir quatro
 * arquivos que nós mesmos escrevemos.
 */

export type Linguagem = "js" | "html" | "json";

export type ClasseToken =
  | "texto"
  | "comentario"
  | "cadeia"
  | "numero"
  | "palavra"
  | "chave"
  | "tag"
  | "atributo";

export interface Token {
  t: string;
  c: ClasseToken;
}

const PALAVRAS_JS = new Set([
  "var", "let", "const", "function", "return", "if", "else", "for", "while",
  "do", "break", "continue", "switch", "case", "default", "try", "catch",
  "finally", "throw", "new", "typeof", "instanceof", "delete", "in", "of",
  "this", "void", "true", "false", "null", "undefined", "async", "await",
]);

const eLetra = (c: string) => /[A-Za-z_$]/.test(c);
const ePalavra = (c: string) => /[A-Za-z0-9_$]/.test(c);
const eDigito = (c: string) => /[0-9]/.test(c);

/**
 * Consome uma cadeia com aspas a partir de `i`, respeitando escape.
 *
 * ⚠️ Devolve o fim do ARQUIVO quando a aspa não fecha. Devolver `-1` faria o
 * chamador ter de decidir o que fazer com o resto, e a decisão errada come
 * caracteres — que é justamente o que a invariante proíbe.
 */
function fimDaCadeia(src: string, i: number): number {
  const aspa = src[i];
  let j = i + 1;
  while (j < src.length) {
    if (src[j] === "\\") {
      j += 2;
      continue;
    }
    if (src[j] === aspa) return j + 1;
    // Aspa simples/dupla não atravessa linha em JS; parar aqui evita que uma
    // aspa solta pinte o resto do arquivo inteiro de string.
    if (src[j] === "\n" && aspa !== "`") return j;
    j += 1;
  }
  return src.length;
}

/** Tokeniza JavaScript no intervalo `[ini, fim)`. */
function lerJs(src: string, ini: number, fim: number, saida: Token[]): void {
  let i = ini;
  let solto = "";
  const despejar = () => {
    if (solto) {
      saida.push({ t: solto, c: "texto" });
      solto = "";
    }
  };

  while (i < fim) {
    const c = src[i];

    // Comentário de linha
    if (c === "/" && src[i + 1] === "/") {
      despejar();
      let j = src.indexOf("\n", i);
      if (j < 0 || j > fim) j = fim;
      saida.push({ t: src.slice(i, j), c: "comentario" });
      i = j;
      continue;
    }

    // Comentário de bloco — sem fim, vai até o limite do intervalo
    if (c === "/" && src[i + 1] === "*") {
      despejar();
      const f = src.indexOf("*/", i + 2);
      const j = f < 0 || f + 2 > fim ? fim : f + 2;
      saida.push({ t: src.slice(i, j), c: "comentario" });
      i = j;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      despejar();
      const j = Math.min(fimDaCadeia(src, i), fim);
      saida.push({ t: src.slice(i, j), c: "cadeia" });
      i = j;
      continue;
    }

    if (eDigito(c)) {
      despejar();
      let j = i;
      while (j < fim && /[0-9a-fA-FxX._+-]/.test(src[j]) && !(src[j] === "-" && j > i && !/[eE]/.test(src[j - 1]))) {
        j += 1;
      }
      saida.push({ t: src.slice(i, j), c: "numero" });
      i = j;
      continue;
    }

    if (eLetra(c)) {
      let j = i;
      while (j < fim && ePalavra(src[j])) j += 1;
      const palavra = src.slice(i, j);
      if (PALAVRAS_JS.has(palavra)) {
        despejar();
        saida.push({ t: palavra, c: "palavra" });
      } else {
        solto += palavra;
      }
      i = j;
      continue;
    }

    solto += c;
    i += 1;
  }
  despejar();
}

/** Tokeniza JSON. Diferencia CHAVE de valor pelo `:` que vem depois. */
function lerJson(src: string, saida: Token[]): void {
  let i = 0;
  let solto = "";
  const despejar = () => {
    if (solto) {
      saida.push({ t: solto, c: "texto" });
      solto = "";
    }
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '"') {
      despejar();
      const j = fimDaCadeia(src, i);
      // Espia adiante: `"nome":` é chave, `"valor"` é cadeia.
      let k = j;
      while (k < src.length && /\s/.test(src[k])) k += 1;
      saida.push({ t: src.slice(i, j), c: src[k] === ":" ? "chave" : "cadeia" });
      i = j;
      continue;
    }

    if (eDigito(c) || (c === "-" && eDigito(src[i + 1] ?? ""))) {
      despejar();
      let j = i + 1;
      while (j < src.length && /[0-9.eE+-]/.test(src[j])) j += 1;
      saida.push({ t: src.slice(i, j), c: "numero" });
      i = j;
      continue;
    }

    if (eLetra(c)) {
      let j = i;
      while (j < src.length && ePalavra(src[j])) j += 1;
      const p = src.slice(i, j);
      if (p === "true" || p === "false" || p === "null") {
        despejar();
        saida.push({ t: p, c: "palavra" });
      } else {
        solto += p;
      }
      i = j;
      continue;
    }

    solto += c;
    i += 1;
  }
  despejar();
}

/**
 * Tokeniza o interior de uma tag: `<script async src="x">`.
 * Recebe o intervalo SEM os delimitadores, e devolve os tokens do miolo.
 */
function lerInteriorDaTag(src: string, ini: number, fim: number, saida: Token[]): void {
  let i = ini;
  let primeiro = true;
  let solto = "";
  const despejar = () => {
    if (solto) {
      saida.push({ t: solto, c: "texto" });
      solto = "";
    }
  };

  while (i < fim) {
    const c = src[i];
    if (/\s/.test(c)) {
      solto += c;
      i += 1;
      continue;
    }
    if (c === '"' || c === "'") {
      despejar();
      const j = Math.min(fimDaCadeia(src, i), fim);
      saida.push({ t: src.slice(i, j), c: "cadeia" });
      i = j;
      continue;
    }
    if (eLetra(c) || c === "/" || c === "!") {
      let j = i;
      while (j < fim && /[A-Za-z0-9_:.!/-]/.test(src[j])) j += 1;
      despejar();
      saida.push({ t: src.slice(i, j), c: primeiro ? "tag" : "atributo" });
      primeiro = false;
      i = j;
      continue;
    }
    solto += c;
    i += 1;
  }
  despejar();
}

/**
 * Tokeniza HTML, delegando o conteúdo de `<script>` ao scanner de JS.
 *
 * 🔴 É o caso REAL desta tela: o snippet do pixel da Meta é HTML com um
 * `<script>` de 20 linhas dentro. Um destaque de HTML que pintasse aquilo como
 * texto corrido deixaria o miolo — que é o que importa — sem cor nenhuma.
 */
function lerHtml(src: string, saida: Token[]): void {
  let i = 0;
  let solto = "";
  const despejar = () => {
    if (solto) {
      saida.push({ t: solto, c: "texto" });
      solto = "";
    }
  };

  while (i < src.length) {
    if (src[i] !== "<") {
      solto += src[i];
      i += 1;
      continue;
    }

    // Comentário HTML
    if (src.startsWith("<!--", i)) {
      despejar();
      const f = src.indexOf("-->", i + 4);
      const j = f < 0 ? src.length : f + 3;
      saida.push({ t: src.slice(i, j), c: "comentario" });
      i = j;
      continue;
    }

    const fecha = src.indexOf(">", i);
    if (fecha < 0) {
      // `<` solto no fim do arquivo: é texto, e a invariante exige que ele saia.
      solto += src.slice(i);
      i = src.length;
      continue;
    }

    despejar();
    saida.push({ t: "<", c: "texto" });
    lerInteriorDaTag(src, i + 1, fecha, saida);
    saida.push({ t: ">", c: "texto" });

    const nome = /^<\s*([A-Za-z][A-Za-z0-9-]*)/.exec(src.slice(i, fecha + 1))?.[1]?.toLowerCase();
    i = fecha + 1;

    if (nome === "script" || nome === "style") {
      const alvo = `</${nome}`;
      const f = src.toLowerCase().indexOf(alvo, i);
      const fimConteudo = f < 0 ? src.length : f;
      if (fimConteudo > i) {
        if (nome === "script") lerJs(src, i, fimConteudo, saida);
        else saida.push({ t: src.slice(i, fimConteudo), c: "texto" });
      }
      i = fimConteudo;
    }
  }
  despejar();
}

/** Junta vizinhos da mesma classe — menos `<span>` por linha na árvore. */
function fundir(tokens: Token[]): Token[] {
  const fora: Token[] = [];
  for (const tk of tokens) {
    if (tk.t === "") continue;
    const ultimo = fora[fora.length - 1];
    if (ultimo && ultimo.c === tk.c) ultimo.t += tk.t;
    else fora.push({ ...tk });
  }
  return fora;
}

/**
 * A função pura. **Contrato:** `destacar(x, l).map(t => t.t).join("") === x`
 * para qualquer `x` e qualquer `l`.
 */
export function destacar(codigo: string, linguagem: Linguagem): Token[] {
  if (typeof codigo !== "string" || codigo === "") return [];
  const saida: Token[] = [];
  if (linguagem === "html") lerHtml(codigo, saida);
  else if (linguagem === "json") lerJson(codigo, saida);
  else lerJs(codigo, 0, codigo.length, saida);
  return fundir(saida);
}

/**
 * Adivinha a linguagem pelo conteúdo. Usada só quando quem chama não sabe —
 * o inventário de snippets declara a linguagem de cada um.
 */
export function adivinharLinguagem(codigo: string): Linguagem {
  const t = codigo.trimStart();
  if (t.startsWith("<")) return "html";
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  return "js";
}

/* As cores saem dos pares `--tk-on-tint-*`, que existem nos dois temas e já
   passam pelo `test:contraste`. ⚠️ Eles foram calibrados sobre o TINGIMENTO;
   aqui o fundo é o painel de código, então o contraste real foi MEDIDO na tela
   nos dois temas — os números estão no `04`, seção UTM & SNIPPETS. */
const COR: Record<ClasseToken, string> = {
  texto: "var(--tk-text)",
  comentario: "var(--tk-text-muted)",
  cadeia: "var(--tk-on-tint-success)",
  numero: "var(--tk-on-tint-warning)",
  palavra: "var(--tk-on-tint-category)",
  chave: "var(--tk-on-tint-primary)",
  tag: "var(--tk-on-tint-primary)",
  atributo: "var(--tk-on-tint-accent)",
};

export function CodigoDestacado({
  codigo,
  linguagem,
  alturaMaxima = 340,
}: {
  codigo: string;
  linguagem?: Linguagem;
  alturaMaxima?: number;
}) {
  const ling = linguagem ?? adivinharLinguagem(codigo);
  const tokens = React.useMemo(() => destacar(codigo, ling), [codigo, ling]);

  return (
    <pre
      className="bg-background border border-border rounded-controle"
      style={{
        margin: 0,
        padding: 12,
        maxHeight: alturaMaxima,
        overflow: "auto",
        fontFamily: "var(--tk-font-mono)",
        fontSize: 11.5,
        lineHeight: 1.65,
        /* O código NÃO quebra linha: uma URL ou um `fbq(...)` partido no meio
           muda o que a pessoa lê quando confere o que colou. Rola na horizontal. */
        whiteSpace: "pre",
        tabSize: 2,
      }}
    >
      <code style={{ fontFamily: "inherit" }}>
        {tokens.map((tk, i) => (
          <span key={i} style={{ color: COR[tk.c] }}>
            {tk.t}
          </span>
        ))}
      </code>
    </pre>
  );
}
