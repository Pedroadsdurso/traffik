"use client";

import * as React from "react";

import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { Card } from "@/components/tk/Card";
import { EmptyState } from "@/components/tk/EmptyState";
import {
  ROTULO_CATEGORIA,
  ROTULO_ESTADO,
  contarEstados,
  montarInventario,
  montarSaude,
  type Categoria,
  type EstadoIntegracao,
  type EstadoServico,
  type ItemIntegracao,
} from "@/lib/integracoes/inventario";
import { detalheDoToken, rotuloDoToken, tokenPedeAtencao } from "@/lib/integracoes/token";
import { elapsed } from "@/lib/format";

import { Icone, type NomeIcone } from "../../ui/Icone";
import type { TraffikView } from "../../useTraffikState";

/**
 * Integrações › Visão geral — tela NOVA. Não existia: `integracoes/page.tsx`
 * era um `redirect` para Anúncios.
 *
 * 🔴 O QUE FOI DEIXADO DE FORA DA REFERÊNCIA, E POR QUÊ
 *
 * As três telas de referência (imagens 3, 5 e 6) descrevem um produto
 * multi-plataforma: catálogo de 15 integrações, abas por rede de anúncios,
 * cards de Google Ads / TikTok / Stripe / Taboola. **Esta ferramenta integra
 * Meta e gateways brasileiros, e mais nada.**
 *
 * Um card "Google Ads" que não conecta é um botão que não faz nada — o defeito
 * que este projeto persegue desde o começo, e aqui seria em escala: cinco cards
 * mentindo lado a lado. Quando Google Ads existir, ele entra sozinho, porque
 * haverá `AdProfile` dele e o inventário o monta.
 *
 * Também saíram, por não terem dado nenhum: **Business Managers** (não há model
 * nem chamada), **Conversões Offline** (a ferramenta não faz isso) e
 * **Permissões %** (não guardamos os scopes do token). As três estão marcadas
 * 🔧 no `04`, com o motivo.
 *
 * ⛔ E saiu o "+N este mês" do card Total: numa base com 1 perfil e 2 webhooks
 * ele diria "+0" quase sempre. Número que nunca muda num card de estado é
 * ruído que ensina a não olhar o card.
 */

/* ── Cores de estado ───────────────────────────────────────────────────────
   ⚠️ Estado NUNCA é dito só por cor. Cada um carrega ponto + rótulo, que são
   os dois sinais redundantes que o WCAG 1.4.1 exige — e que já salvaram a
   distinção ativo/inativo do rail quando a cor foi sequestrada pelo `@layer`. */
const TOM_ESTADO: Record<EstadoIntegracao, "success" | "danger" | "neutral"> = {
  conectada: "success",
  erro: "danger",
  inativa: "neutral",
};

const COR_SERVICO: Record<EstadoServico, string> = {
  ok: "var(--tk-success)",
  atencao: "var(--tk-warning)",
  erro: "var(--tk-danger)",
  ausente: "var(--tk-text-muted)",
};

const POR_PAGINA = 10;

/**
 * "há 4 minutos" — e `suppressHydrationWarning` NÃO é preguiça aqui.
 *
 * 🔴 O DEFEITO QUE ISTO CONSERTA, e que só a tela mostrou: `elapsed()` lê
 * `Date.now()`. O servidor renderiza "há 4 minutos", o cliente hidrata alguns
 * instantes depois e calcula "há 5 minutos" — os dois textos divergem, o React
 * aborta a hidratação da árvore e **a navegação voltava para `/dashboard`**. A
 * tela simplesmente não abria pelo menu.
 *
 * `tsc`, `lint` e `build` passaram os três. O log do servidor de desenvolvimento
 * é que denunciou, e só depois de abrir a página.
 *
 * ⚠️ Por que não um `useEffect` de "montado": ele trocaria o texto por um
 * placeholder no primeiro quadro, e uma coluna inteira piscando em toda carga é
 * pior que um texto que se corrige sozinho. `suppressHydrationWarning` é a
 * saída que o React documenta para exatamente este caso — carimbo de tempo.
 *
 * ⛔ Só vale para TEXTO DE TEMPO. Não espalhe para conteúdo que possa divergir
 * por outro motivo: aí a divergência é bug e o silenciador esconde o bug.
 */
