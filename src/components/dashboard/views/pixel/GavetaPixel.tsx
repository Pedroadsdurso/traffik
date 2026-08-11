"use client";

import * as React from "react";

import type { DetectionType, PixelConfigDTO } from "@/lib/actions/pixels";
import { getPublicAppUrl } from "@/lib/appUrl";
import { scriptDoPixel } from "@/lib/pixel/script";
import {
  FORM_VAZIO,
  dtoParaForm,
  formParaInput,
  ondePaga,
  presetDoForm,
  problemasDoForm,
  regraManual,
  responderOndePaga,
  responderPreset,
  type FormPixel,
} from "@/lib/pixel/formulario";
import { seguePreset, donosDoPreset } from "@/lib/pixel/preset";
import {
  EVENTOS_DO_PIXEL,
  EXPLICACAO_DONO,
  ROTULO_DONO,
  donoDoEvento,
  type DonoDoEvento,
} from "@/lib/pixel/donos";
import { EXEMPLOS_DE_TRECHO, analisarTrecho } from "@/lib/pixel/trechoUrl";
import { PASSOS_CHECKOUT_PROPRIO } from "@/lib/pixel/checkoutProprio";
import { Drawer } from "@/components/dashboard/ui/Drawer";
import { Icone } from "@/components/dashboard/ui/Icone";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { CodigoDestacado } from "@/components/tk/CodigoDestacado";
import { Checkbox, Radio } from "@/components/tk/Controles";
import { Input } from "@/components/tk/Input";
import { Select } from "@/components/tk/Select";

/**
 * A gaveta de configuração do Pixel.
 *
 * > # 🔴 ESTA GAVETA CONFIGURA O QUE É MEDIDO. AS OUTRAS TELAS SÓ MOSTRAM.
 * >
 * > Um dono de evento errado aqui **conta conversão em dobro**, e a pessoa
 * > otimiza campanha em cima disso por semanas. Não há referência visual para
 * > esta tela — então o critério de aceite é outro, e é o do dono:
 * >
 * > **cada controle diz o que MUDA quando ele muda.** Não *"Dono do evento:
 * > Pixel próprio"*, mas o efeito: quem dispara, e o que acontece se os dois
 * > dispararem.
 * >
 * > ⛔ Por isso **nenhum `apoio` deste arquivo é decorativo.** Cada um custou um
 * > bug real, está registrado no `CLAUDE.md` ou em `lib/pixel/preset.ts`, e
 * > encurtá-lo "porque ficou grande" devolve o bug. A microcópia é a
 * > funcionalidade aqui.
 *
 * ## O preset só muda pelo redutor
 *
 * `temPixelNativo` decide **duas** coisas que moram em lugares diferentes: o
 * dono de cada evento (que o servidor lê ao vivo) e o espelho no `fbq` (que é
 * ASSADO no snippet instalado). Escrever o campo à mão mudaria uma e deixaria a
 * outra para trás.
 *
 * ⛔ **Toda mudança de preset passa por `responderPreset()`**, de
 * `lib/pixel/formulario.ts`. `npm run test:pixel-preset` tem guarda estática
 * sobre este arquivo — atribuição direta de `temPixelNativo` reprova a suíte.
 */

