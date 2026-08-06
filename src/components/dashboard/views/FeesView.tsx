"use client";

import { useCallback, useEffect, useState, useTransition } from "react";

import { getImpostoAnuncios, setImpostoAnuncios, setMyTimezone } from "@/lib/actions/profile";
import { CONFIG } from "@/lib/explicacoes";
import { faltamTaxas } from "@/lib/areas/taxas";
import { sx } from "@/lib/sx";
import { TODAS_AS_FORMAS } from "@/lib/financeiro";
import { Icone } from "../ui/Icone";
import { Select } from "../ui/Select";
import { InfoTip } from "../ui/InfoTip";
import { TIMEZONE_OPTIONS, fusosDiscordam, partsInTz } from "@/lib/timezone";
import type { TraffikView } from "../useTraffikState";

/**
 * Fuso de referência da conta. Fica aqui porque esta é a tela de configuração
 * que já existe (taxas, impostos, despesas) e o fuso é da mesma natureza: um
 * parâmetro que muda como todo número do produto é calculado.
 *
 * Mostra a hora atual no fuso escolhido — é a única forma de o usuário conferir
 * que acertou sem esperar o dashboard virar o dia.
 */
/**
 * Imposto sobre o GASTO com anúncios.
 *
 * 🔴 A Meta reporta o gasto LÍQUIDO: o tributo que incide sobre o anúncio nunca
 * chega no número que a ferramenta recebe. Sem esta linha o lucro sai
 * sistematicamente maior que a realidade, por uma fração fixa do investimento —
 * e o número continua plausível, que é o que torna o erro caro.
 *
 * ⚠️ Fica aqui e NÃO no bloco de impostos: lá a base é o faturamento. Misturar
 * as duas faria a alíquota certa incidir sobre o número errado.
 */
function CardImpostoAnuncios() {
  const [ativo, setAtivo] = useState(false);
  const [pct, setPct] = useState("12");
  const [erro, setErro] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const carregar = useCallback(() => {
    void getImpostoAnuncios().then((r) => {
      setAtivo(r.ativo);
      setPct(String(r.pct).replace(".", ","));
    });
  }, []);
  useEffect(carregar, [carregar]);

  function salvar(novoAtivo: boolean, novoPct: string) {
    const n = Number(novoPct.replace(",", "."));
    setErro(null);
    iniciar(async () => {
      const r = await setImpostoAnuncios(novoAtivo, Number.isFinite(n) ? n : 0);
      if (!r.ok) {
        setErro(r.error ?? "Não foi possível salvar.");
        return;
      }
      // O lucro é calculado no servidor: recarregar é o caminho honesto de
      // repintar os cards com a alíquota nova, igual ao card de fuso.
      setTimeout(() => window.location.reload(), 400);
    });
  }

  return (
    <div className="card elev-sm">
      <div className="card-kicker">Imposto sobre anúncios</div>
      <div className="card-title">O que a Meta cobra além do gasto</div>
      <p className="text-muted" style={sx("font-size:12px;margin-top:var(--space-2);line-height:1.5")}>
        O Gerenciador do Facebook mostra o valor do anúncio sem o imposto que incide
        sobre ele. Ligue aqui para que o seu lucro já venha com esse custo descontado.
      </p>

      <label style={sx("display:flex;align-items:center;gap:8px;margin-top:var(--space-3);cursor:pointer")}>
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => { setAtivo(e.target.checked); salvar(e.target.checked, pct); }}
        />
        <span style={sx("font-size:13px")}>Descontar imposto do gasto com anúncios</span>
      </label>

      {ativo && (
        <div style={sx("display:flex;gap:8px;align-items:center;margin-top:var(--space-3)")}>
          <input
            className="input"
            style={sx("max-width:120px")}
            value={pct}
            inputMode="decimal"
            onChange={(e) => setPct(e.target.value)}
            onBlur={() => salvar(true, pct)}
            aria-label="Alíquota em porcentagem"
          />
          <span className="text-muted" style={sx("font-size:12px")}>% sobre o gasto</span>
        </div>
      )}

      <p className="text-muted" style={sx("font-size:11.5px;margin-top:var(--space-3);line-height:1.5")}>
        {/* ⚠️ Não afirmamos que 12% é a alíquota DELE: ela varia com o município
            e com o regime. Dizer "é 12%" produziria um lucro errado com cara de
            conferido. */}
        No Brasil costuma ficar perto de 12%, somando as parcelas. Confirme com quem
        cuida da sua contabilidade — o valor certo depende da sua cidade e do seu regime.
      </p>

      {erro && (
        <p style={sx("font-size:12px;margin-top:var(--space-2);color:var(--color-danger,#f87171)")}>{erro}</p>
      )}
    </div>
  );
}

