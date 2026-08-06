"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";

import type { DashboardPrefsDTO } from "@/lib/actions/dashboardPrefs";
import type { ExpenseDTO } from "@/lib/actions/expenses";
import type { AdProfileDTO } from "@/lib/actions/facebook";
import type { NotificationDTO, NotificationSettingsDTO } from "@/lib/actions/notifications";
import type { PixelConfigDTO } from "@/lib/actions/pixels";
import type { RuleDTO } from "@/lib/actions/rules";
import type { ApiCredentialDTO } from "@/lib/actions/apiCredentials";
import type { WebhookRowDTO } from "@/lib/actions/webhooks";
import type { WorkspaceDTO } from "@/lib/actions/workspaces";

import { TraffikProvider } from "@/components/dashboard/TraffikContext";
import { useTraffikState } from "@/components/dashboard/useTraffikState";
import { Greeting } from "./Greeting";
import { CommandBar, useAtalhoPaleta, type GrupoComando, type ItemComando } from "./CommandBar";
import { ContextBar } from "./ContextBar";
import { Rail } from "./Rail";
import type { UsuarioShell } from "./UserMenu";

/* ══════════════════════════════════════════════════════════════════════════════
   A faixa de filtros — o contrato que impede um botão inerte no header
   ══════════════════════════════════════════════════════════════════════════════

   O botão `Filtros` mora no header; a faixa que ele controla mora DENTRO da
   tela. Sem um contrato entre os dois, as opções seriam desenhar o botão em toda
   tela (inerte em 5 de 8) ou não desenhá-lo.

   Aqui a tela declara "eu tenho faixa de filtros" e lê se deve mostrá-la. O
   header só desenha o botão quando alguém declarou. Não há como o botão existir
   sem ter o que controlar — é a diferença entre um controle e uma decoração.
   ═════════════════════════════════════════════════════════════════════════════ */

type ContratoFiltros = {
  registrada: boolean;
  visivel: boolean;
  alternar: () => void;
  registrar: (tem: boolean) => void;
};

const FiltrosContext = React.createContext<ContratoFiltros | null>(null);

/**
 * Altura da faixa de ambiente. É UMA constante porque dois lugares dependem
 * dela: o `padding-top` do shell e a altura do rail. Dois valores escritos à mão
 * é como o rodapé do rail voltaria a ser cortado sem ninguém notar.
 */
const ALTURA_FAIXA_AMBIENTE = 26;

export function useFaixaDeFiltros(): ContratoFiltros {
  const c = React.useContext(FiltrosContext);
  if (!c) throw new Error("useFaixaDeFiltros precisa estar dentro do <AppShell>.");
  return c;
}

/**
 * Chame numa tela que tenha faixa de filtros. Devolve se a faixa deve aparecer.
 *
 * ⚠️ O `registrar(false)` na limpeza não é ritual: sem ele, sair do Dashboard
 * para Taxas deixaria o botão `Filtros` no header de uma tela que não tem faixa
 * nenhuma — inerte, que é exatamente o que este contrato existe para impedir.
 */
export function useRegistrarFaixaDeFiltros(): boolean {
  const { registrar, visivel } = useFaixaDeFiltros();
  React.useEffect(() => {
    registrar(true);
    return () => registrar(false);
  }, [registrar]);
  return visivel;
}

