import { sx } from "@/lib/sx";
import { Icone } from "../ui/Icone";
import { Select } from "../ui/Select";
import type { TraffikView } from "../useTraffikState";

/**
 * ## Por que os toggles viram LADRILHOS numa grade, e não linhas
 *
 * A tela vivia presa em 680px porque cada item era uma linha `space-between`:
 * numa coluna larga, o rótulo fica encostado à esquerda e o interruptor à
 * direita, com um metro de nada no meio — o mesmo defeito que a `FeesView`
 * corrigiu. Em grade, alargar a tela **acomoda mais itens por linha** em vez de
 * esticar o mesmo item.
 */
function Ladrilho({
  label,
  desc,
  on,
  onToggle,
}: {
  label: string;
  desc?: string;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={sx(
        "display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);" +
          "padding:var(--space-2) var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);min-width:0",
      )}
    >
      <div style={sx("min-width:0")}>
        <div style={sx("font-size:14px;font-variant-numeric:tabular-nums")}>{label}</div>
        {desc && <div className="text-muted" style={sx("font-size:12px")}>{desc}</div>}
      </div>
      <button className="sw" role="switch" aria-checked={on} onClick={onToggle} style={sx("flex:none")} />
    </div>
  );
}

/** Grade que acomoda 1, 2 ou 3 ladrilhos conforme a largura sobrando. */
const GRADE = "display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:var(--space-2)";

export function NotificationsView({ v }: { v: TraffikView }) {
  const n = v.notif;
  const nenhumAlerta = !n.notifyApprovedSale && !n.notifyPendingSale;

  return (
    <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(400px,1fr));gap:var(--space-4);align-items:start")}>
      <div className="card" style={sx("min-width:0")}>
        <div className="card-kicker">Notificações de venda</div>
        <div className="card-title">Alertas de novas vendas</div>
        <p className="card-body" style={sx("margin:4px 0 0")}>
          Chegam assim que o gateway avisa, sem esperar você abrir o painel.
        </p>

        <div style={sx(`${GRADE};margin-top:var(--space-3)`)}>
          <Ladrilho
            label="Vendas aprovadas"
            desc="Quando o pagamento é confirmado"
            on={n.notifyApprovedSale}
            onToggle={v.toggleNotifyApproved}
          />
          <Ladrilho
            label="Vendas pendentes"
            desc="Quando um Pix ou boleto é gerado"
            on={n.notifyPendingSale}
            onToggle={v.toggleNotifyPending}
          />
        </div>

        <hr className="hr" style={sx("margin:var(--space-3) 0")} />

        <div className="text-muted" style={sx("font-size:11px;text-transform:uppercase;letter-spacing:.08em")}>
          Exibir na notificação
        </div>
        <div style={sx(`${GRADE};margin-top:var(--space-2)`)}>
          <Ladrilho label="Valor da venda" on={n.showValue} onToggle={v.toggleShowValue} />
          <Ladrilho label="Nome do produto" on={n.showProductName} onToggle={v.toggleShowProduct} />
          <Ladrilho label="Campanha" on={n.showUtmCampaign} onToggle={v.toggleShowUtm} />
          <Ladrilho label="Nome do dashboard" on={n.showDashboardName} onToggle={v.toggleShowDashboard} />
        </div>

        <div style={sx("padding:var(--space-3);border-radius:var(--radius-md);background:var(--color-bg);font-size:13px;margin-top:var(--space-3)")}>
          <div className="text-muted" style={sx("font-size:11px;margin-bottom:4px")}>Prévia do alerta</div>
          <span><Icone nome="dinheiro" tamanho={16} cor="ok" /> {n.preview}</span>
        </div>

        {/* Estado real que a tela não dizia: com os dois alertas desligados, tudo
            que estiver marcado acima não aparece em lugar nenhum. */}
        {nenhumAlerta && (
          <p className="text-muted" style={sx("font-size:12px;line-height:1.5;margin:var(--space-2) 0 0")}>
            Os dois alertas estão desligados, então nenhum aviso de venda é enviado — o que estiver
            marcado acima só volta a valer quando você ligar um deles.
          </p>
        )}
      </div>

      <div className="card" style={sx("min-width:0")}>
        <div className="card-kicker">Notificações de relatório</div>
        <div className="card-title">Resumos programados</div>
        <p className="card-body" style={sx("margin:4px 0 0")}>
          Um apanhado do dia nos horários que você escolher, no seu fuso.
        </p>

        <div className="field" style={sx("max-width:280px;margin-top:var(--space-3)")}>
          <label>Padrão da notificação</label>
          <Select
            label=""
            minWidth={210}
            value={n.reportPattern}
            onChange={v.setReportPattern}
            options={[
              { value: "STATUS_LUCRO", label: "Status de Lucro" },
              { value: "RESUMO_DETALHADO", label: "Resumo Detalhado" },
              { value: "NOTIFICACOES_CRIATIVAS", label: "Notificações Criativas" },
            ]}
          />
        </div>

        <div style={sx(`${GRADE};margin-top:var(--space-3)`)}>
          {v.reports.map((rp) => (
            <Ladrilho key={rp.time} label={`Resumo às ${rp.time}`} on={rp.on} onToggle={rp.toggle} />
          ))}
        </div>
      </div>
    </div>
  );
}
