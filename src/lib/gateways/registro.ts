import type { Capacidades, GatewayDef } from "./contrato";
import { EXEMPLOS_CAKTO } from "./exemplos/cakto";
import { EXEMPLOS_ONYXPAG } from "./exemplos/onyxpag";
import { parseCakto } from "./parsers/cakto";
import { parseOnyxPag } from "./parsers/onyxpag";
import { parseGenerico } from "./parsers/generico";
import { parseKirvano } from "./parsers/kirvano";

/**
 * # O REGISTRO DE GATEWAYS — fonte única
 *
 * Tudo o que a Traffik sabe sobre um gateway está aqui: como autenticar, como
 * ler o payload, o que ele consegue entregar, que URL o usuário cola no painel
 * dele e o que a tela mostra.
 *
 * ## Como adicionar um gateway novo
 *
 * 1. `src/lib/gateways/parsers/<nome>.ts` — a função `parse`.
 * 2. Uma entrada neste objeto.
 * 3. `public/logos/<nome>.webp`.
 * 4. Um payload de exemplo em `exemplos`, para o testador da aba Testes.
 *
 * **Nada mais.** Nem rota, nem `ingestSale`, nem métrica, nem tela. Se um
 * gateway novo exigir mexer em qualquer um desses, a arquitetura regrediu — o
 * critério não é "o código está bonito", é "quantos arquivos eu toco".
 *
 * ⚠️ `Webhook.platform` é uma String cujo domínio é ESTE objeto. Quem valida é
 * `gatewayValido()`, chamado por `createWebhook` — ver a nota de portas de
 * escrita no fim do arquivo.
 */

/** Capacidades de quem não declara nada: assumimos o mínimo. */
const NADA: Capacidades = {
  ipDoComprador: false,
  fbc: false,
  fbp: false,
  utms: false,
  taxasCalculadas: false,
  comissoes: false,
  telefone: "nenhum",
  agrupaItens: false,
  reentregaEventos: false,
  // "Sistema próprio": o checkout é do usuário, então não há painel de terceiro
  // com campo de pixel. Se a página dele dispara Purchase, quem responde é a 2ª
  // pergunta do preset — este campo é sobre o painel do GATEWAY.
  pixelProprio: false,
};

