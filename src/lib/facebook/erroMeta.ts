/**
 * # Erros da Graph API, traduzidos para quem usa a ferramenta
 *
 * `(#200) Ad account owner has NOT grant ads_management or ads_read permission`
 * não diz a ninguém o que fazer. Este módulo transforma o que a Meta responde
 * numa frase que nomeia a causa e o próximo passo.
 *
 * ## ⚠️ O texto ORIGINAL nunca é descartado
 *
 * A tradução vai para a tela; a mensagem crua continua no log e no
 * `AdAccount.lastSyncError`. Uma tradução errada que apagasse o original
 * tornaria o erro real impossível de recuperar — e a lista abaixo é
 * necessariamente incompleta, porque a Meta acrescenta código sem avisar.
 *
 * ## 🔴 A mensagem da Meta MENTE sobre a causa em pelo menos um caso
 *
 * Conta desabilitada para de conceder permissão pela API, e a Graph responde
 * erro de **permissão**. Quem lê vai pedir acesso ao dono — e o problema é
 * outro. Por isso `explicarErroDeConta` cruza o erro com o `account_status`:
 * quando os dois estão disponíveis, o status manda.
 */

import { estadoDaConta } from "./contaStatus";

export interface ErroTraduzido {
  /** Frase curta para a tela, em linguagem de consequência. */
  mensagem: string;
  /** O que fazer. `null` quando não há ação do usuário. */
  acao: string | null;
  /** Passa sozinho? Rate limit passa; permissão não. */
  temporario: boolean;
  tom: "aviso" | "erro";
}

/**
 * Assinaturas reconhecidas, em ordem de teste.
 *
 * ⚠️ A ordem importa: `(#17)` e `(#4)` trazem a palavra "limit" junto de
 * "request", e uma regra genérica de limite os capturaria antes da específica.
 */
const CONHECIDOS: { re: RegExp; erro: ErroTraduzido }[] = [
  {
    // #190 e subcódigos 458/459/460/463/467.
    re: /\(#?190\)|access token|session (has expired|is invalid)|expirou/i,
    erro: {
      mensagem: "A conexão com o Facebook expirou.",
      acao: "Reconecte o perfil em Integrações › Anúncios. Nenhum dado já sincronizado se perde.",
      temporario: false,
      tom: "erro",
    },
  },
  {
    re: /\(#?(17|4|32|613|80\d{3})\)|request limit reached|rate limit/i,
    erro: {
      mensagem: "O Facebook limitou temporariamente as consultas desta conta.",
      acao: "Não é preciso fazer nada — a sincronização volta sozinha em alguns minutos.",
      temporario: true,
      tom: "aviso",
    },
  },
  {
    re: /\(#?(200|10|294)\)|ads_management|ads_read|permission/i,
    erro: {
      mensagem: "Sem permissão para ler esta conta de anúncio.",
      // ⚠️ As DUAS possibilidades aparecem porque a mensagem da Meta não
      // distingue: conta desabilitada produz exatamente este mesmo erro.
      acao:
        "Peça ao dono da conta acesso de Anunciante no Business Manager. " +
        "Se você já tem acesso, confira se a conta não está desabilitada no Facebook — " +
        "conta desabilitada devolve este mesmo erro.",
      temporario: false,
      tom: "erro",
    },
  },
  {
    re: /\(#?100\)|reduce the amount of data|too much data/i,
    erro: {
      mensagem: "O Facebook recusou a consulta por volume de dados.",
      acao: "Costuma resolver sozinho no próximo ciclo. Se persistir, avise o suporte.",
      temporario: true,
      tom: "aviso",
    },
  },
  {
    re: /\(#?(2635|12)\)|deprecat/i,
    erro: {
      mensagem: "O Facebook descontinuou parte da API que usamos.",
      acao: "É problema nosso, não seu. Avise o suporte.",
      temporario: false,
      tom: "erro",
    },
  },
];

/**
 * Traduz uma mensagem crua da Graph API.
 *
 * ⚠️ Mensagem não reconhecida devolve `null` — **não** um texto genérico
 * inventado. Quem chama exibe o original nesse caso: mostrar o texto da Meta é
 * feio e verdadeiro; inventar uma explicação é bonito e falso.
 */
export function traduzirErroMeta(bruto: string | null | undefined): ErroTraduzido | null {
  if (!bruto?.trim()) return null;
  for (const { re, erro } of CONHECIDOS) {
    if (re.test(bruto)) return erro;
  }
  return null;
}

/**
 * A explicação para uma conta que não sincroniza, cruzando o erro com o
 * `account_status`.
 *
 * 🔴 **O status VENCE o erro** quando ele já explica o problema. É o caso da
 * conta desabilitada: a Meta devolve erro de permissão, e mandar o usuário
 * pedir acesso ao dono seria mandá-lo resolver o problema errado.
 */
export function explicarErroDeConta(
  erroBruto: string | null | undefined,
  accountStatus: number | null | undefined,
): ErroTraduzido | null {
  const estado = estadoDaConta(accountStatus);
  const traduzido = traduzirErroMeta(erroBruto);

  // Status conclusivo e impeditivo responde sozinho — inclusive quando a Meta
  // culpou outra coisa.
  if (!estado.sincroniza && estado.acao) {
    return {
      mensagem: `Conta ${estado.rotulo.toLowerCase()} no Facebook — por isso ela não sincroniza.`,
      acao: estado.acao,
      temporario: false,
      tom: "erro",
    };
  }

  if (traduzido) return traduzido;
  if (!erroBruto?.trim()) return null;

  // Desconhecido: o texto da Meta, cru, com o rótulo dizendo que é dela.
  return {
    mensagem: `O Facebook recusou a sincronização: ${erroBruto.trim().slice(0, 180)}`,
    acao: null,
    temporario: false,
    tom: "erro",
  };
}
