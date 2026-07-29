/**
 * Qual banco a aplicação está usando AGORA.
 *
 * Existe por causa de um incidente: um teste em localhost apagou configuração
 * real porque dev e produção compartilhavam o mesmo Supabase, e **nada na tela
 * dizia em qual banco a pessoa estava**. Saber isso não pode depender de abrir
 * o `.env` e comparar um ref de 20 caracteres a olho.
 *
 * ⚠️ **Só pode ser chamado no SERVIDOR.** A string de conexão tem SENHA;
 * `process.env.DATABASE_URL` não existe no navegador (o Next só expõe o que tem
 * prefixo `NEXT_PUBLIC_`), então importar isto num componente de cliente daria
 * um rótulo errado em vez de vazar a senha — mas seria errado do mesmo jeito.
 * Chame no layout (server component) e passe o resultado como prop: o que vai
 * para o navegador é só o rótulo e o ref, nunca a URL.
 */

/** Refs conhecidos. Mesma tabela do `scripts/guard-db.mjs`, com o mesmo cuidado. */
const CONHECIDOS: Record<string, { rotulo: string; producao: boolean }> = {
  dgaoucxkmpdxeenpfqth: { rotulo: "PRODUÇÃO", producao: true },
  drdfnazladzkxlqpgdzt: { rotulo: "DESENVOLVIMENTO", producao: false },
};

export interface BancoAtual {
  /** Ref do projeto Supabase, ou `null` (Postgres local / URL fora do padrão). */
  ref: string | null;
  rotulo: string;
  /**
   * `true` só quando o ref é reconhecidamente de produção.
   *
   * Um banco DESCONHECIDO não é marcado como produção — ele é marcado como
   * desconhecido, e a faixa aparece do mesmo jeito. O objetivo aqui é o oposto
   * do `guard-db`: lá a dúvida vira bloqueio; aqui a dúvida vira **aviso na
   * tela**, porque esconder a faixa é que seria o silêncio perigoso.
   */
  producao: boolean;
  /** Se deve aparecer a faixa de aviso no topo do painel. */
  avisar: boolean;
}

export function bancoAtual(): BancoAtual {
  const url = process.env.DATABASE_URL ?? "";

  if (/@(localhost|127\.0\.0\.1)/.test(url)) {
    return { ref: null, rotulo: "POSTGRES LOCAL", producao: false, avisar: true };
  }

  const ref = url.match(/postgres\.([a-z0-9]{16,})[:@]/)?.[1] ?? null;
  if (!ref) return { ref: null, rotulo: "BANCO NÃO IDENTIFICADO", producao: false, avisar: true };

  const conhecido = CONHECIDOS[ref];
  if (!conhecido) return { ref, rotulo: "BANCO DESCONHECIDO", producao: false, avisar: true };

  // Produção não ganha faixa: é o estado normal de quem usa a ferramenta, e uma
  // faixa permanente vira ruído que se aprende a ignorar — inclusive quando ela
  // mudar para dizer outra coisa.
  return { ref, rotulo: conhecido.rotulo, producao: conhecido.producao, avisar: !conhecido.producao };
}
