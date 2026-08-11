"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { WorkspaceDTO } from "@/lib/actions/workspaces";
import { useTheme } from "@/components/theme/ThemeProvider";
import { Icone, type NomeIcone } from "@/components/dashboard/ui/Icone";
import { Tooltip } from "./Tooltip";
import { UserMenu, type UsuarioShell } from "./UserMenu";
import { WorkspaceMenu } from "./WorkspaceMenu";

/**
 * Rail — a navegação lateral.
 *
 * ⛔ RECOLHER É UM BOTÃO, NÃO O HOVER. O `01-PROMPT-MASTER` pede rail que expande
 * ao passar o mouse; o `04` (que tem precedência) pede botão explícito, e é o
 * certo: quem atravessa a tela de raspão vê a sidebar abrir sozinha e empurrar o
 * conteúdo. O estado é do usuário e persiste em `localStorage`.
 *
 * ⛔ E O ITEM ATIVO NÃO É SÓ COR. Fundo tingido + barra de 2px à esquerda +
 * `aria-current`. Cor sozinha reprova em WCAG 1.4.1 e, no tema claro, o
 * tingimento sozinho é fraco demais para ler à distância.
 *
 * ⛔ TODO FILHO DIRETO DO RAIL COLAPSADO SE CENTRA NO EIXO DO RAIL (x = 30).
 * O estado recolhido é uma coluna de ícones, e uma coluna de ícones só se lê se
 * eles estiverem alinhados. Em 07/08/2026 os sete itens de menu estavam 13px à
 * esquerda do logo, do botão e do rodapé, porque o embrulho da `Tooltip` encolhia
 * o link (ver `larguraCheia` lá). Ao acrescentar qualquer linha aqui, MEÇA: o
 * centro dela tem de bater com o dos vizinhos.
 *
 * ⛔ E VERIFIQUE O RECOLHIDO NA TELA, não só o expandido. Os quatro defeitos que
 * esta reescrita consertou passaram por `tsc`, `lint` e `build` — nenhum deles
 * pergunta como o estado alternativo ficou.
 */

const LARGURA_ABERTO = 236;
const LARGURA_FECHADO = 60;
const CHAVE_COLAPSO = "tk.rail.colapsado";

/**
 * Recuo lateral do conteúdo quando colapsado — o MESMO nas três faixas (marca,
 * navegação, rodapé). É o que faz o eixo bater: com recuos diferentes, cada
 * faixa se centra num lugar.
 */
const RECUO_FECHADO = 8;

type ItemNav = {
  href: string;
  label: string;
  icone: NomeIcone;
  /** Só o Dashboard casa exato: `/dashboard` é prefixo de todas as outras rotas. */
  exato?: boolean;
  /** Contagem à direita (Notificações). Zero não desenha selo. */
  contagem?: number;
  filhos?: { href: string; label: string }[];
};

/**
 * ✅ "Visão geral" É O PRIMEIRO FILHO de Integrações desde 06/08/2026. A ausência
 * anterior era pendência registrada, não decisão: `integracoes/page.tsx` era um
 * `redirect` para `anuncios`, e um item de menu que promete uma tela e entrega
 * outra é affordance mentindo. A tela existe agora, então o item entrou.
 *
 * ⛔ "Testes" saiu de vez: a `TestesView` foi DELETADA na reescrita de
 * Integrações, junto do `TestadorPayloadCard` que só ela importava. Ela estava
 * fora da navegação desde o `03` e o prazo era este passo. Não recrie o link.
 *
 * ⚠️ "UTMs" saiu dos FILHOS de Integrações em 11/08/2026 e virou
 * `UTM & Snippets`, item de primeiro nível — decisão do `03`. A rota antiga
 * (`/dashboard/integracoes/utms`) segue viva como redirect, mas **não volta ao
 * menu**: um item que promete uma tela e entrega um salto para outra é a mesma
 * affordance mentindo que tirou o `redirect` de Integrações da lista.
 */
function montarNav(naoLidas: number): { grupo: string; itens: ItemNav[] }[] {
  return [
    {
      grupo: "Análise",
      itens: [
        { href: "/dashboard", label: "Dashboard", icone: "painel", exato: true },
        { href: "/dashboard/gerenciador", label: "Gerenciador de Anúncios", icone: "gerenciador" },
        { href: "/dashboard/criativos", label: "Criativos", icone: "criativos" },
      ],
    },
    {
      grupo: "Automação",
      itens: [
        { href: "/dashboard/regras", label: "Regras", icone: "regras" },
        { href: "/dashboard/notificacoes", label: "Notificações", icone: "sino", contagem: naoLidas },
      ],
    },
    {
      grupo: "Configurações",
      itens: [
        {
          href: "/dashboard/integracoes",
          label: "Integrações",
          icone: "integracoes",
          filhos: [
            { href: "/dashboard/integracoes", label: "Visão geral" },
            { href: "/dashboard/integracoes/anuncios", label: "Anúncios" },
            { href: "/dashboard/integracoes/webhooks", label: "Webhooks" },
            { href: "/dashboard/integracoes/pixel", label: "Pixel/Eventos" },
          ],
        },
        { href: "/dashboard/utm", label: "UTM & Snippets", icone: "link" },
        { href: "/dashboard/taxas", label: "Taxas e Despesas", icone: "taxas" },
      ],
    },
  ];
}

