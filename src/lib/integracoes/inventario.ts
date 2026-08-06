/**
 * O INVENTÁRIO — as integrações desta conta, de três naturezas, numa lista só.
 *
 * 🔴 O PROBLEMA QUE ESTE ARQUIVO RESOLVE, E QUE A REFERÊNCIA NÃO TINHA
 *
 * As três telas de referência mostram um catálogo de 15 integrações homogêneas
 * (Google Ads, Meta, TikTok, Stripe, RD Station, Taboola, GTM…) — um produto
 * multi-plataforma, onde toda linha é do mesmo tipo e só muda o logotipo.
 *
 * **Esta ferramenta é mono-plataforma no lado de anúncios (Meta) e plural do
 * lado dos gateways.** As "integrações" reais são três coisas diferentes:
 *
 *   AdProfile    — o perfil da Meta, com N contas de anúncio
 *   Webhook      — um gateway de pagamento mandando venda para cá
 *   PixelConfig  — uma configuração de pixel/CAPI
 *
 * Elas não compartilham colunas, não têm o mesmo ciclo de vida e nem sequer o
 * mesmo significado de "última sincronização". O que o inventário faz é
 * projetá-las numa forma comum **sem inventar campo nenhum**: tudo aqui sai de
 * dado que já existe, e o que não existe fica `null` e a tela diz que não sabe.
 *
 * ⛔ NÃO acrescente uma plataforma "disponível para conectar" nesta lista. Card
 * de plataforma que não conecta é botão que não faz nada — o problema-raiz que
 * este projeto persegue desde o primeiro dia. Quando Google Ads existir de
 * verdade, ele entra sozinho porque haverá `AdProfile` dele.
 */

import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import { estadoDoToken, tokenPedeAtencao, type EstadoToken } from "./token";

/**
 * A categoria é derivada do TIPO da entidade, e é a única classificação real
 * que esta base tem.
 *
 * ⚠️ A referência mostra categorias SEMÂNTICAS ("Pagamentos", "Leads",
 * "Conversões") para webhooks diferentes. Isso não existe aqui:
 * `Webhook.platform` guarda o GATEWAY (`KIRVANO`, `CAKTO`, `CUSTOM`…), que é
 * de onde a venda vem, não o que ela significa. Inventar a classificação
 * produziria um selo colorido que não separa nada.
 */
export type Categoria = "anuncios" | "webhooks" | "pixel";

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  anuncios: "Anúncios",
  webhooks: "Webhooks",
  pixel: "Pixel",
};

/**
 * Estado de uma integração. São TRÊS, e o terceiro não é um meio-termo.
 *
 * `inativa` quer dizer "está configurada e não deu sinal" — para webhook, sem
 * evento em 30 dias; para conta de anúncio, desligada do rastreamento. Não é
 * erro: ninguém precisa consertar. Mas some do radar sem isto.
 */
export type EstadoIntegracao = "conectada" | "erro" | "inativa";

export const ROTULO_ESTADO: Record<EstadoIntegracao, string> = {
  conectada: "Conectada",
  erro: "Erro",
  inativa: "Inativa",
};

/** Dias sem evento a partir dos quais um webhook é considerado inativo. */
export const DIAS_INATIVA = 30;

export interface ItemIntegracao {
  id: string;
  /** Chave estável para a URL do detalhe (`?item=`). */
  chave: string;
  nome: string;
  /** Linha de baixo na lista: "Conta principal", o gateway, etc. */
  subtitulo: string;
  categoria: Categoria;
  estado: EstadoIntegracao;
  /**
   * Quando esta integração deu sinal pela última vez. **`null` = nunca deu**,
   * e a tela diz "nunca" — não "há 0 minutos", que seria o oposto da verdade.
   *
   * ⚠️ O significado MUDA por natureza, e está dito no `subtituloSincronizacao`:
   * para o perfil da Meta é a última sincronização; para o webhook é o último
   * evento recebido. Chamar os dois de "última sincronização" sem dizer qual é
   * qual faria o usuário comparar duas coisas diferentes.
   */
  ultimoSinal: Date | null;
  /** O que `ultimoSinal` significa NESTA linha. */
  rotuloSinal: string;
  /** Motivo do estado, quando não é "conectada". Vai para o painel. */
  detalhe: string | null;
  /** Metadados do painel — pares rótulo/valor, sem inventar campo. */
  meta: { rotulo: string; valor: string }[];
  /** Só o perfil da Meta tem token. `null` no resto. */
  token: EstadoToken | null;
}

