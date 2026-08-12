"use client";

import * as React from "react";

import type { TraffikView } from "@/components/dashboard/useTraffikState";
import {
  createPixel,
  deletePixel,
  gatewaysComPixelProprio,
  listPixels,
  listTrackedProducts,
  togglePixel,
  updatePixel,
  type PixelConfigDTO,
  type PixelFormInput,
  type SnippetCheckDTO,
} from "@/lib/actions/pixels";
import { diagnosticoDosPixels, listarEventosDoPixel, type PaginaDeEventos } from "@/lib/actions/pixelEvents";
import { estadoDoEspelho, type TomDoEspelho } from "@/lib/pixel/espelho";
import { EVENTOS_DO_PIXEL } from "@/lib/pixel/donos";
import {
  JANELAS,
  JANELA_PADRAO,
  TEXTO_DO_VAZIO,
  motivoDoVazio,
  seloDeAmbiente,
  type DiasDeJanela,
} from "@/lib/pixel/eventos";
import { Icone } from "@/components/dashboard/ui/Icone";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { Card } from "@/components/tk/Card";
import { Desde } from "@/components/tk/Desde";
import { EmptyState } from "@/components/tk/EmptyState";
import { Gaveta } from "@/components/tk/Gaveta";
import { Paginacao, type PorPagina } from "@/components/tk/Paginacao";
import { Select } from "@/components/tk/Select";
import { Skeleton } from "@/components/tk/Skeleton";
import { Tooltip } from "@/components/tk/Tooltip";
import { GavetaPixel } from "./GavetaPixel";

/**
 * PIXEL & EVENTOS — a tela que CONFIGURA o que é medido.
 *
 * > ### 🔴 AS OUTRAS NOVE TELAS MOSTRAM. ESTA DECIDE.
 * > Um dono de evento errado aqui **conta conversão em dobro**, e a pessoa
 * > otimiza campanha em cima disso por semanas. Não há imagem de referência para
 * > esta tela — o critério de aceite é o do dono: **cada controle diz o que MUDA
 * > quando ele muda**, não o rótulo do campo.
 *
 * ## As três partes, e por que nesta ordem
 *
 * | Parte | Responde |
 * |---|---|
 * | **mestre** | quais pixels existem NESTA área, e algum está com problema? |
 * | **diagnóstico** | o script que está no site bate com o que está configurado? |
 * | **eventos** | ele está disparando AGORA? |
 *
 * A terceira é a que não existia. Sem ela, quem responde *"meu pixel está
 * funcionando?"* é o Gerenciador de Eventos da Meta — um sistema que não é o
 * nosso, e que só é consultado quando alguém já desconfia.
 *
 * ## 🔴 A RESTRIÇÃO DO ARTEFATO AQUI É DUPLA — e as duas metades medem coisas
 * ## diferentes
 *
 * Esta tela entrega SCRIPT, que vai para o site do cliente. Duas coisas precisam
 * ser verdade ao mesmo tempo, e provar uma **não** prova a outra:
 *
 * | # | O que | Por que a outra não cobre |
 * |---|---|---|
 * | 1 | trocar de **PIXEL** troca o CONTEÚDO do script | é o `PixelConfig.id` que muda o texto |
 * | 2 | trocar de **ÁREA** troca a LISTA de pixels alcançáveis | o conteúdo de um pixel **não** muda com a área — só a visibilidade dele |
 *
 * O modo de falha da 2 é o pior dos dois: a tela stale entrega um script
 * **correto, de um pixel que não pertence à área ativa**. O arquivo passa em
 * qualquer conferência — ele é exatamente o que a ferramenta deveria gerar, só
 * que para outra operação. Quem denuncia é o Gerenciador de Eventos da Meta,
 * semanas depois.
 *
 * ⛔ Por isso `listPixels(workspaceId)` e `workspaceId` **nas deps do efeito**.
 * `npm run test:pixel-tela` tem guarda estática sobre as duas coisas.
 */