/**
 * # 🔴 O fuso da conta cai no padrão EM SILÊNCIO — e este card é quem denuncia
 *
 * `User.timezone` é `@default("America/Sao_Paulo")` e **não é nulo nunca**. Então
 * "escolhi Brasília" e "nunca abri esta tela" são **indistinguíveis no banco**,
 * e quem se cadastra em Lisboa começa com o dia virando 4h cedo. O fuso não
 * afeta um número: afeta a janela do período, `byHour`, `byDay`, os buckets do
 * gráfico, os deltas, o `time_range` mandado à Meta, o limite diário do motor de
 * regras e a hora do relatório. É sistemático, não intermitente.
 *
 * `getUserTimezone` já grita no log nos dois casos de DEFEITO (string corrompida,
 * falha de leitura). Mas o caso que importa não é defeito — é o **padrão**, e
 * log de servidor não é lido por quem usa a ferramenta.
 *
 * Quem sabe a resposta é o navegador. O aviso compara o fuso da conta com o do
 * aparelho e oferece a troca em um clique.
 *
 * > ### ⚠️ Comparar por OFFSET, e o aviso é DISPENSÁVEL
 * > Quem opera um negócio brasileiro morando fora tem razão de manter Brasília —
 * > o aviso não pode virar cobrança. E `fusosDiscordam` compara deslocamento, não
 * > nome, senão `America/Bahia` alarmaria sem nenhum número mudar.
 *
 * ⚠️ A leitura do navegador acontece em `useEffect`, nunca no render: o servidor
 * não conhece o fuso do aparelho, e ler no primeiro render daria divergência de
 * hidratação.
 */