function texto(d: Date | null | undefined): string {
  return d ? new Date(d).toLocaleDateString("pt-BR") : "—";
}

/**
 * Monta o inventário. **Função pura** — recebe os DTOs que a tela já tem e não
 * toca em banco, para poder ser testada sem nada em volta.
 */
export function montarInventario(
  perfis: AdProfileDTO[],
  webhooks: WebhookRowDTO[],
  pixels: PixelConfigDTO[],
  rotuloGateway: (p: string) => string,
  agora = new Date(),
): ItemIntegracao[] {
  const itens: ItemIntegracao[] = [];

  /* ── Perfis da Meta ───────────────────────────────────────────────────────
     Uma linha por PERFIL, não por conta. As contas viram contagem no painel e
     lista própria no bloco "Contas conectadas" — uma linha por conta faria a
     lista ter 6 entradas idênticas dizendo "Meta Ads". */
  for (const p of perfis) {
    const token = estadoDoToken(p.tokenExpiresAt, agora);
    const contasComErro = p.accounts.filter((a) => a.syncErrorCount > 0).length;
    const rastreando = p.accounts.filter((a) => a.trackingEnabled).length;

    /* A ordem da decisão importa: token vencido vence erro de conta, porque é
       a CAUSA provável dele. Mostrar "3 contas com erro" quando o token expirou
       manda consertar o sintoma. */
    let estado: EstadoIntegracao = "conectada";
    let detalhe: string | null = null;
    if (token.tipo === "vencido") {
      estado = "erro";
      detalhe = "O token da Meta expirou e a sincronização está parada.";
    } else if (p.lastDiscoveryError) {
      estado = "erro";
      detalhe = "Não foi possível listar as contas deste perfil.";
    } else if (contasComErro > 0) {
      estado = "erro";
      detalhe = `${contasComErro} de ${p.accounts.length} contas com erro de sincronização.`;
    } else if (rastreando === 0) {
      estado = "inativa";
      detalhe = "Nenhuma conta deste perfil está com o rastreamento ligado.";
    }

    itens.push({
      id: p.id,
      chave: `perfil:${p.id}`,
      nome: "Meta Ads",
      subtitulo: p.name,
      categoria: "anuncios",
      estado,
      ultimoSinal: p.lastSyncedAt,
      rotuloSinal: "Última sincronização",
      detalhe,
      token,
      meta: [
        { rotulo: "Conta", valor: p.email ?? p.name },
        { rotulo: "Tipo", valor: "Anúncios" },
        { rotulo: "Contas de anúncio", valor: String(p.accounts.length) },
        { rotulo: "Campanhas", valor: String(p.accounts.reduce((s, a) => s + a.campanhas, 0)) },
        { rotulo: "Conectada em", valor: texto(p.connectedAt) },
        /* O fuso vem da primeira conta que informou. ⚠️ Contas do mesmo perfil
           PODEM ter fusos diferentes, e a tela não finge que há um só: quando
           divergem, mostra quantos. */
        { rotulo: "Fuso horário", valor: fusoDoPerfil(p) },
      ],
    });
  }

  /* ── Webhooks de gateway ──────────────────────────────────────────────── */
  for (const w of webhooks) {
    const diasSemEvento = w.lastEventAt
      ? Math.floor((agora.getTime() - new Date(w.lastEventAt).getTime()) / 86_400_000)
      : null;

    let estado: EstadoIntegracao = "conectada";
    let detalhe: string | null = null;
    if (!w.active) {
      estado = "inativa";
      detalhe = "Este webhook está desligado e não recebe eventos.";
    } else if (w.eventCount === 0) {
      /* ⚠️ "Nunca recebeu" NÃO é erro. Webhook recém-criado está esperando a
         primeira venda, e pintá-lo de vermelho treinaria o usuário a ignorar
         vermelho. É `inativa` com o motivo escrito. */
      estado = "inativa";
      detalhe = "Configurado, mas nenhum evento chegou ainda.";
    } else if (diasSemEvento !== null && diasSemEvento >= DIAS_INATIVA) {
      estado = "inativa";
      detalhe = `Sem eventos há ${diasSemEvento} dias.`;
    }

    itens.push({
      id: w.id,
      chave: `webhook:${w.id}`,
      nome: rotuloGateway(w.platform),
      subtitulo: w.name,
      categoria: "webhooks",
      estado,
      ultimoSinal: w.lastEventAt,
      rotuloSinal: "Último evento recebido",
      detalhe,
      token: null,
      meta: [
        { rotulo: "Gateway", valor: rotuloGateway(w.platform) },
        { rotulo: "Tipo", valor: "Webhook" },
        { rotulo: "Eventos recebidos", valor: w.eventCount.toLocaleString("pt-BR") },
        { rotulo: "Chave de segurança", valor: w.hasSecret ? "Configurada" : "Não configurada" },
        { rotulo: "Criado em", valor: texto(w.createdAt) },
      ],
    });
  }

  /* ── Configurações de pixel ───────────────────────────────────────────── */
  for (const px of pixels) {
    const comToken = px.metaPixels.filter((m) => m.hasToken).length;
    let estado: EstadoIntegracao = "conectada";
    let detalhe: string | null = null;
    if (!px.enabled) {
      estado = "inativa";
      detalhe = "Esta configuração de pixel está desligada.";
    } else if (px.metaPixels.length === 0) {
      estado = "inativa";
      detalhe = "Nenhum pixel da Meta vinculado a esta configuração.";
    } else if (comToken === 0) {
      /* Sem token de CAPI o pixel funciona só pelo navegador — metade do par de
         dedup. É erro porque o usuário acha que tem CAPI e não tem. */
      estado = "erro";
      detalhe = "Nenhum pixel tem token de CAPI — os eventos saem só pelo navegador.";
    }

    itens.push({
      id: px.id,
      chave: `pixel:${px.id}`,
      nome: px.name,
      subtitulo: px.metaPixels.length === 1 ? "1 pixel da Meta" : `${px.metaPixels.length} pixels da Meta`,
      categoria: "pixel",
      estado,
      /* ⚠️ `null` de propósito: não guardamos "último evento" por configuração
         de pixel. A tela mostra "—" e não finge um horário. */
      ultimoSinal: null,
      rotuloSinal: "Último evento",
      detalhe,
      token: null,
      meta: [
        { rotulo: "Tipo", valor: "Pixel e CAPI" },
        { rotulo: "Pixels da Meta", valor: String(px.metaPixels.length) },
        { rotulo: "Com token de CAPI", valor: `${comToken} de ${px.metaPixels.length}` },
        { rotulo: "Regras de evento", valor: String(px.rules.length) },
      ],
    });
  }

  return itens;
}

