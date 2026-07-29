/**
 * Trava de segurança para QUALQUER script que escreva no banco.
 *
 * Nasceu de um estrago real: um teste em localhost rodou `UPDATE`/`DELETE` no
 * Supabase — que é o MESMO banco da produção — e mexeu em configuração de
 * verdade. A causa não foi descuido pontual: é que nada no ambiente distingue
 * "o banco que posso quebrar" de "o banco do usuário".
 *
 * Uso, na PRIMEIRA linha de todo script de manutenção/seed:
 *
 *     import { exigirBancoDeDesenvolvimento } from "./guard-db.mjs";
 *     exigirBancoDeDesenvolvimento();
 *
 * A trava é intencionalmente CHATA de burlar: exige uma variável de ambiente
 * escrita por extenso, no comando, a cada execução. Não existe flag `--force`
 * curta nem arquivo de configuração que a desligue de forma permanente — é
 * exatamente o tipo de atalho que vira hábito e devolve o problema.
 */

/**
 * ⛔ **LISTA DE PERMISSÃO, não de bloqueio.** Só os refs listados aqui podem
 * receber escrita de script. Qualquer outro banco — inclusive um projeto novo
 * que ninguém cadastrou — é tratado como produção e bloqueado.
 *
 * Era uma lista de BLOQUEIO ("estes são produção"). O problema apareceu na
 * prática: ao criar um segundo projeto no Supabase, os refs foram confundidos
 * entre si. Com lista de bloqueio, um ref desconhecido passa direto e o script
 * escreve num banco que ninguém classificou — que é exatamente o cenário do
 * incidente. Com lista de permissão, o pior caso é um bloqueio indevido, que
 * aparece na hora e se resolve acrescentando uma linha.
 *
 * É a mesma regra que vale para a autenticação das rotas: **ausência de
 * configuração nunca vira permissão.**
 */
const DESENVOLVIMENTO = [
  "drdfnazladzkxlqpgdzt", // Supabase · ca-central-1 · projeto de DESENVOLVIMENTO
  // ⚠️ Confira duas vezes antes de acrescentar: um ref de produção nesta lista
  // desliga a trava sem nenhum aviso.
];

/** Refs conhecidamente de PRODUÇÃO — só para a mensagem de erro ser específica. */
const PRODUCAO_CONHECIDA = {
  dgaoucxkmpdxeenpfqth: "PRODUÇÃO · us-east-1 · dados reais do usuário",
};

const AUTORIZACAO = "EU_QUERO_MESMO_ESCREVER_EM_PRODUCAO";

/** Extrai o ref do projeto Supabase da string de conexão. */
export function refDoBanco(url = process.env.DATABASE_URL ?? "") {
  return (url.match(/postgres\.([a-z0-9]{16,})[:@]/) ?? [])[1] ?? null;
}

export function ehBancoDeDesenvolvimento(url = process.env.DATABASE_URL ?? "") {
  // Postgres local nunca é produção — não tem ref e não sai da máquina.
  if (/@(localhost|127\.0\.0\.1)/.test(url)) return true;
  const ref = refDoBanco(url);
  return ref !== null && DESENVOLVIMENTO.includes(ref);
}

export function exigirBancoDeDesenvolvimento({ script = "este script" } = {}) {
  const url = process.env.DATABASE_URL ?? "";

  if (!url) {
    console.error("✗ DATABASE_URL não definida. Abortando.");
    process.exit(1);
  }

  if (ehBancoDeDesenvolvimento(url)) return; // banco de dev cadastrado: segue o jogo

  const ref = refDoBanco(url);
  const rotulo = (ref && PRODUCAO_CONHECIDA[ref]) ?? "banco NÃO cadastrado como desenvolvimento";

  if (process.env.ALLOW_PROD_WRITES === AUTORIZACAO) {
    console.warn(
      `\n⚠️  ${script} vai ESCREVER em ${ref ?? "?"} — ${rotulo}.\n` +
        "   Autorização explícita recebida. Se não era isso, interrompa AGORA (Ctrl+C).\n",
    );
    return;
  }

  console.error(
    `\n⛔ ${script} foi BLOQUEADO.\n\n` +
      `   Banco alvo: ${ref ?? "(sem ref reconhecível)"}\n` +
      `   Classificação: ${rotulo}\n\n` +
      "   A trava é uma LISTA DE PERMISSÃO: só bancos explicitamente cadastrados\n" +
      "   como desenvolvimento aceitam escrita de script. Um projeto novo é\n" +
      "   bloqueado até alguém classificá-lo — de propósito.\n\n" +
      "   • Se este banco É de desenvolvimento, acrescente o ref à constante\n" +
      "     DESENVOLVIMENTO em scripts/guard-db.mjs.\n" +
      "   • Se a escrita em produção for MESMO intencional:\n" +
      `     ALLOW_PROD_WRITES=${AUTORIZACAO} node <script>\n`,
  );
  process.exit(1);
}
