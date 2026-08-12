"use client";

import * as React from "react";

import type { TraffikView } from "@/components/dashboard/useTraffikState";
import {
  createApiCredential,
  deleteApiCredential,
  listApiCredentials,
  revealApiCredential,
  revokeApiCredential,
  type ApiCredentialDTO,
} from "@/lib/actions/apiCredentials";
import { listWebhookLogs, type WebhookLogDTO } from "@/lib/actions/diagnostics";
import {
  createWebhook,
  deleteWebhook,
  listWebhooks,
  toggleWebhook,
  updateWebhook,
  type WebhookRowDTO,
} from "@/lib/actions/webhooks";
import { getPublicAppUrl } from "@/lib/appUrl";
import { gatewayDoWebhook } from "@/lib/gateways/registro";
import {
  DESFECHO_DA_ENTREGA,
  TEXTO_DO_VAZIO,
  estadoDoWebhook,
  motivoDoVazio,
} from "@/lib/webhooks/estado";
import { Icone } from "@/components/dashboard/ui/Icone";
import { LogoGateway } from "@/components/dashboard/ui/LogoGateway";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { CampoCopiavel } from "@/components/tk/CampoCopiavel";
import { Card } from "@/components/tk/Card";
import { Switch } from "@/components/tk/Controles";
import { CodigoDestacado } from "@/components/tk/CodigoDestacado";
import { Desde } from "@/components/tk/Desde";
import { EmptyState } from "@/components/tk/EmptyState";
import { Gaveta } from "@/components/tk/Gaveta";
import { Skeleton } from "@/components/tk/Skeleton";
import { useCopiar } from "@/components/tk/useCopiar";
import { GavetaWebhook } from "./GavetaWebhook";

/**
 * INTEGRAÇÕES › WEBHOOKS — por onde a venda ENTRA.
 *
 * > ### 🔴 A FORMA MAIS CARA DO ARTEFATO DE CONTEXTO ERRADO ESTÁ NESTA TELA
 * >
 * > O que sai daqui é uma URL, e quem a cola **é uma terceira parte que a gente
 * > não vê**: o painel do gateway do cliente. Uma URL da área errada não dá
 * > erro em lugar nenhum — ela aceita o payload, responde 200 e credita a venda
 * > na operação errada. Não há log, não há alerta, não há 4xx.
 * >
 * > E o sintoma não se parece com defeito: aparece como **venda faltando numa
 * > área e venda a mais em outra**, dois números plausíveis em telas diferentes,
 * > sem nada que os ligue.
 * >
 * > ⛔ Por isso `listWebhooks(workspaceId)` com `workspaceId` **nas deps do
 * > efeito**. A assinatura do defeito, registrada no `CLAUDE.md`, é exatamente:
 * > componente cliente + server action escopada por área + chamada **sem o
 * > argumento** + `useEffect` com deps `[]`. `npm run test:webhooks-tela` tem
 * > guarda estática sobre as duas coisas.
 *
 * ## As duas metades da restrição, e uma NÃO cobre a outra
 *
 * | # | O que precisa ser verdade | Modo de falha |
 * |---|---|---|
 * | 1 | trocar de **WEBHOOK** troca o TOKEN dentro da URL | endereço de outro webhook |
 * | 2 | trocar de **ÁREA** troca a LISTA de webhooks alcançáveis | endereço **válido**, de outra operação |
 *
 * ## ⚠️ AS DUAS METADES DA TELA TÊM ESCOPOS DIFERENTES — e isso está escrito nela
 *
 * Webhooks são **por área** (`Webhook.workspaceId`, com a Principal catch-all).
 * Credenciais de API **não são**: `listApiCredentials()` não recebe área e
 * `createApiCredential()` não grava nenhuma. Postas lado a lado sem dizer isso,
 * a tela sugere que as duas seguem a área ativa — e só uma segue.
 *
 * ⛔ Medido em 11/08/2026, **não corrigido**: os dois arquivos são anteriores a
 * `4e6aa9e` e a regra do redesign congela comportamento. O que esta tela faz é
 * **declarar** o escopo de cada metade, que é apresentação.
 */

/* ─────────────────────────── Mestre: um webhook ─────────────────────────── */