function fusoDoPerfil(p: AdProfileDTO): string {
  const fusos = [...new Set(p.accounts.map((a) => a.timezone).filter(Boolean))] as string[];
  if (fusos.length === 0) return "—";
  if (fusos.length === 1) return fusos[0]!;
  return `${fusos.length} fusos diferentes`;
}

/** Os 3 números da faixa de estado. Nenhum "+N este mês" — ver o commit. */
export function contarEstados(itens: ItemIntegracao[]) {
  return {
    conectadas: itens.filter((i) => i.estado === "conectada").length,
    erro: itens.filter((i) => i.estado === "erro").length,
    inativas: itens.filter((i) => i.estado === "inativa").length,
    total: itens.length,
  };
}

/* ── SAÚDE DA INTEGRAÇÃO ──────────────────────────────────────────────────── */

export type EstadoServico = "ok" | "atencao" | "erro" | "ausente";

export interface LinhaSaude {
  nome: string;
  estado: EstadoServico;
  /** O valor à direita. Curto — é uma linha de painel, não uma frase. */
  valor: string;
}

/**
 * As CINCO linhas de saúde que esta ferramenta consegue responder de verdade.
 *
 * ⛔ A referência (imagem 6) tem SETE. Duas saíram, e ficam registradas aqui
 * para ninguém "completar a lista" depois:
 *
 *   **Conversões Offline** — a ferramenta não faz isso. Zero ocorrências no
 *   código e no schema. Uma linha "Online" ali seria uma afirmação inventada
 *   sobre um recurso que não existe.
 *
 *   **Permissões (100%)** — não guardamos os scopes do token. Para saber se o
 *   perfil ainda tem `ads_read`, `ads_management` e `business_management` seria
 *   preciso consultar a Graph API, que é backend.
 *
 * Cinco linhas verdadeiras valem mais que sete com duas fingindo — e um painel
 * chamado "Saúde" que mente numa linha não é confiável em nenhuma.
 */
