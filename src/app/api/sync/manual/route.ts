import { auth } from "@/auth";
import { autoSyncSeNecessario } from "@/lib/facebook/autoSync";

// Um ciclo completo com várias contas leva alguns segundos.
export const maxDuration = 60;

/**
 * Sincronização manual — o botão "Atualizar" do Dashboard.
 *
 * Delega ao **mesmo** `autoSyncSeNecessario` dos crons e do polling, de
 * propósito: o botão não sincroniza cegamente. Ele respeita os mesmos
 * intervalos (métricas 20s, estrutura 3 min), então clicar dez vezes seguidas
 * custa uma sincronização, não dez. As outras nove saem no `pulado`, sem tocar
 * na Graph API.
 *
 * A trava contra clique repetido é em DUAS camadas:
 *  1. **Cliente** — botão desabilitado enquanto roda (evita a requisição).
 *  2. **Banco** — a reserva do `autoSync` (`updateMany` condicional). Só ela
 *     protege de verdade: duas abas, dois dispositivos ou um F5 no meio do
 *     caminho passariam pela primeira camada sem esbarrar em nada.
 *
 * Devolve texto pronto para a tela. Montar a frase aqui, e não no componente,
 * mantém a explicação junto de quem sabe o que aconteceu.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Não autenticado." }, { status: 401 });

  const r = await autoSyncSeNecessario(session.user.id);

  if (r.modo === "pulado") {
    return Response.json({ ok: true, modo: r.modo, mensagem: "Tudo já está atualizado." });
  }

  if (r.modo === "erro") {
    return Response.json({ ok: false, modo: r.modo, mensagem: `Falha ao sincronizar: ${r.erro}` }, { status: 502 });
  }

  const s = r.summary;
  const partes: string[] = [];

  if (r.modo === "metricas") {
    partes.push(`Métricas atualizadas (${s.accounts} conta${s.accounts === 1 ? "" : "s"}).`);
    partes.push("Estrutura já estava em dia.");
  } else {
    partes.push(`Métricas e estrutura atualizadas: ${s.campaigns} campanha${s.campaigns === 1 ? "" : "s"}, ${s.ads} anúncio${s.ads === 1 ? "" : "s"}.`);
    if (s.contasNovas) partes.push(`${s.contasNovas} conta${s.contasNovas === 1 ? " nova detectada" : "s novas detectadas"}.`);
    if (s.removidos) partes.push(`${s.removidos} item(ns) removido(s) por não existirem mais no Facebook.`);
  }

  // Gasto de anúncio EXCLUÍDO na Meta não tem onde encostar (ver `metricasOrfas`
  // em sync.ts). Dizer isso é melhor do que o usuário conferir e achar que
  // faltou dado sem explicação.
  if (s.metricasOrfas) {
    partes.push(`${s.metricasOrfas} registro(s) de anúncio já excluído não puderam ser atribuídos.`);
  }
  if (s.errors.length) {
    partes.push(`⚠ ${s.errors.length} erro(s): ${s.errors.slice(0, 2).join("; ")}`);
  }

  return Response.json({
    ok: true,
    modo: r.modo,
    mensagem: partes.join(" "),
    detalhe: { accounts: s.accounts, campaigns: s.campaigns, ads: s.ads, metrics: s.metrics, errors: s.errors },
  });
}