function ItemDeWebhook({
  webhook,
  agora,
  selecionado,
  alternando,
  aoSelecionar,
  aoAlternar,
}: {
  webhook: WebhookRowDTO;
  agora: Date;
  selecionado: boolean;
  alternando: boolean;
  aoSelecionar: () => void;
  aoAlternar: () => void;
}) {
  const leitura = estadoDoWebhook(webhook, agora);
  const def = gatewayDoWebhook(webhook.platform);

  return (
    <div
      className="rounded-controle"
      style={{
        border: `1px solid ${selecionado ? "var(--tk-primary)" : "var(--tk-border)"}`,
        background: selecionado ? "var(--tk-tint-primary)" : "var(--tk-surface)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 10px 10px 12px",
      }}
    >
      <button
        type="button"
        onClick={aoSelecionar}
        aria-current={selecionado}
        className="text-left"
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: 0,
          padding: 0,
          cursor: "pointer",
        }}
      >
        <LogoGateway id={webhook.platform} nome={def.nome} tamanho={30} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            className="text-label text-text"
            style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
          >
            {webhook.name}
          </span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <Badge tom={leitura.tom} ponto title={leitura.frase}>
              {leitura.rotulo}
            </Badge>
            {/* ⚠️ O total NÃO é o selo. Um webhook com 43 vendas no histórico
                pode estar recusando a próxima — o selo fala do futuro, este
                número fala do passado, e os dois são verdadeiros ao mesmo
                tempo. Colapsá-los esconderia exatamente o caso que dói. */}
            <span className="text-caption text-text-muted" style={{ fontVariantNumeric: "tabular-nums" }}>
              {webhook.eventCount.toLocaleString("pt-BR")}{" "}
              {webhook.eventCount === 1 ? "venda recebida" : "vendas recebidas"}
            </span>
          </span>
        </span>
      </button>

      {/* ⛔ O primitivo, não um `<button role="switch">` à mão. A `PixelScreen`
          rolou o dela inline e ficou com a segunda aparência de interruptor da
          base — está anotado em ACHADOS ADIADOS, e não se repete aqui. */}
      <Switch
        ligado={webhook.active}
        ocupado={alternando}
        aoMudar={aoAlternar}
        aria-label={`${webhook.active ? "Desligar" : "Ligar"} ${webhook.name}`}
      />
    </div>
  );
}

/* ───────────────────────── Detalhe: o endereço ──────────────────────────── */

function PainelDoEndereco({
  webhook,
  agora,
  copiado,
  aoCopiar,
}: {
  webhook: WebhookRowDTO;
  agora: Date;
  copiado: string | null;
  aoCopiar: (t: string, id: string) => void;
}) {
  const leitura = estadoDoWebhook(webhook, agora);
  const def = gatewayDoWebhook(webhook.platform);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      {/* O que acontece com a PRÓXIMA venda — em caixa tingida quando exige
          ação, e em texto quando é só relato. Tingir os cinco estados faria a
          cor deixar de significar alguma coisa. */}
      <div
        className="rounded-controle"
        style={
          leitura.acao
            ? {
                background: `var(--tk-tint-${leitura.tom === "neutral" ? "neutral" : leitura.tom})`,
                color: `var(--tk-on-tint-${leitura.tom === "neutral" ? "neutral" : leitura.tom})`,
                padding: "10px 12px",
              }
            : { padding: 0 }
        }
      >
        <p className={leitura.acao ? "text-caption" : "text-caption text-text-secondary"} style={{ margin: 0, lineHeight: 1.7 }}>
          {leitura.frase}
          {leitura.acao && <strong style={{ display: "block", marginTop: 4 }}>{leitura.acao}</strong>}
        </p>
      </div>

      <CampoCopiavel
        id="url"
        rotulo="Endereço do webhook"
        valor={webhook.url}
        ajuda={`É este endereço que fica colado no painel da ${def.nome}. Ele identifica esta operação — não reaproveite em outra.`}
        copiado={copiado}
        aoCopiar={aoCopiar}
      />

      {/* A chave só aparece quando é NOSSA. Quando o usuário a criou no painel
          do gateway, mostrá-la aqui não resolveria nada que ele não resolva de
          lá — e é superfície de exposição sem contrapartida. */}
      {webhook.secret !== null && (
        <CampoCopiavel
          id="chave"
          rotulo="Chave de segurança"
          valor={webhook.secret}
          ajuda={`Nós geramos esta chave. Ela vai no painel da ${def.nome}, junto do endereço acima.`}
          copiado={copiado}
          aoCopiar={aoCopiar}
        />
      )}

      <dl
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 12,
          margin: 0,
        }}
      >
        <Metadado rotulo="Gateway" valor={def.nome} />
        <Metadado
          rotulo="Chave de segurança"
          valor={
            webhook.hasSecret
              ? "Configurada"
              : def.auth.tipo === "segredo" && def.auth.exigir
                ? "Faltando"
                : "Não usa"
          }
        />
        <Metadado
          rotulo="Última venda"
          valor={webhook.lastEventAt ? <Desde quando={webhook.lastEventAt} /> : "nunca"}
        />
        <Metadado rotulo="Criado em" valor={new Date(webhook.createdAt).toLocaleDateString("pt-BR")} />
      </dl>
    </div>
  );
}

