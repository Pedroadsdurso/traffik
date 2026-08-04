import { deveTentar, esperaDeBackoff, proximaTentativa, rotuloDaEspera } from "@/lib/facebook/backoff";
let ok=0,mau=0;
const eq=(n,a,b)=>{const bom=JSON.stringify(a)===JSON.stringify(b);
  console.log(`  ${bom?"\x1b[32m✓":"\x1b[31m✗"}\x1b[0m ${n}`);
  if(!bom)console.log(`      obtido ${JSON.stringify(a)} | esperado ${JSON.stringify(b)}`);
  if(bom)ok++;else mau++;};
const T0=new Date("2026-08-04T12:00:00Z");
const menos=(min)=>new Date(T0.getTime()-min*60_000);

console.log("\nEscala\n");
eq("0 falhas: sem espera", esperaDeBackoff(0), 0);
eq("2 falhas: ainda sem espera (pode ser rede)", esperaDeBackoff(2), 0);
eq("3 falhas: 5 min", esperaDeBackoff(3), 5*60_000);
eq("10 falhas: 30 min", esperaDeBackoff(10), 30*60_000);
eq("50 falhas: teto de 2h", esperaDeBackoff(50), 2*60*60_000);

console.log("\nDecisao de tentar\n");
eq("sem falha, tenta", deveTentar(0,null,T0), true);
eq("2 falhas recentes, tenta", deveTentar(2,menos(0.1),T0), true);
eq("3 falhas ha 1 min, NAO tenta", deveTentar(3,menos(1),T0), false);
eq("3 falhas ha 6 min, tenta", deveTentar(3,menos(6),T0), true);
eq("50 falhas ha 30 min, NAO tenta", deveTentar(50,menos(30),T0), false);
eq("50 falhas ha 3h, tenta (o teto garante a volta sozinha)", deveTentar(50,menos(180),T0), true);
// ⚠️ estado inconsistente erra para o lado de TENTAR
eq("contador sem data: tenta (nao pode travar para sempre)", deveTentar(50,null,T0), true);

console.log("\nRotulo\n");
eq("sem espera: sem rotulo", rotuloDaEspera(0,null,T0), null);
eq("30 min restantes vira ~ minutos", rotuloDaEspera(10,menos(5),T0), "nova tentativa em ~25 min");
eq("2h vira ~h", rotuloDaEspera(50,menos(10),T0), "nova tentativa em ~2 h");
eq("proximaTentativa devolve o instante", proximaTentativa(3,menos(1),T0)?.toISOString(), new Date(T0.getTime()+4*60_000).toISOString());

console.log(`\n\x1b[1m${ok+mau} asserções, ${mau} falha(s)\x1b[0m\n`);
process.exitCode = mau?1:0;