export function AppShell({
  user,
  trackingId,
  appUrl,
  banco,
  initialWebhooks,
  initialApiCredentials,
  dashboardPrefs,
  initialProfiles,
  initialPixels,
  initialNotifSettings,
  initialNotifications,
  initialExpenses,
  initialRules,
  timezone,
  workspaces,
  lastWorkspaceId,
  children,
}: {
  user?: UsuarioShell;
  trackingId?: string;
  appUrl?: string;
  /** Qual banco o servidor está usando — ver `lib/dbEnv.ts`. */
  banco?: { ref: string | null; rotulo: string; producao: boolean; avisar: boolean };
  initialWebhooks?: WebhookRowDTO[];
  initialApiCredentials?: ApiCredentialDTO[];
  dashboardPrefs?: DashboardPrefsDTO | null;
  initialProfiles?: AdProfileDTO[];
  initialPixels?: PixelConfigDTO[];
  initialNotifSettings?: NotificationSettingsDTO;
  initialNotifications?: NotificationDTO[];
  initialExpenses?: ExpenseDTO[];
  initialRules?: RuleDTO[];
  timezone?: string;
  workspaces?: WorkspaceDTO[];
  lastWorkspaceId?: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const v = useTraffikState({
    trackingId,
    appUrl,
    initialWebhooks,
    initialApiCredentials,
    dashboardPrefs,
    initialProfiles,
    initialPixels,
    initialNotifSettings,
    initialNotifications,
    initialExpenses,
    initialRules,
    timezone,
    workspaces,
    lastWorkspaceId,
  });

  // ── Paleta ⌘K ──────────────────────────────────────────────────────────────
  const [paletaAberta, setPaletaAberta] = React.useState(false);
  const abrirPaleta = React.useCallback(() => setPaletaAberta(true), []);
  const fecharPaleta = React.useCallback(() => setPaletaAberta(false), []);
  useAtalhoPaleta(abrirPaleta);

  const grupos = useComandos(v);

  // ── Contrato da faixa de filtros ───────────────────────────────────────────
  const [temFaixa, setTemFaixa] = React.useState(false);
  const [faixaVisivel, setFaixaVisivel] = React.useState(true);
  const registrar = React.useCallback((tem: boolean) => setTemFaixa(tem), []);
  const filtros = React.useMemo<ContratoFiltros>(
    () => ({
      registrada: temFaixa,
      visivel: faixaVisivel,
      alternar: () => setFaixaVisivel((x) => !x),
      registrar,
    }),
    [temFaixa, faixaVisivel, registrar],
  );

  return (
    <TraffikProvider value={v}>
      <FiltrosContext.Provider value={filtros}>
        {/* Faixa de ambiente. Aparece quando o banco NÃO é a produção — inclusive
            quando é desconhecido. Nasceu de um teste em localhost que apagou
            configuração real: naquele dia nada na tela dizia em qual banco a
            pessoa estava. */}
        {banco?.avisar && (
          <div
            role="status"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "5px 12px",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".08em",
              textTransform: "uppercase",
              background:
                "repeating-linear-gradient(45deg,#f59e0b,#f59e0b 12px,#b45309 12px,#b45309 24px)",
              color: "#1c1300",
            }}
          >
            <span>⚠ {banco.rotulo}</span>
            {banco.ref && <span style={{ opacity: 0.75, fontWeight: 600 }}>{banco.ref}</span>}
            <span style={{ opacity: 0.75, fontWeight: 600, textTransform: "none" }}>
              os dados desta tela são falsos
            </span>
          </div>
        )}

        {/* `tk-tema` é a ponte para o sistema novo. Fica AQUI, na raiz do shell:
            a moldura é o que se vê primeiro, e moldura antiga em volta de tela
            nova tem costura pior do que o contrário. */}
        <div
          className="tk-tema flex"
          style={{ minHeight: "100vh", paddingTop: banco?.avisar ? ALTURA_FAIXA_AMBIENTE : undefined }}
        >
          <Rail
            usuario={user}
            areas={v.workspaces}
            areaAtiva={v.workspaceAtiva}
            aoTrocarArea={v.trocarWorkspace}
            naoLidas={v.notifUnread}
            deslocamentoTopo={banco?.avisar ? ALTURA_FAIXA_AMBIENTE : 0}
          />

          <div
            className="flex min-w-0 flex-1 flex-col overflow-auto"
            style={{ padding: "var(--space-6) var(--space-8)", gap: "var(--space-6)" }}
          >
            <ContextBar
              pathname={pathname}
              usuario={user}
              saudacao={
                pathname === "/dashboard" ? (
                  <Greeting nome={user?.name} email={user?.email} subtitulo="Visão geral do tráfego, vendas e retorno em tempo real" />
                ) : undefined
              }
              notificacoes={v.notifItems}
              naoLidas={v.notifUnread}
              aoMarcarTodasLidas={v.markAllRead}
              aoAbrirPaleta={abrirPaleta}
            />

            {/* A `key` pelo pathname remonta o nó a cada rota, disparando a
                animação de entrada de novo — sem isso o React reaproveita o nó e
                nada anima. */}
            <div
              key={pathname}
              className="page-enter flex flex-col"
              style={{ gap: "var(--space-6)" }}
            >
              {children}
            </div>
          </div>
        </div>

        {/* Montada só quando aberta, e isso é o que zera busca e seleção a cada
            abertura — ver a nota no topo do `CommandBar`. */}
        {paletaAberta && (
          <CommandBar
            aberta
            aoFechar={fecharPaleta}
            grupos={grupos}
            aoEscolher={(item) => router.push(item.href)}
          />
        )}
      </FiltrosContext.Provider>
    </TraffikProvider>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   O que a paleta ⌘K encontra
   ══════════════════════════════════════════════════════════════════════════════

   ⚠️ CAMPANHAS VÊM DE `v.adsData`, NÃO DE `v.filteredCampaigns`. A lista
   `filtered*` já passou pelo `adsMatch`, que aplica a BUSCA E O STATUS do
   Gerenciador. Usá-la aqui faria o resultado do ⌘K depender do que estivesse
   digitado numa caixa de outra tela — e o defeito seria silencioso, porque com o
   campo vazio (o caso comum) as duas listas são idênticas.
   ═════════════════════════════════════════════════════════════════════════════ */

const TELAS: ItemComando[] = [
  { id: "tela-dashboard", rotulo: "Dashboard", icone: "painel", href: "/dashboard", sinonimos: "inicio visao geral kpi" },
  { id: "tela-gerenciador", rotulo: "Gerenciador de Anúncios", icone: "gerenciador", href: "/dashboard/gerenciador", sinonimos: "campanhas conjuntos ads meta" },
  { id: "tela-criativos", rotulo: "Criativos", icone: "criativos", href: "/dashboard/criativos", sinonimos: "anuncios ranking" },
  { id: "tela-regras", rotulo: "Regras", icone: "regras", href: "/dashboard/regras", sinonimos: "automacao" },
  { id: "tela-notificacoes", rotulo: "Notificações", icone: "sino", href: "/dashboard/notificacoes", sinonimos: "alertas relatorios" },
  { id: "tela-taxas", rotulo: "Taxas e Despesas", icone: "taxas", href: "/dashboard/taxas", sinonimos: "custos lucro gateway imposto" },
  { id: "tela-areas", rotulo: "Áreas de Trabalho", icone: "camadas", href: "/dashboard/areas", sinonimos: "workspace operacao" },
];

const TELAS_INTEGRACAO: ItemComando[] = [
  { id: "int-anuncios", rotulo: "Integrações › Anúncios", icone: "integracoes", href: "/dashboard/integracoes/anuncios", sinonimos: "perfil facebook meta conta" },
  { id: "int-webhooks", rotulo: "Integrações › Webhooks", icone: "integracoes", href: "/dashboard/integracoes/webhooks", sinonimos: "gateway kirvano cakto venda" },
  { id: "int-utms", rotulo: "Integrações › UTMs", icone: "integracoes", href: "/dashboard/integracoes/utms", sinonimos: "xcod parametros link" },
  { id: "int-pixel", rotulo: "Integrações › Pixel/Eventos", icone: "integracoes", href: "/dashboard/integracoes/pixel", sinonimos: "capi evento script" },
  { id: "int-testes", rotulo: "Integrações › Testes", icone: "bussola", href: "/dashboard/integracoes/testes", sinonimos: "diagnostico rastreamento" },
];

function useComandos(v: ReturnType<typeof useTraffikState>): GrupoComando[] {
  return React.useMemo(() => {
    const campanhas: ItemComando[] = (v.adsData?.campaigns ?? []).map((c) => ({
      id: `camp-${c.id}`,
      rotulo: c.name,
      apoio: "Campanha",
      icone: "gerenciador",
      href: "/dashboard/gerenciador",
    }));

    const criativos: ItemComando[] = v.creatives.map((c) => ({
      id: `criat-${c.id}`,
      rotulo: c.name,
      apoio: c.campaign,
      icone: "criativos",
      href: "/dashboard/criativos",
    }));

    const integracoes: ItemComando[] = [
      ...TELAS_INTEGRACAO,
      ...v.adProfiles.map<ItemComando>((p) => ({
        id: `perfil-${p.id}`,
        rotulo: p.name,
        apoio: "Perfil de anúncios",
        icone: "contas",
        href: "/dashboard/integracoes/anuncios",
      })),
      ...v.webhooks.map<ItemComando>((w) => ({
        id: `wh-${w.id}`,
        rotulo: w.name,
        apoio: `Webhook · ${w.platform}`,
        icone: "link",
        href: "/dashboard/integracoes/webhooks",
      })),
      ...v.pixels.map<ItemComando>((p) => ({
        id: `px-${p.id}`,
        rotulo: p.name,
        apoio: "Pixel",
        icone: "clique",
        href: "/dashboard/integracoes/pixel",
      })),
    ];

    return [
      { titulo: "Telas", itens: TELAS },
      { titulo: "Campanhas", itens: campanhas },
      { titulo: "Criativos", itens: criativos },
      { titulo: "Integrações", itens: integracoes },
    ];
  }, [v.adsData, v.creatives, v.adProfiles, v.webhooks, v.pixels]);
}
