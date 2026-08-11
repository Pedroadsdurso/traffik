"use client";

import * as React from "react";

import type { TraffikView } from "@/components/dashboard/useTraffikState";
import { getUtmCodes, type UtmCodesDTO } from "@/lib/actions/utm";
import { listPixels, togglePixel, type PixelConfigDTO } from "@/lib/actions/pixels";
import { getPublicAppUrl } from "@/lib/appUrl";
import {
  AJUDA_UTM,
  CHAVES_UTM,
  EXEMPLO_UTM,
  ROTULO_UTM,
  montarUrl,
  type ChaveUtm,
  type EntradaUtm,
} from "@/lib/utm/construir";
import { armazemUtm, type ModeloUtm } from "@/lib/utm/armazem";
import { montarInventario, rotuloUsadoEm, type SnippetReal } from "@/lib/utm/inventario";
import { Icone } from "@/components/dashboard/ui/Icone";
import { LogoGateway } from "@/components/dashboard/ui/LogoGateway";
import { Abas } from "@/components/tk/Abas";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { Card } from "@/components/tk/Card";
import { CodigoDestacado } from "@/components/tk/CodigoDestacado";
import { Desde } from "@/components/tk/Desde";
import { EmptyState } from "@/components/tk/EmptyState";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";
import { Tooltip } from "@/components/tk/Tooltip";

/* ─────────────────────────── Cor de cada parâmetro ───────────────────────────
   Um tingimento por chave, dos sete pares que já existem no `globals.css`. ⛔
   Nenhum token novo: variável inexistente cai no fallback em silêncio, e um chip
   sem cor seria indistinguível de um chip que ninguém pintou. */
const TOM_DO_PARAMETRO: Record<ChaveUtm, string> = {
  utm_source: "primary",
  utm_medium: "accent",
  utm_campaign: "category",
  utm_term: "warning",
  utm_content: "success",
  utm_id: "neutral",
};

/**
 * O logotipo que aparece dentro do campo Fonte, como na imagem 7.
 *
 * ⚠️ Só entram as plataformas de que temos ARTE (`LogoGateway`). Google e TikTok
 * não têm arquivo, e o `LogoGateway` cairia no monograma — um "G" num quadrado
 * roxo ao lado da palavra "google" não informa nada e parece logotipo quebrado.
 * Sem arte, o campo fica sem ícone, que é o estado honesto.
 */
const LOGO_DA_FONTE: Record<string, string> = {
  facebook: "FACEBOOK",
  fb: "FACEBOOK",
  meta: "FACEBOOK",
  instagram: "FACEBOOK",
  hotmart: "HOTMART",
  cartpanda: "CARTPANDA",
  kiwify: "KIWIFY",
  kirvano: "KIRVANO",
  cakto: "CAKTO",
  onyxpag: "ONYXPAG",
};

/** Estado do formulário. Só strings — o guarda de runtime é do `montarUrl`. */
type Formulario = { base: string } & Record<ChaveUtm, string>;

const FORMULARIO_VAZIO: Formulario = {
  base: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
  utm_id: "",
};

function useCopiar(): [(texto: string, id: string) => void, string | null] {
  const [copiado, setCopiado] = React.useState<string | null>(null);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copiar = React.useCallback((texto: string, id: string) => {
    if (!texto) return;
    void navigator.clipboard?.writeText(texto);
    setCopiado(id);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiado(null), 1600);
  }, []);

  return [copiar, copiado];
}

/** Reagenda a tela quando o armazém muda. Ele não é estado do React. */
function useArmazem(): number {
  const [versao, setVersao] = React.useState(0);
  React.useEffect(() => armazemUtm.observar(() => setVersao((n) => n + 1)), []);
  return versao;
}

/* ═════════════════════════════ ABA 1 — UTM BUILDER ═════════════════════════ */

function ChipParametro({ chave, valor }: { chave: ChaveUtm; valor: string }) {
  const tom = TOM_DO_PARAMETRO[chave];
  return (
    <span
      className="rounded-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 9px",
        fontSize: 11.5,
        fontFamily: "var(--tk-font-mono)",
        lineHeight: 1.5,
        maxWidth: "100%",
        background: `var(--tk-tint-${tom})`,
        color: `var(--tk-on-tint-${tom})`,
        border: `1px solid color-mix(in oklch, var(--tk-on-tint-${tom}) 28%, transparent)`,
      }}
      title={`${ROTULO_UTM[chave]}: ${valor}`}
    >
      <span style={{ opacity: 0.85 }}>{chave}=</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{valor}</span>
    </span>
  );
}