function CardFusoHorario({ inicial }: { inicial: string }) {
  const [tz, setTz] = useState(inicial);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [tzAparelho, setTzAparelho] = useState<string | null>(null);
  const [dispensado, setDispensado] = useState(true);

  useEffect(() => {
    let doAparelho: string | undefined;
    try {
      doAparelho = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      // Sem `Intl` utilizável não há o que comparar — e um card de configuração
      // não é lugar de reclamar do navegador.
      return;
    }
    if (!doAparelho) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura de sistema EXTERNO (Intl + localStorage), que o servidor não conhece: ler no render daria divergência de hidratação. É o caso que a doc do React permite.
    setTzAparelho(doAparelho);
    setDispensado(localStorage.getItem(`tk.fuso.dispensado.${doAparelho}`) === "1");
  }, []);

  // Preferência de TELA, por fuso de aparelho: quem dispensou em Lisboa e depois
  // abre em São Paulo merece ver o aviso de novo. Não vai para o banco.
  function dispensar() {
    if (tzAparelho) localStorage.setItem(`tk.fuso.dispensado.${tzAparelho}`, "1");
    setDispensado(true);
  }

  const divergente = tzAparelho != null && !dispensado && fusosDiscordam(tz, tzAparelho);
  // Só a função de transição é usada; o estado "pendente" não é exibido —
  // quem dá o retorno visual é a mensagem "Salvo — recarregando os dados…".
  const [, iniciar] = useTransition();

  const p = partsInTz(new Date(), tz);
  const agora = `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`;
  const dia = `${String(p.day).padStart(2, "0")}/${String(p.month).padStart(2, "0")}`;

  function aplicar(valor: string) {
    setTz(valor);
    setErro(null);
    setSalvo(false);
    iniciar(async () => {
      const r = await setMyTimezone(valor);
      if (r.ok) {
        setSalvo(true);
        // Os dados do dashboard são buscados no servidor com o fuso ANTIGO;
        // recarregar é o caminho honesto de repintar tudo com o novo.
        setTimeout(() => window.location.reload(), 600);
      } else {
        setErro(r.error ?? "Não foi possível salvar.");
        setTz(inicial);
      }
    });
  }

  return (
    <div className="card elev-sm">
      <div className="card-kicker" style={sx("display:flex;align-items:center;gap:4px")}>
        Fuso horário
        <InfoTip conteudo={CONFIG.fusoHorario!} tamanho={12} />
      </div>
      <div className="card-title">Referência de dia e hora</div>
      <p className="text-muted" style={sx("font-size:12px;margin-top:var(--space-2);line-height:1.5")}>
        Define onde o dia começa e termina em todos os relatórios — dashboard, vendas
        por horário, vendas por dia e os filtros de período.
      </p>
      <div style={sx("margin-top:var(--space-3)")}>
        <Select
          label=""
          minWidth={260}
          value={tz}
          onChange={aplicar}
          options={[
            // Um fuso salvo fora da lista (via API) continua selecionável.
            ...(TIMEZONE_OPTIONS.some((o) => o.value === tz) ? [] : [{ value: tz, label: tz }]),
            ...TIMEZONE_OPTIONS,
          ]}
        />
      </div>
      <div style={sx("display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-2);font-size:12px")}>
        <span className="text-muted">Agora neste fuso</span>
        <span style={sx("font-variant-numeric:tabular-nums")}>{dia} · {agora}</span>
      </div>
      {divergente && (
        <div
          style={sx(
            "margin-top:var(--space-3);padding:var(--space-3);border-radius:var(--radius-md);" +
              "background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.28);font-size:12px;line-height:1.5",
          )}
        >
          <strong style={sx("display:block;margin-bottom:4px")}>
            Este aparelho está em outro fuso
          </strong>
          <span className="text-muted">
            Seus relatórios usam <strong>{tz}</strong>, mas este computador está em{" "}
            <strong>{tzAparelho}</strong>. Como o fuso decide onde o dia começa, as vendas
            das últimas horas podem aparecer no dia seguinte — e o mesmo vale para vendas
            por horário e para os filtros de período.
          </span>
          <div style={sx("display:flex;gap:var(--space-2);margin-top:var(--space-3);flex-wrap:wrap")}>
            <button className="btn btn-sm" type="button" onClick={() => aplicar(tzAparelho!)}>
              Usar {tzAparelho}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={dispensar}>
              Manter {tz}
            </button>
          </div>
        </div>
      )}
      {salvo && !erro && (
        <div style={sx("font-size:12px;color:var(--color-accent-300);margin-top:var(--space-2)")}>
          Salvo — recarregando os dados…
        </div>
      )}
      {erro && <div style={sx("font-size:12px;color:var(--color-danger, #f87171);margin-top:var(--space-2)")}>{erro}</div>}
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button className="btn btn-ghost btn-icon" type="button" onClick={onClick} aria-label="Remover">
      <Icone nome="erro" tamanho={14} />
    </button>
  );
}

/**
 * Formulário de "adicionar" no rodapé de cada card de custo.
 *
 * ⚠️ **Embrulha, não estica.** Estas três linhas eram `display:flex` rígido numa
 * coluna de ~1050px: o campo de nome ganhava mil pixels de largura para receber
 * "Simples Nacional" e o botão ia para o outro lado da tela. Com `flex-wrap` e
 * `flex:1 1 140px` os campos ficam lado a lado enquanto couber e **quebram em
 * linhas** quando o card é estreito — sem media query e sem largura fixa em px,
 * que é o que fazia o layout depender do tamanho da janela.
 *
 * Cada filho precisa de `min-width:0`, senão o conteúdo define o mínimo do item
 * flex e o `wrap` nunca acontece: a linha estoura o card.
 */
function FormAdicionar({ children, acao }: { children: React.ReactNode; acao: React.ReactNode }) {
  return (
    <div
      style={sx(
        "display:flex;flex-wrap:wrap;align-items:flex-end;gap:var(--space-2);margin-top:var(--space-3);" +
          "padding-top:var(--space-3);border-top:1px solid var(--color-divider)",
      )}
    >
      {children}
      <div style={sx("flex:0 0 auto;margin-left:auto")}>{acao}</div>
    </div>
  );
}

