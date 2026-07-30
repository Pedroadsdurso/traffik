import type { NextRequest } from "next/server";

import { auth } from "@/auth";
import { ehIpPrivado, extrairIpDoCliente, normalizarIp } from "@/lib/geo/clientIp";

/**
 * Diagnóstico de `PROXIES_CONFIAVEIS` — para descobrir o valor certo NO AMBIENTE
 * REAL, em vez de deduzir e descobrir o erro depois.
 *
 * ## Como usar
 *
 * Abra `/api/diagnostico/ip` **do seu navegador**, logado. Descubra o seu IP
 * público real (qualquer site de "meu IP"). Na tabela `simulacao`, ache a linha
 * cujo `ipResultante` é o **seu IP**: aquele `proxies` é o valor correto.
 *
 * ## ⚠️ Por que ele NÃO adivinha sozinho
 *
 * A heurística óbvia — "contar quantos IPs privados há no fim da cadeia" —
 * funciona numa VPS com nginx em `127.0.0.1` e **falha na Vercel**, onde a borda
 * aparece com IP público. Um palpite que acerta num ambiente e erra no outro é
 * pior que nenhum, porque cria confiança onde não deve haver.
 *
 * Então a rota mostra o que cada valor produziria e deixa a decisão com quem
 * consegue comparar com a verdade: você.
 *
 * ⚠️ **Errar para MAIS aceita IP forjado** (o atacante empurra um valor à
 * esquerda e ele passa a ser escolhido). **Errar para MENOS grava o IP do
 * próprio proxy** e todo visitante vira o mesmo endereço.
 */
/**
 * ## 🔒 DESLIGADA por padrão. Só existe com `DIAGNOSTICO_IP=1`.
 *
 * Exigir sessão não bastava. Esta rota **ecoa os headers de proxy** do ambiente,
 * e uma superfície de diagnóstico não deve ficar de pé em produção só porque tem
 * senha: é infraestrutura exposta o tempo todo para servir a um uso de minutos.
 *
 * Sem a variável, responde **404** — e não 403. O 403 confirmaria que a rota
 * existe; o 404 é indistinguível de uma rota que nunca foi escrita.
 *
 * ⚠️ Falha FECHADA, como o `cronAuth` e os webhooks: ausência de configuração
 * nunca vira permissão. Ligar é um ato explícito, e **desligar depois faz parte
 * do procedimento** — ver o CLAUDE.md.
 */
function ligada(): boolean {
  return (process.env.DIAGNOSTICO_IP ?? "").trim() === "1";
}

export async function GET(req: NextRequest) {
  // 404 puro: nem confirma que a rota existe.
  if (!ligada()) return new Response(null, { status: 404 });

  // E, ligada, ainda exige sessão — a resposta expõe headers do ambiente.
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const h = (n: string) => req.headers.get(n);
  const xff = h("x-forwarded-for");
  const cadeia = (xff ?? "")
    .split(",")
    .map((bruto) => {
      const ip = normalizarIp(bruto);
      return { bruto: bruto.trim(), normalizado: ip, privado: ip ? ehIpPrivado(ip) : null };
    })
    .filter((e) => e.bruto !== "");

  // O que cada valor de PROXIES_CONFIAVEIS produziria, com os headers DESTA
  // requisição. A linha cujo IP for o seu é a configuração certa.
  const original = process.env.PROXIES_CONFIAVEIS;
  const simulacao: { proxies: number; ipResultante: string | null }[] = [];
  try {
    for (let n = 0; n <= Math.max(3, cadeia.length); n++) {
      process.env.PROXIES_CONFIAVEIS = String(n);
      simulacao.push({ proxies: n, ipResultante: extrairIpDoCliente({ header: h }) });
    }
  } finally {
    // Restaura sempre: a rota não pode deixar o processo com outro valor.
    if (original === undefined) delete process.env.PROXIES_CONFIAVEIS;
    else process.env.PROXIES_CONFIAVEIS = original;
  }

  return Response.json({
    comoUsar:
      "Descubra seu IP público real (qualquer site de 'meu IP'). Na lista `simulacao`, " +
      "a linha cujo `ipResultante` for o SEU IP indica o valor correto de PROXIES_CONFIAVEIS.",
    aoTerminar:
      "Remova a variável DIAGNOSTICO_IP e faça o redeploy. Esta rota volta a responder 404.",
    configuracaoAtual: {
      PROXIES_CONFIAVEIS: original ?? "(não definido — usando o padrão 1)",
      ipQueSeriaGravado: extrairIpDoCliente({ header: h }),
    },
    simulacao,
    headersRecebidos: {
      "x-forwarded-for": xff,
      "x-real-ip": h("x-real-ip"),
      "cf-connecting-ip": h("cf-connecting-ip"),
      "x-vercel-forwarded-for": h("x-vercel-forwarded-for"),
      "true-client-ip": h("true-client-ip"),
    },
    cadeiaXff: cadeia,
    referencia: {
      vercel: "1 — a borda da Vercel acrescenta um salto",
      vpsComNginx: "1 — com proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for",
      cloudflareMaisNginx: "2 — mas o cf-connecting-ip já resolve sozinho, então o valor importa pouco",
      semProxyNenhum: "0 — aplicação exposta direto na porta 80/443",
    },
  });
}