function ativo(pathname: string, item: { href: string; exato?: boolean }) {
  if (item.exato) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function Rail({
  usuario,
  areas,
  areaAtiva,
  aoTrocarArea,
  naoLidas,
  deslocamentoTopo = 0,
}: {
  usuario?: UsuarioShell;
  areas: WorkspaceDTO[];
  areaAtiva: string | null;
  aoTrocarArea: (id: string) => void;
  naoLidas: number;
  /**
   * Altura consumida acima do shell — hoje só a faixa de ambiente (26px).
   *
   * 🐛 Sem isto o rail media `100vh` a partir de um topo já empurrado pela
   * faixa, e estourava a janela em exatamente essa altura: o rodapé (área de
   * trabalho e perfil) ficava cortado pela borda de baixo. `tsc`, `lint` e
   * `build` passavam — é layout, e só a tela responde.
   */
  deslocamentoTopo?: number;
}) {
  const { theme } = useTheme();
  const pathname = usePathname();
  const [colapsado, setColapsado] = React.useState(false);

  /* Lido DEPOIS de montar, e não no `useState`: o servidor não tem
     `localStorage`, e ler ali produziria HTML diferente do cliente — o rail
     piscaria de aberto para fechado a cada carga. */
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- `localStorage` não existe no SSR; ler no `useState` faria o HTML do servidor divergir do cliente
    setColapsado(localStorage.getItem(CHAVE_COLAPSO) === "1");
  }, []);

  const alternarColapso = React.useCallback(() => {
    setColapsado((c) => {
      localStorage.setItem(CHAVE_COLAPSO, c ? "0" : "1");
      return !c;
    });
  }, []);

  const nav = montarNav(naoLidas);

  return (
    <nav
      aria-label="Navegação principal"
      /* `background-alt`, não `surface`: o rail é a moldura, e a escada de
         elevação põe a moldura um degrau ABAIXO do card. Com `surface` o rail
         fica da cor dos cards e a tela vira um bloco só. */
      className="bg-background-alt border-r border-border flex flex-col"
      style={{
        width: colapsado ? LARGURA_FECHADO : LARGURA_ABERTO,
        flexShrink: 0,
        position: "sticky",
        /**
         * 🐛 `top: 0` CORTAVA O LOGO. A faixa de ambiente é `position: fixed` no
         * topo da janela, e o `paddingTop` do shell empurra o rail para baixo dela
         * — mas só enquanto a página não rola. Grudado em `top: 0`, o rail subia
         * para trás de uma faixa que não sai do lugar: medido em 07/08/2026, com
         * `scrollY = 600`, **12,8px dos 26px do símbolo ficavam cobertos**. Só
         * aparecia depois de rolar, que é por que passou.
         */
        top: deslocamentoTopo,
        height: `calc(100vh - ${deslocamentoTopo}px)`,
        transition: "width var(--tk-dur-painel) var(--tk-ease-padrao)",
      }}
    >
      {/* ── Marca ───────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center"
        style={{
          height: 56,
          flex: "none",
          padding: colapsado ? `0 ${RECUO_FECHADO}px` : "0 12px",
        }}
      >
        <Link
          href="/dashboard"
          aria-label="TrackHub — ir para o Dashboard"
          className={
            "flex min-w-0 flex-1 items-center " + (colapsado ? "justify-center" : "")
          }
        >
          {/* ⚠️ A CONVENÇÃO DE NOME INVERTEU entre as duas pastas de ativo. Em
              `/logos/` o sufixo era a cor das LETRAS; em `/marca/` é o TEMA
              servido (`claro` = para o tema claro, letras escuras). Trocar um
              pelo outro dá logotipo invisível. */}
          <Image
            src={
              colapsado
                ? theme === "light" ? "/marca/simbolo-claro.webp" : "/marca/simbolo-escuro.webp"
                : theme === "light" ? "/marca/wordmark-claro.webp" : "/marca/wordmark-escuro.webp"
            }
            alt="TrackHub"
            width={colapsado ? 512 : 764}
            height={colapsado ? 512 : 192}
            priority
            style={{
              width: colapsado ? 26 : "100%",
              maxWidth: colapsado ? 26 : 132,
              height: "auto",
              objectFit: "contain",
            }}
          />
        </Link>
      </div>

      {/* ── Navegação ───────────────────────────────────────────────────────── */}
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ padding: colapsado ? `4px ${RECUO_FECHADO}px` : "4px 10px" }}
      >
        {nav.map((g, iGrupo) => (
          <div key={g.grupo} className="mb-1">
            {/* Colapsado, o rótulo do grupo vira um traço: o texto não cabe, e
                escondê-lo sem nada no lugar funde os três grupos num bloco só.

                ⛔ MAS SÓ ENTRE GRUPOS. O traço antes do PRIMEIRO não separava
                nada — separava a navegação da marca, que já têm 56px de faixa
                própria entre elas. E ele encostava no ícone de Dashboard, que é
                metade do defeito relatado; a outra metade era a folga de 8px,
                menor que o respiro de 12px que o `06` pede em toda parte. */}
            {colapsado ? (
              iGrupo > 0 && (
                <div className="bg-border" aria-hidden style={{ height: 1, margin: "12px 6px" }} />
              )
            ) : (
              <div className="text-micro text-text-muted" style={{ padding: "10px 10px 4px" }}>
                {g.grupo}
              </div>
            )}

            {g.itens.map((item) => (
              <ItemDoRail
                key={item.href}
                item={item}
                pathname={pathname}
                colapsado={colapsado}
              />
            ))}
          </div>
        ))}
      </div>

      {/* ── Rodapé: área de trabalho + perfil + recolher ────────────────────── */}
      <div
        className="border-t border-border flex flex-col gap-1"
        style={{ flex: "none", padding: colapsado ? `8px ${RECUO_FECHADO}px` : "8px 10px" }}
      >
        <WorkspaceMenu areas={areas} ativa={areaAtiva} aoTrocar={aoTrocarArea} colapsado={colapsado} />
        <UserMenu usuario={usuario} variante={colapsado ? "avatar" : "bloco"} />

        {/* ⛔ UM LUGAR SÓ, NOS DOIS ESTADOS. O botão morava no cabeçalho quando
            aberto e numa linha própria logo abaixo da marca quando fechado — onde
            ficava solto, sem nada a que pertencer, e disputava com o logo a
            leitura de "topo do rail". Aqui ele é o último item do rodapé: o
            controle que muda a MOLDURA fica junto dos outros controles de
            moldura, e não se move quando o estado troca. */}
        <BotaoColapso colapsado={colapsado} aoAlternar={alternarColapso} />
      </div>

      {/*
        ⛔ NÃO existe medidor de plano e uso de eventos aqui, e é o único item da
        seção SHELL da conferência que fica de fora.

        A referência (imagem 5) mostra `Pro · 1.250 / 5.000` com barra. Não há
        backend: `grep -iE "plan|billing|subscription|quota|usage"` no
        `schema.prisma` devolve 4 acertos e os quatro são `PENDING_BILLING_INFO`,
        que é status de conta de anúncio da Meta. Inventar o número seria pior que
        a ausência — é uma barra de consumo que não mede consumo nenhum.
      */}
    </nav>
  );
}