function Metadado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <dt className="text-caption text-text-muted" style={{ margin: 0 }}>
        {rotulo}
      </dt>
      <dd className="text-label text-text" style={{ margin: "2px 0 0" }}>
        {valor}
      </dd>
    </div>
  );
}

/* ───────────────────────── Detalhe: as entregas ─────────────────────────── */

/**
 * O histórico de entregas deste webhook.
 *
 * ⚠️ **`WebhookLog` não tem paginação e a retenção é do cron** (dívida técnica
 * nº 4). Esta lista não cria o problema e não pode agravá-lo: o `limit` é
 * fechado e validado no servidor (`listWebhookLogs` faz `Math.min(…, 100)`).
 */
const ENTREGAS_POR_VEZ = 25;

/**
 * ⚠️ Este componente é montado com `key={webhook.id}` — e isso NÃO é detalhe.
 *
 * A versão anterior zerava `logs` e `aberto` dentro do efeito ao trocar de
 * webhook. Além de o lint recusar (`set-state-in-effect`), havia um quadro em
 * que a lista do webhook ANTERIOR continuava na tela sob o título do novo — as
 * entregas de uma operação atribuídas a outra, que é o defeito desta tela em
 * miniatura. Remontar pela `key` torna esse quadro inexistente em vez de curto.
 */
