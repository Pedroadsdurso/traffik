/**
 * A detecção de ambiente efêmero — `lib/pixel/ambiente.ts`.
 *
 * ## O que este teste protege
 *
 * O falso positivo é caro e assimétrico: um evento de PRODUÇÃO classificado
 * como teste sai do funil **e não vai para a CAPI**. Por isso a maioria das
 * asserções aqui é do lado "NÃO é teste" — em especial os domínios de produção
 * que moram nas mesmas plataformas.
 *
 * ⚠️ Este é o teste que separa "formato reservado da plataforma" de "palpite
 * sobre o hospedeiro". Se algum dia `site.netlify.app` passar a ser detectado,
 * a regra virou heurística e está errada.
 */
import { ambienteDaUrl, ambientePorPadraoAprovado, casaPadrao, familiasDePreview } from "../src/lib/pixel/ambiente.ts";

let ok = 0;
const falhas = [];
function eh(url, esperado) {
  const obtido = ambienteDaUrl(url).ambiente;
  const nome = `${esperado === null ? "PRODUÇÃO" : esperado.toUpperCase().padEnd(7)}  ${url}`;
  if (obtido === esperado) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        obtido: ${obtido}`); }
}

console.log("\n1) 🔴 PRODUÇÃO — o lado que NÃO pode ser marcado");
// As URLs reais do usuário, e as armadilhas das mesmas plataformas.
eh("https://sigmatoolsd.netlify.app/", null);
eh("https://sigmatoolsd.netlify.app/checkout?qty=1", null);
eh("https://moldes.tiarosi.online/", null);
eh("https://moldes.tiarosi.online/obrigado", null);
// Produção hospedada na Netlify/Vercel — foi por causa destes que a 1ª
// proposta (filtrar `*.netlify.app`) estava errada.
eh("https://minha-loja.netlify.app/produto", null);
eh("https://loja.vercel.app/", null);
// Nome de projeto com hífens não é `-git-`.
eh("https://loja-verao-brasil.vercel.app/", null);
// `--` DEPOIS do domínio não é separador de deploy.
eh("https://loja.netlify.app/promo--relampago", null);
// Domínio próprio que contém a palavra, mas não o formato.
eh("https://netlify.app.minhaloja.com.br/", null);
eh("https://localhost.minhaloja.com/", null);

console.log("\n2) Deploy preview — formato reservado da plataforma");
eh("https://6a6d6a400011ae000954881c--sigmatoolsd.netlify.app/", "preview");
eh("https://6a6d690ec4e97f0008316fd2--sigmatoolsd.netlify.app/checkout", "preview");
eh("https://deploy-preview-42--minha-loja.netlify.app/", "preview");
eh("https://feature-x--minha-loja.netlify.app/checkout", "preview");
eh("https://algo.netlify.live/", "preview");
eh("https://loja-git-main-acme.vercel.app/", "preview");
eh("https://loja-git-feature-checkout-acme.vercel.app/obrigado", "preview");

console.log("\n3) Máquina local");
eh("http://localhost:3000/", "local");
eh("https://localhost/checkout", "local");
eh("http://127.0.0.1:8888/", "local");
eh("http://192.168.0.14:3000/checkout", "local");
eh("http://10.0.0.5/", "local");
eh("http://172.20.1.1/", "local");
eh("http://meu-mac.local/", "local");
eh("http://app.localhost:5173/", "local");

console.log("\n4) Túnel de desenvolvimento");
eh("https://a1b2.ngrok-free.app/checkout", "tunel");
eh("https://x.loca.lt/", "tunel");
eh("https://algo-aleatorio.trycloudflare.com/", "tunel");

console.log("\n5) Ausência NÃO é teste");
// ⚠️ O InitiateCheckout que nasce do webhook do gateway não tem URL. Marcar
// por omissão o tiraria do funil — é o caso que a regra existe para proteger.
eh(null, null);
eh(undefined, null);
eh("", null);
eh("nao-e-uma-url", null);
eh("javascript:void(0)", null);

console.log("\n6) Domínio reservado pela IANA (RFC 2606/6761)");
eh("https://example.com/", "local");
eh("https://loja.example.com/checkout", "local");
eh("https://algo.test/", "local");
eh("https://algo.invalid/", "local");
// ⚠️ Contém "example" mas é domínio real e delegável.
eh("https://example.com.br/", null);
eh("https://meuexample.com/", null);

console.log("\n7) REPETIÇÃO — previews da Vercel que só aparecem em conjunto");
function fam(nome, hosts, esperado) {
  const r = familiasDePreview(hosts).flatMap((f) => f.hosts).sort();
  const a = JSON.stringify(r), b = JSON.stringify([...esperado].sort());
  if (a === b) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome}\n        obtido:   ${a}\n        esperado: ${b}`); }
}