export const REGISTRO: Record<string, GatewayDef> = {
  // ─────────────────────────────── Kirvano ───────────────────────────────
  KIRVANO: {
    id: "KIRVANO",
    nome: "Kirvano",
    ativo: true,
    // ⚠️ URL LEGADA, e ela não pode mudar. Já está colada no painel do gateway
    // do usuário. Regra permanente do projeto: nenhum identificador já emitido
    // muda de significado. Gateway novo usa o caminho universal (abaixo).
    urlDoWebhook: (token, base) => `${base}/api/webhook/kirvano?id=${token}`,
    auth: {
      tipo: "segredo",
      exigir: true,
      geradoPorNos: false,
      onde: [
        { header: "security-token" },
        { header: "x-security-token" },
        { corpo: "token" },
        { corpo: "security_token" },
      ],
    },
    parse: parseKirvano,
    capacidades: {
      // ✅ Confirmado em 45 de 46 payloads reais de produção (30/07/2026).
      ipDoComprador: true,
      // Verificado nos 64 payloads: nenhum traz `fbc`. Traz `cookies.fbp`.
      fbc: false,
      fbp: true,
      utms: true,
      // ✅ Confirmado: `fee` e o bloco `fiscal` em 36 dos 46 eventos.
      taxasCalculadas: true,
      comissoes: true,
      // Real: "5588982268006" (com DDI) e "+55 (33) 98875-6674" — ver telefone.ts.
      telefone: "nacional",
      agrupaItens: false,
      // ✅ Observada em produção: dois `PIX_GENERATED` do mesmo pedido no mesmo dia.
      reentregaEventos: true,
      // Checkout e página de obrigado são dela, e o painel tem campo de pixel.
      pixelProprio: true,
    },
    campos: [
      { chave: "nome", rotulo: "Nome (opcional)", obrigatorio: false },
      {
        chave: "secret",
        rotulo: "Token de segurança da Kirvano",
        ajuda:
          "Gere o token dentro do painel da Kirvano (você define o texto e escolhe os eventos). " +
          "Nós conferimos cada venda com esse token.",
        obrigatorio: true,
      },
    ],
    instalacao: [
      { titulo: "No painel da Kirvano, abra Webhooks", texto: "Crie um webhook novo e escolha os eventos de venda." },
      { titulo: "Copie a URL abaixo", texto: "Cole no campo de endereço do webhook. Ela é única e identifica a sua conta." },
      { titulo: "Copie o token que a Kirvano gerar", texto: "Cole aqui em cima. Sem ele, as vendas são recusadas." },
    ],
  },

  // ──────────────────────────────── Cakto ────────────────────────────────
  CAKTO: {
    id: "CAKTO",
    nome: "Cakto",
    ativo: true,
    // Gateway novo usa o caminho universal — sem rota própria.
    urlDoWebhook: (token, base) => `${base}/api/webhook/sale/${token}`,
    auth: {
      tipo: "segredo",
      exigir: true,
      // ⚠️ NÓS geramos o segredo e o usuário cola no painel da Cakto — o
      // contrário da Kirvano, onde ele cria lá e cola aqui.
      geradoPorNos: true,
      // A Cakto manda o segredo DENTRO do corpo, não em header.
      onde: [{ corpo: "secret" }],
    },
    parse: parseCakto,
    capacidades: {
      // 🔴 NÃO manda IP nem país do comprador. É o primeiro gateway em que a
      // geografia das vendas depende do país do CLIQUE — e 55,6% do tráfego
      // humano deste produto passa pelo navegador embutido da Meta, que resolve
      // US/IE para brasileiros. A tela avisa por causa desta linha.
      ipDoComprador: false,
      // ✅ Em compensação, manda os dois cookies da Meta: via de atribuição
      // melhor que o IP, porque identifica o clique no anúncio.
      fbc: true,
      fbp: true,
      utms: true,
      taxasCalculadas: true, // campo `fees`
      comissoes: true, // `commissions[]`
      telefone: "nacional", // "34999999999", sem DDI
      agrupaItens: true, // order bump no mesmo disparo, modo agrupado
      // ✅ Ela tem endpoints de "Reenviar Evento" e "Histórico de Eventos".
      reentregaEventos: true,
      // 🔴 O checkout (`pay.cakto.com.br`) e a página de obrigado são DELA, e o
      // painel tem configuração de pixel do Facebook por produto. Se o usuário
      // colou o ID do pixel lá E deixou o Purchase com a Traffik, a Meta conta
      // cada venda duas vezes. A gaveta do Pixel nomeia a Cakto por causa desta
      // linha — ver `pixelProprio` no contrato.
      pixelProprio: true,
    },
    campos: [
      { chave: "nome", rotulo: "Nome (opcional)", obrigatorio: false },
      {
        chave: "secret",
        rotulo: "Chave de segurança",
        // ⚠️ Sem crase: este texto é renderizado como nó de texto, não como
        // Markdown — a crase apareceria literalmente na tela. Aspas curvas são
        // o que o resto do produto usa para citar o nome de um campo alheio.
        ajuda: "Geramos para você. Cole no campo “secret” ao cadastrar o webhook na Cakto.",
        obrigatorio: true,
        gerado: true,
      },
    ],
    instalacao: [
      {
        titulo: "Na Cakto, abra Webhooks e crie um novo",
        texto: "Informe um nome qualquer e escolha os produtos que devem enviar vendas.",
      },
      {
        titulo: "Cole o endereço e a chave abaixo",
        texto: "O endereço vai no campo de URL; a chave, no campo de segurança.",
      },
      {
        titulo: "Escolha o tipo de disparo AGRUPADO",
        texto:
          "Assim uma compra com order bump chega inteira numa mensagem só, e conta como uma venda — não duas. " +
          "O individual também funciona, mas depende de as duas mensagens chegarem.",
        atencao: true,
      },
      {
        titulo: "A localização das vendas será estimada",
        texto:
          "A Cakto não informa o endereço de quem comprou. O país destas vendas vem da visita ao seu site, " +
          "então o mapa mostra uma estimativa — os valores e o total continuam exatos.",
        atencao: true,
      },
    ],
    exemplos: EXEMPLOS_CAKTO,
  },

  // ─────────────────────────────── OnyxPag ───────────────────────────────
  ONYXPAG: {
    id: "ONYXPAG",
    nome: "OnyxPag",
    ativo: true,
    urlDoWebhook: (token, base) => `${base}/api/webhook/sale/${token}`,
    auth: {
      tipo: "segredo",
      // 🔴 `exigir: false` — a OnyxPag NÃO envia segredo nenhum. A doc dela é
      // explícita: "No additional HTTP headers (signatures, tokens, or secrets)
      // are specified for webhook validation". O webhook é configurado passando
      // `postbackUrl` na criação da cobrança; não existe painel onde cadastrar
      // um token.
      //
      // ⚠️ Isso torna a URL a credencial, e é o SEGUNDO caso do projeto (o
      // primeiro é `CUSTOM`). Não é buraco esquecido: exigir segredo aqui
      // recusaria 100% das entregas dela, o que não é falhar fechado — é não
      // integrar. A mitigação é tratar a URL como segredo: ela só aparece na
      // gaveta, com botão de copiar, nunca na listagem.
      //
      // Se um dia eles passarem a assinar, ou se o usuário puser um segredo, os
      // lugares abaixo já são conferidos — e aí ele passa a ser EXIGIDO.
      exigir: false,
      geradoPorNos: false,
      onde: [
        { header: "x-webhook-secret" },
        { header: "x-signature" },
        { header: "signature" },
        { corpo: "secret" },
        { corpo: "token" },
      ],
    },
    parse: parseOnyxPag,
    capacidades: {
      // 🔴 Nem IP nem país do comprador — o país destas vendas vem do clique.
      ipDoComprador: false,
      // 🔴 Primeiro gateway sem NENHUMA via de atribuição no payload: sem
      // `fbc`, sem `click_id` e sem IP, não há o que casar com a visita.
      fbc: false,
      fbp: false,
      // A API aceita `tracking` na CRIAÇÃO da cobrança, mas o payload do
      // webhook documentado NÃO os devolve. Declarado `false` até um payload
      // real provar o contrário — o parser já os lê defensivamente.
      utms: false,
      taxasCalculadas: true, // `fee_amount`
      comissoes: false, // `split` existe na criação, não volta no webhook
      telefone: "nacional", // "11999999999", sem DDI
      // `items[]` são linhas de UMA transação, não vendas separadas.
      agrupaItens: false,
      // A doc recomenda "implementing retry logic for temporary failures" —
      // tratamos como reentrega. A idempotência já é garantida pelo upsert.
      reentregaEventos: true,
      // A cobrança é criada pela API a partir do site do próprio usuário, e a
      // doc não descreve página de obrigado nem campo de pixel. Quem dispara o
      // Purchase no navegador, se alguém disparar, é o site dele — e disso a
      // 2ª pergunta do preset já trata.
      pixelProprio: false,
    },
    campos: [
      { chave: "nome", rotulo: "Nome (opcional)", obrigatorio: false },
      {
        chave: "secret",
        rotulo: "Chave de segurança (opcional)",
        ajuda:
          "A OnyxPag não envia chave. Só preencha se você mesmo acrescentar uma — nesse caso ela passa a ser exigida.",
        obrigatorio: false,
      },
    ],
    instalacao: [
      {
        titulo: "Copie o endereço abaixo",
        texto: "É ele que a OnyxPag vai chamar a cada mudança de status da cobrança.",
      },
      {
        titulo: "Informe o endereço no campo “postbackUrl”",
        texto:
          "Na OnyxPag o webhook não é cadastrado num painel: o endereço vai junto de cada cobrança criada, " +
          "no campo “postbackUrl”. Quem monta seu checkout precisa incluí-lo.",
      },
      {
        titulo: "Trate este endereço como uma senha",
        texto:
          "A OnyxPag não envia chave de segurança junto das vendas, então quem tiver o endereço consegue " +
          "registrar venda na sua conta. Não publique e não mande em grupo.",
        atencao: true,
      },
      {
        titulo: "As vendas não vão ligar sozinhas ao anúncio",
        texto:
          "Ela não devolve o clique nem os códigos de campanha junto da venda. O faturamento fica exato, " +
          "mas a venda não é atribuída à campanha e o país aparece estimado. Se quem monta seu checkout " +
          "conseguir repassar o “click_id” no campo “metadata”, a atribuição volta a funcionar.",
        atencao: true,
      },
    ],
    exemplos: EXEMPLOS_ONYXPAG,
  },

  // ─────────────────────────────── Custom ───────────────────────────────
  CUSTOM: {
    id: "CUSTOM",
    nome: "Sistema próprio",
    ativo: true,
    urlDoWebhook: (token, base) => `${base}/api/webhook/sale/${token}`,
    auth: {
      tipo: "segredo",
      // A própria URL é o segredo — quem envia é um sistema do usuário, sem
      // painel onde cadastrar token. Se ele configurar um, passa a ser exigido.
      exigir: false,
      geradoPorNos: false,
      onde: [
        { header: "security-token" },
        { header: "x-security-token" },
        { corpo: "token" },
        { corpo: "security_token" },
      ],
    },
    parse: parseGenerico,
    capacidades: { ...NADA, telefone: "nacional" },
    campos: [
      { chave: "nome", rotulo: "Nome (opcional)", obrigatorio: false },
      {
        chave: "secret",
        rotulo: "Chave de segurança (opcional)",
        ajuda: "Se preencher, exigiremos esta chave em cada venda enviada.",
        obrigatorio: false,
      },
    ],
    instalacao: [
      { titulo: "Copie a URL abaixo", texto: "Envie as vendas do seu sistema para este endereço." },
    ],
  },

  // ───────────── Cadastrados, sem parser dedicado (ver aviso) ─────────────
  //
  // ⚠️ Estão aqui porque `Webhook.platform` já aceita estes valores e podem
  // EXISTIR linhas com eles no banco. Sem a entrada, um webhook antigo cairia
  // num gateway inexistente e a venda seria recusada — em silêncio, do ponto de
  // vista do usuário. Usam o parser genérico, que é o que a rota já fazia com
  // eles hoje. `ativo: false` só impede criar novos.
  HOTMART: {
    id: "HOTMART",
    nome: "Hotmart",
    ativo: false,
    urlDoWebhook: (token, base) => `${base}/api/webhook/sale/${token}`,
    auth: { tipo: "segredo", exigir: false, geradoPorNos: false, onde: [{ header: "x-hotmart-hottok" }] },
    parse: parseGenerico,
    capacidades: NADA,
    campos: [],
    instalacao: [],
  },
  KIWIFY: {
    id: "KIWIFY",
    nome: "Kiwify",
    ativo: false,
    urlDoWebhook: (token, base) => `${base}/api/webhook/sale/${token}`,
    auth: { tipo: "segredo", exigir: false, geradoPorNos: false, onde: [{ corpo: "signature" }] },
    parse: parseGenerico,
    capacidades: NADA,
    campos: [],
    instalacao: [],
  },
};

