/**
 * # O que aconteceu DEPOIS que a venda foi gravada
 *
 * Três efeitos rodam no `after()` da ingestão, e os três eram `console.error` e
 * mais nada:
 *
 * | Efeito | O que se perdia em silêncio |
 * |---|---|
 * | `Purchase` na CAPI | a conversão nunca chega ao Facebook — e a campanha otimiza sem ela |
 * | `InitiateCheckout` do gateway | o topo do funil encolhe sem explicação |
 * | Notificação | o aviso de venda nunca toca |
 *
 * Nos três o webhook respondia **200**, a venda entrava **certa**, e o número na
 * tela continuava plausível. É a assinatura da família inteira: falha que não
 * produz erro, não produz log que alguém leia, e não muda nada que se possa ver.
 *
 * ## ⛔ "Não se aplica" NÃO é "falhou" — e é por isso que existe um vocabulário
 *
 * Um booleano `ok` colapsaria três coisas diferentes numa só, que é exatamente o
 * defeito que este módulo existe para desfazer:
 *
 * - **`outro_dono`** é o desfecho CORRETO quando a partição diz que o pixel da
 *   página (ou o do gateway) envia o Purchase. Contá-lo como falha faria a tela
 *   pedir para consertar o que está certo.
 * - **`sem_pixel`** é quem ainda não configurou. Não é bug, é etapa.
 * - **`sem_token`** é a mesma tela do `sem_pixel` para quem olha de longe — e é
 *   bug: o pixel existe, a regra está ligada, e nada sai.
 *
 * Mesma distinção do testador de payload ("o gateway não manda" × "o parser não
 * leu") e dos dois zeros do sync ("sem gasto" × "não buscamos ainda").
 *
 * ## ⚠️ NULO é ausência de informação, nunca alarme
 *
 * Venda anterior a estas colunas tem os três nulos. Se nulo pintasse de
 * vermelho, todo o histórico apareceria quebrado no dia do deploy — a lição do
 * `effectiveStatus` e do `accountStatus`, de novo.
 */

/** Tom da situação. `problema` é o único que pede ação de quem lê. */
export type TomDoEfeito = "ok" | "neutro" | "problema";

export interface SituacaoDoEfeito {
  /** Frase curta, em linguagem de consequência. */
  rotulo: string;
  tom: TomDoEfeito;
  /** O que fazer. `null` quando não há ação — e aí a tela não cobra nada. */
  acao: string | null;
}

/* ------------------------------------------------------------------ *
 * Purchase na CAPI
 * ------------------------------------------------------------------ */

export const CAPI_ENVIADO = "enviado";
export const CAPI_SEM_PIXEL = "sem_pixel";
export const CAPI_OUTRO_DONO = "outro_dono";
export const CAPI_REGRA = "regra";
export const CAPI_SEM_TOKEN = "sem_token";
export const CAPI_ERRO = "erro";

const CAPI: Record<string, SituacaoDoEfeito> = {
  [CAPI_ENVIADO]: {
    rotulo: "Chegou ao Facebook",
    tom: "ok",
    acao: null,
  },
  [CAPI_SEM_PIXEL]: {
    rotulo: "Nenhum pixel configurado para enviar vendas",
    tom: "neutro",
    acao: "Se você quer que as vendas cheguem ao Facebook, cadastre um pixel em Integrações › Pixel.",
  },
  [CAPI_OUTRO_DONO]: {
    // ⚠️ Isto é uma CONFIGURAÇÃO, não uma falha. Ver o cabeçalho.
    rotulo: "Outro envia esta venda",
    tom: "neutro",
    acao: null,
  },
  [CAPI_REGRA]: {
    rotulo: "Fora do que o pixel foi configurado para enviar",
    tom: "neutro",
    acao: null,
  },
  [CAPI_SEM_TOKEN]: {
    rotulo: "Falta conectar o pixel — a venda não chegou ao Facebook",
    tom: "problema",
    acao: "Cole o token da Conversions API em Integrações › Pixel. Sem ele nenhuma venda é enviada.",
  },
  [CAPI_ERRO]: {
    rotulo: "O Facebook recusou a venda",
    tom: "problema",
    acao: "Veja a mensagem ao lado. Token expirado e pixel removido são as causas comuns.",
  },
};

/* ------------------------------------------------------------------ *
 * InitiateCheckout gerado pelo webhook do gateway
 * ------------------------------------------------------------------ */

