"use client";

import * as React from "react";

import { Icone } from "@/components/dashboard/ui/Icone";
import { Popover } from "./Popover";

/**
 * Central de ajuda — o `?` do header. **Só atalhos de teclado.**
 *
 * ⛔ ELA NÃO É UM ÍNDICE DE "O QUE CADA TELA FAZ", e a ausência foi decidida em
 * 06/08/2026. Esse conteúdo é documentação que ninguém lê e que envelhece
 * sozinha: no dia em que uma tela mudar, o texto continua descrevendo a antiga —
 * e esta base já tem o registro de uma constante de texto órfã que instruía o
 * usuário a reintroduzir o bug que uma reforma tinha consertado.
 *
 * ⛔ E NÃO ENTRA LINK PARA TELA QUE SAIU DO MENU. Esta lista chegou a ter um
 * "Testes de integração", posto aqui justamente para manter a tela alcançável
 * depois que o `03` a tirou da navegação. **Removido no mesmo dia, por decisão
 * do dono:** uma tela inteira acessível só por dentro de um popover de atalhos é
 * PIOR que uma tela fora do menu — a primeira parece disponível e não é
 * encontrável; a segunda é honesta sobre o próprio estado.
 *
 ⛔ A tela de Testes NÃO EXISTE MAIS. O prazo dela era o passo de Integrações, e
 * ele chegou em 06/08/2026: `TestesView` (911 linhas) e `TestadorPayloadCard`
 * (244, importado só por ela) foram DELETADOS, junto da rota. Saiu também da
 * paleta ⌘K — link de paleta para rota inexistente é 404 com cara de recurso.
 *
 * ⚠️ Ela tem UM item hoje, e isso não é preguiça: ⌘K é o único atalho que existe
 * de verdade. Vazia e honesta é melhor que cheia de link improvisado. Guia de
 * verdade entra aqui quando existir.
 */
export function HelpMenu() {
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);

  return (
    <>
      <button
        ref={setGatilho}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="dialog"
        aria-expanded={aberto}
        aria-label="Central de ajuda"
        title="Central de ajuda"
        className="text-text-secondary hover:bg-surface-hover hover:text-text grid cursor-pointer place-items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        /* Quadrado, e o lado é `--tk-altura-controle` — o mesmo dos vizinhos na
           barra de topo. Fixo em px ele concordava com eles só na densidade
           padrão, que é a única em que se testa. */
        style={{ width: "var(--tk-altura-controle)", height: "var(--tk-altura-controle)" }}
      >
        <Icone nome="info" tamanho={17} />
      </button>

      {/* `Popover` direto, e não `DropdownMenu`: sem nenhuma ação na lista, um
          `role="menu"` sem um único `menuitem` dentro é ARIA inválida — o leitor
          de tela anuncia um menu e não acha item nenhum. Isto é um painel de
          informação, e o papel certo é `dialog`. */}
      <Popover
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        gatilho={gatilho}
        alinhamento="fim"
        larguraDoGatilho={false}
        papel="dialog"
      >
        <div aria-label="Central de ajuda" style={{ minWidth: 210 }} className="px-2.5 py-2">
          <div className="text-micro text-text-muted mb-2">Atalhos de teclado</div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-label text-text">Busca global</span>
            <kbd className="text-caption text-text-muted border border-border rounded-controle px-1.5 py-0.5">
              ⌘K
            </kbd>
          </div>
        </div>
      </Popover>
    </>
  );
}