/* ───────────────────────── Vocabulário do diagnóstico ───────────────────── */

const SELO_DO_DIAGNOSTICO: Record<
  SnippetCheckDTO["estado"],
  { rotulo: string; tom: "success" | "warning" | "danger" | "neutral"; ajuda: string }
> = {
  ok: {
    rotulo: "conferido",
    tom: "success",
    ajuda: "O script instalado detecta exatamente o que está configurado aqui.",
  },
  divergente: {
    rotulo: "divergente",
    tom: "warning",
    ajuda:
      "O script que está no site é de uma configuração anterior. Recole o código para as mudanças valerem.",
  },
  "script-antigo": {
    rotulo: "script antigo",
    tom: "neutral",
    ajuda:
      "Ele está rodando, mas é de uma versão anterior a esta conferência — não dá para comparar. Recolar o código resolve.",
  },
  /* ⛔ `sem-dados` NUNCA é pintado como `ok`. A ausência de evento pode ser
     script ausente, site sem tráfego ou script quebrado, e não temos como
     distinguir os três. Dizer "tudo certo" aqui seria afirmar o que não sabemos
     — é o silêncio que este diagnóstico existe para acabar. */
  "sem-dados": {
    rotulo: "sem dados",
    tom: "neutral",
    ajuda:
      "Nenhum evento chegou deste pixel, então não há o que conferir. Pode ser script não instalado, site sem visitas, ou script com erro.",
  },
};

const TOM_DO_ESPELHO: Record<TomDoEspelho, "success" | "warning" | "danger" | "neutral"> = {
  bom: "success",
  atencao: "warning",
  ruim: "danger",
  neutro: "neutral",
};

/**
 * O caminho da URL, sem o domínio.
 *
 * ⚠️ `null` vira `—`, e não `/`: evento sem URL é o criado pelo SERVIDOR, e uma
 * barra ali diria "disparou na raiz do site", que é uma afirmação sobre onde a
 * pessoa estava. URL que não casa com o formato volta INTEIRA — melhor um texto
 * longo do que um pedaço arrancado por cirurgia de string.
 */
function caminhoDaUrl(url: string | null): string {
  if (!url) return "—";
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}

/* ──────────────────────────────── Mestre ─────────────────────────────────── */