export const CHECKOUT_CRIADO = "criado";
export const CHECKOUT_DUPLICADO = "duplicado";
export const CHECKOUT_IGNORADO = "ignorado";
export const CHECKOUT_ERRO = "erro";

const CHECKOUT: Record<string, SituacaoDoEfeito> = {
  [CHECKOUT_CRIADO]: { rotulo: "Entrou no funil", tom: "ok", acao: null },
  [CHECKOUT_DUPLICADO]: {
    // ⚠️ Desfecho correto: o visitante já tinha disparado o evento pelo clique.
    // Marcar como falha ensinaria a "consertar" a dedup, que é o que impede o
    // topo do funil de contar o mesmo checkout duas vezes.
    rotulo: "Já contado pelo clique no site",
    tom: "neutro",
    acao: null,
  },
  [CHECKOUT_IGNORADO]: {
    rotulo: "Esta venda não gera checkout",
    tom: "neutro",
    acao: null,
  },
  [CHECKOUT_ERRO]: {
    rotulo: "O checkout não entrou no funil",
    tom: "problema",
    acao: "O topo do funil está menor do que deveria. Veja a mensagem ao lado.",
  },
};

/* ------------------------------------------------------------------ *
 * Notificação
 * ------------------------------------------------------------------ */

export const NOTIF_CRIADA = "criada";
export const NOTIF_DESLIGADA = "desligada";
export const NOTIF_SEM_CONFIG = "sem_config";
export const NOTIF_STATUS = "status";
export const NOTIF_ERRO = "erro";

const NOTIF: Record<string, SituacaoDoEfeito> = {
  [NOTIF_CRIADA]: { rotulo: "Avisamos você", tom: "ok", acao: null },
  [NOTIF_DESLIGADA]: {
    rotulo: "Você desligou este aviso",
    tom: "neutro",
    acao: null,
  },
  [NOTIF_SEM_CONFIG]: {
    // 🔴 O caso mudo que motivou a coluna: sem a linha de preferências a função
    // dava `return` e NENHUM aviso saía, para nenhuma venda, para sempre.
    rotulo: "Suas preferências de aviso nunca foram criadas — nenhum aviso sai",
    tom: "problema",
    acao: "Abra Notificações uma vez: as preferências são criadas ao entrar na tela.",
  },
  [NOTIF_STATUS]: {
    rotulo: "Só avisamos venda aprovada ou pendente",
    tom: "neutro",
    acao: null,
  },
  [NOTIF_ERRO]: {
    rotulo: "O aviso não foi criado",
    tom: "problema",
    acao: "Veja a mensagem ao lado.",
  },
};

/* ------------------------------------------------------------------ *
 * Leitura
 * ------------------------------------------------------------------ */

/**
 * Situação de um valor gravado.
 *
 * ⛔ Valor DESCONHECIDO aparece cru e vira `problema`, nunca um chute nem um
 * "ok" por omissão. É a mesma regra do `effectiveStatus`: uma lacuna tem de
 * pedir correção em vez de passar batida. Vocabulário novo gravado por código
 * novo e não cadastrado aqui é bug nosso, e é assim que ele se denuncia.
 */
function ler(tabela: Record<string, SituacaoDoEfeito>, valor: string | null | undefined): SituacaoDoEfeito | null {
  // ⚠️ NULO não é falha: é venda anterior a esta coluna. Devolve null e a tela
  // simplesmente não afirma nada sobre ela.
  if (!valor) return null;
  return (
    tabela[valor] ?? {
      rotulo: valor,
      tom: "problema",
      acao: "Situação não reconhecida por esta versão da tela.",
    }
  );
}

export const situacaoCapi = (v: string | null | undefined) => ler(CAPI, v);
export const situacaoCheckout = (v: string | null | undefined) => ler(CHECKOUT, v);
export const situacaoNotificacao = (v: string | null | undefined) => ler(NOTIF, v);

/**
 * Os status que pedem ação, **derivados das próprias tabelas acima**.
 *
 * ⛔ NÃO reescreva esta lista à mão em quem consulta o banco. Duas listas para
 * a mesma pergunta divergem no primeiro status novo — e aqui a divergência
 * seria invisível do pior jeito: a tela pintaria um chip vermelho que a consulta
 * de detalhe não traz, ou o contrário. É a mesma raiz do
 * `whereDespesasDaArea`/`whereDespesas`, que erraram **juntos** e por isso
 * destruíram o único sinal que denunciaria o erro.
 */