function GeradorDeUtm({
  form,
  aoMudar,
  aoLimpar,
  aoGerar,
}: {
  form: Formulario;
  aoMudar: (campo: keyof Formulario, valor: string) => void;
  aoLimpar: () => void;
  aoGerar: () => void;
}) {
  return (
    <Card
      titulo="Gerador de UTM"
      descricao="Preencha os campos e gere sua URL com parâmetros de rastreamento."
      preencher
    >
      {/* 🎯 A LINHA DE AÇÃO AFUNDA PARA O RODAPÉ quando sobra altura.
          `space-between` com DOIS filhos — os campos num bloco só, e a barra de
          botões no outro. Com três filhos ele espalharia o miolo do formulário,
          que é o oposto do que se quer: campo tem de ficar junto de campo. */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Input
          rotulo="Endereço de destino"
          value={form.base}
          onChange={(e) => aoMudar("base", e.target.value)}
          placeholder="https://seudominio.com/checkout"
          apoio="A página para onde o anúncio leva."
          inputMode="url"
        />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          {CHAVES_UTM.map((c) => (
            <Input
              key={c}
              rotulo={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                  {ROTULO_UTM[c]}
                  <Tooltip texto={AJUDA_UTM[c]}>
                    <span
                      aria-label={`O que é ${ROTULO_UTM[c]}`}
                      style={{ display: "inline-flex", cursor: "help", color: "var(--tk-text-muted)" }}
                    >
                      <Icone nome="info" tamanho={12} />
                    </span>
                  </Tooltip>
                </span>
              }
              value={form[c]}
              onChange={(e) => aoMudar(c, e.target.value)}
              placeholder={`Ex: ${EXEMPLO_UTM[c]}`}
              iconeInicio={
                c === "utm_source" && LOGO_DA_FONTE[form.utm_source.trim().toLowerCase()] ? (
                  <LogoGateway
                    id={LOGO_DA_FONTE[form.utm_source.trim().toLowerCase()]}
                    nome={form.utm_source}
                    tamanho={16}
                  />
                ) : undefined
              }
            />
          ))}
        </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap" }}>
          <Button
            variante="fantasma"
            onClick={aoLimpar}
            iconeInicio={<Icone nome="excluir" tamanho={14} />}
          >
            Limpar campos
          </Button>
          <Button variante="primario" onClick={aoGerar} iconeInicio={<Icone nome="link" tamanho={14} />}>
            Gerar URL
          </Button>
        </div>
      </div>
    </Card>
  );
}

function UrlGerada({
  form,
  aoSalvarModelo,
}: {
  form: Formulario;
  aoSalvarModelo: (nome: string) => void;
}) {
  const [copiar, copiado] = useCopiar();
  const [nomeModelo, setNomeModelo] = React.useState("");

  const montada = React.useMemo(() => montarUrl(form as EntradaUtm), [form]);

  const selo =
    montada.estado === "valida" ? (
      <Badge tom="success" ponto>
        Válida
      </Badge>
    ) : montada.estado === "invalida" ? (
      <Badge tom="danger" ponto>
        Inválida
      </Badge>
    ) : (
      <Badge tom="neutral" ponto>
        Incompleta
      </Badge>
    );

  return (
    <Card titulo="URL gerada" acao={selo}>
      {/* ⛔ SEM `preencher` e SEM `space-between`, de propósito. Ver o wrapper do
          `Gerador` na tela: aqui o vão ficaria entre a Visualização e o `Salvar
          como modelo`, cercado de conteúdo dos dois lados, e leria como se a
          visualização devesse continuar. Este cartão termina onde acaba. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {montada.url ? (
          <div style={{ position: "relative" }}>
            <div
              className="bg-background border border-border rounded-controle"
              style={{
                padding: "12px 44px 12px 12px",
                fontFamily: "var(--tk-font-mono)",
                fontSize: 11.5,
                lineHeight: 1.7,
                /* A URL QUEBRA, ao contrário do código: ela é uma coisa só e o
                   usuário precisa ver o fim dela para conferir o destino. */
                wordBreak: "break-all",
                color: "var(--tk-text)",
              }}
            >
              {montada.url}
            </div>
            <div style={{ position: "absolute", top: 8, right: 8 }}>
              <Button
                variante="fantasma"
                apenasIcone
                aria-label="Copiar a URL gerada"
                onClick={() => copiar(montada.url, "url")}
                title={copiado === "url" ? "Copiado!" : "Copiar"}
              >
                <Icone nome={copiado === "url" ? "ok" : "link"} tamanho={14} />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className="bg-background border border-border rounded-controle"
            style={{ padding: 16, textAlign: "center" }}
          >
            <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.6 }}>
              {montada.problemas[0] ?? "Preencha o endereço de destino para ver a URL."}
            </p>
          </div>
        )}

        {/* 🔴 O descarte é DENUNCIADO, nunca engolido. É o guarda do
            `[object Object]` chegando à tela: se ele disparar, quem está com o
            arquivo aberto sabe qual campo produziu o valor não-texto. */}
        {montada.descartados.length > 0 && (
          <div
            className="rounded-controle"
            style={{
              padding: "10px 12px",
              background: "var(--tk-tint-danger)",
              border: "1px solid color-mix(in oklch, var(--tk-danger) 45%, transparent)",
              color: "var(--tk-on-tint-danger)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            <strong>Campo com valor inválido.</strong> {montada.descartados.join(", ")} não é texto e
            ficou fora da URL — ela sairia com um valor que não significa nada.
          </div>
        )}

        <div>
          <div className="text-label text-text-secondary" style={{ marginBottom: 8 }}>
            Visualização
          </div>
          {montada.parametros.length === 0 ? (
            <p className="text-caption text-text-muted" style={{ margin: 0 }}>
              Cada parâmetro preenchido vira um chip aqui.
            </p>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {montada.parametros.map((p) => (
                <ChipParametro key={p.chave} chave={p.chave} valor={p.valor} />
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: "1px solid var(--tk-border)", paddingTop: 14 }}>
          <div className="text-label text-text-secondary" style={{ marginBottom: 8 }}>
            Salvar como modelo
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <Input
              value={nomeModelo}
              onChange={(e) => setNomeModelo(e.target.value)}
              placeholder="Ex: Facebook — Lançamento Pro"
              aria-label="Nome do modelo"
            />
            <Button
              variante="secundario"
              disabled={!nomeModelo.trim() || montada.parametros.length === 0}
              onClick={() => {
                aoSalvarModelo(nomeModelo);
                setNomeModelo("");
              }}
            >
              Salvar modelo
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/**
 * Aviso de que nada é guardado.
 *
 * ⛔ O texto DERIVA de `armazemUtm.persiste`. Escrever a frase à mão faria dela
 * uma segunda fonte de verdade — e no dia em que a tabela existir a tela
 * continuaria dizendo que não guarda.
 */
function AvisoDeSessao() {
  if (armazemUtm.persiste) return null;
  return (
    <p
      className="text-caption text-text-muted"
      style={{ margin: 0, lineHeight: 1.6, paddingTop: 10, borderTop: "1px solid var(--tk-border)" }}
    >
      Os modelos funcionam nesta sessão e ainda não são guardados: eles somem ao recarregar a página.
    </p>
  );
}

function HistoricoRecente() {
  useArmazem();
  const itens = armazemUtm.listarHistorico();

  return (
    <Card titulo="Histórico recente">
      {itens.length === 0 ? (
        <EmptyState
          titulo="Nada gerado ainda"
          causa="Cada URL que você gerar aparece aqui, com a hora e a origem."
          compacto
        />
      ) : (
        /* ⛔ O TETO É DA LISTA, não da coluna. Ele nasceu de altura herdada do
           grid, e altura herdada some no dia em que o layout mudar — foi o que
           aconteceu ao voltar para `alignItems: start`. Rolagem que só existe
           quando o vizinho é alto é rolagem por acidente. Com `maxHeight` ela
           dispara pelo próprio conteúdo: o histórico guarda até 12 entradas. */
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 260, overflowY: "auto" }}>
          {itens.map((h) => (
            <div
              key={h.id}
              className="tk-linha"
              style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "8px 6px", minWidth: 0 }}
            >
              <span
                className="text-caption text-text-muted"
                style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", paddingTop: 1 }}
              >
                <Desde quando={h.em} />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="text-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {h.source ?? "—"} / {h.medium ?? "—"}
                </div>
                <div
                  className="text-caption text-text-muted"
                  style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {h.campanha ?? "sem campanha"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ModelosFavoritos({ aoAplicar }: { aoAplicar: (m: ModeloUtm) => void }) {
  useArmazem();
  const modelos = armazemUtm.listarModelos();

  return (
    <Card titulo="Modelos favoritos">
      {modelos.length === 0 ? (
        <>
          <EmptyState
            titulo="Nenhum modelo salvo"
            causa="Preencha o gerador e use “Salvar como modelo” para reaproveitar a combinação."
            compacto
          />
          <AvisoDeSessao />
        </>
      ) : (
        <>
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 260, overflowY: "auto" }}>
          {modelos.map((m) => (
            <div
              key={m.id}
              className="tk-linha"
              style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 6px", minWidth: 0 }}
            >
              <button
                type="button"
                onClick={() => armazemUtm.alternarFavorito(m.id)}
                aria-label={m.favorito ? `Desmarcar ${m.nome}` : `Marcar ${m.nome}`}
                style={{
                  display: "flex",
                  background: "none",
                  border: "none",
                  padding: 2,
                  cursor: "pointer",
                  color: m.favorito ? "var(--tk-on-tint-warning)" : "var(--tk-text-muted)",
                }}
              >
                <Icone nome="destaque" tamanho={14} />
              </button>
              <button
                type="button"
                onClick={() => aoAplicar(m)}
                style={{
                  minWidth: 0,
                  flex: 1,
                  textAlign: "left",
                  background: "none",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  color: "inherit",
                }}
              >
                <div className="text-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.nome}
                </div>
                <div className="text-caption text-text-muted" style={{ fontFamily: "var(--tk-font-mono)", fontSize: 10.5 }}>
                  {m.campos.utm_source ?? "—"} / {m.campos.utm_medium ?? "—"}
                </div>
              </button>
              <Button
                variante="fantasma"
                apenasIcone
                aria-label={`Excluir o modelo ${m.nome}`}
                onClick={() => armazemUtm.removerModelo(m.id)}
              >
                <Icone nome="excluir" tamanho={13} />
              </Button>
            </div>
          ))}
        </div>
        {/* ⛔ O aviso fica FORA da área que rola. Ele é a declaração de que nada
            é guardado — se descesse com a lista, o usuário com muitos modelos
            nunca o veria, que é exatamente quem mais precisa da informação. */}
        <AvisoDeSessao />
        </>
      )}
    </Card>
  );
}

function ComoUsar() {
  return (
    <Card>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {/* §13 do `06`: quadrado arredondado, tingimento NEUTRO — ele ilustra um
            bloco, não classifica uma linha. */}
        <span
          className="rounded-controle"
          style={{
            display: "grid",
            placeItems: "center",
            width: 36,
            height: 36,
            flexShrink: 0,
            background: "var(--tk-tint-neutral)",
            color: "var(--tk-on-tint-neutral)",
          }}
        >
          <Icone nome="info" tamanho={18} />
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="text-label">Como usar UTMs e Snippets</div>
          <p className="text-caption text-text-muted" style={{ margin: "3px 0 10px", lineHeight: 1.6 }}>
            Os parâmetros dizem de onde veio cada visita; os snippets levam essa informação do
            anúncio até a venda.
          </p>
          <Button variante="secundario" href="/dashboard/integracoes" iconeFim={<Icone nome="link" tamanho={13} />}>
            Ver as integrações
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ═════════════════════════════ ABA 2 — SNIPPETS ════════════════════════════ */

function SeloDoSnippet({ s }: { s: SnippetReal }) {
  if (s.estado.tipo === "ligavel") {
    return (
      <Badge tom={s.estado.ligado ? "success" : "neutral"} ponto>
        {s.estado.ligado ? "Ativo" : "Desligado"}
      </Badge>
    );
  }
  /* ⚠️ "Não detectado" ≠ "quebrado". Área sem tráfego dá o mesmo zero de um
      script mal instalado, e o produto não distingue os dois — a tooltip diz
      isso por extenso, em vez de a cor sugerir defeito. */
  return (
    <Tooltip
      texto={
        s.estado.detectado
          ? "Já chegou visita marcada com esta área — o script está reportando."
          : "Nenhuma visita marcada com esta área chegou ainda. Pode ser script não instalado, ou apenas ausência de tráfego: não temos como distinguir os dois."
      }
    >
      <span style={{ display: "inline-flex" }}>
        <Badge tom={s.estado.detectado ? "success" : "neutral"} ponto>
          {s.estado.detectado ? "Instalado" : "Não detectado"}
        </Badge>
      </span>
    </Tooltip>
  );
}

function TabelaSnippets({
  itens,
  selecionado,
  aoSelecionar,
  aoAlternar,
  alternando,
}: {
  itens: SnippetReal[];
  selecionado: string | null;
  aoSelecionar: (id: string) => void;
  aoAlternar: (s: SnippetReal) => void;
  alternando: string | null;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
        <thead>
          <tr>
            {["Nome", "Categoria", "Tipo", "Usado em", "Estado"].map((h, i) => (
              <th
                key={h}
                className="text-caption text-text-muted"
                style={{
                  textAlign: i >= 3 ? "right" : "left",
                  fontWeight: 500,
                  padding: "0 10px 8px",
                  borderBottom: "1px solid var(--tk-border)",
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {itens.map((s) => (
            <tr
              key={s.id}
              className="tk-linha"
              onClick={() => aoSelecionar(s.id)}
              style={{
                cursor: "pointer",
                background: selecionado === s.id ? "var(--tk-tint-primary)" : undefined,
              }}
            >
              <td style={{ padding: "10px", minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span
                    className="rounded-controle"
                    style={{
                      display: "grid",
                      placeItems: "center",
                      width: 28,
                      height: 28,
                      flexShrink: 0,
                      background: "var(--tk-tint-neutral)",
                      color: "var(--tk-on-tint-neutral)",
                    }}
                  >
                    <Icone nome={s.categoria === "Anúncio" ? "anuncios" : "link"} tamanho={14} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="text-label" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.nome}
                    </div>
                    {/* §14.4 — sub-rótulo qualifica sem gastar coluna. */}
                    {s.porArea && (
                      <div className="text-caption text-text-muted">muda com a área ativa</div>
                    )}
                  </div>
                </div>
              </td>
              <td style={{ padding: "10px" }}>
                <Badge tom="category">{s.categoria}</Badge>
              </td>
              <td className="text-caption text-text-secondary" style={{ padding: "10px", whiteSpace: "nowrap" }}>
                {s.tipo}
              </td>
              <td
                className="text-caption text-text-secondary"
                style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}
              >
                {rotuloUsadoEm(s)}
              </td>
              <td style={{ padding: "10px", textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <SeloDoSnippet s={s} />
                  {/* ⛔ O toggle só existe onde há coluna E ação que a escreve.
                      Nos de UTM não há nenhuma das duas: quatro toggles inertes
                      ali seriam o defeito que esta base remove há dez sessões. */}
                  {s.estado.tipo === "ligavel" && (
                    <Button
                      variante="fantasma"
                      apenasIcone
                      aria-label={`${s.estado.ligado ? "Desligar" : "Ligar"} ${s.nome}`}
                      carregando={alternando === s.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        aoAlternar(s);
                      }}
                    >
                      <Icone nome={s.estado.ligado ? "ok" : "bloqueado"} tamanho={14} />
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PainelDoSnippet({ s }: { s: SnippetReal | null }) {
  const [copiar, copiado] = useCopiar();

  if (!s) {
    return (
      <Card preencher distribuir>
        <EmptyState titulo="Escolha um snippet" causa="O código dele aparece aqui, pronto para copiar." />
      </Card>
    );
  }

  return (
    <Card
      titulo={s.nome}
      descricao={s.descricao}
      acao={
        <Button
          variante="secundario"
          disabled={!s.codigo}
          onClick={() => copiar(s.codigo, s.id)}
          iconeInicio={<Icone nome={copiado === s.id ? "ok" : "link"} tamanho={13} />}
        >
          {copiado === s.id ? "Copiado!" : "Copiar"}
        </Button>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12 }}>
          {[
            ["Categoria", s.categoria],
            ["Tipo", s.tipo],
            ["Usado em", rotuloUsadoEm(s)],
          ].map(([r, val]) => (
            <div key={r}>
              <div className="text-caption text-text-muted">{r}</div>
              <div className="text-label">{val}</div>
            </div>
          ))}
          <div>
            <div className="text-caption text-text-muted">Estado</div>
            <div style={{ marginTop: 2 }}>
              <SeloDoSnippet s={s} />
            </div>
          </div>
        </div>

        <div
          style={{ display: "flex", gap: 9, alignItems: "flex-start", paddingTop: 12, borderTop: "1px solid var(--tk-border)" }}
        >
          <span style={{ color: "var(--tk-text-muted)", display: "flex", paddingTop: 1 }}>
            <Icone nome="local" tamanho={14} />
          </span>
          <p className="text-caption text-text-secondary" style={{ margin: 0, lineHeight: 1.6 }}>
            <strong>Onde colar:</strong> {s.ondeColar}
          </p>
        </div>

        {s.porArea && (
          <div
            className="rounded-controle"
            style={{
              padding: "10px 12px",
              background: "var(--tk-tint-warning)",
              border: "1px solid color-mix(in oklch, var(--tk-warning) 45%, transparent)",
              color: "var(--tk-on-tint-warning)",
              fontSize: 12.5,
              lineHeight: 1.55,
            }}
          >
            Este código carrega a área ativa. Copiado com a área errada, ele carimba as visitas
            daquela página na operação errada — e só aparece depois, no relatório.
          </div>
        )}

        <div>
          <div className="text-label text-text-secondary" style={{ marginBottom: 8 }}>
            Prévia do código
          </div>
          {s.codigo ? (
            <CodigoDestacado codigo={s.codigo} linguagem={s.linguagem} />
          ) : (
            <EmptyState
              titulo="Falta o endereço"
              causa="Informe a URL da sua página de back redirect na aba UTM Builder para gerar este script."
              compacto
            />
          )}
        </div>
      </div>
    </Card>
  );
}

/* ═════════════════════════════════ A TELA ══════════════════════════════════ */

/**
 * UTM & Snippets — área de primeiro nível.
 *
 * > ### 🔴 AS DUAS ABAS ENTREGAM TEXTO QUE VAI PARA O SITE DO CLIENTE
 * >
 * > Por isso a tela recebe `workspaceId` e refaz a busca quando ele muda. A
 * > assinatura do defeito está registrada no `CLAUDE.md`: componente cliente +
 * > server action escopada por área + chamada **sem o argumento** + `useEffect`
 * > com deps `[]`. As três primeiras estão aqui; a quarta é o que este arquivo
 * > não pode ter.
 * >
 * > `npm run test:utm-tela` prova pelo efeito, não pela presença da prop: com
 * > duas áreas diferentes, o `WS` embutido no script **tem de mudar**.
 */
export function UtmSnippetsScreen({ v }: { v: TraffikView }) {
  const workspaceId = v.workspaceAtiva;

  const [aba, setAba] = React.useState<"builder" | "snippets">("builder");
  const [form, setForm] = React.useState<Formulario>(FORMULARIO_VAZIO);
  /**
   * O carregado vem CARIMBADO com a área de onde veio.
   *
   * ⛔ Não existe um `setCarregando(true)` no corpo do efeito, e não é só para
   * calar o lint: o carimbo torna impossível a tela mostrar o artefato da área
   * ANTERIOR enquanto o da nova não chegou. Um booleano separado seria uma
   * segunda fonte de verdade sobre "isto é da área certa?" — e é exatamente
   * essa pergunta que não pode ter duas respostas aqui.
   */
  const [carga, setCarga] = React.useState<{
    ws: string | null;
    codigos: UtmCodesDTO | null;
    pixels: PixelConfigDTO[];
  } | null>(null);
  const [urlBack, setUrlBack] = React.useState("");
  const [selecionado, setSelecionado] = React.useState<string | null>(null);
  const [busca, setBusca] = React.useState("");
  const [categoria, setCategoria] = React.useState<"todas" | "UTM" | "Pixel" | "Anúncio">("todas");
  const [alternando, setAlternando] = React.useState<string | null>(null);

  // 🔴 `workspaceId` NAS DEPS. Ver o cabeçalho: é o que separa "artefato certo"
  // de "instalação errada e permanente na página de outra pessoa".
  React.useEffect(() => {
    let vivo = true;
    Promise.all([getUtmCodes(workspaceId), listPixels(workspaceId)])
      .then(([c, p]) => {
        if (vivo) setCarga({ ws: workspaceId, codigos: c, pixels: p });
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [workspaceId]);

  /* Derivado, nunca gravado: carga ausente OU de outra área = ainda carregando.
     É a mesma corrente que o `test:utm-tela` percorre. */
  const daAreaAtual = carga !== null && carga.ws === workspaceId;
  const carregando = !daAreaAtual;
  const codigos = daAreaAtual ? carga.codigos : null;
  const pixels = React.useMemo(() => (daAreaAtual ? carga.pixels : []), [daAreaAtual, carga]);

  const apiBase = getPublicAppUrl();
  const inventario = React.useMemo(
    () => montarInventario({ codigos, pixels, apiBase, urlBackRedirect: urlBack }),
    [codigos, pixels, apiBase, urlBack],
  );

  const filtrados = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return inventario.filter(
      (s) =>
        (categoria === "todas" || s.categoria === categoria) &&
        (!termo || s.nome.toLowerCase().includes(termo) || s.descricao.toLowerCase().includes(termo)),
    );
  }, [inventario, busca, categoria]);

  const atual = filtrados.find((s) => s.id === selecionado) ?? filtrados[0] ?? null;

  function mudar(campo: keyof Formulario, valor: string) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function gerar() {
    const montada = montarUrl(form as EntradaUtm);
    if (montada.estado !== "valida") return;
    armazemUtm.registrarNoHistorico({
      url: montada.url,
      source: form.utm_source.trim() || null,
      medium: form.utm_medium.trim() || null,
      campanha: form.utm_campaign.trim() || null,
    });
  }

  function aplicarModelo(m: ModeloUtm) {
    // A base NÃO vem do modelo: ela é da oferta, não da convenção de nomes.
    setForm((f) => ({ ...FORMULARIO_VAZIO, ...m.campos, base: f.base }));
  }

  async function alternarPixel(s: SnippetReal) {
    const id = s.id.replace(/^pixel-/, "");
    setAlternando(s.id);
    try {
      const r = await togglePixel(id);
      setCarga((c) =>
        c === null
          ? c
          : { ...c, pixels: c.pixels.map((p) => (p.id === id ? { ...p, enabled: r.enabled } : p)) },
      );
    } catch {
      /* Silêncio aqui é aceitável: o selo não muda, então a tela continua
         mostrando o estado real do banco em vez de um otimismo não confirmado. */
    } finally {
      setAlternando(null);
    }
  }

  const pixelsAtivos = inventario.filter((s) => s.estado.tipo === "ligavel" && s.estado.ligado).length;
  const pixelsTotal = inventario.filter((s) => s.estado.tipo === "ligavel").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
      <Abas
        abas={[
          { id: "builder", rotulo: "UTM Builder" },
          { id: "snippets", rotulo: "Snippets", contagem: inventario.length },
        ] as const}
        ativa={aba}
        aoTrocar={setAba}
        rotuloAcessivel="Seções de UTM & Snippets"
      />

      {aba === "builder" ? (
        <div
          className="tk-utm-colunas"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.05fr) minmax(0, 1fr) minmax(240px, 0.72fr)",
            gap: "var(--tk-gap-grid)",
            /* 🎯 `start`: cada coluna termina onde o conteúdo dela termina, e a
               borda de baixo da fileira fica IRREGULAR. É o retrato honesto de
               três conteúdos de tamanhos diferentes.

               ⛔ Isto já foi `stretch` por meio commit, em 11/08/2026, e a
               reversão tem motivo escrito — ver o bloco `VÃO DENTRO DE CARD` no
               `CLAUDE.md`. Alinhar a borda empurrava o mesmo vão para DENTRO dos
               cartões, e vão dentro de card **promete conteúdo**: no `URL gerada`
               ele caía entre a Visualização e o Salvar como modelo, e lia como se
               a visualização devesse continuar até ali.

               A exceção é o `Gerador`, e ela está anotada no próprio wrapper. */
            alignItems: "start",
          }}
        >
          {/* ⚖️ A ÚNICA COLUNA QUE ESTICA, e a diferença não é gosto.
              O vão do `Gerador` tem CHÃO: a barra `Limpar campos` / `Gerar URL`
              fica embaixo dele, e um vão com barra de ação embaixo lê como rodapé
              de formulário. O do `URL gerada` tinha teto e chão de CONTEÚDO —
              chips em cima, `Salvar como modelo` embaixo —, e aí ele promete
              conteúdo que não existe. Mesma quantidade de pixels, duas leituras. */}
          <div style={{ alignSelf: "stretch", display: "flex", minWidth: 0 }}>
          <GeradorDeUtm
            form={form}
            aoMudar={mudar}
            aoLimpar={() => setForm(FORMULARIO_VAZIO)}
            aoGerar={gerar}
          />
          </div>
          <UrlGerada
            form={form}
            aoSalvarModelo={(nome) => {
              /* Os campos são ENUMERADOS a partir de `CHAVES_UTM`, não obtidos
                 por resto do formulário. Com o resto, todo campo novo que entrar
                 no formulário (uma nota, um destino) passaria a ser gravado no
                 modelo em silêncio — e o modelo é o que o usuário reaplica. */
              const campos: EntradaUtm = {};
              for (const c of CHAVES_UTM) campos[c] = form[c];
              armazemUtm.salvarModelo(nome, campos);
            }}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
            <HistoricoRecente />
            <ModelosFavoritos aoAplicar={aplicarModelo} />
            <ComoUsar />
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)", minWidth: 0 }}>
          {/* ⚠️ TRÊS medidores, não os quatro da imagem 8. `Execuções (30 dias)`
              somaria `PixelEvent` (pixel) com `Click` (nosso script) — dois
              instrumentos num número só, que é o defeito que o funil pagou.
              `Atualizados (30 dias)` precisa de data por snippet, e os gerados
              sob demanda não têm. Os dois estão 🔧 no `04`. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "var(--tk-gap-grid)" }}>
            <Card>
              <div className="text-caption text-text-muted">Total de snippets</div>
              <div className="text-h2" style={{ fontVariantNumeric: "tabular-nums" }}>{inventario.length}</div>
              <div className="text-caption text-text-muted">gerados para esta conta</div>
            </Card>
            <Card>
              <div className="text-caption text-text-muted">Pixels ativos</div>
              <div className="text-h2" style={{ fontVariantNumeric: "tabular-nums" }}>
                {pixelsAtivos}
                <span className="text-caption text-text-muted"> / {pixelsTotal}</span>
              </div>
              <div className="text-caption text-text-muted">com o envio ligado</div>
            </Card>
            <Card>
              <div className="text-caption text-text-muted">Rastreamento desta área</div>
              <div className="text-h2">{codigos?.cliquesComArea ? "Ativo" : "Sem sinal"}</div>
              <div className="text-caption text-text-muted">
                {codigos
                  ? `${codigos.cliquesComArea} visita(s) marcada(s) com ${codigos.workspaceName}`
                  : "—"}
              </div>
            </Card>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ minWidth: 220, flex: "0 1 320px" }}>
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar snippets…"
                aria-label="Buscar snippets"
                iconeInicio={<Icone nome="info" tamanho={13} />}
              />
            </div>
            <Select
              opcoes={[
                { valor: "todas", rotulo: "Todas as categorias" },
                { valor: "UTM", rotulo: "UTM" },
                { valor: "Pixel", rotulo: "Pixel" },
                { valor: "Anúncio", rotulo: "Anúncio" },
              ]}
              valor={categoria}
              aoEscolher={(c) => setCategoria(c as typeof categoria)}
              blocoInteiro={false}
            />
          </div>

          <div
            className="tk-utm-mestre"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) minmax(320px, 0.92fr)",
              gap: "var(--tk-gap-grid)",
              alignItems: "start",
            }}
          >
            <Card semPadding>
              <div style={{ padding: "var(--tk-pad-card)" }}>
                {carregando ? (
                  <EmptyState titulo="Carregando…" causa="Buscando os snippets desta área." compacto />
                ) : filtrados.length === 0 ? (
                  <EmptyState
                    titulo={busca.trim() ? "Nada com esse nome" : "Nenhum snippet nesta categoria"}
                    causa={
                      busca.trim()
                        ? "Nenhum snippet bate com a busca."
                        : "Troque a categoria para ver os outros."
                    }
                    compacto
                  />
                ) : (
                  <TabelaSnippets
                    itens={filtrados}
                    selecionado={atual?.id ?? null}
                    aoSelecionar={setSelecionado}
                    aoAlternar={alternarPixel}
                    alternando={alternando}
                  />
                )}
              </div>

              {/* O endereço do back redirect mora aqui porque é ele que produz
                  um dos snippets da lista — pedir num lugar e entregar em outro
                  faria o cartão vazio parecer defeito. */}
              <div style={{ padding: "0 var(--tk-pad-card) var(--tk-pad-card)" }}>
                <Input
                  rotulo="Endereço da sua página de back redirect"
                  value={urlBack}
                  onChange={(e) => setUrlBack(e.target.value)}
                  placeholder="https://seusite.com/oferta-especial"
                  apoio="Preenchendo aqui, o snippet de back redirect passa a ter código."
                />
              </div>
            </Card>

            <PainelDoSnippet s={atual} />
          </div>
        </div>
      )}
    </div>
  );
}