function Desde({ quando }: { quando: Date | null }) {
  return (
    <span suppressHydrationWarning>
      {/* "nunca" é diferente de "há 0 minutos", e a diferença importa: um
          webhook que nunca recebeu evento não é o mesmo que um que acabou de
          receber. */}
      {quando ? elapsed(new Date(quando).getTime()) : "nunca"}
    </span>
  );
}

type FiltroEstado = "todos" | EstadoIntegracao;

export function VisaoGeralScreen({ v }: { v: TraffikView }) {
  const [categoria, setCategoria] = React.useState<"todas" | Categoria>("todas");
  const [filtroEstado, setFiltroEstado] = React.useState<FiltroEstado>("todos");
  const [busca, setBusca] = React.useState("");
  const [pagina, setPagina] = React.useState(1);
  const [selecionada, setSelecionada] = React.useState<string | null>(null);

  /* ⛔ Trocar filtro reinicia a paginação — e isso é feito NO SETTER, não num
     `useEffect` que observa os filtros. O efeito funcionaria, mas renderiza uma
     vez com a página errada antes de corrigir, e o `react-hooks/set-state-in-effect`
     reprova com razão: estado derivado de estado não é efeito colateral.

     Sem o reinício, filtrar estando na página 2 mostra lista vazia com
     "Mostrando 11 a 20 de 3" — a tela parecendo quebrada quando obedeceu. */
  function trocarCategoria(c: "todas" | Categoria) { setCategoria(c); setPagina(1); }
  function trocarEstado(e: FiltroEstado) { setFiltroEstado(e); setPagina(1); }
  function trocarBusca(q: string) { setBusca(q); setPagina(1); }

  /* `Date.now()` no corpo do componente é impuro — o lint recusa, e com razão.
     O relógio é carimbado UMA vez, na montagem: "há 2 minutos" é a leitura do
     carregamento, não um cronômetro ao vivo. */
  const [agora] = React.useState(() => new Date());

  const itens = React.useMemo(
    () => montarInventario(v.perfisCrus, v.webhooks, v.pixels, v.webhookPlatformLabel, agora),
    [v.perfisCrus, v.webhooks, v.pixels, v.webhookPlatformLabel, agora],
  );
  const saude = React.useMemo(
    () => montarSaude(v.perfisCrus, v.webhooks, v.pixels, agora),
    [v.perfisCrus, v.webhooks, v.pixels, agora],
  );
  const contagem = React.useMemo(() => contarEstados(itens), [itens]);

  const filtrados = React.useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter(
      (i) =>
        (categoria === "todas" || i.categoria === categoria) &&
        (filtroEstado === "todos" || i.estado === filtroEstado) &&
        (!q || i.nome.toLowerCase().includes(q) || i.subtitulo.toLowerCase().includes(q)),
    );
  }, [itens, categoria, filtroEstado, busca]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  /* A seleção sobrevive a filtro e paginação: o painel é PERSISTENTE, não um
     modal. Mas se o item selecionado sumiu do filtro, o painel cai para o
     primeiro visível — em vez de exibir o detalhe de algo que não está na
     lista, que faria a tela contradizer a si mesma. */
  const item = React.useMemo(() => {
    const escolhido = itens.find((i) => i.chave === selecionada);
    if (escolhido && filtrados.some((f) => f.chave === escolhido.chave)) return escolhido;
    return visiveis[0] ?? null;
  }, [itens, filtrados, visiveis, selecionada]);

  const vazio = itens.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
      {/* ⛔ SEM `<h1>` AQUI. O título e o subtítulo da rota são do SHELL
          (`tk/ContextBar`), e a primeira versão desta tela os repetia — na tela
          aparecia "Integrações" duas vezes, uma embaixo da outra, com dois
          subtítulos diferentes. Só a tela responde isso: `tsc`, `lint` e `build`
          passaram os três com o título dobrado.

          O subtítulo da referência ("Conecte e gerencie todas as plataformas…")
          é melhor que o que estava no shell e foi PARA LÁ, que é onde o texto da
          rota mora. Duplicar para melhorar teria criado a segunda fonte. */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button variante="cta" iconeInicio={<Icone nome="novo" tamanho={14} />} href={v.connectHref}>
          Nova integração
        </Button>
      </div>

      {/* ── Faixa de estado — cada card é FILTRO ───────────────────────────
          Não é decoração: clicar filtra a lista abaixo, e o card fica marcado.
          Um card de contagem que não leva a lugar nenhum obriga o usuário a
          reproduzir o filtro à mão logo abaixo. */}
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <CardEstado
          icone="ok"
          rotulo="Conectadas"
          numero={contagem.conectadas}
          contexto={contagem.conectadas === contagem.total && contagem.total > 0 ? "100% operacionais" : "Funcionando"}
          cor="var(--tk-success)"
          ativo={filtroEstado === "conectada"}
          aoClicar={() => trocarEstado(filtroEstado === "conectada" ? "todos" : "conectada")}
        />
        <CardEstado
          icone="aviso"
          rotulo="Com erro"
          numero={contagem.erro}
          contexto="Precisam de atenção"
          cor="var(--tk-danger)"
          ativo={filtroEstado === "erro"}
          aoClicar={() => trocarEstado(filtroEstado === "erro" ? "todos" : "erro")}
        />
        <CardEstado
          icone="bloqueado"
          rotulo="Inativas"
          numero={contagem.inativas}
          contexto="Sem sinal recente"
          cor="var(--tk-text-muted)"
          ativo={filtroEstado === "inativa"}
          aoClicar={() => trocarEstado(filtroEstado === "inativa" ? "todos" : "inativa")}
        />
        <CardEstado
          icone="camadas"
          rotulo="Total de integrações"
          numero={contagem.total}
          /* ⛔ Sem "+N este mês": ver a nota no topo do arquivo. */
          contexto="Configuradas nesta área"
          cor="var(--tk-primary)"
          ativo={filtroEstado === "todos"}
          aoClicar={() => trocarEstado("todos")}
        />
      </div>

      {vazio ? (
        <Card>
          <EmptyState
            titulo="Nenhuma integração nesta área de trabalho"
            causa="Conecte um perfil da Meta, um webhook de gateway ou um pixel para começar a receber dados."
            acao={{ texto: "Conectar perfil da Meta", href: v.connectHref }}
          />
        </Card>
      ) : (
        <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1fr)" }}>
          {/* ── Mestre-detalhe ──────────────────────────────────────────── */}
          <Card semPadding>
            <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--tk-border)" }}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flex: "1 1 auto" }}>
                {(["todas", "anuncios", "webhooks", "pixel"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => trocarCategoria(c)}
                    className={`text-label ${categoria === c ? "text-text" : "text-text-secondary"}`}
                    style={{
                      background: categoria === c ? "var(--tk-surface-hover)" : "transparent",
                      border: "1px solid " + (categoria === c ? "var(--tk-border)" : "transparent"),
                      borderRadius: "var(--tk-radius-controle)",
                      padding: "5px 10px",
                      cursor: "pointer",
                    }}
                  >
                    {c === "todas" ? "Todas" : ROTULO_CATEGORIA[c]}
                  </button>
                ))}
              </div>
              <input
                value={busca}
                onChange={(e) => trocarBusca(e.target.value)}
                placeholder="Filtrar integrações…"
                aria-label="Filtrar integrações"
                className="text-label text-text"
                style={{
                  flex: "0 1 200px",
                  height: "var(--tk-altura-controle)",
                  padding: "0 10px",
                  borderRadius: "var(--tk-radius-controle)",
                  border: "1px solid var(--tk-border)",
                  background: "var(--tk-surface-hover)",
                }}
              />
            </div>

            <div role="list">
              {visiveis.map((i) => {
                const sel = item?.chave === i.chave;
                return (
                  <button
                    key={i.chave}
                    type="button"
                    role="listitem"
                    onClick={() => setSelecionada(i.chave)}
                    aria-current={sel}
                    style={{
                      width: "100%",
                      display: "grid",
                      gridTemplateColumns: "minmax(0,2fr) minmax(0,90px) minmax(0,120px) minmax(0,140px)",
                      gap: 10,
                      alignItems: "center",
                      textAlign: "left",
                      padding: "11px 14px",
                      background: sel ? "var(--tk-surface-hover)" : "transparent",
                      /* Borda à esquerda, não só fundo: fundo sozinho some no
                         tema claro e para quem tem baixa visão. */
                      borderLeft: `3px solid ${sel ? "var(--tk-primary)" : "transparent"}`,
                      borderBottom: "1px solid var(--tk-border)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span className="text-label text-text" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.nome}
                      </span>
                      <span className="text-caption text-text-muted" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {i.subtitulo}
                      </span>
                    </span>
                    <span><Badge tom="category">{ROTULO_CATEGORIA[i.categoria]}</Badge></span>
                    <span><Badge tom={TOM_ESTADO[i.estado]} ponto>{ROTULO_ESTADO[i.estado]}</Badge></span>
                    <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                      <Desde quando={i.ultimoSinal} />
                    </span>
                  </button>
                );
              })}
              {visiveis.length === 0 && (
                <p className="text-caption text-text-muted" style={{ padding: "18px 14px", margin: 0 }}>
                  Nenhuma integração com esses filtros.
                </p>
              )}
            </div>

            <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="text-caption text-text-muted">
                {filtrados.length === 0
                  ? "Nenhuma integração"
                  : `Mostrando ${(paginaAtual - 1) * POR_PAGINA + 1} a ${Math.min(paginaAtual * POR_PAGINA, filtrados.length)} de ${filtrados.length}`}
              </span>
              {totalPaginas > 1 && (
                <span style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <Button apenasIcone disabled={paginaAtual === 1} onClick={() => setPagina(paginaAtual - 1)} aria-label="Página anterior">
                    <Icone nome="voltar" tamanho={14} />
                  </Button>
                  {Array.from({ length: totalPaginas }, (_, n) => (
                    <Button key={n} variante={n + 1 === paginaAtual ? "primario" : "secundario"} onClick={() => setPagina(n + 1)}>
                      {String(n + 1)}
                    </Button>
                  ))}
                  <Button apenasIcone disabled={paginaAtual === totalPaginas} onClick={() => setPagina(paginaAtual + 1)} aria-label="Próxima página">
                    <Icone nome="chevronDireita" tamanho={14} />
                  </Button>
                </span>
              )}
            </div>
          </Card>

          {/* ── Painel de detalhe ───────────────────────────────────────── */}
          {item ? <PainelDetalhe item={item} /> : null}
        </div>
      )}

      {/* ── Saúde + Plataformas + Contas ───────────────────────────────── */}
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1fr)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
          <PlataformasConectadas v={v} itens={itens} />
          <ContasConectadas v={v} />
        </div>
        <Card titulo="Saúde da integração" descricao="Cinco serviços, cinco respostas reais">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {saude.map((l) => (
              <div key={l.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: "1px solid var(--tk-border)" }}>
                <span className="text-label text-text-secondary" style={{ flex: 1, minWidth: 0 }}>{l.nome}</span>
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, background: COR_SERVICO[l.estado], flex: "none" }} />
                <span className="text-caption" style={{ color: COR_SERVICO[l.estado], whiteSpace: "nowrap" }}>{l.valor}</span>
              </div>
            ))}
          </div>
          <p className="text-caption text-text-muted" style={{ margin: "10px 0 0", lineHeight: 1.45 }}>
            {/* Dizer o que NÃO está aqui é o que impede a leitura de que o
                painel cobre tudo. Um "Saúde" incompleto e mudo é pior que um
                incompleto e honesto. */}
            Conversões offline e permissões do token não aparecem: a ferramenta ainda não lê esses dados da Meta.
          </p>
        </Card>
      </div>
    </div>
  );
}

