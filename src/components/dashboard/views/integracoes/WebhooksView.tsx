import { plural } from "@/lib/format";
import { gatewayPorId, gatewaysParaEscolher } from "@/lib/gateways/registro";
import { sx } from "@/lib/sx";
import { CampoCopiavel, Drawer } from "../../ui/Drawer";
import { LogoGateway } from "../../ui/LogoGateway";
import { Modal } from "../../ui/Modal";
import type { TraffikView } from "../../useTraffikState";

/**
 * A lista vem do REGISTRO, não daqui.
 *
 * ⚠️ Era um array local, e ele já divergia: a Cakto existia no registro com
 * parser, capacidades e instalação, e não aparecia na tela porque ninguém
 * lembrou de acrescentá-la em dois lugares. É exatamente o custo que a
 * arquitetura universal existe para eliminar — gateway novo é UMA entrada no
 * registro, e a tela se monta sozinha.
 */
const GATEWAYS = gatewaysParaEscolher().map((g) => ({ id: g.id, name: g.nome, enabled: g.ativo }));

/** Monograma colorido no lugar do logo do gateway. */


// ─────────────────────────── Bloco esquerdo ───────────────────────────

function WebhooksBlock({ v }: { v: TraffikView }) {
  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      {/* ⚠️ Sem botão de adicionar aqui: quem adiciona é o tile tracejado no fim da
          grade, como em Integrações › Anúncios. Os dois juntos seriam a mesma ação
          em dois lugares — o erro do "Editar" duplicado no card de webhook. */}
      <div>
        <div className="card-kicker">Webhooks</div>
        <div className="card-title">Recebimento de vendas</div>
        <p className="card-body" style={sx("margin:4px 0 0;max-width:70ch")}>
          Conecte o gateway de pagamento para que as vendas cheguem à Traffik em tempo real.
        </p>
      </div>

      {(
        /**
         * Cards numa grade em vez de linhas de largura total.
         *
         * As linhas jogavam nome à esquerda e três botões à extremidade oposta de
         * uma faixa de 700px, com o meio vazio; e a tela toda cabia em 200px de
         * altura num viewport de 745. Em card, cada gateway fica com a informação
         * agrupada e a largura da tela é usada de verdade.
         *
         * ⚠️ A URL continua FORA daqui: a listagem mostra nome, status e uso, e o
         * detalhe vive na gaveta de edição (padrão "revelar sob demanda").
         */
        <div style={sx("display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:var(--space-3);align-items:stretch")}>
          {/* ⚠️ `align-items:stretch` (o padrão), NÃO `start`: com `start` cada card
              fica só com a altura do próprio conteúdo, o `margin-top:auto` do rodapé
              não tem folga para empurrar, e um nome que quebra em 3 linhas desalinha
              os botões de toda a fileira. */}
          {v.webhooks.map((w) => (
            <div
              key={w.id}
              style={sx(
                "border:1px solid var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-3);" +
                  "display:flex;flex-direction:column;gap:var(--space-3);transition:border-color var(--dur-fast) var(--ease-out)",
              )}
            >
              <div style={sx("display:flex;align-items:flex-start;gap:10px")}>
                <LogoGateway id={w.platform} nome={v.webhookPlatformLabel(w.platform)} />
                <div style={sx("min-width:0;flex:1")}>
                  <div className="card-title" style={sx("font-size:14px;line-height:1.3;word-break:break-word")}>{w.name}</div>
                  <div className="card-meta">{v.webhookPlatformLabel(w.platform)}</div>
                </div>
                <span className={w.active ? "tag tag-accent" : "tag tag-neutral"} style={sx("flex:none")}>
                  {w.active ? "Ativado" : "Desativado"}
                </span>
              </div>

              <div style={sx("display:flex;flex-direction:column;gap:2px")}>
                <span style={sx("font-size:18px;font-variant-numeric:tabular-nums;line-height:1.1")}>{w.eventCount}</span>
                <span className="card-meta">
                  {plural(w.eventCount, "venda recebida", "vendas recebidas", "nenhuma venda ainda")}
                  {w.hasSecret ? " · conectado" : ""}
                </span>
              </div>

              <div style={sx("display:flex;align-items:center;gap:8px;margin-top:auto;padding-top:var(--space-2);border-top:1px solid var(--color-divider)")}>
                <button className="sw" role="switch" aria-checked={w.active} onClick={() => v.toggleWebhook(w.id)}
                  aria-label={`${w.active ? "Desativar" : "Ativar"} ${w.name}`} />
                <span style={sx("flex:1")} />
                <button className="btn btn-secondary" type="button" onClick={() => v.openEditWebhook(w)}
                  style={sx("white-space:nowrap;font-size:12px;padding:5px 10px")}>
                  Editar
                </button>
                <button className="btn btn-ghost" type="button" onClick={() => v.removeWebhook(w.id)}
                  style={sx("white-space:nowrap;font-size:12px")}>
                  Remover
                </button>
              </div>
            </div>
          ))}

          {/**
           * O tile de adicionar mora DENTRO da grade, como o "+ Adicionar perfil"
           * de Integrações › Anúncios.
           *
           * ⚠️ É o que resolve o caso de UM webhook só: sem ele, um card de 290px
           * ficava sozinho numa faixa de 1350px — exatamente o "card no canto" que
           * estamos consertando. Com o tile a fileira lê como galeria, e o estado
           * vazio deixa de precisar de um painel próprio.
           */}
          <button
            type="button"
            onClick={v.openWebhookModal}
            style={sx(
              "display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;min-height:150px;" +
                "border:1px dashed var(--color-accent);border-radius:var(--radius-md,12px);background:transparent;" +
                "color:var(--color-accent);cursor:pointer;padding:var(--space-3);text-align:center",
            )}
          >
            <span style={sx("font-size:28px;line-height:1")}>+</span>
            <span style={sx("font-size:13px")}>
              {v.webhooks.length === 0 ? "Conectar seu primeiro gateway" : "Adicionar webhook"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── Bloco direito ───────────────────────────

function ApiCredentialsBlock({ v }: { v: TraffikView }) {
  const ingestUrl = `${v.appUrl}/api/webhook/ingest`;
  const payloadExample = `POST ${ingestUrl}
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

  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Credenciais de API</div>
          <div className="card-title">Checkout próprio</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Se as suas vendas não vêm de um dos gateways ao lado, uma chave permite que o seu
            próprio sistema registre as vendas aqui.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={v.openCredModal} style={sx("white-space:nowrap")}>
          + Adicionar Credencial
        </button>
      </div>

      {v.apiCredentials.length === 0 ? (
        /* O estado vazio explica QUANDO isto serve, em linguagem normal. É o que
           ocupa a coluna de forma útil — antes essa vaga era preenchida abrindo o
           bloco de código, que é o oposto de útil para quem lê esta tela. */
        <div
          style={sx("border:1px dashed var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-4);font-size:13px;line-height:1.6")}
        >
          <strong>Nenhuma chave criada ainda.</strong>
          <div className="text-muted" style={sx("margin-top:4px")}>
            Você só precisa de uma chave se o seu checkout foi feito sob medida, ou se usa uma
            plataforma que ainda não está na lista ao lado. Ela é o que autoriza esse sistema a
            registrar vendas na sua conta.
          </div>
        </div>
      ) : (
        v.apiCredentials.map((c) => {
          const revealed = v.revealedKeys[c.id];
          return (
            <div
              key={c.id}
              style={sx("border:1px solid var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-3);display:flex;flex-direction:column;gap:var(--space-2)")}
            >
              <div style={sx("display:flex;align-items:center;gap:8px")}>
                <span className="card-title" style={sx("font-size:14px")}>{c.name}</span>
                <span className={c.revoked ? "tag tag-neutral" : "tag tag-accent"}>{c.revoked ? "Revogada" : "Ativa"}</span>
              </div>
              <div style={sx("display:flex;align-items:center;gap:8px")}>
                <input
                  className="input"
                  readOnly
                  value={revealed ?? c.keyMasked}
                  style={sx("flex:1;min-width:0;font-size:12px;font-family:ui-monospace,monospace")}
                  onFocus={(e) => e.target.select()}
                />
                {revealed ? (
                  <>
                    <button className="btn btn-secondary" type="button" onClick={() => v.copyCredKey(c.id, revealed)}>
                      {v.copiedCredId === c.id ? "Copiado!" : "Copiar"}
                    </button>
                    <button className="btn btn-ghost" type="button" onClick={() => v.hideCredential(c.id)}>Ocultar</button>
                  </>
                ) : (
                  <button className="btn btn-secondary" type="button" onClick={() => v.revealCredential(c.id)} disabled={c.revoked}>
                    Revelar
                  </button>
                )}
              </div>
              <div style={sx("display:flex;align-items:center;justify-content:space-between;gap:8px")}>
                <span className="card-meta">
                  {c.lastUsedAt ? `Último uso: ${new Date(c.lastUsedAt).toLocaleDateString("pt-BR")}` : "Nunca usada"}
                </span>
                <div style={sx("display:flex;gap:6px")}>
                  {!c.revoked && (
                    <button className="btn btn-ghost" type="button" onClick={() => v.revokeCredential(c.id)} style={sx("padding:6px 10px;font-size:12px")}>
                      Revogar
                    </button>
                  )}
                  <button className="btn btn-ghost" type="button" onClick={() => v.deleteCredential(c.id)} style={sx("padding:6px 10px;font-size:12px")}>
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/**
       * ⚠️ RECOLHIDO por padrão, e o texto de fora NÃO é para programador.
       *
       * Isto já esteve aberto quando não havia chave, "para encher a coluna", e o
       * usuário reprovou as duas coisas: um bloco de código escancarado na tela e
       * uma explicação que só um dev entenderia — falava de POST, endpoint,
       * cabeçalho Authorization e "campos tolerantes".
       *
       * Quem lê esta tela é gestor de tráfego; quem consome o conteúdo daqui é a
       * pessoa que fez o checkout dele. Então o texto de fora diz **o que fazer**
       * (gerar a chave e repassar duas coisas) e avisa que o resto pode ser
       * ignorado. O bloco técnico continua existindo porque é o que se entrega ao
       * desenvolvedor — só não é mais empurrado na cara de quem não vai usá-lo.
       *
       * ⛔ Não reabra por padrão e não traga o jargão de volta.
       */}
      <details style={sx("border-top:1px solid var(--color-border);padding-top:var(--space-2)")}>
        <summary style={sx("cursor:pointer;font-size:13px;font-weight:600")}>
          O que entregar para quem cuida do seu site
        </summary>
        <p className="card-body" style={sx("margin:var(--space-2) 0")}>
          Você não precisa entender o que aparece aqui. Gere uma chave acima, copie os dois
          blocos abaixo e mande para quem fez o seu checkout — é o suficiente para a pessoa
          ligar o seu sistema à Traffik.
        </p>

        <div className="card-kicker" style={sx("margin-bottom:4px")}>Endereço para enviar as vendas</div>
        <div style={sx("display:flex;align-items:center;gap:8px;margin-bottom:var(--space-3)")}>
          <input
            className="input"
            readOnly
            value={ingestUrl}
            style={sx("flex:1;min-width:0;font-size:12px;font-family:ui-monospace,monospace")}
            onFocus={(e) => e.target.select()}
          />
          <button className="btn btn-secondary" type="button" onClick={() => v.copyCredKey("__url__", ingestUrl)}
            style={sx("white-space:nowrap")}>
            {v.copiedCredId === "__url__" ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <div className="card-kicker" style={sx("margin-bottom:4px")}>Exemplo de como enviar</div>
        <pre
          style={sx("background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:11.5px;font-family:ui-monospace,monospace;overflow-x:auto;white-space:pre;margin:0")}
        >
          {payloadExample}
        </pre>
        <p className="text-muted" style={sx("font-size:11.5px;margin:var(--space-2) 0 0;line-height:1.5")}>
          Os nomes dos campos aceitam as variações mais comuns, em português e em inglês.
        </p>
      </details>
    </div>
  );
}

// ─────────────────────────── Modais ───────────────────────────

function WebhookModal({ v }: { v: TraffikView }) {
  const editing = Boolean(v.webhookEditId);
  const filtered = GATEWAYS.filter((g) => g.name.toLowerCase().includes(v.webhookGatewaySearch.toLowerCase()));
  const selected = GATEWAYS.find((g) => g.id === v.webhookGateway);
  const def = gatewayPorId(v.webhookGateway);
  const emEdicao = editing ? v.webhooks.find((w) => w.id === v.webhookEditId) : null;

  return (
    <Drawer
      aberta={v.webhookModalOpen}
      onClose={v.closeWebhookModal}
      titulo={editing ? "Editar webhook" : "Adicionar Webhook"}
      descricao={
        editing
          ? "A URL abaixo é a que você cola no painel do gateway."
          : def?.auth.tipo === "segredo" && def.auth.geradoPorNos
            // ⚠️ Também vem do registro: na Cakto NÓS geramos a chave, na
            // Kirvano o usuário cola a dele. Descrever um fluxo só deixaria
            // metade dos gateways com a instrução errada.
            ? "Escolha o gateway, copie a chave que geramos e siga os passos."
            : "Escolha o gateway e informe a chave de segurança gerada no painel dele."
      }
      rodape={
        <>
          <button className="btn btn-secondary" type="button" onClick={v.closeWebhookModal}>Cancelar</button>
          <button className="btn btn-primary" type="button" onClick={v.saveWebhook}
            disabled={v.webhookBusy || !selected?.enabled || (!editing && !v.gatewaySecret.trim())}>
            {v.webhookBusy ? "Salvando…" : editing ? "Salvar" : "Adicionar"}
          </button>
        </>
      }
    >
      {!editing && (
        <>
          <div className="field">
            <label>Buscar gateway</label>
            <input className="input" value={v.webhookGatewaySearch} onChange={v.onWebhookGatewaySearch}
              placeholder="Ex.: Kirvano" />
          </div>
          {/* Grade preparada para muitos gateways — hoje só a Kirvano ativa. */}
          <div className="grade-opcoes">
            {filtered.map((g) => (
              <button key={g.id} type="button" className="opcao-tile" disabled={!g.enabled}
                aria-pressed={v.webhookGateway === g.id} onClick={() => v.selectWebhookGateway(g.id)}>
                <LogoGateway id={g.id} nome={g.name} tamanho={38} />
                <span>
                  {g.name}
                  {!g.enabled && <span className="text-muted" style={sx("display:block;font-size:10.5px")}>em breve</span>}
                </span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-muted" style={sx("font-size:12.5px;grid-column:1/-1")}>Nenhum gateway encontrado.</p>
            )}
          </div>
        </>
      )}

      {/**
       * ⛔ TUDO daqui para baixo vem do REGISTRO. Nada de rótulo escrito para um
       * gateway específico — era assim antes ("Token de segurança da Kirvano",
       * "Cole aqui o token gerado no painel da Kirvano"), e é justamente o que
       * faria o décimo gateway exigir tela nova.
       */}
      {def?.ativo && (
        <>
          {def.campos.map((campo) =>
            campo.chave === "nome" ? (
              <div className="field" key={campo.chave}>
                <label>{campo.rotulo}</label>
                <input className="input" value={v.gatewayName} onChange={v.onGatewayName}
                  placeholder={`Ex.: ${def.nome} — Método Foco`} />
              </div>
            ) : campo.gerado ? (
              /**
               * 🔑 A chave é NOSSA, e o usuário precisa dela para configurar o
               * gateway (a Cakto exige o `secret` no corpo). Sem este bloco ela
               * era gerada, salva e nunca mostrada — o webhook ficava impossível
               * de configurar do outro lado.
               */
              <CampoCopiavel
                key={campo.chave}
                label={campo.rotulo}
                valor={v.gatewaySecret}
                dica={campo.ajuda}
              />
            ) : (
              <div className="field" key={campo.chave}>
                <label>{campo.rotulo}</label>
                <input className="input" value={v.gatewaySecret} onChange={v.onGatewaySecret}
                  placeholder={editing ? "Deixe em branco para manter a atual" : campo.rotulo} />
                {campo.ajuda && (
                  <p className="text-muted" style={sx("font-size:11.5px;margin:5px 0 0;line-height:1.5")}>
                    {campo.ajuda}
                  </p>
                )}
              </div>
            ),
          )}

          {/* A URL aparece já na criação quando NÓS geramos a chave: os dois
              valores são colados juntos no painel do gateway. */}
          {emEdicao ? (
            <CampoCopiavel
              label="Endereço do webhook"
              valor={emEdicao.url}
              dica="Cole no campo de webhook do painel do gateway. É único e identifica a sua conta."
            />
          ) : (
            def.campos.some((c) => c.gerado) && (
              <p className="text-muted" style={sx("font-size:11.5px;margin:0;line-height:1.5")}>
                O endereço para colar na {def.nome} aparece assim que você adicionar — ele depende do
                identificador que criamos agora.
              </p>
            )
          )}

          {def.instalacao.length > 0 && (
            <div style={sx("border-top:1px solid var(--color-divider);padding-top:var(--space-3)")}>
              <div className="card-kicker" style={sx("margin-bottom:6px")}>Como configurar na {def.nome}</div>
              <ol style={sx("margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px")}>
                {def.instalacao.map((passo) => (
                  <li key={passo.titulo} style={sx("font-size:12.5px;line-height:1.55")}>
                    <strong style={sx(passo.atencao ? "color:var(--color-warning,#fbbf24)" : "")}>
                      {passo.titulo}
                    </strong>
                    <span className="text-muted" style={sx("display:block")}>{passo.texto}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {v.webhookError && (
        <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{v.webhookError}</p>
      )}
    </Drawer>
  );
}

function CredentialModal({ v }: { v: TraffikView }) {
  return (
    <Modal
      aberta
      onClose={v.closeCredModal}
      titulo="Adicionar Credencial"
      descricao="A chave autentica envios de venda de qualquer sistema para a Traffik."
      rodape={
        v.createdCredKey ? (
          <button className="btn btn-primary" type="button" onClick={v.closeCredModal}>Concluir</button>
        ) : (
          <>
            <button className="btn btn-secondary" type="button" onClick={v.closeCredModal}>Cancelar</button>
            <button className="btn btn-primary" type="button" onClick={v.createCredential} disabled={v.credBusy}>
              {v.credBusy ? "Gerando…" : "Gerar chave"}
            </button>
          </>
        )
      }
    >



          {v.createdCredKey ? (
            <>
              <p className="card-body" style={sx("margin:0")}>
                Copie sua chave agora — por segurança, ela <strong>não será exibida novamente</strong> em texto puro (só via “Revelar”).
              </p>
              <div style={sx("display:flex;align-items:center;gap:8px")}>
                <input
                  className="input"
                  readOnly
                  value={v.createdCredKey}
                  style={sx("flex:1;min-width:0;font-size:12px;font-family:ui-monospace,monospace")}
                  onFocus={(e) => e.target.select()}
                />
                <button className="btn btn-secondary" type="button" onClick={() => v.copyCredKey("__new__", v.createdCredKey!)}>
                  {v.copiedCredId === "__new__" ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </>
          ) : (
            <div className="field">
              <label>Nome da credencial</label>
              <input className="input" value={v.newCredName} onChange={v.onNewCredName} placeholder="Ex.: Integração checkout próprio" />
            </div>
          )}
          {v.credError && (
            <p style={sx("margin:0;font-size:12.5px;color:var(--color-danger,#f87171)")}>{v.credError}</p>
          )}
    </Modal>
  );
}

// ─────────────────────────── View ───────────────────────────

export function WebhooksView({ v }: { v: TraffikView }) {
  return (
    <div style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      {/**
       * Duas colunas de peso IGUAL, cada uma com ~680px.
       *
       * ⚠️ Cheguei a dar 1,5fr aos gateways por serem o caminho principal, e ficou
       * pior: **o caso comum é UM gateway**. Num track de 1350px o card de 290px
       * ficava sozinho com 1000px de vazio ao lado — o mesmo "card no canto" que
       * estamos consertando, só menor. Com 680px cabem exatamente 2 colunas de
       * card, então 1 webhook + o tile de adicionar preenchem a fileira; com 4,
       * viram duas fileiras cheias.
       *
       * ⚠️ `minmax(0,…)` e não `1fr 1fr` puro: com `fr` puro o mínimo do track é o
       * conteúdo, e uma linha longa do `<pre>` do payload estouraria a coluna e
       * criaria rolagem horizontal na página inteira.
       *
       * Grade fixa de 2 colunas como a de Taxas e Despesas — este shell é
       * desktop-first (sidebar de 236px fixa) e não tem ponto de empilhamento.
       */}
      <div style={sx("display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:var(--space-4);align-items:start")}>
        <WebhooksBlock v={v} />
        <ApiCredentialsBlock v={v} />
      </div>
      {v.webhookModalOpen && <WebhookModal v={v} />}
      {v.credModalOpen && <CredentialModal v={v} />}
    </div>
  );
}
