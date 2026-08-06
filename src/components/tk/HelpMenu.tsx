"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Icone } from "@/components/dashboard/ui/Icone";
import { DropdownMenu, type ItemMenu } from "./DropdownMenu";

/**
 * Central de ajuda — o `?` do header.
 *
 * ⛔ ELA NÃO É UM ÍNDICE DE "O QUE CADA TELA FAZ", e a ausência foi decidida em
 * 06/08/2026. Esse conteúdo é documentação que ninguém lê e que envelhece
 * sozinha: no dia em que uma tela mudar, o texto continua descrevendo a antiga —
 * e esta base já tem o registro de uma constante de texto órfã que instruía o
 * usuário a reintroduzir o bug que uma reforma tinha consertado.
 *
 * Aqui só entra o que é verificável no próprio código:
 *
 * 1. **atalhos de teclado que existem de verdade** — hoje ⌘K é o único, e a
 *    lista tem exatamente um item por isso, não por preguiça;
 * 2. **link para Testes de integração**, que é a tela que responde "por que meu
 *    dado não está chegando" — a pergunta que traz alguém à ajuda.
 *
 * ⚠️ `/dashboard/integracoes/testes` é uma tela real e entregue (Bloco 13), mas
 * **saiu da navegação** do rail por decisão do `03` ("Aba Testes. Já decidido").
 * Este link é o que a mantém alcançável. Removê-lo daqui deixa a tela órfã.
 *
 * Quando existir guia de verdade, ele entra nesta lista.
 */
export function HelpMenu() {
  const router = useRouter();
  const [aberto, setAberto] = React.useState(false);
  const [gatilho, setGatilho] = React.useState<HTMLElement | null>(null);

  const itens: ItemMenu[] = [
    {
      rotulo: "Testes de integração",
      icone: <Icone nome="bussola" tamanho={15} cor="suave" />,
      aoEscolher: () => router.push("/dashboard/integracoes/testes"),
    },
  ];

  return (
    <>
      <button
        ref={setGatilho}
        type="button"
        onClick={() => setAberto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-label="Central de ajuda"
        title="Central de ajuda"
        className="text-text-secondary hover:bg-surface-hover hover:text-text grid cursor-pointer place-items-center rounded-controle border-0 bg-transparent focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
        style={{ width: 32, height: 32 }}
      >
        <Icone nome="info" tamanho={17} />
      </button>

      <DropdownMenu
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        gatilho={gatilho}
        itens={itens}
        alinhamento="fim"
        rotuloAcessivel="Central de ajuda"
        cabecalho={
          <div className="border-b border-border mb-1 px-2.5 pt-1.5 pb-2">
            <div className="text-micro text-text-muted mb-1.5">Atalhos</div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-label text-text">Busca global</span>
              <kbd className="text-caption text-text-muted border border-border rounded-controle px-1.5 py-0.5">
                ⌘K
              </kbd>
            </div>
          </div>
        }
      />
    </>
  );
}