/* ── Card da faixa de estado ─────────────────────────────────────────────── */
function CardEstado({
  icone, rotulo, numero, contexto, cor, ativo, aoClicar,
}: {
  icone: NomeIcone; rotulo: string; numero: number; contexto: string; cor: string; ativo: boolean; aoClicar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-pressed={ativo}
      className="bg-surface"
      style={{
        border: `1px solid ${ativo ? "var(--tk-primary)" : "var(--tk-border)"}`,
        borderRadius: "var(--tk-radius-card)",
        padding: "var(--tk-pad-card)",
        display: "flex",
        gap: 12,
        alignItems: "center",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid", placeItems: "center", width: 40, height: 40, flex: "none",
          borderRadius: "var(--tk-radius-controle)",
          background: `color-mix(in oklch, ${cor} 14%, transparent)`,
          color: cor,
        }}
      >
        <Icone nome={icone} tamanho={18} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span className="text-caption text-text-secondary" style={{ display: "block" }}>{rotulo}</span>
        <span className="text-metric-md text-text" style={{ display: "block" }}>{numero}</span>
        <span className="text-caption" style={{ display: "block", color: cor }}>{contexto}</span>
      </span>
    </button>
  );
}

/* ── Painel de detalhe ───────────────────────────────────────────────────── */
function PainelDetalhe({ item }: { item: ItemIntegracao }) {
  return (
    <Card>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <h2 className="text-title text-text" style={{ margin: 0 }}>{item.nome}</h2>
          <p className="text-caption text-text-muted" style={{ margin: "2px 0 0" }}>{item.subtitulo}</p>
        </div>
        <Badge tom={TOM_ESTADO[item.estado]} ponto>{ROTULO_ESTADO[item.estado]}</Badge>
      </div>

      {/* ⛔ As abas (Configurações / Sincronização / Logs / Webhooks) NÃO estão
          aqui de propósito. O conteúdo delas é o que hoje mora na `PixelView`
          (1181 linhas) e na `WebhooksView` (532), e trazer isso junto com a
          estrutura misturaria dois trabalhos e dois motivos de revisão.
          Desenhar as abas VAZIAS agora seria pior: cinco abas em que quatro não
          fazem nada é exatamente o "controle que não controla nada". */}

      {item.detalhe && (
        <p
          className="text-caption"
          style={{
            margin: "12px 0 0", padding: "9px 11px", lineHeight: 1.45,
            borderRadius: "var(--tk-radius-controle)",
            background: `color-mix(in oklch, ${item.estado === "erro" ? "var(--tk-danger)" : "var(--tk-text-muted)"} 12%, transparent)`,
            color: item.estado === "erro" ? "var(--tk-danger)" : "var(--tk-text-secondary)",
          }}
        >
          {item.detalhe}
        </p>
      )}

      {/* ── Token — a razão de o painel existir ──────────────────────────── */}
      {item.token && (
        <div
          style={{
            margin: "12px 0 0", padding: "11px",
            borderRadius: "var(--tk-radius-controle)",
            border: `1px solid ${tokenPedeAtencao(item.token) ? "var(--tk-warning)" : "var(--tk-border)"}`,
            background: tokenPedeAtencao(item.token) ? "color-mix(in oklch, var(--tk-warning) 10%, transparent)" : "transparent",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span aria-hidden="true" style={{ color: tokenPedeAtencao(item.token) ? "var(--tk-warning)" : "var(--tk-text-muted)", display: "flex" }}>
              <Icone nome={tokenPedeAtencao(item.token) ? "aviso" : "ok"} tamanho={14} />
            </span>
            <span className="text-label" style={{ color: tokenPedeAtencao(item.token) ? "var(--tk-warning)" : "var(--tk-text)" }}>
              {rotuloDoToken(item.token)}
            </span>
          </div>
          {detalheDoToken(item.token) && (
            <p className="text-caption text-text-secondary" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>
              {detalheDoToken(item.token)}
            </p>
          )}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px 14px", marginTop: 14 }}>
        {item.meta.map((m) => (
          <div key={m.rotulo} style={{ minWidth: 0 }}>
            <span className="text-caption text-text-muted" style={{ display: "block" }}>{m.rotulo}</span>
            <span className="text-label text-text" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis" }}>{m.valor}</span>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--tk-border)" }}>
        <span className="text-caption text-text-muted">
          {item.rotuloSinal}: <Desde quando={item.ultimoSinal} />
        </span>
      </div>
    </Card>
  );
}

/* ── Plataformas conectadas ──────────────────────────────────────────────── */
function PlataformasConectadas({ v, itens }: { v: TraffikView; itens: ItemIntegracao[] }) {
  /* Uma plataforma por NOME distinto do inventário. Meta aparece se houver
     perfil; cada gateway aparece se houver webhook dele. Nada mais entra. */
  const plataformas = React.useMemo(() => {
    const mapa = new Map<string, { nome: string; contas: number; erro: boolean }>();
    for (const i of itens) {
      const cur = mapa.get(i.nome) ?? { nome: i.nome, contas: 0, erro: false };
      cur.contas += 1;
      if (i.estado === "erro") cur.erro = true;
      mapa.set(i.nome, cur);
    }
    return [...mapa.values()];
  }, [itens]);

  return (
    <Card titulo="Plataformas conectadas" descricao="Só o que está conectado de verdade">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
        {plataformas.map((p) => (
          <div
            key={p.nome}
            className="bg-surface-hover"
            style={{ border: "1px solid var(--tk-border)", borderRadius: "var(--tk-radius-controle)", padding: 11, minWidth: 0 }}
          >
            <span className="text-label text-text" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.nome}
            </span>
            <span className="text-caption text-text-muted" style={{ display: "block" }}>
              {p.contas === 1 ? "1 integração" : `${p.contas} integrações`}
            </span>
            <span style={{ marginTop: 6, display: "inline-block" }}>
              <Badge tom={p.erro ? "danger" : "success"} ponto>{p.erro ? "Com erro" : "Online"}</Badge>
            </span>
          </div>
        ))}
        <a
          href={v.connectHref}
          className="text-label text-text-secondary"
          style={{
            border: "1px dashed var(--tk-border)", borderRadius: "var(--tk-radius-controle)",
            padding: 11, display: "grid", placeItems: "center", minHeight: 84, textAlign: "center",
          }}
        >
          + Adicionar plataforma
        </a>
      </div>
    </Card>
  );
}

/* ── Contas conectadas ───────────────────────────────────────────────────── */
function ContasConectadas({ v }: { v: TraffikView }) {
  const [todas, setTodas] = React.useState(false);
  const contas = React.useMemo(
    () => v.perfisCrus.flatMap((p) => p.accounts.map((a) => ({ ...a, perfil: p.name }))),
    [v.perfisCrus],
  );
  if (contas.length === 0) return null;
  const visiveis = todas ? contas : contas.slice(0, 5);

  return (
    <Card titulo="Contas conectadas" descricao="Contas de anúncio da Meta nesta área">
      <div style={{ display: "flex", flexDirection: "column" }}>
        {visiveis.map((a, i) => (
          <div
            key={a.id}
            style={{
              display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap",
              padding: "10px 0", borderTop: i ? "1px solid var(--tk-border)" : undefined,
            }}
          >
            <span style={{ flex: "1 1 180px", minWidth: 0 }}>
              <span className="text-label text-text" style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.name}
              </span>
              <span className="text-caption text-text-muted" style={{ display: "block" }}>ID: {a.fbAccountId}</span>
            </span>
            {/* ⛔ Sem coluna "BM": não existe model de Business Manager nesta
                base, e `grep -i business` no schema devolve zero. A referência
                mostra "2 BM" por conta — seria um número inventado. */}
            <span style={{ display: "flex", gap: 16 }}>
              <Contagem n={a.campanhas} rotulo="Campanhas" />
              <Contagem n={a.pixels} rotulo={a.pixels === 1 ? "Pixel" : "Pixels"} />
            </span>
            <Badge tom={a.syncErrorCount > 0 ? "danger" : a.trackingEnabled ? "success" : "neutral"} ponto>
              {a.syncErrorCount > 0 ? "Erro" : a.trackingEnabled ? "Sincronizado" : "Pausado"}
            </Badge>
          </div>
        ))}
      </div>
      {contas.length > 5 && (
        <button
          type="button"
          onClick={() => setTodas(!todas)}
          className="text-caption text-text-secondary"
          style={{ background: "none", border: "none", cursor: "pointer", marginTop: 10, padding: 0 }}
        >
          {todas ? "Mostrar menos" : `Ver todas as ${contas.length} contas ⌄`}
        </button>
      )}
    </Card>
  );
}

function Contagem({ n, rotulo }: { n: number; rotulo: string }) {
  return (
    <span style={{ textAlign: "center" }}>
      <span className="text-label text-text" style={{ display: "block" }}>{n}</span>
      <span className="text-caption text-text-muted" style={{ display: "block" }}>{rotulo}</span>
    </span>
  );
}
