import { estadoDaConta, podeRastrear } from "@/lib/facebook/contaStatus";
import { traduzirErroMeta, explicarErroDeConta } from "@/lib/facebook/erroMeta";

let ok = 0, mau = 0;
const eq = (n, a, b) => {
  const bom = JSON.stringify(a) === JSON.stringify(b);
  console.log(`  ${bom ? "\x1b[32m✓" : "\x1b[31m✗"}\x1b[0m ${n}`);
  if (!bom) console.log(`      obtido ${JSON.stringify(a)} | esperado ${JSON.stringify(b)}`);
  if (bom) ok++; else mau++;
};

console.log("\n1. account_status\n");
eq("1 = ativa", estadoDaConta(1).rotulo, "Ativa");
eq("2 = desabilitada, nao sincroniza", [estadoDaConta(2).rotulo, estadoDaConta(2).sincroniza], ["Desabilitada", false]);
eq("3 = pagamento pendente, AINDA sincroniza", [estadoDaConta(3).rotulo, estadoDaConta(3).sincroniza], ["Pagamento pendente", true]);
eq("9 = carencia, ainda sincroniza", estadoDaConta(9).sincroniza, true);
eq("101 = encerrada, nao sincroniza", estadoDaConta(101).sincroniza, false);
eq("nulo NAO alarma e nao bloqueia", [estadoDaConta(null).tom !== "erro", podeRastrear(null)], [true, true]);
eq("codigo novo aparece CRU e nao bloqueia", [estadoDaConta(42).rotulo, podeRastrear(42)], ["Status 42 (desconhecido)", true]);

console.log("\n2. Erros da Meta\n");
const t = (s) => traduzirErroMeta(s)?.mensagem ?? null;
eq("token expirado", t("(#190) Error validating access token: Session has expired"), "A conexão com o Facebook expirou.");
eq("rate limit e TEMPORARIO", traduzirErroMeta("(#17) User request limit reached").temporario, true);
eq("permissao NAO e temporario", traduzirErroMeta("(#200) Ad account owner has NOT grant ads_management").temporario, false);
eq("volume de dados", t("(#100) Please reduce the amount of data you're asking for"), "O Facebook recusou a consulta por volume de dados.");
eq("desconhecido devolve null (nao inventa)", traduzirErroMeta("algo totalmente novo"), null);
eq("vazio devolve null", traduzirErroMeta(""), null);

console.log("\n3. O cruzamento — a mensagem da Meta mente\n");
const ERRO_200 = "(#200) Ad account owner has NOT grant ads_management or ads_read permission";
eq(
  "conta DESABILITADA: o status vence o erro de permissao",
  explicarErroDeConta(ERRO_200, 2).mensagem,
  "Conta desabilitada no Facebook — por isso ela não sincroniza.",
);
eq(
  "conta ATIVA com o mesmo erro: aí é permissão mesmo",
  explicarErroDeConta(ERRO_200, 1).mensagem,
  "Sem permissão para ler esta conta de anúncio.",
);
eq(
  "status desconhecido cai na traducao do erro",
  explicarErroDeConta(ERRO_200, null).mensagem,
  "Sem permissão para ler esta conta de anúncio.",
);
eq("sem erro e conta ativa: nada a dizer", explicarErroDeConta(null, 1), null);
eq(
  "erro nao reconhecido mostra o texto CRU da Meta",
  explicarErroDeConta("Erro exotico 999", 1).mensagem,
  "O Facebook recusou a sincronização: Erro exotico 999",
);
eq("conta encerrada sem erro nenhum ja explica", explicarErroDeConta(null, 101).tom, "erro");

console.log(`\n\x1b[1m${ok + mau} asserções, ${mau} falha(s)\x1b[0m\n`);
process.exitCode = mau ? 1 : 0;