const problemasDe = (t: Record<string, SituacaoDoEfeito>) =>
  Object.entries(t)
    .filter(([, v]) => v.tom === "problema")
    .map(([k]) => k);

export const STATUS_PROBLEMA: Record<"capi" | "checkout" | "notif", string[]> = {
  capi: problemasDe(CAPI),
  checkout: problemasDe(CHECKOUT),
  notif: problemasDe(NOTIF),
};

/** Os três efeitos de uma venda, para a tela iterar sem repetir a estrutura. */
export const EFEITOS = [
  { chave: "capi" as const, titulo: "Venda enviada ao Facebook", ler: situacaoCapi },
  { chave: "checkout" as const, titulo: "Checkout no funil", ler: situacaoCheckout },
  { chave: "notif" as const, titulo: "Aviso de venda", ler: situacaoNotificacao },
];

/**
 * 🔴 OS PROBLEMAS DE UMA VENDA — a leitura que faltava, em 17/08/2026.
 *
 * ## O par escritor-sem-leitor que esta função desfaz
 *
 * `marcarEfeito.ts` grava `capiStatus`, `checkoutStatus` e `notifStatus` em
 * toda venda desde a Família 1. O único leitor era `resumoEfeitos`, uma server
 * action da tela de `Integrações › Testes` — e quando a tela foi deletada, a
 * action ficou órfã e foi podada junto. As três colunas ficaram **só com
 * escritor**: gravadas em toda venda, lidas por ninguém.
 *
 * É a imagem espelhada do `Sale.apiCredentialId` (6 leitores, 0 escritores), e
 * a mesma família: dado que existe, custa escrita, e não chega a lugar nenhum.
 *
 * ## ⛔ POR QUE A LEITURA VOLTA NA LINHA DA VENDA, e não num resumo
 *
 * O que estas colunas guardam é **por que ESTA venda não produziu o efeito** —
 * um fato da linha, não uma estatística. Um resumo ("3 falharam") obriga quem
 * lê a ir procurar QUAIS, e era exatamente essa fricção que fazia ninguém
 * abrir a tela. Na linha, o problema chega junto do dinheiro.
 *
 * ⚠️ **Só o que pede AÇÃO entra.** `tom: "ok"` e `tom: "neutro"` ficam de fora:
 * uma linha que anuncia "enviado à Meta ✓" em toda venda é ruído que se aprende
 * a ignorar — e aí a que diz "não enviado" chega no meio de dez verdes. É a
 * mesma regra do `AlertList`.
 *
 * ⚠️ **NULO não entra**, e é a distinção central deste projeto: venda anterior
 * às colunas tem os três nulos, e nulo é ausência de informação, nunca alarme.
 * Quem garante isso é o `ler()` acima, que devolve `null` — não esta função.
 */
export function problemasDaVenda(v: {
  capiStatus?: string | null;
  checkoutStatus?: string | null;
  notifStatus?: string | null;
}): { chave: "capi" | "checkout" | "notif"; rotulo: string; acao: string | null }[] {
  const porChave = { capi: v.capiStatus, checkout: v.checkoutStatus, notif: v.notifStatus };
  return EFEITOS.flatMap((e) => {
    const s = e.ler(porChave[e.chave]);
    /* ⛔ O filtro é por `tom`, derivado das TABELAS — nunca uma lista de status
       escrita aqui. Duas listas para a mesma pergunta divergem no primeiro
       status novo, e é o motivo de o `STATUS_PROBLEMA` acima ser derivado. */
    return s && s.tom === "problema" ? [{ chave: e.chave, rotulo: s.rotulo, acao: s.acao }] : [];
  });
}

/**
 * Recorta a mensagem crua antes de gravar.
 *
 * A Meta devolve corpo de erro longo e às vezes com a URL da documentação
 * inteira. A coluna não é um log — é o que a tela mostra ao lado do rótulo.
 */
export function mensagemCurta(e: unknown, limite = 300): string {
  const texto = e instanceof Error ? e.message : String(e ?? "");
  const limpo = texto.replace(/\s+/g, " ").trim();
  return limpo.length > limite ? `${limpo.slice(0, limite - 1)}…` : limpo || "Erro sem mensagem.";
}