/** Campo do `FormAdicionar` — encapsula o `flex:1 1 140px;min-width:0`. */
function CampoForm({ children }: { children: React.ReactNode }) {
  return <div style={sx("flex:1 1 140px;min-width:0")}>{children}</div>;
}


/** O período de cada frequência, na voz do usuário. `UNICA` não tem sufixo. */
const SUFIXO_FREQ: Record<string, string> = {
  DIARIA: "/dia",
  SEMANAL: "/semana",
  MENSAL: "/mês",
  ANUAL: "/ano",
  UNICA: "",
};

export function FeesView({ v }: { v: TraffikView }) {
  /**
   * 🐛 Os campos do formulário vivem AQUI, não no `useTraffikState`.
   *
   * Eles moravam no hook global, provido por contexto ao dashboard inteiro:
   * cada tecla re-renderizava a árvore toda (gráficos incluídos) e, com input
   * controlado, o teclado corria mais rápido que o re-render — digitar uma frase
   * deixava o campo VAZIO.
   *
   * ⚠️ Campo de formulário não deve morar naquele hook. Lá vai dado do servidor
   * e estado compartilhado entre telas, não digitação.
   */
  const [gatewayMetodo, setGatewayMetodo] = useState("PIX");
  const [gatewayPct, setGatewayPct] = useState("");
  const [taxNome, setTaxNome] = useState("");
  const [taxPct, setTaxPct] = useState("");
  const [coprodNome, setCoprodNome] = useState("");
  const [coprodCalc, setCoprodCalc] = useState<"PERCENTUAL" | "FIXO">("PERCENTUAL");
  const [coprodPct, setCoprodPct] = useState("");
  const [gatewayNome, setGatewayNome] = useState("");
  /**
   * Modo de cobrança da taxa de gateway.
   *
   * ⚠️ Só dois aqui — "R$ por mês" é assinatura, não taxa de venda, e mora no
   * card de custos fixos. Oferecer os três no mesmo lugar convidaria a cadastrar
   * a mensalidade da ferramenta como taxa por venda.
   */
  const [gatewayCalc, setGatewayCalc] = useState<"PERCENTUAL" | "FIXO">("PERCENTUAL");
  const [custoNome, setCustoNome] = useState("");
  const [custoCalc, setCustoCalc] = useState<"PERCENTUAL" | "FIXO">("PERCENTUAL");
  const [custoPct, setCustoPct] = useState("");
  const [despesaNome, setDespesaNome] = useState("");
  const [despesaValor, setDespesaValor] = useState("");

  /**
   * 🔴 AVISO QUE TORNA VISÍVEL A FALHA DA TAXA POR ÁREA.
   *
   * Com taxas isoladas por área (decisão de 30/07/2026), esquecer de cadastrar o
   * imposto ou a taxa do gateway numa área faz o lucro dela aparecer **maior do
   * que é** — e o número continua plausível, então nada denuncia. Este aviso é o
   * que denuncia. **Não remova sem antes reintroduzir a taxa global.**
   */
  const faltando = faltamTaxas([
    ...(v.gatewayExpenses.length ? ["TAXA_GATEWAY"] : []),
    ...(v.taxExpenses.length ? ["IMPOSTO"] : []),
    ...(v.coproducaoExpenses.length ? ["COPRODUCAO"] : []),
    ...(v.custoProdutoExpenses.length ? ["CUSTO_PRODUTO"] : []),
  ]);


  return (
    /**
     * ⚠️ `minmax(0,1fr)` e não `1fr`: com `1fr` puro a coluna esquerda tem largura
     * mínima automática = o conteúdo mais largo, então uma despesa de nome comprido
     * empurrava a sidebar de 320px para fora e criava rolagem horizontal.
     */
    <div style={sx("display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:var(--space-4);align-items:start")}>

      {faltando.length > 0 && (
        <div
          className="card"
          style={sx(
            "grid-column:1/-1;display:flex;gap:10px;align-items:flex-start;" +
              "border-left:3px solid #f59e0b;background:color-mix(in srgb, #f59e0b 7%, var(--color-surface))",
          )}
        >
          <Icone nome="aviso" tamanho={17} cor="aviso" />
          <div style={sx("font-size:13px;line-height:1.55")}>
            <strong>
              Esta área não tem {faltando.join(" nem ")} cadastrad{faltando.length > 1 ? "os" : "o"}.
            </strong>
            <div className="text-muted" style={sx("margin-top:3px")}>
              O lucro que aparece no painel desta operação está <strong>maior do que a
              realidade</strong>, porque esse custo não está sendo descontado. Cada área tem as
              suas próprias taxas — cadastre {faltando.length > 1 ? "as duas" : "essa"} aqui.
            </div>
          </div>
        </div>
      )}
      {/* Os três cards de custo lado a lado. Antes era uma coluna empilhada de
          1050px de largura — cada card ocupava a linha inteira para mostrar duas
          colunas de texto, e sobrava um metro de vazio no meio de cada linha. */}
      <div style={sx("display:grid;grid-template-columns:repeat(auto-fit,minmax(275px,1fr));gap:var(--space-4);align-items:start")}>
        <div className="card">
          <div className="card-kicker">Gateways de pagamento</div>
          <div className="card-title">Taxas por forma de pagamento</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.gatewayExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px;line-height:1.5")}>
                Nenhuma taxa cadastrada — o que o gateway cobra não está saindo do seu
                Faturamento Líquido, então ele aparece maior do que é. Cadastre abaixo uma taxa
                por forma de pagamento.
                <br />
                Gateway que informa a taxa em cada venda já entra sozinho; a taxa daqui cobre as
                vendas em que ele não informa.
                <br />
                Cobre em <strong>% por venda</strong> ou em <strong>R$ por venda</strong> — a
                segunda é contada uma vez por compra, mesmo quando ela tem order bump.
              </div>
            )}
            {v.gatewayExpenses.map((g) => (
              <div key={g.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{g.name} <span className="text-muted">· {g.methodLabel}</span></span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={g.amountStr} onChange={g.onChange} onBlur={g.commit} inputMode="decimal" />
                  <span className="text-muted">{g.unit}</span>
                  <RemoveBtn onClick={g.remove} />
                </div>
              </div>
            ))}
            <FormAdicionar
              acao={
                <button className="btn btn-secondary" type="button" disabled={!gatewayPct.trim()}
                  onClick={() =>
                    void v
                      .addGateway(gatewayMetodo, gatewayPct, gatewayCalc, gatewayNome)
                      .then(() => { setGatewayPct(""); setGatewayNome(""); })
                  }>
                  Adicionar taxa
                </button>
              }
            >
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Nome (ex.: Cakto Pix)"
                  value={gatewayNome} onChange={(e) => setGatewayNome(e.target.value)} />
              </CampoForm>
              <CampoForm>
                <Select
                  label=""
                  minWidth={0}
                  value={gatewayCalc}
                  onChange={(m) => setGatewayCalc(m as "PERCENTUAL" | "FIXO")}
                  options={[
                    { value: "PERCENTUAL", label: "% por venda" },
                    { value: "FIXO", label: "R$ por venda" },
                  ]}
                />
              </CampoForm>
              <CampoForm>
                <Select
                  label=""
                  minWidth={0}
                  value={gatewayMetodo}
                  onChange={setGatewayMetodo}
                  options={[
                    { value: "PIX", label: "Pix" },
                    { value: "CARTAO", label: "Cartão" },
                    { value: "BOLETO", label: "Boleto" },
                    { value: "OUTRO", label: "Outro" },
                    /*
                      🔴 "Todas" era `OUTRO` — e `OUTRO` e uma forma de
                      pagamento REAL do enum, nao um coringa. A taxa marcada
                      como "Todas" incidia so sobre as vendas classificadas
                      como "Outro".
                      O sentinela vira `paymentMethod: null`, que o
                      `financeiro.ts` ja trata como "sobre o faturamento
                      inteiro" — o caminho existia e a tela nao tinha como
                      produzi-lo.
                    */
                    { value: TODAS_AS_FORMAS, label: "Todas as formas" },
                  ]}
                />
              </CampoForm>
              <CampoForm>
                <input className="input" style={sx("width:100%")}
                  placeholder={gatewayCalc === "PERCENTUAL" ? "% da taxa" : "R$ por venda"}
                  value={gatewayPct} onChange={(e) => setGatewayPct(e.target.value)} inputMode="decimal" />
              </CampoForm>
            </FormAdicionar>
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Impostos</div>
          <div className="card-title">Alíquotas sobre o faturamento</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.taxExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px;line-height:1.5")}>
                Nenhum imposto cadastrado — o Faturamento Líquido está sendo calculado como se
                você não pagasse nenhum. Cadastre abaixo a alíquota que incide sobre o seu
                faturamento.
              </div>
            )}
            {v.taxExpenses.map((t) => (
              <div key={t.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{t.name}</span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={t.amountStr} onChange={t.onChange} onBlur={t.commit} inputMode="decimal" />
                  <span className="text-muted">%</span>
                  <RemoveBtn onClick={t.remove} />
                </div>
              </div>
            ))}
            <FormAdicionar
              acao={
                <button className="btn btn-secondary" type="button" disabled={!taxNome.trim() || !taxPct.trim()}
                  onClick={() => void v.addTax(taxNome, taxPct).then(() => { setTaxNome(""); setTaxPct(""); })}>
                  Adicionar imposto
                </button>
              }
            >
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Nome (ex.: Simples Nacional)" value={taxNome} onChange={(e) => setTaxNome(e.target.value)} />
              </CampoForm>
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="% da alíquota" value={taxPct} onChange={(e) => setTaxPct(e.target.value)} inputMode="decimal" />
              </CampoForm>
            </FormAdicionar>
          </div>
        </div>

        {/* Os dois descontos que faltavam para o Faturamento Líquido ser honesto.
            São PERCENTUAIS sobre o faturamento, como o imposto. */}
        <div className="card">
          <div className="card-kicker">Coprodução e afiliados</div>
          <div className="card-title">Comissões sobre a venda</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.coproducaoExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px;line-height:1.5")}>
                Nenhuma comissão cadastrada. Se você divide a venda com coprodutor ou afiliado,
                essa parte ainda está contando como sua — cadastre abaixo o percentual que sai
                para eles.
              </div>
            )}
            {v.coproducaoExpenses.map((c) => (
              <div key={c.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{c.name}</span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={c.amountStr} onChange={c.onChange} onBlur={c.commit} inputMode="decimal" />
                  {/* Sufixo vindo do `calc` gravado — ver a nota em useTraffikState. */}
                  <span className="text-muted" style={sx("font-size:12px")}>{c.unidade}</span>
                  <RemoveBtn onClick={c.remove} />
                </div>
              </div>
            ))}
            <FormAdicionar
              acao={
                <button className="btn btn-secondary" type="button" disabled={!coprodPct.trim()}
                  onClick={() => void v.addCoproducao(coprodNome, coprodPct, coprodCalc).then(() => { setCoprodNome(""); setCoprodPct(""); })}>
                  Adicionar comissão
                </button>
              }
            >
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Nome (ex.: Afiliado João)" value={coprodNome} onChange={(e) => setCoprodNome(e.target.value)} />
              </CampoForm>
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder={coprodCalc === "PERCENTUAL" ? "% da comissão" : "R$ por venda"} value={coprodPct} onChange={(e) => setCoprodPct(e.target.value)} inputMode="decimal" />
              </CampoForm>
              <CampoForm>
                <Select label="" minWidth={150} value={coprodCalc} onChange={(x) => setCoprodCalc(x as "PERCENTUAL" | "FIXO")}
                  options={[{ value: "PERCENTUAL", label: "% por venda" }, { value: "FIXO", label: "R$ por venda" }]} />
              </CampoForm>
            </FormAdicionar>
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Custo de produto</div>
          <div className="card-title">Custo por venda realizada</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.custoProdutoExpenses.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px;line-height:1.5")}>
                Nenhum custo cadastrado. Se cada venda tem um custo seu — impressão, envio,
                plataforma de aulas —, ele ainda não está saindo do lucro. Produto 100% digital
                sem custo por venda pode deixar em branco.
              </div>
            )}
            {v.custoProdutoExpenses.map((c) => (
              <div key={c.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3)")}>
                <span style={sx("font-size:14px")}>{c.name}</span>
                <div style={sx("display:flex;align-items:center;gap:6px")}>
                  <input className="input" style={sx("width:80px;text-align:right")} value={c.amountStr} onChange={c.onChange} onBlur={c.commit} inputMode="decimal" />
                  {/* Sufixo vindo do `calc` gravado — ver a nota em useTraffikState. */}
                  <span className="text-muted" style={sx("font-size:12px")}>{c.unidade}</span>
                  <RemoveBtn onClick={c.remove} />
                </div>
              </div>
            ))}
            <FormAdicionar
              acao={
                <button className="btn btn-secondary" type="button" disabled={!custoPct.trim()}
                  onClick={() => void v.addCustoProduto(custoNome, custoPct, custoCalc).then(() => { setCustoNome(""); setCustoPct(""); })}>
                  Adicionar custo
                </button>
              }
            >
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Nome (ex.: Impressão + envio)" value={custoNome} onChange={(e) => setCustoNome(e.target.value)} />
              </CampoForm>
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder={custoCalc === "PERCENTUAL" ? "% do faturamento" : "R$ por venda"} value={custoPct} onChange={(e) => setCustoPct(e.target.value)} inputMode="decimal" />
              </CampoForm>
              <CampoForm>
                {/* Produto físico paga por unidade, não por percentual — ver a
                    nota em `addCustoProduto`. */}
                <Select label="" minWidth={150} value={custoCalc} onChange={(x) => setCustoCalc(x as "PERCENTUAL" | "FIXO")}
                  options={[{ value: "PERCENTUAL", label: "% do faturamento" }, { value: "FIXO", label: "R$ por venda" }]} />
              </CampoForm>
            </FormAdicionar>
          </div>
        </div>

        <div className="card">
          <div className="card-kicker">Despesas recorrentes</div>
          <div className="card-title">Custos fixos por mês</div>
          <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-3)")}>
            {v.despesaRows.length === 0 && (
              <div className="text-muted" style={sx("font-size:13px;line-height:1.5")}>
                Nenhuma despesa cadastrada. Custos fixos do mês — ferramentas, equipe, aluguel —
                entram no <strong>Lucro</strong>, depois do gasto com anúncios. Sem eles, o lucro
                do painel aparece maior do que é.
              </div>
            )}
            {v.despesaRows.map((d) => (
              <div key={d.id} style={sx("display:flex;align-items:center;justify-content:space-between;gap:var(--space-3);padding:var(--space-2) 0")}>
                <span style={sx("font-size:14px;min-width:0")}>
                  {d.name}
                  {/* 🔴 O MARCADOR É OBRIGATÓRIO, e é aqui que ele nasce: esta é a
                      tela onde a pessoa CADASTRA. Despesa única não tem data de
                      ocorrência no schema, então não há período em que somá-la —
                      ela fica fora do cálculo do lucro. Sem dizer aqui, o usuário
                      cadastra um custo, vê a linha na lista e conclui que ele
                      está sendo contado. */}
                  {d.foraDoCalculo && (
                    <span
                      style={sx("margin-left:8px;font-size:11px;color:var(--color-accent-300)")}
                      title="Despesa única não tem data de ocorrência, então não dá para saber em que período ela entra. Ela não é somada ao custo nem ao break-even."
                    >
                      fora do cálculo
                    </span>
                  )}
                </span>
                <div style={sx("display:flex;align-items:center;gap:10px")}>
                  {/* ⚠️ Era `/mês` FIXO em toda linha — inclusive nas anuais e nas
                      diárias. O sufixo mentia sobre a frequência que a própria
                      tela deixa cadastrar, e agora que o rateio a respeita a
                      mentira ficaria visível no número. */}
                  <span style={sx("font-variant-numeric:tabular-nums")}>
                    {d.valueLabel}{SUFIXO_FREQ[d.recurrence] ?? ""}
                  </span>
                  <RemoveBtn onClick={d.remove} />
                </div>
              </div>
            ))}
            {/* Só a despesa recorrente oferece a escolha de área. Taxa de gateway e
                imposto são globais por natureza — uma caixa neles convidaria a
                prender a uma área justamente o que, se prendido, sumiria da
                conta de lucro das outras em silêncio. */}
            <FormAdicionar
              acao={
                <button className="btn btn-secondary" type="button" disabled={!despesaNome.trim() || !despesaValor.trim()}
                  onClick={() => void v.addDespesa(despesaNome, despesaValor).then(() => { setDespesaNome(""); setDespesaValor(""); })}>
                  Adicionar despesa
                </button>
              }
            >
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Nome da despesa" value={despesaNome} onChange={(e) => setDespesaNome(e.target.value)} />
              </CampoForm>
              <CampoForm>
                <input className="input" style={sx("width:100%")} placeholder="Valor por mês (R$)" value={despesaValor} onChange={(e) => setDespesaValor(e.target.value)} inputMode="decimal" />
              </CampoForm>
            </FormAdicionar>
          </div>
        </div>
      </div>

      <div style={sx("display:flex;flex-direction:column;gap:var(--space-4);position:sticky;top:var(--space-4)")}>
      <CardFusoHorario inicial={v.timezone} />
      <CardImpostoAnuncios />

      <div className="card elev-sm">
        <div className="card-kicker">Cálculo de lucro (período atual)</div>
        <div style={sx("display:flex;flex-direction:column;gap:var(--space-2);margin-top:var(--space-2);font-size:13px")}>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Faturamento</span><span style={sx("font-variant-numeric:tabular-nums")}>{v.finance.revenue}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Taxas de gateway</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.gateway}</span></div>
          {/*
            🔴 Coprodução e Custo de produto FALTAVAM. Com qualquer um dos dois
            cadastrado, o painel descontava (a conta é a mesma do servidor) e
            não mostrava a linha — a soma deixava de fechar visualmente e o
            usuário não tinha como conferir o próprio lucro.

            ⚠️ Só aparecem quando há valor: quatro linhas zeradas empurrariam o
            Lucro para fora da vista de quem não usa coprodução.
          */}
          {v.finance.temCoproducao && (
            <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Coprodução e afiliados</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.coproducao}</span></div>
          )}
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Impostos</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.tax}</span></div>
          {v.finance.temCustoProduto && (
            <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Custo de produto</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.custoProduto}</span></div>
          )}
          {/* O líquido é o corte: até aqui só desconto sobre o faturamento. */}
          <div style={sx("display:flex;justify-content:space-between;padding-top:4px;border-top:1px dashed var(--color-divider)")}><span>Faturamento líquido</span><span style={sx("font-variant-numeric:tabular-nums")}>{v.finance.liquido}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Gasto em anúncios</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.spend}</span></div>
          {/* Linha só aparece quando há valor — igual a coprodução e custo de
              produto. Uma linha "− R$ 0,00" permanente é ruído. */}
          {v.finance.temImpostoAnuncios && (
            <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Imposto sobre anúncios</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.impostoAnuncios}</span></div>
          )}
          {/*
            🔴 Esta linha aparecia e NAO era subtraida: o painel calculava
            `revenue − spend − expenses.total`, e `expenses.total` exclui as
            despesas recorrentes. Só não aparecia para quem tinha despesa zero.
          */}
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Despesas recorrentes</span><span style={sx("font-variant-numeric:tabular-nums")}>− {v.finance.despesas}</span></div>
          <hr className="hr" style={sx("margin:var(--space-2) 0")} />
          <div style={sx("display:flex;justify-content:space-between;font-size:15px")}><span>Lucro</span><span style={sx("color:var(--color-accent-300);font-variant-numeric:tabular-nums")}>{v.finance.profit}</span></div>
          <div style={sx("display:flex;justify-content:space-between")}><span className="text-muted">Margem de lucro</span><span style={sx("font-variant-numeric:tabular-nums")}>{v.finance.margin}</span></div>
        </div>
      </div>
      </div>
    </div>
  );
}