export function montarSaude(
  perfis: AdProfileDTO[],
  webhooks: WebhookRowDTO[],
  pixels: PixelConfigDTO[],
  agora = new Date(),
): LinhaSaude[] {
  const linhas: LinhaSaude[] = [];

  // API Meta
  if (perfis.length === 0) {
    linhas.push({ nome: "API Meta", estado: "ausente", valor: "Sem perfil" });
  } else {
    const contas = perfis.flatMap((p) => p.accounts);
    const comErro = contas.filter((a) => a.syncErrorCount > 0).length;
    linhas.push(
      comErro > 0
        ? { nome: "API Meta", estado: "erro", valor: `${comErro} com erro` }
        : { nome: "API Meta", estado: "ok", valor: "Operacional" },
    );
  }

  // Pixel
  const pixelsAtivos = pixels.filter((p) => p.enabled);
  linhas.push(
    pixels.length === 0
      ? { nome: "Pixel", estado: "ausente", valor: "Não configurado" }
      : pixelsAtivos.length === 0
        ? { nome: "Pixel", estado: "atencao", valor: "Todos desligados" }
        : { nome: "Pixel", estado: "ok", valor: `${pixelsAtivos.length} ativo${pixelsAtivos.length > 1 ? "s" : ""}` },
  );

  // Webhook
  const whAtivos = webhooks.filter((w) => w.active);
  linhas.push(
    webhooks.length === 0
      ? { nome: "Webhook", estado: "ausente", valor: "Nenhum" }
      : whAtivos.length === 0
        ? { nome: "Webhook", estado: "atencao", valor: "Todos desligados" }
        : { nome: "Webhook", estado: "ok", valor: `${whAtivos.length} ativo${whAtivos.length > 1 ? "s" : ""}` },
  );

  // CAPI — existe token em algum pixel?
  const metas = pixels.flatMap((p) => p.metaPixels);
  const comToken = metas.filter((m) => m.hasToken).length;
  linhas.push(
    metas.length === 0
      ? { nome: "CAPI", estado: "ausente", valor: "Sem pixel" }
      : comToken === 0
        ? { nome: "CAPI", estado: "erro", valor: "Sem token" }
        : { nome: "CAPI", estado: "ok", valor: `${comToken} de ${metas.length}` },
  );

  /* Token de acesso — a linha que motivou o painel inteiro.
     ⚠️ O PIOR estado entre os perfis manda. Um perfil saudável não compensa
     outro vencido: a sincronização daquele está parada do mesmo jeito. */
  if (perfis.length === 0) {
    linhas.push({ nome: "Token de acesso", estado: "ausente", valor: "Sem perfil" });
  } else {
    const estados = perfis.map((p) => estadoDoToken(p.tokenExpiresAt, agora));
    const vencido = estados.find((e) => e.tipo === "vencido");
    const desconhecido = estados.find((e) => e.tipo === "desconhecido");
    const proximo = estados
      .filter((e): e is Extract<EstadoToken, { tipo: "expira" }> => e.tipo === "expira")
      .sort((a, b) => a.dias - b.dias)[0];

    if (vencido) {
      linhas.push({ nome: "Token de acesso", estado: "erro", valor: "Expirado" });
    } else if (desconhecido) {
      linhas.push({ nome: "Token de acesso", estado: "atencao", valor: "Data desconhecida" });
    } else if (proximo) {
      linhas.push({
        nome: "Token de acesso",
        estado: tokenPedeAtencao(proximo) ? "atencao" : "ok",
        valor: `${proximo.dias} dias restantes`,
      });
    }
  }

  return linhas;
}
