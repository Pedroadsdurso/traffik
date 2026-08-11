"use client";

import * as React from "react";

import { useTheme } from "@/components/theme/ThemeProvider";
import { Icone } from "@/components/dashboard/ui/Icone";
import { Badge } from "./Badge";
import { HelpMenu } from "./HelpMenu";
import { NotificationsBell, type ItemNotificacao } from "./NotificationsBell";
import { UserMenu, type UsuarioShell } from "./UserMenu";
import { useFaixaDeFiltros } from "./AppShell";

/**
 * ContextBar — a barra de topo. Título à esquerda, busca no centro, ações à
 * direita.
 *
 * 🔧 O TÍTULO E A LINHA DE APOIO FICAM. O `01-PROMPT-MASTER` §9 pede uma barra de
 * 48px que os REMOVE ("o item ativo do rail já informa"). O `04`, que tem
 * precedência, os mantém — e com razão: o rail colapsado não tem rótulo nenhum,
 * e o subtítulo é onde mora a única frase que diz o que a tela faz.
 *
 * 🔧 O SELETOR DE PERÍODO NÃO SOBE PARA CÁ. Nas referências ele vive no header;
 * aqui os filtros são QUATRO (período, conta, produto, fonte) e não cabem. Eles
 * ficam na faixa abaixo do título, que é o que o botão `Filtros` mostra e
 * esconde.
 */

const TITULOS: [teste: (p: string) => boolean, titulo: string, apoio: string][] = [
  [(p) => p.startsWith("/dashboard/gerenciador"), "Gerenciador de Anúncios", "Administre campanhas, conjuntos e anúncios do Facebook Ads"],
  [(p) => p.startsWith("/dashboard/criativos"), "Ranking de Criativos", "Os anúncios com melhor performance hoje"],
  [(p) => p.startsWith("/dashboard/regras"), "Regras de Automação", "Automatize pausas, escalas e alertas por condição"],
  [(p) => p.startsWith("/dashboard/notificacoes"), "Notificações", "Alertas de venda e relatórios programados"],
  [(p) => p.startsWith("/dashboard/taxas"), "Taxas e Despesas", "Configure custos para um cálculo de lucro preciso"],
  [(p) => p.startsWith("/dashboard/integracoes"), "Integrações", "Conecte e gerencie todas as plataformas e serviços da sua operação"],
  [(p) => p.startsWith("/dashboard/utm"), "UTM & Snippets", "Crie, gerencie e reutilize parâmetros UTM e trechos de código para rastrear suas campanhas"],
  [(p) => p.startsWith("/dashboard/areas"), "Áreas de Trabalho", "Separe operações diferentes sem misturar os números"],
];

export function tituloDaRota(pathname: string): [string, string] {
  for (const [teste, titulo, apoio] of TITULOS) if (teste(pathname)) return [titulo, apoio];
  return ["Dashboard", "Visão geral do tráfego, vendas e retorno em tempo real"];
}

