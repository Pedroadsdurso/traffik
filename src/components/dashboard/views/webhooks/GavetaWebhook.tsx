"use client";

import * as React from "react";

import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import { gatewayPorId, gatewaysParaEscolher } from "@/lib/gateways/registro";
import { LogoGateway } from "@/components/dashboard/ui/LogoGateway";
import { Badge } from "@/components/tk/Badge";
import { Button } from "@/components/tk/Button";
import { CampoCopiavel } from "@/components/tk/CampoCopiavel";
import { Gaveta } from "@/components/tk/Gaveta";
import { Input } from "@/components/tk/Input";
import { useCopiar } from "@/components/tk/useCopiar";

/**
 * A gaveta que CONECTA um gateway — e ela é inteiramente movida pelo registro.
 *
 * > ### ⛔ NENHUM RÓTULO ESCRITO PARA UM GATEWAY ESPECÍFICO
 * >
 * > Já foi assim ("Token de segurança da Kirvano", "Cole aqui o token gerado no
 * > painel da Kirvano"), e é exatamente o que faz o décimo gateway custar tela
 * > nova. O critério de aceite do `lib/gateways/contrato.ts` é o desta gaveta
 * > também: **integrar um gateway é um parser + uma entrada no registro.** Se
 * > aparecer um `if (platform === "X")` aqui, a arquitetura regrediu.
 *
 * ## 🔑 SÃO TRÊS FLUXOS DE CHAVE, e descrever um só quebra os outros dois
 *
 * | fluxo | quem cria a chave | o que a gaveta faz |
 * |---|---|---|
 * | `geradoPorNos` (Cakto) | **nós** | MOSTRA a chave para o usuário colar no painel do gateway |
 * | usuário cria (Kirvano) | o painel do gateway | PEDE a chave, e ela é obrigatória |
 * | sem chave (OnyxPag, sistema próprio) | ninguém | não pede nada — **o endereço é a credencial** |
 *
 * ⚠️ O pior dos três de errar é o terceiro: mandar o usuário procurar no painel
 * do gateway uma chave que **não existe** o deixa parado indefinidamente,
 * procurando por algo que ninguém pode entregar.
 *
 * ## 🔴 O ENDEREÇO SÓ APARECE DEPOIS DE SALVAR — e isso é do desenho
 *
 * A URL contém o `Webhook.token`, gerado pelo banco (`@default(uuid())`). Antes
 * de a linha existir não há endereço, e inventar um placeholder aqui seria a
 * pior coisa possível nesta tela: um endereço quase certo é colado, aceito pelo
 * painel do gateway, e responde 404 para sempre.
 */
/** Este gateway tem campo cuja chave NÓS geramos? Pergunta ao registro. */
function precisaGerar(gateway: string): boolean {
  return gatewayPorId(gateway)?.campos.some((c) => c.gerado) ?? false;
}

