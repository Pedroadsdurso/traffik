import { prisma } from "@/lib/prisma";

/**
 * # Batimento das rotinas agendadas
 *
 * ## Por que a detecção é INVERTIDA
 *
 * Agendador externo (cron-job.org, GitHub Actions) avisa quando a execução
 * **falha**. Nenhum avisa quando ele próprio **para** — notificação de falha
 * depende de executar. Um agendador desligado, um endpoint que mudou de
 * domínio, uma conta que expirou: tudo isso é silêncio absoluto do lado de fora.
 *
 * Então quem detecta é o servidor, pela AUSÊNCIA: a rota registra que rodou, e
 * a tela avisa quando faz tempo demais.
 *
 * > ⚠️ Cobre os dois agendadores de uma vez, **inclusive o caso "os dois
 * > pararam"** — que é o único que nenhum painel externo enxerga.
 *
 * ## ⚠️ Um cron que para NÃO tem sintoma imediato
 *
 * O painel continua respondendo, os dados continuam lá, o auto-sync ainda roda
 * quando alguém abre a tela. O que para é o que acontece **com ninguém
 * olhando**: motor de regras, relatórios, purga de IP, retenção de log. Some
 * devagar, e quando aparece já faz semanas.
 */

/** As rotinas que têm agendamento externo. */
export type RotaCron = "sync-facebook" | "run-rules" | "reports" | "manutencao";

/**
 * Quanto tempo sem rodar até virar aviso.
 *
 * ⚠️ Folgado de propósito — o dobro do intervalo esperado, no mínimo. O
 * cron-job.org e o GitHub Actions são *best-effort* e atrasam em pico; um limite
 * apertado produziria aviso a cada congestionamento, e **aviso que às vezes
 * mente treina o usuário a ignorar todos**.
 */
const LIMITE_MS: Record<RotaCron, number> = {
  "sync-facebook": 60 * 60_000, // esperado a cada 15 min
  "run-rules": 60 * 60_000, // idem
  reports: 3 * 60 * 60_000, // esperado de hora em hora
  manutencao: 48 * 60 * 60_000, // esperado diário
};

const ROTULO: Record<RotaCron, string> = {
  "sync-facebook": "Sincronização com o Facebook",
  "run-rules": "Motor de regras",
  reports: "Relatórios programados",
  manutencao: "Manutenção diária",
};

/**
 * Registra que a rota rodou.
 *
 * ⚠️ **Nunca lança.** Falhar ao anotar o batimento não pode derrubar a rotina
 * que acabou de funcionar — é a mesma regra do `logWebhook` e do
 * `registrarErro` das contas.
 */
export async function registrarExecucao(
  rota: RotaCron,
  info: { ok: boolean; duracaoMs: number; erro?: string | null },
): Promise<void> {
  try {
    const dados = {
      ultimaEm: new Date(),
      ok: info.ok,
      duracaoMs: Math.round(info.duracaoMs),
      erro: info.erro?.slice(0, 500) ?? null,
    };
    await prisma.execucaoCron.upsert({
      where: { rota },
      update: dados,
      create: { rota, ...dados },
    });
  } catch {
    // silencioso de propósito — ver o aviso acima
  }
}

export interface EstadoDaRotina {
  rota: RotaCron;
  rotulo: string;
  /** `null` = nunca rodou desde que isto existe. */
  ultimaEm: Date | null;
  /** Passou do limite? */
  atrasada: boolean;
  /** A última execução falhou? Silêncio e falha são sinais diferentes. */
  falhou: boolean;
  erro: string | null;
}

/**
 * O estado das quatro rotinas.
 *
 * ⚠️ **"Nunca rodou" NÃO é tratado como atraso.** Logo depois do deploy toda
 * linha está ausente, e alarmar aí encheria a tela de vermelho por uma coluna
 * recém-criada. O aviso começa a valer no primeiro batimento — a partir daí a
 * ausência é significativa. Mesma lição do `effectiveStatus` e do
 * `accountStatus` nulos.
 */
export async function estadoDasRotinas(agora: Date = new Date()): Promise<EstadoDaRotina[]> {
  const linhas = await prisma.execucaoCron.findMany();
  const porRota = new Map(linhas.map((l) => [l.rota, l]));

  return (Object.keys(LIMITE_MS) as RotaCron[]).map((rota) => {
    const l = porRota.get(rota);
    return {
      rota,
      rotulo: ROTULO[rota],
      ultimaEm: l?.ultimaEm ?? null,
      atrasada: l != null && agora.getTime() - l.ultimaEm.getTime() > LIMITE_MS[rota],
      falhou: l != null && !l.ok,
      erro: l?.erro ?? null,
    };
  });
}