/** Gateway pelo id, ou `null`. Nunca lança — id vem do banco e de requisição. */
export function gatewayPorId(id: string | null | undefined): GatewayDef | null {
  return (id && REGISTRO[id.toUpperCase()]) || null;
}

/**
 * O gateway de um webhook, com queda para `CUSTOM`.
 *
 * ⚠️ Cair no genérico é DELIBERADO e é o comportamento de hoje: a rota fazia
 * `platform === "KIRVANO" ? parseKirvano : normalizeSale`, ou seja, tudo que não
 * fosse Kirvano ia para o genérico. Recusar a venda de um webhook com plataforma
 * desconhecida perderia dinheiro real para proteger uma invariante de tipo.
 */
export function gatewayDoWebhook(platform: string | null | undefined): GatewayDef {
  return gatewayPorId(platform) ?? REGISTRO.CUSTOM;
}

/** Ids válidos para gravar em `Webhook.platform`. */
export function gatewayValido(id: string): boolean {
  return Object.hasOwn(REGISTRO, id.toUpperCase());
}

/** Os que o usuário pode escolher na tela, na ordem de exibição. */
export function gatewaysParaEscolher(): GatewayDef[] {
  return Object.values(REGISTRO)
    .filter((g) => g.id !== "CUSTOM")
    .sort((a, b) => Number(b.ativo) - Number(a.ativo) || a.nome.localeCompare(b.nome));
}

/** Rótulo legível de uma plataforma, inclusive uma que saiu do registro. */
export function rotuloDoGateway(id: string): string {
  return gatewayPorId(id)?.nome ?? id;
}