export function ContextBar({
  pathname,
  usuario,
  saudacao,
  notificacoes,
  naoLidas,
  aoMarcarTodasLidas,
  aoAbrirPaleta,
}: {
  pathname: string;
  usuario?: UsuarioShell;
  /** O Dashboard troca o título por "Bom dia, Pedro" — as outras telas, não. */
  saudacao?: React.ReactNode;
  notificacoes: ItemNotificacao[];
  naoLidas: number;
  aoMarcarTodasLidas: () => void;
  aoAbrirPaleta: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const [titulo, apoio] = tituloDaRota(pathname);
  const filtros = useFaixaDeFiltros();

  return (
    <header className="flex items-start justify-between gap-4">
      <div className="min-w-0" style={{ flex: "0 1 auto" }}>
        {saudacao ?? (
          <>
            {/* `.text-display` (28/34), não o `h1` de 42px do sistema antigo:
                num painel denso o título não é o herói da tela — o número é. */}
            <h1 className="text-display text-text" style={{ margin: 0 }}>
              {titulo}
            </h1>
            <p className="text-body text-text-secondary" style={{ margin: "2px 0 0" }}>
              {apoio}
            </p>
          </>
        )}
      </div>

      {/* ── Busca global ────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={aoAbrirPaleta}
        aria-label="Buscar (Ctrl+K)"
        className="bg-surface border-border text-text-muted hover:bg-surface-hover hover:text-text-secondary flex cursor-pointer items-center gap-2 rounded-controle border focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        style={{ height: "var(--tk-altura-controle)", padding: "0 10px", width: "min(340px, 32vw)", flex: "0 1 auto" }}
      >
        <Icone nome="bussola" tamanho={16} cor="suave" />
        <span className="text-body min-w-0 flex-1 truncate text-left">Buscar…</span>
        <kbd className="text-caption border-border rounded-controle border px-1.5" style={{ flex: "none" }}>
          ⌘K
        </kbd>
      </button>

      {/* ⛔ TODO CONTROLE DESTA BARRA LÊ `--tk-altura-controle`, sem exceção — a
          busca acima, o `Filtros`, a ajuda, o sino e o tema. É a mesma medida
          que `Button`, `Input`, `Select` e `Segmented` consomem.

          🩼 E não há `marginTop` de alinhamento aqui. Havia: o grupo inteiro
          carregava um `marginTop: 4` que o empurrava para baixo da busca. Ele
          nasceu como curativo de 2px num botão de 34px fixos, e quando aquele
          botão passou a ler o token o curativo NÃO morreu — SUBIU UM NÍVEL, do
          botão para o `<div>` do grupo, onde ninguém mais o relacionava com a
          causa. É a variação mais difícil da família: o ajuste manual não fica
          ao lado do valor que ele compensa, então o `grep` que procura os dois
          juntos não acha.

          ⚠️ O defeito das alturas na mão era MUDO na configuração em que se
          testa: o app roda em `:root`, onde `--tk-altura-controle` vale
          exatamente `32px`. Os quatro controles fixos em `32` concordavam por
          coincidência. Em `[data-density="default"]` (36px) e `comfortable`
          (40px) só a busca crescia e a barra se partia. */}
      <div className="flex flex-shrink-0 items-center gap-1.5">
        {/*
          ⛔ O BOTÃO `Filtros` SÓ EXISTE ONDE HÁ FAIXA DE FILTROS, e isso é
          verificado em tempo de execução, não presumido: a tela REGISTRA a faixa
          dela (`useRegistrarFaixaDeFiltros`) e este botão só aparece se alguém
          registrou. Renderizá-lo sempre daria um botão inerte em 5 das 8 telas —
          "controle que não controla nada é pior que código morto".
        */}
        {filtros.registrada && (
          <button
            type="button"
            onClick={filtros.alternar}
            aria-pressed={filtros.visivel}
            aria-label={filtros.visivel ? "Esconder filtros" : "Mostrar filtros"}
            className={
              "flex cursor-pointer items-center gap-1.5 rounded-controle border px-2.5 focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 " +
              (filtros.visivel
                ? "bg-tint-primary text-primary border-transparent"
                : "bg-transparent text-text-secondary border-border hover:bg-surface-hover hover:text-text")
            }
            style={{ height: "var(--tk-altura-controle)" }}
          >
            <Icone nome="ajustes" tamanho={16} cor={filtros.visivel ? "marca" : "neutro"} />
            <span className="text-label">Filtros</span>
          </button>
        )}

        <HelpMenu />

        <NotificationsBell
          itens={notificacoes}
          naoLidas={naoLidas}
          aoMarcarTodasLidas={aoMarcarTodasLidas}
        />

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Alternar para tema claro" : "Alternar para tema escuro"}
          title={theme === "dark" ? "Tema claro" : "Tema escuro"}
          className="text-text-secondary hover:bg-surface-hover hover:text-text grid cursor-pointer place-items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
          style={{ width: "var(--tk-altura-controle)", height: "var(--tk-altura-controle)" }}
        >
          <Icone nome={theme === "dark" ? "temaClaro" : "temaEscuro"} tamanho={17} />
        </button>

        <UserMenu usuario={usuario} variante="avatar" />

        {/* "Ao vivo" é dado ACONTECENDO — o único lugar do sistema onde o ciano
            é a cor certa, e um dos seis itens da lista fechada do glow. */}
        <Badge tom="accent" aoVivo ponto>
          Ao vivo
        </Badge>
      </div>
    </header>
  );
}
