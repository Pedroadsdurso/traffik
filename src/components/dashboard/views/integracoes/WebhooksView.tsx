import { sx } from "@/lib/sx";
import { CampoCopiavel, Drawer } from "../../ui/Drawer";
import { Modal } from "../../ui/Modal";
import type { TraffikView } from "../../useTraffikState";

/** Gateways suportados no modal. Arquitetura pronta para novos — só a
 *  Kirvano está habilitada por enquanto (conforme o roteiro). */
const GATEWAYS: { id: string; name: string; enabled: boolean }[] = [
  { id: "KIRVANO", name: "Kirvano", enabled: true },
  { id: "HOTMART", name: "Hotmart", enabled: false },
  { id: "KIWIFY", name: "Kiwify", enabled: false },
];

/** Monograma colorido no lugar do logo do gateway. */
function GatewayBadge({ label }: { label: string }) {
  return (
    <div
      style={sx(
        "width:34px;height:34px;border-radius:9px;flex-shrink:0;display:grid;place-items:center;font-weight:700;font-size:14px;background:var(--color-accent-soft,rgba(139,92,246,.15));color:var(--color-accent,#a78bfa)",
      )}
    >
      {label.charAt(0).toUpperCase()}
    </div>
  );
}


// ─────────────────────────── Bloco esquerdo ───────────────────────────