export function GavetaWebhook({
  webhook,
  salvando,
  erro,
  aoSalvar,
  aoFechar,
}: {
  /** `null` = conectar um gateway novo. */
  webhook: WebhookRowDTO | null;
  salvando: boolean;
  erro: string | null;
  aoSalvar: (input: { platform: string; name: string; secret: string }) => void;
  aoFechar: () => void;
}) {
  const editando = webhook !== null;
  const [copiar, copiado] = useCopiar();

  const escolhiveis = React.useMemo(() => gatewaysParaEscolher(), []);
  const [busca, setBusca] = React.useState("");
  const [plataforma, setPlataforma] = React.useState(
    webhook?.platform ?? escolhiveis.find((g) => g.ativo)?.id ?? "",
  );
  const [nome, setNome] = React.useState(webhook?.name ?? "");
  const [chave, setChave] = React.useState("");

  /**
   * 🔑 A CHAVE QUE **NÓS** GERAMOS — e ela precisa existir ANTES de salvar.
   *
   * ⚠️ Isto quase se perdeu na reescrita, e o modo de falha era mudo: sem
   * gerar nada aqui, um webhook da Cakto nasceria com `secret` NULO, e como a
   * Cakto é `exigir: true` **toda venda voltaria 401** — do lado de cá o
   * sintoma seria "nenhuma venda chegando", indistinguível de "ninguém
   * comprou". A geração vivia no `useTraffikState` (`segredoInicial`), que
   * morreu junto da view antiga.
   *
   * ⛔ UMA POR GATEWAY, e nunca regerada por clique. O bug original está
   * documentado: clicar de novo no gateway JÁ selecionado gerava outra chave, e
   * quem tivesse copiado a primeira levava para o painel do gateway uma chave
   * que a ferramenta não guardaria. Por isso o mapa é por id, e escrever nele é
   * condicional.
   */
  const [geradas, setGeradas] = React.useState<Record<string, string>>(() =>
    precisaGerar(plataforma) ? { [plataforma]: crypto.randomUUID() } : {},
  );

  function escolherGateway(g: string) {
    setPlataforma(g);
    if (precisaGerar(g)) setGeradas((m) => (m[g] ? m : { ...m, [g]: crypto.randomUUID() }));
  }

  const def = gatewayPorId(plataforma);
  const filtrados = escolhiveis.filter((g) => g.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  /**
   * A chave é obrigatória para ESTE gateway?
   *
   * ⛔ Sai do registro (`campos[].obrigatorio`), que é o mesmo lugar de onde o
   * rótulo "(opcional)" vem. Tirar os dois da mesma fonte é o que impede a tela
   * de dizer "opcional" e o botão exigir preenchimento — que foi o estado real
   * daqui enquanto a checagem era incondicional, e atingia a OnyxPag e o
   * "Sistema próprio" sem ninguém notar.
   */
  const exigeChave = def?.campos.some((c) => c.chave === "secret" && c.obrigatorio) ?? false;
  const chaveGeradaPorNos = def?.campos.some((c) => c.gerado) ?? false;

  /* Na EDIÇÃO o campo abre vazio e vazio significa "manter a atual" — nunca
     "apagar". A regra vive no servidor (`updateWebhook`), e o texto de apoio
     abaixo é a metade dela que o usuário precisa ler. */
  const podeSalvar = Boolean(def?.ativo) && !salvando && (editando || !exigeChave || chave.trim().length > 0);

  const descricao = !def
    ? "Escolha o gateway que envia as suas vendas."
    : editando
      ? "O endereço abaixo é o que fica colado no painel do gateway."
      : chaveGeradaPorNos
        ? `Escolha o gateway, e nós geramos a chave que você cola no painel da ${def.nome}.`
        : exigeChave
          ? `Informe a chave de segurança gerada no painel da ${def.nome}.`
          : `Este gateway não usa chave de segurança — o endereço é a credencial.`;

  return (
    <Gaveta
      aberta
      titulo={editando ? "Editar webhook" : "Conectar um gateway"}
      descricao={descricao}
      aoFechar={aoFechar}
      rodape={
        <>
          <Button variante="secundario" onClick={aoFechar}>
            Cancelar
          </Button>
          <Button
            variante="primario"
            carregando={salvando}
            disabled={!podeSalvar}
            onClick={() =>
              aoSalvar({
                platform: plataforma,
                name: nome,
                /* ⛔ Na CRIAÇÃO de um gateway com chave nossa, o que vai é a
                   chave GERADA — a mesma que o usuário acabou de copiar do
                   campo acima. Mandar o campo de digitação (vazio, porque
                   aquele gateway não pede nada digitado) gravaria `secret`
                   nulo, e o gateway recusaria toda venda com 401. */
                secret: !editando && precisaGerar(plataforma) ? (geradas[plataforma] ?? "") : chave,
              })
            }
          >
            {editando ? "Salvar" : "Conectar"}
          </Button>
        </>
      }
    >
      {/* ── Escolha do gateway: só na CRIAÇÃO ────────────────────────────────
          ⛔ Trocar a plataforma de um webhook existente mudaria como o payload
          é lido SEM mudar a URL já colada no painel do gateway — o endereço
          continuaria válido e passaria a ser interpretado por outro parser. É a
          forma mais silenciosa do artefato de contexto errado, e o servidor não
          aceita o campo de propósito (`updateWebhook` só lê nome e chave). */}
      {!editando && (
        <>
          <Input
            rotulo="Buscar gateway"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            /* ⛔ O exemplo vem do REGISTRO. Cravado, ele envelhece no dia em
               que o primeiro gateway da lista mudar — e a guarda estática do
               `test:webhooks-tela` pegou exatamente isto. */
            placeholder={`Ex.: ${escolhiveis[0]?.nome ?? ""}`}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
              gap: 8,
            }}
          >
            {filtrados.map((g) => {
              const escolhido = g.id === plataforma;
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!g.ativo}
                  aria-pressed={escolhido}
                  onClick={() => escolherGateway(g.id)}
                  className="rounded-controle"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "14px 8px",
                    minHeight: 96,
                    cursor: g.ativo ? "pointer" : "not-allowed",
                    opacity: g.ativo ? 1 : 0.5,
                    border: `1px solid ${escolhido ? "var(--tk-primary)" : "var(--tk-border)"}`,
                    background: escolhido ? "var(--tk-tint-primary)" : "var(--tk-surface)",
                  }}
                >
                  <LogoGateway id={g.id} nome={g.nome} tamanho={34} />
                  <span className="text-caption text-text" style={{ textAlign: "center" }}>
                    {g.nome}
                  </span>
                  {!g.ativo && <Badge tom="neutral">em breve</Badge>}
                </button>
              );
            })}
            {filtrados.length === 0 && (
              <p className="text-caption text-text-muted" style={{ gridColumn: "1 / -1", margin: 0 }}>
                Nenhum gateway com esse nome.
              </p>
            )}
          </div>
        </>
      )}

      {def?.ativo && (
        <>
          {/* ⛔ TUDO daqui para baixo vem do REGISTRO — ver o cabeçalho. */}
          {def.campos.map((campo) => {
            if (campo.chave === "nome") {
              return (
                <Input
                  key={campo.chave}
                  rotulo={campo.rotulo}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder={`Ex.: ${def.nome} — Método Foco`}
                  apoio="Só para você distinguir os seus webhooks. Não vai para o gateway."
                />
              );
            }

            /* 🔑 A chave é NOSSA e o usuário PRECISA dela para configurar o
               gateway do outro lado. Sem este bloco ela era gerada, salva e
               nunca mostrada — o webhook ficava impossível de configurar lá. */
            if (campo.gerado) {
              return (
                <CampoCopiavel
                  key={campo.chave}
                  id="chave-gerada"
                  rotulo={campo.rotulo}
                  valor={webhook?.secret ?? geradas[plataforma] ?? ""}
                  ajuda={campo.ajuda}
                  copiado={copiado}
                  aoCopiar={copiar}
                  vazio={`Esta chave não se aplica à ${def.nome}.`}
                />
              );
            }

            return (
              <Input
                key={campo.chave}
                rotulo={campo.rotulo}
                value={chave}
                onChange={(e) => setChave(e.target.value)}
                placeholder={editando ? "Deixe em branco para manter a atual" : campo.rotulo}
                apoio={
                  editando
                    ? /* 🔴 A metade que o usuário precisa ler: campo em branco
                         MANTÉM a chave. Já foi o contrário aqui, e salvar sem
                         tocar no campo zerava o segredo — todas as vendas
                         seguintes voltavam 401. */
                      "Em branco, a chave atual continua valendo. Digite uma nova só para substituí-la."
                    : campo.ajuda
                }
              />
            );
          })}

          {/* ── O ARTEFATO ──────────────────────────────────────────────────
              Só existe depois de salvar, porque só então existe o token. */}
          {editando ? (
            <CampoCopiavel
              id="url-webhook"
              rotulo="Endereço do webhook"
              valor={webhook.url}
              ajuda={`Cole no campo de webhook do painel da ${def.nome}. Ele é único e identifica esta operação.`}
              copiado={copiado}
              aoCopiar={copiar}
            />
          ) : (
            <p className="text-caption text-text-muted" style={{ margin: 0, lineHeight: 1.7 }}>
              O endereço para colar na {def.nome} aparece assim que você conectar — ele depende do
              identificador que criamos agora.
            </p>
          )}

          {def.instalacao.length > 0 && (
            <div
              style={{
                borderTop: "1px solid var(--tk-border)",
                paddingTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <span className="text-label text-text-secondary">Como configurar na {def.nome}</span>
              <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 10 }}>
                {def.instalacao.map((passo) => (
                  <li key={passo.titulo} className="text-caption" style={{ lineHeight: 1.6 }}>
                    <strong className={passo.atencao ? "text-warning" : "text-text"}>{passo.titulo}</strong>
                    <span className="text-text-muted" style={{ display: "block" }}>
                      {passo.texto}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}

      {erro && (
        <p className="text-caption text-danger" role="alert" style={{ margin: 0 }}>
          {erro}
        </p>
      )}
    </Gaveta>
  );
}
