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
import { ambienteDaUrl } from "../src/lib/pixel/ambiente.ts";

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

console.log(
  falhas.length
    ? `\n\x1b[1m\x1b[31m${ok} asserções passaram, ${falhas.length} falharam:\x1b[0m\n  - ${falhas.join("\n  - ")}\n`
    : `\n\x1b[1m\x1b[32m${ok} asserções passaram, 0 falharam.\x1b[0m\n`,
);
process.exit(falhas.length ? 1 : 0);