function ListaDeEntregas({ webhook }: { webhook: WebhookRowDTO }) {
  const [logs, setLogs] = React.useState<WebhookLogDTO[] | null>(null);
  const [aberto, setAberto] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    listWebhookLogs(ENTREGAS_POR_VEZ, webhook.id)
      .then((r) => {
        if (vivo) setLogs(r);
      })
      .catch(() => {
        if (vivo) setLogs([]);
      });
    return () => {
      vivo = false;
    };
  }, [webhook.id]);

  if (logs === null) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton altura={38} />
        <Skeleton altura={38} />
        <Skeleton altura={38} />
      </div>
    );
  }

  if (logs.length === 0) {
    const texto = TEXTO_DO_VAZIO[motivoDoVazio(webhook)];
    return <EmptyState titulo={texto.titulo} causa={texto.causa} compacto />;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {logs.map((log) => {
        const desfecho = DESFECHO_DA_ENTREGA[log.status];
        const expandido = aberto === log.id;
        return (
          <div
            key={log.id}
            className="rounded-controle"
            style={{ border: "1px solid var(--tk-border)", overflow: "hidden" }}
          >
            <button
              type="button"
              onClick={() => setAberto(expandido ? null : log.id)}
              aria-expanded={expandido}
              className="tk-linha"
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                background: "none",
                border: 0,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <Badge tom={desfecho.tom} ponto title={desfecho.ajuda}>
                {desfecho.rotulo}
              </Badge>
              <span className="text-caption text-text-secondary" style={{ flex: 1, minWidth: 0 }}>
                {/* O motivo da recusa é a informação mais útil da linha, e ela
                    vem do servidor em linguagem de usuário. Sem ele a linha
                    diria "recusado" e deixaria a pessoa adivinhando. */}
                {log.message ?? "—"}
              </span>
              {log.httpStatus !== null && (
                <span
                  className="text-caption text-text-muted"
                  style={{ fontVariantNumeric: "tabular-nums", flex: "none" }}
                >
                  {log.httpStatus}
                </span>
              )}
              <span className="text-caption text-text-muted" style={{ flex: "none" }}>
                <Desde quando={log.createdAt} />
              </span>
            </button>

            {/* O payload cru é o que se manda para o suporte do gateway quando
                ele diz "eu enviei". Fica recolhido: é para o momento da
                investigação, não para a leitura normal da tela. */}
            {expandido && (
              <div style={{ padding: "0 10px 10px" }}>
                <CodigoDestacado codigo={log.payload} linguagem="json" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ⛔ ACIMA de quem o consome: `no-use-before-define` está LIGADA nesta base
   desde as 53 violações de 07/08, e a razão é TDZ — duas delas derrubaram a
   `/api/ads` com 500 de corpo vazio, com `tsc` verde nas duas. */
const EXEMPLO_DE_ENVIO = (url: string) => `POST ${url}
Authorization: Bearer SUA_CHAVE
Content-Type: application/json

{
  "transaction_id": "abc-123",
  "status": "approved",
  "value": 197.00,
  "currency": "BRL",
  "product": "Meu Produto",
  "payment_method": "pix",
  "email": "cliente@email.com",
  "name": "Fulano de Tal",
  "click_id": "opcional_para_atribuicao"
}`;

/* ─────────────────────── Credenciais de API (checkout próprio) ──────────── */

/**
 * A outra porta de entrada: o checkout do próprio usuário.
 *
 * > ### ⚠️ ESTA METADE NÃO SEGUE A ÁREA ATIVA — e a tela DIZ isso
 * > `listApiCredentials()` não recebe área e `createApiCredential()` não grava
 * > nenhuma (medido, 11/08/2026). As chaves são **da conta**, não da operação.
 * > Sem a frase, pôr esta lista ao lado dos webhooks — que são por área —
 * > sugeriria que as duas se recortam do mesmo jeito.
 * >
 * > ⛔ **Não é conserto**: os dois arquivos são anteriores a `4e6aa9e`.
 */
function BlocoDeCredenciais({
  credenciais,
  reveladas,
  copiado,
  aoCopiar,
  aoRevelar,
  aoRevogar,
  aoExcluir,
  aoCriar,
  criando,
}: {
  credenciais: ApiCredentialDTO[] | null;
  reveladas: Record<string, string>;
  copiado: string | null;
  aoCopiar: (t: string, id: string) => void;
  aoRevelar: (id: string) => void;
  aoRevogar: (id: string) => void;
  aoExcluir: (id: string) => void;
  aoCriar: () => void;
  criando: boolean;
}) {
  const ingestUrl = `${getPublicAppUrl()}/api/webhook/ingest`;
  const [copiarUrl, copiadoUrl] = useCopiar();

  return (
    <Card
      titulo="Chaves de API"
      descricao="Para quem tem checkout próprio, ou usa uma plataforma que ainda não está na lista."
      acao={
        <Button variante="secundario" carregando={criando} onClick={aoCriar}>
          Gerar chave
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
          As chaves valem para <strong>a conta inteira</strong>, não para a área de trabalho ativa —
          diferente dos webhooks ao lado.
        </p>

        {credenciais === null ? (
          <Skeleton altura={70} />
        ) : credenciais.length === 0 ? (
          <EmptyState
            titulo="Nenhuma chave criada"
            causa="Você só precisa de uma se o seu checkout foi feito sob medida. Ela é o que autoriza aquele sistema a registrar vendas na sua conta."
            compacto
          />
        ) : (
          credenciais.map((c) => {
            const revelada = reveladas[c.id];
            return (
              <div
                key={c.id}
                className="rounded-controle"
                style={{
                  border: "1px solid var(--tk-border)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="text-label text-text" style={{ flex: 1, minWidth: 0 }}>
                    {c.name}
                  </span>
                  <Badge tom={c.revoked ? "neutral" : "success"} ponto>
                    {c.revoked ? "revogada" : "ativa"}
                  </Badge>
                </div>

                {revelada ? (
                  <CampoCopiavel
                    id={`chave-${c.id}`}
                    rotulo="Chave"
                    valor={revelada}
                    copiado={copiado}
                    aoCopiar={aoCopiar}
                  />
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span
                      className="text-caption text-text-muted"
                      style={{ flex: 1, minWidth: 0, fontFamily: "var(--tk-font-mono)" }}
                    >
                      {c.keyMasked}
                    </span>
                    <Button variante="secundario" disabled={c.revoked} onClick={() => aoRevelar(c.id)}>
                      Revelar
                    </Button>
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="text-caption text-text-muted" style={{ flex: 1, minWidth: 0 }}>
                    {c.lastUsedAt ? (
                      <>
                        Último uso <Desde quando={c.lastUsedAt} />
                      </>
                    ) : (
                      "Nunca usada"
                    )}
                  </span>
                  {!c.revoked && (
                    <Button variante="fantasma" onClick={() => aoRevogar(c.id)}>
                      Revogar
                    </Button>
                  )}
                  <Button variante="fantasma" onClick={() => aoExcluir(c.id)}>
                    Excluir
                  </Button>
                </div>
              </div>
            );
          })
        )}

        {/* ⚠️ RECOLHIDO por padrão, e o texto de fora NÃO é para programador.
            Isto já esteve aberto "para encher a coluna", com POST, endpoint,
            cabeçalho e "campos tolerantes" na cara de quem lê a tela — e quem
            lê é gestor de tráfego. Quem consome o conteúdo daqui é a pessoa que
            fez o checkout dele.
            ⛔ Não reabra por padrão e não traga o jargão de volta. */}
        <details style={{ borderTop: "1px solid var(--tk-border)", paddingTop: 12 }}>
          <summary className="text-label text-text-secondary" style={{ cursor: "pointer" }}>
            O que entregar para quem cuida do seu site
          </summary>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
            <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              Você não precisa entender o que aparece aqui. Gere uma chave acima, copie os dois
              blocos e mande para quem fez o seu checkout — é o suficiente.
            </p>
            <CampoCopiavel
              id="ingest"
              rotulo="Endereço para enviar as vendas"
              valor={ingestUrl}
              copiado={copiadoUrl}
              aoCopiar={copiarUrl}
            />
            <div>
              <span className="text-label text-text-secondary" style={{ display: "block", marginBottom: 6 }}>
                Exemplo de envio
              </span>
              <CodigoDestacado codigo={EXEMPLO_DE_ENVIO(ingestUrl)} linguagem="json" />
              <p className="text-caption text-text-muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
                Os nomes dos campos aceitam as variações mais comuns, em português e em inglês.
              </p>
            </div>
          </div>
        </details>
      </div>
    </Card>
  );
}

/* ────────────────────────────────  A tela  ──────────────────────────────── */

export function WebhooksScreen({ v }: { v: TraffikView }) {
  const workspaceId = v.workspaceAtiva;

  /**
   * ⚠️ O INSTANTE VIAJA JUNTO COM A CARGA, e não num `useMemo` à parte.
   *
   * A primeira versão era `useMemo(() => new Date(), [carga])` — `carga` não
   * aparece no corpo, então a dependência era um recado para o React que o lint
   * corretamente recusou. Pior: era exatamente o tipo de esperteza que sobrevive
   * até alguém "limpar a dependência inútil" e o relógio congelar na primeira
   * montagem, sem nada acusar.
   *
   * O instante precisa ser UM por carga porque `estadoDoWebhook` compara com o
   * corte de 30 dias: com `new Date()` por item, dois webhooks da mesma lista
   * podem cair em lados opostos do corte pelos microssegundos entre eles.
   */
  const [carga, setCarga] = React.useState<{
    ws: string | null;
    webhooks: WebhookRowDTO[];
    agora: Date;
  } | null>(null);
  const [credenciais, setCredenciais] = React.useState<ApiCredentialDTO[] | null>(null);
  const [reveladas, setReveladas] = React.useState<Record<string, string>>({});
  const [selecionadoId, setSelecionadoId] = React.useState<string | null>(null);
  const [alternando, setAlternando] = React.useState<string | null>(null);
  const [gaveta, setGaveta] = React.useState<{ webhook: WebhookRowDTO | null } | null>(null);
  const [excluindo, setExcluindo] = React.useState<WebhookRowDTO | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [criandoChave, setCriandoChave] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [versao, setVersao] = React.useState(0);
  const [copiar, copiado] = useCopiar();

  /**
   * 🔴 `workspaceId` NAS DEPS — ver o cabeçalho do arquivo.
   *
   * Sem ele a tela mostraria os webhooks de OUTRA operação, com URLs válidas,
   * prontas para serem coladas no painel de um gateway.
   */
  React.useEffect(() => {
    let vivo = true;
    listWebhooks(workspaceId)
      .then((webhooks) => {
        /* ⚠️ O instante é carimbado quando a resposta CHEGA, no cliente. Nada
           aqui é renderizado no servidor com ele — quem cuida de texto relativo
           é `Desde`, que existe porque `Date.now()` no HTML do servidor aborta
           a hidratação da árvore inteira. */
        if (vivo) setCarga({ ws: workspaceId, webhooks, agora: new Date() });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [workspaceId, versao]);

  /* ⚠️ Efeito SEPARADO, e de propósito: as chaves de API não são recortadas por
     área (ver `BlocoDeCredenciais`). Juntá-las no efeito acima faria uma troca
     de área rebuscá-las sem necessidade — e, pior, sugeriria no código que elas
     dependem da área, que é a crença que a tela existe para desfazer. */
  React.useEffect(() => {
    let vivo = true;
    listApiCredentials()
      .then((c) => {
        if (vivo) setCredenciais(c);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [versao]);

  const daAreaAtual = carga !== null && carga.ws === workspaceId;
  const webhooks = daAreaAtual ? carga.webhooks : [];
  const agora = daAreaAtual ? carga.agora : new Date();

  /* A seleção é DERIVADA quando o id guardado não está mais na área: trocar de
     área não pode deixar o painel mostrando o endereço da área anterior, que é
     a forma 2 da restrição do artefato. */
  const selecionado = webhooks.find((w) => w.id === selecionadoId) ?? webhooks[0] ?? null;

  async function alternar(w: WebhookRowDTO) {
    setAlternando(w.id);
    try {
      const r = await toggleWebhook(w.id);
      setCarga((c) => (c === null ? c : { ...c, webhooks: c.webhooks.map((x) => (x.id === w.id ? r : x)) }));
    } catch {
      /* O selo não muda: a tela continua mostrando o estado do banco, e não um
         otimismo que ninguém confirmou. */
    } finally {
      setAlternando(null);
    }
  }

  async function salvar(input: { platform: string; name: string; secret: string }) {
    setSalvando(true);
    setErro(null);
    try {
      const alvo = gaveta?.webhook;
      const salvo = alvo
        ? await updateWebhook({ id: alvo.id, name: input.name, secret: input.secret })
        : // `workspaceId` só é lido na CRIAÇÃO: é aqui que o webhook nasce dono
          // de uma área, e nascer sem ela o jogaria na Principal.
          await createWebhook({ ...input, workspaceId });
      setGaveta(null);
      setSelecionadoId(salvo.id);
      setVersao((n) => n + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(w: WebhookRowDTO) {
    setExcluindo(null);
    await deleteWebhook(w.id);
    if (selecionadoId === w.id) setSelecionadoId(null);
    setVersao((n) => n + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 0.7fr) minmax(0, 1.6fr)",
          gap: "var(--tk-gap-grid)",
          /* `start`: a coluna do mestre termina onde a lista termina. Esticá-la
             empurraria o vão para DENTRO do cartão, e vão dentro de card promete
             conteúdo. */
          alignItems: "start",
        }}
      >
        <Card
          titulo="Webhooks desta área"
          descricao="Cada gateway conectado tem um endereço próprio, e ele identifica esta operação."
          acao={
            <Button variante="primario" onClick={() => setGaveta({ webhook: null })}>
              Conectar gateway
            </Button>
          }
        >
          {!daAreaAtual ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton altura={58} />
              <Skeleton altura={58} />
            </div>
          ) : webhooks.length === 0 ? (
            <EmptyState
              titulo="Nenhum gateway conectado nesta área"
              causa="Sem um webhook, as vendas do seu gateway não chegam à Trackhub: o faturamento, o ROAS e o funil ficam vazios mesmo com a campanha rodando."
              acao={{ texto: "Conectar o primeiro", aoClicar: () => setGaveta({ webhook: null }) }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {webhooks.map((w) => (
                <ItemDeWebhook
                  key={w.id}
                  webhook={w}
                  agora={agora}
                  selecionado={selecionado?.id === w.id}
                  alternando={alternando === w.id}
                  aoSelecionar={() => setSelecionadoId(w.id)}
                  aoAlternar={() => void alternar(w)}
                />
              ))}
            </div>
          )}
        </Card>

        {selecionado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
            <Card
              titulo={selecionado.name}
              descricao="O endereço que vai para o painel do gateway, e o que acontece com a próxima venda."
              acao={
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variante="secundario" onClick={() => setGaveta({ webhook: selecionado })}>
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    apenasIcone
                    aria-label={`Excluir o webhook ${selecionado.name}`}
                    onClick={() => setExcluindo(selecionado)}
                  >
                    <Icone nome="excluir" tamanho={14} />
                  </Button>
                </div>
              }
            >
              <PainelDoEndereco
                webhook={selecionado}
                agora={agora}
                copiado={copiado}
                aoCopiar={copiar}
              />
            </Card>

            <Card
              titulo="Entregas recebidas"
              descricao="Cada envio que chegou a este endereço — inclusive os que foram recusados."
            >
              <ListaDeEntregas key={selecionado.id} webhook={selecionado} />
            </Card>
          </div>
        ) : (
          daAreaAtual && (
            <Card>
              <EmptyState
                titulo="Nenhum webhook selecionado"
                causa="Conecte um gateway ao lado para ver o endereço que vai para o painel dele e as entregas que chegaram."
              />
            </Card>
          )
        )}
      </div>

      <BlocoDeCredenciais
        credenciais={credenciais}
        reveladas={reveladas}
        copiado={copiado}
        aoCopiar={copiar}
        aoRevelar={(id) => {
          void revealApiCredential(id).then((r) => setReveladas((m) => ({ ...m, [id]: r.key })));
        }}
        aoRevogar={(id) => {
          void revokeApiCredential(id).then(() => setVersao((n) => n + 1));
        }}
        aoExcluir={(id) => {
          void deleteApiCredential(id).then(() => setVersao((n) => n + 1));
        }}
        criando={criandoChave}
        aoCriar={() => {
          setCriandoChave(true);
          void createApiCredential("Chave de API")
            .then((c) => {
              /* A chave em texto puro só existe nesta resposta. Revelá-la de
                 imediato é o que evita o beco sem saída de gerar, fechar e
                 nunca mais conseguir vê-la. */
              setReveladas((m) => ({ ...m, [c.id]: c.key }));
              setVersao((n) => n + 1);
            })
            .finally(() => setCriandoChave(false));
        }}
      />

      {/* A `key` remonta a gaveta a cada abertura: sem ela, abrir o webhook B
          logo depois do A mostraria o formulário de A por um quadro — e este é
          um formulário cujo conteúdo errado vira endereço errado. */}
      {gaveta && (
        <GavetaWebhook
          key={gaveta.webhook?.id ?? "novo"}
          webhook={gaveta.webhook}
          salvando={salvando}
          erro={erro}
          aoSalvar={(input) => void salvar(input)}
          aoFechar={() => {
            setGaveta(null);
            setErro(null);
          }}
        />
      )}

      {excluindo && (
        <ConfirmarExclusao
          webhook={excluindo}
          aoCancelar={() => setExcluindo(null)}
          aoConfirmar={() => void excluir(excluindo)}
        />
      )}
    </div>
  );
}

/**
 * A confirmação nomeia o que se perde E o que NÃO se perde.
 *
 * ⚠️ Aqui o que se perde é diferente do resto da base: **o endereço deixa de
 * existir**, e ele está colado no painel de outra empresa. Quem excluir sem
 * saber disso vai ver as vendas pararem de chegar e não vai ligar uma coisa à
 * outra — o gateway continua enviando, e passa a receber 404.
 */
function ConfirmarExclusao({
  webhook,
  aoCancelar,
  aoConfirmar,
}: {
  webhook: WebhookRowDTO;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}) {
  const def = gatewayDoWebhook(webhook.platform);
  return (
    <Gaveta
      aberta
      titulo="Excluir este webhook?"
      descricao={webhook.name}
      largura={440}
      aoFechar={aoCancelar}
      rodape={
        <>
          <Button variante="secundario" onClick={aoCancelar}>
            Cancelar
          </Button>
          <Button variante="destrutivo" onClick={aoConfirmar}>
            Excluir
          </Button>
        </>
      }
    >
      <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.7 }}>
        O endereço <strong>deixa de existir</strong>. A {def.nome} vai continuar enviando para ele e
        passará a receber erro — as vendas param de chegar aqui. Tire o endereço do painel dela
        também.
      </p>
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
        Não se perde: as {webhook.eventCount.toLocaleString("pt-BR")} vendas já recebidas continuam
        na sua conta, com faturamento, funil e Gerenciador exatamente como estão.
      </p>
      {/* ⚠️ Criar outro webhook NÃO devolve o endereço: o token é novo. Sem esta
          frase, "excluo e crio de novo" parece reversível — e não é. */}
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
        Criar outro depois gera um endereço <strong>diferente</strong>: será preciso colá-lo de novo
        no painel da {def.nome}.
      </p>
    </Gaveta>
  );
}