// Os 4 hosts REAIS do usuário.
const reais = [
  "moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app",
  "moldes-ralhb1gzf-noahvivaryder3s-projects.vercel.app",
  "moldes-ppxn74d34-noahvivaryder3s-projects.vercel.app",
  "moldes-4i5mg0sx2-noahvivaryder3s-projects.vercel.app",
];
fam("os 4 previews reais viram uma família", reais, reais);

// 🔴 O contra-exemplo que a regra existe para NÃO pegar.
fam("multi-tenant legítimo NÃO casa (prefixo comum nos segmentos)",
  ["loja-cliente1-br.vercel.app", "loja-cliente2-br.vercel.app", "loja-cliente3-br.vercel.app"], []);

fam("2 hosts não bastam — o mínimo é 3", reais.slice(0, 2), []);

fam("projeto legítimo com hífens, sozinho", ["loja-verao-brasil.vercel.app"], []);

fam("subdomínios legítimos não casam",
  ["app.loja.com", "blog.loja.com", "conta.loja.com", "ajuda.loja.com"], []);

fam("segmentos sem dígito (parecem palavras) não casam",
  ["loja-verao-br.vercel.app", "loja-outono-br.vercel.app", "loja-inverno-br.vercel.app"], []);

fam("produção do usuário fica de fora mesmo com os previews juntos",
  [...reais, "moldes.tiarosi.online", "sigmatoolsd.netlify.app"], reais);

console.log("\n8) PADRÃO APROVADO — a metade preventiva, que BLOQUEIA na ingestão");
const P = "moldes-*-noahvivaryder3s-projects.vercel.app";
function casa(nome, host, esperado) {
  const r = casaPadrao(host, P);
  if (r === esperado) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome} — obtido ${r}`); }
}
// Host NOVO, que a regra retroativa nunca viu: é para isto que o padrão existe.
casa("host novo do mesmo padrão bloqueia", "moldes-zz9kk1x40-noahvivaryder3s-projects.vercel.app", true);
casa("um dos originais continua casando", "moldes-ahuhuv5fb-noahvivaryder3s-projects.vercel.app", true);

// 🔴 As recusas — cada uma impede a aprovação de virar regra mais ampla que o
// combinado. Aprovar amplia o ALCANCE, nunca afrouxa o teste.
casa("segmento que é PALAVRA não bloqueia", "moldes-producao-noahvivaryder3s-projects.vercel.app", false);
casa("outro escopo não bloqueia", "moldes-zz9kk1x40-outroescopo-projects.vercel.app", false);
casa("outro projeto não bloqueia", "loja-zz9kk1x40-noahvivaryder3s-projects.vercel.app", false);
casa("segmentos a mais não bloqueia", "moldes-zz9kk1x40-extra-noahvivaryder3s-projects.vercel.app", false);
casa("produção do mesmo projeto não bloqueia", "moldes.vercel.app", false);
casa("domínio próprio não bloqueia", "moldes.tiarosi.online", false);

const aprovados = [{ padrao: P }];
function via(nome, url, esperado) {
  const r = ambientePorPadraoAprovado(url, aprovados).ambiente;
  if (r === esperado) { ok++; console.log(`  ok  ${nome}`); }
  else { falhas.push(nome); console.log(`  FALHA  ${nome} — obtido ${r}`); }
}
via("url do padrão vira preview", "https://moldes-zz9kk1x40-noahvivaryder3s-projects.vercel.app/x", "preview");
via("url de produção segue produção", "https://moldes.tiarosi.online/", null);
via("url ilegível não bloqueia", "nao-e-url", null);
// Sem nada aprovado, a proteção preventiva não existe — é o estado padrão.
if (ambientePorPadraoAprovado("https://moldes-zz9kk1x40-noahvivaryder3s-projects.vercel.app/", []).ambiente === null) {
  ok++; console.log("  ok  sem padrão aprovado, nada é bloqueado");
} else { falhas.push("lista vazia"); console.log("  FALHA  lista vazia bloqueou algo"); }

console.log(
  falhas.length
    ? `\n\x1b[1m\x1b[31m${ok} asserções passaram, ${falhas.length} falharam:\x1b[0m\n  - ${falhas.join("\n  - ")}\n`
    : `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