function ItemDePixel({
  pixel,
  diagnostico,
  selecionado,
  alternando,
  aoSelecionar,
  aoAlternar,
}: {
  pixel: PixelConfigDTO;
  diagnostico: SnippetCheckDTO | null;
  selecionado: boolean;
  alternando: boolean;
  aoSelecionar: () => void;
  aoAlternar: () => void;
}) {
  const selo = diagnostico ? SELO_DO_DIAGNOSTICO[diagnostico.estado] : null;
  const metas = pixel.metaPixels.length;

  return (
    <div
      className="rounded-controle"
      style={{
        border: `1px solid ${selecionado ? "var(--tk-primary)" : "var(--tk-border)"}`,
        background: selecionado ? "var(--tk-tint-primary)" : "var(--tk-surface)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 10px 10px 12px",
      }}
    >
      <button
        type="button"
        onClick={aoSelecionar}
        aria-current={selecionado}
        className="text-left"
        style={{ flex: 1, minWidth: 0, background: "none", border: 0, padding: 0, cursor: "pointer" }}
      >
        <div className="text-label text-text" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {pixel.name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
          <span className="text-caption text-text-muted">
            {metas} {metas === 1 ? "pixel da Meta" : "pixels da Meta"}
          </span>
          {selo ? (
            <Badge tom={selo.tom} ponto title={selo.ajuda}>
              {selo.rotulo}
            </Badge>
          ) : (
            /* Enquanto a conferência não voltou, o lugar do selo fica com um
               esqueleto — não com "ok" nem com vazio. Um selo verde por default
               afirmaria o que ninguém mediu ainda. */
            <Skeleton largura={74} altura={16} />
          )}
        </div>
      </button>

      {/* O toggle é REAL (`togglePixel`), e desligado o pixel para de enviar. */}
      <Tooltip texto={pixel.enabled ? "Ligado — este pixel envia eventos" : "Desligado — nada é enviado"}>
        <button
          type="button"
          role="switch"
          aria-checked={pixel.enabled}
          aria-label={`${pixel.enabled ? "Desligar" : "Ligar"} o pixel ${pixel.name}`}
          disabled={alternando}
          onClick={aoAlternar}
          style={{
            flex: "none",
            width: 38,
            height: 22,
            padding: 2,
            borderRadius: "var(--tk-radius-pill)",
            border: "1px solid var(--tk-border)",
            background: pixel.enabled ? "var(--tk-primary-solid)" : "var(--tk-surface-hover)",
            cursor: alternando ? "wait" : "pointer",
            display: "flex",
            justifyContent: pixel.enabled ? "flex-end" : "flex-start",
            transition: "background-color var(--tk-dur-rapida) var(--tk-ease-padrao)",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              borderRadius: "var(--tk-radius-pill)",
              background: pixel.enabled ? "var(--tk-on-primary)" : "var(--tk-text-muted)",
              transition: "transform var(--tk-dur-rapida) var(--tk-ease-padrao)",
            }}
          />
        </button>
      </Tooltip>
    </div>
  );
}

/* ────────────────────────────── Diagnóstico ─────────────────────────────── */

function PainelDiagnostico({ check }: { check: SnippetCheckDTO | null }) {
  if (!check) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton altura={18} />
        <Skeleton altura={64} />
      </div>
    );
  }
  const selo = SELO_DO_DIAGNOSTICO[check.estado];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <Badge tom={selo.tom} ponto>
          {selo.rotulo}
        </Badge>
        <span className="text-caption text-text-muted">
          último evento do script <Desde quando={check.visto} vazio="— nenhum até agora" />
        </span>
      </div>

      <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
        {selo.ajuda}
      </p>

      {check.divergencias.length > 0 && (
        <ul
          className="text-caption rounded-controle"
          style={{
            margin: 0,
            padding: "10px 12px 10px 28px",
            background: "var(--tk-tint-warning)",
            color: "var(--tk-on-tint-warning)",
            border: "1px solid color-mix(in oklch, var(--tk-warning) 40%, transparent)",
            lineHeight: 1.6,
          }}
        >
          {check.divergencias.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}

      {/* ⚠️ A nota é NOTA, não divergência: um script de versão anterior pode
          estar perfeitamente correto — ele só não sabe reportar quem envia cada
          evento. Pintá-la de âmbar deixaria toda gaveta âmbar no dia do deploy. */}
      {check.nota && (
        <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
          {check.nota}
        </p>
      )}

      {/* 🔴 POR EVENTO, nunca agregado. Foi um agregado — "último evento recebido
          há 5 min", que era o PageView — que escondeu o InitiateCheckout morto
          por semanas. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {check.porEvento.map((e) => {
          const nuncaVeio = e.ligado && e.visto === null;
          return (
            <div
              key={e.evento}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                padding: "6px 0",
              }}
            >
              <span className={`text-caption ${e.ligado ? "text-text" : "text-text-muted"}`}>
                {e.evento}
                {!e.ligado && " · desligado"}
              </span>
              {nuncaVeio ? (
                /* Ligado e nunca recebido é O sinal desta lista: configurado,
                   esperado, e nada chegou. Desligado sem evento é o esperado, e
                   não alarma. */
                <Badge tom="warning">configurado e nunca recebido</Badge>
              ) : (
                <span className="text-caption text-text-muted" style={{ whiteSpace: "nowrap" }}>
                  {e.total > 0 ? `${e.total} · ` : ""}
                  <Desde quando={e.visto} vazio="—" />
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────── Lista de eventos ───────────────────────────── */

function ListaDeEventos({
  pixelId,
  /** Muda quando o pixel é salvo — a lista recarrega junto do diagnóstico. */
  versao,
}: {
  pixelId: string;
  versao: number;
}) {
  const [janela, setJanela] = React.useState<DiasDeJanela>(JANELA_PADRAO);
  const [tipo, setTipo] = React.useState<string>("");
  const [pagina, setPagina] = React.useState(1);
  const [porPagina, setPorPagina] = React.useState<PorPagina>(25);

  /* A carga é CARIMBADA com o que a produziu, e é a ÚNICA fonte — sem booleano
     de carregamento ao lado, que pode discordar do que está na tela. Enquanto o
     carimbo é de outra combinação, a página anterior continua desenhada, esmaecida:
     esvaziar a tabela a cada troca de filtro faria a lista piscar entre dois
     estados vazios que significam coisas diferentes. */
  const chave = `${pixelId}|${janela}|${tipo}|${pagina}|${porPagina}|${versao}`;
  const [carga, setCarga] = React.useState<{ chave: string; dados: PaginaDeEventos } | null>(null);

  React.useEffect(() => {
    let vivo = true;
    listarEventosDoPixel({
      pixelConfigId: pixelId,
      evento: tipo || null,
      janelaDias: janela,
      pagina,
      porPagina,
    })
      .then((d) => {
        if (vivo) setCarga({ chave, dados: d });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
    // `chave` já contém todos os insumos; repeti-los criaria uma segunda fonte.
  }, [chave, pixelId, tipo, janela, pagina, porPagina]);

  /** Trocar de filtro volta para a primeira página — a 4ª do filtro novo costuma
      não existir, e a tela abriria vazia por um motivo que não é o dado. */
  function trocarFiltro(aplicar: () => void) {
    aplicar();
    setPagina(1);
  }

  const carregando = carga === null || carga.chave !== chave;
  const linhas = carga?.dados.linhas ?? [];
  const total = carga?.dados.total ?? 0;
  const vazio = carregando
    ? null
    : motivoDoVazio({
        linhas: linhas.length,
        houveAlgumDia: carga.dados.houveAlgumDia,
        filtrado: Boolean(tipo),
      });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Select
          opcoes={[
            { valor: "", rotulo: "Todos os eventos" },
            ...EVENTOS_DO_PIXEL.map((e) => ({ valor: e, rotulo: e })),
          ]}
          valor={tipo}
          aoEscolher={(t) => trocarFiltro(() => setTipo(t))}
          blocoInteiro={false}
        />
        <Select
          opcoes={JANELAS.map((j) => ({ valor: String(j.dias), rotulo: `Últimos ${j.rotulo}` }))}
          valor={String(janela)}
          aoEscolher={(vl) => trocarFiltro(() => setJanela(Number(vl) as DiasDeJanela))}
          blocoInteiro={false}
        />
      </div>

      {carregando && linhas.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Skeleton altura={28} />
          <Skeleton altura={28} />
          <Skeleton altura={28} />
        </div>
      ) : vazio ? (
        <EmptyState titulo={TEXTO_DO_VAZIO[vazio].titulo} causa={TEXTO_DO_VAZIO[vazio].causa} />
      ) : (
        <>
          <div style={{ overflowX: "auto", opacity: carregando ? 0.55 : 1 }}>
            <table className="tk-ads">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }} className="text-caption text-text-secondary">
                    Evento
                  </th>
                  <th style={{ textAlign: "left" }} className="text-caption text-text-secondary">
                    Quando
                  </th>
                  <th style={{ textAlign: "left" }} className="text-caption text-text-secondary">
                    Espelho no pixel da página
                  </th>
                  {/* `Página` ABSORVE a folga, e é a coluna que justifica a
                      largura: sem ela as quatro se espalhavam em ilhas de texto
                      com vãos de 200px, e um vão dentro de um card promete
                      conteúdo. Ela também é a única que responde *onde* o evento
                      disparou — a informação estava no DTO e só existia no
                      `title`, invisível para quem não passa o mouse. */}
                  <th
                    style={{ textAlign: "left", width: "100%" }}
                    className="text-caption text-text-secondary"
                  >
                    Página
                  </th>
                  <th style={{ textAlign: "left" }} className="text-caption text-text-secondary">
                    Identificador
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => {
                  const esp = estadoDoEspelho(l.espelho ?? "nulo");
                  const amb = seloDeAmbiente(l.ambiente);
                  return (
                    <tr key={l.id}>
                      <td style={{ textAlign: "left" }} className="text-caption text-text">
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          {l.evento}
                          {/* Só quando NÃO é produção. Um selo "produção" em toda
                              linha afirmaria o que a coluna não garante — nulo ali
                              é "produção, ou não sabemos". */}
                          {amb && <Badge tom="warning">{amb}</Badge>}
                          {l.origem === "gateway" && <Badge tom="neutral">gateway</Badge>}
                        </span>
                      </td>
                      <td style={{ textAlign: "left" }} className="text-caption text-text-secondary">
                        <Desde quando={l.quando} />
                      </td>
                      <td style={{ textAlign: "left" }}>
                        <Tooltip texto={esp.ajuda}>
                          <span>
                            <Badge tom={TOM_DO_ESPELHO[esp.tom]} ponto>
                              {esp.rotulo}
                            </Badge>
                          </span>
                        </Tooltip>
                      </td>
                      <td
                        style={{ textAlign: "left", width: "100%", maxWidth: 0 }}
                        className="text-caption text-text-secondary"
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={l.url ?? undefined}
                        >
                          {caminhoDaUrl(l.url)}
                        </span>
                      </td>
                      <td
                        style={{ textAlign: "left", fontFamily: "var(--tk-font-mono)", maxWidth: 240 }}
                        className="text-caption text-text-muted"
                      >
                        <span
                          style={{
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={l.eventId ?? "sem identificador"}
                        >
                          {l.eventId ?? "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Paginacao
            total={total}
            pagina={pagina}
            porPagina={porPagina}
            aoTrocarPagina={setPagina}
            aoTrocarPorPagina={(n) => trocarFiltro(() => setPorPagina(n))}
            substantivo="eventos"
          />
        </>
      )}

      {/* A dívida fica VISÍVEL em vez de silenciosa: a lista mostra uma janela,
          e diz qual. Sem esta linha, uma lista curta pareceria "poucos eventos"
          quando na verdade é "poucos eventos NESTE período". */}
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
        Mostrando os eventos dos últimos{" "}
        {JANELAS.find((j) => j.dias === janela)?.rotulo ?? `${janela} dias`}. Eventos mais antigos
        continuam guardados e entram nos relatórios; eles só não são listados aqui.
      </p>
    </div>
  );
}

/* ──────────────────────────────── A tela ─────────────────────────────────── */

export function PixelScreen({ v }: { v: TraffikView }) {
  const workspaceId = v.workspaceAtiva;

  const [carga, setCarga] = React.useState<{
    ws: string | null;
    pixels: PixelConfigDTO[];
    produtos: string[];
    gateways: string[];
  } | null>(null);
  const [diagnosticos, setDiagnosticos] = React.useState<Record<string, SnippetCheckDTO>>({});
  const [selecionadoId, setSelecionadoId] = React.useState<string | null>(null);
  const [alternando, setAlternando] = React.useState<string | null>(null);
  const [excluindo, setExcluindo] = React.useState<PixelConfigDTO | null>(null);
  const [gaveta, setGaveta] = React.useState<{ pixel: PixelConfigDTO | null } | null>(null);
  const [salvando, setSalvando] = React.useState(false);
  const [erro, setErro] = React.useState<string | null>(null);
  const [versao, setVersao] = React.useState(0);

  /**
   * 🔴 `workspaceId` NAS DEPS.
   *
   * A assinatura do defeito registrada no `CLAUDE.md` é exatamente esta:
   * componente cliente + server action escopada por área + chamada **sem o
   * argumento** + `useEffect` com deps `[]`. Aqui isso não daria número velho:
   * daria a lista de pixels de OUTRA operação, com scripts válidos, prontos para
   * serem copiados para o site errado.
   */
  React.useEffect(() => {
    let vivo = true;
    Promise.all([listPixels(workspaceId), listTrackedProducts(), gatewaysComPixelProprio(workspaceId)])
      .then(([pixels, produtos, gateways]) => {
        if (vivo) setCarga({ ws: workspaceId, pixels, produtos, gateways });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [workspaceId, versao]);

  const daAreaAtual = carga !== null && carga.ws === workspaceId;
  const pixels = React.useMemo(() => (daAreaAtual ? carga.pixels : []), [daAreaAtual, carga]);
  const idsCarregados = daAreaAtual ? pixels.map((p) => p.id).join(",") : "";

  /* O diagnóstico dos pixels visíveis, numa chamada só. Uma por pixel seria N
     idas ao servidor para desenhar uma lista — e a ação já existe para fazer as
     N conferências do outro lado, onde elas custam uma consulta e não uma
     requisição. */
  React.useEffect(() => {
    if (!idsCarregados) return;
    let vivo = true;
    diagnosticoDosPixels(idsCarregados.split(","))
      .then((d) => {
        if (vivo) setDiagnosticos(d);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [idsCarregados]);

  /* O mapa guardado pode ser da ÁREA ANTERIOR por um quadro. O selo é lido por
     id, e ids não se repetem entre áreas — mas ler o mapa cru deixaria um selo
     de um pixel que ainda está na tela sobreviver a uma exclusão. Filtrar pelos
     ids carregados torna isso impossível, em vez de improvável. */
  const diagnosticoDe = (id: string): SnippetCheckDTO | null =>
    (daAreaAtual && diagnosticos[id]) || null;

  /* A seleção é DERIVADA quando o id guardado não está mais na área — trocar de
     área não pode deixar o painel de detalhe mostrando o pixel da área anterior,
     que é a forma 2 da restrição do artefato. */
  const selecionado = pixels.find((p) => p.id === selecionadoId) ?? pixels[0] ?? null;

  async function alternar(p: PixelConfigDTO) {
    setAlternando(p.id);
    try {
      const r = await togglePixel(p.id);
      setCarga((c) =>
        c === null ? c : { ...c, pixels: c.pixels.map((x) => (x.id === p.id ? { ...x, enabled: r.enabled } : x)) },
      );
    } catch {
      /* O selo não muda: a tela continua mostrando o estado do banco, e não um
         otimismo que ninguém confirmou. */
    } finally {
      setAlternando(null);
    }
  }

  async function salvar(input: PixelFormInput) {
    setSalvando(true);
    setErro(null);
    try {
      const alvo = gaveta?.pixel;
      const salvo = alvo
        ? await updatePixel(alvo.id, input)
        : // `workspaceId` só é lido na CRIAÇÃO (ver `PixelFormInput`): é aqui que
          // o pixel nasce dono de uma área, e nascer sem ela o jogaria na Principal.
          await createPixel({ ...input, workspaceId });
      setGaveta(null);
      setSelecionadoId(salvo.id);
      setVersao((n) => n + 1);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(p: PixelConfigDTO) {
    setExcluindo(null);
    await deletePixel(p.id);
    if (selecionadoId === p.id) setSelecionadoId(null);
    setVersao((n) => n + 1);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
      <div
        className="tk-pixel-colunas"
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(260px, 0.62fr) minmax(0, 1.7fr)",
          gap: "var(--tk-gap-grid)",
          /* `start`: a coluna do mestre termina onde a lista termina. Esticá-la
             empurraria o vão para DENTRO do cartão, e vão dentro de card promete
             conteúdo. */
          alignItems: "start",
        }}
      >
        <Card
          titulo="Pixels desta área"
          descricao="Cada pixel daqui pode disparar para vários pixels da Meta."
          acao={
            <Button variante="primario" onClick={() => setGaveta({ pixel: null })}>
              Novo pixel
            </Button>
          }
        >
          {!daAreaAtual ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Skeleton altura={58} />
              <Skeleton altura={58} />
            </div>
          ) : pixels.length === 0 ? (
            <EmptyState
              titulo="Nenhum pixel nesta área"
              causa="Um pixel liga o que acontece no seu site ao Facebook. Sem ele, as vendas continuam sendo registradas aqui, mas a Meta não recebe nada e a campanha otimiza no escuro."
              acao={{ texto: "Criar o primeiro pixel", aoClicar: () => setGaveta({ pixel: null }) }}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {pixels.map((p) => (
                <ItemDePixel
                  key={p.id}
                  pixel={p}
                  diagnostico={diagnosticoDe(p.id)}
                  selecionado={selecionado?.id === p.id}
                  alternando={alternando === p.id}
                  aoSelecionar={() => setSelecionadoId(p.id)}
                  aoAlternar={() => void alternar(p)}
                />
              ))}
            </div>
          )}
        </Card>

        {selecionado ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
            <Card
              titulo={selecionado.name}
              descricao="O script instalado no site bate com o que está configurado aqui?"
              acao={
                <div style={{ display: "flex", gap: 8 }}>
                  <Button variante="secundario" onClick={() => setGaveta({ pixel: selecionado })}>
                    Editar
                  </Button>
                  <Button
                    variante="fantasma"
                    apenasIcone
                    aria-label={`Excluir o pixel ${selecionado.name}`}
                    onClick={() => setExcluindo(selecionado)}
                  >
                    <Icone nome="excluir" tamanho={14} />
                  </Button>
                </div>
              }
            >
              <PainelDiagnostico check={diagnosticoDe(selecionado.id)} />
            </Card>

            <Card
              titulo="Eventos recebidos"
              descricao="O que o script mandou de verdade. É aqui que se vê se ele está disparando."
            >
              <ListaDeEventos pixelId={selecionado.id} versao={versao} />
            </Card>
          </div>
        ) : (
          daAreaAtual && (
            <Card>
              <EmptyState
                titulo="Nenhum pixel selecionado"
                causa="Crie um pixel ao lado para ver o diagnóstico do script e os eventos que ele enviou."
              />
            </Card>
          )
        )}
      </div>

      {/* A `key` remonta a gaveta a cada abertura: sem ela, abrir o pixel B logo
          depois do A mostraria o formulário de A por um quadro — e este é um
          formulário em que o conteúdo errado vira script errado. */}
      {gaveta && (
        <GavetaPixel
          key={gaveta.pixel?.id ?? "novo"}
          aberta
          pixel={gaveta.pixel}
          gatewaysComPixelProprio={daAreaAtual ? carga.gateways : []}
          produtos={daAreaAtual ? carga.produtos : []}
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
          pixel={excluindo}
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
 * ⚠️ O que não se perde é a metade que costuma faltar: sem ela, alguém deixa um
 * pixel errado no ar por achar que excluir apaga o histórico de vendas.
 */
function ConfirmarExclusao({
  pixel,
  aoCancelar,
  aoConfirmar,
}: {
  pixel: PixelConfigDTO;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}) {
  return (
    <Gaveta
      aberta
      titulo="Excluir este pixel?"
      descricao={pixel.name}
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
        O script instalado no seu site <strong>para de ser reconhecido</strong>: os eventos que ele
        mandar deixam de ser aceitos, e nada mais é enviado para a Meta por este pixel. Tire o código
        do site também.
      </p>
      <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
        Não se perde: as vendas já registradas, o faturamento, o funil e o Gerenciador continuam
        exatamente como estão.
      </p>
    </Gaveta>
  );
}