function WebhooksBlock({ v }: { v: TraffikView }) {
  return (
    <div className="card" style={sx("display:flex;flex-direction:column;gap:var(--space-3)")}>
      <div style={sx("display:flex;align-items:flex-start;justify-content:space-between;gap:var(--space-2)")}>
        <div>
          <div className="card-kicker">Webhooks</div>
          <div className="card-title">Recebimento de vendas</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Conecte o gateway de pagamento para que as vendas cheguem à Traffik em tempo real.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={v.openWebhookModal} style={sx("white-space:nowrap")}>
          + Adicionar Webhook
        </button>
      </div>

      {v.webhooks.length === 0 ? (
        <div
          className="text-muted"
          style={sx("border:1px dashed var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-4);text-align:center;font-size:13px")}
        >
          Nenhum webhook cadastrado ainda. Clique em <strong>Adicionar Webhook</strong> para começar.
        </div>
      ) : (
        // A URL NÃO aparece aqui: a listagem mostra só o essencial e o detalhe
        // fica na gaveta de edição (padrão "revelar sob demanda").
        v.webhooks.map((w) => (
          <div
            key={w.id}
            style={sx("border:1px solid var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-3);display:flex;align-items:center;gap:10px;transition:border-color var(--dur-fast) var(--ease-out)")}
          >
            <GatewayBadge label={v.webhookPlatformLabel(w.platform)} />
            <div style={sx("min-width:0;flex:1")}>
              <div style={sx("display:flex;align-items:center;gap:8px;flex-wrap:wrap")}>
                <span className="card-title" style={sx("font-size:14px")}>{w.name}</span>
                <span className={w.active ? "tag tag-accent" : "tag tag-neutral"}>{w.active ? "Ativado" : "Desativado"}</span>
              </div>
              <div className="card-meta">
                {v.webhookPlatformLabel(w.platform)} · {w.eventCount} evento(s) recebido(s)
                {w.hasSecret ? " · token protegido" : ""}
              </div>
            </div>
            <button className="sw" role="switch" aria-checked={w.active} onClick={() => v.toggleWebhook(w.id)}
              aria-label={`${w.active ? "Desativar" : "Ativar"} ${w.name}`} />
            <button className="btn btn-secondary" type="button" onClick={() => v.openEditWebhook(w)}
              style={sx("white-space:nowrap")}>
              Editar
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => v.removeWebhook(w.id)}
              style={sx("white-space:nowrap")}>
              Remover
            </button>
          </div>
        ))
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
          <div className="card-title">Integração genérica</div>
          <p className="card-body" style={sx("margin:4px 0 0")}>
            Gere uma chave para enviar vendas de qualquer sistema, sem depender de um gateway específico.
          </p>
        </div>
        <button className="btn btn-primary" type="button" onClick={v.openCredModal} style={sx("white-space:nowrap")}>
          + Adicionar Credencial
        </button>
      </div>

      {v.apiCredentials.length === 0 ? (
        <div
          className="text-muted"
          style={sx("border:1px dashed var(--color-border);border-radius:var(--radius-md,12px);padding:var(--space-4);text-align:center;font-size:13px")}
        >
          Nenhuma credencial gerada. Crie uma para autenticar envios de venda via API.
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

      <details style={sx("border-top:1px solid var(--color-border);padding-top:var(--space-2)")}>
        <summary style={sx("cursor:pointer;font-size:13px;font-weight:600")}>Como usar</summary>
        <p className="card-body" style={sx("margin:var(--space-2) 0")}>
          Envie um <strong>POST</strong> para o endpoint abaixo com a chave no cabeçalho <code>Authorization</code>.
          Campos aceitos são tolerantes (aceita <code>value/valor/amount</code>, <code>status/situacao</code> etc.).
        </p>
        <pre
          style={sx("background:var(--color-bg,#0b0b0f);border:1px solid var(--color-border);border-radius:8px;padding:var(--space-3);font-size:11.5px;font-family:ui-monospace,monospace;overflow-x:auto;white-space:pre;margin:0")}
        >
          {payloadExample}
        </pre>
      </details>
    </div>
  );
}

// ─────────────────────────── Modais ───────────────────────────

function WebhookModal({ v }: { v: TraffikView }) {
  const editing = Boolean(v.webhookEditId);
  const filtered = GATEWAYS.filter((g) => g.name.toLowerCase().includes(v.webhookGatewaySearch.toLowerCase()));
  const selected = GATEWAYS.find((g) => g.id === v.webhookGateway);
  const emEdicao = editing ? v.webhooks.find((w) => w.id === v.webhookEditId) : null;

  return (
    <Drawer
      aberta={v.webhookModalOpen}
      onClose={v.closeWebhookModal}
      titulo={editing ? "Editar webhook" : "Adicionar Webhook"}
      descricao={
        editing
          ? "A URL abaixo é a que você cola no painel do gateway."
          : "Escolha o gateway e informe o token de segurança gerado no painel dele."
      }
      rodape={
        <>
          <button className="btn btn-secondary" type="button" onClick={v.closeWebhookModal}>Cancelar</button>
          <button className="btn btn-primary" type="button" onClick={v.saveWebhook}
            disabled={v.webhookBusy || !selected?.enabled || (!editing && !v.kirvanoToken.trim())}>
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
                <span className="opcao-logo">{g.name.charAt(0)}</span>
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

      {selected?.enabled && (
        <>
          <div className="field">
            <label>Nome (opcional)</label>
            <input className="input" value={v.kirvanoName} onChange={v.onKirvanoName}
              placeholder={`Ex.: ${selected.name} — Método Foco`} />
          </div>
          <div className="field">
            <label>Token de segurança da {selected.name}</label>
            <input className="input" value={v.kirvanoToken} onChange={v.onKirvanoToken}
              placeholder={editing ? "Deixe em branco para manter o atual" : "Cole aqui o token gerado no painel da Kirvano"} />
            <p className="text-muted" style={sx("font-size:11.5px;margin:5px 0 0;line-height:1.5")}>
              Gere o token dentro do painel da {selected.name} (você define o texto e escolhe os eventos).
              Nós validamos cada evento com esse token e geramos uma URL única para você colar lá.
            </p>
          </div>
        </>
      )}

      {/* Só na edição a URL é revelada. */}
      {emEdicao && (
        <CampoCopiavel
          label="URL do webhook"
          valor={emEdicao.url}
          dica="Cole esta URL no campo de webhook do painel do gateway. Ela é única e identifica a sua conta."
        />
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
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:var(--space-4);align-items:start")}>
        <WebhooksBlock v={v} />
        <ApiCredentialsBlock v={v} />
      </div>
      {v.webhookModalOpen && <WebhookModal v={v} />}
      {v.credModalOpen && <CredentialModal v={v} />}
    </div>
  );
}