function BotaoColapso({ colapsado, aoAlternar }: { colapsado: boolean; aoAlternar: () => void }) {
  const rotulo = colapsado ? "Expandir menu" : "Recolher menu";

  const botao = (
    <button
      type="button"
      onClick={aoAlternar}
      aria-label={rotulo}
      aria-expanded={!colapsado}
      className={
        "text-text-muted hover:bg-surface-hover hover:text-text flex w-full cursor-pointer items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 " +
        (colapsado ? "justify-center" : "gap-2.5")
      }
      style={{ padding: colapsado ? "7px 0" : "7px 8px" }}
    >
      <Icone
        nome="chevronDireita"
        tamanho={16}
        style={{ transform: colapsado ? undefined : "rotate(180deg)" }}
      />
      {/* Aberto há espaço para o rótulo, e ele evita o ícone-charada. Fechado o
          nome vive na tooltip, como em todo item do rail. */}
      {!colapsado && <span className="text-label">Recolher</span>}
    </button>
  );

  // `larguraCheia`: sem isso o embrulho encolhe o botão e ele sai do eixo — é o
  // mesmo defeito que tirou os sete itens de menu do lugar.
  return colapsado ? (
    <Tooltip texto={rotulo} lado="cima" larguraCheia>
      {botao}
    </Tooltip>
  ) : (
    botao
  );
}