/* ─────────────────────────────── Peças ─────────────────────────────── */

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className="bg-surface border border-border rounded-card"
      style={{ padding: "var(--tk-pad-card)", display: "flex", flexDirection: "column", gap: 12 }}
    >
      <div>
        <div className="text-label">{titulo}</div>
        {descricao && (
          <p className="text-caption text-text-muted" style={{ margin: "3px 0 0", lineHeight: 1.6 }}>
            {descricao}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Pergunta do preset: enunciado + as opções, com o EFEITO em cada uma. */
function Pergunta({
  enunciado,
  children,
}: {
  enunciado: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-label" style={{ marginBottom: 7 }}>
        {enunciado}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

/**
 * Aviso tingido.
 *
 * ⚠️ `tom="warning"` é ESTADO, não decoração — só entra onde há consequência
 * mensurável. A regra da cor semântica vale aqui igual: âmbar diz "isto pode
 * custar dinheiro", e diluí-lo em nota informativa faz o âmbar parar de ser lido.
 */
function Aviso({ tom = "warning", children }: { tom?: "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  return (
    <div
      className="rounded-controle"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        padding: "10px 12px",
        background: `var(--tk-tint-${tom})`,
        border: `1px solid color-mix(in oklch, var(--tk-${tom === "neutral" ? "text-secondary" : tom}) 40%, transparent)`,
        color: `var(--tk-on-tint-${tom})`,
        fontSize: 12.5,
        lineHeight: 1.6,
      }}
    >
      <span style={{ display: "flex", flexShrink: 0, paddingTop: 1 }}>
        <Icone nome={tom === "neutral" ? "info" : "aviso"} tamanho={15} />
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────── A gaveta ─────────────────────────────── */

export function GavetaPixel({
  aberta,
  pixel,
  gatewaysComPixelProprio,
  produtos,
  salvando,
  erro,
  aoSalvar,
  aoFechar,
}: {
  aberta: boolean;
  /** `null` = criando. */
  pixel: PixelConfigDTO | null;
  /** Gateways conectados que têm campo de pixel próprio no painel deles. */
  gatewaysComPixelProprio: string[];
  produtos: string[];
  salvando: boolean;
  erro: string | null;
  aoSalvar: (input: ReturnType<typeof formParaInput>) => void;
  aoFechar: () => void;
}) {
  const [form, setForm] = React.useState<FormPixel>(FORM_VAZIO);
  const [avancado, setAvancado] = React.useState(false);
  const [novoMeta, setNovoMeta] = React.useState({ pixelId: "", accessToken: "", nickname: "" });

  /* A `key` da gaveta remonta o componente a cada abertura (ver o `PixelScreen`),
     então o estado inicial não precisa de efeito — e não há `setState` em efeito
     para o lint reclamar, nem janela em que a gaveta mostre o pixel anterior. */
  const [inicializado, setInicializado] = React.useState(false);
  if (!inicializado) {
    setInicializado(true);
    setForm(pixel ? dtoParaForm(pixel) : FORM_VAZIO);
  }

  const preset = presetDoForm(form);
  const noPadrao = seguePreset(preset, form.donos);
  const problemas = problemasDoForm(form);
  const manual = regraManual(form.ic.type);

  const script = React.useMemo(() => {
    const input = formParaInput(form);
    return scriptDoPixel(
      {
        id: pixel?.id ?? "novo",
        eventOwners: input.eventOwners,
        // ⚠️ DERIVADO, não `input.preset` — aquele é opcional no DTO, e um
        //    `undefined` aqui faria o script cair no padrão silenciosamente.
        preset: presetDoForm(form),
        rules: [
          { eventType: "LEAD", enabled: input.lead, detectionType: null, detectionValue: null },
          { eventType: "ADD_TO_CART", enabled: input.addToCart, detectionType: null, detectionValue: null },
          {
            eventType: "INITIATE_CHECKOUT",
            enabled: input.initiateCheckout.enabled,
            detectionType: input.initiateCheckout.detectionType ?? null,
            detectionValue: input.initiateCheckout.detectionValue ?? null,
          },
        ],
      },
      getPublicAppUrl(),
    );
  }, [form, pixel]);

  const trecho = form.ic.type === "contem_url" ? analisarTrecho(form.ic.value) : null;

  function adicionarMeta() {
    if (!novoMeta.pixelId.trim()) return;
    setForm((f) => ({ ...f, metaPixels: [...f.metaPixels, { ...novoMeta }] }));
    setNovoMeta({ pixelId: "", accessToken: "", nickname: "" });
  }

  return (
    <Drawer
      aberta={aberta}
      titulo={pixel ? "Editar pixel" : "Novo pixel"}
      descricao={
        pixel
          ? "Mudanças no envio valem na hora. Mudanças no script exigem recolar o código no site."
          : "Três perguntas definem o essencial. O resto tem padrão bom."
      }
      largura={720}
      onClose={aoFechar}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            variante="primario"
            carregando={salvando}
            disabled={problemas.length > 0}
            onClick={() => aoSalvar(formParaInput(form))}
          >
            {pixel ? "Salvar" : "Criar pixel"}
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--tk-gap-grid)" }}>
        {erro && <Aviso tom="danger">{erro}</Aviso>}

        {/* ── 1 · Dados ───────────────────────────────────────────────── */}
        <Secao
          titulo="Dados do pixel"
          descricao="Um pixel da Trackhub pode disparar para vários pixels da Meta ao mesmo tempo."
        >
          <Input
            rotulo="Nome"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ex: Oferta principal"
            apoio="Só para você identificar aqui dentro."
          />

          {form.metaPixels.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {form.metaPixels.map((m, i) => (
                <div
                  key={i}
                  className="bg-background border border-border rounded-controle"
                  style={{ padding: 10, display: "flex", gap: 8, alignItems: "flex-start" }}
                >
                  <div style={{ flex: 1, minWidth: 0, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
                    <Input
                      rotulo="ID do pixel"
                      value={m.pixelId}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          metaPixels: f.metaPixels.map((x, j) => (j === i ? { ...x, pixelId: e.target.value } : x)),
                        }))
                      }
                    />
                    <Input
                      rotulo="Apelido"
                      value={m.nickname}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          metaPixels: f.metaPixels.map((x, j) => (j === i ? { ...x, nickname: e.target.value } : x)),
                        }))
                      }
                    />
                    <Input
                      rotulo="Token da CAPI"
                      type="password"
                      value={m.accessToken}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          metaPixels: f.metaPixels.map((x, j) => (j === i ? { ...x, accessToken: e.target.value } : x)),
                        }))
                      }
                      /* ⚠️ Vazio com token gravado NÃO apaga o que está lá — e a
                         tela precisa dizer isso, senão o usuário reescreve o
                         token a cada edição por medo de perdê-lo. */
                      placeholder={m.savedToken ? "Já cadastrado — deixe em branco para manter" : ""}
                      apoio={m.savedToken ? "Preencher substitui o token atual." : "Sem ele, só o navegador envia."}
                    />
                  </div>
                  <Button
                    variante="fantasma"
                    apenasIcone
                    aria-label={`Remover o pixel ${m.pixelId}`}
                    onClick={() => setForm((f) => ({ ...f, metaPixels: f.metaPixels.filter((_, j) => j !== i) }))}
                  >
                    <Icone nome="excluir" tamanho={14} />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 160px" }}>
              <Input
                rotulo="Adicionar pixel da Meta"
                value={novoMeta.pixelId}
                onChange={(e) => setNovoMeta((m) => ({ ...m, pixelId: e.target.value }))}
                placeholder="ID do pixel"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    adicionarMeta();
                  }
                }}
              />
            </div>
            <Button variante="secundario" onClick={adicionarMeta} disabled={!novoMeta.pixelId.trim()}>
              Adicionar
            </Button>
          </div>
        </Secao>

        {/* ── 2 · O preset ────────────────────────────────────────────── */}
        <Secao
          titulo="Como é o seu site"
          descricao="Estas respostas definem quem envia cada evento e como o script se comporta. Você não precisa entender deduplicação — só responder sobre a sua operação."
        >
          <Pergunta enunciado="O código do Facebook (pixel) está instalado nesta página?">
            <Radio
              nome="tem-pixel-nativo"
              marcado={form.temPixelNativo}
              aoEscolher={() => setForm((f) => responderPreset(f, { temPixelNativo: true }))}
              rotulo="Sim, já tenho o pixel do Facebook no site"
              apoio="Deixamos a visita (PageView) com ele e mandamos os outros eventos pelo nosso servidor, com o mesmo identificador. Assim a Meta conta uma conversão, não duas."
            />
            <Radio
              nome="tem-pixel-nativo"
              marcado={!form.temPixelNativo}
              aoEscolher={() => setForm((f) => responderPreset(f, { temPixelNativo: false }))}
              rotulo="Não, só a Trackhub vai enviar"
              apoio="Enviamos tudo pelo nosso servidor, inclusive a visita. Chega mesmo com bloqueador de anúncios."
            />
          </Pergunta>

          <div>
            <div className="text-label" style={{ marginBottom: 7 }}>
              Registrar também
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Checkbox
                marcado={form.ic.enabled}
                aoMudar={(v) => setForm((f) => ({ ...f, ic: { ...f.ic, enabled: v } }))}
                rotulo="Início de checkout"
                apoio="Quando o visitante clica no link que leva ao pagamento."
              />
              <Checkbox
                marcado={form.lead}
                aoMudar={(v) => setForm((f) => ({ ...f, lead: v }))}
                rotulo="Lead"
                apoio="Quando alguém envia um formulário na página."
              />
              <Checkbox
                marcado={form.addToCart}
                aoMudar={(v) => setForm((f) => ({ ...f, addToCart: v }))}
                rotulo="Carrinho"
                apoio="Clique em botões com cara de carrinho. Só faz sentido se o seu site tiver carrinho."
              />
            </div>
          </div>

          {/* 🔴 Colada no checkbox que ela faz funcionar, e NÃO no avançado:
              escolher errado aqui não dá erro — dá ZERO início de checkout, para
              sempre. É um fato sobre o negócio, e o usuário responde sem saber o
              que é um detector. */}
          {form.ic.enabled && (
            <div style={{ paddingLeft: 12, borderLeft: "2px solid var(--tk-border)" }}>
              <Pergunta enunciado="Onde o comprador paga?">
                <Radio
                  nome="onde-se-paga"
                  marcado={!manual && ondePaga(form.ic.type) === "gateway"}
                  aoEscolher={() => setForm((f) => responderOndePaga(f, "gateway"))}
                  rotulo="Em outro site (Kirvano, Hotmart, Cakto…)"
                  apoio="A página de pagamento é do gateway, então não dá para instalar nada nela. Registramos o clique no link que leva até lá."
                />
                <Radio
                  nome="onde-se-paga"
                  marcado={!manual && ondePaga(form.ic.type) === "proprio_site"}
                  aoEscolher={() => setForm((f) => responderOndePaga(f, "proprio_site"))}
                  rotulo="No meu próprio site"
                  apoio="A página de pagamento é sua e tem este script. Registramos quando ela é aberta."
                />
              </Pergunta>

              {manual && (
                <div style={{ marginTop: 8 }}>
                  <Aviso tom="neutral">
                    A detecção está num modo manual (<code>{form.ic.type}</code>), que a pergunta
                    acima não descreve — por isso nenhuma opção está marcada. Ajuste no avançado, ou
                    escolha uma das duas para voltar ao modo simples.
                  </Aviso>
                </div>
              )}

              {!manual && ondePaga(form.ic.type) === "proprio_site" && (
                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                  <Input
                    rotulo="Trecho da URL da sua página de pagamento"
                    value={form.ic.value}
                    onChange={(e) => setForm((f) => ({ ...f, ic: { ...f.ic, value: e.target.value } }))}
                    placeholder={EXEMPLOS_DE_TRECHO[0] ?? "/pagamento"}
                    erro={
                      form.ic.value.trim()
                        ? undefined
                        : "Sem o trecho, toda visita seria contada como início de checkout."
                    }
                    apoio="Um pedaço que só exista no endereço da página de pagamento."
                  />
                  {trecho?.aviso && <Aviso tom="warning">{trecho.aviso}</Aviso>}
                  <div className="text-caption text-text-muted" style={{ lineHeight: 1.6 }}>
                    Exemplos: {EXEMPLOS_DE_TRECHO.slice(0, 3).map((x) => `“${x}”`).join(" · ")}
                  </div>
                  <div>
                    <div className="text-caption text-text-secondary" style={{ marginBottom: 4 }}>
                      Para o desenvolvedor do seu site
                    </div>
                    <ol className="text-caption text-text-muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
                      {/* `semIsso` diz O QUE ACONTECE se o passo ficar de fora —
                          é a mesma regra da gaveta inteira, e a biblioteca já a
                          trazia pronta. Mostrar só o título perderia o motivo. */}
                      {PASSOS_CHECKOUT_PROPRIO.map((passo) => (
                        <li key={passo.titulo} style={{ marginBottom: 4 }}>
                          <span className="text-text-secondary">{passo.titulo}</span>
                          <div>Sem isso: {passo.semIsso}</div>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}
            </div>
          )}
        </Secao>

        {/* ── 3 · Envio das vendas ────────────────────────────────────── */}
        <Secao titulo="Envio das vendas">
          <Checkbox
            marcado={form.purchase.enabled}
            aoMudar={(v) => setForm((f) => ({ ...f, purchase: { ...f.purchase, enabled: v } }))}
            rotulo="Enviar a venda para a Meta quando ela for aprovada"
            apoio="Sai do nosso servidor, a partir do webhook do gateway — não depende do navegador do comprador. Vale já na próxima venda, sem recolar o script."
          />

          {form.purchase.enabled && (
            <>
              <Pergunta enunciado="Alguém mais já avisa o Facebook quando a venda é aprovada?">
                <Radio
                  nome="outro-envia-purchase"
                  marcado={!form.outroEnviaPurchase}
                  aoEscolher={() => setForm((f) => responderPreset(f, { outroEnviaPurchase: false }))}
                  rotulo="Não — quem avisa é a Trackhub"
                  apoio="Enviamos a venda pelo nosso servidor, só quando ela é aprovada de verdade. É o recomendado: chega mesmo com bloqueador de anúncios e não dispara em PIX que ninguém pagou."
                />
                <Radio
                  nome="outro-envia-purchase"
                  marcado={form.outroEnviaPurchase}
                  aoEscolher={() => setForm((f) => responderPreset(f, { outroEnviaPurchase: true }))}
                  rotulo="Sim — a página de obrigado ou o checkout do meu gateway já envia"
                  apoio="A Trackhub para de enviar a venda para a Meta. Continua registrando tudo aqui: faturamento, funil e Gerenciador não mudam."
                />
              </Pergunta>

              {/* ⚠️ O aviso aparece na resposta PADRÃO, não na exceção — ao
                  contrário de quase todo aviso do produto. É a resposta padrão
                  que produz contagem dobrada quando está errada, e o usuário não
                  tem como saber que o checkout do gateway dele dispara Purchase
                  sem ir olhar. Avisar só na outra opção deixaria o caso caro em
                  silêncio. */}
              <Aviso>
                {form.outroEnviaPurchase ? (
                  <>
                    Confira no <strong>Gerenciador de Eventos</strong> da Meta que a venda continua
                    chegando. Se o outro lado parar de enviar, ela some — e nada aqui vai avisar,
                    porque do nosso lado está tudo certo.
                  </>
                ) : gatewaysComPixelProprio.length > 0 ? (
                  <>
                    <strong>
                      Você usa {gatewaysComPixelProprio.join(", ")} — e o painel{" "}
                      {gatewaysComPixelProprio.length > 1 ? "deles tem" : "dele tem"} campo de pixel
                      do Facebook.
                    </strong>{" "}
                    Se estiver preenchido lá, os dois vão enviar a mesma venda e a Meta vai contar
                    duas vezes. Confira no painel do gateway antes de deixar esta opção.
                  </>
                ) : (
                  <>
                    Se o seu checkout ou a página de obrigado também dispararem a venda, a Meta vai
                    contar duas vezes. Nesse caso, marque a outra opção.
                  </>
                )}
              </Aviso>
            </>
          )}
        </Secao>

        {/* ── 4 · Script ──────────────────────────────────────────────── */}
        <Secao
          titulo="Script para instalar"
          descricao="Cole no cabeçalho do site, antes de </head>. Ele muda conforme as respostas acima — recole depois de salvar."
        >
          <CodigoDestacado codigo={script} linguagem="js" alturaMaxima={220} />
        </Secao>

        {/* ── 5 · Avançado ────────────────────────────────────────────── */}
        <div>
          <Button
            variante="fantasma"
            onClick={() => setAvancado((v) => !v)}
            iconeInicio={<Icone nome={avancado ? "ok" : "ajustes"} tamanho={14} />}
          >
            {avancado ? "Esconder o avançado" : "Mostrar o avançado"}
          </Button>
        </div>

        {avancado && (
          <>
            <Secao
              titulo="Quem envia cada evento"
              descricao="Definido pelas suas respostas. Mexer aqui desfaz a coerência que elas garantem."
            >
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Badge tom={noPadrao ? "success" : "warning"} ponto>
                  {noPadrao ? "Definido pelas suas respostas" : "Ajustado à mão"}
                </Badge>
                {!noPadrao && (
                  <Button
                    variante="secundario"
                    onClick={() => setForm((f) => ({ ...f, donos: donosDoPreset(presetDoForm(f)) }))}
                  >
                    ↩ Voltar ao padrão
                  </Button>
                )}
              </div>

              {/* 🔴 O CUSTO do ajuste manual, dito por combinação — e não um
                  "cuidado" genérico. O caso que importa: com pixel nativo na
                  página, o código-base da Meta dispara PageView SEM event_id, e
                  a nossa CAPI dispara COM. Não há como casar os dois. */}
              {!noPadrao && form.temPixelNativo && donoDoEvento(form.donos, "PageView") === "traffik" && (
                <Aviso tom="danger">
                  <strong>Esta combinação conta a visita duas vezes.</strong> Você declarou que o
                  pixel do Facebook está na página — ele dispara o PageView sozinho, sem
                  identificador — e mandou a Trackhub enviar o PageView também. A Meta não tem como
                  juntar os dois.
                </Aviso>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {EVENTOS_DO_PIXEL.map((evento) => {
                  const dono = donoDoEvento(form.donos, evento);
                  return (
                    <div
                      key={evento}
                      style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}
                    >
                      <div style={{ minWidth: 150, flex: "0 0 auto" }}>
                        <div className="text-label">{evento}</div>
                        <div className="text-caption text-text-muted">{EXPLICACAO_DONO[dono]}</div>
                      </div>
                      <Select
                        opcoes={(Object.keys(ROTULO_DONO) as DonoDoEvento[]).map((d) => ({
                          valor: d,
                          rotulo: ROTULO_DONO[d],
                        }))}
                        valor={dono}
                        aoEscolher={(d) =>
                          setForm((f) => ({ ...f, donos: { ...f.donos, [evento]: d as DonoDoEvento } }))
                        }
                        blocoInteiro={false}
                      />
                    </div>
                  );
                })}
              </div>
            </Secao>

            <Secao
              titulo="Como detectar o início de checkout"
              descricao="Os dois modos abaixo não são descritos pela pergunta “onde o comprador paga” — use só se souber exatamente o que está fazendo."
            >
              <Select
                opcoes={[
                  { valor: "clique_checkout", rotulo: "Clique em link de checkout (recomendado)" },
                  { valor: "contem_url", rotulo: "A URL da página contém um trecho" },
                  { valor: "contem_texto", rotulo: "A página contém um texto" },
                  { valor: "contem_css", rotulo: "A página tem um elemento CSS" },
                ]}
                valor={form.ic.type}
                aoEscolher={(t) =>
                  setForm((f) => ({ ...f, ic: { ...f.ic, type: t as DetectionType, value: "" } }))
                }
                rotulo="Regra de detecção"
              />
              {form.ic.type !== "clique_checkout" && (
                <Input
                  rotulo="Valor"
                  value={form.ic.value}
                  onChange={(e) => setForm((f) => ({ ...f, ic: { ...f.ic, value: e.target.value } }))}
                  apoio="O trecho, o texto ou o seletor que a regra procura."
                />
              )}
            </Secao>

            <Secao titulo="Detalhes do envio de vendas">
              <Select
                opcoes={[
                  { valor: "APENAS_APROVADAS", rotulo: "Só vendas aprovadas" },
                  { valor: "TODAS", rotulo: "Todas, inclusive pendentes" },
                ]}
                valor={form.purchase.sendMode}
                aoEscolher={(v) => setForm((f) => ({ ...f, purchase: { ...f.purchase, sendMode: v } }))}
                rotulo="Quando enviar"
              />
              <Select
                opcoes={[
                  { valor: "VALOR_DA_VENDA", rotulo: "O valor real da venda" },
                  { valor: "VALOR_FIXO", rotulo: "Um valor fixo" },
                ]}
                valor={form.purchase.valueMode}
                aoEscolher={(v) => setForm((f) => ({ ...f, purchase: { ...f.purchase, valueMode: v } }))}
                rotulo="Que valor enviar"
              />
              {form.purchase.valueMode === "VALOR_FIXO" && (
                <Input
                  rotulo="Valor fixo"
                  value={form.purchase.fixedValue}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, purchase: { ...f.purchase, fixedValue: e.target.value } }))
                  }
                  sufixo="R$"
                  inputMode="decimal"
                />
              )}
              {produtos.length > 0 && (
                <Select
                  opcoes={[
                    { valor: "", rotulo: "Todos os produtos" },
                    ...produtos.map((p) => ({ valor: p, rotulo: p })),
                  ]}
                  valor={form.purchase.targetProduct}
                  aoEscolher={(v) =>
                    setForm((f) => ({ ...f, purchase: { ...f.purchase, targetProduct: v } }))
                  }
                  rotulo="Só para o produto"
                />
              )}
            </Secao>
          </>
        )}

        {/* O que impede o salvamento fica VISÍVEL, não escondido num botão
            desabilitado sem explicação. */}
        {problemas.length > 0 && (
          <Aviso tom="neutral">
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Aviso>
        )}
      </div>
    </Drawer>
  );
}
