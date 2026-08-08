"use client";

import * as React from "react";

import { Abas } from "@/components/tk/Abas";
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
import { Desde } from "@/components/tk/Desde";
import { Modal } from "@/components/dashboard/ui/Modal";
import { listWebhookLogs, type WebhookLogDTO } from "@/lib/actions/diagnostics";
import { traduzirErroMeta } from "@/lib/facebook/erroMeta";

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
          {item ? <PainelDetalhe item={item} v={v} /> : null}
        </div>
      )}

      {/* ── Saúde + Plataformas + Contas ───────────────────────────────── */}
      <div style={{ display: "grid", gap: "var(--tk-gap-grid)", gridTemplateColumns: "minmax(0,2.4fr) minmax(0,1fr)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
          <PlataformasConectadas v={v} itens={itens} />
          <ContasConectadas v={v} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
        <Card titulo="Saúde da integração" descricao="Cinco serviços, cinco respostas reais">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {saude.map((l) => (
              <div key={l.nome} className="tk-linha" style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8 }}>
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
        <AtividadeRecente v={v} />
        </div>
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
          // §13 — quadrado arredondado de 36px, raio 10. Era 40 com o raio de
          // controle, que o fazia parecer um botão em vez de um recipiente.
          display: "grid", placeItems: "center", width: 36, height: 36, flex: "none",
          borderRadius: 10,
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

/* ── Painel de detalhe ─────────────────────────────────────────────────────
   ⛔ A aba "Webhooks" da referência NÃO existe aqui, e o motivo é de
   hierarquia: para uma integração de webhook a aba seria ela mesma, e o perfil
   da Meta não tem webhook associado. Uma quarta aba que só se repete ou fica
   vazia é a definição de controle que não controla nada.

   ⛔ E as abas são POR ITEM: "Logs" só aparece para webhook, que é o único tipo
   com fluxo de log (`WebhookLog`). Mostrar a aba vazia nos outros dois — ou
   desabilitada — deixaria a pessoa procurando o que destrava. */
type Aba = "config" | "sync" | "logs";

function PainelDetalhe({ item, v }: { item: ItemIntegracao; v: TraffikView }) {
  const [aba, setAba] = React.useState<Aba>("config");
  const ehWebhook = item.categoria === "webhooks";
  const ehPerfil = item.categoria === "anuncios";

  const abas: { id: Aba; rotulo: string }[] = [
    { id: "config", rotulo: "Configurações" },
    { id: "sync", rotulo: "Sincronização" },
    ...(ehWebhook ? [{ id: "logs" as const, rotulo: "Logs" }] : []),
  ];

  /* Trocar de item volta para a primeira aba: manter "Logs" selecionada ao
     pular para um perfil mostraria uma aba que aquele item nem tem. */
  const abaAtual = abas.some((a) => a.id === aba) ? aba : "config";

  return (
    <Card>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <h2 className="text-title text-text" style={{ margin: 0 }}>{item.nome}</h2>
          <p className="text-caption text-text-muted" style={{ margin: "2px 0 0" }}>{item.subtitulo}</p>
        </div>
        <Badge tom={TOM_ESTADO[item.estado]} ponto>{ROTULO_ESTADO[item.estado]}</Badge>
      </div>

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

      {item.token && <BlocoToken token={item.token} />}

      {/* ⚠️ Era esta mesma fileira escrita à mão aqui dentro. Ela virou
          `components/tk/Abas` ao nascer a segunda (o Gerenciador) — duas
          implementações da mesma coisa divergem sempre, e a divergência entre
          duas fileiras de aba aparece como "esta tela é de outro produto". */}
      <div style={{ marginTop: 14 }}>
        <Abas abas={abas} ativa={abaAtual} aoTrocar={setAba} rotuloAcessivel="Seções da integração" />
      </div>

      <div style={{ paddingTop: 12 }}>
        {abaAtual === "config" && <AbaConfig item={item} />}
        {abaAtual === "sync" && <AbaSync item={item} />}
        {abaAtual === "logs" && <AbaLogs item={item} />}
      </div>

      <RodapeAcoes item={item} v={v} ehPerfil={ehPerfil} />
    </Card>
  );
}

function BlocoToken({ token }: { token: NonNullable<ItemIntegracao["token"]> }) {
  const atencao = tokenPedeAtencao(token);
  return (
    <div
      style={{
        margin: "12px 0 0", padding: "11px",
        borderRadius: "var(--tk-radius-controle)",
        border: `1px solid ${atencao ? "var(--tk-warning)" : "var(--tk-border)"}`,
        background: atencao ? "color-mix(in oklch, var(--tk-warning) 10%, transparent)" : "transparent",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span aria-hidden="true" style={{ color: atencao ? "var(--tk-warning)" : "var(--tk-text-muted)", display: "flex" }}>
          <Icone nome={atencao ? "aviso" : "ok"} tamanho={14} />
        </span>
        <span className="text-label" style={{ color: atencao ? "var(--tk-warning)" : "var(--tk-text)" }}>
          {rotuloDoToken(token)}
        </span>
      </div>
      {detalheDoToken(token) && (
        <p className="text-caption text-text-secondary" style={{ margin: "5px 0 0", lineHeight: 1.45 }}>
          {detalheDoToken(token)}
        </p>
      )}
    </div>
  );
}

function Grade({ linhas }: { linhas: { rotulo: string; valor: string }[] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px 14px" }}>
      {linhas.map((m) => (
        <div key={m.rotulo} style={{ minWidth: 0 }}>
          <span className="text-caption text-text-muted" style={{ display: "block" }}>{m.rotulo}</span>
          <span className="text-label text-text" style={{ display: "block" }}>{m.valor}</span>
        </div>
      ))}
    </div>
  );
}

function AbaConfig({ item }: { item: ItemIntegracao }) {
  return (
    <>
      <Grade linhas={item.meta} />
      {/* ⛔ A configuração COMPLETA não cabe aqui, e não é questão de largura: a
          `PixelView` e a `WebhooksView` são telas POR USUÁRIO ("todos os meus
          pixels"), enquanto este painel é POR INTEGRAÇÃO. Enfiar uma lista de N
          itens no detalhe de 1 item é contradição de hierarquia. O link leva à
          tela que tem o escopo certo. */}
      {item.rotaConfig && (
        <div style={{ marginTop: 14 }}>
          <Button href={item.rotaConfig} iconeFim={<Icone nome="chevronDireita" tamanho={13} />}>
            Abrir configuração completa
          </Button>
        </div>
      )}
    </>
  );
}

function AbaSync({ item }: { item: ItemIntegracao }) {
  return (
    <>
      <Grade linhas={item.sincronizacao} />
      <p className="text-caption text-text-muted" style={{ margin: "12px 0 0" }}>
        {item.rotuloSinal}: <Desde quando={item.ultimoSinal} />
      </p>
    </>
  );
}

/**
 * Logs do gateway — só para webhook, que é o único tipo com fluxo de log.
 *
 * ⚠️ **LIMIT 20 e sem paginação**, por decisão de 06/08/2026. O `WebhookLog` não
 * tem retenção nem purga (dívida registrada no CLAUDE.md): paginar sobre uma
 * tabela que cresce sem teto convidaria a percorrer o histórico inteiro.
 */
/**
 * ⚠️ Os quatro estados do `WebhookLog`, e sao QUATRO — nao "ok/erro".
 * `RECEBIDO` e diferente de `PROCESSADO`: o primeiro chegou e ainda nao virou
 * venda, o segundo virou. Colapsar os dois em verde esconderia justamente o
 * caso em que o gateway envia e a venda nao aparece no Dashboard.
 */
const PONTO_LOG: Record<string, string> = {
  PROCESSADO: "var(--tk-success)",
  RECEBIDO: "var(--tk-primary)",
  REJEITADO: "var(--tk-warning)",
  ERRO: "var(--tk-danger)",
};

function AbaLogs({ item }: { item: ItemIntegracao }) {
  const [logs, setLogs] = React.useState<WebhookLogDTO[] | null>(null);
  const [erro, setErro] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vivo = true;
    listWebhookLogs(20, item.id)
      .then((r) => { if (vivo) setLogs(r); })
      .catch(() => { if (vivo) setErro("Não foi possível carregar os logs."); });
    return () => { vivo = false; };
  }, [item.id]);

  if (erro) return <p className="text-caption text-danger" style={{ margin: 0 }}>{erro}</p>;
  if (logs === null) return <p className="text-caption text-text-muted" style={{ margin: 0 }}>Carregando…</p>;
  if (logs.length === 0) {
    return (
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
        Nenhum evento registrado para este webhook. Os logs aparecem quando o gateway começar a enviar.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {logs.map((l, i) => (
        <div key={l.id} className="tk-linha" style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 8px", borderRadius: 8 }}>
          <span
            aria-hidden="true"
            style={{ width: 7, height: 7, borderRadius: 99, flex: "none", background: PONTO_LOG[l.status] ?? "var(--tk-text-muted)" }}
          />
          <span className="text-caption text-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
            {l.message ?? l.status}
            {l.httpStatus != null && <span className="text-text-muted"> · HTTP {l.httpStatus}</span>}
          </span>
          <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
            <Desde quando={l.createdAt} />
          </span>
        </div>
      ))}
      <p className="text-caption text-text-muted" style={{ margin: "10px 0 0" }}>
        Mostrando os 20 eventos mais recentes.
      </p>
    </div>
  );
}

/* ── Rodapé de ações ─────────────────────────────────────────────────────── */
function RodapeAcoes({ item, v, ehPerfil }: { item: ItemIntegracao; v: TraffikView; ehPerfil: boolean }) {
  const [confirmar, setConfirmar] = React.useState(false);
  const [resultado, setResultado] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const [ocupado, setOcupado] = React.useState(false);

  async function testar() {
    setOcupado(true);
    setResultado(null);
    try {
      const r = await fetch("/api/sync/manual", { method: "POST" });
      const j = await r.json();
      /* A mensagem CRUA da Graph API passa pelo tradutor que já existe. Inglês
         truncado com URL de documentação no meio não é resposta para o usuário
         — foi para isso que o `erroMeta.ts` foi escrito. */
      /* ⚠️ `traduzirErroMeta` devolve `null` quando NAO conhece a mensagem, e
         a lista dele e necessariamente incompleta — a Meta muda o texto sem
         avisar. Cair no texto cru e melhor que engolir o erro: ilegivel e pior
         que ausente, mas ausente e o unico que impede o diagnostico. */
      const cru = String(j.mensagem ?? "Falha ao sincronizar.");
      const texto = r.ok ? cru : (traduzirErroMeta(cru)?.mensagem ?? cru);
      setResultado({ ok: r.ok, texto });
    } catch {
      setResultado({ ok: false, texto: "Não foi possível falar com o servidor." });
    } finally {
      setOcupado(false);
    }
  }

  const podeDesconectar = ehPerfil || item.categoria === "webhooks";

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--tk-border)", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      {/* ⛔ SÓ O PERFIL DA META TEM ESTE BOTÃO. Para webhook e pixel não há o
          que testar sem um evento real chegando do lado de fora — e um controle
          DESABILITADO sem explicação é pior que ausência: a pessoa fica
          procurando o que o destrava. */}
      {ehPerfil && (
        <Button onClick={testar} carregando={ocupado} iconeInicio={<Icone nome="atualizar" tamanho={14} />}>
          {/* 🔴 O NOME DIZ O QUE ELE FAZ. `/api/sync/manual` SINCRONIZA — escreve
              no banco. Um botão rotulado "Testar conexão" que grava seria
              affordance mentindo, a mesma regra que removeu a interação do globo
              e tirou Testes da Central de ajuda. */}
          Testar e sincronizar
        </Button>
      )}
      {podeDesconectar && (
        <Button variante="destrutivo" onClick={() => setConfirmar(true)} iconeInicio={<Icone nome="excluir" tamanho={14} />}>
          Desconectar
        </Button>
      )}
      {resultado && (
        <span className="text-caption" style={{ color: resultado.ok ? "var(--tk-success)" : "var(--tk-danger)" }}>
          {resultado.texto}
        </span>
      )}

      {confirmar && (
        <Modal aberta titulo={`Desconectar ${item.nome}?`} onClose={() => setConfirmar(false)}>
          {/* 🔴 A CONFIRMAÇÃO NOMEIA O QUE SE PERDE **E O QUE NÃO SE PERDE**.
              Sem a segunda metade a pessoa presume o pior — que vai perder o
              histórico — e deixa uma integração quebrada no lugar por medo. É a
              mesma afirmação que os alertas do Dashboard já fazem. */}
          <p className="text-body text-text-secondary" style={{ margin: 0, lineHeight: 1.5 }}>
            {ehPerfil
              ? "Isto remove o vínculo com a Meta: o token de acesso é apagado e as contas de anúncio deixam de ser listadas e sincronizadas."
              : "Isto apaga o webhook e a URL dele. O gateway passa a receber erro ao enviar, até você reconfigurar."}
          </p>
          <p className="text-body text-text-secondary" style={{ margin: "10px 0 0", lineHeight: 1.5 }}>
            <strong className="text-text">O que NÃO se perde:</strong> vendas, cliques e métricas já
            sincronizados continuam no seu histórico e seguem aparecendo nos relatórios.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <Button onClick={() => setConfirmar(false)}>Cancelar</Button>
            <Button
              variante="destrutivo"
              onClick={async () => {
                if (ehPerfil) {
                  const p = v.adProfiles.find((x) => x.id === item.id);
                  await p?.disconnect();
                } else {
                  await v.removeWebhook(item.id);
                }
                setConfirmar(false);
              }}
            >
              Desconectar
            </Button>
          </div>
        </Modal>
      )}
    </div>
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
              padding: "10px 8px", borderRadius: 8,
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

/* ── Atividade recente ─────────────────────────────────────────────────────
   🔴 NÃO EXISTE FEED DE ATIVIDADE DE INTEGRAÇÃO nesta base — o que existe são
   três fontes com formatos e ciclos diferentes. Este painel as UNE na leitura,
   sem criar tabela nem coluna:

     WebhookLog     evento recebido de gateway   (tem carimbo próprio)
     Notification   o que a ferramenta avisou    (já vem do servidor)
     AdAccount      falha de sincronização       (`lastSyncErrorAt`)

   ⚠️ **LIMIT 20 e sem paginação**, por decisão de 06/08/2026. O `WebhookLog`
   não tem retenção nem purga — é dívida registrada —, e paginar sobre uma
   tabela que cresce sem teto convidaria a percorrer o histórico inteiro. Vinte
   linhas respondem "o que aconteceu agora", que é a pergunta do painel.

   ⚠️ E a união é por TEMPO, não por fonte: intercalar é o ponto. Três listas
   separadas obrigariam a pessoa a comparar horários entre blocos para montar a
   sequência na cabeça — que é exatamente o trabalho que o painel deveria poupar. */
const LIMITE_ATIVIDADE = 20;

type LinhaAtividade = { id: string; quando: Date; texto: string; cor: string; icone: NomeIcone };

function AtividadeRecente({ v }: { v: TraffikView }) {
  const [logs, setLogs] = React.useState<WebhookLogDTO[]>([]);

  React.useEffect(() => {
    let vivo = true;
    listWebhookLogs(LIMITE_ATIVIDADE)
      .then((r) => { if (vivo) setLogs(r); })
      /* Falha aqui NÃO derruba o painel: as outras duas fontes continuam
         valendo, e um painel com 2 de 3 fontes é melhor que um painel vazio. */
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  const linhas = React.useMemo<LinhaAtividade[]>(() => {
    const out: LinhaAtividade[] = [];

    for (const l of logs) {
      out.push({
        id: `log-${l.id}`,
        quando: new Date(l.createdAt),
        texto: `${l.gateway}: ${l.message ?? l.status.toLowerCase()}`,
        cor: PONTO_LOG[l.status] ?? "var(--tk-text-muted)",
        icone: "link",
      });
    }

    for (const n of v.notifItems.slice(0, LIMITE_ATIVIDADE)) {
      out.push({
        id: `notif-${n.id}`,
        quando: new Date(n.timestamp),
        texto: n.title,
        cor: "var(--tk-primary)",
        icone: "sino",
      });
    }

    for (const p of v.perfisCrus) {
      for (const a of p.accounts) {
        if (!a.lastSyncErrorAt) continue;
        out.push({
          id: `sync-${a.id}`,
          quando: new Date(a.lastSyncErrorAt),
          texto: `${a.name}: falha ao sincronizar`,
          cor: "var(--tk-danger)",
          icone: "aviso",
        });
      }
    }

    return out
      .filter((x) => !Number.isNaN(x.quando.getTime()))
      .sort((a, b) => b.quando.getTime() - a.quando.getTime())
      .slice(0, LIMITE_ATIVIDADE);
  }, [logs, v.notifItems, v.perfisCrus]);

  return (
    <Card titulo="Atividade recente" descricao="Eventos, avisos e falhas de sincronização">
      {linhas.length === 0 ? (
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.45 }}>
          Nada registrado ainda. Aqui aparecem os eventos recebidos dos gateways, os avisos da
          ferramenta e as falhas de sincronização.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {linhas.map((l, i) => (
            <div key={l.id} className="tk-linha" style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "7px 8px", borderRadius: 8 }}>
              <span aria-hidden="true" style={{ color: l.cor, display: "flex", flex: "none" }}>
                <Icone nome={l.icone} tamanho={13} />
              </span>
              <span className="text-caption text-text" style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.texto}
              </span>
              <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                <Desde quando={l.quando} />
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