function ItemDoRail({
  item,
  pathname,
  colapsado,
}: {
  item: ItemNav;
  pathname: string;
  colapsado: boolean;
}) {
  const estaAtivo = ativo(pathname, item);
  const temFilhos = !!item.filhos?.length;

  /* 🎨 O PAI DE SEÇÃO ABERTA NÃO GANHA FUNDO CHEIO. Com o fundo, "Integrações" e
     "Webhooks" ficavam idênticos na tela — duas afirmações de "você está aqui"
     para uma página só, e nenhuma das duas dizendo qual é qual. O pai fica com a
     barra e a cor (seção atual); o preenchimento marca a PÁGINA, e ela é uma.

     ⚠️ SÓ VALE COM OS FILHOS À VISTA. Recolhido não há filho na tela para o pai
     se distinguir de nada — e sem o preenchimento sobrava só a COR como sinal de
     ativo, que é o WCAG 1.4.1 que o resto deste rail existe para não violar.
     Medido na tela: o ícone de Integrações azul e nada mais. */
  const ehSecaoAberta = temFilhos && estaAtivo && !colapsado;

  /* Os filhos ficam abertos quando a seção está ativa. Não é estado guardado: um
     acordeão que lembra "fechado" enquanto o usuário está DENTRO da seção
     esconde onde ele se encontra, que é a única coisa que a navegação precisa
     dizer. Colapsado, não há espaço para filhos — o pai leva ao índice. */
  const mostrarFilhos = temFilhos && estaAtivo && !colapsado;

  const conteudo = (
    <Link
      href={item.href}
      aria-current={estaAtivo && !temFilhos ? "page" : undefined}
      className={
        "relative flex items-center rounded-controle no-underline " +
        "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] " +
        (ehSecaoAberta
          ? "text-primary hover:bg-surface-hover"
          : estaAtivo
            ? "bg-tint-primary text-primary"
            : "text-text-secondary hover:bg-surface-hover hover:text-text") +
        (colapsado ? " justify-center" : " gap-2.5")
      }
      style={{
        padding: colapsado ? "8px 0" : "8px 10px",
        // A barra é o segundo sinal, e é o que sobrevive ao teste do cinza.
        boxShadow: estaAtivo ? "inset 2px 0 0 0 var(--tk-primary)" : undefined,
      }}
    >
      <Icone nome={item.icone} tamanho={17} cor={estaAtivo ? "marca" : "neutro"} />
      {!colapsado && (
        <>
          <span className="text-label min-w-0 flex-1 truncate">{item.label}</span>
          {!!item.contagem && item.contagem > 0 && (
            <span
              className="bg-tint-danger text-on-tint-danger text-caption grid flex-none place-items-center rounded-pill"
              style={{ minWidth: 18, height: 18, padding: "0 5px", fontWeight: 600 }}
            >
              {item.contagem > 99 ? "99+" : item.contagem}
            </span>
          )}
        </>
      )}
      {/* Colapsado o número não cabe, mas "há algo para ver" não pode sumir:
          vira um ponto. */}
      {colapsado && !!item.contagem && item.contagem > 0 && (
        <span
          aria-hidden
          className="bg-danger rounded-pill"
          style={{ position: "absolute", top: 5, right: 9, width: 7, height: 7 }}
        />
      )}
    </Link>
  );

  return (
    <div>
      {/* Colapsado o rótulo só existe na tooltip — sem ela o rail vira sete
          ícones sem nome, que é o defeito da barra flutuante que este redesign
          está matando. */}
      {colapsado ? (
        <Tooltip
          texto={item.contagem ? `${item.label} (${item.contagem})` : item.label}
          lado="baixo"
          /* 🐛 SEM ISTO O ITEM MEDE 17px. Ver `larguraCheia` na `Tooltip`: o
             embrulho encolhia o link ao tamanho do ícone, jogando os sete itens
             13px para fora do eixo e reduzindo a área de clique de 43px para 17. */
          larguraCheia
        >
          {conteudo}
        </Tooltip>
      ) : (
        conteudo
      )}

      {mostrarFilhos && (
        <div style={{ marginTop: 2, marginBottom: 4 }}>
          {item.filhos!.map((f) => {
            const filhoAtivo = pathname === f.href || pathname.startsWith(f.href + "/");
            return (
              <Link
                key={f.href}
                href={f.href}
                aria-current={filhoAtivo ? "page" : undefined}
                className={
                  "text-label flex items-center rounded-controle no-underline " +
                  "focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] " +
                  (filhoAtivo ? "text-primary bg-tint-primary" : "text-text-muted hover:bg-surface-hover hover:text-text")
                }
                /* O recuo alinha o texto do filho com o texto do pai (ícone de
                   17 + gap de 10), então a hierarquia se lê pela coluna, não por
                   um bullet. */
                style={{ padding: "6px 10px 6px 37px" }}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
